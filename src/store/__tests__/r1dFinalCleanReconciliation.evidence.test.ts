import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1-D final clean candidate reconciliation evidence', () => {
  it('executes R1-B before Project State mutation', () => {
    const result = buildCandidateReconciliation({
      base: '6840a19cee6f6be0c3936e697a0e65bf00aedca8',
      head: 'c0db31342148897e67a3b48d8fa4dd21e54549b5',
    });

    console.log(`R1D_FINAL_CLEAN_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.base).toBe('6840a19cee6f6be0c3936e697a0e65bf00aedca8');
    expect(result.head).toBe('c0db31342148897e67a3b48d8fa4dd21e54549b5');
    expect(result.projectStateControlChanges).toEqual([]);
    expect(result.outcome).not.toBe('UNKNOWN');
  });
});
