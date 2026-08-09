import { describe, expect, it } from 'vitest';

import {
  coreActivatedAbilityObjectIdOfV2,
  coreSpellCopyObjectIdOfV2,
  coreTokenObjectIdOfV2,
  coreTriggeredAbilityObjectIdOfV2,
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
} from '../objectIdV2';

function parsed(value: unknown) {
  const result = parseCoreObjectIdV2(value);
  expect(result).not.toBeNull();
  if (result === null) throw new Error('expected a parsed object ID');
  return result;
}

describe('Core universal object ID V2', () => {
  it('parses the card and all synthetic branches', () => {
    expect(parsed('PC-1:0')).toEqual({
      kind: 'card',
      physicalCardId: 'PC-1',
      incarnation: 0,
    });
    expect(parsed('@token:token-1:2')).toEqual({
      kind: 'token',
      seed: 'token-1',
      incarnation: 2,
    });
    expect(parsed('@spell-copy:copy-1')).toEqual({ kind: 'spell-copy', seed: 'copy-1' });
    expect(parsed('@activated-ability:ability-1')).toEqual({
      kind: 'activated-ability',
      seed: 'ability-1',
    });
    expect(parsed('@triggered-ability:trigger-1')).toEqual({
      kind: 'triggered-ability',
      seed: 'trigger-1',
    });
  });

  it('formats every synthetic branch canonically and round-trips through the parser', () => {
    const ids = [
      coreTokenObjectIdOfV2('token-1', 0),
      coreSpellCopyObjectIdOfV2('copy-1'),
      coreActivatedAbilityObjectIdOfV2('ability-1'),
      coreTriggeredAbilityObjectIdOfV2('trigger-1'),
    ];

    expect(ids).toEqual([
      '@token:token-1:0',
      '@spell-copy:copy-1',
      '@activated-ability:ability-1',
      '@triggered-ability:trigger-1',
    ]);
    for (const id of ids) {
      expect(isCanonicalCoreObjectIdV2(id)).toBe(true);
      expect(parseCoreObjectIdV2(id)).not.toBeNull();
    }
  });

  it('preserves the card bytes and separates synthetic IDs from card IDs', () => {
    const cardId = 'physical.card-01:9007199254740991';
    expect(isCanonicalCoreObjectIdV2(cardId)).toBe(true);
    expect(parsed(cardId)).toEqual({
      kind: 'card',
      physicalCardId: 'physical.card-01',
      incarnation: Number.MAX_SAFE_INTEGER,
    });

    const tokenId = coreTokenObjectIdOfV2('physical.card-01', Number.MAX_SAFE_INTEGER);
    expect(tokenId).not.toBe(cardId);
    expect(isCanonicalCoreObjectIdV2('@physical.card-01:0')).toBe(false);
  });

  it('accepts numeric-like seeds as literal seed text', () => {
    expect(parsed('@token:01:0')).toEqual({ kind: 'token', seed: '01', incarnation: 0 });
    expect(parsed('@spell-copy:1e3')).toEqual({ kind: 'spell-copy', seed: '1e3' });
    expect(parsed('@activated-ability:000')).toEqual({ kind: 'activated-ability', seed: '000' });
    expect(parsed('@triggered-ability:0.5')).toEqual({ kind: 'triggered-ability', seed: '0.5' });
  });

  it.each([
    ['not a string', null],
    ['card without separator', 'PC-1'],
    ['card with extra separator', 'PC-1:0:1'],
    ['card with leading-zero incarnation', 'PC-1:01'],
    ['card with signed incarnation', 'PC-1:+1'],
    ['card with decimal incarnation', 'PC-1:1.0'],
    ['card with exponent incarnation', 'PC-1:1e3'],
    ['card with unsafe incarnation', 'PC-1:9007199254740992'],
    ['token without incarnation', '@token:seed'],
    ['token with empty seed', '@token::0'],
    ['token with extra separator', '@token:seed:0:1'],
    ['spell copy with empty seed', '@spell-copy:'],
    ['spell copy with extra separator', '@spell-copy:seed:0'],
    ['unknown synthetic key', '@future:seed'],
    ['seed with whitespace', '@token:seed value:0'],
    ['seed with slash', '@token:seed/value:0'],
    ['seed with at-sign', '@token:seed@value:0'],
    ['seed with non-ASCII text', '@token:シード:0'],
    ['overlong seed', `@token:${'a'.repeat(129)}:0`],
  ])('rejects %s', (_label, value) => {
    expect(parseCoreObjectIdV2(value)).toBeNull();
    expect(isCanonicalCoreObjectIdV2(value)).toBe(false);
  });

  it('rejects invalid factory seeds and incarnations without normalizing input', () => {
    const seed = ' seed ';
    expect(() => coreTokenObjectIdOfV2(seed, 0)).toThrow(TypeError);
    expect(() => coreSpellCopyObjectIdOfV2(seed)).toThrow(TypeError);
    expect(() => coreActivatedAbilityObjectIdOfV2(seed)).toThrow(TypeError);
    expect(() => coreTriggeredAbilityObjectIdOfV2(seed)).toThrow(TypeError);
    expect(() => coreTokenObjectIdOfV2('seed', -1)).toThrow(TypeError);
    expect(() => coreTokenObjectIdOfV2('seed', -0)).toThrow(TypeError);
    expect(() => coreTokenObjectIdOfV2('seed', 1.5)).toThrow(TypeError);
    expect(() => coreTokenObjectIdOfV2('seed', Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
    expect(seed).toBe(' seed ');
  });

  it('does not execute accessors or mutate non-string inputs', () => {
    let executed = false;
    const input = {};
    Object.defineProperty(input, 'toString', {
      enumerable: true,
      configurable: true,
      get: () => {
        executed = true;
        return () => '@token:seed:0';
      },
    });
    const keysBefore = Reflect.ownKeys(input);
    expect(parseCoreObjectIdV2(input)).toBeNull();
    expect(Reflect.ownKeys(input)).toEqual(keysBefore);
    expect(executed).toBe(false);
  });
});
