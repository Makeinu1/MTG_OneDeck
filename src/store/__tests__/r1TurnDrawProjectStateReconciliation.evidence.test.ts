import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1 turn-draw exact candidate reconciliation evidence', () => {
  it('executes the R1-B planner against the frozen CR 103.8 candidate', () => {
    const result = buildCandidateReconciliation({
      base: '42999a55869d6963497e909bb384cc12a0fa1930',
      head: '164aaf6a95922292ccaf9446835d874a80008f85',
    });

    console.log(`R1_TURN_DRAW_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.outcome).not.toBe('UNKNOWN');
    expect(result.base).toBe('42999a55869d6963497e909bb384cc12a0fa1930');
    expect(result.head).toBe('164aaf6a95922292ccaf9446835d874a80008f85');
  });
});
