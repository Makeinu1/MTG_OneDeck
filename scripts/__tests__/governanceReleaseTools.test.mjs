import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  addedText,
  buildReleasePreflight,
  checkGeneratedApi,
  fixedNextGuardPaths,
  ownerViolation,
  workflowHasCorrectDiffBase,
} from '../checks/release-preflight.mjs';
import {
  computeCandidateFingerprints,
  readRequiredBaseText,
  verifyTerminalMetadata,
} from '../checks/terminal-metadata.mjs';
import { computeAcceptanceFingerprint, emptyCandidateCounters } from '../lib/supervisor-state.mjs';
import {
  createSupervisorBootstrap,
  createSupervisorEvent,
  supervisorAuthorityPath,
} from '../lib/supervisor-authority.mjs';

const write = (root, path, text) => {
  const absolute = join(root, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, text);
};

const git = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const ledger = (status = 'audited', extra = {}) => ({
  statusDefinitions: { pending: 'pending', audited: 'audited', shipped: 'shipped' },
  goalPolicy: { note: 'semantic policy note', evidence: ['semantic policy evidence'] },
  domains: [{ id: 'M1', status, evidence: [], ...extra }],
  plannedSequence: [{ domainId: 'M1', status, evidence: [], ...extra }],
});

function repoFixture(status = 'audited') {
  const root = mkdtempSync(join(tmpdir(), 'onedeck-terminal-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['config', 'user.email', 'fixture@example.test']);
  write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledger(status), null, 2)}\n`);
  write(root, '.claude/loop-state.md', 'milestone: M1\nstep: implementation\n');
  write(root, 'src/app.ts', 'export const value = 1;\n');
  write(root, 'src/tracked-deletion.ts', 'export const removed = true;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'base']);
  return { root, base: git(root, ['rev-parse', 'HEAD']) };
}

const supervisorReceipt = () => ({
  version: 1,
  contextFingerprint: 'd'.repeat(64),
  baseline: { modelCycles: 0, uncachedInputTokens: 0 },
  supervisor: {
    sessionId: '11111111-1111-4111-8111-111111111111',
    role: 'supervisor',
    byteLength: 10,
    prefixSha256: 'b'.repeat(64),
  },
  participants: [{
    sessionId: '22222222-2222-4222-8222-222222222222',
    role: 'implementer',
    byteLength: 10,
    prefixSha256: 'c'.repeat(64),
  }, {
    sessionId: '33333333-3333-4333-8333-333333333333',
    role: 'cold-auditor',
    byteLength: 10,
    prefixSha256: 'd'.repeat(64),
  }],
  observed: {
    supervisorModelCycles: 1,
    supervisorUncachedInputTokens: 1,
    teamModelCycles: 2,
    teamUncachedInputTokens: 2,
    cachedInputTokens: 0,
    totalInputTokens: 2,
  },
});

function terminalAuthorityFixture({ baseStatus = 'audited', shipped = false } = {}) {
  const { root, base: initialBase } = repoFixture();
  const candidateAuthority = { commit: true, deploy: true, localWrites: true, push: true, ship: true };
  const domain = {
    id: 'M1',
    status: baseStatus,
    dependsOn: [],
    deliveryClass: 'player-outcome',
    playerOutcome: 'Terminal verifier fixture',
    journeyEvidence: ['production-browser:fixture'],
    outcomeDeadlineDomainId: 'M1',
    boundary: 'fixture',
    landingState: ['fixture'],
    manualBoundary: 'none',
    evidence: ['contract.md', 'acceptance.md'],
  };
  const value = {
    ...ledger(),
    statusDefinitions: {
      ...ledger().statusDefinitions,
      'implemented-not-audited': 'implemented-not-audited',
    },
    domains: [domain],
    plannedSequence: [{ ...structuredClone(domain), domainId: 'M1' }],
  };
  value.goalPolicy = {
    activeProgram: {
      domainIds: ['M1'],
      authority: candidateAuthority,
      autonomy: { mode: 'complete' },
    },
    supervisionPolicy: {
      version: 1,
      enforceFromDomainId: 'M1',
      limits: {
        implementerLineages: 1,
        coldAuditorLineages: 1,
        auditWaitChains: 1,
        ciWaitChains: 1,
        correctionWaves: 2,
        fullChecks: 2,
        semanticPushes: 1,
        replacementPushes: 1,
        compactionsPerLineage: 2,
        freshContinuationsPerLineage: 1,
        supervisorModelCycles: 160,
        supervisorUncachedInputTokens: 1_000_000,
        teamModelCycles: 400,
        teamUncachedInputTokens: 1_600_000,
      },
      candidateOverrides: {
        'GOV-CODEX-58A-2026-08': {
          correctionWaves: 3,
          freshContinuationsPerLineage: 3,
          supervisorModelCycles: 360,
          supervisorUncachedInputTokens: 2_100_000,
          teamModelCycles: 620,
          teamUncachedInputTokens: 3_400_000,
        },
      },
    },
  };
  write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(value, null, 2)}\n`);
  const candidate = {
    version: 1,
    id: 'M1-candidate-1',
    domainId: 'M1',
    state: 'push-ready',
    baseSha: initialBase,
    treeFingerprint: 'd'.repeat(64),
    acceptanceFingerprint: computeAcceptanceFingerprint(domain),
    authority: candidateAuthority,
    authoritySource: 'goalPolicy.activeProgram.authority',
    counters: {
      ...emptyCandidateCounters(),
      supervisorModelCycles: 1,
      supervisorUncachedInputTokens: 1,
      teamModelCycles: 2,
      teamUncachedInputTokens: 2,
      implementerLineages: 1,
      coldAuditorLineages: 1,
      auditWaitChains: 1,
      fullChecks: 1,
    },
    lineages: {
      implementer: [{ id: '22222222-2222-4222-8222-222222222222', compactions: 0, freshContinuations: 0 }],
      coldAuditor: [{ id: '33333333-3333-4333-8333-333333333333', compactions: 0, freshContinuations: 0 }],
    },
    waitChains: { audit: ['33333333-3333-4333-8333-333333333333'], ci: [] },
    guardImpact: { reportFingerprint: null, acknowledgement: null },
  };
  const receipt = supervisorReceipt();
  const authority = createSupervisorBootstrap({
    candidate,
    receipt,
    actorSessionId: receipt.supervisor.sessionId,
    actorRole: 'supervisor',
  });
  const path = supervisorAuthorityPath('M1');
  write(root, path, `${JSON.stringify(authority, null, 2)}\n`);
  write(root, '.claude/loop-state.md', [
    'milestone: M1',
    'step: push-ready',
    `baseSha: ${initialBase}`,
    `treeFingerprint: ${candidate.treeFingerprint}`,
    `activeCandidates: ${JSON.stringify([candidate])}`,
  ].join('\n'));
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'semantic authority base']);
  const base = git(root, ['rev-parse', 'HEAD']);
  candidate.releaseHeadSha = base;
  candidate.counters.semanticPushes = 1;
  const appendEvent = (action) => {
    authority.events.push(createSupervisorEvent({
      sequence: authority.events.length,
      action,
      actorSessionId: receipt.supervisor.sessionId,
      actorRole: 'supervisor',
      candidate,
      receipt,
      previousHash: authority.events.at(-1).eventHash,
    }));
  };
  appendEvent('record-semantic-push');
  if (shipped) {
    candidate.counters.ciWaitChains = 1;
    candidate.waitChains.ci = [receipt.supervisor.sessionId];
    appendEvent('start-ci-wait');
    candidate.state = 'ci-passed';
    appendEvent('mark-ci-passed');
    candidate.state = 'shipped';
    appendEvent('ship');
    const shippedLedger = structuredClone(value);
    shippedLedger.domains[0].status = 'shipped';
    shippedLedger.plannedSequence[0].status = 'shipped';
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(shippedLedger, null, 2)}\n`);
  }
  write(root, path, `${JSON.stringify(authority, null, 2)}\n`);
  write(root, '.claude/loop-state.md', [
    'milestone: M1',
    'step: push-ready',
    `baseSha: ${initialBase}`,
    `treeFingerprint: ${candidate.treeFingerprint}`,
    `activeCandidates: ${JSON.stringify([candidate])}`,
  ].join('\n'));
  return { root, base, path, authority };
}

function writeTerminalAuthorityCandidate(root, path, authority) {
  const latestCandidate = authority.events.at(-1).candidate;
  write(root, path, `${JSON.stringify(authority, null, 2)}\n`);
  write(root, '.claude/loop-state.md', [
    `milestone: ${latestCandidate.domainId}`,
    `step: ${latestCandidate.state}`,
    `baseSha: ${latestCandidate.baseSha}`,
    `treeFingerprint: ${latestCandidate.treeFingerprint}`,
    `activeCandidates: ${JSON.stringify([latestCandidate])}`,
  ].join('\n'));
}

function mutateLatestTerminalAuthority(authority, mutate) {
  const changed = structuredClone(authority);
  const previous = changed.events.at(-2);
  const current = changed.events.at(-1);
  mutate(current);
  changed.events[changed.events.length - 1] = createSupervisorEvent({
    sequence: current.sequence,
    action: current.action,
    actorSessionId: current.actorSessionId,
    actorRole: current.actorRole,
    candidate: current.candidate,
    receipt: current.receipt,
    previousHash: previous?.eventHash ?? null,
    reason: current.reason,
  });
  changed.candidateId = changed.events.at(-1).candidate.id;
  return changed;
}

describe('terminal metadata classifier', () => {
  it('allows implemented-not-audited to ship only with the same-domain verified shipped authority proof', () => {
    const valid = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    git(valid.root, ['add', '.']);
    git(valid.root, ['commit', '-qm', 'terminal successor']);
    const terminalHead = git(valid.root, ['rev-parse', 'HEAD']);
    expect(verifyTerminalMetadata({ root: valid.root, base: valid.base, head: terminalHead, requireTerminal: true })).toMatchObject({
      ok: true,
      lane: 'terminal',
    });

    const noProof = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    const baseAuthority = { ...noProof.authority, events: noProof.authority.events.slice(0, 1) };
    baseAuthority.candidateId = baseAuthority.events[0].candidate.id;
    writeTerminalAuthorityCandidate(noProof.root, noProof.path, baseAuthority);
    git(noProof.root, ['add', '.']);
    git(noProof.root, ['commit', '-qm', 'terminal successor without proof']);
    expect(verifyTerminalMetadata({ root: noProof.root, base: noProof.base, requireTerminal: true }).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_TERMINAL_STATUS_TRANSITION' })]),
    );

    const invalid = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    const corrupt = structuredClone(invalid.authority);
    corrupt.events.at(-1).eventHash = '0'.repeat(64);
    writeTerminalAuthorityCandidate(invalid.root, invalid.path, corrupt);
    git(invalid.root, ['add', '.']);
    git(invalid.root, ['commit', '-qm', 'terminal successor with corrupt proof']);
    expect(verifyTerminalMetadata({ root: invalid.root, base: invalid.base, requireTerminal: true }).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_TRACKED_SUPERVISOR_EVENT' }),
        expect.objectContaining({ code: 'INVALID_TERMINAL_STATUS_TRANSITION' }),
      ]),
    );

    const other = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    write(other.root, supervisorAuthorityPath('OTHER'), `${JSON.stringify(other.authority, null, 2)}\n`);
    git(other.root, ['add', '.']);
    git(other.root, ['commit', '-qm', 'terminal successor with other domain']);
    expect(verifyTerminalMetadata({ root: other.root, base: other.base, requireTerminal: true }).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNEXPECTED_TERMINAL_AUTHORITY_PATH' }),
        expect.objectContaining({ code: 'INVALID_TERMINAL_STATUS_TRANSITION' }),
      ]),
    );
  });

  it('accepts only a hash-valid exact-domain supervisor event append', () => {
    const { root, base, path, authority } = terminalAuthorityFixture();
    const valid = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(valid, JSON.stringify(valid.errors)).toMatchObject({ ok: true, lane: 'terminal' });
    expect(valid.terminalFingerprint).toMatch(/^[0-9a-f]{64}$/);

    const rewritten = structuredClone(authority);
    rewritten.events[0].reason = 'rewrite';
    write(root, path, `${JSON.stringify(rewritten, null, 2)}\n`);
    expect(verifyTerminalMetadata({ root, base, requireTerminal: true }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TRACKED_SUPERVISOR_HISTORY_REWRITTEN' }),
    ]));

    write(root, path, `${JSON.stringify({ ...authority, events: authority.events.slice(0, 1) }, null, 2)}\n`);
    expect(verifyTerminalMetadata({ root, base, requireTerminal: true }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_TERMINAL_AUTHORITY_APPEND' }),
    ]));

    const corrupt = structuredClone(authority);
    corrupt.events.at(-1).eventHash = '0'.repeat(64);
    write(root, path, `${JSON.stringify(corrupt, null, 2)}\n`);
    expect(verifyTerminalMetadata({ root, base, requireTerminal: true }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_TRACKED_SUPERVISOR_EVENT' }),
    ]));

    write(root, path, `${JSON.stringify(authority, null, 2)}\n`);
    write(root, supervisorAuthorityPath('OTHER'), `${JSON.stringify(authority, null, 2)}\n`);
    expect(verifyTerminalMetadata({ root, base, requireTerminal: true }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNEXPECTED_TERMINAL_AUTHORITY_PATH' }),
    ]));
  });

  it.each([
    ['candidate extra key', (event) => { event.candidate.unexpected = true; }, 'INVALID_ACTIVE_CANDIDATE_SHAPE'],
    ['receipt/tree mismatch', (event) => { event.receipt.contextFingerprint = 'f'.repeat(64); }, 'TRACKED_RECEIPT_TREE_FINGERPRINT_MISMATCH'],
    ['same-length receipt prefix rewrite', (event) => {
      event.receipt.supervisor.prefixSha256 = 'e'.repeat(64);
    }, 'TRACKED_RECEIPT_SOURCE_PREFIX_REWRITTEN'],
    ['decreasing receipt prefix length', (event) => {
      event.receipt.supervisor.byteLength = 9;
    }, 'TRACKED_RECEIPT_SOURCE_LENGTH_DECREASED'],
    ['arbitrary release head', (event) => { event.candidate.releaseHeadSha = 'f'.repeat(40); }, 'TERMINAL_RELEASE_HEAD_SHA_MISMATCH'],
    ['semantic push excess', (event) => { event.candidate.counters.semanticPushes = 2; }, 'BUDGET_LIMIT_EXCEEDED'],
    ['CI wait excess', (event) => {
      event.candidate.counters.ciWaitChains = 2;
      event.candidate.waitChains.ci = [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ];
    }, 'BUDGET_LIMIT_EXCEEDED'],
    ['missing implementer lineage', (event) => {
      event.candidate.counters.implementerLineages = 0;
      event.candidate.lineages.implementer = [];
    }, 'CANDIDATE_STATE_ROLE_MISMATCH'],
    ['missing audit evidence', (event) => {
      event.candidate.counters.coldAuditorLineages = 0;
      event.candidate.counters.auditWaitChains = 0;
      event.candidate.lineages.coldAuditor = [];
      event.candidate.waitChains.audit = [];
    }, 'CANDIDATE_STATE_AUDIT_MISMATCH'],
    ['missing full-check evidence', (event) => { event.candidate.counters.fullChecks = 0; }, 'CANDIDATE_STATE_FULL_CHECK_MISMATCH'],
    ['missing CI evidence', (event) => {
      event.candidate.state = 'ci-passed';
      event.candidate.counters.ciWaitChains = 0;
      event.candidate.waitChains.ci = [];
    }, 'CANDIDATE_STATE_CI_MISMATCH'],
    ['authority drift', (event) => { event.candidate.authority.push = false; }, 'TERMINAL_CANDIDATE_AUTHORITY_MISMATCH'],
  ])('rejects terminal authority %s', (_, mutate, code) => {
    const { root, base, path, authority } = terminalAuthorityFixture();
    const changed = mutateLatestTerminalAuthority(authority, mutate);
    writeTerminalAuthorityCandidate(root, path, changed);
    expect(verifyTerminalMetadata({ root, base, requireTerminal: true }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code }),
    ]));
  });

  it('accepts S-to-T terminal CI and rejects release/base or semantic path drift', () => {
    const valid = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    git(valid.root, ['add', '.']);
    git(valid.root, ['commit', '-qm', 'terminal T']);
    const terminalHead = git(valid.root, ['rev-parse', 'HEAD']);
    expect(verifyTerminalMetadata({
      root: valid.root,
      base: valid.base,
      head: terminalHead,
      requireTerminal: true,
    })).toMatchObject({ ok: true, lane: 'terminal', headSha: terminalHead, baseSha: valid.base });
    expect(verifyTerminalMetadata({
      root: valid.root,
      base: `${valid.base}^`,
      head: terminalHead,
      requireTerminal: true,
    }).ok).toBe(false);

    for (const [path, value] of [
      ['src/app.ts', 'export const value = 2;\n'],
      ['extra-terminal.txt', 'extra\n'],
    ]) {
      const drift = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
      write(drift.root, path, value);
      git(drift.root, ['add', '.']);
      git(drift.root, ['commit', '-qm', `terminal T with ${path}`]);
      expect(verifyTerminalMetadata({ root: drift.root, base: drift.base, requireTerminal: true }).errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'NON_TERMINAL_PATH', path })]),
      );
    }

    const wrongRelease = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    const changed = mutateLatestTerminalAuthority(wrongRelease.authority, (event) => {
      event.candidate.releaseHeadSha = 'f'.repeat(40);
    });
    writeTerminalAuthorityCandidate(wrongRelease.root, wrongRelease.path, changed);
    git(wrongRelease.root, ['add', '.']);
    git(wrongRelease.root, ['commit', '-qm', 'terminal T with wrong release head']);
    expect(verifyTerminalMetadata({ root: wrongRelease.root, base: wrongRelease.base, requireTerminal: true }).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'TERMINAL_RELEASE_HEAD_SHA_MISMATCH' })]),
    );
  });

  it('recovers an absent CI loop-state only from an exact verified shipped terminal authority', () => {
    const commitWithoutLoop = (fixture, message) => {
      rmSync(join(fixture.root, '.claude/loop-state.md'));
      git(fixture.root, ['add', '.']);
      git(fixture.root, ['commit', '-qm', message]);
      return git(fixture.root, ['rev-parse', 'HEAD']);
    };

    const shipped = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    const shippedHead = commitWithoutLoop(shipped, 'terminal T without local loop state');
    expect(verifyTerminalMetadata({
      root: shipped.root,
      base: shipped.base,
      head: shippedHead,
      requireTerminal: true,
    })).toMatchObject({ ok: true, lane: 'terminal' });

    const nonShipped = terminalAuthorityFixture();
    const nonShippedHead = commitWithoutLoop(nonShipped, 'non-shipped T without loop state');
    expect(verifyTerminalMetadata({
      root: nonShipped.root,
      base: nonShipped.base,
      head: nonShippedHead,
      requireTerminal: true,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TERMINAL_AUTHORITY_LOOP_MISMATCH' }),
    ]));

    const staleLedger = terminalAuthorityFixture({ shipped: true });
    write(
      staleLedger.root,
      'research/cr-grounding/cr-backbone-ledger.json',
      `${git(staleLedger.root, [
        'show',
        `${staleLedger.base}:research/cr-grounding/cr-backbone-ledger.json`,
      ])}\n`,
    );
    const staleLedgerHead = commitWithoutLoop(staleLedger, 'shipped authority with stale audited ledger');
    expect(verifyTerminalMetadata({
      root: staleLedger.root,
      base: staleLedger.base,
      head: staleLedgerHead,
      requireTerminal: true,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TERMINAL_AUTHORITY_LOOP_MISMATCH' }),
    ]));

    const mismatched = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    write(mismatched.root, '.claude/loop-state.md', 'milestone: WRONG\nstep: shipped\n');
    git(mismatched.root, ['add', '.']);
    git(mismatched.root, ['commit', '-qm', 'terminal T with mismatched loop state']);
    expect(verifyTerminalMetadata({
      root: mismatched.root,
      base: mismatched.base,
      requireTerminal: true,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TERMINAL_AUTHORITY_LOOP_MISMATCH' }),
    ]));

    const malformed = terminalAuthorityFixture({ baseStatus: 'implemented-not-audited', shipped: true });
    write(malformed.root, malformed.path, '{not-json\n');
    const malformedHead = commitWithoutLoop(malformed, 'terminal T with malformed authority');
    expect(verifyTerminalMetadata({
      root: malformed.root,
      base: malformed.base,
      head: malformedHead,
      requireTerminal: true,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_JSON' }),
    ]));
  }, 15_000);

  it('distinguishes an absent terminal predecessor from an oversized read failure', () => {
    const missing = terminalAuthorityFixture();
    git(missing.root, ['rm', '-q', '-f', missing.path]);
    git(missing.root, ['commit', '-qm', 'remove authority predecessor']);
    writeTerminalAuthorityCandidate(missing.root, missing.path, missing.authority);
    expect(verifyTerminalMetadata({
      root: missing.root,
      base: git(missing.root, ['rev-parse', 'HEAD']),
      requireTerminal: true,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_TERMINAL_AUTHORITY_PREDECESSOR' }),
    ]));

    const oversized = terminalAuthorityFixture();
    const huge = mutateLatestTerminalAuthority(oversized.authority, (event) => {
      event.candidate.stopReason = 'x'.repeat(17_000_000);
    });
    writeTerminalAuthorityCandidate(oversized.root, oversized.path, huge);
    git(oversized.root, ['add', oversized.path, '.claude/loop-state.md']);
    git(oversized.root, ['commit', '-qm', 'oversized authority predecessor']);
    writeTerminalAuthorityCandidate(oversized.root, oversized.path, oversized.authority);
    expect(verifyTerminalMetadata({
      root: oversized.root,
      base: git(oversized.root, ['rev-parse', 'HEAD']),
      requireTerminal: true,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TERMINAL_AUTHORITY_PREDECESSOR_READ_FAILED' }),
    ]));

    const malformed = terminalAuthorityFixture();
    write(malformed.root, malformed.path, '{not-json\n');
    git(malformed.root, ['add', malformed.path]);
    git(malformed.root, ['commit', '-qm', 'malformed authority predecessor']);
    writeTerminalAuthorityCandidate(malformed.root, malformed.path, malformed.authority);
    expect(verifyTerminalMetadata({
      root: malformed.root,
      base: git(malformed.root, ['rev-parse', 'HEAD']),
      requireTerminal: true,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_JSON', path: expect.stringContaining(malformed.path) }),
    ]));

    const corrupt = terminalAuthorityFixture();
    const blob = git(corrupt.root, ['rev-parse', `${corrupt.base}:${corrupt.path}`]);
    rmSync(join(corrupt.root, '.git', 'objects', blob.slice(0, 2), blob.slice(2)));
    expect(readRequiredBaseText(corrupt.root, corrupt.base, corrupt.path)).toMatchObject({
      status: 'error',
      text: null,
    });
  }, 15_000);

  it('classifies synchronized terminal fields and keeps fingerprints reproducible', () => {
    const { root, base } = repoFixture();
    const usage = {
      modelCycles: 1,
      cachedInputTokens: 2,
      uncachedInputTokens: 3,
      compactions: 0,
      repairWaves: 0,
      fullChecks: 1,
      ciRuns: 1,
      elapsedMs: 10,
    };
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledger('shipped', { usage }), null, 2)}\n`);
    write(root, '.claude/loop-state.md', 'milestone: complete\nstep: complete\n');

    const first = verifyTerminalMetadata({ root, base, requireTerminal: true });
    const second = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(first).toMatchObject({ ok: true, lane: 'terminal', errors: [] });
    expect(first.semanticFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first.terminalFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(second.semanticFingerprint).toBe(first.semanticFingerprint);
    expect(second.terminalFingerprint).toBe(first.terminalFingerprint);
  });

  it('classifies product and unsynchronized ledger changes as semantic and only fails on request', () => {
    const { root, base } = repoFixture();
    write(root, 'src/app.ts', 'export const value = 2;\n');
    const classified = verifyTerminalMetadata({ root, base });
    const required = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(classified).toMatchObject({ ok: true, lane: 'semantic', errors: [] });
    expect(classified.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NON_TERMINAL_PATH', path: 'src/app.ts' }),
    ]));
    expect(required.ok).toBe(false);
    expect(required.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NON_TERMINAL_PATH' }),
    ]));
  });

  it.each([
    ['top-level note', (value) => { value.note = 'changed'; }],
    ['nested policy evidence', (value) => { value.goalPolicy.evidence.push('changed'); }],
  ])('keeps %s semantic even when the key name is terminal-like', (_, mutate) => {
    const { root, base } = repoFixture();
    const value = ledger();
    mutate(value);
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(value, null, 2)}\n`);
    const report = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(report).toMatchObject({ ok: false, lane: 'semantic' });
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SEMANTIC_LEDGER_CHANGE' }),
    ]));
  });

  it.each([
    ['pending', 'shipped', 'INVALID_TERMINAL_STATUS_TRANSITION'],
    ['shipped', 'audited', 'SHIPPED_STATUS_REGRESSION'],
    ['audited', 'unknown', 'INVALID_TERMINAL_STATUS'],
  ])('rejects terminal status transition %s -> %s', (before, after, code) => {
    const { root, base } = repoFixture(before);
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledger(after), null, 2)}\n`);
    const report = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it('rejects a one-copy terminal promotion', () => {
    const { root, base } = repoFixture();
    const value = ledger();
    value.domains[0].status = 'shipped';
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(value, null, 2)}\n`);
    const report = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNSYNCHRONIZED_TERMINAL_METADATA' }),
    ]));
  });

  it('keeps semantic fingerprints stable across committing a tracked deletion', () => {
    const { root, base } = repoFixture();
    rmSync(join(root, 'src/tracked-deletion.ts'));
    const beforeCommit = computeCandidateFingerprints({ root });
    const classification = verifyTerminalMetadata({ root, base, requireTerminal: true });
    expect(classification).toMatchObject({ ok: false, lane: 'semantic' });
    expect(classification.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NON_TERMINAL_PATH', path: 'src/tracked-deletion.ts' }),
    ]));

    git(root, ['add', '-u', 'src/tracked-deletion.ts']);
    git(root, ['commit', '-qm', 'delete tracked fixture']);
    const afterCommit = computeCandidateFingerprints({ root });

    expect(beforeCommit.semanticFingerprint).toBe(afterCommit.semanticFingerprint);
    expect(beforeCommit.terminalFingerprint).toBe(afterCommit.terminalFingerprint);
  });

  it('hashes dangling symlinks by link target and remains stable across commit', () => {
    const { root } = repoFixture();
    const linkPath = join(root, 'src/dangling-link.ts');
    symlinkSync('missing-target-a.ts', linkPath);
    const first = computeCandidateFingerprints({ root });

    unlinkSync(linkPath);
    symlinkSync('missing-target-b.ts', linkPath);
    const changed = computeCandidateFingerprints({ root });
    expect(changed.semanticFingerprint).not.toBe(first.semanticFingerprint);

    git(root, ['add', 'src/dangling-link.ts']);
    git(root, ['commit', '-qm', 'track dangling symlink fixture']);
    const committed = computeCandidateFingerprints({ root });
    expect(committed.semanticFingerprint).toBe(changed.semanticFingerprint);
    expect(committed.terminalFingerprint).toBe(changed.terminalFingerprint);
  });
});

describe('release preflight regression detectors', () => {
  it('detects fixed next-ID Judge guards, incorrect CI diff base, and stale generated API', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-preflight-'));
    write(root, 'scripts/__tests__/review.program.test.mjs', [
      "const program = 'O4P-09';",
      "expect(activeProgram).toEqual({ nextDomainId: 'O4P-09D' });",
    ].join('\n'));
    write(root, '.github/workflows/deploy-pages.yml', 'run: npm run check:forbidden -- --diff HEAD^\n');
    write(root, 'scripts/checks/generate-engine-api.mjs', 'process.exitCode = 1;\n');

    expect(fixedNextGuardPaths(root, 'O4P-09')).toEqual([
      'scripts/__tests__/review.program.test.mjs',
    ]);
    expect(workflowHasCorrectDiffBase(root)).toBe(false);
    expect(checkGeneratedApi(root)).toBe(false);
  });

  it('detects common fixed-next assertion forms but ignores exact program arrays', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-guards-'));
    write(root, 'src/test/review.literal.test.ts', "const p='O4P-09'; expect(activeProgram.nextDomainId).toBe('O4P-09D');\n");
    write(root, 'src/test/review.array.test.ts', "const p='O4P-09'; expect(activeProgram.domainIds).toEqual(['O4P-09D']);\n");
    write(root, 'src/test/review.const.test.ts', "const p='O4P-09'; const expected = 'O4P-09D'; expect(activeProgram.nextDomainId).toEqual(expected);\n");
    write(root, 'src/test/review.helper.test.ts', "const p='O4P-09'; const expected = () => 'O4P-09D'; expect(activeProgram.nextDomainId).toBe(expected());\n");
    expect(fixedNextGuardPaths(root, 'O4P-09')).toEqual([
      'src/test/review.const.test.ts',
      'src/test/review.helper.test.ts',
      'src/test/review.literal.test.ts',
    ]);
  });

  it('reads secret-like text from an untracked candidate instead of an empty git diff', () => {
    const { root, base } = repoFixture();
    const secretFixture = ['authorization', ' = ', 'fixture-sensitive-value', '\n'].join('');
    write(root, 'untracked.txt', secretFixture);
    expect(addedText(root, base, 'untracked.txt', new Set(['untracked.txt']))).toBe(secretFixture);
    expect(buildReleasePreflight({ root, base, domain: 'M1', owner: 'judge' }).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SECRET_LIKE_CHANGED_TEXT', path: 'untracked.txt' }),
      ]),
    );
  });

  it('requires executable diff-base step order rather than matching comments', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-workflow-'));
    write(root, '.github/workflows/deploy-pages.yml', [
      'jobs:', '  build:', '    steps:',
      '      # - id: diff-base',
      '      #   run: node scripts/checks/resolve-diff-base.mjs --before fake --head fake',
      '      - uses: actions/checkout@v5', '        with:', '          fetch-depth: 0',
      '      - id: change-lane', '        run: npm run check:terminal-metadata -- --base "${{ steps.diff-base.outputs.base }}"',
      '      - run: npm run check:forbidden -- --diff "${{ steps.diff-base.outputs.base }}"',
    ].join('\n'));
    expect(workflowHasCorrectDiffBase(root)).toBe(false);
    expect(workflowHasCorrectDiffBase(process.cwd())).toBe(true);
  });

  it('does not accept correct-looking diff-base steps from a dead non-build job', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-dead-job-'));
    const correctSteps = [
      '      - uses: actions/checkout@v5', '        with:', '          fetch-depth: 0',
      '      - id: diff-base', '        run: node scripts/checks/resolve-diff-base.mjs --before before --head head',
      '      - id: change-lane', '        run: npm run check:terminal-metadata -- --base "${{ steps.diff-base.outputs.base }}"',
      '      - run: npm run check:forbidden -- --diff "${{ steps.diff-base.outputs.base }}"',
    ];
    write(root, '.github/workflows/deploy-pages.yml', [
      'jobs:', '  dead:', '    steps:', ...correctSteps,
      '  build:', '    steps:', '      - uses: actions/checkout@v5',
    ].join('\n'));
    expect(workflowHasCorrectDiffBase(root)).toBe(false);
  });

  it('keeps implementer ownership strict', () => {
    expect(ownerViolation('scripts/__tests__/review.guard.test.mjs', 'implementer')).toMatch(/Judge/);
    expect(ownerViolation('docs/contracts/example.md', 'implementer')).toMatch(/Judge/);
    expect(ownerViolation('scripts/checks/example.mjs', 'implementer')).toBeNull();
  });

  it('rejects unknown CLI arguments', () => {
    const script = join(process.cwd(), 'scripts/checks/terminal-metadata.mjs');
    const result = spawnSync(process.execPath, [script, '--base', 'HEAD', '--unknown'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('usage:');
  });
});
