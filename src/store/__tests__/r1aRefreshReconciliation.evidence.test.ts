import { describe, expect, it } from 'vitest';

import { buildCandidateReconciliation } from '../../../scripts/checks/project-state-reconciliation.mjs';

describe('R1-A refreshed candidate reconciliation evidence', () => {
  it('executes R1-B against latest main and clean refreshed candidate', () => {
    const result = buildCandidateReconciliation({
      base: '1166ec2f69ea491f3a64fe7259b2f1866be6432c',
      head: '74407d0a3f53d445308f26288267781beda778a5',
    });

    console.log(`R1A_REFRESH_RECONCILIATION_JSON=${JSON.stringify(result)}`);
    expect(result.base).toBe('1166ec2f69ea491f3a64fe7259b2f1866be6432c');
    expect(result.head).toBe('74407d0a3f53d445308f26288267781beda778a5');
    expect(result.projectStateControlChanges).toEqual([]);
    expect(result.outcome).not.toBe('UNKNOWN');
  });
});
