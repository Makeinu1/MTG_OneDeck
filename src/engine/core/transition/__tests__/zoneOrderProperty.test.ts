import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  applyCorePermutationV1,
  insertCoreObjectIdAtV1,
  moveCoreObjectIdWithinZoneV1,
  removeCoreObjectIdExactlyOnceV1,
  validateCorePermutationV1,
} from '../zoneOrder';

const objectIds = Array.from({ length: 10 }, (_, index) => `PC${index + 1}:0`);

const fullPermutationArbitrary = fc.shuffledSubarray(
  Array.from({ length: objectIds.length }, (_, index) => index),
  { minLength: objectIds.length, maxLength: objectIds.length },
);

const zoneAndInsertionArbitrary = fc
  .uniqueArray(fc.constantFrom(...objectIds), { minLength: 0, maxLength: objectIds.length })
  .chain((zone) =>
    fc.integer({ min: 0, max: zone.length }).map((index) => ({ zone, index })),
  );

const nonEmptyZoneMoveArbitrary = fc
  .uniqueArray(fc.constantFrom(...objectIds), { minLength: 1, maxLength: objectIds.length })
  .chain((zone) =>
    fc.tuple(
      fc.integer({ min: 0, max: zone.length - 1 }),
      fc.integer({ min: 0, max: zone.length - 1 }),
    ).map(([sourceIndex, targetIndex]) => {
      const objectId = zone[sourceIndex];
      if (objectId === undefined) throw new Error('generated source object must exist');
      return { zone, objectId, targetIndex };
    }),
  );

function inversePermutation(permutation: readonly number[]): readonly number[] {
  const inverse = Array.from({ length: permutation.length }, () => 0);
  permutation.forEach((sourceIndex, outputIndex) => {
    inverse[sourceIndex] = outputIndex;
  });
  return inverse;
}

describe('Core immutable zone order properties', () => {
  it('accepts every generated unique permutation and preserves its complete index set', () => {
    fc.assert(
      fc.property(fullPermutationArbitrary, (permutation) => {
        const result = validateCorePermutationV1(permutation, objectIds.length);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(JSON.stringify(result.issues));
        expect([...result.value].sort((left, right) => left - right)).toEqual(
          Array.from({ length: objectIds.length }, (_, index) => index),
        );
        expect(Object.isFrozen(result.value)).toBe(true);
      }),
      { numRuns: 32, seed: 2026080901 },
    );
  });

  it('round-trips every generated permutation through its inverse', () => {
    fc.assert(
      fc.property(fullPermutationArbitrary, (permutation) => {
        const shuffled = applyCorePermutationV1(objectIds, permutation);
        const restored = applyCorePermutationV1(shuffled, inversePermutation(permutation));
        expect(restored).toEqual(objectIds);
        expect(Object.isFrozen(shuffled)).toBe(true);
        expect(Object.isFrozen(restored)).toBe(true);
      }),
      { numRuns: 32, seed: 2026080902 },
    );
  });

  it('keeps generated permutation application nonmutating and cardinality-preserving', () => {
    fc.assert(
      fc.property(fullPermutationArbitrary, (permutation) => {
        const source = objectIds.slice();
        const permutationCopy = permutation.slice();
        const output = applyCorePermutationV1(source, permutation);
        expect(source).toEqual(objectIds);
        expect(permutation).toEqual(permutationCopy);
        expect(output).toHaveLength(source.length);
        expect(new Set(output)).toEqual(new Set(source));
      }),
      { numRuns: 32, seed: 2026080903 },
    );
  });

  it('round-trips every generated insertion through exactly-once removal', () => {
    fc.assert(
      fc.property(zoneAndInsertionArbitrary, ({ zone, index }) => {
        const inserted = insertCoreObjectIdAtV1(zone, 'NEW:0', index);
        const restored = removeCoreObjectIdExactlyOnceV1(inserted, 'NEW:0');
        expect(restored).toEqual(zone);
        expect(Object.isFrozen(inserted)).toBe(true);
        expect(Object.isFrozen(restored)).toBe(true);
      }),
      { numRuns: 64, seed: 2026080904 },
    );
  });

  it('preserves IDs and cardinality for every generated same-zone move', () => {
    fc.assert(
      fc.property(nonEmptyZoneMoveArbitrary, ({ zone, objectId, targetIndex }) => {
        const moved = moveCoreObjectIdWithinZoneV1(zone, objectId, targetIndex);
        expect(moved).toHaveLength(zone.length);
        expect(new Set(moved)).toEqual(new Set(zone));
        expect(moved[targetIndex]).toBe(objectId);
        expect(Object.isFrozen(moved)).toBe(true);
      }),
      { numRuns: 64, seed: 2026080905 },
    );
  });
});
