import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1-A exact candidate reconciliation evidence', () => {
  it('executes the R1-B planner against the post-lint frozen candidate', () => {
    const result = buildCandidateReconciliation({
      base: '42999a55869d6963497e909bb384cc12a0fa1930',
      head: 'ae63671f6aa069f79f28a95e84c1c8c456c0bf05',
    });
    console.log(`R1A_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.outcome).not.toBe('UNKNOWN');
    expect(result.head).toBe('ae63671f6aa069f79f28a95e84c1c8c456c0bf05');
  });
});
