import { describe, expect, test } from 'vitest';

import { isActiveLegacyItem, isExplicitlyNonNormative } from '../checks/legacy-inventory-policy.mjs';

describe('legacy inventory disposition policy', () => {
  test.each([
    'Scope-out: MUST NOT be treated as a current contract.',
    'Limitation: SHALL remain outside the active acceptance surface.',
    'Retraction: MUST NOT be promoted after the CR conflict.',
    'Withdrawal: SHALL remain historical evidence only.',
    'Status — MUST NOT be treated as a behavior clause.',
  ])('defers explicit non-normative metadata: %s', (sourceText) => {
    expect(isExplicitlyNonNormative(sourceText)).toBe(true);
    expect(isActiveLegacyItem({
      disposition: 'active-clause',
      itemType: 'normative-statement',
      sourceText,
    })).toBe(false);
  });

  test('allows explicit current normative language', () => {
    expect(isActiveLegacyItem({
      disposition: 'active-clause',
      itemType: 'normative-statement',
      sourceText: 'GameState MUST remain immutable.',
    })).toBe(true);
  });
});
