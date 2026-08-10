import { describe, expect, it } from 'vitest';

import {
  createCoreStackChoiceKeyV1,
  createCoreStackTargetRefV1,
  validateCoreStackChoiceKeyV1,
  validateCoreStackTargetRefV1,
} from '../announcementPrimitivesV1';

describe('O4P-01I-E announcement primitives', () => {
  it('accepts valid and historical choice keys, and rejects unsafe keys', () => {
    for (const key of ['X', 'mode.alpha-1', 'a'.repeat(128)]) {
      expect(validateCoreStackChoiceKeyV1(key)).toEqual({ ok: true, value: key });
    }
    for (const key of ['', '1 bad', ':', '/x', 'a'.repeat(129), '__proto__', 'constructor', 'prototype']) {
    expect(validateCoreStackChoiceKeyV1(key).ok).toBe(false);
    }
    expect(createCoreStackChoiceKeyV1('X')).toBe('X');
  });

  it('accepts object and player targets, including historical refs', () => {
    const objectResult = validateCoreStackTargetRefV1({ kind: 'object', objectId: 'PC1:0' });
    const historicalObjectResult = validateCoreStackTargetRefV1({
      kind: 'object',
      objectId: '@spell-copy:historical-target',
    });
    const playerResult = validateCoreStackTargetRefV1({ kind: 'player', playerId: 'P99' });
    expect(objectResult.ok).toBe(true);
    expect(historicalObjectResult.ok).toBe(true);
    expect(playerResult.ok).toBe(true);
    if (objectResult.ok) expect(Object.isFrozen(objectResult.value)).toBe(true);
    if (playerResult.ok) expect(Object.isFrozen(playerResult.value)).toBe(true);
  });

  it('fails closed for malformed records and unsafe descriptors', () => {
    expect(validateCoreStackTargetRefV1(null).ok).toBe(false);
    expect(validateCoreStackTargetRefV1(new Date()).ok).toBe(false);
    expect(validateCoreStackTargetRefV1({ kind: 'object', objectId: 'not-an-object-id' }).ok).toBe(false);
    const accessor: Record<string, unknown> = { kind: 'player', playerId: 'P1' };
    Object.defineProperty(accessor, 'playerId', { enumerable: true, get: () => 'P2' });
    expect(validateCoreStackTargetRefV1(accessor).ok).toBe(false);
    const hidden: Record<string, unknown> = { kind: 'player', playerId: 'P1' };
    Object.defineProperty(hidden, 'playerId', { value: 'P1', enumerable: false });
    expect(validateCoreStackTargetRefV1(hidden).ok).toBe(false);
    const symbol = Symbol('target');
    const withSymbol: Record<string | symbol, unknown> = { kind: 'player', playerId: 'P1' };
    withSymbol[symbol] = true;
    expect(validateCoreStackTargetRefV1(withSymbol).ok).toBe(false);
  });

  it('preserves input and returns fresh deeply frozen values', () => {
    const input = { kind: 'object', objectId: 'PC1:0' };
    const before = JSON.stringify(input);
    const first = createCoreStackTargetRefV1(input);
    const second = createCoreStackTargetRefV1(input);
    expect(first).not.toBe(input);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(() => { (first as { kind: string }).kind = 'player'; }).toThrow();
  });
});
