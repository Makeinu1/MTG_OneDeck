import { describe, expect, test } from 'vitest';

import {
  SHADOW_RESULTS,
  decideShadowResult,
} from '../checks/m6-shadow-controller.mjs';

function baseInput() {
  return {
    projectState: {
      program: {
        activeMilestone: 'M6 — Closed Execution Loop',
        completedMilestones: [],
      },
    },
    m5: { ok: true, errors: [] },
    recoveryDisposition: 'RESUME',
    planningErrors: [],
    candidateErrors: [],
    drift: {
      changedFiles: ['scripts/checks/example.mjs'],
      outsideExpectedChangeRoots: [],
    },
    verificationPlan: {
      changedFiles: ['scripts/checks/example.mjs'],
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

describe('M6 shadow admission boundary', () => {
  test('ordinary bounded candidate continues to objective proof', () => {
    const decision = decideShadowResult(baseInput());
    expect(decision).toEqual({
      result: SHADOW_RESULTS.CONTINUE,
      nextAction: 'PROVE',
      reasons: [],
    });
  });

  test('untouched admitted candidate proceeds to execution', () => {
    const input = baseInput();
    input.drift.changedFiles = [];
    input.verificationPlan.changedFiles = [];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(decision.nextAction).toBe('EXECUTE');
  });

  test('UNKNOWN_COVERAGE fails closed', () => {
    const input = baseInput();
    input.verificationPlan.coverage = 'UNKNOWN_COVERAGE';
    input.verificationPlan.blockers.unknownCoverage = ['vendor/new-path.ts'];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.UNKNOWN_COVERAGE);
    expect(decision.nextAction).toBe('STOP_UNKNOWN');
  });

  test('manual-only Acceptance requests exact manual evidence', () => {
    const input = baseInput();
    input.verificationPlan.coverage = 'PARTIAL';
    input.verificationPlan.blockers.manualRequired = ['ACC-MANUAL-001'];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.MANUAL_EVIDENCE_REQUIRED);
    expect(decision.nextAction).toBe('REQUEST_MANUAL_EVIDENCE');
  });

  test('stale or invalid candidate requires replan', () => {
    const input = baseInput();
    input.candidateErrors = ['candidate: referenced authority path changed since planning'];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.STALE_REPLAN_REQUIRED);
    expect(decision.nextAction).toBe('REPLAN');
  });

  test('blocked recovery cannot resume', () => {
    const input = baseInput();
    input.recoveryDisposition = 'BLOCKED';

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.RECOVERY_REQUIRED);
    expect(decision.nextAction).toBe('RECOVER');
  });

  test('deferred semantic requires Owner decision', () => {
    const input = baseInput();
    input.verificationPlan.coverage = 'PARTIAL';
    input.verificationPlan.blockers.deferredSemantics = ['ENG-TURN-003'];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.OWNER_DECISION_REQUIRED);
    expect(decision.nextAction).toBe('REQUEST_OWNER_DECISION');
  });

  test('scope drift outside the Work Order never silently continues', () => {
    const input = baseInput();
    input.drift.outsideExpectedChangeRoots = ['src/unexpected.ts'];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.STALE_REPLAN_REQUIRED);
  });
});

describe('M6 lifecycle availability', () => {
  test('remains available after M6 completes and M7 becomes active', () => {
    const input = baseInput();
    input.projectState.program.activeMilestone = 'M7 — Product Gap Delivery';
    input.projectState.program.completedMilestones = ['M6 — Closed Execution Loop'];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(decision.nextAction).toBe('PROVE');
  });

  test('fails closed before M6 has been established', () => {
    const input = baseInput();
    input.projectState.program.activeMilestone = 'M5 — Audit / Hygiene / Recovery';
    input.projectState.program.completedMilestones = [];

    const decision = decideShadowResult(input);
    expect(decision.result).toBe(SHADOW_RESULTS.STALE_REPLAN_REQUIRED);
    expect(decision.nextAction).toBe('REPLAN');
  });
});
