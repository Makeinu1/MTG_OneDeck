import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CoreCounterDamageCreationError,
  createCoreCounterDamageStateV1,
  validateCoreCounterDamageStateV1,
} from '../counterDamage';

function state(counters: readonly { readonly kind: string; readonly count: unknown }[] = [], markedDamage: unknown = 0): Record<string, unknown> {
  return { counters: counters.map((entry) => ({ ...entry })), markedDamage };
}

function rejected(value: unknown, code?: string): void {
  const result = validateCoreCounterDamageStateV1(value);
  expect(result.ok).toBe(false);
  if (!result.ok && code !== undefined) expect(result.issues.some((issue) => issue.code === code)).toBe(true);
}

describe('Core counter and marked damage value object', () => {
  it('accepts empty counters and zero marked damage', () => {
    const result = validateCoreCounterDamageStateV1(state());
    expect(result.ok).toBe(true);
  });

  it('accepts multiple counters without hard-coded names', () => {
    const result = validateCoreCounterDamageStateV1(state([
      { kind: 'charge', count: 2 },
      { kind: 'custom-future-counter', count: 7 },
    ], 3));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.counters).toEqual([
      { kind: 'charge', count: 2 },
      { kind: 'custom-future-counter', count: 7 },
    ]);
  });

  it('accepts Unicode names and exactly 80 code points', () => {
    const result = validateCoreCounterDamageStateV1(state([
      { kind: '強化𐐷カウンター', count: 1 },
      { kind: '𐐷'.repeat(80), count: 1 },
    ]));
    expect(result.ok).toBe(true);
  });

  it('rejects empty, trimmed, and overlong names', () => {
    for (const kind of ['', ' leading', 'trailing ', '𐐷'.repeat(81)]) {
      rejected(state([{ kind, count: 1 }]), 'INVALID_STRING');
    }
  });

  it('rejects C0, DEL, and C1 control characters', () => {
    for (const kind of ['a\u0000b', 'a\u0009b', 'a\u001fb', 'a\u007fb', 'a\u0080b', 'a\u009fb']) {
      rejected(state([{ kind, count: 1 }]), 'INVALID_STRING');
    }
  });

  it('rejects invalid counter counts and marked damage values', () => {
    for (const count of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      rejected(state([{ kind: 'charge', count }]), count === '1' ? 'INVALID_TYPE' : 'INVALID_INTEGER');
    }
    for (const markedDamage of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      rejected(state([], markedDamage), markedDamage === '1' ? 'INVALID_TYPE' : 'INVALID_INTEGER');
    }
  });

  it('rejects duplicate kinds and does not merge entries', () => {
    rejected(state([
      { kind: 'charge', count: 1 },
      { kind: 'charge', count: 2 },
    ]), 'DUPLICATE_COUNTER_KIND');
    rejected(state([{ kind: 'charge', count: 0 }]), 'INVALID_INTEGER');
  });

  it('requires JavaScript code-unit order and does not use locale order', () => {
    expect(validateCoreCounterDamageStateV1(state([
      { kind: 'Zeta', count: 1 },
      { kind: 'alpha', count: 1 },
    ])).ok).toBe(true);
    rejected(state([
      { kind: 'alpha', count: 1 },
      { kind: 'Zeta', count: 1 },
    ]), 'INVALID_ORDER');
  });

  it('rejects missing and unknown fields', () => {
    rejected({ markedDamage: 0 }, 'MISSING_FIELD');
    rejected({ counters: [], markedDamage: 0, extra: false }, 'UNKNOWN_FIELD');
    rejected({ counters: [{ kind: 'charge', count: 1, extra: false }], markedDamage: 0 }, 'UNKNOWN_FIELD');
  });

  it('rejects accessors without executing them', () => {
    let rootGetterExecuted = false;
    const root = state();
    Object.defineProperty(root, 'counters', {
      enumerable: true,
      get: () => {
        rootGetterExecuted = true;
        return [];
      },
    });
    rejected(root, 'INVALID_TYPE');
    expect(rootGetterExecuted).toBe(false);

    let entryGetterExecuted = false;
    const entry = { kind: 'charge', count: 1 } as Record<string, unknown>;
    Object.defineProperty(entry, 'kind', {
      enumerable: true,
      get: () => {
        entryGetterExecuted = true;
        return 'charge';
      },
    });
    rejected({ counters: [entry], markedDamage: 0 }, 'INVALID_TYPE');
    expect(entryGetterExecuted).toBe(false);

    let arrayGetterExecuted = false;
    const counterArray: unknown[] = [];
    Object.defineProperty(counterArray, '0', {
      enumerable: true,
      get: () => {
        arrayGetterExecuted = true;
        return entry;
      },
    });
    counterArray.length = 1;
    rejected({ counters: counterArray, markedDamage: 0 }, 'INVALID_TYPE');
    expect(arrayGetterExecuted).toBe(false);
  });

  it('rejects non-enumerable and symbol fields', () => {
    const root = state();
    Object.defineProperty(root, 'extra', { value: true, enumerable: false });
    Object.defineProperty(root, Symbol('extra'), { value: true, enumerable: true });
    rejected(root, 'UNKNOWN_FIELD');

    const counters = root.counters;
    if (!Array.isArray(counters)) throw new Error('test counters must be an array');
    Object.defineProperty(counters, Symbol('extra'), { value: true, enumerable: true });
    rejected(root, 'UNKNOWN_FIELD');
  });

  it('rejects sparse arrays and array properties', () => {
    const sparse: unknown[] = [];
    sparse.length = 1;
    rejected({ counters: sparse, markedDamage: 0 }, 'INVALID_TYPE');

    const extra = [] as unknown[];
    Object.defineProperty(extra, 'extra', { value: true, enumerable: false });
    rejected({ counters: extra, markedDamage: 0 }, 'UNKNOWN_FIELD');
  });

  it('returns all issues in path and code-unit order', () => {
    const result = validateCoreCounterDamageStateV1({
      counters: [
        { kind: '', count: 0 },
        { kind: 'a', count: -1, extra: true },
      ],
      markedDamage: -1,
      extra: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(4);
      for (let index = 1; index < result.issues.length; index += 1) {
        const previous = result.issues[index - 1];
        const current = result.issues[index];
        const pathOrder = previous.path < current.path ? -1 : previous.path > current.path ? 1 : 0;
        const order = pathOrder || (previous.code < current.code ? -1 : previous.code > current.code ? 1 : 0);
        expect(order).toBeLessThanOrEqual(0);
      }
    }
  });

  it('does not mutate input and returns a separately allocated deep-frozen value', () => {
    const input = state([{ kind: 'charge', count: 2 }], 4);
    const before = JSON.stringify(input);
    const result = validateCoreCounterDamageStateV1(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.ok).toBe(true);
    if (result.ok) {
      if (!Array.isArray(input.counters)) throw new Error('test counters must be an array');
      expect(result.value).not.toBe(input);
      expect(result.value.counters).not.toBe(input.counters);
      expect(result.value.counters[0]).not.toBe(input.counters[0]);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.counters)).toBe(true);
      expect(Object.isFrozen(result.value.counters[0])).toBe(true);
    }
  });

  it('preserves fixed field order and survives JSON round-trip', () => {
    const input = state([{ kind: 'charge', count: 2 }], 4);
    const result = validateCoreCounterDamageStateV1(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Reflect.ownKeys(result.value)).toEqual(['counters', 'markedDamage']);
    expect(Reflect.ownKeys(result.value.counters[0])).toEqual(['kind', 'count']);
    const roundTrip = validateCoreCounterDamageStateV1(JSON.parse(JSON.stringify(result.value)) as unknown);
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(JSON.stringify(roundTrip.value)).toBe(JSON.stringify(result.value));
  });

  it('keeps factory and validator behavior identical', () => {
    const input = state([{ kind: 'charge', count: 2 }], 4);
    const validation = validateCoreCounterDamageStateV1(input);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    const created = createCoreCounterDamageStateV1(input);
    expect(JSON.stringify(created)).toBe(JSON.stringify(validation.value));

    const invalid = state([{ kind: 'charge', count: 0 }]);
    expect(() => createCoreCounterDamageStateV1(invalid)).toThrow(CoreCounterDamageCreationError);
    try {
      createCoreCounterDamageStateV1(invalid);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CoreCounterDamageCreationError);
      if (error instanceof CoreCounterDamageCreationError) {
        const direct = validateCoreCounterDamageStateV1(invalid);
        if (!direct.ok) expect(error.issues).toEqual(direct.issues);
      }
    }
  });

  it('does not use an untyped escape hatch in the implementation', () => {
    const source = readFileSync(new URL('../counterDamage.ts', import.meta.url), 'utf8');
    const forbiddenTypeName = String.fromCharCode(97, 110, 121);
    expect(new RegExp(`\\b${forbiddenTypeName}\\b`).test(source)).toBe(false);
  });
});
