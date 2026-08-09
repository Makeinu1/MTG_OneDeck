import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CoreCardReincarnationError,
  createDefaultCoreCardRuntimeAfterZoneChangeV1,
  isDefaultCoreCardRuntimeAfterZoneChangeV1,
  nextCoreCardIncarnationV1,
  nextCoreCardObjectIdV1,
} from '../cardReincarnation';
import type { CoreCardReincarnationErrorCode } from '../cardReincarnation';

function defaultShape(): Record<string, unknown> {
  return {
    orientation: {
      faceIndex: 0,
      faceDown: false,
      tapped: false,
      flipped: false,
      phasedOut: false,
    },
    counterDamage: {
      counters: [],
      markedDamage: 0,
    },
    attachment: {
      attachedTo: null,
    },
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a record`);
  }
  return value as Record<string, unknown>;
}

function errorCode(action: () => unknown): CoreCardReincarnationErrorCode {
  try {
    action();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(CoreCardReincarnationError);
    if (error instanceof CoreCardReincarnationError) return error.code;
  }
  throw new Error('Expected a CoreCardReincarnationError');
}

describe('Core card reincarnation and runtime reset contract V1', () => {
  it('exposes the exact reincarnation error code vocabulary', () => {
    const codes: readonly CoreCardReincarnationErrorCode[] = [
      'INVALID_PHYSICAL_CARD_ID',
      'INVALID_CURRENT_INCARNATION',
      'INCARNATION_OVERFLOW',
    ];
    expect(new Set(codes)).toEqual(new Set([
      'INVALID_PHYSICAL_CARD_ID',
      'INVALID_CURRENT_INCARNATION',
      'INCARNATION_OVERFLOW',
    ]));
    expect(new CoreCardReincarnationError(codes[0], 'test').code).toBe(codes[0]);
  });

  it('increments zero and the largest non-overflow incarnation deterministically', () => {
    expect(nextCoreCardIncarnationV1(0)).toBe(1);
    expect(nextCoreCardIncarnationV1(Number.MAX_SAFE_INTEGER - 1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(nextCoreCardIncarnationV1(0)).toBe(nextCoreCardIncarnationV1(0));
  });

  it.each([
    ['string', '0'],
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
    ['undefined', undefined],
  ])('rejects invalid current incarnation: %s', (_label, value) => {
    expect(errorCode(() => nextCoreCardIncarnationV1(value))).toBe('INVALID_CURRENT_INCARNATION');
  });

  it('rejects the maximum safe integer as an incarnation overflow', () => {
    expect(errorCode(() => nextCoreCardIncarnationV1(Number.MAX_SAFE_INTEGER))).toBe('INCARNATION_OVERFLOW');
  });

  it('does not mutate the current incarnation input or use an external source of values', () => {
    const input = Object.freeze({ value: 4 });
    expect(nextCoreCardIncarnationV1(input.value)).toBe(5);
    expect(input.value).toBe(4);
  });

  it('builds the next object ID through the existing Core ID formatter', () => {
    expect(nextCoreCardObjectIdV1('PC-1', 0)).toBe('PC-1:1');
    expect(nextCoreCardObjectIdV1('PC_1', Number.MAX_SAFE_INTEGER - 1)).toBe('PC_1:9007199254740991');
  });

  it('rejects physical IDs without trimming, correcting, or duplicating ID syntax', () => {
    for (const value of ['', ' PC-1', 'PC-1 ', 'bad id', 'PC:1']) {
      expect(errorCode(() => nextCoreCardObjectIdV1(value, 0))).toBe('INVALID_PHYSICAL_CARD_ID');
    }
  });

  it('propagates incarnation validation and overflow from nextCoreCardIncarnationV1', () => {
    expect(errorCode(() => nextCoreCardObjectIdV1('PC-1', -1))).toBe('INVALID_CURRENT_INCARNATION');
    expect(errorCode(() => nextCoreCardObjectIdV1('PC-1', Number.MAX_SAFE_INTEGER))).toBe('INCARNATION_OVERFLOW');
  });

  it('creates the exact default runtime shape after a zone change', () => {
    const value = createDefaultCoreCardRuntimeAfterZoneChangeV1();
    expect(value).toEqual(defaultShape());
    expect(Object.keys(value)).toEqual(['orientation', 'counterDamage', 'attachment']);
    expect(Object.keys(value.orientation)).toEqual([
      'faceIndex',
      'faceDown',
      'tapped',
      'flipped',
      'phasedOut',
    ]);
    expect(Object.keys(value.counterDamage)).toEqual(['counters', 'markedDamage']);
    expect(Object.keys(value.attachment)).toEqual(['attachedTo']);
  });

  it('deeply freezes the default root and every nested value', () => {
    const value = createDefaultCoreCardRuntimeAfterZoneChangeV1();
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.orientation)).toBe(true);
    expect(Object.isFrozen(value.counterDamage)).toBe(true);
    expect(Object.isFrozen(value.counterDamage.counters)).toBe(true);
    expect(Object.isFrozen(value.attachment)).toBe(true);
  });

  it('allocates an independent reset runtime on every call with no carryover', () => {
    const first = createDefaultCoreCardRuntimeAfterZoneChangeV1();
    const second = createDefaultCoreCardRuntimeAfterZoneChangeV1();
    expect(first).not.toBe(second);
    expect(first.orientation).not.toBe(second.orientation);
    expect(first.counterDamage).not.toBe(second.counterDamage);
    expect(first.attachment).not.toBe(second.attachment);
  });

  it('accepts the factory output as the default runtime', () => {
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(
      createDefaultCoreCardRuntimeAfterZoneChangeV1(),
    )).toBe(true);
  });

  it('accepts a separately allocated structurally equal default runtime', () => {
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(defaultShape())).toBe(true);
  });

  it('rejects an altered tap flag', () => {
    const input = defaultShape();
    record(input.orientation, 'orientation').tapped = true;
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(input)).toBe(false);
  });

  it('rejects altered counters', () => {
    const input = defaultShape();
    record(input.counterDamage, 'counterDamage').counters = [{ kind: 'charge', count: 1 }];
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(input)).toBe(false);
  });

  it('rejects altered marked damage', () => {
    const input = defaultShape();
    record(input.counterDamage, 'counterDamage').markedDamage = 1;
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(input)).toBe(false);
  });

  it('rejects an altered attachment', () => {
    const input = defaultShape();
    record(input.attachment, 'attachment').attachedTo = {
      kind: 'object',
      objectId: 'PC-1:0',
    };
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(input)).toBe(false);
  });

  it('rejects unknown, missing, and invalid fields strictly', () => {
    const extra = defaultShape();
    extra.extra = false;
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(extra)).toBe(false);

    const missing = defaultShape();
    delete missing.orientation;
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(missing)).toBe(false);

    const invalid = defaultShape();
    record(invalid.counterDamage, 'counterDamage').markedDamage = -1;
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(invalid)).toBe(false);

    const accessor = defaultShape();
    let executed = false;
    Object.defineProperty(accessor, 'orientation', {
      enumerable: true,
      configurable: true,
      get: () => {
        executed = true;
        return defaultShape().orientation;
      },
    });
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(accessor)).toBe(false);
    expect(executed).toBe(false);
    const symbolInput = defaultShape();
    const symbol = Symbol('extra');
    Object.defineProperty(symbolInput, symbol, { enumerable: true, configurable: true, value: true });
    const before = JSON.stringify(symbolInput);
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(symbolInput)).toBe(false);
    expect(JSON.stringify(symbolInput)).toBe(before);
  });

  it('uses the existing factories and validators and contains no random, time, network, or explicit any dependency', () => {
    const source = readFileSync(new URL('../cardReincarnation.ts', import.meta.url), 'utf8');
    expect(source).toContain('createCoreCardOrientationStateV1');
    expect(source).toContain('createCoreCounterDamageStateV1');
    expect(source).toContain('createCoreAttachmentStateV1');
    expect(source).toContain('validateCoreCardOrientationStateV1');
    expect(source).toContain('validateCoreCounterDamageStateV1');
    expect(source).toContain('validateCoreAttachmentStateV1');
    expect(source).toContain('coreCardObjectIdOf');
    expect(source).not.toMatch(/Math\.random|Date\b|performance\b|fetch\b|crypto\b/);
    const explicitTypeToken = String.fromCharCode(97, 110, 121);
    expect(source).not.toMatch(new RegExp(`\\b${explicitTypeToken}\\b`));
  });
});
