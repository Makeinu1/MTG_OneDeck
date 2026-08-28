import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { applyProgramAction, runProgramStep } from '../codex-program-step.mjs';
import {
  buildContextProjection,
  computeTreeFingerprint,
  createContextProjection,
} from '../codex-context.mjs';
import { buildBudgetReport } from '../checks/budget.mjs';
import { buildGuardImpact } from '../checks/guard-impact.mjs';
import { buildReleasePreflight } from '../checks/release-preflight.mjs';
import { readSessionUsageReceipt } from '../codex-usage.mjs';
import {
  computeAcceptanceFingerprint,
  emptyCandidateCounters,
  evaluateCandidateBudget,
} from '../lib/supervisor-state.mjs';
import {
  createSupervisorBootstrap,
  createSupervisorEvent,
  deriveUsageReceipt,
  hashSupervisorEvent,
  readTrackedSupervisorAuthority,
  supervisorAuthorityPath,
  verifySupervisorAuthority,
  verifyUsageReceipt,
} from '../lib/supervisor-authority.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const headSha = 'a'.repeat(40);
const treeFingerprint = 'b'.repeat(64);

const limits = () => ({
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
});

const authority = (overrides = {}) => ({
  localWrites: true,
  commit: true,
  push: true,
  deploy: true,
  ship: true,
  ...overrides,
});

const domainEntry = () => ({
  id: 'M1',
  status: 'drafted',
  dependsOn: [],
  deliveryClass: 'player-outcome',
  playerOutcome: 'Production fixture outcome',
  journeyEvidence: ['production-browser:fixture'],
  outcomeDeadlineDomainId: 'M1',
  boundary: 'Frozen acceptance boundary',
  landingState: ['supervisor-enforced'],
  manualBoundary: 'No product scope',
  evidence: ['contract.md', 'acceptance.md'],
  authority: authority(),
  authoritySource: 'user-ruling:fixture',
});

const ledgerFixture = () => {
  const domain = domainEntry();
  return {
    object: 'fixture',
    selectionRule: 'fixture',
    statusDefinitions: {
      pending: 'pending',
      drafted: 'drafted',
      'implemented-not-audited': 'implemented-not-audited',
      audited: 'audited',
      shipped: 'shipped',
    },
    judgePolicy: { reference: 'fixture' },
    goalPolicy: {
      activeProgram: {
        id: 'PROGRAM',
        domainIds: ['M1'],
        authority: authority({ commit: false, push: false, deploy: false, ship: false }),
        autonomy: { mode: 'complete' },
        journeyPolicy: {
          maxConsecutiveSubstrate: 2,
          enforceFromDomainId: 'M1',
          legacyDebtDomainIds: [],
        },
        usagePolicy: { enforceFromDomainId: 'M1' },
      },
      supervisionPolicy: {
        version: 1,
        enforceFromDomainId: 'M1',
        limits: limits(),
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
    },
    domains: [domain],
    plannedSequence: [{ ...structuredClone(domain), domainId: 'M1', type: 'checkpoint' }],
  };
};

const candidateFixture = (overrides = {}) => {
  const domain = domainEntry();
  return {
    version: 1,
    id: 'M1-candidate-1',
    domainId: 'M1',
    state: 'contract-frozen',
    baseSha: headSha,
    treeFingerprint,
    acceptanceFingerprint: computeAcceptanceFingerprint(domain),
    authority: authority(),
    authoritySource: 'user-ruling:fixture',
    counters: emptyCandidateCounters(),
    lineages: { implementer: [], coldAuditor: [] },
    waitChains: { audit: [], ci: [] },
    guardImpact: { reportFingerprint: null, acknowledgement: null },
    ...overrides,
  };
};

const loopText = (records, step = records.at(-1)?.state ?? 'contract-frozen', base = headSha, tree = treeFingerprint, milestone = records.at(-1)?.domainId ?? 'M1') => [
  `milestone: ${milestone}`,
  `step: ${step}`,
  `baseSha: ${base}`,
  `treeFingerprint: ${tree}`,
  `activeCandidates: ${JSON.stringify(records)}`,
].join('\n');

const project = (records, overrides = {}) => {
  const ledger = overrides.ledger ?? ledgerFixture();
  const domainId = overrides.domainId ?? 'M1';
  return buildContextProjection({
    ledger,
    headLedger: structuredClone(ledger),
    headSha,
    sourceSha256: 'c'.repeat(64),
    domainId,
    loopStateText: loopText(records, overrides.step, overrides.base, overrides.tree, overrides.milestone),
    treeFingerprint,
    baseIsAncestor: overrides.baseIsAncestor,
    semanticWorkingTreeClean: overrides.semanticWorkingTreeClean,
    trackedSupervisorVerification: overrides.trackedSupervisorVerification ?? {
      ok: true,
      errors: [],
      latestEvent: { sequence: 0, eventHash: 'd'.repeat(64) },
    },
  });
};

describe('GOV-CODEX-58A supervisor state', () => {
  it('exposes the three canonical package commands', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(packageJson.scripts).toMatchObject({
      'codex:program-step': 'node scripts/codex-program-step.mjs',
      'check:budget': 'node scripts/checks/budget.mjs',
      'check:guard-impact': 'node scripts/checks/guard-impact.mjs',
    });
  });

  it('projects one synchronized active candidate, exact authority source, counters, roles, waits, and permissions', () => {
    const projection = project([candidateFixture()]);
    expect(projection.health).toEqual({ ok: true, errors: [] });
    expect(projection.activeCandidate).toMatchObject({
      id: 'M1-candidate-1',
      domainId: 'M1',
      state: 'contract-frozen',
      authoritySource: 'user-ruling:fixture',
      counters: emptyCandidateCounters(),
      lineages: { implementer: [], coldAuditor: [] },
      waitChains: { audit: [], ci: [] },
    });
    expect(projection.permissionRequired).toEqual({
      commit: false,
      deploy: false,
      localWrites: false,
      push: false,
      ship: false,
    });
  });

  it.each([
    ['domain', { domainId: 'other' }, 'CANDIDATE_DOMAIN_MISMATCH'],
    ['base', { baseSha: 'd'.repeat(40) }, 'CANDIDATE_BASE_SHA_MISMATCH'],
    ['tree', { treeFingerprint: 'e'.repeat(64) }, 'CANDIDATE_TREE_FINGERPRINT_MISMATCH'],
    ['authority', { authority: authority({ push: false }) }, 'CANDIDATE_AUTHORITY_MISMATCH'],
  ])('fails closed on %s disagreement', (_, override, code) => {
    expect(project([candidateFixture(override)]).health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it('allows only the one unbound push-ready post-commit head and then pins it exactly', () => {
    const committedHead = 'f'.repeat(40);
    const pending = candidateFixture({
      state: 'push-ready',
      baseSha: committedHead,
      counters: {
        ...emptyCandidateCounters(),
        implementerLineages: 1,
        coldAuditorLineages: 1,
        auditWaitChains: 1,
        fullChecks: 1,
      },
      lineages: {
        implementer: [{ id: 'impl-1', compactions: 0, freshContinuations: 0 }],
        coldAuditor: [{ id: 'audit-1', compactions: 0, freshContinuations: 0 }],
      },
      waitChains: { audit: ['audit-1'], ci: [] },
    });
    expect(project([pending], { base: committedHead, baseIsAncestor: true }).health.ok).toBe(true);
    expect(project([pending], { base: committedHead, baseIsAncestor: false }).health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CANDIDATE_BASE_NOT_ANCESTOR' })]),
    );
    expect(project([pending], {
      base: committedHead,
      baseIsAncestor: true,
      semanticWorkingTreeClean: false,
    }).health.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'POST_COMMIT_SEMANTIC_WORKTREE_DRIFT' }),
    ]));
    const pinned = { ...structuredClone(pending), baseSha: headSha, releaseHeadSha: committedHead };
    expect(project([pinned]).health.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CANDIDATE_RELEASE_HEAD_SHA_MISMATCH' }),
    ]));
  });

  it('fails explicit-domain context when multiple active candidates or ledger implementations exist', () => {
    const second = candidateFixture({ id: 'M1-candidate-2' });
    expect(project([candidateFixture(), second]).health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MULTIPLE_ACTIVE_CANDIDATES' })]),
    );
    const ledger = ledgerFixture();
    const extra = { ...structuredClone(ledger.domains[0]), id: 'M2', status: 'implemented-not-audited' };
    ledger.domains[0].status = 'implemented-not-audited';
    ledger.plannedSequence[0].status = 'implemented-not-audited';
    ledger.domains.push(extra);
    ledger.plannedSequence.push({ ...extra, domainId: 'M2' });
    expect(project([candidateFixture()], { ledger }).health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MULTIPLE_UNSHIPPED_IMPLEMENTATION_CANDIDATES' })]),
    );
  });

  it('rejects a state label that skips required role, audit, full-check, or CI evidence', () => {
    for (const [state, code] of [
      ['implementing', 'CANDIDATE_STATE_ROLE_MISMATCH'],
      ['audited', 'CANDIDATE_STATE_AUDIT_MISMATCH'],
      ['full-check-passed', 'CANDIDATE_STATE_FULL_CHECK_MISMATCH'],
      ['ci-passed', 'CANDIDATE_STATE_CI_MISMATCH'],
    ]) {
      expect(project([candidateFixture({ state })], { step: state }).health.errors, state).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    }
  });

  it.each([
    ['localWrites', 'local-write', 'contract-frozen'],
    ['commit', 'commit', 'full-check-passed'],
    ['push', 'push', 'push-ready'],
    ['deploy', 'deploy', 'ci-passed'],
    ['ship', 'ship', 'ci-passed'],
  ])('does not let complete autonomy override false %s authority', (permission, action, state) => {
    const candidate = candidateFixture({ state, authority: authority({ [permission]: false }) });
    expect(() => applyProgramAction({
      records: [candidate],
      action,
      options: { lineage: 'implementer-1' },
      policy: { limits: limits() },
    })).toThrow(/authority is required/);
  });

  it('makes audit-failed-stop terminal and permits only release-derived repair with inherited scope and counters', () => {
    const stopped = candidateFixture({
      state: 'audit-failed-stop',
      stopReason: 'two correction waves exhausted',
      usageSnapshot: emptyCandidateCounters(),
    });
    expect(() => applyProgramAction({ records: [stopped], action: 'start-correction', policy: { limits: limits() } }))
      .toThrow(/AUDIT_FAILED_STOP_TERMINAL/);
    expect(() => applyProgramAction({
      records: [stopped],
      action: 'user-reopen',
      options: { reason: 'not-a-user-ruling' },
      policy: { limits: limits() },
    })).toThrow(/MISSING_EXACT_USER_REOPEN_REASON/);
    expect(applyProgramAction({
      records: [stopped],
      action: 'user-reopen',
      options: { reason: 'user-ruling:final-repair' },
      policy: { limits: limits() },
    }).activeCandidate.state).toBe('audit-repairable');
    expect(() => applyProgramAction({
      records: [stopped],
      action: 'repair-resume',
      options: { reason: 'quota:more' },
      policy: { limits: limits() },
    })).toThrow(/MISSING_SAME_SCOPE_REPAIR_REASON/);
    expect(applyProgramAction({
      records: [stopped],
      action: 'repair-resume',
      options: { reason: 'same-scope:new-root-cause' },
      policy: { limits: limits() },
    }).activeCandidate).toMatchObject({
      id: stopped.id,
      state: 'audit-repairable',
      acceptanceFingerprint: stopped.acceptanceFingerprint,
      authority: stopped.authority,
      counters: stopped.counters,
    });

    const audited = candidateFixture({
      state: 'audited',
      counters: {
        ...emptyCandidateCounters(),
        implementerLineages: 1,
        coldAuditorLineages: 1,
        auditWaitChains: 1,
      },
      lineages: {
        implementer: [{ id: 'impl-1', compactions: 0, freshContinuations: 0 }],
        coldAuditor: [{ id: 'audit-1', compactions: 0, freshContinuations: 0 }],
      },
      waitChains: { audit: ['wait-1'], ci: [] },
    });
    const required = applyProgramAction({
      records: [audited],
      action: 'require-repair',
      options: { reason: 'guard-impact' },
      policy: { limits: limits() },
    });
    const derived = applyProgramAction({
      records: required.records,
      action: 'derive-repair',
      options: { candidate: 'M1-candidate-2', baseSha: headSha },
      policy: { limits: limits() },
    });
    expect(derived.activeCandidate).toMatchObject({
      id: 'M1-candidate-2',
      repairOf: 'M1-candidate-1',
      acceptanceFingerprint: audited.acceptanceFingerprint,
      authority: audited.authority,
      counters: audited.counters,
    });
    expect(project(derived.records, { step: 'implementing' }).health).toEqual({ ok: true, errors: [] });
    expect(() => applyProgramAction({
      records: [candidateFixture({ state: 'audited' })],
      action: 'require-repair',
      options: { reason: 'ordinary-audit-failure' },
      policy: { limits: limits() },
    })).toThrow(/INVALID_RELEASE_REPAIR_REASON/);
  });

  it('accepts exact counters, advises full-check excess, and rejects missing, negative, and decreasing counters', () => {
    expect(evaluateCandidateBudget(candidateFixture(), { limits: limits() }).ok).toBe(true);
    const missing = candidateFixture();
    delete missing.counters.teamUncachedInputTokens;
    expect(evaluateCandidateBudget(missing, { limits: limits() }).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_CANDIDATE_COUNTERS' })]),
    );
    const negative = candidateFixture();
    negative.counters.fullChecks = -1;
    expect(evaluateCandidateBudget(negative, { limits: limits() }).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_COUNTER_VALUE' })]),
    );
    const exceeded = candidateFixture();
    exceeded.counters.fullChecks = 3;
    expect(evaluateCandidateBudget(exceeded, { limits: limits() })).toMatchObject({
      ok: true,
      errors: [],
      advisories: expect.arrayContaining([
        expect.objectContaining({ code: 'WATCHDOG_THRESHOLD_EXCEEDED', counter: 'fullChecks', value: 3, limit: 2 }),
      ]),
    });
    const previous = candidateFixture({ state: 'repair-required' });
    previous.counters.teamUncachedInputTokens = 10;
    const reset = candidateFixture({ id: 'M1-candidate-2', repairOf: previous.id });
    expect(project([previous, reset]).health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CUMULATIVE_COUNTER_DECREASE' })]),
    );
  });

  it('rejects old, cached, total, and otherwise mislabeled input-token counter keys', () => {
    const oldPolicy = ledgerFixture();
    oldPolicy.goalPolicy.supervisionPolicy.limits.supervisorInputTokens =
      oldPolicy.goalPolicy.supervisionPolicy.limits.supervisorUncachedInputTokens;
    delete oldPolicy.goalPolicy.supervisionPolicy.limits.supervisorUncachedInputTokens;
    expect(project([candidateFixture()], { ledger: oldPolicy }).health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SUPERVISION_POLICY' })]),
    );

    for (const mislabeledKey of [
      'supervisorInputTokens',
      'teamInputTokens',
      'supervisorCachedInputTokens',
      'teamTotalInputTokens',
    ]) {
      const candidate = candidateFixture();
      candidate.counters[mislabeledKey] = 0;
      expect(evaluateCandidateBudget(candidate, { limits: limits() }).errors, mislabeledKey).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_CANDIDATE_COUNTERS' })]),
      );
    }
  });

  it('applies only the exact GOV-58A override and keeps later/default ceilings unchanged', () => {
    const ordinary = project([candidateFixture()]);
    expect(ordinary.supervisionPolicy.limits).toMatchObject({
      freshContinuationsPerLineage: 1,
      supervisorModelCycles: 160,
      teamUncachedInputTokens: 1_600_000,
    });

    const ledger = ledgerFixture();
    for (const entry of ledger.domains) entry.id = 'GOV-CODEX-58A-2026-08';
    for (const entry of ledger.plannedSequence) {
      entry.id = 'GOV-CODEX-58A-2026-08';
      entry.domainId = 'GOV-CODEX-58A-2026-08';
    }
    ledger.goalPolicy.activeProgram.domainIds = ['GOV-CODEX-58A-2026-08'];
    ledger.goalPolicy.activeProgram.journeyPolicy.enforceFromDomainId = 'GOV-CODEX-58A-2026-08';
    ledger.goalPolicy.activeProgram.usagePolicy.enforceFromDomainId = 'GOV-CODEX-58A-2026-08';
    ledger.goalPolicy.supervisionPolicy.enforceFromDomainId = 'GOV-CODEX-58A-2026-08';
    ledger.domains[0].outcomeDeadlineDomainId = 'GOV-CODEX-58A-2026-08';
    ledger.plannedSequence[0].outcomeDeadlineDomainId = 'GOV-CODEX-58A-2026-08';
    const candidate = candidateFixture({ domainId: 'GOV-CODEX-58A-2026-08' });
    const governed = project([candidate], { ledger, domainId: candidate.domainId });
    expect(governed.health.ok, JSON.stringify(governed.health.errors)).toBe(true);
    expect(governed.supervisionPolicy.limits).toMatchObject({
      correctionWaves: 3,
      freshContinuationsPerLineage: 3,
      supervisorModelCycles: 360,
      supervisorUncachedInputTokens: 2_100_000,
      teamModelCycles: 620,
      teamUncachedInputTokens: 3_400_000,
    });
    const implementing = candidateFixture({
      domainId: candidate.domainId,
      state: 'implementing',
      counters: { ...emptyCandidateCounters(), implementerLineages: 1 },
      lineages: {
        implementer: [{ id: 'impl-1', compactions: 0, freshContinuations: 0 }],
        coldAuditor: [],
      },
    });
    let continued = { records: [implementing] };
    for (let count = 0; count < 3; count += 1) {
      continued = applyProgramAction({
        records: continued.records,
        action: 'continue-implementer',
        options: { lineage: 'impl-1' },
        policy: governed.supervisionPolicy,
      });
    }
    expect(continued.activeCandidate.lineages.implementer[0].freshContinuations).toBe(3);
    const fourthContinuation = applyProgramAction({
      records: continued.records,
      action: 'continue-implementer',
      options: { lineage: 'impl-1' },
      policy: governed.supervisionPolicy,
    });
    expect(fourthContinuation.advisories).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'WATCHDOG_THRESHOLD_EXCEEDED', watchdog: 'freshContinuationsPerLineage' }),
    ]));

    let corrected = { records: [{ ...structuredClone(implementing), state: 'audit-repairable' }] };
    for (let count = 0; count < 3; count += 1) {
      corrected = applyProgramAction({
        records: corrected.records,
        action: 'start-correction',
        options: { lineage: 'impl-1' },
        policy: governed.supervisionPolicy,
      });
      corrected.activeCandidate.state = 'audit-repairable';
    }
    expect(corrected.activeCandidate.counters.correctionWaves).toBe(3);
    const fourthCorrection = applyProgramAction({
      records: corrected.records,
      action: 'start-correction',
      options: { lineage: 'impl-1' },
      policy: governed.supervisionPolicy,
    });
    expect(fourthCorrection.advisories).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'WATCHDOG_THRESHOLD_EXCEEDED', counter: 'correctionWaves' }),
    ]));

    for (const mutate of [
      (policy) => { policy.candidateOverrides.UNKNOWN = {}; },
      (policy) => { policy.candidateOverrides['GOV-CODEX-58A-2026-08'].fullChecks = 3; },
      (policy) => { policy.candidateOverrides['GOV-CODEX-58A-2026-08'].teamUncachedInputTokens = 2_000_001; },
    ]) {
      const invalid = ledgerFixture();
      mutate(invalid.goalPolicy.supervisionPolicy);
      expect(project([candidateFixture()], { ledger: invalid }).health.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SUPERVISION_POLICY' })]),
      );
    }
  });

  it('never lets an explicit pre-enforcement domain hide the global supervised candidate', () => {
    const ledger = ledgerFixture();
    const old = { ...structuredClone(ledger.domains[0]), id: 'OLD', status: 'shipped' };
    ledger.domains.unshift(old);
    ledger.plannedSequence.unshift({ ...structuredClone(old), domainId: 'OLD' });
    ledger.goalPolicy.activeProgram.domainIds = ['OLD', 'M1'];
    const projection = project([candidateFixture()], { ledger, domainId: 'OLD', milestone: 'M1' });
    expect(projection.health.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'ACTIVE_SUPERVISED_CANDIDATE_DOMAIN_MISMATCH',
        requestedDomainId: 'OLD',
        activeDomainId: 'M1',
      }),
    ]));
  });

  it('accepts only cumulative uncached-token usage updates and never relabels old totals', () => {
    const candidate = candidateFixture();
    expect(() => applyProgramAction({
      records: [candidate],
      action: 'local-write',
      options: { usage: { supervisorInputTokens: 100 } },
      policy: { limits: limits() },
    })).toThrow(/INVALID_USAGE_UPDATE/);

    const updated = applyProgramAction({
      records: [candidate],
      action: 'local-write',
      options: {
        lineage: 'implementer-1',
        usage: {
          supervisorUncachedInputTokens: 100,
          teamUncachedInputTokens: 200,
        },
      },
      policy: { limits: limits() },
    });
    expect(updated.activeCandidate.counters).toMatchObject({
      supervisorUncachedInputTokens: 100,
      teamUncachedInputTokens: 200,
    });
    expect(() => applyProgramAction({
      records: [{ ...updated.activeCandidate, state: 'audit-repairable' }],
      action: 'start-correction',
      options: {
        lineage: 'implementer-1',
        usage: { supervisorUncachedInputTokens: 99 },
      },
      policy: { limits: limits() },
    })).toThrow(/INVALID_USAGE_UPDATE/);
  });

  it('keeps structural limits hard while compaction, continuation, and correction crossings are advisory', () => {
    const implementing = candidateFixture({
      state: 'implementing',
      counters: { ...emptyCandidateCounters(), implementerLineages: 1 },
      lineages: { implementer: [{ id: 'impl-1', compactions: 0, freshContinuations: 0 }], coldAuditor: [] },
    });
    let current = applyProgramAction({ records: [implementing], action: 'compact-implementer', options: { lineage: 'impl-1' }, policy: { limits: limits() } });
    current = applyProgramAction({ records: current.records, action: 'compact-implementer', options: { lineage: 'impl-1' }, policy: { limits: limits() } });
    current = applyProgramAction({ records: current.records, action: 'compact-implementer', options: { lineage: 'impl-1' }, policy: { limits: limits() } });
    expect(current.advisories).toEqual(expect.arrayContaining([
      expect.objectContaining({ watchdog: 'compactionsPerLineage' }),
    ]));
    current = applyProgramAction({ records: [implementing], action: 'continue-implementer', options: { lineage: 'impl-1' }, policy: { limits: limits() } });
    current = applyProgramAction({ records: current.records, action: 'continue-implementer', options: { lineage: 'impl-1' }, policy: { limits: limits() } });
    expect(current.advisories).toEqual(expect.arrayContaining([
      expect.objectContaining({ watchdog: 'freshContinuationsPerLineage' }),
    ]));

    const auditReady = candidateFixture({ state: 'audit-ready' });
    current = applyProgramAction({ records: [auditReady], action: 'start-audit', options: { lineage: 'audit-1' }, policy: { limits: limits() } });
    expect(() => applyProgramAction({ records: current.records, action: 'start-audit', options: { lineage: 'audit-2' }, policy: { limits: limits() } }))
      .toThrow(/coldAuditorLineages/);
    current = applyProgramAction({ records: [auditReady], action: 'start-audit-wait', options: { waitChain: 'wait-1' }, policy: { limits: limits() } });
    expect(() => applyProgramAction({ records: current.records, action: 'start-audit-wait', options: { waitChain: 'wait-2' }, policy: { limits: limits() } }))
      .toThrow(/auditWaitChains/);

    let correction = { ...structuredClone(implementing), state: 'audit-repairable' };
    for (let count = 0; count < 2; count += 1) {
      const result = applyProgramAction({ records: [correction], action: 'start-correction', options: { lineage: 'impl-1' }, policy: { limits: limits() } });
      correction = { ...result.activeCandidate, state: 'audit-repairable' };
    }
    const thirdCorrection = applyProgramAction({ records: [correction], action: 'start-correction', options: { lineage: 'impl-1' }, policy: { limits: limits() } });
    expect(thirdCorrection.advisories).toEqual(expect.arrayContaining([
      expect.objectContaining({ counter: 'correctionWaves' }),
    ]));

    const overUsage = candidateFixture();
    overUsage.counters.supervisorModelCycles = limits().supervisorModelCycles + 1;
    overUsage.counters.supervisorUncachedInputTokens = limits().supervisorUncachedInputTokens + 1;
    expect(evaluateCandidateBudget(overUsage, { limits: limits() })).toMatchObject({
      ok: true,
      errors: [],
      advisories: expect.arrayContaining([
        expect.objectContaining({ counter: 'supervisorModelCycles' }),
        expect.objectContaining({ counter: 'supervisorUncachedInputTokens' }),
      ]),
    });

    let checked = candidateFixture({ state: 'audited' });
    for (let count = 0; count < 2; count += 1) checked = applyProgramAction({ records: [checked], action: 'full-check', policy: { limits: limits() } }).activeCandidate;
    const thirdCheck = applyProgramAction({ records: [checked], action: 'full-check', policy: { limits: limits() } });
    expect(thirdCheck.activeCandidate.counters.fullChecks).toBe(3);
    expect(thirdCheck.advisories).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'WATCHDOG_THRESHOLD_EXCEEDED', counter: 'fullChecks', value: 3, limit: 2 }),
    ]));
    expect(applyProgramAction({ records: thirdCheck.records, action: 'mark-full-check-passed', policy: { limits: limits() } }).activeCandidate.state)
      .toBe('full-check-passed');
    expect(() => applyProgramAction({ records: [candidateFixture({ state: 'audited' })], action: 'mark-full-check-passed', policy: { limits: limits() } }))
      .toThrow(/FULL_CHECK_NOT_STARTED/);
    expect(() => applyProgramAction({
      records: [candidateFixture({ state: 'implementing', counters: { ...emptyCandidateCounters(), fullChecks: 1 } })],
      action: 'mark-full-check-passed',
      policy: { limits: limits() },
    })).toThrow(/cannot perform this action/);

    const pushReady = candidateFixture({ state: 'push-ready' });
    const releaseHeadSha = 'f'.repeat(40);
    const pushed = applyProgramAction({ records: [pushReady], action: 'record-semantic-push', options: { releaseHeadSha }, policy: { limits: limits() } });
    expect(() => applyProgramAction({ records: pushed.records, action: 'record-semantic-push', options: { releaseHeadSha }, policy: { limits: limits() } }))
      .toThrow(/semanticPushes/);
    const replacementReady = candidateFixture({ state: 'push-ready', repairOf: 'M1-candidate-0' });
    const replacement = applyProgramAction({ records: [replacementReady], action: 'record-replacement-push', options: { releaseHeadSha }, policy: { limits: limits() } });
    const secondReplacement = applyProgramAction({
      records: replacement.records,
      action: 'record-replacement-push',
      options: { releaseHeadSha },
      policy: { limits: limits() },
    });
    expect(secondReplacement.activeCandidate.counters.replacementPushes).toBe(2);
    expect(secondReplacement.advisories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'WATCHDOG_THRESHOLD_EXCEEDED',
        counter: 'replacementPushes',
        value: 2,
        limit: 1,
      }),
    ]));
  });
});

function write(root, path, value) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function guardRepoFixture({ full = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'onedeck-supervisor-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'fixture@example.com']);
  git(root, ['config', 'user.name', 'Fixture']);
  const oldBytes = 'export const value = 1;\n';
  const predecessor = sha256(oldBytes);
  write(root, 'src/value.mjs', oldBytes);
  write(root, 'scripts/guard.mjs', [
    "import '../src/value.mjs';",
    "export const allowedPaths = ['src/value.mjs'];",
    `export const frozenPredecessor = '${predecessor}';`,
  ].join('\n'));
  if (full) {
    write(root, '.gitignore', '.claude/\n');
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledgerFixture(), null, 2)}\n`);
    write(root, 'scripts/checks/generate-engine-api.mjs', 'process.exitCode = 0;\n');
    write(root, 'docs/generated/engine-api.md', '# fixture\n');
    write(root, '.github/workflows/deploy-pages.yml', [
      'jobs:',
      '  build:',
      '    steps:',
      '      - uses: actions/checkout@v5',
      '        with:',
      '          fetch-depth: 0',
      '      - id: diff-base',
      '        run: node scripts/checks/resolve-diff-base.mjs --before before --head head',
      '      - id: change-lane',
      '        run: npm run check:terminal-metadata -- --base "${{ steps.diff-base.outputs.base }}"',
      '      - run: npm run check:forbidden -- --diff "${{ steps.diff-base.outputs.base }}"',
    ].join('\n'));
  }
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'fixture base']);
  const base = git(root, ['rev-parse', 'HEAD']);
  write(root, 'src/value.mjs', 'export const value = 2;\n');
  return { root, base };
}

function pushReadyCandidate(baseSha, candidateTreeFingerprint) {
  return candidateFixture({
    state: 'push-ready',
    baseSha,
    treeFingerprint: candidateTreeFingerprint,
    counters: {
      ...emptyCandidateCounters(),
      implementerLineages: 1,
      coldAuditorLineages: 1,
      auditWaitChains: 1,
      fullChecks: 1,
    },
    lineages: {
      implementer: [{ id: SESSION_IDS.implementer, compactions: 0, freshContinuations: 0 }],
      coldAuditor: [{ id: SESSION_IDS.auditor, compactions: 0, freshContinuations: 0 }],
    },
    waitChains: { audit: [SESSION_IDS.auditor], ci: [] },
  });
}

const SESSION_IDS = {
  supervisor: '11111111-1111-4111-8111-111111111111',
  implementer: '22222222-2222-4222-8222-222222222222',
  auditor: '33333333-3333-4333-8333-333333333333',
  explorer: '44444444-4444-4444-8444-444444444444',
};

function writeUsageSession(sessionsRoot, sessionId, source, inputTokens, cachedInputTokens) {
  const records = [
    { type: 'session_meta', payload: { id: sessionId, source } },
    {
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          last_token_usage: {
            input_tokens: inputTokens,
            cached_input_tokens: cachedInputTokens,
            output_tokens: 1,
            reasoning_output_tokens: 0,
          },
        },
      },
    },
  ];
  write(sessionsRoot, `${sessionId}.jsonl`, `${records.map(JSON.stringify).join('\n')}\n`);
}

function appendUsageCycle(sessionsRoot, sessionId, inputTokens, cachedInputTokens) {
  appendFileSync(join(sessionsRoot, `${sessionId}.jsonl`), `${JSON.stringify({
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: {
          input_tokens: inputTokens,
          cached_input_tokens: cachedInputTokens,
          output_tokens: 1,
          reasoning_output_tokens: 0,
        },
      },
    },
  })}\n`);
}

function usageAuthorityFixture(root, candidate, { writeAuthority = true } = {}) {
  const sessionsRoot = mkdtempSync(join(tmpdir(), 'onedeck-sessions-'));
  writeUsageSession(sessionsRoot, SESSION_IDS.supervisor, 'desktop', 100, 40);
  for (const [id, input, cached] of [
    [SESSION_IDS.implementer, 80, 50],
    [SESSION_IDS.auditor, 70, 50],
    [SESSION_IDS.explorer, 60, 50],
  ]) {
    writeUsageSession(sessionsRoot, id, {
      subagent: { thread_spawn: { parent_thread_id: SESSION_IDS.supervisor } },
    }, input, cached);
  }
  const source = (sessionId, role) => {
    const resolved = readSessionUsageReceipt(sessionId, sessionsRoot);
    return {
      sessionId,
      role,
      byteLength: resolved.byteLength,
      prefixSha256: resolved.prefixSha256,
    };
  };
  const receipt = {
    version: 1,
    contextFingerprint: candidate.treeFingerprint,
    baseline: { modelCycles: 0, uncachedInputTokens: 0 },
    supervisor: source(SESSION_IDS.supervisor, 'supervisor'),
    participants: [
      source(SESSION_IDS.implementer, 'implementer'),
      source(SESSION_IDS.auditor, 'cold-auditor'),
      source(SESSION_IDS.explorer, 'team'),
    ],
    observed: {
      supervisorModelCycles: 1,
      supervisorUncachedInputTokens: 60,
      teamModelCycles: 4,
      teamUncachedInputTokens: 120,
      cachedInputTokens: 190,
      totalInputTokens: 310,
    },
  };
  candidate.counters = {
    ...candidate.counters,
    supervisorModelCycles: 1,
    supervisorUncachedInputTokens: 60,
    teamModelCycles: 4,
    teamUncachedInputTokens: 120,
  };
  const receiptPath = join(sessionsRoot, 'usage-receipt.json');
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const receiptPlan = {
    version: 1,
    baseline: structuredClone(receipt.baseline),
    supervisor: { sessionId: SESSION_IDS.supervisor, role: 'supervisor' },
    participants: receipt.participants.map(({ sessionId, role }) => ({ sessionId, role })),
  };
  const receiptPlanPath = join(sessionsRoot, 'usage-receipt-plan.json');
  writeFileSync(receiptPlanPath, `${JSON.stringify(receiptPlan, null, 2)}\n`);
  const authority = createSupervisorBootstrap({
    candidate,
    receipt,
    actorSessionId: SESSION_IDS.supervisor,
    actorRole: 'supervisor',
  });
  if (writeAuthority) {
    write(root, supervisorAuthorityPath(candidate.domainId), `${JSON.stringify(authority, null, 2)}\n`);
  }
  return { sessionsRoot, receiptPath, receipt, receiptPlan, receiptPlanPath };
}

function rehashSupervisorAuthority(authority) {
  let previousHash = null;
  for (const event of authority.events) {
    event.previousHash = previousHash;
    event.eventHash = hashSupervisorEvent(event);
    previousHash = event.eventHash;
  }
  authority.candidateId = authority.events.at(-1).candidate.id;
}

function cleanCheckoutAuthorityFixture() {
  const { root } = guardRepoFixture({ full: true });
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'semantic candidate']);
  const base = git(root, ['rev-parse', 'HEAD']);
  const tree = computeTreeFingerprint(root);
  const candidate = pushReadyCandidate(base, tree);
  const usage = usageAuthorityFixture(root, candidate);
  const path = supervisorAuthorityPath('M1');
  const authority = JSON.parse(readFileSync(join(root, path), 'utf8'));
  authority.events.push(createSupervisorEvent({
    sequence: 1,
    action: 'acknowledge-guard-impact',
    actorSessionId: SESSION_IDS.supervisor,
    actorRole: 'supervisor',
    candidate,
    receipt: usage.receipt,
    previousHash: authority.events[0].eventHash,
  }));
  write(root, path, `${JSON.stringify(authority, null, 2)}\n`);
  git(root, ['add', path]);
  git(root, ['commit', '-qm', 'tracked authority']);
  return { root, candidate, path };
}

function makeAuditStopCandidate(candidate) {
  candidate.state = 'audit-failed-stop';
  candidate.stopReason = 'prior cold-audit stop';
  candidate.usageSnapshot = structuredClone(candidate.counters);
}

describe('GOV-CODEX-58A tracked authority and verified receipts', () => {
  it('recovers a clean checkout without loop-state from verified tracked authority and rejects a corrupt clean authority', () => {
    const { root, candidate, path } = cleanCheckoutAuthorityFixture();

    const recovered = createContextProjection(root, 'M1');
    expect(recovered.health.ok, JSON.stringify(recovered.health.errors)).toBe(true);
    expect(recovered.activeCandidate).toMatchObject({
      id: candidate.id,
      domainId: candidate.domainId,
      state: candidate.state,
      baseSha: candidate.baseSha,
      treeFingerprint: candidate.treeFingerprint,
    });
    expect(recovered.trackedSupervisor).toMatchObject({ ok: true, latestSequence: 1 });

    const authority = JSON.parse(readFileSync(join(root, path), 'utf8'));
    authority.events[0].eventHash = '0'.repeat(64);
    write(root, path, `${JSON.stringify(authority, null, 2)}\n`);
    git(root, ['add', path]);
    git(root, ['commit', '-qm', 'corrupt tracked authority']);
    const corrupt = createContextProjection(root, 'M1');
    expect(corrupt.health.ok).toBe(false);
    expect(corrupt.health.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_TRACKED_SUPERVISOR_EVENT' }),
    ]));
  });

  it.each([
    ['missing historical STOP usageSnapshot', (candidate) => {
      makeAuditStopCandidate(candidate);
      delete candidate.usageSnapshot;
    }, 'INCOMPLETE_AUDIT_FAILED_STOP'],
    ['incomplete historical STOP usage evidence', (candidate) => {
      makeAuditStopCandidate(candidate);
      delete candidate.usageSnapshot.fullChecks;
    }, 'AUDIT_STOP_USAGE_MISMATCH'],
    ['invalid historical push-ready state evidence', (candidate) => {
      candidate.counters.fullChecks = 0;
    }, 'CANDIDATE_STATE_FULL_CHECK_MISMATCH'],
  ])('rejects clean-checkout recovery with %s after the whole chain is rehashed', (_, mutate, code) => {
    const { root, path } = cleanCheckoutAuthorityFixture();
    const authority = JSON.parse(readFileSync(join(root, path), 'utf8'));
    mutate(authority.events[0].candidate);
    rehashSupervisorAuthority(authority);
    write(root, path, `${JSON.stringify(authority, null, 2)}\n`);
    git(root, ['add', path]);
    git(root, ['commit', '-qm', 'semantic candidate forgery']);

    const projection = createContextProjection(root, 'M1');
    expect(projection.health.ok).toBe(false);
    expect(projection.health.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code, sequence: 0 }),
    ]));
  });

  it('reads a tracked HEAD authority above Node default maxBuffer and reports malformed HEAD bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-large-authority-'));
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 'fixture@example.com']);
    git(root, ['config', 'user.name', 'Fixture']);
    const path = supervisorAuthorityPath('M1');
    write(root, path, `${JSON.stringify({ version: 1, padding: 'x'.repeat(3_200_000) })}\n`);
    git(root, ['add', '.']);
    git(root, ['commit', '-qm', 'large authority']);
    const large = readTrackedSupervisorAuthority(root, 'M1');
    expect(large.errors).toEqual([]);
    expect(large.headAuthority.padding).toHaveLength(3_200_000);

    const oversizedRoot = mkdtempSync(join(tmpdir(), 'onedeck-oversized-authority-'));
    git(oversizedRoot, ['init', '-q']);
    git(oversizedRoot, ['config', 'user.email', 'fixture@example.com']);
    git(oversizedRoot, ['config', 'user.name', 'Fixture']);
    write(oversizedRoot, path, `${JSON.stringify({ version: 1, padding: 'x'.repeat(17_000_000) })}\n`);
    git(oversizedRoot, ['add', '.']);
    git(oversizedRoot, ['commit', '-qm', 'oversized head authority']);
    write(oversizedRoot, path, '{"version":1}\n');
    expect(readTrackedSupervisorAuthority(oversizedRoot, 'M1').errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'HEAD_SUPERVISOR_AUTHORITY_READ_FAILED', path }),
    ]));

    const malformedRoot = mkdtempSync(join(tmpdir(), 'onedeck-malformed-authority-'));
    git(malformedRoot, ['init', '-q']);
    git(malformedRoot, ['config', 'user.email', 'fixture@example.com']);
    git(malformedRoot, ['config', 'user.name', 'Fixture']);
    write(malformedRoot, path, '{not-json\n');
    git(malformedRoot, ['add', '.']);
    git(malformedRoot, ['commit', '-qm', 'malformed head authority']);
    write(malformedRoot, path, '{"version":1}\n');
    expect(readTrackedSupervisorAuthority(malformedRoot, 'M1').errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'HEAD_SUPERVISOR_AUTHORITY_READ_FAILED', path }),
    ]));
  });

  it('fails context and program steps closed on corrupt or failed HEAD authority probes while preserving bootstrap absence', () => {
    const prepare = () => {
      const { root, base } = guardRepoFixture({ full: true });
      const tree = computeTreeFingerprint(root);
      const candidate = pushReadyCandidate(base, tree);
      const usage = usageAuthorityFixture(root, candidate);
      write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));
      git(root, ['add', '.']);
      git(root, ['commit', '-qm', 'semantic candidate with tracked authority']);
      return { root, usage, path: supervisorAuthorityPath('M1') };
    };

    const bootstrap = guardRepoFixture({ full: true });
    const bootstrapPath = supervisorAuthorityPath('M1');
    write(bootstrap.root, bootstrapPath, '{"version":1}\n');
    expect(readTrackedSupervisorAuthority(bootstrap.root, 'M1')).toMatchObject({
      headAuthority: null,
      errors: [],
    });

    const corrupt = prepare();
    const blob = git(corrupt.root, ['rev-parse', `HEAD:${corrupt.path}`]);
    rmSync(join(corrupt.root, '.git', 'objects', blob.slice(0, 2), blob.slice(2)));
    for (const result of [
      createContextProjection(corrupt.root, 'M1', { sessionsRoot: corrupt.usage.sessionsRoot }),
      runProgramStep({ root: corrupt.root, domain: 'M1', action: 'inspect', 'sessions-root': corrupt.usage.sessionsRoot }),
    ]) {
      const errors = result.health?.errors ?? result.errors;
      expect(errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'HEAD_SUPERVISOR_AUTHORITY_PROBE_FAILED', path: corrupt.path }),
      ]));
    }
    expect(runProgramStep({
      root: corrupt.root,
      domain: 'M1',
      action: 'bootstrap-authority',
      'sessions-root': corrupt.usage.sessionsRoot,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_HEAD_SUPERVISOR_AUTHORITY' }),
    ]));

    const failedProbe = prepare();
    const bin = mkdtempSync(join(tmpdir(), 'onedeck-git-wrapper-'));
    const wrapper = join(bin, 'git');
    const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
    writeFileSync(wrapper, [
      '#!/bin/sh',
      'if [ "$1" = "cat-file" ]; then',
      '  echo "forced cat-file probe failure" >&2',
      '  exit 77',
      'fi',
      `exec ${JSON.stringify(realGit)} "$@"`,
    ].join('\n'));
    chmodSync(wrapper, 0o755);
    const originalPath = process.env.PATH;
    process.env.PATH = `${bin}:${originalPath}`;
    try {
      for (const result of [
        createContextProjection(failedProbe.root, 'M1', { sessionsRoot: failedProbe.usage.sessionsRoot }),
        runProgramStep({ root: failedProbe.root, domain: 'M1', action: 'inspect', 'sessions-root': failedProbe.usage.sessionsRoot }),
      ]) {
        const errors = result.health?.errors ?? result.errors;
        expect(errors).toEqual(expect.arrayContaining([
          expect.objectContaining({ code: 'HEAD_SUPERVISOR_AUTHORITY_PROBE_FAILED', path: failedProbe.path }),
        ]));
      }
      expect(runProgramStep({
        root: failedProbe.root,
        domain: 'M1',
        action: 'bootstrap-authority',
        'sessions-root': failedProbe.usage.sessionsRoot,
      }).errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_HEAD_SUPERVISOR_AUTHORITY' }),
      ]));
    } finally {
      process.env.PATH = originalPath;
    }
  }, 15_000);

  it('derives full evidence only from a strict caller-minimal receipt plan', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-authority-'));
    const candidate = candidateFixture();
    const usage = usageAuthorityFixture(root, candidate);
    const derived = deriveUsageReceipt(usage.receiptPlan, {
      sessionsRoot: usage.sessionsRoot,
      contextFingerprint: candidate.treeFingerprint,
    });
    expect(derived.verified.ok).toBe(true);
    expect(derived.receipt).toMatchObject({
      supervisor: {
        sessionId: SESSION_IDS.supervisor,
        byteLength: expect.any(Number),
        prefixSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      observed: {
        supervisorUncachedInputTokens: 60,
        teamUncachedInputTokens: 120,
      },
    });
    const callerMeasured = structuredClone(usage.receiptPlan);
    callerMeasured.supervisor.byteLength = 1;
    expect(() => deriveUsageReceipt(callerMeasured, {
      sessionsRoot: usage.sessionsRoot,
      contextFingerprint: candidate.treeFingerprint,
    })).toThrow(/INVALID_USAGE_RECEIPT_PLAN/);
  });

  it('rejects stale, zero, mislabeled, duplicated, and wrong-parent usage receipts', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-authority-'));
    const candidate = candidateFixture();
    const usage = usageAuthorityFixture(root, candidate);
    expect(verifyUsageReceipt(usage.receipt, {
      sessionsRoot: usage.sessionsRoot,
      expectedContextFingerprint: candidate.treeFingerprint,
      requireCurrent: true,
    }).ok).toBe(true);

    const mislabeled = structuredClone(usage.receipt);
    mislabeled.observed.teamInputTokens = mislabeled.observed.teamUncachedInputTokens;
    delete mislabeled.observed.teamUncachedInputTokens;
    expect(verifyUsageReceipt(mislabeled, {
      sessionsRoot: usage.sessionsRoot,
      expectedContextFingerprint: candidate.treeFingerprint,
    }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_USAGE_RECEIPT_OBSERVED' })]));

    const zero = structuredClone(usage.receipt);
    zero.baseline = { modelCycles: 1, uncachedInputTokens: 60 };
    zero.observed = { ...zero.observed, supervisorModelCycles: 0, supervisorUncachedInputTokens: 0, teamModelCycles: 3, teamUncachedInputTokens: 60 };
    expect(verifyUsageReceipt(zero, {
      sessionsRoot: usage.sessionsRoot,
      expectedContextFingerprint: candidate.treeFingerprint,
    }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ZERO_OR_INVALID_USAGE_RECEIPT' })]));

    const duplicate = structuredClone(usage.receipt);
    duplicate.participants.push(structuredClone(duplicate.participants[0]));
    expect(verifyUsageReceipt(duplicate, {
      sessionsRoot: usage.sessionsRoot,
      expectedContextFingerprint: candidate.treeFingerprint,
    }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_USAGE_RECEIPT_SESSION' })]));

    const wrongParent = structuredClone(usage.receipt);
    writeUsageSession(usage.sessionsRoot, SESSION_IDS.implementer, {
      subagent: { thread_spawn: { parent_thread_id: '99999999-9999-4999-8999-999999999999' } },
    }, 80, 50);
    const refreshed = readSessionUsageReceipt(SESSION_IDS.implementer, usage.sessionsRoot);
    Object.assign(wrongParent.participants[0], { byteLength: refreshed.byteLength, prefixSha256: refreshed.prefixSha256 });
    expect(verifyUsageReceipt(wrongParent, {
      sessionsRoot: usage.sessionsRoot,
      expectedContextFingerprint: candidate.treeFingerprint,
    }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'USAGE_RECEIPT_LINEAGE_MISMATCH' })]));

    const stale = structuredClone(usage.receipt);
    appendFileSync(join(usage.sessionsRoot, `${SESSION_IDS.supervisor}.jsonl`), `${JSON.stringify({ type: 'event_msg', payload: { type: 'noop' } })}\n`);
    expect(verifyUsageReceipt(stale, {
      sessionsRoot: usage.sessionsRoot,
      expectedContextFingerprint: candidate.treeFingerprint,
      requireCurrent: true,
    }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'STALE_USAGE_RECEIPT' })]));
  });

  it('accepts an append and rejects truncation, rewrite, counter reset, STOP laundering, forged repair, and caller lineages', () => {
    const root = mkdtempSync(join(tmpdir(), 'onedeck-authority-'));
    const candidate = candidateFixture();
    const usage = usageAuthorityFixture(root, candidate);
    const bootstrap = createSupervisorBootstrap({
      candidate,
      receipt: usage.receipt,
      actorSessionId: SESSION_IDS.supervisor,
      actorRole: 'supervisor',
    });
    const implementing = structuredClone(candidate);
    implementing.state = 'implementing';
    implementing.counters.implementerLineages = 1;
    implementing.lineages.implementer = [{ id: SESSION_IDS.implementer, compactions: 0, freshContinuations: 0 }];
    const append = createSupervisorEvent({
      sequence: 1,
      action: 'local-write',
      actorSessionId: SESSION_IDS.implementer,
      actorRole: 'implementer',
      candidate: implementing,
      receipt: usage.receipt,
      previousHash: bootstrap.events[0].eventHash,
    });
    const valid = { ...structuredClone(bootstrap), events: [...bootstrap.events, append] };
    expect(verifySupervisorAuthority({ authority: valid, loopCandidate: implementing, sessionsRoot: usage.sessionsRoot }).ok).toBe(true);

    for (const mutate of [
      (receipt) => { receipt.baseline.modelCycles += 1; },
      (receipt) => { receipt.participants.reverse(); },
      (receipt) => { receipt.participants.pop(); },
      (receipt) => { receipt.participants.push(structuredClone(receipt.participants[0])); },
    ]) {
      const changedReceipt = structuredClone(usage.receipt);
      mutate(changedReceipt);
      const changedEvent = createSupervisorEvent({
        sequence: 1,
        action: 'local-write',
        actorSessionId: SESSION_IDS.implementer,
        actorRole: 'implementer',
        candidate: implementing,
        receipt: changedReceipt,
        previousHash: bootstrap.events[0].eventHash,
      });
      expect(verifySupervisorAuthority({
        authority: { ...structuredClone(bootstrap), events: [...bootstrap.events, changedEvent] },
        loopCandidate: implementing,
        sessionsRoot: usage.sessionsRoot,
      }).errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'TRACKED_RECEIPT_PLAN_MISMATCH', sequence: 1 }),
      ]));
    }

    const truncated = structuredClone(bootstrap);
    expect(verifySupervisorAuthority({ authority: truncated, headAuthority: valid, loopCandidate: candidate, sessionsRoot: usage.sessionsRoot }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'TRACKED_SUPERVISOR_HISTORY_TRUNCATED' })]));

    const rewritten = structuredClone(bootstrap);
    rewritten.events[0].reason = 'rewritten';
    rewritten.events[0].eventHash = createSupervisorEvent({ ...rewritten.events[0], receipt: usage.receipt, candidate }).eventHash;
    expect(verifySupervisorAuthority({ authority: rewritten, headAuthority: bootstrap, loopCandidate: candidate, sessionsRoot: usage.sessionsRoot }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'TRACKED_SUPERVISOR_HISTORY_REWRITTEN' })]));

    const resetCandidate = structuredClone(implementing);
    resetCandidate.counters.implementerLineages = 0;
    resetCandidate.lineages.implementer = [];
    const reset = createSupervisorEvent({ sequence: 2, action: 'acknowledge-guard-impact', actorSessionId: SESSION_IDS.supervisor, actorRole: 'supervisor', candidate: resetCandidate, receipt: usage.receipt, previousHash: append.eventHash });
    const resetAuthority = { ...structuredClone(valid), events: [...valid.events, reset] };
    expect(verifySupervisorAuthority({ authority: resetAuthority, loopCandidate: resetCandidate, sessionsRoot: usage.sessionsRoot }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'TRACKED_COUNTER_DECREASE' })]));

    const stopped = structuredClone(implementing);
    stopped.state = 'audit-failed-stop';
    const stopBootstrap = createSupervisorBootstrap({ candidate: stopped, receipt: usage.receipt, actorSessionId: SESSION_IDS.supervisor, actorRole: 'supervisor' });
    const launder = createSupervisorEvent({ sequence: 1, action: 'start-correction', actorSessionId: SESSION_IDS.implementer, actorRole: 'implementer', candidate: implementing, receipt: usage.receipt, previousHash: stopBootstrap.events[0].eventHash });
    expect(verifySupervisorAuthority({ authority: { ...stopBootstrap, events: [...stopBootstrap.events, launder] }, loopCandidate: implementing, sessionsRoot: usage.sessionsRoot }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'TRACKED_AUDIT_STOP_LAUNDERING' })]));

    const reopened = structuredClone(stopped);
    reopened.state = 'audit-repairable';
    const reopen = createSupervisorEvent({ sequence: 1, action: 'user-reopen', actorSessionId: SESSION_IDS.supervisor, actorRole: 'supervisor', candidate: reopened, receipt: usage.receipt, previousHash: stopBootstrap.events[0].eventHash, reason: 'user-ruling:final-repair' });
    expect(verifySupervisorAuthority({ authority: { ...stopBootstrap, events: [...stopBootstrap.events, reopen] }, loopCandidate: reopened, sessionsRoot: usage.sessionsRoot }).errors)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'TRACKED_AUDIT_STOP_LAUNDERING' })]));

    const repair = structuredClone(implementing);
    repair.state = 'repair-required';
    repair.repairReason = 'guard-impact';
    const badRepair = createSupervisorEvent({ sequence: 2, action: 'require-repair', actorSessionId: SESSION_IDS.supervisor, actorRole: 'supervisor', candidate: repair, receipt: usage.receipt, previousHash: append.eventHash, reason: 'guard-impact' });
    expect(verifySupervisorAuthority({ authority: { ...valid, events: [...valid.events, badRepair] }, loopCandidate: repair, sessionsRoot: usage.sessionsRoot }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'TRACKED_INVALID_REPAIR_ORIGIN' })]));

    const caller = structuredClone(candidate);
    caller.counters.implementerLineages = 1;
    caller.lineages.implementer = [{ id: 'caller-controlled', compactions: 0, freshContinuations: 0 }];
    const forged = createSupervisorBootstrap({ candidate: caller, receipt: usage.receipt, actorSessionId: SESSION_IDS.supervisor, actorRole: 'supervisor' });
    expect(verifySupervisorAuthority({ authority: forged, loopCandidate: caller, sessionsRoot: usage.sessionsRoot }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNVERIFIED_IMPLEMENTER_LINEAGE' })]));
  });
});

describe('GOV-CODEX-58A guard impact and preflight', () => {
  it('rejects other-domain authority drift before every release action and same-domain history rewrite', () => {
    for (const action of ['record-semantic-push', 'start-ci-wait', 'mark-ci-passed', 'deploy', 'ship']) {
      const { root, base } = guardRepoFixture({ full: true });
      const tree = computeTreeFingerprint(root);
      const candidate = pushReadyCandidate(base, tree);
      usageAuthorityFixture(root, candidate);
      write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));
      write(root, supervisorAuthorityPath('OTHER'), '{"unexpected":true}\n');
      expect(runProgramStep({ root, domain: 'M1', action }).errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'UNEXPECTED_SUPERVISOR_AUTHORITY_DRIFT',
          path: supervisorAuthorityPath('OTHER'),
        }),
      ]));
    }

    const { root, base } = guardRepoFixture({ full: true });
    const tree = computeTreeFingerprint(root);
    const candidate = pushReadyCandidate(base, tree);
    const usage = usageAuthorityFixture(root, candidate);
    write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));
    const path = supervisorAuthorityPath('M1');
    git(root, ['add', '.']);
    git(root, ['commit', '-qm', 'semantic candidate with authority']);
    const rewritten = JSON.parse(readFileSync(join(root, path), 'utf8'));
    rewritten.events[0].reason = 'rewritten';
    rewritten.events[0].eventHash = createSupervisorEvent({
      ...rewritten.events[0],
      candidate: rewritten.events[0].candidate,
      receipt: rewritten.events[0].receipt,
    }).eventHash;
    write(root, path, `${JSON.stringify(rewritten, null, 2)}\n`);
    const rejected = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'record-semantic-push',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(rejected.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TRACKED_SUPERVISOR_HISTORY_REWRITTEN' }),
    ]));
  }, 15_000);

  it('reaches canonical derive-repair only from a verified repair-required tracked record', () => {
    const { root, base } = guardRepoFixture({ full: true });
    const tree = computeTreeFingerprint(root);
    const candidate = candidateFixture({
      baseSha: base,
      treeFingerprint: tree,
      state: 'audited',
      counters: {
        ...emptyCandidateCounters(),
        implementerLineages: 1,
        coldAuditorLineages: 1,
        auditWaitChains: 1,
      },
      lineages: {
        implementer: [{ id: SESSION_IDS.implementer, compactions: 0, freshContinuations: 0 }],
        coldAuditor: [{ id: SESSION_IDS.auditor, compactions: 0, freshContinuations: 0 }],
      },
      waitChains: { audit: [SESSION_IDS.auditor], ci: [] },
    });
    const usage = usageAuthorityFixture(root, candidate);
    write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));

    const required = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'require-repair',
      reason: 'guard-impact',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(required.ok, JSON.stringify(required.errors)).toBe(true);
    expect(required.activeCandidate.state).toBe('repair-required');
    const repairLoop = readFileSync(join(root, '.claude/loop-state.md'), 'utf8');
    const authorityPath = join(root, supervisorAuthorityPath('M1'));
    const validAuthority = readFileSync(authorityPath, 'utf8');

    const malformed = JSON.parse(validAuthority);
    malformed.events.at(-1).eventHash = '0'.repeat(64);
    writeFileSync(authorityPath, `${JSON.stringify(malformed, null, 2)}\n`);
    const rejected = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'derive-repair',
      candidate: 'M1-candidate-2',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_TRACKED_SUPERVISOR_EVENT' }),
    ]));
    expect(readFileSync(join(root, '.claude/loop-state.md'), 'utf8')).toBe(repairLoop);

    writeFileSync(authorityPath, validAuthority);
    git(root, ['commit', '--allow-empty', '-qm', 'post-commit repair head']);
    const repairBase = git(root, ['rev-parse', 'HEAD']);
    const derived = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'derive-repair',
      candidate: 'M1-candidate-2',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(derived.ok, JSON.stringify(derived.errors)).toBe(true);
    expect(derived.activeCandidate).toMatchObject({
      id: 'M1-candidate-2',
      repairOf: candidate.id,
      state: 'implementing',
      baseSha: repairBase,
      releaseHeadSha: null,
      acceptanceFingerprint: candidate.acceptanceFingerprint,
      authority: candidate.authority,
      counters: required.activeCandidate.counters,
    });
    const derivedAuthority = JSON.parse(readFileSync(authorityPath, 'utf8'));
    expect(derivedAuthority.events.at(-1)).toMatchObject({
      action: 'derive-repair',
      candidate: { id: 'M1-candidate-2', repairOf: candidate.id },
    });
    expect(readFileSync(join(root, '.claude/loop-state.md'), 'utf8')).toContain(`baseSha: ${repairBase}`);
  }, 15_000);

  it('bootstraps a STOP atomically and survives JSONL growth during the next long guard action', () => {
    const { root, base } = guardRepoFixture({ full: true });
    const tree = computeTreeFingerprint(root);
    const counters = {
      ...emptyCandidateCounters(),
      implementerLineages: 1,
      coldAuditorLineages: 1,
      auditWaitChains: 1,
      correctionWaves: 2,
    };
    const candidate = candidateFixture({
      baseSha: base,
      treeFingerprint: tree,
      state: 'audit-failed-stop',
      counters,
      lineages: {
        implementer: [{ id: SESSION_IDS.implementer, compactions: 0, freshContinuations: 0 }],
        coldAuditor: [{ id: SESSION_IDS.auditor, compactions: 0, freshContinuations: 0 }],
      },
      waitChains: { audit: [SESSION_IDS.auditor], ci: [] },
      stopReason: 'prior cold-audit stop',
      usageSnapshot: structuredClone(counters),
    });
    const usage = usageAuthorityFixture(root, candidate, { writeAuthority: false });
    write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));

    const bootstrap = runProgramStep({
      root,
      domain: 'M1',
      action: 'bootstrap-authority',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
      afterReceiptDerived: () => appendUsageCycle(usage.sessionsRoot, SESSION_IDS.supervisor, 20, 10),
    });
    expect(bootstrap.ok, JSON.stringify(bootstrap.errors)).toBe(true);
    expect(bootstrap.bootstrapLoopCandidate).toMatchObject({
      id: candidate.id,
      state: 'audit-failed-stop',
      stopReason: candidate.stopReason,
      usageSnapshot: candidate.usageSnapshot,
      counters: {
        correctionWaves: 2,
        supervisorModelCycles: 1,
        supervisorUncachedInputTokens: 60,
        teamModelCycles: 4,
        teamUncachedInputTokens: 120,
      },
    });
    expect(bootstrap.bootstrapAuthority.events[0].receipt.supervisor.byteLength)
      .toBeLessThan(readSessionUsageReceipt(SESSION_IDS.supervisor, usage.sessionsRoot).byteLength);

    write(root, bootstrap.trackedPath, `${JSON.stringify(bootstrap.bootstrapAuthority, null, 2)}\n`);
    write(root, '.claude/loop-state.md', loopText([bootstrap.bootstrapLoopCandidate], 'audit-failed-stop', base, tree));
    expect(createContextProjection(root, 'M1', { sessionsRoot: usage.sessionsRoot }).health.ok).toBe(true);

    const shiftedPlan = structuredClone(usage.receiptPlan);
    shiftedPlan.baseline.modelCycles += 1;
    const shiftedPlanPath = join(usage.sessionsRoot, 'shifted-plan.json');
    writeFileSync(shiftedPlanPath, `${JSON.stringify(shiftedPlan, null, 2)}\n`);
    const authorityBeforeMismatch = readFileSync(join(root, bootstrap.trackedPath), 'utf8');
    const loopBeforeMismatch = readFileSync(join(root, '.claude/loop-state.md'), 'utf8');
    const mismatch = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'acknowledge-guard-impact',
      owner: 'judge',
      'receipt-plan': shiftedPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(mismatch.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'USAGE_RECEIPT_PLAN_ANCHOR_MISMATCH' }),
    ]));
    expect(readFileSync(join(root, bootstrap.trackedPath), 'utf8')).toBe(authorityBeforeMismatch);
    expect(readFileSync(join(root, '.claude/loop-state.md'), 'utf8')).toBe(loopBeforeMismatch);

    const guarded = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'acknowledge-guard-impact',
      owner: 'judge',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
      afterReceiptDerived: () => appendUsageCycle(usage.sessionsRoot, SESSION_IDS.supervisor, 30, 15),
    });
    expect(guarded.ok, JSON.stringify(guarded.errors)).toBe(true);
    expect(guarded.activeCandidate.state).toBe('audit-failed-stop');
    expect(guarded.activeCandidate.usageSnapshot).toEqual(candidate.usageSnapshot);
    const tracked = JSON.parse(readFileSync(join(root, bootstrap.trackedPath), 'utf8'));
    expect(tracked.events).toHaveLength(2);
    expect(tracked.events[1].receipt.supervisor.byteLength)
      .toBeLessThan(readSessionUsageReceipt(SESSION_IDS.supervisor, usage.sessionsRoot).byteLength);
    expect(createContextProjection(root, 'M1', { sessionsRoot: usage.sessionsRoot }).health.ok).toBe(true);

    write(root, 'src/value.mjs', 'export const value = 3;\n');
    expect(createContextProjection(root, 'M1', { sessionsRoot: usage.sessionsRoot }).health.errors)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'CANDIDATE_TREE_FINGERPRINT_MISMATCH' }),
      ]));
    const refreshed = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'refresh-fingerprint',
      owner: 'judge',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
      afterReceiptDerived: () => appendUsageCycle(
        usage.sessionsRoot,
        SESSION_IDS.supervisor,
        40,
        20,
      ),
    });
    expect(refreshed.ok, JSON.stringify(refreshed.errors)).toBe(true);
    expect(refreshed.activeCandidate.treeFingerprint).not.toBe(tree);
    expect(createContextProjection(root, 'M1', { sessionsRoot: usage.sessionsRoot }).health.ok)
      .toBe(true);
    const refreshedAuthority = JSON.parse(
      readFileSync(join(root, bootstrap.trackedPath), 'utf8'),
    );
    expect(refreshedAuthority.events.at(-1)).toMatchObject({
      action: 'refresh-fingerprint',
      actorSessionId: SESSION_IDS.supervisor,
      actorRole: 'supervisor',
    });

    const staleCaller = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'acknowledge-guard-impact',
      owner: 'judge',
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(staleCaller.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_VERIFIED_USAGE_RECEIPT', message: expect.stringContaining('STALE_USAGE_RECEIPT') }),
    ]));

    const reset = runProgramStep({
      root,
      domain: 'M1',
      action: 'bootstrap-authority',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(reset.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TRACKED_SUPERVISOR_AUTHORITY_ALREADY_EXISTS' }),
    ]));

    const resumed = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'repair-resume',
      reason: 'same-scope:new-cold-audit-root-cause',
      'receipt-plan': usage.receiptPlanPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(resumed.ok, JSON.stringify(resumed.errors)).toBe(true);
    expect(resumed.activeCandidate).toMatchObject({
      id: candidate.id,
      state: 'audit-repairable',
      acceptanceFingerprint: candidate.acceptanceFingerprint,
      authority: candidate.authority,
    });
    const resumedAuthority = JSON.parse(readFileSync(join(root, bootstrap.trackedPath), 'utf8'));
    expect(resumedAuthority.events[0].candidate.state).toBe('audit-failed-stop');
    expect(resumedAuthority.events.at(-1)).toMatchObject({
      action: 'repair-resume',
      reason: 'same-scope:new-cold-audit-root-cause',
      candidate: { state: 'audit-repairable' },
    });
    expect(createContextProjection(root, 'M1', { sessionsRoot: usage.sessionsRoot }).health.ok).toBe(true);
  });

  it('emits stable paths, owners, path/import/allowlist guards, predecessor hashes, and exact acknowledgement', () => {
    const { root, base } = guardRepoFixture();
    const projection = { activeCandidate: candidateFixture() };
    const first = buildGuardImpact({ root, base, domain: 'M1', projection });
    const second = buildGuardImpact({ root, base, domain: 'M1', projection });
    expect(second.reportFingerprint).toBe(first.reportFingerprint);
    expect(first.changedPaths).toEqual([
      expect.objectContaining({
        path: 'src/value.mjs',
        owner: 'implementer',
        base: expect.objectContaining({ sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }),
        current: expect.objectContaining({ sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }),
      }),
    ]);
    expect(first.guards.map((guard) => guard.type)).toEqual(expect.arrayContaining(['import', 'allowlist']));
    expect(new Set(first.guards.map((guard) => guard.source))).toEqual(new Set(['base', 'current']));
    expect(first.predecessorHashes).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'base', changedPath: 'src/value.mjs', guardPath: 'scripts/guard.mjs' }),
      expect.objectContaining({ source: 'current', changedPath: 'src/value.mjs', guardPath: 'scripts/guard.mjs' }),
    ]));

    const exact = structuredClone(projection);
    exact.activeCandidate.guardImpact = {
      reportFingerprint: first.reportFingerprint,
      acknowledgement: first.acknowledgementRequired,
    };
    expect(buildGuardImpact({ root, base, domain: 'M1', projection: exact }).ok).toBe(true);

    write(root, 'src/value.mjs', 'export const value = 3;\n');
    const byteDrift = buildGuardImpact({ root, base, domain: 'M1', projection: exact });
    expect(byteDrift.ok).toBe(false);
    expect(byteDrift.changedPaths[0].current.sha256).not.toBe(first.changedPaths[0].current.sha256);
    expect(byteDrift.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'STALE_GUARD_REPORT_FINGERPRINT' }),
      expect.objectContaining({ code: 'GUARD_ACKNOWLEDGEMENT_MISMATCH' }),
    ]));

    for (const [name, mutate, code] of [
      ['omitted', (candidate) => { candidate.guardImpact.acknowledgement = null; }, 'MISSING_GUARD_ACKNOWLEDGEMENT'],
      ['additional', (candidate) => { candidate.guardImpact.acknowledgement.paths.push({ path: 'extra', owner: 'judge' }); }, 'GUARD_ACKNOWLEDGEMENT_MISMATCH'],
      ['wildcard', (candidate) => { candidate.guardImpact.acknowledgement.paths[0].path = 'src/*'; }, 'WILDCARD_GUARD_ACKNOWLEDGEMENT'],
      ['stale', (candidate) => { candidate.guardImpact.reportFingerprint = '0'.repeat(64); }, 'STALE_GUARD_REPORT_FINGERPRINT'],
    ]) {
      const invalid = structuredClone(exact);
      mutate(invalid.activeCandidate);
      expect(buildGuardImpact({ root, base, domain: 'M1', projection: invalid }).errors, name).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    }
  });

  it('requires current receipts and intrinsic guard validation for gated transitions', () => {
    const { root, base } = guardRepoFixture({ full: true });
    const tree = computeTreeFingerprint(root);
    const candidate = candidateFixture({ baseSha: base, treeFingerprint: tree });
    const usage = usageAuthorityFixture(root, candidate);
    write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));

    expect(runProgramStep({ root, domain: 'M1', action: 'local-write', 'sessions-root': usage.sessionsRoot }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MISSING_VERIFIED_USAGE_RECEIPT' })]));
    expect(runProgramStep({
      root,
      domain: 'M1',
      action: 'local-write',
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'VERIFIED_ACTOR_MISMATCH' })]));

    const started = runProgramStep({
      root,
      domain: 'M1',
      action: 'local-write',
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.implementer,
      'actor-role': 'implementer',
    });
    expect(started.ok, JSON.stringify(started.errors)).toBe(true);
    const audit = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'audit',
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.auditor,
      'actor-role': 'cold-auditor',
    });
    expect(audit.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INTRINSIC_GUARD_VALIDATION_FAILED' }),
    ]));
  });

  it('makes release preflight reject an explicit old domain while M1 is globally supervised', () => {
    const { root, base } = guardRepoFixture({ full: true });
    const ledger = ledgerFixture();
    const old = { ...structuredClone(ledger.domains[0]), id: 'OLD', status: 'shipped' };
    ledger.domains.unshift(old);
    ledger.plannedSequence.unshift({ ...structuredClone(old), domainId: 'OLD' });
    ledger.goalPolicy.activeProgram.domainIds = ['OLD', 'M1'];
    write(root, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledger, null, 2)}\n`);
    const tree = computeTreeFingerprint(root);
    const candidate = candidateFixture({ baseSha: base, treeFingerprint: tree });
    const usage = usageAuthorityFixture(root, candidate);
    write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));
    const report = buildReleasePreflight({ root, base, domain: 'OLD', owner: 'judge', sessionsRoot: usage.sessionsRoot });
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ACTIVE_SUPERVISED_CANDIDATE_DOMAIN_MISMATCH' }),
    ]));
  });

  it('makes release preflight consume the same supervisor, budget, permission, and guard result', () => {
    const { root, base } = guardRepoFixture({ full: true });
    const tree = computeTreeFingerprint(root);
    const candidate = candidateFixture({
      baseSha: base,
      treeFingerprint: tree,
      repairOf: 'M1-candidate-0',
    });
    const usage = usageAuthorityFixture(root, candidate);
    write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));
    const beforeInspect = readFileSync(join(root, '.claude/loop-state.md'), 'utf8');
    expect(runProgramStep({ root, domain: 'M1', action: 'inspect', 'sessions-root': usage.sessionsRoot }).ok).toBe(true);
    expect(readFileSync(join(root, '.claude/loop-state.md'), 'utf8')).toBe(beforeInspect);
    const acknowledged = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'acknowledge-guard-impact',
      owner: 'judge',
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(acknowledged.ok, JSON.stringify(acknowledged.errors)).toBe(true);
    const initial = buildGuardImpact({
      root,
      base,
      domain: 'M1',
      projection: { activeCandidate: acknowledged.activeCandidate },
    });
    expect(initial.ok).toBe(true);
    const report = buildReleasePreflight({ root, base, domain: 'M1', owner: 'judge', sessionsRoot: usage.sessionsRoot });
    expect(report.ok, JSON.stringify(report.errors)).toBe(true);
    expect(report.checks).toMatchObject({
      supervisorStateValid: true,
      budgetValid: true,
      permissionValid: true,
      guardImpactValid: true,
    });
    expect(report.guardImpact.reportFingerprint).toBe(initial.reportFingerprint);
    expect(report.activeCandidate.id).toBe(candidate.id);
    expect(buildBudgetReport({ root, domain: 'M1', sessionsRoot: usage.sessionsRoot }).ok).toBe(true);

    const stepped = runProgramStep({
      root,
      domain: 'M1',
      action: 'local-write',
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.implementer,
      'actor-role': 'implementer',
    });
    expect(stepped.ok, JSON.stringify(stepped.errors)).toBe(true);
    expect(stepped.activeCandidate).toMatchObject({
      state: 'implementing',
      counters: { implementerLineages: 1 },
      lineages: { implementer: [{ id: SESSION_IDS.implementer }] },
    });
    expect(readFileSync(join(root, '.claude/loop-state.md'), 'utf8')).toContain('step: implementing');
    const audit = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'audit',
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.auditor,
      'actor-role': 'cold-auditor',
    });
    expect(audit.ok, JSON.stringify(audit.errors)).toBe(true);
    expect(audit.activeCandidate).toMatchObject({
      state: 'audit-ready',
      counters: { coldAuditorLineages: 1, auditWaitChains: 1 },
      lineages: { coldAuditor: [{ id: SESSION_IDS.auditor }] },
      waitChains: { audit: [SESSION_IDS.auditor] },
    });
    for (const action of [
      'mark-audited',
      'full-check',
      'mark-full-check-passed',
      'commit',
    ]) {
      const result = runProgramStep({
        root,
        base,
        domain: 'M1',
        action,
        receipt: usage.receiptPath,
        'sessions-root': usage.sessionsRoot,
        'actor-session': SESSION_IDS.supervisor,
        'actor-role': 'supervisor',
      });
      expect(result.ok, `${action}: ${JSON.stringify(result.errors)}`).toBe(true);
    }
    git(root, ['add', '.']);
    git(root, ['commit', '-qm', 'semantic candidate']);
    const pushed = runProgramStep({
      root,
      base,
      domain: 'M1',
      action: 'record-replacement-push',
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    expect(pushed.ok, `push: ${JSON.stringify(pushed.errors)}`).toBe(true);
    expect(pushed.activeCandidate.releaseHeadSha).toBe(git(root, ['rev-parse', 'HEAD']));
    const supervisorAction = (action) => runProgramStep({
      root,
      base,
      domain: 'M1',
      action,
      receipt: usage.receiptPath,
      'sessions-root': usage.sessionsRoot,
      'actor-session': SESSION_IDS.supervisor,
      'actor-role': 'supervisor',
    });
    const ciWait = supervisorAction('start-ci-wait');
    expect(ciWait.ok, JSON.stringify(ciWait.errors)).toBe(true);
    expect(supervisorAction('mark-ci-passed').ok).toBe(true);
    expect(supervisorAction('deploy').ok).toBe(true);
    const shipped = supervisorAction('ship');
    expect(shipped.ok, JSON.stringify(shipped.errors)).toBe(true);
    expect(shipped.activeCandidate.state).toBe('shipped');
    git(root, ['commit', '--allow-empty', '-qm', 'metadata-only different head']);
    expect(runProgramStep({
      root,
      domain: 'M1',
      action: 'inspect',
      'sessions-root': usage.sessionsRoot,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CANDIDATE_RELEASE_HEAD_SHA_MISMATCH' }),
    ]));
  }, 15_000);

  it('makes context, budget, and preflight reject the same old token-counter schema', () => {
    const { root, base } = guardRepoFixture({ full: true });
    const tree = computeTreeFingerprint(root);
    const candidate = candidateFixture({ baseSha: base, treeFingerprint: tree });
    candidate.counters.supervisorInputTokens = candidate.counters.supervisorUncachedInputTokens;
    delete candidate.counters.supervisorUncachedInputTokens;
    write(root, '.claude/loop-state.md', loopText([candidate], candidate.state, base, tree));

    const context = createContextProjection(root, 'M1');
    const budget = buildBudgetReport({ root, domain: 'M1' });
    const preflight = buildReleasePreflight({ root, base, domain: 'M1', owner: 'judge' });
    for (const [name, errors] of [
      ['context', context.health.errors],
      ['budget', budget.errors],
      ['preflight', preflight.errors],
    ]) {
      expect(errors, name).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_CANDIDATE_COUNTERS' })]),
      );
    }
    expect(budget.ok).toBe(false);
    expect(preflight.checks).toMatchObject({ supervisorStateValid: false, budgetValid: false });
  });
});
