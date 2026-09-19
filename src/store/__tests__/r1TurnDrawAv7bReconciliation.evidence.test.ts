import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1 turn-draw final AV7b reconciliation evidence', () => {
  it('runs R1-B before Project State mutation', () => {
    const result = buildCandidateReconciliation({
      base: '42999a55869d6963497e909bb384cc12a0fa1930',
      head: '843730c9c7f03b38fa8a23e33c9b5f5bfb130014',
    });

    console.log(`R1_TURN_DRAW_AV7B_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.outcome).not.toBe('UNKNOWN');
    expect(result.projectStateControlChanges).toEqual([]);
    expect(result.base).toBe('42999a55869d6963497e909bb384cc12a0fa1930');
    expect(result.head).toBe('843730c9c7f03b38fa8a23e33c9b5f5bfb130014');
  });
});
