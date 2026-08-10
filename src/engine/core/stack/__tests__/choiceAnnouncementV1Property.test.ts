import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  validateCoreStackChosenModeKeysV1,
  validateCoreStackVariableAnnouncementsV1,
} from '../choiceAnnouncementV1';

const key = fc.stringMatching(/^[A-Za-z][A-Za-z0-9._-]{0,7}$/);

describe('O4P-01I-G choice announcement properties', () => {
  it('accepts every valid chosen-mode sequence unchanged', () => {
    fc.assert(fc.property(fc.array(key, { maxLength: 16 }), (keys) => {
      const result = validateCoreStackChosenModeKeysV1(keys);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual(keys);
    }));
  });

  it('accepts sorted unique variable keys and rejects descending permutations', () => {
    fc.assert(fc.property(fc.uniqueArray(key, { maxLength: 8 }), (keys) => {
      const sorted = [...keys].sort();
      const result = validateCoreStackVariableAnnouncementsV1(sorted.map((variableKey, value) => ({ variableKey, value })));
      expect(result.ok).toBe(true);
    }));
  });
});
