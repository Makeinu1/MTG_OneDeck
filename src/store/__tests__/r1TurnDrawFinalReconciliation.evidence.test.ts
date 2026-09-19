import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1 turn-draw final candidate reconciliation evidence', () => {
  it('executes R1-B against the post-review frozen semantic candidate', () => {
    const result = buildCandidateReconciliation({
      base: '42999a55869d6963497e909bb384cc12a0fa1930',
      head: '032b0c6ca9b8d00df163d21992ad1102f11db4eb',
    });

    console.log(`R1_TURN_DRAW_FINAL_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.outcome).not.toBe('UNKNOWN');
    expect(result.base).toBe('42999a55869d6963497e909bb384cc12a0fa1930');
    expect(result.head).toBe('032b0c6ca9b8d00df163d21992ad1102f11db4eb');
  });
});
