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
    'implemented-not-audited': 'implemented-not-audited',
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
      selection: { kind: 'selected' },
      loopState: { status: 'current' },
    })).toBe(0);
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
