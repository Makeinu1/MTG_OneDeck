import { describe, expect, test } from 'vitest';

import {
  applyManualEvidence,
  validateManualEvidenceReceipt,
} from '../checks/verify-semantic.mjs';

function plan() {
  return {
    base: 'a'.repeat(40),
    head: 'b'.repeat(40),
    blockers: {
      manualRequired: ['ACC-MANUAL-001'],
      deferredScenarios: [],
      deferredSemantics: [],
      unbound: [],
      characterizationOnly: [],
      unknownCoverage: [],
    },
  };
}

describe('manual semantic evidence receipt', () => {
  test('clears only an exact-candidate manual obligation after PASS evidence', () => {
    const receipt = {
      schemaVersion: 1,
      base: 'a'.repeat(40),
      head: 'b'.repeat(40),
      results: [{
        scenarioId: 'ACC-MANUAL-001',
        result: 'PASS',
        evidenceRef: 'review://manual-001',
      }],
    };
    expect(validateManualEvidenceReceipt(receipt, plan())).toEqual({
      satisfied: ['ACC-MANUAL-001'],
      failed: [],
    });
    const applied = applyManualEvidence(plan(), receipt);
    expect(applied.plan.blockers.manualRequired).toEqual([]);
    expect(applied.plan.blockers.manualFailed).toEqual([]);
  });

  test('rejects stale or unrelated manual evidence', () => {
    expect(() => validateManualEvidenceReceipt({
      schemaVersion: 1,
      base: 'a'.repeat(40),
      head: 'c'.repeat(40),
      results: [],
    }, plan())).toThrow(/head mismatch/);

    expect(() => validateManualEvidenceReceipt({
      schemaVersion: 1,
      base: 'a'.repeat(40),
      head: 'b'.repeat(40),
      results: [{
        scenarioId: 'ACC-NOT-REQUIRED',
        result: 'PASS',
        evidenceRef: 'review://other',
      }],
    }, plan())).toThrow(/not required/);
  });

  test('FAIL evidence remains a blocker and receipt shape is closed', () => {
    const failed = applyManualEvidence(plan(), {
      schemaVersion: 1,
      base: 'a'.repeat(40),
      head: 'b'.repeat(40),
      results: [{
        scenarioId: 'ACC-MANUAL-001',
        result: 'FAIL',
        evidenceRef: 'review://failed',
      }],
    });
    expect(failed.plan.blockers.manualRequired).toEqual(['ACC-MANUAL-001']);
    expect(failed.plan.blockers.manualFailed).toEqual(['ACC-MANUAL-001']);

    expect(() => validateManualEvidenceReceipt({
      schemaVersion: 1,
      base: 'a'.repeat(40),
      head: 'b'.repeat(40),
      results: [{
        scenarioId: 'ACC-MANUAL-001',
        result: 'PASS',
        evidenceRef: 'review://manual-001',
        authorizedToMerge: true,
      }],
    }, plan())).toThrow(/allows only/);
  });
});
