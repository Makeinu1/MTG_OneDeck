import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  judgeCrGroundingOverlay,
  judgeTotalFrozen,
  type CrGroundingOverlay,
  type CrGroundingOverlayCondition,
} from '../../../scripts/lib/mContractGate';

function condition(
  overrides: Partial<CrGroundingOverlayCondition>,
): CrGroundingOverlayCondition {
  return {
    id: 'CRG-X',
    name: 'example',
    status: 'PASS',
    evidence: ['x'],
    freezeTreatment: 'required-pass',
    ...overrides,
  };
}

function overlay(
  conditionOverrides: Partial<CrGroundingOverlayCondition>,
): CrGroundingOverlay {
  return {
    crVersion: '2026-06-19',
    status: 'test',
    overlayConditions: [condition(conditionOverrides)],
    rFreezeDesigns: [],
  };
}

describe('judgeCrGroundingOverlay', () => {
  it('missing overlay is not approved', () => {
    expect(judgeCrGroundingOverlay(null)).toEqual({
      approved: false,
      problems: ['CR-grounding overlay missing'],
    });
  });

  it('required-pass must be PASS', () => {
    const result = judgeCrGroundingOverlay(
      overlay({ status: 'PARTIAL', freezeTreatment: 'required-pass' }),
    );
    expect(result.approved).toBe(false);
    expect(result.problems).toContain('CRG-X: required-pass must be PASS');
  });

  it('PASS(core) requires core-pass-only and remainingBoundary', () => {
    const missingBoundary = judgeCrGroundingOverlay(
      overlay({ status: 'PASS(core)', freezeTreatment: 'core-pass-only' }),
    );
    expect(missingBoundary.approved).toBe(false);
    expect(missingBoundary.problems).toContain('CRG-X: remainingBoundary required');

    const wrongStatus = judgeCrGroundingOverlay(
      overlay({
        status: 'PASS',
        freezeTreatment: 'core-pass-only',
        remainingBoundary: 'CR 400.7 exceptions remain S-* carry.',
      }),
    );
    expect(wrongStatus.approved).toBe(false);
    expect(wrongStatus.problems).toContain('CRG-X: core-pass-only must be PASS(core)');
  });

  it('PASS(boundary) requires boundary-pass-only and remainingBoundary', () => {
    const missingBoundary = judgeCrGroundingOverlay(
      overlay({ status: 'PASS(boundary)', freezeTreatment: 'boundary-pass-only' }),
    );
    expect(missingBoundary.approved).toBe(false);
    expect(missingBoundary.problems).toContain('CRG-X: remainingBoundary required');

    const wrongStatus = judgeCrGroundingOverlay(
      overlay({
        status: 'PASS',
        freezeTreatment: 'boundary-pass-only',
        remainingBoundary: 'Executors remain scope-boundary.',
      }),
    );
    expect(wrongStatus.approved).toBe(false);
    expect(wrongStatus.problems).toContain(
      'CRG-X: boundary-pass-only must be PASS(boundary)',
    );
  });

  it('PARTIAL requires partial-allowed treatment and remainingBoundary', () => {
    const missingBoundary = judgeCrGroundingOverlay(
      overlay({
        status: 'PARTIAL',
        freezeTreatment: 'partial-allowed-only-if-second-bucket-and-full-sba-are-s-carry',
      }),
    );
    expect(missingBoundary.approved).toBe(false);
    expect(missingBoundary.problems).toContain('CRG-X: remainingBoundary required');

    const wrongStatus = judgeCrGroundingOverlay(
      overlay({
        status: 'PASS',
        freezeTreatment: 'partial-allowed-only-if-second-bucket-and-full-sba-are-s-carry',
        remainingBoundary: '603.3b second bucket remains S-* carry.',
      }),
    );
    expect(wrongStatus.approved).toBe(false);
    expect(wrongStatus.problems).toContain('CRG-X: partial treatment must be PARTIAL');
  });

  it('FAIL and unknown treatments are not approved', () => {
    const fail = judgeCrGroundingOverlay(overlay({ status: 'FAIL' }));
    expect(fail.approved).toBe(false);
    expect(fail.problems).toContain('CRG-X: FAIL is not allowed');

    const unknown = judgeCrGroundingOverlay(
      overlay({ status: 'PASS', freezeTreatment: 'unknown-treatment' }),
    );
    expect(unknown.approved).toBe(false);
    expect(unknown.problems).toContain('CRG-X: unknown freezeTreatment unknown-treatment');
  });

  it('current real overlay is approved by the Q2 rules', () => {
    const realOverlay = JSON.parse(
      readFileSync('research/cr-grounding/m0-freeze-overlay.json', 'utf8'),
    ) as CrGroundingOverlay;

    expect(judgeCrGroundingOverlay(realOverlay)).toEqual({
      approved: true,
      problems: [],
    });
  });
});

describe('judgeTotalFrozen', () => {
  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ])('legacy=%s overlay=%s => frozen=%s', (legacyFrozen, overlayApproved, expected) => {
    expect(
      judgeTotalFrozen({
        legacyFrozen,
        crGroundingOverlayApproved: overlayApproved,
      }),
    ).toBe(expected);
  });
});
