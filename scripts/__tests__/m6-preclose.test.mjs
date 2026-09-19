import { describe, expect, test } from 'vitest';

import {
  QA_STATUSES,
  decidePreClose,
} from '../checks/m6-preclose.mjs';
import { SHADOW_RESULTS } from '../checks/m6-shadow-controller.mjs';

function envelope({
  result = SHADOW_RESULTS.CONTINUE,
  action = 'PRE_CLOSE_FRESHNESS',
} = {}) {
  return {
    action,
    decision: {
      result,
      nextAction: action,
      reasons: [],
    },
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

  test('routes high-risk candidates to independent read-only QA', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.REQUIRED,
    });

    expect(result.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(result.nextAction).toBe('INDEPENDENT_QA');
  });

  test('does not close candidates with unresolved QA findings', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.FAIL,
    });

    expect(result.result).toBe(SHADOW_RESULTS.CONTINUE);
    expect(result.nextAction).toBe('RECONCILE_QA_FINDINGS');
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

  test('completes an exact fresh high-risk candidate only after QA passes', () => {
    const result = decidePreClose({
      localEnvelope: envelope(),
      recoveryDisposition: 'RESUME',
      qaStatus: QA_STATUSES.PASS,
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
