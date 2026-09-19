import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1 turn-draw reordered reconciliation evidence', () => {
  it('executes R1-B before any Project State mutation', () => {
    const result = buildCandidateReconciliation({
      base: '42999a55869d6963497e909bb384cc12a0fa1930',
      head: '41fb548cd2274cd4f48dc19b81b54fce5d5d623a',
    });

    console.log(`R1_TURN_DRAW_REORDERED_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.outcome).not.toBe('UNKNOWN');
    expect(result.projectStateControlChanges).toEqual([]);
    expect(result.base).toBe('42999a55869d6963497e909bb384cc12a0fa1930');
    expect(result.head).toBe('41fb548cd2274cd4f48dc19b81b54fce5d5d623a');
  });
});
