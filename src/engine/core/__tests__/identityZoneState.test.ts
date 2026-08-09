import { describe, expect, it } from 'vitest';

import {
  CoreIdentityZoneCreationError,
  coreCardObjectIdOf,
  createModeNeutralCoreIdentityZoneSliceV1,
  locateCoreObjectV1,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from '../index';
import type {
  CoreCardDefinitionId,
  CorePhysicalCardId,
  CorePlayerId,
  CoreObjectId,
  ModeNeutralCoreIdentityZoneSliceV1,
} from '../index';
import { cloneFixture, fixtureRecord, isRecord } from './testHelpers';

function validatedFixture(): ModeNeutralCoreIdentityZoneSliceV1 {
  const result = validateModeNeutralCoreIdentityZoneSliceV1(fixtureRecord());
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function inputOf(state: ModeNeutralCoreIdentityZoneSliceV1) {
  return {
    players: state.players,
    turnOrder: state.turnOrder,
    activePlayerId: state.activePlayerId,
    cardDefinitions: state.cardDefinitions,
    physicalCards: state.physicalCards,
    cardObjects: state.cardObjects,
    zones: state.zones,
  };
}

function reorderRecord(record: Record<string, unknown>, keys: readonly string[]): void {
  const values = new Map(keys.map((key) => [key, record[key]]));
  for (const key of Object.keys(record)) delete record[key];
  for (const key of keys) record[key] = values.get(key);
}

function numericFactoryInput(): Parameters<typeof createModeNeutralCoreIdentityZoneSliceV1>[0] {
  const raw = cloneFixture();
  const players = raw.players as Record<string, unknown>;
  const playerOne = players.P1;
  const playerTwo = players.P2;
  delete players.P1;
  delete players.P2;
  players['10'] = playerOne;
  players['2'] = playerTwo;

  const zones = raw.zones as Record<string, unknown>;
  const byPlayer = zones.byPlayer as Record<string, unknown>;
  const playerOneZones = byPlayer.P1;
  const playerTwoZones = byPlayer.P2;
  delete byPlayer.P1;
  delete byPlayer.P2;
  byPlayer['10'] = playerOneZones;
  byPlayer['2'] = playerTwoZones;

  raw.turnOrder = ['10', '2', 'P3', 'P4'];
  raw.activePlayerId = '10';

  const definitions = raw.cardDefinitions as Record<string, unknown>;
  const fixtureDefinition = definitions['def.fixture-card'];
  const unusedDefinition = definitions['def.unused'];
  delete definitions['def.fixture-card'];
  delete definitions['def.unused'];
  definitions['10'] = fixtureDefinition;
  definitions['2'] = unusedDefinition;

  const physicalCards = raw.physicalCards as Record<string, unknown>;
  for (const card of Object.values(physicalCards)) {
    if (!isRecord(card)) throw new Error('physical card must be a record');
    card.definitionId = '10';
    if (card.ownerPlayerId === 'P1') card.ownerPlayerId = '10';
    if (card.ownerPlayerId === 'P2') card.ownerPlayerId = '2';
  }

  const cardObjects = raw.cardObjects as Record<string, unknown>;
  for (const cardObject of Object.values(cardObjects)) {
    if (!isRecord(cardObject)) throw new Error('card object must be a record');
    if (cardObject.baseControllerPlayerId === 'P1') cardObject.baseControllerPlayerId = '10';
    if (cardObject.baseControllerPlayerId === 'P2') cardObject.baseControllerPlayerId = '2';
  }

  const input = { ...raw };
  delete input.kind;
  return input as unknown as Parameters<typeof createModeNeutralCoreIdentityZoneSliceV1>[0];
}

describe('Mode-Neutral Core identity/zone state', () => {
  it('creates the committed fixture deterministically without mutating input', () => {
    const input = inputOf(validatedFixture());
    const before = JSON.stringify(input);
    const generated = createModeNeutralCoreIdentityZoneSliceV1(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(generated)).toBe(JSON.stringify(createModeNeutralCoreIdentityZoneSliceV1(input)));
    expect(generated.kind).toBe('mode-neutral-core-identity-zone-slice-v1');
  });

  it('deep-freezes root and every nested object and array', () => {
    const generated = createModeNeutralCoreIdentityZoneSliceV1(inputOf(validatedFixture()));
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) visit(child);
    };
    visit(generated);
  });

  it('preserves required record insertion order and zone array order', () => {
    const generated = createModeNeutralCoreIdentityZoneSliceV1(inputOf(validatedFixture()));
    expect(Object.keys(generated.players)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(Object.keys(generated.zones.byPlayer)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(Object.keys(generated.cardDefinitions)).toEqual(['def.fixture-card', 'def.unused']);
    expect(Object.keys(generated.physicalCards)).toEqual(['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7']);
    expect(Object.keys(generated.cardObjects)).toEqual(['PC1:0', 'PC2:0', 'PC3:0', 'PC4:1', 'PC5:1', 'PC6:0', 'PC7:0']);
    expect(generated.zones.shared.battlefield).toEqual(['PC4:1']);
  });

  it('preserves code-unit order for numeric-like record keys', () => {
    const generated = createModeNeutralCoreIdentityZoneSliceV1(numericFactoryInput());
    expect(Object.keys(generated.players)).toEqual(['10', '2', 'P3', 'P4']);
    expect(Object.keys(generated.zones.byPlayer)).toEqual(['10', '2', 'P3', 'P4']);
    expect(Object.keys(generated.cardDefinitions)).toEqual(['10', '2']);
  });

  it('canonicalizes validator records independently of input insertion order', () => {
    const raw = cloneFixture();
    const players = raw.players;
    const definitions = raw.cardDefinitions;
    const physicalCards = raw.physicalCards;
    const cardObjects = raw.cardObjects;
    if (!isRecord(players) || !isRecord(definitions) || !isRecord(physicalCards) || !isRecord(cardObjects)) {
      throw new Error('fixture records must be records');
    }
    reorderRecord(players, ['P4', 'P3', 'P2', 'P1']);
    for (const player of Object.values(players)) {
      if (!isRecord(player)) throw new Error('player must be a record');
      const manaPool = player.manaPool;
      if (!isRecord(manaPool)) throw new Error('manaPool must be a record');
      reorderRecord(manaPool, Object.keys(manaPool).reverse());
      reorderRecord(player, Object.keys(player).reverse());
    }
    const zones = raw.zones;
    if (!isRecord(zones)) throw new Error('zones must be a record');
    const byPlayer = zones.byPlayer;
    if (!isRecord(byPlayer)) throw new Error('byPlayer must be a record');
    reorderRecord(byPlayer, ['P4', 'P3', 'P2', 'P1']);
    for (const playerZones of Object.values(byPlayer)) {
      if (!isRecord(playerZones)) throw new Error('player zones must be a record');
      reorderRecord(playerZones, Object.keys(playerZones).reverse());
    }
    const shared = zones.shared;
    if (!isRecord(shared)) throw new Error('shared zones must be a record');
    reorderRecord(shared, Object.keys(shared).reverse());
    reorderRecord(definitions, ['def.unused', 'def.fixture-card']);
    for (const definition of Object.values(definitions)) {
      if (!isRecord(definition)) throw new Error('definition must be a record');
      const source = definition.source;
      if (!isRecord(source)) throw new Error('source must be a record');
      reorderRecord(source, Object.keys(source).reverse());
      const faces = definition.faces;
      if (!Array.isArray(faces)) throw new Error('faces must be an array');
      for (const face of faces) {
        if (!isRecord(face)) throw new Error('face must be a record');
        reorderRecord(face, Object.keys(face).reverse());
      }
      reorderRecord(definition, Object.keys(definition).reverse());
    }
    for (const physicalCard of Object.values(physicalCards)) {
      if (!isRecord(physicalCard)) throw new Error('physical card must be a record');
      reorderRecord(physicalCard, Object.keys(physicalCard).reverse());
    }
    for (const cardObject of Object.values(cardObjects)) {
      if (!isRecord(cardObject)) throw new Error('card object must be a record');
      reorderRecord(cardObject, Object.keys(cardObject).reverse());
    }
    reorderRecord(physicalCards, ['PC7', 'PC6', 'PC5', 'PC4', 'PC3', 'PC2', 'PC1']);
    reorderRecord(cardObjects, ['PC7:0', 'PC6:0', 'PC5:1', 'PC4:1', 'PC3:0', 'PC2:0', 'PC1:0']);

    const result = validateModeNeutralCoreIdentityZoneSliceV1(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.keys(result.value.players)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(Object.keys(result.value.zones.byPlayer)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(Object.keys(result.value.cardDefinitions)).toEqual(['def.fixture-card', 'def.unused']);
    expect(Object.keys(result.value.physicalCards)).toEqual(['PC1', 'PC2', 'PC3', 'PC4', 'PC5', 'PC6', 'PC7']);
    expect(Object.keys(result.value.cardObjects)).toEqual(['PC1:0', 'PC2:0', 'PC3:0', 'PC4:1', 'PC5:1', 'PC6:0', 'PC7:0']);
    expect(JSON.stringify(result.value)).toBe(JSON.stringify(fixtureRecord()));
  });

  it('uses the validator canonical output directly in the factory', () => {
    const state = validatedFixture();
    const input = inputOf(state);
    const candidate = {
      kind: 'mode-neutral-core-identity-zone-slice-v1',
      ...input,
    };
    const validation = validateModeNeutralCoreIdentityZoneSliceV1(candidate);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(JSON.stringify(createModeNeutralCoreIdentityZoneSliceV1(input))).toBe(JSON.stringify(validation.value));
  });

  it('canonicalizes numeric-like validator keys through Object.keys, Reflect.ownKeys, and JSON', () => {
    const input = numericFactoryInput() as unknown as Record<string, unknown>;
    const result = validateModeNeutralCoreIdentityZoneSliceV1({
      kind: 'mode-neutral-core-identity-zone-slice-v1',
      ...input,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.players)).toEqual(['10', '2', 'P3', 'P4']);
    expect(Reflect.ownKeys(result.value.players)).toEqual(['10', '2', 'P3', 'P4']);
    expect(Object.keys(result.value.cardDefinitions)).toEqual(['10', '2']);
    expect(Reflect.ownKeys(result.value.cardDefinitions)).toEqual(['10', '2']);
    const repeated = validateModeNeutralCoreIdentityZoneSliceV1(result.value);
    expect(repeated.ok).toBe(true);
    if (repeated.ok) expect(JSON.stringify(repeated.value)).toBe(JSON.stringify(result.value));
  });

  it('preserves all array meanings while canonicalizing records', () => {
    const raw = cloneFixture();
    const result = validateModeNeutralCoreIdentityZoneSliceV1(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.turnOrder).toEqual(raw.turnOrder);
    const sourceZones = raw.zones;
    const outputZones = result.value.zones;
    if (!isRecord(sourceZones)) throw new Error('source zones must be a record');
    const sourceByPlayer = sourceZones.byPlayer;
    if (!isRecord(sourceByPlayer)) throw new Error('source byPlayer must be a record');
    for (const playerId of raw.turnOrder as string[]) {
      const sourcePlayerZones = sourceByPlayer[playerId];
      if (!isRecord(sourcePlayerZones)) throw new Error('source player zones must be a record');
      const outputPlayerZones = outputZones.byPlayer[playerId as CorePlayerId];
      expect(outputPlayerZones.library).toEqual(sourcePlayerZones.library);
      expect(outputPlayerZones.hand).toEqual(sourcePlayerZones.hand);
      expect(outputPlayerZones.graveyard).toEqual(sourcePlayerZones.graveyard);
    }
    const sourceShared = sourceZones.shared;
    if (!isRecord(sourceShared)) throw new Error('source shared zones must be a record');
    expect(outputZones.shared.battlefield).toEqual(sourceShared.battlefield);
    expect(outputZones.shared.stack).toEqual(sourceShared.stack);
    expect(outputZones.shared.exile).toEqual(sourceShared.exile);
    expect(outputZones.shared.command).toEqual(sourceShared.command);
    const sourceDefinition = (raw.cardDefinitions as Record<string, unknown>)['def.fixture-card'];
    if (!isRecord(sourceDefinition)) throw new Error('source definition must be a record');
    const outputDefinition = result.value.cardDefinitions['def.fixture-card' as CoreCardDefinitionId];
    expect(outputDefinition.colorIdentity).toEqual(sourceDefinition.colorIdentity);
    expect(outputDefinition.producedMana).toEqual(sourceDefinition.producedMana);
    expect(outputDefinition.keywords).toEqual(sourceDefinition.keywords);
    expect(outputDefinition.faces).toEqual(sourceDefinition.faces);
  });

  it('round-trips JSON and locates every object exactly once', () => {
    const generated = createModeNeutralCoreIdentityZoneSliceV1(inputOf(validatedFixture()));
    const roundTrip = validateModeNeutralCoreIdentityZoneSliceV1(JSON.parse(JSON.stringify(generated)) as unknown);
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) return;
    expect(JSON.stringify(roundTrip.value)).toBe(JSON.stringify(generated));
    for (const objectId of Object.keys(generated.cardObjects)) {
      expect(locateCoreObjectV1(generated, objectId as CoreObjectId)).not.toBeNull();
    }
    expect(locateCoreObjectV1(generated, 'missing:0' as CoreObjectId)).toBeNull();
  });

  it('generates ObjectId only from physical card and incarnation', () => {
    expect(coreCardObjectIdOf('PC1' as CorePhysicalCardId, 0)).toBe('PC1:0');
    expect(() => coreCardObjectIdOf('bad id' as CorePhysicalCardId, 0)).toThrow(TypeError);
    expect(() => coreCardObjectIdOf('PC1' as CorePhysicalCardId, 1.5)).toThrow(TypeError);
    expect(() => coreCardObjectIdOf('PC1' as CorePhysicalCardId, -1)).toThrow(TypeError);
  });

  it('throws the dedicated creation error for invalid factory input', () => {
    const input = { ...inputOf(validatedFixture()), activePlayerId: 'missing' as CorePlayerId };
    expect(() => createModeNeutralCoreIdentityZoneSliceV1(input)).toThrow(CoreIdentityZoneCreationError);
    try {
      createModeNeutralCoreIdentityZoneSliceV1(input);
    } catch (error) {
      expect(error).toBeInstanceOf(CoreIdentityZoneCreationError);
      if (error instanceof CoreIdentityZoneCreationError) expect(error.issues.length).toBeGreaterThan(0);
    }
  });

  it('rejects a runtime kind field instead of overwriting it', () => {
    const input = {
      ...inputOf(validatedFixture()),
      kind: 'wrong',
    } as Parameters<typeof createModeNeutralCoreIdentityZoneSliceV1>[0];
    expect(() => createModeNeutralCoreIdentityZoneSliceV1(input)).toThrow(CoreIdentityZoneCreationError);
  });

  it('does not execute factory input getters', () => {
    const input = inputOf(validatedFixture());
    let getterExecuted = false;
    Object.defineProperty(input, 'players', {
      enumerable: true,
      get: () => {
        getterExecuted = true;
        return input.players;
      },
    });
    expect(() => createModeNeutralCoreIdentityZoneSliceV1(input)).toThrow(CoreIdentityZoneCreationError);
    expect(getterExecuted).toBe(false);
  });
});
