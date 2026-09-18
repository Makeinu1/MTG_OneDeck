import { describe, expect, test } from 'vitest';

import {
  isActiveLegacySuggestion,
  isExplicitlyNonNormative,
  LEGACY_JUDGE_DISPOSITIONS,
  LEGACY_SUGGESTED_DISPOSITIONS,
  validateLegacyDecision,
} from '../checks/legacy-inventory-policy.mjs';

describe('legacy inventory disposition policy', () => {
  test.each([
    'Scope-out: MUST NOT be treated as a current contract.',
    'Limitation: SHALL remain outside the active acceptance surface.',
    'Retraction: MUST NOT be promoted after the CR conflict.',
    'Withdrawal: SHALL remain historical evidence only.',
    'Status — MUST NOT be treated as a behavior clause.',
  ])('defers explicit non-normative metadata: %s', (sourceText) => {
    expect(isExplicitlyNonNormative(sourceText)).toBe(true);
    expect(isActiveLegacySuggestion({
      suggestedDisposition: 'active-clause',
      itemType: 'normative-statement',
      sourceText,
    })).toBe(false);
  });

  test('allows explicit machine suggestions without promoting them to judge decisions', () => {
    expect(LEGACY_SUGGESTED_DISPOSITIONS).toEqual(new Set([
      'active-clause',
      'active-acceptance',
      'deferred-needs-decision',
    ]));
    expect(LEGACY_JUDGE_DISPOSITIONS.has('active-clause')).toBe(false);
    expect(LEGACY_JUDGE_DISPOSITIONS.has('active-acceptance')).toBe(false);
    expect(isActiveLegacySuggestion({
      suggestedDisposition: 'active-clause',
      itemType: 'normative-statement',
      sourceText: 'GameState MUST remain immutable.',
    })).toBe(true);
  });

  test('fails closed when an overlay decision no longer binds to the generated base', () => {
    const decision = {
      itemKey: 'stale-key',
      disposition: 'covered-by',
      targetIds: ['ENG-STATE-001'],
      rationale: 'Reviewed mapping.',
      decisionRef: 'M5-DEC-001',
    };
    expect(validateLegacyDecision(decision, {
      baseItemKeys: new Set(['current-key']),
      validTargets: new Set(['ENG-STATE-001']),
    })).toContain('stale-key: itemKey does not resolve to current generated base');
  });

  test('validates covered-by targets and duplicate relations separately', () => {
    const context = {
      baseItemKeys: new Set(['a', 'b']),
      validTargets: new Set(['ENG-STATE-001']),
    };
    expect(validateLegacyDecision({
      itemKey: 'a',
      disposition: 'covered-by',
      targetIds: ['ENG-UNKNOWN-999'],
      rationale: 'Reviewed mapping.',
      decisionRef: 'M5-DEC-002',
    }, context)).toContain('a: unresolved target ENG-UNKNOWN-999');

    expect(validateLegacyDecision({
      itemKey: 'a',
      disposition: 'duplicate-of',
      targetIds: [],
      rationale: 'Same historical item.',
      decisionRef: 'M5-DEC-003',
      duplicateOfItemKey: 'missing',
    }, context)).toContain('a: duplicateOfItemKey must resolve to current generated base');

    expect(validateLegacyDecision({
      itemKey: 'a',
      disposition: 'duplicate-of',
      targetIds: [],
      rationale: 'Same historical item.',
      decisionRef: 'M5-DEC-004',
      duplicateOfItemKey: 'b',
    }, context)).toEqual([]);
  });
});
