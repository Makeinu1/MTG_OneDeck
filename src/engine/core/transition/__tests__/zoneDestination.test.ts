import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CoreZoneDestinationCreationError,
  createCoreCardZoneDestinationV1,
  validateCoreCardZoneDestinationV1,
} from '../zoneDestination';
import type {
  CoreCardZoneDestinationV1,
  CoreZoneDestinationValidationIssue,
} from '../zoneDestination';

function accepted(input: unknown): CoreCardZoneDestinationV1 {
  const result = validateCoreCardZoneDestinationV1(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected a valid zone destination');
  return result.value;
}

function rejected(input: unknown): readonly CoreZoneDestinationValidationIssue[] {
  const result = validateCoreCardZoneDestinationV1(input);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected an invalid zone destination');
  return result.issues;
}

describe('Core zone destination contract V1', () => {
  it('accepts every destination branch and derives owner zones from the card owner', () => {
    expect(accepted({ kind: 'owner-library', placement: { kind: 'top' } })).toEqual({
      kind: 'owner-library',
      placement: { kind: 'top' },
    });
    expect(accepted({ kind: 'owner-library', placement: { kind: 'bottom' } })).toEqual({
      kind: 'owner-library',
      placement: { kind: 'bottom' },
    });
    expect(accepted({ kind: 'owner-library', placement: { kind: 'index', index: 2 } })).toEqual({
      kind: 'owner-library',
      placement: { kind: 'index', index: 2 },
    });
    expect(accepted({ kind: 'owner-hand' })).toEqual({ kind: 'owner-hand' });
    expect(accepted({ kind: 'owner-graveyard' })).toEqual({ kind: 'owner-graveyard' });
    expect(accepted({ kind: 'battlefield', baseControllerPlayerId: 'P1' })).toEqual({
      kind: 'battlefield',
      baseControllerPlayerId: 'P1',
    });
    expect(accepted({ kind: 'stack', baseControllerPlayerId: 'P2' })).toEqual({
      kind: 'stack',
      baseControllerPlayerId: 'P2',
    });
    expect(accepted({ kind: 'exile' })).toEqual({ kind: 'exile' });
    expect(accepted({ kind: 'command' })).toEqual({ kind: 'command' });
  });

  it('accepts top and bottom placement without an index', () => {
    const top = accepted({ kind: 'owner-library', placement: { kind: 'top' } });
    const bottom = accepted({ kind: 'owner-library', placement: { kind: 'bottom' } });
    if (top.kind !== 'owner-library' || bottom.kind !== 'owner-library') {
      throw new Error('expected owner library destinations');
    }
    expect(top.placement).toEqual({ kind: 'top' });
    expect(bottom.placement).toEqual({ kind: 'bottom' });
  });

  it('accepts zero and the largest safe library index', () => {
    expect(accepted({ kind: 'owner-library', placement: { kind: 'index', index: 0 } })).toEqual({
      kind: 'owner-library',
      placement: { kind: 'index', index: 0 },
    });
    expect(accepted({
      kind: 'owner-library',
      placement: { kind: 'index', index: Number.MAX_SAFE_INTEGER },
    })).toEqual({
      kind: 'owner-library',
      placement: { kind: 'index', index: Number.MAX_SAFE_INTEGER },
    });
  });

  it.each([
    ['negative', -1, 'INVALID_INTEGER'],
    ['fractional', 1.5, 'INVALID_INTEGER'],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1, 'INVALID_INTEGER'],
    ['infinity', Number.POSITIVE_INFINITY, 'INVALID_INTEGER'],
    ['nan', Number.NaN, 'INVALID_INTEGER'],
    ['string', '1', 'INVALID_TYPE'],
  ] as const)('rejects %s library indices', (_label, index, code) => {
    expect(rejected({ kind: 'owner-library', placement: { kind: 'index', index } })).toEqual([
      expect.objectContaining({ path: '/placement/index', code }),
    ]);
  });

  it('accepts Core player IDs only on battlefield and stack', () => {
    expect(accepted({ kind: 'battlefield', baseControllerPlayerId: 'P_1-2.a' })).toEqual({
      kind: 'battlefield',
      baseControllerPlayerId: 'P_1-2.a',
    });
    expect(accepted({ kind: 'stack', baseControllerPlayerId: 'A' })).toEqual({
      kind: 'stack',
      baseControllerPlayerId: 'A',
    });
  });

  it('rejects invalid and non-string Core player IDs', () => {
    expect(rejected({ kind: 'battlefield', baseControllerPlayerId: 'bad id' })).toEqual([
      expect.objectContaining({ path: '/baseControllerPlayerId', code: 'INVALID_ID' }),
    ]);
    expect(rejected({ kind: 'stack', baseControllerPlayerId: 1 })).toEqual([
      expect.objectContaining({ path: '/baseControllerPlayerId', code: 'INVALID_TYPE' }),
    ]);
  });

  it('rejects non-plain roots and missing root kind', () => {
    expect(rejected(null)).toEqual([
      expect.objectContaining({ path: '', code: 'INVALID_ROOT' }),
    ]);
    expect(rejected([])).toEqual([
      expect.objectContaining({ path: '', code: 'INVALID_ROOT' }),
    ]);
    expect(rejected({})).toEqual([
      expect.objectContaining({ path: '/kind', code: 'MISSING_FIELD' }),
    ]);
  });

  it('rejects missing placement and base controller fields', () => {
    expect(rejected({ kind: 'owner-library' })).toEqual([
      expect.objectContaining({ path: '/placement', code: 'MISSING_FIELD' }),
    ]);
    expect(rejected({ kind: 'battlefield' })).toEqual([
      expect.objectContaining({ path: '/baseControllerPlayerId', code: 'MISSING_FIELD' }),
    ]);
  });

  it('rejects unknown destination and placement literals', () => {
    expect(rejected({ kind: 'future-zone' })).toEqual([
      expect.objectContaining({ path: '/kind', code: 'INVALID_LITERAL' }),
    ]);
    expect(rejected({ kind: 'owner-library', placement: { kind: 'middle' } })).toEqual([
      expect.objectContaining({ path: '/placement/kind', code: 'INVALID_LITERAL' }),
    ]);
  });

  it('rejects exact-branch excess fields', () => {
    expect(rejected({ kind: 'owner-hand', placement: { kind: 'top' } })).toEqual([
      expect.objectContaining({ path: '/placement', code: 'UNKNOWN_FIELD' }),
    ]);
    expect(rejected({ kind: 'battlefield', baseControllerPlayerId: 'P1', placement: { kind: 'top' } })).toEqual([
      expect.objectContaining({ path: '/placement', code: 'UNKNOWN_FIELD' }),
    ]);
    expect(rejected({ kind: 'owner-library', placement: { kind: 'top', index: 0 } })).toEqual([
      expect.objectContaining({ path: '/placement/index', code: 'UNKNOWN_FIELD' }),
    ]);
  });

  it('rejects unknown root fields', () => {
    const issues = rejected({ kind: 'owner-hand', extra: true });
    expect(issues).toEqual([
      expect.objectContaining({ path: '/extra', code: 'UNKNOWN_FIELD' }),
    ]);
  });

  it('rejects source-zone and same-zone reorder fields', () => {
    expect(rejected({ kind: 'owner-hand', sourceZone: 'battlefield' })).toEqual([
      expect.objectContaining({ path: '/sourceZone', code: 'UNKNOWN_FIELD' }),
    ]);
    expect(rejected({ kind: 'owner-library', placement: { kind: 'top' }, sameZoneReorder: true })).toEqual([
      expect.objectContaining({ path: '/sameZoneReorder', code: 'UNKNOWN_FIELD' }),
    ]);
  });

  it('rejects accessors without executing them', () => {
    let executed = false;
    const root: Record<string, unknown> = {};
    Object.defineProperty(root, 'kind', {
      configurable: true,
      enumerable: true,
      get: () => {
        executed = true;
        return 'owner-hand';
      },
    });

    const issues = rejected(root);
    expect(executed).toBe(false);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/kind', code: 'INVALID_TYPE' }),
    ]));
  });

  it('rejects non-enumerable and symbol fields', () => {
    const root: Record<string, unknown> = { kind: 'owner-hand' };
    Object.defineProperty(root, 'hidden', {
      configurable: true,
      enumerable: false,
      value: true,
    });
    const symbol = Symbol('extra');
    Object.defineProperty(root, symbol, {
      configurable: true,
      enumerable: true,
      value: true,
    });

    const issues = rejected(root);
    expect(issues.map((issue) => issue.path)).toEqual([
      '/Symbol(extra)',
      '/hidden',
    ]);
    expect(issues.every((issue) => issue.code === 'UNKNOWN_FIELD')).toBe(true);
  });

  it('does not mutate input and returns a distinct value', () => {
    const input = { kind: 'owner-library', placement: { kind: 'index', index: 3 } };
    const before = JSON.stringify(input);
    const value = accepted(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(value).not.toBe(input);
    expect(value).not.toBe(input as unknown as CoreCardZoneDestinationV1);
    if (value.kind !== 'owner-library') throw new Error('expected owner library');
    expect(value.placement).not.toBe(input.placement);
  });

  it('deeply freezes the destination and nested placement', () => {
    const value = accepted({ kind: 'owner-library', placement: { kind: 'index', index: 3 } });
    expect(Object.isFrozen(value)).toBe(true);
    if (value.kind !== 'owner-library') throw new Error('expected owner library');
    expect(Object.isFrozen(value.placement)).toBe(true);

    const battlefield = accepted({ kind: 'battlefield', baseControllerPlayerId: 'P1' });
    expect(Object.isFrozen(battlefield)).toBe(true);
  });

  it('preserves JSON round trips', () => {
    const direct = accepted({ kind: 'owner-library', placement: { kind: 'index', index: 4 } });
    const roundTrip = accepted(JSON.parse(JSON.stringify(direct)) as unknown);
    expect(JSON.stringify(roundTrip)).toBe(JSON.stringify(direct));
  });

  it('matches validator success in the factory', () => {
    const input = { kind: 'stack', baseControllerPlayerId: 'P1' };
    const validation = validateCoreCardZoneDestinationV1(input);
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error('expected valid validation');

    const factory = createCoreCardZoneDestinationV1(input);
    expect(JSON.stringify(factory)).toBe(JSON.stringify(validation.value));
    expect(factory).not.toBe(input);
    expect(Object.isFrozen(factory)).toBe(true);
  });

  it('throws the dedicated creation error with validator issues', () => {
    const input = { kind: 'battlefield', baseControllerPlayerId: 'bad id' };
    const validation = validateCoreCardZoneDestinationV1(input);
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('expected invalid validation');

    expect(() => createCoreCardZoneDestinationV1(input)).toThrow(CoreZoneDestinationCreationError);
    try {
      createCoreCardZoneDestinationV1(input);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CoreZoneDestinationCreationError);
      if (error instanceof CoreZoneDestinationCreationError) {
        expect(error.issues).toEqual(validation.issues);
      }
    }
  });

  it('uses fixed field order for every branch and placement', () => {
    const library = accepted({ kind: 'owner-library', placement: { kind: 'index', index: 1 } });
    expect(Object.keys(library)).toEqual(['kind', 'placement']);
    if (library.kind !== 'owner-library') throw new Error('expected owner library');
    expect(Object.keys(library.placement)).toEqual(['kind', 'index']);

    for (const kind of ['owner-hand', 'owner-graveyard', 'exile', 'command'] as const) {
      expect(Object.keys(accepted({ kind }))).toEqual(['kind']);
    }
    expect(Object.keys(accepted({ kind: 'battlefield', baseControllerPlayerId: 'P1' }))).toEqual([
      'kind',
      'baseControllerPlayerId',
    ]);
    expect(Object.keys(accepted({ kind: 'stack', baseControllerPlayerId: 'P1' }))).toEqual([
      'kind',
      'baseControllerPlayerId',
    ]);
  });

  it('returns all issues sorted by path then code and uses unknown guards', () => {
    const issues = rejected({
      kind: 'owner-library',
      placement: { kind: 'index', index: -1, extra: true },
      baseControllerPlayerId: 'P1',
      extra: true,
    });
    expect(issues.map((issue) => `${issue.path}:${issue.code}`)).toEqual([
      '/baseControllerPlayerId:UNKNOWN_FIELD',
      '/extra:UNKNOWN_FIELD',
      '/placement/extra:UNKNOWN_FIELD',
      '/placement/index:INVALID_INTEGER',
    ]);

    const source = readFileSync(new URL('../zoneDestination.ts', import.meta.url), 'utf8');
    const explicitTypeToken = String.fromCharCode(97, 110, 121);
    expect(source).not.toMatch(new RegExp(`\\b${explicitTypeToken}\\b`));
  });
});
