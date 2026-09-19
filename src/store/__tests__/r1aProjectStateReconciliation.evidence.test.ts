import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1-A exact candidate reconciliation evidence', () => {
  it('executes the R1-B planner against the frozen implementation + composition candidate', () => {
    const result = buildCandidateReconciliation({
      base: '42999a55869d6963497e909bb384cc12a0fa1930',
      head: 'fa168ba908310ebe66a476f67ba94128f9b55395',
    });

    console.log(`R1A_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.outcome).not.toBe('UNKNOWN');
    expect(result.base).toBe('42999a55869d6963497e909bb384cc12a0fa1930');
    expect(result.head).toBe('fa168ba908310ebe66a476f67ba94128f9b55395');
  });
});
