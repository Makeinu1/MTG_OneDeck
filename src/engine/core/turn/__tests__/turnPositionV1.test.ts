import { describe, expect, it } from 'vitest';

import {
  validateCoreTurnPositionV1,
  type CoreTurnPositionV1,
} from '../turnPositionV1';

type Raw = Record<string, unknown>;

function valid(value: unknown): CoreTurnPositionV1 {
  const result = validateCoreTurnPositionV1(value);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function codes(value: unknown): readonly string[] {
  const result = validateCoreTurnPositionV1(value);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

function deepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) deepFrozen(descriptor.value, seen);
  }
}

describe('CoreTurnPositionV1', () => {
  it('accepts every phase and every position branch', () => {
    const positions: readonly Raw[] = [
      { phase: 'beginning', step: 'untap' },
      { phase: 'beginning', step: 'upkeep' },
      { phase: 'beginning', step: 'draw' },
      { phase: 'precombat-main', step: null },
      { phase: 'combat', step: 'beginning-of-combat' },
      { phase: 'combat', step: 'declare-attackers' },
      { phase: 'combat', step: 'declare-blockers' },
      { phase: 'combat', step: 'combat-damage' },
      { phase: 'combat', step: 'end-of-combat' },
      { phase: 'postcombat-main', step: null },
      { phase: 'ending', step: 'end' },
      { phase: 'ending', step: 'cleanup' },
    ];
    for (const position of positions) expect(valid(position)).toEqual(position);
  });

  it('rejects invalid phase/step combinations and wrong roots', () => {
    expect(codes({ phase: 'beginning', step: 'combat-damage' })).toContain('INVALID_POSITION');
    expect(codes({ phase: 'combat', step: 'upkeep' })).toContain('INVALID_POSITION');
    expect(codes({ phase: 'precombat-main', step: 'not-null' })).toContain('INVALID_POSITION');
    expect(codes({ phase: 'ending', step: 'draw' })).toContain('INVALID_POSITION');
    expect(codes({ phase: 'unknown', step: null })).toContain('INVALID_LITERAL');
    for (const value of [null, [], new Date(), new Map(), new Set(), class Example {}]) {
      expect(codes(value)).toContain('INVALID_ROOT');
    }
  });

  it('rejects accessors, non-enumerable fields, symbols, and unknown fields without reading accessors', () => {
    let reads = 0;
    const accessor: Raw = {};
    Object.defineProperty(accessor, 'phase', {
      enumerable: true,
      get: () => {
        reads += 1;
        return 'beginning';
      },
    });
    Object.defineProperty(accessor, 'step', { value: 'untap', enumerable: true });
    expect(codes(accessor)).toContain('INVALID_TYPE');
    expect(reads).toBe(0);

    const hostile: Raw = { phase: 'beginning', step: 'untap', extra: true };
    Object.defineProperty(hostile, 'step', { value: 'untap', enumerable: false });
    Object.defineProperty(hostile, Symbol('extra'), { value: true, enumerable: true });
    const result = validateCoreTurnPositionV1(hostile);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['UNKNOWN_FIELD', 'MISSING_FIELD']));
  });

  it('canonicalizes field order, preserves input, returns fresh deep-frozen values, and round-trips through JSON', () => {
    const input: Raw = { step: 'combat-damage', phase: 'combat' };
    const before = JSON.stringify(input);
    const first = valid(input);
    const second = valid(input);
    expect(Object.keys(first)).toEqual(['phase', 'step']);
    expect(JSON.stringify(input)).toBe(before);
    expect(first).not.toBe(second);
    expect(first).not.toBe(input);
    deepFrozen(first);
    expect(valid(JSON.parse(JSON.stringify(first)))).toEqual(first);
  });
});
