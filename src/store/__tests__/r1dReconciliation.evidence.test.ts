import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1-D residual automation reconciliation evidence', () => {
  it('executes R1-B before Project State mutation', () => {
    const result = buildCandidateReconciliation({
      base: '6840a19cee6f6be0c3936e697a0e65bf00aedca8',
      head: '1fb38c9b62bc249c3315a733de08e8c37a2b6179',
    });

    console.log(`R1D_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.base).toBe('6840a19cee6f6be0c3936e697a0e65bf00aedca8');
    expect(result.head).toBe('1fb38c9b62bc249c3315a733de08e8c37a2b6179');
    expect(result.projectStateControlChanges).toEqual([]);
    expect(result.outcome).not.toBe('UNKNOWN');
  });
});
