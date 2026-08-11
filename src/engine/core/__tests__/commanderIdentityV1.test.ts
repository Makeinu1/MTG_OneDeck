import { describe, expect, it } from 'vitest';
import {
  CoreCommanderIdentityCreationErrorV1,
  createCoreCommanderIdentityV1,
} from '../commander/commanderIdentityV1';

describe('createCoreCommanderIdentityV1', () => {
  it('creates a frozen physical identity without changing the input', () => {
    const input = { physicalCardId: 'card-1', ownerPlayerId: 'player-1' };
    const before = { ...input };

    const identity = createCoreCommanderIdentityV1(input);

    expect(identity).toEqual(before);
    expect(input).toEqual(before);
    expect(Object.isFrozen(identity)).toBe(true);
  });

  it.each([
    { physicalCardId: '', ownerPlayerId: 'player-1' },
    { physicalCardId: 'card-1', ownerPlayerId: '' },
    { physicalCardId: 'bad id', ownerPlayerId: 'player-1' },
    { physicalCardId: 'card-1', ownerPlayerId: 42 },
  ])('rejects invalid IDs: %s', (input) => {
    expect(() => createCoreCommanderIdentityV1(input)).toThrow(CoreCommanderIdentityCreationErrorV1);
  });

  it.each([
    null,
    { physicalCardId: 'card-1' },
    { ownerPlayerId: 'player-1' },
    { physicalCardId: 'card-1', ownerPlayerId: 'player-1', extra: true },
  ])('rejects invalid root or exact-key violations: %s', (input) => {
    expect(() => createCoreCommanderIdentityV1(input)).toThrow(CoreCommanderIdentityCreationErrorV1);
  });

  it('rejects symbols, accessors, and non-enumerable fields without executing accessors', () => {
    const symbol = Symbol('extra');
    let accessed = false;
    const input: Record<string | symbol, unknown> = {
      physicalCardId: 'card-1',
      ownerPlayerId: 'player-1',
    };
    Object.defineProperty(input, 'physicalCardId', {
      enumerable: true,
      get: () => {
        accessed = true;
        return 'card-1';
      },
    });
    Object.defineProperty(input, 'hidden', { enumerable: false, value: true });
    input[symbol] = true;

    expect(() => createCoreCommanderIdentityV1(input)).toThrow(CoreCommanderIdentityCreationErrorV1);
    expect(accessed).toBe(false);
  });

  it('returns deterministic frozen issues and a frozen error', () => {
    let thrown: unknown;
    try {
      createCoreCommanderIdentityV1({ ownerPlayerId: 7, extra: true });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CoreCommanderIdentityCreationErrorV1);
    const error = thrown as CoreCommanderIdentityCreationErrorV1;
    expect(error.issues.map((current) => `${current.path}|${current.code}`)).toEqual([
      '/extra|UNKNOWN_FIELD',
      '/ownerPlayerId|INVALID_TYPE',
      '/physicalCardId|MISSING_FIELD',
    ]);
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.issues)).toBe(true);
    expect(error.issues.every((current) => Object.isFrozen(current))).toBe(true);
  });

  it.each([
    { getPrototypeOf: () => { throw new Error('prototype trap'); } },
    { ownKeys: () => { throw new Error('ownKeys trap'); } },
    { getOwnPropertyDescriptor: () => { throw new Error('descriptor trap'); } },
  ])('converts object inspection traps into a frozen typed error: %j', (handler) => {
    const target = { physicalCardId: 'card-1', ownerPlayerId: 'player-1' };
    const input = new Proxy(target, handler);

    expect(() => createCoreCommanderIdentityV1(input)).toThrow(CoreCommanderIdentityCreationErrorV1);
    try {
      createCoreCommanderIdentityV1(input);
      expect.fail('expected typed inspection error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderIdentityCreationErrorV1);
      expect(Object.isFrozen(error)).toBe(true);
      if (error instanceof CoreCommanderIdentityCreationErrorV1) {
        expect(Object.isFrozen(error.issues)).toBe(true);
        expect(error.issues.every((current) => Object.isFrozen(current))).toBe(true);
      }
    }
  });
});
