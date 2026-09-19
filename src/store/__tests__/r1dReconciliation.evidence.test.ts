import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1-D candidate reconciliation evidence', () => {
  it('executes R1-B before Project State mutation', () => {
    const result = buildCandidateReconciliation({
      base: '6840a19cee6f6be0c3936e697a0e65bf00aedca8',
      head: '4a91a1d16161347b4dcda25bffd14e0b4ba48556',
    });

    console.log(`R1D_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.base).toBe('6840a19cee6f6be0c3936e697a0e65bf00aedca8');
    expect(result.head).toBe('4a91a1d16161347b4dcda25bffd14e0b4ba48556');
    expect(result.projectStateControlChanges).toEqual([]);
    expect(result.outcome).not.toBe('UNKNOWN');
  });
});
