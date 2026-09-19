import { describe, expect, test } from 'vitest';

import { mapRecoveryDisposition } from '../checks/m6-resume.mjs';
import { SHADOW_RESULTS } from '../checks/m6-shadow-controller.mjs';

describe('M6 fresh-session recovery mapping', () => {
  test('RESUME returns to the local outer loop', () => {
    const result = mapRecoveryDisposition('RESUME');
    expect(result).toEqual({
      result: SHADOW_RESULTS.CONTINUE,
      nextAction: 'RESUME',
      reasons: [],
    });
  });

  test('REPLAN never silently resumes stale work', () => {
    const result = mapRecoveryDisposition('REPLAN');
    expect(result.result).toBe(SHADOW_RESULTS.STALE_REPLAN_REQUIRED);
    expect(result.nextAction).toBe('REPLAN');
  });

  test('RESCUE requires recovery instead of rebasing automatically', () => {
    const result = mapRecoveryDisposition('RESCUE');
    expect(result.result).toBe(SHADOW_RESULTS.RECOVERY_REQUIRED);
    expect(result.nextAction).toBe('RECOVER');
  });

  test('BLOCKED forwards canonical/hygiene diagnostics and stops', () => {
    const result = mapRecoveryDisposition('BLOCKED', {
      canonical: ['Project State stale'],
      hygiene: ['workflow owner missing'],
    });
    expect(result.result).toBe(SHADOW_RESULTS.RECOVERY_REQUIRED);
    expect(result.nextAction).toBe('RECOVER');
    expect(result.reasons).toContain('Project State stale');
    expect(result.reasons).toContain('workflow owner missing');
  });
});
