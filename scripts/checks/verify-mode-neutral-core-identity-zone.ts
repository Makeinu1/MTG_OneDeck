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
import type { CoreObjectId } from '../../src/engine/core';

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

console.log(
  `slice=mode-neutral-core-identity-zone-slice-v1 players=${fixture.turnOrder.length}`
  + ` definitions=${Object.keys(fixture.cardDefinitions).length}`
  + ` physicalCards=${Object.keys(fixture.physicalCards).length}`
  + ` objects=${Object.keys(fixture.cardObjects).length}`
  + ' validation=ok roundTrip=ok frozen=true',
);
