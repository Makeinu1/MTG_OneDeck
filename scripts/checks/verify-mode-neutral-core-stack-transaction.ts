#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  commitCoreCardSpellToStackV1,
  commitCoreSyntheticStackObjectV1,
  createCoreStackTransactionBundleV1,
  removeCoreStackObjectV1,
  retargetCoreStackObjectV1,
  validateCoreStackTransactionBundleV1,
} from '../../src/engine/core';
import type {
  CoreCardDefinitionId,
  CoreObjectId,
  CorePlayerId,
  CoreStackAnnouncementRecordV1,
  CoreStackTransactionBundleV1,
  CoreSyntheticStackCommitInputV1,
} from '../../src/engine/core';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(repositoryRoot, 'src/engine/core/stack/transaction/fixtures/stack-transaction-v1.json');
const objectId = (value: string): CoreObjectId => value as CoreObjectId;
const playerId = (value: string): CorePlayerId => value as CorePlayerId;
const definitionId = (value: string): CoreCardDefinitionId => value as CoreCardDefinitionId;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be a record`);
  return value as Record<string, unknown>;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || deepFrozen(descriptor.value, seen);
  });
}

function announcement(bundle: CoreStackTransactionBundleV1, id: CoreObjectId): CoreStackAnnouncementRecordV1 {
  const value = bundle.stackAnnouncements.byObject[id];
  if (value === undefined) throw new Error(`missing announcement ${id}`);
  return value;
}

function assertBundle(value: unknown, label: string): CoreStackTransactionBundleV1 {
  const result = validateCoreStackTransactionBundleV1(value);
  assert.equal(result.ok, true, `${label}: ${JSON.stringify(result)}`);
  if (!result.ok) throw new Error(`${label} was rejected`);
  return result.value;
}

const fixture = record(readJson(fixturePath), 'fixture');
const fixtureBundle = record(fixture.bundle, 'fixture.bundle');
const canonicalFixtureBundle = assertBundle(fixtureBundle, 'fixture bundle');
const bundle = createCoreStackTransactionBundleV1({
  objectRegistry: canonicalFixtureBundle.objectRegistry,
  objectRuntime: canonicalFixtureBundle.objectRuntime,
  stackAnnouncements: canonicalFixtureBundle.stackAnnouncements,
});
const bundleBefore = JSON.stringify(bundle);
const pc51 = objectId('PC5:1');
const pc21 = objectId('PC2:1');
const spellCopy = objectId('@spell-copy:fixture-copy');
const activated = objectId('@activated-ability:fixture-activation');
const triggered = objectId('@triggered-ability:fixture-trigger');

const cardAnnouncement = announcement(bundle, pc51);
if (cardAnnouncement.kind !== 'card-spell') throw new Error('fixture card announcement kind mismatch');
const cardCommit = commitCoreCardSpellToStackV1(bundle, {
  sourceObjectId: objectId('PC2:0'),
  controllerPlayerId: playerId('P3'),
  announcement: cardAnnouncement,
});
assert.equal(cardCommit.previousObjectId, objectId('PC2:0'));
assert.equal(cardCommit.committedObjectId, pc21);
assert.equal(cardCommit.bundle.objectRegistry.objects[objectId('PC2:0')], undefined);
assert.equal(cardCommit.bundle.objectRegistry.objects[pc21]?.kind, 'card');
assert.equal(cardCommit.bundle.objectRegistry.zones.shared.stack.at(-1), pc21);
assert.deepEqual(JSON.parse(JSON.stringify(cardCommit.bundle.objectRuntime.byObject[pc21])), {
  orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false },
  counterDamage: { counters: [], markedDamage: 0 },
  attachment: { attachedTo: null },
});
assert.equal(cardCommit.bundle.stackAnnouncements.byObject[pc21]?.kind, 'card-spell');

const copyAnnouncement = announcement(bundle, spellCopy);
const activatedAnnouncement = announcement(bundle, activated);
const triggeredAnnouncement = announcement(bundle, triggered);
if (copyAnnouncement.kind !== 'spell-copy' || activatedAnnouncement.kind !== 'activated-ability' || triggeredAnnouncement.kind !== 'triggered-ability') {
  throw new Error('fixture synthetic announcement kinds mismatch');
}
const syntheticCases: readonly CoreSyntheticStackCommitInputV1[] = [
  {
    objectId: objectId('@spell-copy:verify-copy'),
    object: { kind: 'spell-copy', definitionId: definitionId('def.fixture-card'), controllerPlayerId: playerId('P1'), copiedFromObjectId: objectId('@spell-copy:historical-source') },
    announcement: copyAnnouncement,
  },
  {
    objectId: objectId('@activated-ability:verify-activation'),
    object: { kind: 'activated-ability', controllerPlayerId: playerId('P1'), sourceObjectId: objectId('PC6:0'), abilityKey: 'verify.activate' },
    announcement: activatedAnnouncement,
  },
  {
    objectId: objectId('@triggered-ability:verify-trigger'),
    object: { kind: 'triggered-ability', controllerPlayerId: playerId('P1'), sourceObjectId: null, abilityKey: 'verify.trigger' },
    announcement: triggeredAnnouncement,
  },
];
const runtimeBefore = JSON.stringify(bundle.objectRuntime);
for (const input of syntheticCases) {
  const result = commitCoreSyntheticStackObjectV1(bundle, input);
  assert.equal(result.committedObjectId, input.objectId);
  assert.equal(result.bundle.objectRegistry.zones.shared.stack.at(-1), input.objectId);
  assert.equal(result.bundle.objectRuntime.byObject[input.objectId], undefined);
  assert.equal(JSON.stringify(result.bundle.objectRuntime), runtimeBefore);
}

const retargetBefore = announcement(bundle, pc51);
const retarget = retargetCoreStackObjectV1(bundle, {
  objectId: pc51,
  replacements: [
    { selectionId: 'card-object', target: { kind: 'object', objectId: objectId('@spell-copy:historical-target') } },
    { selectionId: 'card-player', target: { kind: 'player', playerId: playerId('P4') } },
  ],
});
const retargetAfter = announcement(retarget.bundle, pc51);
assert.equal(retargetAfter.kind, retargetBefore.kind);
assert.deepEqual(retargetAfter.chosenModeKeys, retargetBefore.chosenModeKeys);
assert.deepEqual(retargetAfter.announcedVariables, retargetBefore.announcedVariables);
assert.deepEqual(retargetAfter.distributions, retargetBefore.distributions);
assert.deepEqual(retargetAfter.costChoices, retargetBefore.costChoices);
assert.deepEqual(retarget.bundle.objectRegistry.zones.shared.stack, bundle.objectRegistry.zones.shared.stack);

const graveyardRemoval = removeCoreStackObjectV1(bundle, {
  kind: 'card-to-zone', objectId: pc51, destination: { kind: 'owner-graveyard' },
});
assert.equal(graveyardRemoval.nextObjectId, objectId('PC5:2'));
assert.equal(graveyardRemoval.bundle.objectRegistry.objects[pc51], undefined);
assert.equal(graveyardRemoval.bundle.objectRegistry.zones.byPlayer[playerId('P4')].graveyard.includes(objectId('PC5:2')), true);
assert.equal(graveyardRemoval.bundle.objectRegistry.zones.shared.stack.includes(pc51), false);

const battlefieldRemoval = removeCoreStackObjectV1(bundle, {
  kind: 'card-to-zone', objectId: pc51, destination: { kind: 'battlefield', baseControllerPlayerId: playerId('P4') },
});
const battlefieldObject = battlefieldRemoval.bundle.objectRegistry.objects[objectId('PC5:2')];
if (battlefieldObject?.kind !== 'card') throw new Error('battlefield removal did not create a card object');
assert.equal(battlefieldObject.baseControllerPlayerId, playerId('P4'));
assert.equal(battlefieldRemoval.bundle.objectRegistry.zones.shared.battlefield.includes(objectId('PC5:2')), true);

for (const id of [spellCopy, activated, triggered]) {
  const result = removeCoreStackObjectV1(bundle, { kind: 'cease', objectId: id });
  assert.equal(result.nextObjectId, null);
  assert.equal(result.bundle.objectRegistry.objects[id], undefined);
  assert.equal(result.bundle.stackAnnouncements.byObject[id], undefined);
  assert.equal(JSON.stringify(result.bundle.objectRuntime), runtimeBefore);
}

const middle = removeCoreStackObjectV1(bundle, {
  kind: 'card-to-zone', objectId: pc51, destination: { kind: 'battlefield', baseControllerPlayerId: playerId('P4') },
});
assert.deepEqual(middle.bundle.objectRegistry.zones.shared.stack, [spellCopy, activated, triggered]);

const invalidInput = { kind: 'card-to-zone', objectId: pc51, destination: { kind: 'stack', baseControllerPlayerId: playerId('P1') } };
assert.throws(() => removeCoreStackObjectV1(bundle, invalidInput), /INVALID_DESTINATION/);
assert.equal(JSON.stringify(bundle), bundleBefore);

const roundTrip = assertBundle(JSON.parse(JSON.stringify(bundle)) as unknown, 'JSON round-trip');
assert.equal(JSON.stringify(roundTrip), bundleBefore);
assert.equal(deepFrozen(cardCommit), true);
assert.equal(deepFrozen(retarget), true);
assert.equal(deepFrozen(graveyardRemoval), true);
assert.equal(deepFrozen(battlefieldRemoval), true);
assert.equal(deepFrozen(middle), true);

console.log('transaction=mode-neutral-core-stack-transaction-v1 cardCommit=ok syntheticCommit=ok retarget=ok cardRemoval=ok syntheticCease=ok atomicity=ok canonical=ok frozen=true');
