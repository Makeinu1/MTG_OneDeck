import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../ids';
import {
  CoreAttachmentCreationError,
  createCoreAttachmentStateV1,
  isCanonicalCoreObjectIdV1,
  validateCoreAttachmentStateV1,
} from '../attachment';

const objectId = (value: string): CoreObjectId => value as CoreObjectId;
const playerId = (value: string): CorePlayerId => value as CorePlayerId;

function validObjectTarget(): Record<string, unknown> {
  return { kind: 'object', objectId: 'PC-1:0' };
}

function validPlayerTarget(): Record<string, unknown> {
  return { kind: 'player', playerId: 'P1' };
}

function accepted(value: unknown) {
  const result = validateCoreAttachmentStateV1(value);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected a valid attachment state');
  return result.value;
}

function rejected(value: unknown) {
  const result = validateCoreAttachmentStateV1(value);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected an invalid attachment state');
  return result.issues;
}

describe('Core attachment reference contract V1', () => {
  it('accepts null, object targets, player targets, and zero incarnation', () => {
    expect(accepted({ attachedTo: null })).toEqual({ attachedTo: null });
    expect(accepted({ attachedTo: validObjectTarget() })).toEqual({
      attachedTo: { kind: 'object', objectId: objectId('PC-1:0') },
    });
    expect(accepted({ attachedTo: validPlayerTarget() })).toEqual({
      attachedTo: { kind: 'player', playerId: playerId('P1') },
    });
  });

  it('accepts the largest safe incarnation', () => {
    const largest = 'PC-1:9007199254740991';
    expect(isCanonicalCoreObjectIdV1(largest)).toBe(true);
    expect(accepted({ attachedTo: { kind: 'object', objectId: largest } })).toEqual({
      attachedTo: { kind: 'object', objectId: largest },
    });
  });

  it.each([
    ['invalid base ID', 'bad id:0'],
    ['colon absent', 'PC-1'],
    ['incarnation absent', 'PC-1:'],
    ['negative incarnation', 'PC-1:-1'],
    ['fractional incarnation', 'PC-1:1.5'],
    ['leading zero', 'PC-1:01'],
    ['Infinity text', 'PC-1:Infinity'],
    ['exponent text', 'PC-1:1e309'],
    ['extra colon', 'PC-1:0:1'],
  ])('rejects %s object IDs', (_label, value) => {
    expect(isCanonicalCoreObjectIdV1(value)).toBe(false);
    const issues = rejected({ attachedTo: { kind: 'object', objectId: value } });
    expect(issues).toEqual([
      expect.objectContaining({ path: '/attachedTo/objectId', code: 'INVALID_ID' }),
    ]);
  });

  it('rejects invalid player IDs', () => {
    const issues = rejected({ attachedTo: { kind: 'player', playerId: 'P:1' } });
    expect(issues).toEqual([
      expect.objectContaining({ path: '/attachedTo/playerId', code: 'INVALID_ID' }),
    ]);
  });

  it('rejects unknown kinds and union branch excess fields', () => {
    expect(rejected({ attachedTo: { kind: 'future', objectId: 'PC-1:0' } })).toEqual([
      expect.objectContaining({ path: '/attachedTo/kind', code: 'INVALID_LITERAL' }),
    ]);
    expect(rejected({ attachedTo: { kind: 'object', objectId: 'PC-1:0', playerId: 'P1' } })).toEqual([
      expect.objectContaining({ path: '/attachedTo/playerId', code: 'UNKNOWN_FIELD' }),
    ]);
    expect(rejected({ attachedTo: { kind: 'player', playerId: 'P1', objectId: 'PC-1:0' } })).toEqual([
      expect.objectContaining({ path: '/attachedTo/objectId', code: 'UNKNOWN_FIELD' }),
    ]);
  });

  it('rejects missing fields and non-plain roots or targets', () => {
    expect(rejected({})).toEqual([
      expect.objectContaining({ path: '/attachedTo', code: 'MISSING_FIELD' }),
    ]);
    expect(rejected({ attachedTo: { kind: 'object' } })).toEqual([
      expect.objectContaining({ path: '/attachedTo/objectId', code: 'MISSING_FIELD' }),
    ]);
    expect(rejected(null)).toEqual([
      expect.objectContaining({ path: '', code: 'INVALID_ROOT' }),
    ]);
    expect(rejected([])).toEqual([
      expect.objectContaining({ path: '', code: 'INVALID_ROOT' }),
    ]);
    expect(rejected({ attachedTo: [] })).toEqual([
      expect.objectContaining({ path: '/attachedTo', code: 'INVALID_TYPE' }),
    ]);
  });

  it('rejects accessors without executing them', () => {
    let executed = false;
    const target = { kind: 'object', objectId: 'PC-1:0' };
    Object.defineProperty(target, 'objectId', {
      enumerable: true,
      configurable: true,
      get: () => {
        executed = true;
        return 'PC-1:0';
      },
    });

    const issues = rejected({ attachedTo: target });
    expect(executed).toBe(false);
    expect(issues.some((issue) => issue.code === 'INVALID_TYPE')).toBe(true);
  });

  it('rejects non-enumerable and symbol fields without reading them', () => {
    const target = validObjectTarget();
    Object.defineProperty(target, 'hidden', {
      configurable: true,
      enumerable: false,
      value: true,
    });
    const symbol = Symbol('extra');
    Object.defineProperty(target, symbol, {
      configurable: true,
      enumerable: true,
      value: true,
    });
    const issues = rejected({ attachedTo: target });
    expect(issues.some((issue) => issue.code === 'UNKNOWN_FIELD')).toBe(true);
    expect(issues.map((issue) => issue.path)).toEqual([
      '/attachedTo/Symbol(extra)',
      '/attachedTo/hidden',
    ]);
  });

  it('does not mutate input and returns separately allocated frozen output', () => {
    const input = { attachedTo: validObjectTarget() };
    const before = JSON.stringify(input);
    const value = accepted(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(value).not.toBe(input);
    expect(value.attachedTo).not.toBe(input.attachedTo);
    expect(Object.isFrozen(value)).toBe(true);
    expect(value.attachedTo).not.toBeNull();
    if (value.attachedTo !== null) expect(Object.isFrozen(value.attachedTo)).toBe(true);
  });

  it('preserves JSON round trips and factory/validator parity', () => {
    const input = { attachedTo: validPlayerTarget() };
    const direct = accepted(input);
    const roundTrip = accepted(JSON.parse(JSON.stringify(direct)) as unknown);
    const factory = createCoreAttachmentStateV1(input);

    expect(JSON.stringify(roundTrip)).toBe(JSON.stringify(direct));
    expect(JSON.stringify(factory)).toBe(JSON.stringify(direct));
    expect(factory).not.toBe(input);

    const invalid = { attachedTo: { kind: 'player', playerId: 'bad:id' } };
    const validation = validateCoreAttachmentStateV1(invalid);
    expect(validation.ok).toBe(false);
    expect(() => createCoreAttachmentStateV1(invalid)).toThrow(CoreAttachmentCreationError);
    try {
      createCoreAttachmentStateV1(invalid);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CoreAttachmentCreationError);
      if (error instanceof CoreAttachmentCreationError && !validation.ok) {
        expect(error.issues).toEqual(validation.issues);
      }
    }
  });

  it('uses the fixed field order for root and both union branches', () => {
    expect(Object.keys(accepted({ attachedTo: null }))).toEqual(['attachedTo']);
    const objectTarget = accepted({ attachedTo: validObjectTarget() }).attachedTo;
    if (objectTarget === null) throw new Error('expected object target');
    expect(Object.keys(objectTarget)).toEqual(['kind', 'objectId']);

    const playerTarget = accepted({ attachedTo: validPlayerTarget() }).attachedTo;
    if (playerTarget === null) throw new Error('expected player target');
    expect(Object.keys(playerTarget)).toEqual(['kind', 'playerId']);
  });

  it('returns all independent issues in path then code-unit order', () => {
    const issues = rejected({
      attachedTo: {
        kind: 'object',
        objectId: 'PC-1:01',
        playerId: 'P1',
      },
      extra: true,
    });

    expect(issues.map((issue) => `${issue.path}:${issue.code}`)).toEqual([
      '/attachedTo/objectId:INVALID_ID',
      '/attachedTo/playerId:UNKNOWN_FIELD',
      '/extra:UNKNOWN_FIELD',
    ]);
  });

  it('uses unknown guards for invalid values', () => {
    const source = readFileSync(new URL('../attachment.ts', import.meta.url), 'utf8');
    const explicitTypeToken = String.fromCharCode(97, 110, 121);
    expect(source).not.toMatch(new RegExp(`\\b${explicitTypeToken}\\b`));
  });
});
