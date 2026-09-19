import { describe, expect, it } from 'vitest';

import {
  classifyRecovery,
  validateRecoveryReceipt,
} from '../checks/recovery-reconstruction.mjs';

function receipt() {
  return {
    schemaVersion: 1,
    repository: 'Makeinu1/MTG_OneDeck',
    observedMain: 'a'.repeat(40),
    projectState: { path: 'docs/project-state/index.json', blobSha: 'b'.repeat(40) },
    productionMap: { path: 'docs/project-state/production-map.json', blobSha: 'c'.repeat(40) },
    workOrder: null,
    candidate: {
      branch: 'work',
      head: 'd'.repeat(40),
      mergeBase: 'a'.repeat(40),
      diffFingerprint: 'e'.repeat(64),
    },
    verification: { base: 'a'.repeat(40), head: 'd'.repeat(40), evidenceRefs: [] },
    review: { pr: null, unresolvedRefs: [] },
    generated: [],
  };
}

describe('recovery receipt boundary', () => {
  it('rejects stored semantic/current/write authority claims', () => {
    for (const [key, value] of [
      ['activeMilestone', 'M5'],
      ['nextGate', 'M5.5'],
      ['semanticVerdict', 'MATCH'],
      ['verificationPass', true],
      ['freshness', 'green'],
      ['compatibilityOwnership', 'current'],
      ['externalWriteAuthority', true],
      ['rollbackAuthority', true],
    ]) {
      const valueReceipt = receipt();
      valueReceipt[key] = value;
      expect(validateRecoveryReceipt(valueReceipt, { root: '/nonexistent' }).join('\n'))
        .toContain('forbidden truth/authority field');
    }
  });
});

describe('recovery disposition', () => {
  const healthy = {
    canonicalOk: true,
    hygieneOk: true,
    receiptOk: true,
    mainAncestor: true,
    workOrderProvided: true,
    planningValid: true,
    candidateValid: true,
  };

  it('resumes only an exact healthy bounded candidate', () => {
    expect(classifyRecovery(healthy)).toBe('RESUME');
  });

  it('replans when no bounded Work Order is supplied or it is stale', () => {
    expect(classifyRecovery({ ...healthy, workOrderProvided: false })).toBe('REPLAN');
    expect(classifyRecovery({ ...healthy, planningValid: false })).toBe('REPLAN');
    expect(classifyRecovery({ ...healthy, candidateValid: false })).toBe('REPLAN');
  });

  it('rescues a divergent candidate instead of silently rebasing it', () => {
    expect(classifyRecovery({ ...healthy, mainAncestor: false })).toBe('RESCUE');
  });

  it('blocks when canonical, hygiene, or receipt proof is invalid', () => {
    expect(classifyRecovery({ ...healthy, canonicalOk: false })).toBe('BLOCKED');
    expect(classifyRecovery({ ...healthy, hygieneOk: false })).toBe('BLOCKED');
    expect(classifyRecovery({ ...healthy, receiptOk: false })).toBe('BLOCKED');
  });
});
