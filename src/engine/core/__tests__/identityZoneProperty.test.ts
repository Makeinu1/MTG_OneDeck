import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  createModeNeutralCoreIdentityZoneSliceV1,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from '../index';
import { isRecord } from './testHelpers';

function playerState(): Record<string, unknown> {
  return {
    life: 40,
    poison: 0,
    energy: 0,
    experience: 0,
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    mulliganCount: 0,
    landsPlayedThisTurn: 0,
    spellsCastThisTurn: 0,
    drawnThisTurn: 0,
    maximumHandSizeOverride: null,
  };
}

function definition(name: string): Record<string, unknown> {
  return {
    source: { kind: 'engine-synthetic' },
    name,
    layout: 'normal',
    manaValue: 0,
    colorIdentity: [],
    typeLine: 'Artifact',
    keywords: [],
    producedMana: [],
    tokenKind: null,
    faces: [{
      name,
      manaCost: null,
      typeLine: 'Artifact',
      oracleText: '',
      power: null,
      toughness: null,
      loyalty: null,
      defense: null,
    }],
  };
}

function generatedRaw(
  playerCount: number,
  zoneChoices: readonly number[] = [],
  activeIndex = 0,
  incarnations: readonly number[] = [],
): Record<string, unknown> {
  const turnOrder = Array.from({ length: playerCount }, (_, index) => `P${index + 1}`);
  const players: Record<string, unknown> = {};
  const byPlayer: Record<string, unknown> = {};
  const shared: Record<string, unknown[]> = {
    battlefield: [],
    stack: [],
    exile: [],
    command: [],
  };
  const physicalCards: Record<string, unknown> = {};
  const cardObjects: Record<string, unknown> = {};
  for (const [index, playerId] of turnOrder.entries()) {
    players[playerId] = playerState();
    const playerZones: Record<string, unknown> = { library: [], hand: [], graveyard: [] };
    const choice = zoneChoices[index] ?? 0;
    const incarnation = incarnations[index] ?? 0;
    const objectId = `PC${index + 1}:${incarnation}`;
    if (choice < 3) {
      const zoneNames = ['library', 'hand', 'graveyard'] as const;
      const zone = playerZones[zoneNames[choice] ?? 'library'];
      if (!Array.isArray(zone)) throw new Error('generated zone must be an array');
      zone.push(objectId);
    } else {
      const sharedNames = ['battlefield', 'stack', 'exile', 'command'] as const;
      shared[sharedNames[choice - 3] ?? 'exile'].push(objectId);
    }
    byPlayer[playerId] = playerZones;
    physicalCards[`PC${index + 1}`] = {
      definitionId: 'def.synthetic',
      ownerPlayerId: playerId,
      isCommander: false,
    };
    cardObjects[objectId] = {
      kind: 'card',
      physicalCardId: `PC${index + 1}`,
      incarnation,
      baseControllerPlayerId: choice === 3 || choice === 4
        ? turnOrder[(index + 1) % playerCount]
        : null,
    };
  }
  return {
    kind: 'mode-neutral-core-identity-zone-slice-v1',
    players,
    turnOrder,
    activePlayerId: turnOrder[activeIndex % playerCount],
    cardDefinitions: {
      'def.synthetic': definition('Synthetic'),
      'def.synthetic-unused': definition('Synthetic Unused'),
    },
    physicalCards,
    cardObjects,
    zones: {
      byPlayer,
      shared,
    },
  };
}

function resultHas(result: ReturnType<typeof validateModeNeutralCoreIdentityZoneSliceV1>, code: string): boolean {
  return !result.ok && result.issues.some((issue) => issue.code === code);
}

function stateFrom(raw: Record<string, unknown>) {
  const result = validateModeNeutralCoreIdentityZoneSliceV1(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return createModeNeutralCoreIdentityZoneSliceV1({
    players: result.value.players,
    turnOrder: result.value.turnOrder,
    activePlayerId: result.value.activePlayerId,
    cardDefinitions: result.value.cardDefinitions,
    physicalCards: result.value.physicalCards,
    cardObjects: result.value.cardObjects,
    zones: result.value.zones,
  });
}

function objectMap(raw: Record<string, unknown>): Record<string, unknown> {
  const objects = raw.cardObjects;
  if (!isRecord(objects)) throw new Error('cardObjects must be a record');
  return objects;
}

function zones(raw: Record<string, unknown>): Record<string, unknown> {
  const value = raw.zones;
  if (!isRecord(value)) throw new Error('zones must be a record');
  return value;
}

function permutation<T>(values: readonly T[], ranks: readonly number[]): T[] {
  return values
    .map((value, index) => ({ value, index, rank: ranks[index] ?? index }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ value }) => value);
}

function nonIdentityPermutation(values: readonly string[], ranks: readonly number[]): string[] {
  const candidate = permutation(values, ranks);
  if (candidate.some((value, index) => value !== values[index])) return candidate;
  return values.slice().reverse();
}

function reorderRecord(record: Record<string, unknown>, order: readonly string[]): void {
  const values = new Map(order.map((key) => [key, record[key]]));
  for (const key of Object.keys(record)) delete record[key];
  for (const key of order) record[key] = values.get(key);
}

function arraySnapshot(raw: Record<string, unknown>): string {
  const zonesValue = zones(raw);
  const byPlayer = zonesValue.byPlayer;
  if (!isRecord(byPlayer)) throw new Error('byPlayer must be a record');
  const definitionsValue = raw.cardDefinitions;
  if (!isRecord(definitionsValue)) throw new Error('cardDefinitions must be a record');
  const playerZones = (raw.turnOrder as string[]).map((playerId) => {
    const value = byPlayer[playerId];
    if (!isRecord(value)) throw new Error('player zones must be a record');
    return [playerId, { library: value.library, hand: value.hand, graveyard: value.graveyard }];
  });
  const definitions = Object.keys(definitionsValue)
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
    .map((id) => {
      const value = definitionsValue[id];
      if (!isRecord(value)) throw new Error('definition must be a record');
      return [id, { colorIdentity: value.colorIdentity, producedMana: value.producedMana, keywords: value.keywords, faces: value.faces }];
    });
  return JSON.stringify({
    turnOrder: raw.turnOrder,
    playerZones,
    shared: zonesValue.shared,
    definitions,
  });
}

describe('Mode-Neutral Core identity/zone properties', () => {
  it('generates valid 1-6 player states and preserves all structural invariants', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (playerCount) => {
        const raw = generatedRaw(playerCount);
        const result = validateModeNeutralCoreIdentityZoneSliceV1(raw);
        expect(result.ok).toBe(true);
        if (result.ok) expect(Object.isFrozen(result.value)).toBe(true);
      }),
      { numRuns: 30, seed: 20260809 },
    );
  });

  it('accepts varied active players and player-zone topology', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 0, max: 5 }),
        (playerCount, placements, activeIndex) => {
          const choices = Array.from({ length: playerCount }, (_, index) => placements[index] ?? 0);
          const result = validateModeNeutralCoreIdentityZoneSliceV1(
            generatedRaw(playerCount, choices, activeIndex),
          );
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 30, seed: 20260815 },
    );
  });

  it('accepts shared-zone, controller, and incarnation topology', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 6 }),
        fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 1, maxLength: 6 }),
        (playerCount, placements, incarnationValues) => {
          const choices = Array.from({ length: playerCount }, (_, index) => placements[index] ?? 0);
          const incarnations = Array.from({ length: playerCount }, (_, index) => incarnationValues[index] ?? 0);
          const result = validateModeNeutralCoreIdentityZoneSliceV1(
            generatedRaw(playerCount, choices, 0, incarnations),
          );
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 30, seed: 20260816 },
    );
  });

  it('rejects any valid object duplicated into another zone', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (playerCount) => {
        const raw = generatedRaw(playerCount);
        const shared = zones(raw).shared;
        if (!isRecord(shared)) throw new Error('shared must be a record');
        shared.exile = ['PC1:0'];
        expect(resultHas(validateModeNeutralCoreIdentityZoneSliceV1(raw), 'OBJECT_NOT_IN_EXACTLY_ONE_ZONE')).toBe(true);
      }),
      { numRuns: 30, seed: 20260810 },
    );
  });

  it('rejects any valid object removed from every zone', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (playerCount) => {
        const raw = generatedRaw(playerCount);
        const byPlayer = zones(raw).byPlayer;
        if (!isRecord(byPlayer) || !isRecord(byPlayer.P1)) throw new Error('player zones must be records');
        byPlayer.P1.library = [];
        expect(resultHas(validateModeNeutralCoreIdentityZoneSliceV1(raw), 'OBJECT_NOT_IN_EXACTLY_ONE_ZONE')).toBe(true);
      }),
      { numRuns: 30, seed: 20260811 },
    );
  });

  it('rejects a player-scoped zone containing another owner\'s object', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (playerCount) => {
        const raw = generatedRaw(playerCount);
        const byPlayer = zones(raw).byPlayer;
        if (!isRecord(byPlayer) || !isRecord(byPlayer.P1) || !isRecord(byPlayer.P2)) throw new Error('player zones must be records');
        byPlayer.P1.library = [];
        byPlayer.P2.library = ['PC1:0', 'PC2:0'];
        expect(resultHas(validateModeNeutralCoreIdentityZoneSliceV1(raw), 'OWNED_ZONE_OWNER_MISMATCH')).toBe(true);
      }),
      { numRuns: 30, seed: 20260812 },
    );
  });

  it('rejects null controller on battlefield or stack', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (playerCount) => {
        const raw = generatedRaw(playerCount);
        const objects = objectMap(raw);
        const object = objects['PC1:0'];
        if (!isRecord(object)) throw new Error('object must be a record');
        object.baseControllerPlayerId = 'P1';
        const shared = zones(raw).shared;
        if (!isRecord(shared)) throw new Error('shared must be a record');
        const byPlayer = zones(raw).byPlayer;
        if (!isRecord(byPlayer) || !isRecord(byPlayer.P1)) throw new Error('player zones must be records');
        byPlayer.P1.library = [];
        shared.battlefield = ['PC1:0'];
        expect(resultHas(validateModeNeutralCoreIdentityZoneSliceV1(raw), 'INVALID_CONTROLLER_FOR_ZONE')).toBe(false);
        object.baseControllerPlayerId = null;
        expect(resultHas(validateModeNeutralCoreIdentityZoneSliceV1(raw), 'INVALID_CONTROLLER_FOR_ZONE')).toBe(true);
      }),
      { numRuns: 30, seed: 20260813 },
    );
  });

  it('is deterministic for repeated factory generation with a fixed seed/path', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 6 }),
        fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 1, maxLength: 6 }),
        (playerCount, placements, incarnationValues) => {
        const choices = Array.from({ length: playerCount }, (_, index) => placements[index] ?? 0);
        const incarnations = Array.from({ length: playerCount }, (_, index) => incarnationValues[index] ?? 0);
        const first = stateFrom(generatedRaw(playerCount, choices, 0, incarnations));
        const second = stateFrom(generatedRaw(playerCount, choices, 0, incarnations));
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
        },
      ),
      { numRuns: 30, seed: 20260814 },
    );
  });

  it('canonicalizes every valid record permutation without changing arrays', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 5, maxLength: 5 }),
        (playerCount, rankRows) => {
          const raw = generatedRaw(playerCount);
          const baseline = validateModeNeutralCoreIdentityZoneSliceV1(raw);
          expect(baseline.ok).toBe(true);
          if (!baseline.ok) return;
          const expectedJson = JSON.stringify(baseline.value);
          const expectedArrays = arraySnapshot(raw);
          const playerIds = raw.turnOrder as string[];
          const players = raw.players;
          const definitions = raw.cardDefinitions;
          const physicalCards = raw.physicalCards;
          const cardObjects = raw.cardObjects;
          if (!isRecord(players) || !isRecord(definitions) || !isRecord(physicalCards) || !isRecord(cardObjects)) {
            throw new Error('generated records must be records');
          }
          const recordOrders = [
            permutation(playerIds, rankRows),
            permutation(playerIds, rankRows),
            nonIdentityPermutation(Object.keys(definitions), rankRows),
            permutation(Object.keys(physicalCards), rankRows),
            permutation(Object.keys(cardObjects), rankRows),
          ];
          reorderRecord(players, recordOrders[0] ?? playerIds);
          const zoneRecord = zones(raw).byPlayer;
          if (!isRecord(zoneRecord)) throw new Error('byPlayer must be a record');
          reorderRecord(zoneRecord, recordOrders[1] ?? playerIds);
          reorderRecord(definitions, recordOrders[2] ?? Object.keys(definitions));
          reorderRecord(physicalCards, recordOrders[3] ?? Object.keys(physicalCards));
          reorderRecord(cardObjects, recordOrders[4] ?? Object.keys(cardObjects));
          const permuted = validateModeNeutralCoreIdentityZoneSliceV1(raw);
          expect(permuted.ok).toBe(true);
          if (!permuted.ok) return;
          expect(JSON.stringify(permuted.value)).toBe(expectedJson);
          expect(arraySnapshot(raw)).toBe(expectedArrays);
          const repeated = validateModeNeutralCoreIdentityZoneSliceV1(permuted.value);
          expect(repeated.ok).toBe(true);
          if (repeated.ok) expect(JSON.stringify(repeated.value)).toBe(expectedJson);
          const roundTrip = validateModeNeutralCoreIdentityZoneSliceV1(JSON.parse(JSON.stringify(permuted.value)));
          expect(roundTrip.ok).toBe(true);
          if (roundTrip.ok) expect(JSON.stringify(roundTrip.value)).toBe(expectedJson);
        },
      ),
      { numRuns: 50, seed: 20260817 },
    );
  });
});
