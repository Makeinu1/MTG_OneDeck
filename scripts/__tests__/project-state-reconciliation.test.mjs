import { describe, expect, test } from 'vitest';

import {
  buildCandidateReconciliation,
  classifyCapabilities,
  isWatchedPath,
} from '../checks/project-state-reconciliation.mjs';
import { DEFAULT_ROOT } from '../checks/validation-domain-resolver.mjs';

const watchedRoots = [
  'src',
  'docs/contracts',
  'docs/acceptance',
  'docs/product-requirements.md',
];

const capabilities = [
  {
    id: 'CR-01',
    title: 'Manual Resolution',
    implementationRefs: [{ path: 'src/engine/manual.ts' }],
    verificationRefs: [{ path: 'src/engine/manual.test.ts' }],
  },
  {
    id: 'CR-02',
    title: 'Correction',
    implementationRefs: [{ path: 'src/engine/correction.ts' }],
    verificationRefs: [],
  },
];

function plan(overrides = {}) {
  return {
    coverage: 'VERIFIED_WITHIN_DECLARED_COVERAGE',
    requiredTests: [],
    blockers: { unknownCoverage: [] },
    ...overrides,
  };
}

describe('M1 candidate reconciliation', () => {
  test('runs against an exact frozen no-change candidate without mutating semantic state', () => {
    const result = buildCandidateReconciliation({
      cwd: DEFAULT_ROOT,
      base: 'HEAD',
      head: 'HEAD',
    });

    expect(result).toMatchObject({
      reconciliationRequired: false,
      outcome: 'NOT_REQUIRED',
      summary: {
        PRESERVATION_CANDIDATE: 0,
        REVIEW_REQUIRED: 0,
        UNKNOWN: 0,
      },
      invariants: {
        semanticVerdict: 'NOT_COMPUTED',
        projectStateMutation: 'NOT_PERFORMED',
      },
    });
  });

  test('matches watched roots without treating neighboring paths as watched', () => {
    expect(isWatchedPath('src/engine/a.ts', watchedRoots)).toBe(true);
    expect(isWatchedPath('docs/contracts/ux-constitution.md', watchedRoots)).toBe(true);
    expect(isWatchedPath('docs/product-requirements.md', watchedRoots)).toBe(true);
    expect(isWatchedPath('docs/product-requirements.md.bak', watchedRoots)).toBe(false);
    expect(isWatchedPath('scripts/checks/a.mjs', watchedRoots)).toBe(false);
  });

  test('does not require reconciliation when watched roots are unchanged', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['scripts/checks/tool.mjs'],
      watchedRoots,
      verificationPlan: plan(),
    });

    expect(result).toMatchObject({
      reconciliationRequired: false,
      outcome: 'NOT_REQUIRED',
      classifications: [],
    });
  });

  test('marks directly referenced capability work for review and only proposes preservation for the rest', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['src/engine/manual.ts'],
      watchedRoots,
      verificationPlan: plan(),
    });

    expect(result.outcome).toBe('OWNER_REVIEW_REQUIRED');
    expect(result.classifications).toEqual([
      expect.objectContaining({
        capabilityId: 'CR-01',
        classification: 'REVIEW_REQUIRED',
        reasons: ['direct-implementation-ref:src/engine/manual.ts'],
      }),
      expect.objectContaining({
        capabilityId: 'CR-02',
        classification: 'PRESERVATION_CANDIDATE',
      }),
    ]);
  });

  test('uses selected existing capability evidence as an additional review signal', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['src/engine/shared.ts'],
      watchedRoots,
      verificationPlan: plan({ requiredTests: ['src/engine/manual.test.ts'] }),
    });

    expect(result.classifications[0]).toMatchObject({
      capabilityId: 'CR-01',
      classification: 'REVIEW_REQUIRED',
      reasons: ['selected-capability-evidence:src/engine/manual.test.ts'],
    });
    expect(result.unclaimedImplementationFiles).toEqual(['src/engine/shared.ts']);
    expect(result.classifications[1].classification).toBe('PRESERVATION_CANDIDATE');
  });

  test('requires owner review for every capability when Product/Contract/Acceptance authority changes', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['docs/contracts/ux-constitution.md'],
      watchedRoots,
      verificationPlan: plan(),
    });

    expect(result.outcome).toBe('OWNER_REVIEW_REQUIRED');
    expect(result.classifications.every((item) => item.classification === 'REVIEW_REQUIRED')).toBe(true);
    expect(result.classifications[0].reasons).toContain(
      'authority-surface-changed:docs/contracts/ux-constitution.md',
    );
  });

  test('fails closed to UNKNOWN when M3 reports unknown implementation coverage', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['src/engine/unmapped.ts'],
      watchedRoots,
      verificationPlan: plan({
        coverage: 'UNKNOWN_COVERAGE',
        blockers: { unknownCoverage: ['src/engine/unmapped.ts'] },
      }),
    });

    expect(result.outcome).toBe('UNKNOWN');
    expect(result.classifications.every((item) => item.classification === 'UNKNOWN')).toBe(true);
    expect(result.classifications[0].reasons).toContain('m3-unknown-coverage');
  });

  test('fails closed when the exact candidate has not incorporated current main', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['src/engine/manual.ts'],
      watchedRoots,
      verificationPlan: plan(),
      mainFresh: false,
    });

    expect(result.outcome).toBe('UNKNOWN');
    expect(result.classifications.every((item) => item.classification === 'UNKNOWN')).toBe(true);
    expect(result.classifications[0].reasons).toContain('candidate-does-not-contain-current-main');
  });

  test('fails closed if the base Project State is already stale', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['src/engine/manual.ts'],
      watchedRoots,
      verificationPlan: plan(),
      baselineFresh: false,
    });

    expect(result.outcome).toBe('UNKNOWN');
    expect(result.classifications[0].reasons).toContain('base-project-state-baseline-is-stale');
  });


  test('reports stale base as UNKNOWN even when the candidate itself changes no watched root', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['scripts/checks/tool.mjs'],
      watchedRoots,
      verificationPlan: plan(),
      baselineFresh: false,
    });

    expect(result.outcome).toBe('UNKNOWN');
    expect(result.reconciliationRequired).toBe(false);
    expect(result.classifications.every((item) => item.classification === 'UNKNOWN')).toBe(true);
  });

  test('reports Project State self-modification as UNKNOWN even without a watched-root change', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['docs/project-state/index.json'],
      watchedRoots,
      verificationPlan: plan(),
      projectStateChanged: true,
    });

    expect(result.outcome).toBe('UNKNOWN');
    expect(result.reconciliationRequired).toBe(false);
    expect(result.classifications[0].reasons).toContain(
      'candidate-modifies-project-state-control-plane-before-reconciliation',
    );
  });

  test('fails closed when the candidate edits Project State before reconciliation', () => {
    const result = classifyCapabilities({
      capabilities,
      changedFiles: ['src/engine/manual.ts'],
      watchedRoots,
      verificationPlan: plan(),
      projectStateChanged: true,
    });

    expect(result.outcome).toBe('UNKNOWN');
    expect(result.classifications[0].reasons).toContain(
      'candidate-modifies-project-state-control-plane-before-reconciliation',
    );
  });
});
