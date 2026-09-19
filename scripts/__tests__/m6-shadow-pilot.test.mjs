import { describe, expect, test } from 'vitest';

import {
  SHADOW_RESULTS,
  decideShadowResult,
  requiresIndependentQa,
} from '../checks/m6-shadow-controller.mjs';

function baseInput(changedFiles = ['scripts/checks/m6-example.mjs']) {
  return {
    projectState: {
      program: {
        activeMilestone: 'M6 — Closed Execution Loop',
        nextGate: 'M6-1P — Shadow Pilot',
      },
    },
    m5: { ok: true, errors: [] },
    recoveryDisposition: 'RESUME',
    planningErrors: [],
    candidateErrors: [],
    drift: {
      changedFiles,
      outsideExpectedChangeRoots: [],
    },
    verificationPlan: {
      changedFiles,
      coverage: 'VERIFIED_WITHIN_DECLARED_COVERAGE',
      blockers: {
        manualRequired: [],
        manualFailed: [],
        deferredScenarios: [],
        deferredSemantics: [],
        unbound: [],
        characterizationOnly: [],
        unknownCoverage: [],
      },
    },
  };
}

const rootCases = [
  {
    source: 'PR #79',
    workId: 'WO-20260919-101',
    title: 'R1-B M1 Candidate Reconciliation',
    changedFiles: [
      'docs/project-state/README.md',
      'scripts/checks/project-state-reconciliation.mjs',
      'scripts/__tests__/project-state-reconciliation.test.mjs',
    ],
    expectedQa: false,
    expectedNext: 'PROVE',
    observedProcess: 'Read-only M1 planner; no Product/runtime/release mutation.',
  },
  {
    source: 'PR #80',
    workId: 'WO-20260919-R1-C',
    title: 'R1-C Release / Integration Hardening',
    changedFiles: [
      '.github/workflows/candidate-verification.yml',
      '.github/workflows/deploy-pages.yml',
      '.github/workflows/deploy-worker.yml',
      'docs/project-state/production-map.json',
    ],
    expectedQa: true,
    expectedNext: 'INDEPENDENT_QA',
    observedProcess: 'Release/deploy topology was independently audited before merge.',
  },
  {
    source: 'PR #85',
    workId: 'WO-20260919-601',
    title: 'M6-1 read-only Shadow Controller',
    changedFiles: [
      'scripts/checks/m6-shadow-controller.mjs',
      'scripts/__tests__/m6-shadow-controller.test.mjs',
      'package.json',
    ],
    expectedQa: false,
    expectedNext: 'PROVE',
    observedProcess: 'Read-only M6 control-plane implementation with objective candidate verification.',
  },
  {
    source: 'PR #87',
    workId: 'WO-20260919-602',
    title: 'M6 incremental verification Fast Path',
    changedFiles: [
      '.github/workflows/candidate-verification.yml',
      '.github/workflows/deploy-pages.yml',
      'scripts/checks/fast-check.mjs',
      'scripts/checks/validation-domains.json',
    ],
    expectedQa: true,
    expectedNext: 'INDEPENDENT_QA',
    observedProcess: 'Verification/release topology change; safety boundaries require high-risk review.',
  },
  {
    source: 'M6-1P pilot',
    workId: 'WO-20260919-603',
    title: 'M6 Shadow Pilot replay',
    changedFiles: [
      'scripts/checks/m6-shadow-controller.mjs',
      'scripts/__tests__/m6-shadow-pilot.test.mjs',
      'docs/project-state/evidence/m6-shadow-pilot.md',
    ],
    expectedQa: false,
    expectedNext: 'PROVE',
    observedProcess: 'Read-only replay/evidence work only; no production or release infrastructure change.',
  },
];

describe('M6-1P real-work root Work Order replay', () => {
  for (const replay of rootCases) {
    test(`${replay.source} ${replay.workId} routes like the observed process`, () => {
      const independentAuditRequired = requiresIndependentQa({
        changedFiles: replay.changedFiles,
      });
      expect(independentAuditRequired).toBe(replay.expectedQa);

      const decision = decideShadowResult({
        ...baseInput(replay.changedFiles),
        independentAuditRequired,
        independentAuditSatisfied: false,
      });
      expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
      expect(decision.nextAction).toBe(replay.expectedNext);
    });
  }
});

describe('M6-1P observed failure replay', () => {
  test('PR #67 browser evidence synchronization drift does not authorize product repair', () => {
    const decision = decideShadowResult({
      ...baseInput(['scripts/online/cockpit-turn-evidence.mjs']),
      verificationFailureClass: 'STALE_FIXTURE',
    });

    expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(decision.nextAction).toBe('RECONCILE_WITHOUT_PRODUCTION_REPAIR');
  });

  test('STALE_TEST likewise stays outside production repair', () => {
    const decision = decideShadowResult({
      ...baseInput(['scripts/__tests__/historical-regression.test.mjs']),
      verificationFailureClass: 'STALE_TEST',
    });

    expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(decision.nextAction).toBe('RECONCILE_WITHOUT_PRODUCTION_REPAIR');
  });

  test('PR #71 closeout-style repository reality mismatch requires replan', () => {
    const input = baseInput(['docs/project-state/index.json']);
    input.candidateErrors = [
      'candidate: repository reality still contains unretired workflow residue',
    ];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.STALE_REPLAN_REQUIRED);
    expect(decision.nextAction).toBe('REPLAN');
  });
});

describe('M6-1P pilot acceptance', () => {
  test('uses five distinct root Work Orders and does not depend on synthetic-only cases', () => {
    expect(rootCases).toHaveLength(5);
    expect(new Set(rootCases.map((item) => item.workId)).size).toBe(5);
    expect(rootCases.filter((item) => item.source.startsWith('PR #'))).toHaveLength(4);
  });

  test('keeps release/deploy review selective rather than making every control-plane task high-risk', () => {
    const qaCases = rootCases.filter((item) => item.expectedQa);
    expect(qaCases.map((item) => item.source)).toEqual(['PR #80', 'PR #87']);
  });
});
