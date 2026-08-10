import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateCoreStackChoiceKeyV1 } from '../announcementPrimitivesV1';

describe('O4P-01I-E announcement primitive properties', () => {
  it('accepts every generated key in the contract grammar', () => {
    const first = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split(''));
    const rest = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-'.split(''));
    fc.assert(fc.property(first, fc.array(rest, { maxLength: 20 }), (head, tail) => {
      const key = `${head}${tail.join('')}`;
      expect(validateCoreStackChoiceKeyV1(key).ok).toBe(true);
    }), { numRuns: 40, seed: 20260810 });
  });

  it('never accepts whitespace, separators, or control characters', () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 24 }), (suffix) => {
      const key = `A/${suffix}`;
      expect(validateCoreStackChoiceKeyV1(key).ok).toBe(false);
    }), { numRuns: 40, seed: 20260811 });
  });
});
