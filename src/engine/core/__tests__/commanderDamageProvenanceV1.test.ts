import { describe, expect, it } from 'vitest';
import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../ids';
import {
  CoreCommanderProvenanceCreationErrorV1,
  CoreCommanderProvenanceQueryErrorV1,
  CoreCommanderProvenanceRecordingErrorV1,
  coreCommanderProvenanceDamageAgainstV1,
  coreCommanderThresholdReachedFromProvenanceV1,
  createCoreCommanderDamageProvenanceLedgerV1,
  recordCoreCommanderDamageProvenanceV1,
} from '../commander/commanderDamageProvenanceV1';

const C1 = 'commander-a' as CorePhysicalCardId;
const C2 = 'commander-b' as CorePhysicalCardId;
const P1 = 'player-1' as CorePlayerId;
const P2 = 'player-2' as CorePlayerId;
const O11 = 'combat-a:0' as CoreObjectId;
const O12 = 'combat-b:0' as CoreObjectId;
const O21 = 'combat-c:0' as CoreObjectId;
const O31 = 'combat-d:0' as CoreObjectId;
const O41 = 'combat-e:0' as CoreObjectId;

const identity = (physicalCardId: CorePhysicalCardId, ownerPlayerId: CorePlayerId) => ({
  physicalCardId,
  ownerPlayerId,
});

const record = (
  combatObjectId: CoreObjectId,
  commanderPhysicalCardId: CorePhysicalCardId,
  defendingPlayerId: CorePlayerId,
  damage: number,
) => ({ combatObjectId, commanderPhysicalCardId, defendingPlayerId, damage });

const inputLedger = () => ({
  commanders: [identity(C1, P1), identity(C2, P2)],
  defendingPlayerIds: [P2, P1],
  records: [
    record(O11, C1, P1, 10),
    record(O12, C1, P1, 11),
    record(O21, C1, P2, 3),
    record(O31, C2, P1, 20),
    record(O41, C2, P2, 21),
  ],
});

function expectTypedError<T extends Error>(call: () => unknown, type: new (...args: never[]) => T, code: string): void {
  try {
    call();
    expect.fail('expected typed provenance error');
  } catch (error) {
    expect(error).toBeInstanceOf(type);
    expect(Object.isFrozen(error)).toBe(true);
    if (error instanceof type) {
      const typed = error as T & { readonly issues: readonly { readonly code: string }[] };
      expect(Object.isFrozen(typed.issues)).toBe(true);
      expect(typed.issues.every(Object.isFrozen)).toBe(true);
      expect(typed.issues.map((issue) => issue.code)).toContain(code);
    }
  }
}

function expectDeepFrozen(value: unknown): void {
  expect(Object.isFrozen(value)).toBe(true);
  if (Array.isArray(value)) {
    value.forEach(expectDeepFrozen);
  } else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(expectDeepFrozen);
  }
}

describe('commanderDamageProvenanceV1', () => {
  it('sums provenance records per commander/defender pair and reaches 21 independently', () => {
    const state = createCoreCommanderDamageProvenanceLedgerV1(inputLedger());

    expect(state.records).toEqual([
      record(O11, C1, P1, 10),
      record(O12, C1, P1, 11),
      record(O21, C1, P2, 3),
      record(O31, C2, P1, 20),
      record(O41, C2, P2, 21),
    ]);
    expect(coreCommanderProvenanceDamageAgainstV1(state, C1, P1)).toBe(21);
    expect(coreCommanderProvenanceDamageAgainstV1(state, C1, P2)).toBe(3);
    expect(coreCommanderProvenanceDamageAgainstV1(state, C2, P1)).toBe(20);
    expect(coreCommanderProvenanceDamageAgainstV1(state, C2, P2)).toBe(21);
    expect(coreCommanderThresholdReachedFromProvenanceV1(state, C1, P1)).toBe(true);
    expect(coreCommanderThresholdReachedFromProvenanceV1(state, C1, P2)).toBe(false);
    expect(coreCommanderThresholdReachedFromProvenanceV1(state, C2, P1)).toBe(false);
    expect(coreCommanderThresholdReachedFromProvenanceV1(state, C2, P2)).toBe(true);
    expect(JSON.stringify(state)).not.toMatch(/network|session|connection|disconnect|sba/i);
  });

  it('preserves zero records and order, then appends a new distinct provenance record', () => {
    const emptyInput = {
      commanders: [identity(C1, P1), identity(C2, P2)],
      defendingPlayerIds: [P1, P2],
      records: [],
    };
    const empty = createCoreCommanderDamageProvenanceLedgerV1(emptyInput);
    const appended = recordCoreCommanderDamageProvenanceV1(empty, record(O11, C1, P1, 0));
    const next = recordCoreCommanderDamageProvenanceV1(appended, record(O12, C1, P1, 4));

    expect(empty.records).toEqual([]);
    expect(next.records).toEqual([record(O11, C1, P1, 0), record(O12, C1, P1, 4)]);
    expect(coreCommanderProvenanceDamageAgainstV1(next, C1, P1)).toBe(4);
  });

  it('normalizes mutable input without mutation and deeply freezes state, records, and errors', () => {
    const input = inputLedger();
    const before = structuredClone(input);
    const state = createCoreCommanderDamageProvenanceLedgerV1(input);
    const next = recordCoreCommanderDamageProvenanceV1(state, record('combat-f:0' as CoreObjectId, C2, P2, 1));

    expect(input).toEqual(before);
    expect(state).not.toBe(input);
    expect(next).not.toBe(state);
    expectDeepFrozen(state);
    expectDeepFrozen(next);
    expect(Object.keys(next)).toEqual(['commanders', 'defendingPlayerIds', 'records']);
    expect(Object.keys(next.records[0])).toEqual([
      'combatObjectId', 'commanderPhysicalCardId', 'defendingPlayerId', 'damage',
    ]);
  });

  it('rejects invalid creation data, including duplicate triples and unregistered or invalid values', () => {
    expectTypedError(
      () => createCoreCommanderDamageProvenanceLedgerV1({ ...inputLedger(), records: [record(O11, C1, P1, 1), record(O11, C1, P1, 2)] }),
      CoreCommanderProvenanceCreationErrorV1,
      'DUPLICATE_RECORD',
    );
    expectTypedError(
      () => createCoreCommanderDamageProvenanceLedgerV1({ ...inputLedger(), records: [record(O11, 'missing-commander' as CorePhysicalCardId, P1, 1)] }),
      CoreCommanderProvenanceCreationErrorV1,
      'UNREGISTERED_COMMANDER',
    );
    expectTypedError(
      () => createCoreCommanderDamageProvenanceLedgerV1({ ...inputLedger(), records: [record(O11, C1, 'missing-player' as CorePlayerId, 1)] }),
      CoreCommanderProvenanceCreationErrorV1,
      'UNREGISTERED_DEFENDING_PLAYER',
    );
    expectTypedError(
      () => createCoreCommanderDamageProvenanceLedgerV1({ ...inputLedger(), records: [record('unregistered-object' as CoreObjectId, C1, P1, 1)] }),
      CoreCommanderProvenanceCreationErrorV1,
      'INVALID_ID',
    );
    for (const damage of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectTypedError(
        () => createCoreCommanderDamageProvenanceLedgerV1({ ...inputLedger(), records: [record(O11, C1, P1, damage)] }),
        CoreCommanderProvenanceCreationErrorV1,
        'INVALID_DAMAGE',
      );
    }
  });

  it('rejects recording and querying errors with their dedicated frozen types', () => {
    const state = createCoreCommanderDamageProvenanceLedgerV1({
      commanders: [identity(C1, P1)],
      defendingPlayerIds: [P1],
      records: [record(O11, C1, P1, 1)],
    });
    expectTypedError(
      () => recordCoreCommanderDamageProvenanceV1(state, record(O11, C1, P1, 1)),
      CoreCommanderProvenanceRecordingErrorV1,
      'DUPLICATE_RECORD',
    );
    expectTypedError(
      () => recordCoreCommanderDamageProvenanceV1(state, record(O12, C1, P1, -1)),
      CoreCommanderProvenanceRecordingErrorV1,
      'INVALID_DAMAGE',
    );
    expectTypedError(
      () => coreCommanderProvenanceDamageAgainstV1(state, 'missing-commander', P1),
      CoreCommanderProvenanceQueryErrorV1,
      'UNREGISTERED_COMMANDER',
    );
    expectTypedError(
      () => coreCommanderThresholdReachedFromProvenanceV1(state, C1, 'missing-player'),
      CoreCommanderProvenanceQueryErrorV1,
      'UNREGISTERED_DEFENDING_PLAYER',
    );
  });

  it('rejects negative zero in creation, normalization, and recording while accepting positive zero', () => {
    expect(() => createCoreCommanderDamageProvenanceLedgerV1({
      commanders: [identity(C1, P1)],
      defendingPlayerIds: [P1],
      records: [record(O11, C1, P1, -0)],
    })).toThrow(CoreCommanderProvenanceCreationErrorV1);

    const zero = createCoreCommanderDamageProvenanceLedgerV1({
      commanders: [identity(C1, P1)],
      defendingPlayerIds: [P1],
      records: [],
    });
    const recordedZero = recordCoreCommanderDamageProvenanceV1(zero, record(O11, C1, P1, 0));
    expect(Object.is(recordedZero.records[0].damage, 0)).toBe(true);
    expect(() => recordCoreCommanderDamageProvenanceV1(zero, record(O11, C1, P1, -0)))
      .toThrow(CoreCommanderProvenanceRecordingErrorV1);
    expect(() => recordCoreCommanderDamageProvenanceV1({
      commanders: [identity(C1, P1)],
      defendingPlayerIds: [P1],
      records: [record(O11, C1, P1, -0)],
    }, record(O12, C1, P1, 1))).toThrow(CoreCommanderProvenanceCreationErrorV1);
  });

  it('rejects cumulative overflow from distinct provenance records in one cell', () => {
    const input = {
      commanders: [identity(C1, P1)],
      defendingPlayerIds: [P1],
      records: [
        record(O11, C1, P1, Number.MAX_SAFE_INTEGER),
        record(O12, C1, P1, 1),
      ],
    };
    const before = structuredClone(input);

    try {
      createCoreCommanderDamageProvenanceLedgerV1(input);
      expect.fail('expected cumulative provenance overflow');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderProvenanceCreationErrorV1);
      if (error instanceof CoreCommanderProvenanceCreationErrorV1) {
        expect(error.issues).toContainEqual({
          code: 'DAMAGE_OVERFLOW',
          path: '/records/1/damage',
          message: 'Damage total exceeds the safe integer range',
        });
        expect(Object.isFrozen(error)).toBe(true);
        expect(Object.isFrozen(error.issues)).toBe(true);
        expect(error.issues.every(Object.isFrozen)).toBe(true);
      }
    }
    expect(input).toEqual(before);
    expect(() => coreCommanderProvenanceDamageAgainstV1(input, C1, P1))
      .toThrow(CoreCommanderProvenanceCreationErrorV1);
    expect(input).toEqual(before);
  });

  it('rejects recording overflow in the target cell without changing the state', () => {
    const state = createCoreCommanderDamageProvenanceLedgerV1({
      commanders: [identity(C1, P1)],
      defendingPlayerIds: [P1],
      records: [record(O11, C1, P1, Number.MAX_SAFE_INTEGER)],
    });
    const before = structuredClone(state);

    try {
      recordCoreCommanderDamageProvenanceV1(state, record(O12, C1, P1, 1));
      expect.fail('expected target-cell provenance overflow');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderProvenanceRecordingErrorV1);
      if (error instanceof CoreCommanderProvenanceRecordingErrorV1) {
        expect(error.issues).toEqual([{
          code: 'DAMAGE_OVERFLOW',
          path: '/damage',
          message: 'Damage total exceeds the safe integer range',
        }]);
        expect(Object.isFrozen(error)).toBe(true);
        expect(Object.isFrozen(error.issues)).toBe(true);
        expect(error.issues.every(Object.isFrozen)).toBe(true);
      }
    }
    expect(state).toEqual(before);
  });

  it('accepts a safe record in another cell when an unrelated cell is at the maximum', () => {
    const state = createCoreCommanderDamageProvenanceLedgerV1({
      commanders: [identity(C1, P1), identity(C2, P2)],
      defendingPlayerIds: [P1, P2],
      records: [record(O11, C1, P1, Number.MAX_SAFE_INTEGER)],
    });
    const next = recordCoreCommanderDamageProvenanceV1(state, record(O21, C2, P2, 1));

    expect(coreCommanderProvenanceDamageAgainstV1(next, C1, P1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(coreCommanderProvenanceDamageAgainstV1(next, C2, P2)).toBe(1);
    expect(Number.isSafeInteger(coreCommanderProvenanceDamageAgainstV1(next, C1, P1))).toBe(true);
    expect(Number.isSafeInteger(coreCommanderProvenanceDamageAgainstV1(next, C2, P2))).toBe(true);
    expect(next.records).toEqual([
      record(O11, C1, P1, Number.MAX_SAFE_INTEGER),
      record(O21, C2, P2, 1),
    ]);
  });

  it('rejects sparse and accessor arrays without reading an accessor element', () => {
    const sparse: Array<ReturnType<typeof identity>> = [];
    sparse.length = 1;
    expect(() => createCoreCommanderDamageProvenanceLedgerV1({
      commanders: sparse,
      defendingPlayerIds: [P1],
      records: [],
    })).toThrow(CoreCommanderProvenanceCreationErrorV1);

    let accessed = 0;
    const accessorArray = [identity(C1, P1)];
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      get: () => {
        accessed += 1;
        return identity(C1, P1);
      },
    });
    expect(() => createCoreCommanderDamageProvenanceLedgerV1({
      commanders: accessorArray,
      defendingPlayerIds: [P1],
      records: [],
    })).toThrow(CoreCommanderProvenanceCreationErrorV1);
    expect(accessed).toBe(0);
  });

  it('rejects non-enumerable indices, symbols, and non-index own properties', () => {
    const hiddenIndex = [P1];
    Object.defineProperty(hiddenIndex, '0', { enumerable: false, value: P1 });
    expect(() => createCoreCommanderDamageProvenanceLedgerV1({
      commanders: [identity(C1, P1)],
      defendingPlayerIds: hiddenIndex,
      records: [],
    })).toThrow(CoreCommanderProvenanceCreationErrorV1);

    const decorated = [P1] as Array<CorePlayerId> & { extra?: boolean; [key: symbol]: boolean };
    const symbol = Symbol('extra');
    Object.defineProperty(decorated, 'extra', { enumerable: true, value: true });
    decorated[symbol] = true;
    expect(() => createCoreCommanderDamageProvenanceLedgerV1({
      commanders: [identity(C1, P1)],
      defendingPlayerIds: decorated,
      records: [],
    })).toThrow(CoreCommanderProvenanceCreationErrorV1);
  });

  it.each([
    { getPrototypeOf: () => { throw new Error('prototype trap'); } },
    { ownKeys: () => { throw new Error('ownKeys trap'); } },
    { getOwnPropertyDescriptor: () => { throw new Error('descriptor trap'); } },
  ])('converts array inspection traps into a frozen typed error: %j', (handler) => {
    const target = [P1];
    const input = new Proxy(target, handler);

    try {
      createCoreCommanderDamageProvenanceLedgerV1({
        commanders: [identity(C1, P1)],
        defendingPlayerIds: input,
        records: [],
      });
      expect.fail('expected typed array inspection error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderProvenanceCreationErrorV1);
      expect(Object.isFrozen(error)).toBe(true);
      if (error instanceof CoreCommanderProvenanceCreationErrorV1) {
        expect(Object.isFrozen(error.issues)).toBe(true);
        expect(error.issues.every((current) => Object.isFrozen(current))).toBe(true);
      }
    }
  });
});
