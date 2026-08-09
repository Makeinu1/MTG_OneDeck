import { describe, expect, it } from 'vitest';

import {
  CoreIdentityZoneCreationError,
  coreCardObjectIdOf,
  createModeNeutralCoreIdentityZoneSliceV1,
  locateCoreObjectV1,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from '../index';
import type {
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
    const before = structuredClone(input);
    const generated = createModeNeutralCoreIdentityZoneSliceV1(input);
    expect(input).toEqual(before);
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
