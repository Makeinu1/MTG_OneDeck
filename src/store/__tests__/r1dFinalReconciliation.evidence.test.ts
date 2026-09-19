import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1-D final candidate reconciliation evidence', () => {
  it('executes R1-B before Project State mutation', () => {
    const result = buildCandidateReconciliation({
      base: '6840a19cee6f6be0c3936e697a0e65bf00aedca8',
      head: '025b85c1c9352eb5fcbb2c50610b82f4c8dc2a1b',
    });

    console.log(`R1D_FINAL_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.base).toBe('6840a19cee6f6be0c3936e697a0e65bf00aedca8');
    expect(result.head).toBe('025b85c1c9352eb5fcbb2c50610b82f4c8dc2a1b');
    expect(result.projectStateControlChanges).toEqual([]);
    expect(result.outcome).not.toBe('UNKNOWN');
  });
});
