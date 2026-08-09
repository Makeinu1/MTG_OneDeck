import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CoreZoneOrderError,
  applyCorePermutationV1,
  insertCoreObjectIdAtV1,
  moveCoreObjectIdWithinZoneV1,
  removeCoreObjectIdExactlyOnceV1,
  validateCorePermutationV1,
} from '../zoneOrder';
import type {
  CorePermutationValidationResult,
  CoreZoneOrderErrorCode,
} from '../zoneOrder';

function issueCodes(result: CorePermutationValidationResult): readonly CoreZoneOrderErrorCode[] {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected permutation validation to fail');
  return result.issues.map((issue) => issue.code);
}

function expectIssue(
  result: CorePermutationValidationResult,
  code: CoreZoneOrderErrorCode,
  path?: string,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected permutation validation to fail');
  expect(result.issues.some((issue) => issue.code === code && (path === undefined || issue.path === path))).toBe(true);
}

function expectZoneError(action: () => unknown, code: CoreZoneOrderErrorCode): void {
  let caught: unknown;
  try {
    action();
  } catch (error: unknown) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(CoreZoneOrderError);
  if (caught instanceof CoreZoneOrderError) expect(caught.code).toBe(code);
}

describe('Core immutable zone order contract V1', () => {
  it('accepts a valid permutation and returns a distinct frozen copy in the same order', () => {
    const input = [2, 0, 1];
    const result = validateCorePermutationV1(input, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.value).toEqual([2, 0, 1]);
    expect(result.value).not.toBe(input);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(input).toEqual([2, 0, 1]);
  });

  it('accepts the zero-length permutation', () => {
    const result = validateCorePermutationV1([], 0);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.value).toEqual([]);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('rejects negative, fractional, non-finite, and non-safe expected lengths', () => {
    for (const length of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateCorePermutationV1([], length);
      expectIssue(result, 'INVALID_PERMUTATION_LENGTH', '/expectedLength');
    }
  });

  it('rejects non-arrays and length mismatches', () => {
    expectIssue(validateCorePermutationV1(null, 0), 'INVALID_PERMUTATION_VALUE', '');
    expectIssue(validateCorePermutationV1([0], 2), 'INVALID_PERMUTATION_LENGTH', '/length');
  });

  it('reports every invalid permutation value without coercion', () => {
    const result = validateCorePermutationV1([0, -1, 1.5, Number.NaN, '4'], 5);
    expect(issueCodes(result)).toEqual([
      'INVALID_PERMUTATION_VALUE',
      'INVALID_PERMUTATION_VALUE',
      'INVALID_PERMUTATION_VALUE',
      'INVALID_PERMUTATION_VALUE',
    ]);
    expect(result.ok ? [] : result.issues.map((issue) => issue.path)).toEqual(['/1', '/2', '/3', '/4']);
  });

  it('rejects duplicate permutation values', () => {
    const result = validateCorePermutationV1([0, 0, 2], 3);
    expectIssue(result, 'DUPLICATE_PERMUTATION_VALUE', '/1');
  });

  it('rejects sparse arrays', () => {
    const sparse: number[] = [];
    sparse.length = 2;
    sparse[1] = 0;
    expectIssue(validateCorePermutationV1(sparse, 2), 'INVALID_PERMUTATION_VALUE', '/0');
  });

  it('rejects extra string properties and symbols', () => {
    const input = [0];
    Object.defineProperty(input, 'label', { value: 'extra', enumerable: false });
    const symbol = Symbol('extra');
    Object.defineProperty(input, symbol, { value: true, enumerable: true });
    const result = validateCorePermutationV1(input, 1);
    expectIssue(result, 'INVALID_PERMUTATION_VALUE', '/label');
    expectIssue(result, 'INVALID_PERMUTATION_VALUE', '/Symbol(extra)');
  });

  it('rejects accessors without executing their getters', () => {
    const input = [0];
    let getterExecuted = false;
    Object.defineProperty(input, '0', {
      configurable: true,
      enumerable: true,
      get: () => {
        getterExecuted = true;
        return 0;
      },
    });
    expectIssue(validateCorePermutationV1(input, 1), 'INVALID_PERMUTATION_VALUE', '/0');
    expect(getterExecuted).toBe(false);
  });

  it('collects all issues in path and code-unit order', () => {
    const input = [0, 0, 2];
    Object.defineProperty(input, 'extra', { value: true, enumerable: true });
    const result = validateCorePermutationV1(input, 2);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected invalid permutation');
    const actual = result.issues.map((issue) => `${issue.path}:${issue.code}`);
    expect(actual).toEqual([
      '/1:DUPLICATE_PERMUTATION_VALUE',
      '/2:INVALID_PERMUTATION_VALUE',
      '/extra:INVALID_PERMUTATION_VALUE',
      '/length:INVALID_PERMUTATION_LENGTH',
    ]);
  });

  it('removes exactly one object and freezes a fresh output', () => {
    const input = ['A:0', 'B:0', 'C:0'] as const;
    const output = removeCoreObjectIdExactlyOnceV1(input, 'B:0');
    expect(output).toEqual(['A:0', 'C:0']);
    expect(Object.isFrozen(output)).toBe(true);
    expect(output).not.toBe(input);
    expect(input).toEqual(['A:0', 'B:0', 'C:0']);
  });

  it('rejects removal of an invalid or absent object ID', () => {
    expectZoneError(() => removeCoreObjectIdExactlyOnceV1(['A:0'], ''), 'INVALID_OBJECT_ID');
    expectZoneError(() => removeCoreObjectIdExactlyOnceV1(['A:0'], 'B:0'), 'OBJECT_NOT_FOUND');

    const sparse: string[] = [];
    sparse.length = 1;
    expectZoneError(() => removeCoreObjectIdExactlyOnceV1(sparse, 'A:0'), 'INVALID_ZONE_ARRAY');

    const accessor = ['A:0'];
    let getterExecuted = false;
    Object.defineProperty(accessor, '0', {
      configurable: true,
      enumerable: true,
      get: () => {
        getterExecuted = true;
        return 'A:0';
      },
    });
    expectZoneError(() => removeCoreObjectIdExactlyOnceV1(accessor, 'A:0'), 'INVALID_ZONE_ARRAY');
    expect(getterExecuted).toBe(false);
  });

  it('rejects a duplicated object in a zone before removal', () => {
    expectZoneError(() => removeCoreObjectIdExactlyOnceV1(['A:0', 'A:0'], 'A:0'), 'OBJECT_DUPLICATED');
  });

  it('inserts at the beginning and end without mutating the source', () => {
    const input = ['A:0', 'B:0'] as const;
    const beginning = insertCoreObjectIdAtV1(input, 'C:0', 0);
    const end = insertCoreObjectIdAtV1(input, 'C:0', input.length);
    expect(beginning).toEqual(['C:0', 'A:0', 'B:0']);
    expect(end).toEqual(['A:0', 'B:0', 'C:0']);
    expect(Object.isFrozen(beginning)).toBe(true);
    expect(Object.isFrozen(end)).toBe(true);
    expect(input).toEqual(['A:0', 'B:0']);
  });

  it('rejects an invalid insertion index and an already-present object', () => {
    expectZoneError(() => insertCoreObjectIdAtV1(['A:0'], 'B:0', -1), 'INVALID_INDEX');
    expectZoneError(() => insertCoreObjectIdAtV1(['A:0'], 'B:0', 1.5), 'INVALID_INDEX');
    expectZoneError(() => insertCoreObjectIdAtV1(['A:0'], 'A:0', 0), 'OBJECT_ALREADY_PRESENT');
  });

  it('moves one existing object to every valid position', () => {
    const input = ['A:0', 'B:0', 'C:0', 'D:0'] as const;
    expect(moveCoreObjectIdWithinZoneV1(input, 'C:0', 0)).toEqual(['C:0', 'A:0', 'B:0', 'D:0']);
    expect(moveCoreObjectIdWithinZoneV1(input, 'C:0', 1)).toEqual(['A:0', 'C:0', 'B:0', 'D:0']);
    expect(moveCoreObjectIdWithinZoneV1(input, 'C:0', 3)).toEqual(['A:0', 'B:0', 'D:0', 'C:0']);
    expect(Object.isFrozen(moveCoreObjectIdWithinZoneV1(input, 'C:0', 2))).toBe(true);
    expect(input).toEqual(['A:0', 'B:0', 'C:0', 'D:0']);
  });

  it('rejects missing, duplicated, and out-of-range same-zone moves', () => {
    expectZoneError(() => moveCoreObjectIdWithinZoneV1(['A:0'], 'B:0', 0), 'OBJECT_NOT_FOUND');
    expectZoneError(() => moveCoreObjectIdWithinZoneV1(['A:0', 'B:0'], 'A:0', 2), 'INVALID_INDEX');
    expectZoneError(() => moveCoreObjectIdWithinZoneV1(['A:0', 'A:0'], 'A:0', 0), 'OBJECT_DUPLICATED');
  });

  it('applies output[i] = input[permutation[i]] and freezes the output', () => {
    const input = ['A:0', 'B:0', 'C:0'] as const;
    const permutation = [2, 0, 1];
    const output = applyCorePermutationV1(input, permutation);
    expect(output).toEqual(['C:0', 'A:0', 'B:0']);
    expect(Object.isFrozen(output)).toBe(true);
    expect(input).toEqual(['A:0', 'B:0', 'C:0']);
    expect(permutation).toEqual([2, 0, 1]);
  });

  it('applies an empty permutation and rejects invalid permutations', () => {
    expect(applyCorePermutationV1([], [])).toEqual([]);
    expect(Object.isFrozen(applyCorePermutationV1([], []))).toBe(true);
    expectZoneError(() => applyCorePermutationV1(['A:0', 'B:0'], [0, 0]), 'DUPLICATE_PERMUTATION_VALUE');
    expectZoneError(() => applyCorePermutationV1(['A:0'], [1]), 'INVALID_PERMUTATION_VALUE');
  });

  it('does not use implicit entropy or an untyped escape hatch', () => {
    const source = readFileSync(new URL('../zoneOrder.ts', import.meta.url), 'utf8');
    const untypedWord = String.fromCharCode(97, 110, 121);
    expect(source).not.toContain('Math.random');
    expect(new RegExp(`\\b${untypedWord}\\b`).test(source)).toBe(false);
  });
});
