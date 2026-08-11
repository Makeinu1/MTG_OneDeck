import { describe, expect, it } from 'vitest';
import {
  CoreCommanderCastLedgerCreationErrorV1,
  CoreCommanderCastRecordingErrorV1,
  coreCommanderTaxV1,
  createCoreCommanderCastLedgerV1,
  recordCoreCommanderCastV1,
} from '../commander/commanderTaxV1';
import { createCoreCommanderIdentityV1 } from '../commander/commanderIdentityV1';

const identity = { physicalCardId: 'card-1', ownerPlayerId: 'player-1' };

describe('Commander cast ledger V1', () => {
  it('starts at zero, records command-zone casts, and computes tax', () => {
    const ledger = createCoreCommanderCastLedgerV1({ commander: identity, castCount: 0 });
    const recorded = recordCoreCommanderCastV1(ledger, { origin: 'command-zone' });

    expect(ledger.castCount).toBe(0);
    expect(recorded.castCount).toBe(1);
    expect(coreCommanderTaxV1(recorded)).toBe(2);
  });

  it.each(['other-zone', 'copy'] as const)('rejects %s without changing the ledger', (origin) => {
    const ledger = createCoreCommanderCastLedgerV1({ commander: identity, castCount: 0 });

    expect(() => recordCoreCommanderCastV1(ledger, { origin })).toThrow(CoreCommanderCastRecordingErrorV1);
    expect(ledger).toEqual({ commander: identity, castCount: 0 });
  });

  it.each([
    null,
    { commander: identity, castCount: -1 },
    { commander: identity, castCount: -0 },
    { commander: identity, castCount: 1.5 },
    { commander: identity, castCount: Number.MAX_SAFE_INTEGER },
    { commander: { physicalCardId: 'bad id', ownerPlayerId: 'player-1' }, castCount: 0 },
    { commander: identity, castCount: 0, extra: true },
  ])('rejects invalid ledger input: %s', (value) => {
    expect(() => createCoreCommanderCastLedgerV1(value)).toThrow(CoreCommanderCastLedgerCreationErrorV1);
  });

  it('accepts canonical positive zero and rejects negative zero during normalization', () => {
    const ledger = createCoreCommanderCastLedgerV1({ commander: identity, castCount: 0 });
    const commander = createCoreCommanderIdentityV1(identity);
    const forgedLedger = { commander, castCount: -0 };
    expect(Object.is(ledger.castCount, 0)).toBe(true);
    expect(() => recordCoreCommanderCastV1(forgedLedger, { origin: 'command-zone' }))
      .toThrow(CoreCommanderCastLedgerCreationErrorV1);
    expect(() => coreCommanderTaxV1(forgedLedger))
      .toThrow(CoreCommanderCastLedgerCreationErrorV1);
  });

  it('rejects accessors and non-enumerable fields without reading accessors', () => {
    let accessed = false;
    const value: Record<string, unknown> = { commander: identity, castCount: 0 };
    Object.defineProperty(value, 'castCount', {
      enumerable: true,
      get: () => {
        accessed = true;
        return 0;
      },
    });
    Object.defineProperty(value, 'hidden', { enumerable: false, value: true });

    expect(() => createCoreCommanderCastLedgerV1(value)).toThrow(CoreCommanderCastLedgerCreationErrorV1);
    expect(accessed).toBe(false);
  });

  it('does not mutate inputs and freezes successful values and errors', () => {
    const input = { commander: { ...identity }, castCount: 0 };
    const before = JSON.stringify(input);
    const ledger = createCoreCommanderCastLedgerV1(input);
    const recorded = recordCoreCommanderCastV1(ledger, { origin: 'command-zone' });

    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(ledger)).toBe(true);
    expect(Object.isFrozen(ledger.commander)).toBe(true);
    expect(Object.isFrozen(recorded)).toBe(true);

    let thrown: unknown;
    try {
      createCoreCommanderCastLedgerV1({ commander: identity, castCount: -1 });
    } catch (error) {
      thrown = error;
    }
    const error = thrown as CoreCommanderCastLedgerCreationErrorV1;
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.issues)).toBe(true);
    expect(error.issues.every((current) => Object.isFrozen(current))).toBe(true);
  });

  it.each([
    { getPrototypeOf: () => { throw new Error('prototype trap'); } },
    { ownKeys: () => { throw new Error('ownKeys trap'); } },
    { getOwnPropertyDescriptor: () => { throw new Error('descriptor trap'); } },
  ])('converts ledger inspection traps into a frozen typed error: %j', (handler) => {
    const target = { commander: identity, castCount: 0 };
    const input = new Proxy(target, handler);

    try {
      createCoreCommanderCastLedgerV1(input);
      expect.fail('expected typed inspection error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderCastLedgerCreationErrorV1);
      expect(Object.isFrozen(error)).toBe(true);
      if (error instanceof CoreCommanderCastLedgerCreationErrorV1) {
        expect(Object.isFrozen(error.issues)).toBe(true);
        expect(error.issues.every((current) => Object.isFrozen(current))).toBe(true);
      }
    }
  });
});
