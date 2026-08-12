import { describe, expect, it } from 'vitest';

import {
  buildContextProjection,
  contextExitCode,
  hashTreeEntries,
  parseLoopState,
} from '../codex-context.mjs';

const ledgerFixture = () => ({
  object: 'fixture',
  selectionRule: 'fixture',
  statusDefinitions: {
    pending: 'pending',
    drafted: 'drafted',
    'implemented-not-audited': 'implemented-not-audited',
    audited: 'audited',
    'judge-gated': 'judge-gated',
    deferred: 'deferred',
    shipped: 'shipped',
  },
  judgePolicy: { reference: 'fixture' },
  goalPolicy: { scope: 'normal-commander-edh' },
  plannedSequence: [
    { type: 'design-slice', domainId: 'design', status: 'pending', crOrder: 1 },
    { type: 'domain-slice', domainId: 'dep', status: 'shipped', crOrder: 100 },
    {
      type: 'domain-slice',
      domainId: 'early',
      status: 'pending',
      crOrder: 303.7,
      dependsOn: ['dep'],
    },
    {
      type: 'domain-slice',
      domainId: 'later',
      status: 'pending',
      crOrder: 609,
      dependsOn: ['early'],
    },
  ],
  domains: [
    { id: 'design', status: 'pending', crOrder: 1 },
    { id: 'dep', status: 'shipped', crOrder: 100 },
    { id: 'early', status: 'pending', crOrder: 303.7, dependsOn: ['dep'] },
    { id: 'later', status: 'pending', crOrder: 609, dependsOn: ['early'] },
  ],
});

const project = (ledger, overrides = {}) =>
  buildContextProjection({
    ledger,
    headLedger: structuredClone(ledger),
    headSha: 'a'.repeat(40),
    sourceSha256: 'b'.repeat(64),
    loopStateText: `milestone: complete\nbaseSha: ${'a'.repeat(40)}\ntreeFingerprint: tree`,
    treeFingerprint: 'tree',
    ...overrides,
  });

describe('codex context projection', () => {
  it('selects the earliest eligible CR entry and closes dependencies recursively', () => {
    const projection = project(ledgerFixture());

    expect(projection.health.ok).toBe(true);
    expect(projection.selection).toMatchObject({
      kind: 'selected',
      domainId: 'early',
      reason: 'earliest-eligible-cr-order',
    });
    expect(projection.dependencies.map((entry) => entry.id)).toEqual(['dep']);
    expect(projection.loopState.status).toBe('current');
    expect(Buffer.byteLength(JSON.stringify(projection))).toBeLessThan(12 * 1024);
  });

  it('returns an explicit domain and its complete dependency closure', () => {
    const ledger = ledgerFixture();
    const projection = project(ledger, { domainId: 'later' });

    expect(projection.domain.id).toBe('later');
    expect(projection.dependencies.map((entry) => entry.id)).toEqual(['dep', 'early']);
  });

  it('selects an active-program entry before an eligible lower-CR-order entry', () => {
    const ledger = ledgerFixture();
    ledger.goalPolicy.activeProgram = {
      id: 'O4P',
      domainIds: ['later'],
    };
    ledger.plannedSequence.find((entry) => entry.domainId === 'later').dependsOn = ['dep'];
    ledger.domains.find((entry) => entry.id === 'later').dependsOn = ['dep'];
    const projection = project(ledger);

    expect(projection.health.ok).toBe(true);
    expect(projection.selection).toMatchObject({
      kind: 'selected',
      domainId: 'later',
      reason: 'active-program-order',
    });
    expect(projection.activeProgram).toEqual({
      id: 'O4P',
      domainIds: ['later'],
      status: 'active',
      nextDomainId: 'later',
    });
  });

  it('returns to normal CR order after every active-program entry ships', () => {
    const ledger = ledgerFixture();
    ledger.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['later'] };
    ledger.plannedSequence.find((entry) => entry.domainId === 'later').status = 'shipped';
    ledger.domains.find((entry) => entry.id === 'later').status = 'shipped';
    const projection = project(ledger);

    expect(projection.selection).toMatchObject({
      kind: 'selected',
      domainId: 'early',
      reason: 'earliest-eligible-cr-order',
    });
    expect(projection.activeProgram).toMatchObject({
      status: 'complete',
      nextDomainId: null,
    });
  });

  it('fails closed rather than skipping a blocked active-program entry', () => {
    const ledger = ledgerFixture();
    ledger.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['later'] };
    const projection = project(ledger);

    expect(projection.selection).toMatchObject({
      kind: 'blocked',
      domainId: 'later',
      reason: 'active-program-dependency-not-shipped',
      dependency: 'early',
    });
    expect(projection.activeProgram).toMatchObject({
      status: 'blocked',
      nextDomainId: 'later',
    });
    expect(contextExitCode(projection)).not.toBe(0);
  });

  it('fails integrity for missing, duplicate, and non-linear active-program declarations', () => {
    const missing = ledgerFixture();
    missing.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['missing'] };
    expect(project(missing).health.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ACTIVE_PROGRAM_DOMAIN_MISSING_FROM_COLLECTION' }),
      ]),
    );

    const duplicate = ledgerFixture();
    duplicate.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['early', 'early'] };
    expect(project(duplicate).health.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_ACTIVE_PROGRAM_DOMAIN_ID' }),
      ]),
    );

    const nonLinear = ledgerFixture();
    nonLinear.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['early', 'later'] };
    nonLinear.plannedSequence.find((entry) => entry.domainId === 'later').dependsOn = ['dep'];
    expect(project(nonLinear).health.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ACTIVE_PROGRAM_NON_LINEAR_DEPENDENCY' }),
      ]),
    );
  });

  it('fails closed for malformed, unknown, and cyclic active-program dependencies', () => {
    const malformed = ledgerFixture();
    malformed.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['early', 'later'] };
    malformed.plannedSequence.find((entry) => entry.domainId === 'later').dependsOn = 'early';
    const malformedProjection = project(malformed);
    expect(malformedProjection.health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_DEPENDENCY_LIST' })]),
    );
    expect(malformedProjection.selection.kind).toBe('integrity-error');
    expect(contextExitCode(malformedProjection)).toBe(2);

    const unknown = ledgerFixture();
    unknown.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['early'] };
    unknown.domains.find((entry) => entry.id === 'early').dependsOn = ['missing'];
    unknown.plannedSequence.find((entry) => entry.domainId === 'early').dependsOn = ['missing'];
    const unknownProjection = project(unknown);
    expect(unknownProjection.health.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ACTIVE_PROGRAM_DEPENDENCY_UNKNOWN' }),
      ]),
    );
    expect(unknownProjection.selection.kind).toBe('integrity-error');
    expect(contextExitCode(unknownProjection)).toBe(2);

    const cyclic = ledgerFixture();
    cyclic.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['early', 'later'] };
    for (const entry of cyclic.plannedSequence) {
      if (entry.domainId === 'early') {
        entry.status = 'shipped';
        entry.dependsOn = ['later'];
      }
      if (entry.domainId === 'later') entry.status = 'shipped';
    }
    for (const entry of cyclic.domains) {
      if (entry.id === 'early') {
        entry.status = 'shipped';
        entry.dependsOn = ['later'];
      }
      if (entry.id === 'later') entry.status = 'shipped';
    }
    const cyclicProjection = project(cyclic);
    expect(cyclicProjection.activeProgram).toMatchObject({ status: 'complete' });
    expect(cyclicProjection.health.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ACTIVE_PROGRAM_DEPENDENCY_CYCLE' }),
      ]),
    );
    expect(cyclicProjection.selection.kind).toBe('integrity-error');
    expect(contextExitCode(cyclicProjection)).toBe(2);
  });

  it.each([
    ['domains', { id: 'external', status: 'shipped', dependsOn: [] }],
    ['plannedSequence', {
      type: 'domain-slice',
      domainId: 'external',
      status: 'shipped',
      dependsOn: [],
    }],
  ])('accepts a shipped external dependency present only in %s', (collection, externalEntry) => {
    const ledger = ledgerFixture();
    ledger.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['early'] };
    ledger.domains.find((entry) => entry.id === 'early').dependsOn = ['external'];
    ledger.plannedSequence.find((entry) => entry.domainId === 'early').dependsOn = ['external'];
    ledger[collection].push(externalEntry);
    const projection = project(ledger);

    expect(projection.health.ok).toBe(true);
    expect(projection.selection).toMatchObject({
      kind: 'selected',
      domainId: 'early',
      reason: 'active-program-order',
    });
  });

  it.each([
    ['planned-only', 'plannedSequence', 'plannedSequenceDependencies', 'domainDependencies'],
    ['domain-only', 'domains', 'domainDependencies', 'plannedSequenceDependencies'],
  ])(
    'fails integrity for a %s active-program dependency',
    (_, collection, presentKey, absentKey) => {
      const ledger = ledgerFixture();
      ledger.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['later'] };
      const entry = ledger[collection].find((candidate) =>
        collection === 'domains' ? candidate.id === 'later' : candidate.domainId === 'later',
      );
      entry.dependsOn = ['dep', 'early'];
      const projection = project(ledger);

      expect(projection.health.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'ACTIVE_PROGRAM_DEPENDENCY_MISMATCH',
            domainId: 'later',
            [presentKey]: ['dep', 'early'],
            [absentKey]: ['early'],
          }),
        ]),
      );
      expect(projection.selection).toMatchObject({ kind: 'integrity-error' });
      expect(contextExitCode(projection)).toBe(2);
    },
  );

  it('keeps explicit domain selection ahead of active-program selection', () => {
    const ledger = ledgerFixture();
    ledger.goalPolicy.activeProgram = { id: 'O4P', domainIds: ['later'] };
    const projection = project(ledger, { domainId: 'early' });

    expect(projection.selection).toMatchObject({
      kind: 'selected',
      domainId: 'early',
      reason: 'explicit-domain',
    });
  });

  it('fails closed for status contradictions and count decreases', () => {
    const ledger = ledgerFixture();
    const headLedger = structuredClone(ledger);
    ledger.plannedSequence.find((entry) => entry.domainId === 'early').status = 'shipped';
    ledger.domains.pop();
    const projection = project(ledger, { headLedger });

    expect(projection.health.ok).toBe(false);
    expect(projection.health.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['STATUS_MISMATCH', 'DOMAIN_COUNT_DECREASE']),
    );
    expect(projection.selection.kind).toBe('integrity-error');
  });

  it('fails closed when a domain or sequence status is missing or unknown', () => {
    const missing = ledgerFixture();
    delete missing.domains.find((entry) => entry.id === 'early').status;
    const missingProjection = project(missing);
    expect(missingProjection.health.ok).toBe(false);
    expect(missingProjection.health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_STATUS' })]),
    );

    const unknown = ledgerFixture();
    unknown.plannedSequence.find((entry) => entry.domainId === 'early').status =
      'mystery';
    unknown.domains.find((entry) => entry.id === 'early').status = 'mystery';
    const unknownProjection = project(unknown);
    expect(unknownProjection.health.ok).toBe(false);
    expect(unknownProjection.selection.kind).toBe('integrity-error');
  });

  it('returns ambiguity for a same-rank tie instead of using sequence order', () => {
    const ledger = ledgerFixture();
    ledger.plannedSequence.push({
      type: 'domain-slice',
      domainId: 'same-rank',
      status: 'pending',
      crOrder: 303.7,
      lane: 'pruned',
      dependsOn: ['dep'],
    });
    ledger.domains.push({
      id: 'same-rank',
      status: 'pending',
      crOrder: 303.7,
      lane: 'pruned',
      dependsOn: ['dep'],
    });

    const projection = project(ledger);
    expect(projection.selection).toMatchObject({
      kind: 'ambiguous',
      reason: 'same-cr-order',
      candidates: ['early', 'same-rank'],
    });
  });

  it('marks incomplete, mismatched, or already-shipped loop state stale', () => {
    expect(parseLoopState('milestone: x').reasons).toEqual(
      expect.arrayContaining(['MISSING_BASE_SHA', 'MISSING_TREE_FINGERPRINT']),
    );
    const state = parseLoopState(
      `milestone: dep\nbaseSha: ${'c'.repeat(40)}\ntreeFingerprint: old`,
      {
        headSha: 'a'.repeat(40),
        treeFingerprint: 'new',
        domainStatuses: { dep: 'shipped' },
      },
    );
    expect(state.status).toBe('stale');
    expect(state.reasons).toEqual(
      expect.arrayContaining([
        'BASE_SHA_MISMATCH',
        'TREE_FINGERPRINT_MISMATCH',
        'MATCHING_DOMAIN_ALREADY_SHIPPED',
      ]),
    );
    expect(contextExitCode({
      health: { ok: true },
      selection: { kind: 'selected' },
      loopState: state,
    })).toBe(5);
  });

  it('keeps integrity, ambiguity, and no-selection exits distinct', () => {
    expect(contextExitCode({ health: { ok: false } })).toBe(2);
    expect(contextExitCode({
      health: { ok: true },
      selection: { kind: 'ambiguous' },
      loopState: { status: 'stale' },
    })).toBe(3);
    expect(contextExitCode({
      health: { ok: true },
      selection: { kind: 'none' },
      loopState: { status: 'stale' },
    })).toBe(4);
    expect(contextExitCode({
      health: { ok: true },
      selection: { kind: 'blocked' },
      loopState: { status: 'current' },
    })).toBe(4);
    expect(contextExitCode({
      health: { ok: true },
      selection: { kind: 'selected' },
      loopState: { status: 'current' },
    })).toBe(0);
  });

  it('uses document governance as the sole cycle and token-economy canonical path', () => {
    const projection = project(ledgerFixture());
    expect(projection.canonicalPaths).toContain(
      '.agents/skills/mtg-onedeck-development/references/document-governance.md',
    );
    expect(projection.canonicalPaths).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('/cycle.md'),
        expect.stringContaining('/token-economy.md'),
      ]),
    );
  });

  it('fingerprints sorted paths and content deterministically', () => {
    const first = hashTreeEntries([
      { path: 'b', kind: 'file', content: Buffer.from('two') },
      { path: 'a', kind: 'file', content: Buffer.from('one') },
    ]);
    const second = hashTreeEntries([
      { path: 'a', kind: 'file', content: Buffer.from('one') },
      { path: 'b', kind: 'file', content: Buffer.from('two') },
    ]);
    const changed = hashTreeEntries([
      { path: 'a', kind: 'file', content: Buffer.from('changed') },
      { path: 'b', kind: 'file', content: Buffer.from('two') },
    ]);

    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });
});
