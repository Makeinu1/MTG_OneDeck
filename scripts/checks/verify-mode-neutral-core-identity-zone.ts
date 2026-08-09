import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  coreZoneInformationClassOf,
  coreZoneScopeOf,
  createModeNeutralCoreIdentityZoneSliceV1,
  locateCoreObjectV1,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from '../../src/engine/core';
import type { ModeNeutralCoreIdentityZoneSliceV1 } from '../../src/engine/core';
import type { CoreCardDefinitionId, CoreObjectId } from '../../src/engine/core';

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/engine/core/fixtures/identity-zone-slice-v1.json',
);

function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child));
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

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a record`);
  }
  return value as Record<string, unknown>;
}

function reorderRecord(record: Record<string, unknown>, keys: readonly string[]): void {
  const values = new Map(keys.map((key) => [key, record[key]]));
  for (const key of Object.keys(record)) delete record[key];
  for (const key of keys) record[key] = values.get(key);
}

function arraySnapshot(value: ModeNeutralCoreIdentityZoneSliceV1): string {
  return JSON.stringify({
    turnOrder: value.turnOrder,
    playerZones: value.turnOrder.map((playerId) => ({
      playerId,
      library: value.zones.byPlayer[playerId].library,
      hand: value.zones.byPlayer[playerId].hand,
      graveyard: value.zones.byPlayer[playerId].graveyard,
    })),
    shared: value.zones.shared,
    definitions: Object.keys(value.cardDefinitions).map((definitionId) => {
      const definition = value.cardDefinitions[definitionId as CoreCardDefinitionId];
      return {
        definitionId,
        colorIdentity: definition.colorIdentity,
        producedMana: definition.producedMana,
        keywords: definition.keywords,
        faces: definition.faces,
      };
    }),
  });
}

function permutedFixture(): unknown {
  const raw = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
  const players = recordOf(raw.players, 'players');
  const zones = recordOf(raw.zones, 'zones');
  const byPlayer = recordOf(zones.byPlayer, 'zones.byPlayer');
  const definitions = recordOf(raw.cardDefinitions, 'cardDefinitions');
  const physicalCards = recordOf(raw.physicalCards, 'physicalCards');
  const cardObjects = recordOf(raw.cardObjects, 'cardObjects');
  reorderRecord(players, ['P4', 'P3', 'P2', 'P1']);
  reorderRecord(byPlayer, ['P4', 'P3', 'P2', 'P1']);
  reorderRecord(definitions, ['def.unused', 'def.fixture-card']);
  reorderRecord(physicalCards, ['PC7', 'PC6', 'PC5', 'PC4', 'PC3', 'PC2', 'PC1']);
  reorderRecord(cardObjects, ['PC7:0', 'PC6:0', 'PC5:1', 'PC4:1', 'PC3:0', 'PC2:0', 'PC1:0']);
  return raw;
}

function numericLikeFixture(): unknown {
  const raw = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
  const players = recordOf(raw.players, 'players');
  const zones = recordOf(raw.zones, 'zones');
  const byPlayer = recordOf(zones.byPlayer, 'zones.byPlayer');
  const definitions = recordOf(raw.cardDefinitions, 'cardDefinitions');
  const physicalCards = recordOf(raw.physicalCards, 'physicalCards');
  const cardObjects = recordOf(raw.cardObjects, 'cardObjects');
  const playerOne = players.P1;
  const playerTwo = players.P2;
  delete players.P1;
  delete players.P2;
  players['10'] = playerOne;
  players['2'] = playerTwo;
  const playerOneZones = byPlayer.P1;
  const playerTwoZones = byPlayer.P2;
  delete byPlayer.P1;
  delete byPlayer.P2;
  byPlayer['10'] = playerOneZones;
  byPlayer['2'] = playerTwoZones;
  raw.turnOrder = ['10', '2', 'P3', 'P4'];
  raw.activePlayerId = '10';
  const fixtureDefinition = definitions['def.fixture-card'];
  const unusedDefinition = definitions['def.unused'];
  delete definitions['def.fixture-card'];
  delete definitions['def.unused'];
  definitions['10'] = fixtureDefinition;
  definitions['2'] = unusedDefinition;
  for (const value of Object.values(physicalCards)) {
    const card = recordOf(value, 'physical card');
    card.definitionId = '10';
    if (card.ownerPlayerId === 'P1') card.ownerPlayerId = '10';
    if (card.ownerPlayerId === 'P2') card.ownerPlayerId = '2';
  }
  for (const value of Object.values(cardObjects)) {
    const cardObject = recordOf(value, 'card object');
    if (cardObject.baseControllerPlayerId === 'P1') cardObject.baseControllerPlayerId = '10';
    if (cardObject.baseControllerPlayerId === 'P2') cardObject.baseControllerPlayerId = '2';
  }
  return raw;
}

const parsed: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'));
const fixtureValidation = validateModeNeutralCoreIdentityZoneSliceV1(parsed);
assert.equal(fixtureValidation.ok, true, JSON.stringify(fixtureValidation));
if (!fixtureValidation.ok) throw new Error('fixture validation failed');

const fixture = fixtureValidation.value;
assert.equal(fixture.turnOrder.length, 4);
assert.equal(Object.keys(fixture.cardDefinitions).length, 2);
assert.equal(Object.keys(fixture.physicalCards).length, 7);
assert.equal(Object.keys(fixture.cardObjects).length, 7);

const locations = Object.keys(fixture.cardObjects).map((objectId) =>
  locateCoreObjectV1(fixture, objectId as CoreObjectId),
);
assert.equal(locations.every((location) => location !== null), true);
assert.equal(locateCoreObjectV1(fixture, 'missing:0' as CoreObjectId), null);

const battlefieldId = fixture.zones.shared.battlefield[0];
const stackId = fixture.zones.shared.stack[0];
const battlefieldObject = fixture.cardObjects[battlefieldId];
const stackObject = fixture.cardObjects[stackId];
assert.notEqual(fixture.physicalCards[battlefieldObject.physicalCardId].ownerPlayerId, battlefieldObject.baseControllerPlayerId);
assert.notEqual(fixture.physicalCards[stackObject.physicalCardId].ownerPlayerId, stackObject.baseControllerPlayerId);

const zoneExpectation: readonly [string, string, string][] = [
  ['library', 'player-scoped', 'hidden-zone'],
  ['hand', 'player-scoped', 'hidden-zone'],
  ['graveyard', 'player-scoped', 'public-zone'],
  ['battlefield', 'shared', 'public-zone'],
  ['stack', 'shared', 'public-zone'],
  ['exile', 'shared', 'public-zone'],
  ['command', 'shared', 'public-zone'],
];
for (const [zone, scope, informationClass] of zoneExpectation) {
  assert.equal(coreZoneScopeOf(zone as Parameters<typeof coreZoneScopeOf>[0]), scope);
  assert.equal(coreZoneInformationClassOf(zone as Parameters<typeof coreZoneInformationClassOf>[0]), informationClass);
}

const generated = createModeNeutralCoreIdentityZoneSliceV1(inputOf(fixture));
const generatedAgain = createModeNeutralCoreIdentityZoneSliceV1(inputOf(fixture));
assert.equal(JSON.stringify(generated), JSON.stringify(generatedAgain));
assert.equal(isDeepFrozen(generated), true);
assert.equal(JSON.stringify(generated), JSON.stringify(fixture));

const roundTrip = validateModeNeutralCoreIdentityZoneSliceV1(JSON.parse(JSON.stringify(generated)));
assert.equal(roundTrip.ok, true, JSON.stringify(roundTrip));
assert.equal(Object.isFrozen(generated), true);

const permutedValidation = validateModeNeutralCoreIdentityZoneSliceV1(permutedFixture());
assert.equal(permutedValidation.ok, true, JSON.stringify(permutedValidation));
if (!permutedValidation.ok) throw new Error('permuted fixture validation failed');
const permutedFactory = createModeNeutralCoreIdentityZoneSliceV1(inputOf(permutedValidation.value));
assert.equal(JSON.stringify(permutedValidation.value), JSON.stringify(fixture));
assert.equal(JSON.stringify(permutedFactory), JSON.stringify(permutedValidation.value));
const repeatedValidation = validateModeNeutralCoreIdentityZoneSliceV1(permutedValidation.value);
assert.equal(repeatedValidation.ok, true, JSON.stringify(repeatedValidation));
if (!repeatedValidation.ok) throw new Error('repeated fixture validation failed');
assert.equal(JSON.stringify(repeatedValidation.value), JSON.stringify(permutedValidation.value));
assert.equal(arraySnapshot(permutedValidation.value), arraySnapshot(fixture));

const numericValidation = validateModeNeutralCoreIdentityZoneSliceV1(numericLikeFixture());
assert.equal(numericValidation.ok, true, JSON.stringify(numericValidation));
if (!numericValidation.ok) throw new Error('numeric-like fixture validation failed');
assert.deepEqual(Object.keys(numericValidation.value.players), ['10', '2', 'P3', 'P4']);
assert.deepEqual(Reflect.ownKeys(numericValidation.value.players), ['10', '2', 'P3', 'P4']);
assert.deepEqual(Object.keys(numericValidation.value.cardDefinitions), ['10', '2']);
assert.deepEqual(Reflect.ownKeys(numericValidation.value.cardDefinitions), ['10', '2']);
const numericRoundTrip = validateModeNeutralCoreIdentityZoneSliceV1(JSON.parse(JSON.stringify(numericValidation.value)));
assert.equal(numericRoundTrip.ok, true, JSON.stringify(numericRoundTrip));
if (!numericRoundTrip.ok) throw new Error('numeric round-trip validation failed');
assert.equal(JSON.stringify(numericRoundTrip.value), JSON.stringify(numericValidation.value));

console.log(
  `slice=mode-neutral-core-identity-zone-slice-v1 players=${fixture.turnOrder.length}`
  + ` definitions=${Object.keys(fixture.cardDefinitions).length}`
  + ` physicalCards=${Object.keys(fixture.physicalCards).length}`
  + ` objects=${Object.keys(fixture.cardObjects).length}`
  + ' validation=ok roundTrip=ok canonicalValidation=ok frozen=true',
);
