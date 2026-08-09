import { describe, expect, it } from 'vitest';

import {
  CoreCardOrientationCreationError,
  createCoreCardOrientationStateV1,
  validateCoreCardOrientationStateV1,
} from '../cardOrientation';
import type {
  CoreCardOrientationStateV1,
  CoreCardOrientationValidationCode,
  CoreCardOrientationValidationIssue,
  CoreCardOrientationValidationResult,
} from '../cardOrientation';

const FIELD_ORDER = ['faceIndex', 'faceDown', 'tapped', 'flipped', 'phasedOut'] as const;

function validInput(): Record<string, unknown> {
  return {
    faceIndex: 1,
    faceDown: false,
    tapped: true,
    flipped: false,
    phasedOut: true,
  };
}

function assertValid(result: CoreCardOrientationValidationResult): CoreCardOrientationStateV1 {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function issuesOf(result: CoreCardOrientationValidationResult): readonly CoreCardOrientationValidationIssue[] {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected validation to fail');
  return result.issues;
}

function expectIssue(
  result: CoreCardOrientationValidationResult,
  code: CoreCardOrientationValidationCode,
  path?: string,
): void {
  const issues = issuesOf(result);
  expect(issues.some((issue) => issue.code === code && (path === undefined || issue.path === path))).toBe(true);
}

describe('Core card orientation runtime contract V1', () => {
  it('accepts normal values and preserves every orientation meaning', () => {
    const value = assertValid(validateCoreCardOrientationStateV1(validInput()));
    expect(value.faceIndex).toBe(1);
    expect(value.faceDown).toBe(false);
    expect(value.tapped).toBe(true);
    expect(value.flipped).toBe(false);
    expect(value.phasedOut).toBe(true);
  });

  it('accepts faceIndex zero and the largest safe integer', () => {
    const zero = validInput();
    zero.faceIndex = 0;
    expect(assertValid(validateCoreCardOrientationStateV1(zero)).faceIndex).toBe(0);

    const largest = validInput();
    largest.faceIndex = Number.MAX_SAFE_INTEGER;
    expect(assertValid(validateCoreCardOrientationStateV1(largest)).faceIndex).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects %s faceIndex values', (_label, faceIndex) => {
    const input = validInput();
    input.faceIndex = faceIndex;
    expectIssue(validateCoreCardOrientationStateV1(input), 'INVALID_INTEGER', '/faceIndex');
  });

  it('rejects numeric faceIndex strings and non-boolean status values', () => {
    const numericString = validInput();
    numericString.faceIndex = '1';
    expectIssue(validateCoreCardOrientationStateV1(numericString), 'INVALID_TYPE', '/faceIndex');

    for (const field of ['faceDown', 'tapped', 'flipped', 'phasedOut'] as const) {
      const input = validInput();
      input[field] = 'false';
      expectIssue(validateCoreCardOrientationStateV1(input), 'INVALID_TYPE', `/${field}`);
    }
  });

  it('rejects missing and unknown fields without filling defaults', () => {
    const missing = validInput();
    delete missing.faceDown;
    const missingResult = validateCoreCardOrientationStateV1(missing);
    expectIssue(missingResult, 'MISSING_FIELD', '/faceDown');
    expect(() => createCoreCardOrientationStateV1(missing)).toThrowError(CoreCardOrientationCreationError);

    const unknown = validInput();
    unknown.extra = false;
    expectIssue(validateCoreCardOrientationStateV1(unknown), 'UNKNOWN_FIELD', '/extra');
  });

  it('rejects null, arrays, built-in objects, and class instances at the root', () => {
    class OrientationLike {
      readonly faceIndex = 0;
      readonly faceDown = false;
      readonly tapped = false;
      readonly flipped = false;
      readonly phasedOut = false;
    }

    for (const input of [null, [], new Date(), new Map(), new Set(), new OrientationLike()] as readonly unknown[]) {
      expectIssue(validateCoreCardOrientationStateV1(input), 'INVALID_ROOT', '');
    }
  });

  it('rejects accessor fields without executing their getters', () => {
    const input = validInput();
    let getterExecuted = false;
    Object.defineProperty(input, 'tapped', {
      enumerable: true,
      configurable: true,
      get: () => {
        getterExecuted = true;
        return false;
      },
    });

    expectIssue(validateCoreCardOrientationStateV1(input), 'INVALID_TYPE', '/tapped');
    expect(getterExecuted).toBe(false);
  });

  it('rejects non-enumerable and symbol fields', () => {
    const nonEnumerable = validInput();
    Object.defineProperty(nonEnumerable, 'flipped', {
      value: false,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expectIssue(validateCoreCardOrientationStateV1(nonEnumerable), 'UNKNOWN_FIELD', '/flipped');

    const symbol = Symbol('orientation');
    const withSymbol = validInput();
    Object.defineProperty(withSymbol, symbol, { value: true, enumerable: true });
    expectIssue(validateCoreCardOrientationStateV1(withSymbol), 'UNKNOWN_FIELD', '/Symbol(orientation)');
  });

  it('returns every issue in path and code-unit order', () => {
    const input: Record<string, unknown> = {
      faceIndex: -1,
      faceDown: 'false',
      tapped: 1,
      unknown: true,
    };
    const result = validateCoreCardOrientationStateV1(input);
    const issues = issuesOf(result);
    const keys = issues.map((issue) => `${issue.path}\u0000${issue.code}`);
    const sortedKeys = keys.slice().sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
    expect(keys).toEqual(sortedKeys);
    expect(issues.some((issue) => issue.path === '/flipped' && issue.code === 'MISSING_FIELD')).toBe(true);
    expect(issues.some((issue) => issue.path === '/phasedOut' && issue.code === 'MISSING_FIELD')).toBe(true);
    expect(issues.some((issue) => issue.path === '/unknown' && issue.code === 'UNKNOWN_FIELD')).toBe(true);
  });

  it('does not mutate input and allocates a frozen value with fixed field order', () => {
    const input = validInput();
    const before = JSON.stringify(input);
    const value = assertValid(validateCoreCardOrientationStateV1(input));

    expect(JSON.stringify(input)).toBe(before);
    expect(value).not.toBe(input);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.keys(value)).toEqual(FIELD_ORDER);
    expect(Reflect.ownKeys(value)).toEqual(FIELD_ORDER);
  });

  it('accepts JSON round trips and keeps factory output equal to validator output', () => {
    const input = validInput();
    const roundTripped: unknown = JSON.parse(JSON.stringify(input));
    const roundTrippedValue = assertValid(validateCoreCardOrientationStateV1(roundTripped));
    expect(roundTrippedValue).toEqual(input);

    const validation = validateCoreCardOrientationStateV1(input);
    const factoryValue = createCoreCardOrientationStateV1(input);
    const validatedValue = assertValid(validation);
    expect(JSON.stringify(factoryValue)).toBe(JSON.stringify(validatedValue));
    expect(Object.isFrozen(factoryValue)).toBe(true);
  });

  it('uses the declared validation code vocabulary only', () => {
    const result = validateCoreCardOrientationStateV1({});
    const allowed: readonly CoreCardOrientationValidationCode[] = [
      'INVALID_ROOT',
      'MISSING_FIELD',
      'UNKNOWN_FIELD',
      'INVALID_TYPE',
      'INVALID_INTEGER',
    ];
    for (const issue of issuesOf(result)) expect(allowed).toContain(issue.code);
  });
});
