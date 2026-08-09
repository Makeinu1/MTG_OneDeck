import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateCoreCounterDamageStateV1 } from '../counterDamage';

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

const kindArbitrary = fc.array(
  fc.constantFrom('a', 'b', 'C', '0', '_', '-', 'é', '界', '𐐷'),
  { minLength: 1, maxLength: 10 },
).map((characters) => characters.join(''));

const sortedUniqueCountersArbitrary = fc.array(kindArbitrary, { minLength: 0, maxLength: 12 })
  .map((kinds) => Array.from(new Set(kinds)).sort(codeUnitCompare))
  .map((kinds) => kinds.map((kind, index) => ({ kind, count: index + 1 })));

describe('Core counter and marked damage properties', () => {
  it('accepts every generated sorted unique counter collection', () => {
    fc.assert(
      fc.property(sortedUniqueCountersArbitrary, (counters) => {
        const result = validateCoreCounterDamageStateV1({ counters, markedDamage: counters.length });
        expect(result.ok).toBe(true);
      }),
      { numRuns: 100, seed: 2026080901 },
    );
  });

  it('rejects an adjacent swap of every generated nontrivial sorted collection', () => {
    fc.assert(
      fc.property(
        sortedUniqueCountersArbitrary.filter((counters) => counters.length >= 2),
        (counters) => {
          const swapIndex = counters.length === 2 ? 0 : 1;
          const swapped = counters.slice();
          const first = swapped[swapIndex];
          const second = swapped[swapIndex + 1];
          if (first === undefined || second === undefined) throw new Error('swap pair must exist');
          swapped[swapIndex] = second;
          swapped[swapIndex + 1] = first;
          const result = validateCoreCounterDamageStateV1({ counters: swapped, markedDamage: 0 });
          expect(result.ok).toBe(false);
          if (!result.ok) expect(result.issues.some((issue) => issue.code === 'INVALID_ORDER')).toBe(true);
        },
      ),
      { numRuns: 100, seed: 2026080902 },
    );
  });
});
