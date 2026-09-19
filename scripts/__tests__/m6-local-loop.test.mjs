import { describe, expect, test } from 'vitest';

import {
  VERIFICATION_STATUSES,
  applyRuntimeSignal,
  buildLocalExecutionEnvelope,
} from '../checks/m6-local-loop.mjs';
import { SHADOW_RESULTS } from '../checks/m6-shadow-controller.mjs';

function report({
  result = SHADOW_RESULTS.CONTINUE,
  nextAction = 'EXECUTE',
  changedFiles = [],
} = {}) {
  return {
    workId: 'WO-20260920-604',
    planningBase: '1'.repeat(40),
    head: '2'.repeat(40),
    decision: { result, nextAction, reasons: [] },
    evidence: {
      changedFiles,
      requiredTests: ['scripts/__tests__/m6-local-loop.test.mjs'],
      coverage: 'VERIFIED_WITHIN_DECLARED_COVERAGE',
    },
  };
}

function workOrder() {
  return {
    workId: 'WO-20260920-604',
    scope: {
      expectedChangeRoots: ['scripts/checks/m6-local-loop.mjs', 'scripts/__tests__'],
    },
    protected: {
      paths: ['src', 'docs/contracts'],
      semanticRefs: ['UX-CONST-AUTOMATION'],
    },
    nonGoals: ['Do not perform remote writes.'],
  };
}

describe('M6 local outer-loop runtime signals', () => {
  test('keeps an admitted untouched candidate in EXECUTE', () => {
    const decision = applyRuntimeSignal(report());
    expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(decision.nextAction).toBe('EXECUTE');
  });

  test('keeps an edited unverified candidate in PROVE', () => {
    const decision = applyRuntimeSignal(report({
      nextAction: 'PROVE',
      changedFiles: ['scripts/checks/m6-local-loop.mjs'],
    }));
    expect(decision.nextAction).toBe('PROVE');
  });

  test('moves an exact candidate with passing evidence to pre-close freshness', () => {
    const decision = applyRuntimeSignal(
      report({ nextAction: 'PROVE', changedFiles: ['scripts/checks/m6-local-loop.mjs'] }),
      { verificationStatus: VERIFICATION_STATUSES.PASS },
    );
    expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(decision.nextAction).toBe('PRE_CLOSE_FRESHNESS');
  });

  test('routes a real regression to bounded local reconciliation', () => {
    const decision = applyRuntimeSignal(
      report({ nextAction: 'PROVE', changedFiles: ['scripts/checks/m6-local-loop.mjs'] }),
      { verificationStatus: VERIFICATION_STATUSES.FAIL, failureClass: 'REAL_REGRESSION' },
    );
    expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(decision.nextAction).toBe('RECONCILE');
  });

  test('never treats infra/flaky/stale-test failures as production repair authority', () => {
    for (const failureClass of ['INFRA_FAILURE', 'FLAKY_SUSPECTED', 'STALE_TEST', 'STALE_FIXTURE']) {
      const decision = applyRuntimeSignal(
        report({ nextAction: 'PROVE', changedFiles: ['scripts/checks/m6-local-loop.mjs'] }),
        { verificationStatus: VERIFICATION_STATUSES.FAIL, failureClass },
      );
      expect(decision.result).toBe(SHADOW_RESULTS.CONTINUE);
      expect(decision.nextAction).toBe('RECONCILE_WITHOUT_PRODUCTION_REPAIR');
    }
  });

  test('fails closed when a failed verification has no classification', () => {
    const decision = applyRuntimeSignal(
      report({ nextAction: 'PROVE', changedFiles: ['scripts/checks/m6-local-loop.mjs'] }),
      { verificationStatus: VERIFICATION_STATUSES.FAIL },
    );
    expect(decision.result).toBe(SHADOW_RESULTS.UNKNOWN_COVERAGE);
    expect(decision.nextAction).toBe('STOP_UNKNOWN');
  });

  test('routes missing manual evidence back to the human evidence boundary', () => {
    const decision = applyRuntimeSignal(
      report({ nextAction: 'PROVE', changedFiles: ['scripts/checks/m6-local-loop.mjs'] }),
      { verificationStatus: VERIFICATION_STATUSES.FAIL, failureClass: 'MANUAL_EVIDENCE_MISSING' },
    );
    expect(decision.result).toBe(SHADOW_RESULTS.MANUAL_EVIDENCE_REQUIRED);
    expect(decision.nextAction).toBe('REQUEST_MANUAL_EVIDENCE');
  });

  test('supports evidence-backed no-change closure without code churn', () => {
    const decision = applyRuntimeSignal(report(), {
      noChangeEstablished: true,
    });
    expect(decision.result).toBe(SHADOW_RESULTS.NO_CHANGE_REQUIRED);
    expect(decision.nextAction).toBe('CLOSE_NO_CHANGE');
  });

  test('cannot override an upstream Shadow stop with a runtime PASS', () => {
    const decision = applyRuntimeSignal(
      report({
        result: SHADOW_RESULTS.STALE_REPLAN_REQUIRED,
        nextAction: 'REPLAN',
      }),
      { verificationStatus: VERIFICATION_STATUSES.PASS },
    );
    expect(decision.result).toBe(SHADOW_RESULTS.STALE_REPLAN_REQUIRED);
    expect(decision.nextAction).toBe('REPLAN');
  });
});

describe('M6 local execution envelope', () => {
  test('is derived, local-only, single-candidate and grants no remote-write authority', () => {
    const envelope = buildLocalExecutionEnvelope({
      report: report({
        nextAction: 'PROVE',
        changedFiles: ['scripts/checks/m6-local-loop.mjs'],
      }),
      workOrder: workOrder(),
      verificationStatus: VERIFICATION_STATUSES.NOT_RUN,
    });

    expect(envelope.mode).toBe('LOCAL_ONLY');
    expect(envelope.action).toBe('PROVE');
    expect(envelope.candidate.exactCommitRequiredBeforeProof).toBe(true);
    expect(envelope.writeBoundary.allowedRoots).toContain('scripts/checks/m6-local-loop.mjs');
    expect(envelope.writeBoundary.protectedPaths).toContain('src');
    expect(envelope.authority.semanticVerdict).toBe('NOT_COMPUTED');
    expect(envelope.authority.projectStateMutation).toBe('NONE');
    expect(envelope.authority.externalWriteAuthority).toBe('NONE');
    expect(envelope.authority.remoteWrites).toBe('FORBIDDEN');
  });
});
