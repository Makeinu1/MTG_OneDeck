import { describe, expect, test } from 'vitest';

import {
  QA_STATUSES,
  decidePreClose,
  mapM3VerificationResult,
  validateQaEvidence,
} from '../checks/m6-preclose.mjs';
import { SHADOW_RESULTS } from '../checks/m6-shadow-controller.mjs';

const BASE = '1'.repeat(40);
const HEAD = 'a'.repeat(40);

function envelope({
  result = SHADOW_RESULTS.CONTINUE,
  action = 'PRE_CLOSE_FRESHNESS',
} = {}) {
  return {
    action,
    candidate: { planningBase: BASE, head: HEAD },
    decision: {
      result,
      nextAction: action,
      reasons: [],
    },
  };
}

function qaReceipt(result = 'PASS', overrides = {}) {
  return {
    schemaVersion: 1,
    base: BASE,
    head: HEAD,
    result,
    evidenceRef: 'audit://independent-read-only-review',
    ...overrides,
  };
}

describe('M6 pre-close freshness and QA gate', () => {
  test('refuses COMPLETE until AGENTS review applicability is classified', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.UNCLASSIFIED,
    });

    expect(result.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(result.nextAction).toBe('CLASSIFY_QA_REQUIREMENT');
  });

  test('routes high-risk candidates to independent read-only QA without evidence', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.REQUIRED,
    });

    expect(result.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(result.nextAction).toBe('INDEPENDENT_QA');
  });

  test('requires exact candidate-bound QA evidence', () => {
    expect(validateQaEvidence(qaReceipt(), envelope())).toEqual([]);

    for (const bad of [
      qaReceipt('PASS', { head: 'b'.repeat(40) }),
      qaReceipt('PASS', { base: 'c'.repeat(40) }),
      qaReceipt('PASS', { evidenceRef: '' }),
      qaReceipt('UNKNOWN'),
    ]) {
      expect(validateQaEvidence(bad, envelope()).length).toBeGreaterThan(0);
    }
  });

  test('does not close candidates with independent QA findings', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.REQUIRED,
      qaEvidence: qaReceipt('FAIL'),
    });

    expect(result.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(result.nextAction).toBe('RECONCILE_QA_FINDINGS');
  });

  test('stale/unbound QA evidence routes back to independent QA', () => {
    for (const qaEvidence of [
      qaReceipt('PASS', { head: 'b'.repeat(40) }),
      qaReceipt('PASS', { evidenceRef: '' }),
    ]) {
      const result = decidePreClose({
        localEnvelope: envelope(),
        recoveryDisposition: 'RESUME',
        qaStatus: QA_STATUSES.REQUIRED,
        qaEvidence,
      });

      expect(result.result).toBe(SHADOW_RESULTS.CONTINUE);
      expect(result.nextAction).toBe('INDEPENDENT_QA');
    }
  });

  test('stale main/current authority after proof forces replan', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'REPLAN',
      qaStatus: QA_STATUSES.NOT_REQUIRED,
    });

    expect(result.result).toBe(SHADOW_RESULTS.STALE_REPLAN_REQUIRED);
    expect(result.nextAction).toBe('REPLAN');
  });

  test('divergent or blocked current reality requires recovery', () => {
    for (const disposition of ['RESCUE', 'BLOCKED']) {
      const result = decidePreClose({
        localEnvelope: envelope(),
        recoveryDisposition: disposition,
        qaStatus: QA_STATUSES.NOT_REQUIRED,
      });

      expect(result.result).toBe(SHADOW_RESULTS.RECOVERY_REQUIRED);
      expect(result.nextAction).toBe('RECOVER');
    }
  });

  test('completes an exact fresh routine candidate without granting write authority', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.NOT_REQUIRED,
    });

    expect(result.result).toBe(SHADOW_RESULTS.COMPLETE);
    expect(result.nextAction).toBe('REQUEST_EXTERNAL_WRITE_PERMISSION');
  });

  test('completes an exact fresh high-risk candidate only after QA receipt passes', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.REQUIRED,
      qaEvidence: qaReceipt('PASS'),
    });

    expect(result.result).toBe(SHADOW_RESULTS.COMPLETE);
    expect(result.nextAction).toBe('REQUEST_EXTERNAL_WRITE_PERMISSION');
  });

  test('preserves an upstream stop instead of upgrading it', () => {
    const result = decidePreClose({
      localEnvelope: envelope({
        result: SHADOW_RESULTS.UNKNOWN_COVERAGE,
        action: 'STOP_UNKNOWN',
      }),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.NOT_REQUIRED,
    });

    expect(result.result).toBe(SHADOW_RESULTS.UNKNOWN_COVERAGE);
    expect(result.nextAction).toBe('STOP_UNKNOWN');
  });

  test('supports current no-change closeout after freshness and QA classification', () => {
    const result = decidePreClose({
      localEnvelope: envelope({
        result: SHADOW_RESULTS.NO_CHANGE_REQUIRED,
        action: 'CLOSE_NO_CHANGE',
      }),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.NOT_REQUIRED,
    });

    expect(result.result).toBe(SHADOW_RESULTS.COMPLETE);
    expect(result.nextAction).toBe('CLOSE_NO_CHANGE');
  });
});

describe('M6 pre-close consumes actual M3 evidence', () => {
  function m3Result(overrides = {}) {
    return {
      exitCode: 0,
      testExitCode: 0,
      freshness: 'CURRENT_FOR_CANDIDATE',
      plan: {
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
      ...overrides,
    };
  }

  test('only CURRENT_FOR_CANDIDATE M3 proof advances to pre-close freshness', () => {
    const result = mapM3VerificationResult(m3Result());
    expect(result.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(result.nextAction).toBe('PRE_CLOSE_FRESHNESS');
  });

  test('test failure is classified before any repair or close', () => {
    const result = mapM3VerificationResult(m3Result({
      exitCode: 1,
      testExitCode: 1,
      freshness: 'NOT_ESTABLISHED',
    }));
    expect(result.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(result.nextAction).toBe('CLASSIFY_VERIFICATION_FAILURE');
  });

  test('manual blocker cannot be upgraded by a green-looking status', () => {
    const result = mapM3VerificationResult(m3Result({
      exitCode: 1,
      freshness: 'NOT_ESTABLISHED',
      plan: {
        coverage: 'PARTIAL',
        blockers: {
          manualRequired: ['ACC-MANUAL-001'],
          manualFailed: [],
          deferredScenarios: [],
          deferredSemantics: [],
          unbound: [],
          characterizationOnly: [],
          unknownCoverage: [],
        },
      },
    }));
    expect(result.result).toBe(SHADOW_RESULTS.MANUAL_EVIDENCE_REQUIRED);
    expect(result.nextAction).toBe('REQUEST_MANUAL_EVIDENCE');
  });

  test('unknown M3 coverage remains fail-closed', () => {
    const result = mapM3VerificationResult(m3Result({
      exitCode: 1,
      freshness: 'NOT_ESTABLISHED',
      plan: {
        coverage: 'UNKNOWN_COVERAGE',
        blockers: {
          manualRequired: [],
          manualFailed: [],
          deferredScenarios: [],
          deferredSemantics: [],
          unbound: [],
          characterizationOnly: [],
          unknownCoverage: ['src/new-automation.ts'],
        },
      },
    }));
    expect(result.result).toBe(SHADOW_RESULTS.UNKNOWN_COVERAGE);
    expect(result.nextAction).toBe('STOP_UNKNOWN');
  });
});
