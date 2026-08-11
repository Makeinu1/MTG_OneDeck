import { describe, expect, it } from 'vitest';
import type { CorePhysicalCardId, CorePlayerId } from '../ids';
import {
  CoreCommanderDamageCreationErrorV1,
  CoreCommanderDamageRecordingErrorV1,
  createCoreCommanderDamageStateV1,
  coreCommanderDamageAgainstV1,
  recordCoreCommanderDamageV1,
} from '../commander/commanderDamageV1';

const C1 = 'commander-1' as CorePhysicalCardId;
const C2 = 'commander-2' as CorePhysicalCardId;
const P1 = 'player-1' as CorePlayerId;
const P2 = 'player-2' as CorePlayerId;

const identities = [
  { physicalCardId: C1, ownerPlayerId: P1 },
  { physicalCardId: C2, ownerPlayerId: P2 },
];

describe('commanderDamageV1', () => {
  it('keeps two commanders and two defending players in separate matrix cells', () => {
    const state = createCoreCommanderDamageStateV1({ commanders: identities, defendingPlayerIds: [P1, P2], entries: [] });
    const next = recordCoreCommanderDamageV1(
      recordCoreCommanderDamageV1(
        recordCoreCommanderDamageV1(state, { commanderPhysicalCardId: C1, defendingPlayerId: P2, damage: 7 }),
        { commanderPhysicalCardId: C2, defendingPlayerId: P1, damage: 9 },
      ),
      { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: 3 },
    );
    expect(coreCommanderDamageAgainstV1(next, C1, P1)).toBe(3);
    expect(coreCommanderDamageAgainstV1(next, C1, P2)).toBe(7);
    expect(coreCommanderDamageAgainstV1(next, C2, P1)).toBe(9);
    expect(coreCommanderDamageAgainstV1(next, C2, P2)).toBe(0);
    expect(next.entries.map((entry) => [entry.commanderPhysicalCardId, entry.defendingPlayerId])).toEqual([
      [C1, P2], [C2, P1], [C1, P1],
    ]);
  });

  it('rejects invalid registrations, IDs, and damage values', () => {
    expect(() => createCoreCommanderDamageStateV1({ commanders: [...identities, identities[0]], defendingPlayerIds: [P1, P2], entries: [] }))
      .toThrow(CoreCommanderDamageCreationErrorV1);
    const state = createCoreCommanderDamageStateV1({ commanders: identities, defendingPlayerIds: [P1, P2], entries: [] });
    for (const input of [
      { commanderPhysicalCardId: 'not-registered', defendingPlayerId: P1, damage: 1 },
      { commanderPhysicalCardId: C1, defendingPlayerId: 'bad id', damage: 1 },
      { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: -1 },
      { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: 1.5 },
      { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: Number.MAX_SAFE_INTEGER + 1 },
    ]) expect(() => recordCoreCommanderDamageV1(state, input)).toThrow(CoreCommanderDamageRecordingErrorV1);
    expect(() => coreCommanderDamageAgainstV1(state, 'bad id', P1)).toThrow(CoreCommanderDamageRecordingErrorV1);
  });

  it('rejects a valid but unregistered commander query with a typed issue', () => {
    const state = createCoreCommanderDamageStateV1({ commanders: identities, defendingPlayerIds: [P1, P2], entries: [] });

    try {
      coreCommanderDamageAgainstV1(state, 'commander-3', P1);
      expect.fail('expected unregistered commander error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderDamageRecordingErrorV1);
      if (error instanceof CoreCommanderDamageRecordingErrorV1) {
        expect(error.issues).toContainEqual({
          code: 'UNREGISTERED_COMMANDER',
          path: '/commanderPhysicalCardId',
          message: 'Commander physical ID is not registered',
        });
      }
    }
  });

  it('rejects duplicate entries, preserves input order and zero entries, and deep-freezes successful values', () => {
    const input = {
      commanders: identities.map((identity) => ({ ...identity })),
      defendingPlayerIds: [P2, P1],
      entries: [
        { commanderPhysicalCardId: C2, defendingPlayerId: P2, damage: 4 },
        { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: 2 },
      ],
    };
    const before = structuredClone(input);
    const state = createCoreCommanderDamageStateV1(input);
    expect(input).toEqual(before);
    expect(state.entries).toEqual(input.entries);
    expect(state.defendingPlayerIds).toEqual([P2, P1]);
    expect(() => createCoreCommanderDamageStateV1({ ...input, entries: [...input.entries, { commanderPhysicalCardId: C2, defendingPlayerId: P2, damage: 5 }] }))
      .toThrow(CoreCommanderDamageCreationErrorV1);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.commanders)).toBe(true);
    expect(Object.isFrozen(state.entries)).toBe(true);
    expect(state.commanders.every(Object.isFrozen)).toBe(true);
    expect(state.entries.every(Object.isFrozen)).toBe(true);
  });

  it('normalizes mutable valid state and zero damage returns the normalized state', () => {
    const state = {
      commanders: identities.map((identity) => ({ ...identity })),
      defendingPlayerIds: [P1, P2],
      entries: [{ commanderPhysicalCardId: C2, defendingPlayerId: P2, damage: 4 }],
    };
    const normalized = recordCoreCommanderDamageV1(state, {
      commanderPhysicalCardId: C1,
      defendingPlayerId: P1,
      damage: 0,
    });
    expect(normalized.entries).toEqual([{ commanderPhysicalCardId: C2, defendingPlayerId: P2, damage: 4 }]);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.commanders)).toBe(true);
    expect(Object.isFrozen(normalized.entries)).toBe(true);
    expect(normalized.commanders.every(Object.isFrozen)).toBe(true);
    expect(normalized.entries.every(Object.isFrozen)).toBe(true);
  });

  it('rejects negative zero in creation, state normalization, and recording while accepting positive zero', () => {
    expect(() => createCoreCommanderDamageStateV1({
      commanders: identities,
      defendingPlayerIds: [P1, P2],
      entries: [{ commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: -0 }],
    })).toThrow(CoreCommanderDamageCreationErrorV1);

    const zero = createCoreCommanderDamageStateV1({
      commanders: identities,
      defendingPlayerIds: [P1, P2],
      entries: [{ commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: 0 }],
    });
    expect(Object.is(zero.entries[0].damage, 0)).toBe(true);
    expect(() => recordCoreCommanderDamageV1(zero, {
      commanderPhysicalCardId: C1,
      defendingPlayerId: P2,
      damage: -0,
    })).toThrow(CoreCommanderDamageRecordingErrorV1);
    expect(Object.is(recordCoreCommanderDamageV1(zero, {
      commanderPhysicalCardId: C1,
      defendingPlayerId: P2,
      damage: 0,
    }).entries[0].damage, 0)).toBe(true);
    expect(() => recordCoreCommanderDamageV1({
      commanders: identities,
      defendingPlayerIds: [P1, P2],
      entries: [{ commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: -0 }],
    }, {
      commanderPhysicalCardId: C1,
      defendingPlayerId: P2,
      damage: 1,
    })).toThrow(CoreCommanderDamageCreationErrorV1);
  });

  it('updates an existing pair in place and appends a new pair', () => {
    const state = createCoreCommanderDamageStateV1({
      commanders: identities,
      defendingPlayerIds: [P1, P2],
      entries: [
        { commanderPhysicalCardId: C2, defendingPlayerId: P2, damage: 0 },
        { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: 2 },
      ],
    });
    const updated = recordCoreCommanderDamageV1(state, { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: 3 });
    expect(updated.entries).toEqual([
      { commanderPhysicalCardId: C2, defendingPlayerId: P2, damage: 0 },
      { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: 5 },
    ]);
    const appended = recordCoreCommanderDamageV1(updated, { commanderPhysicalCardId: C2, defendingPlayerId: P1, damage: 1 });
    expect(appended.entries).toEqual([
      { commanderPhysicalCardId: C2, defendingPlayerId: P2, damage: 0 },
      { commanderPhysicalCardId: C1, defendingPlayerId: P1, damage: 5 },
      { commanderPhysicalCardId: C2, defendingPlayerId: P1, damage: 1 },
    ]);
  });

  it('rejects an unregistered defending player in record and query', () => {
    const state = createCoreCommanderDamageStateV1({ commanders: identities, defendingPlayerIds: [P1], entries: [] });
    expect(() => recordCoreCommanderDamageV1(state, { commanderPhysicalCardId: C1, defendingPlayerId: P2, damage: 1 }))
      .toThrow(CoreCommanderDamageRecordingErrorV1);
    expect(() => coreCommanderDamageAgainstV1(state, C1, P2)).toThrow(CoreCommanderDamageRecordingErrorV1);
  });

  it('rejects forged state before recording or querying damage', () => {
    const state = {
      commanders: identities.map((identity) => ({ ...identity })),
      defendingPlayerIds: [P1, P2],
      entries: [{ commanderPhysicalCardId: 'forged' as CorePhysicalCardId, defendingPlayerId: P1, damage: 2 }],
    };
    expect(() => recordCoreCommanderDamageV1(state, {
      commanderPhysicalCardId: C1,
      defendingPlayerId: P1,
      damage: 1,
    })).toThrow(CoreCommanderDamageCreationErrorV1);
    expect(() => coreCommanderDamageAgainstV1(state, C1, P1)).toThrow(CoreCommanderDamageCreationErrorV1);
  });

  it('rejects sparse and accessor arrays without reading an accessor element', () => {
    const sparse: Array<(typeof identities)[number]> = [];
    sparse.length = 1;
    expect(() => createCoreCommanderDamageStateV1({ commanders: sparse, defendingPlayerIds: [P1], entries: [] }))
      .toThrow(CoreCommanderDamageCreationErrorV1);

    let accessed = 0;
    const accessorArray = [identities[0]];
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      get: () => {
        accessed += 1;
        return identities[0];
      },
    });
    expect(() => createCoreCommanderDamageStateV1({ commanders: accessorArray, defendingPlayerIds: [P1], entries: [] }))
      .toThrow(CoreCommanderDamageCreationErrorV1);
    expect(accessed).toBe(0);
  });

  it('rejects non-enumerable indices, symbols, and non-index own properties', () => {
    const hiddenIndex = [P1];
    Object.defineProperty(hiddenIndex, '0', { enumerable: false, value: P1 });
    expect(() => createCoreCommanderDamageStateV1({ commanders: identities, defendingPlayerIds: hiddenIndex, entries: [] }))
      .toThrow(CoreCommanderDamageCreationErrorV1);

    const decorated = [P1] as Array<CorePlayerId> & { extra?: boolean; [key: symbol]: boolean };
    const symbol = Symbol('extra');
    Object.defineProperty(decorated, 'extra', { enumerable: true, value: true });
    decorated[symbol] = true;
    expect(() => createCoreCommanderDamageStateV1({ commanders: identities, defendingPlayerIds: decorated, entries: [] }))
      .toThrow(CoreCommanderDamageCreationErrorV1);
  });

  it.each([
    { getPrototypeOf: () => { throw new Error('prototype trap'); } },
    { ownKeys: () => { throw new Error('ownKeys trap'); } },
    { getOwnPropertyDescriptor: () => { throw new Error('descriptor trap'); } },
  ])('converts array inspection traps into a frozen typed error: %j', (handler) => {
    const target = [P1];
    const input = new Proxy(target, handler);

    try {
      createCoreCommanderDamageStateV1({ commanders: identities, defendingPlayerIds: input, entries: [] });
      expect.fail('expected typed array inspection error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCommanderDamageCreationErrorV1);
      expect(Object.isFrozen(error)).toBe(true);
      if (error instanceof CoreCommanderDamageCreationErrorV1) {
        expect(Object.isFrozen(error.issues)).toBe(true);
        expect(error.issues.every((current) => Object.isFrozen(current))).toBe(true);
      }
    }
  });
});
