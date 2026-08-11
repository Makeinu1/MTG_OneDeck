#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Core from '../../src/engine/core';

type RecordValue = Record<string, unknown>;

const repositoryRoot = resolve(new URL('../..', import.meta.url).pathname);
const fixturePath = resolve(
  repositoryRoot,
  'src/engine/core/fixtures/o4p-01m-commander-combat-player-exit-v1.json',
);

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record`);
  }
  return value as RecordValue;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || deepFrozen(descriptor.value, seen);
  });
}

function runtimeKeys(value: unknown, found: string[] = []): readonly string[] {
  if (value === null || typeof value !== 'object') return found;
  Object.keys(value).forEach((key) => {
    found.push(key);
    runtimeKeys((value as RecordValue)[key], found);
  });
  return found;
}

function assertFrozenAndSerializable(values: readonly [string, unknown][]): void {
  values.forEach(([label, value]) => {
    assert.equal(deepFrozen(value), true, `${label} must be deeply frozen`);
    assert.deepEqual(JSON.parse(JSON.stringify(value)) as unknown, value, `${label} JSON round trip`);
  });
}

const fixture = record(JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown, 'fixture');
const fixtureBefore = JSON.stringify(fixture);
assert.equal(fixture.version, 'mode-neutral-core-commander-combat-player-exit-v1');
assert.equal(Object.prototype.hasOwnProperty.call(record(fixture.exitReferenceBundle, 'exitReferenceBundle'), 'exitingPlayerId'), false);

const publicExports = Object.keys(Core);
const deletedAssignmentExports = [
  'CoreMultiplayerCombatAssignmentAdditionErrorV1',
  'CoreMultiplayerCombatAssignmentCreationErrorV1',
  'createCoreMultiplayerCombatAssignmentStateV1',
  'addCoreCombatAttackAssignmentV1',
  'addCoreCombatBlockAssignmentV1',
];
assert.equal(deletedAssignmentExports.some((name) => publicExports.includes(name)), false);
assert.equal(publicExports.includes('reconcileCoreCombatContextForPlayerExitV1'), true);
assert.equal(publicExports.includes('CoreCombatContextReconciliationErrorV1'), true);
assert.equal(publicExports.includes('corePlayerLifecycleExitCauseV1'), true);
assert.equal(publicExports.includes('reconcileCorePlayerExitV1'), true);
assert.equal(publicExports.includes('CorePlayerExitReconciliationResultV1'), false);
assert.equal(publicExports.includes('coreCommanderDamageAgainstV1'), true);
assert.equal(publicExports.includes('recordCoreCommanderDamageV1'), true);

const commanderInputs = array(fixture.commanders, 'fixture.commanders').map((value, index) =>
  record(value, `fixture.commanders[${index}]`));
assert.deepEqual(
  commanderInputs.map((value) => [value.physicalCardId, value.ownerPlayerId]),
  [['C1', 'P1'], ['C2', 'P2'], ['C3', 'P3'], ['C4', 'P4']],
);
const identities = commanderInputs.map((value) => Core.createCoreCommanderIdentityV1(value));
assert.deepEqual(identities, commanderInputs);
const replacement = Core.createCoreCommanderReplacementChoiceV1(record(fixture.replacement, 'fixture.replacement'));
assert.deepEqual(replacement, { kind: 'commander-replacement-903.9a', sourceZone: 'graveyard' });

const castLedgerInput = record(fixture.castLedger, 'fixture.castLedger');
const castLedgerBefore = JSON.stringify(castLedgerInput);
const castLedger = Core.createCoreCommanderCastLedgerV1(castLedgerInput);
const castFromCommandZone = Core.recordCoreCommanderCastV1(castLedger, { origin: 'command-zone' });
assert.equal(castLedger.castCount, 0);
assert.equal(castFromCommandZone.castCount, 1);
assert.equal(Core.coreCommanderTaxV1(castFromCommandZone), 2);
assert.equal(JSON.stringify(castLedgerInput), castLedgerBefore);

const damageInput = record(fixture.damageState, 'fixture.damageState');
const damageInputBefore = JSON.stringify(damageInput);
const damageState = Core.createCoreCommanderDamageStateV1(damageInput);
const damageWithCells = [
  { commanderPhysicalCardId: 'C1', defendingPlayerId: 'P1', damage: 3 },
  { commanderPhysicalCardId: 'C1', defendingPlayerId: 'P2', damage: 7 },
  { commanderPhysicalCardId: 'C2', defendingPlayerId: 'P1', damage: 9 },
  { commanderPhysicalCardId: 'C2', defendingPlayerId: 'P2', damage: 5 },
].reduce((state, input) => Core.recordCoreCommanderDamageV1(state, input), damageState);
assert.deepEqual([
  Core.coreCommanderDamageAgainstV1(damageWithCells, 'C1', 'P1'),
  Core.coreCommanderDamageAgainstV1(damageWithCells, 'C1', 'P2'),
  Core.coreCommanderDamageAgainstV1(damageWithCells, 'C2', 'P1'),
  Core.coreCommanderDamageAgainstV1(damageWithCells, 'C2', 'P2'),
], [3, 7, 9, 5]);
assert.equal(JSON.stringify(damageInput), damageInputBefore);

const provenanceInput = record(fixture.provenanceLedger, 'fixture.provenanceLedger');
const provenanceInputBefore = JSON.stringify(provenanceInput);
const provenance = Core.createCoreCommanderDamageProvenanceLedgerV1(provenanceInput);
assert.equal(Core.coreCommanderProvenanceDamageAgainstV1(provenance, 'C1', 'P2'), 21);
assert.equal(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C1', 'P2'), true);
assert.equal(Core.coreCommanderThresholdReachedFromProvenanceV1(provenance, 'C2', 'P2'), false);
assert.equal(JSON.stringify(provenanceInput), provenanceInputBefore);

const combatInput = record(fixture.combatContext, 'fixture.combatContext');
const combatInputBefore = JSON.stringify(combatInput);
const context = Core.createCoreCombatContextV1(combatInput);
assert.deepEqual(Object.keys(context), [
  'combatId', 'turnNumber', 'step', 'attackingPlayerId', 'defendingPlayerIds', 'attacks', 'blocks',
]);
assert.equal(context.combatId, 'combat-01m');
assert.equal(context.turnNumber, 7);
assert.deepEqual(context.attacks.map((attack) => attack.attackerObjectId), ['PC1:0', 'PC2:0', 'PC3:0']);
assert.deepEqual(context.attacks.map((attack) => attack.defendingPlayerId), ['P2', 'P3', 'P4']);
assert.deepEqual(context.blocks.map((block) => block.attackedObjectId), ['PC1:0', 'PC2:0', 'PC3:0']);
assert.equal(JSON.stringify(combatInput), combatInputBefore);
assert.throws(() => Core.addCoreCombatContextAttackV1(context, {
  attackerObjectId: 'PC1:0',
  attackerControllerPlayerId: 'P1',
  defendingPlayerId: 'P3',
}), Core.CoreCombatContextAdditionErrorV1);
const combatAfterExit = Core.reconcileCoreCombatContextForPlayerExitV1(context, {
  exitingPlayerId: 'P3',
  participantObjectIdsToClear: ['PC6:0'],
});
assert.deepEqual(combatAfterExit?.defendingPlayerIds, ['P2', 'P4']);
assert.deepEqual(combatAfterExit?.attacks.map((attack) => attack.attackerObjectId), ['PC1:0', 'PC3:0']);
assert.deepEqual(combatAfterExit?.blocks.map((block) => block.attackedObjectId), ['PC1:0']);
assert.equal(Core.reconcileCoreCombatContextForPlayerExitV1(context, {
  exitingPlayerId: 'P1',
  participantObjectIdsToClear: [],
}), null);

const lifecycleInput = record(fixture.lifecycle, 'fixture.lifecycle');
const lifecycleInputBefore = JSON.stringify(lifecycleInput);
const lifecycle = Core.createCorePlayerLifecycleStateV1(lifecycleInput);
const lifecycleExits = array(fixture.lifecycleExits, 'fixture.lifecycleExits');
assert.equal(lifecycleExits.length, 2);
const firstLifecycleExit = lifecycleExits[0];
const lifecycleAfterConcession = Core.applyCorePlayerExitV1(lifecycle, firstLifecycleExit);
assert.deepEqual(Object.keys(lifecycle), ['players']);
assert.equal(lifecycle.players.length, 4);
assert.deepEqual(lifecycle.players.map((entry) => Object.keys(entry)), [
  ['playerId', 'status', 'exitCause'],
  ['playerId', 'status', 'exitCause'],
  ['playerId', 'status', 'exitCause'],
  ['playerId', 'status', 'exitCause'],
]);
assert.equal(Core.corePlayerLifecycleStatusV1(lifecycleAfterConcession, 'P1'), 'exited');
assert.equal(Core.corePlayerLifecycleExitCauseV1(lifecycleAfterConcession, 'P1'), 'concession');
assert.equal(JSON.stringify(lifecycleInput), lifecycleInputBefore);

const bundleInput = record(fixture.exitReferenceBundle, 'fixture.exitReferenceBundle');
const bundleInputBefore = JSON.stringify(bundleInput);
const bundle = Core.createCorePlayerExitReferenceBundleV1(bundleInput);
assert.deepEqual(Object.keys(bundle), [
  'turnOrder', 'eligiblePlayerIds', 'activePlayerId', 'priorityHolderPlayerId', 'ownedObjectIds',
  'controlledObjectIds', 'nonCardStackObjectIds', 'combatParticipantObjectIds', 'controlEffectIds',
  'decisionAuthorityIds', 'searchSessionIds',
]);
const result = Core.reconcileCorePlayerExitV1(lifecycle, bundle, firstLifecycleExit);
assert.deepEqual(Object.keys(result), [
  'lifecycleState', 'survivingTurnOrder', 'activePlayerAfterExit', 'priorityHandoffPlayerId',
  'ownedObjectsToLeaveGame', 'controlEffectIdsToEnd', 'nonCardStackObjectsToCease',
  'controlledObjectsToExile', 'combatParticipantObjectIdsToClear', 'decisionAuthorityIdsToClear',
  'searchSessionIdsToClose',
]);
assert.deepEqual(result.survivingTurnOrder, ['P2', 'P3', 'P4']);
assert.equal(result.activePlayerAfterExit, null);
assert.equal(result.priorityHandoffPlayerId, 'P2');
assert.deepEqual(result.ownedObjectsToLeaveGame, ['PC1:0', '@token:owned-token:0']);
assert.deepEqual(result.nonCardStackObjectsToCease, ['@triggered-ability:stack-a', '@spell-copy:stack-b']);
assert.deepEqual(result.controlledObjectsToExile, ['PC2:0', '@activated-ability:owned-ability', 'PC3:0']);
assert.deepEqual(result.combatParticipantObjectIdsToClear, ['PC1:0', 'PC4:0']);
assert.equal(new Set([
  ...result.ownedObjectsToLeaveGame,
  ...result.nonCardStackObjectsToCease,
  ...result.controlledObjectsToExile,
]).size, result.ownedObjectsToLeaveGame.length + result.nonCardStackObjectsToCease.length + result.controlledObjectsToExile.length);
assert.equal(JSON.stringify(bundleInput), bundleInputBefore);

const combatRuntimeExports = publicExports.filter((name) => name.toLowerCase().includes('combat'));
const automaticCombatRuntimeExports = combatRuntimeExports.filter((name) =>
  /damage|sba|statebased|assignment/.test(name.toLowerCase()));
const forbiddenContextFields = Object.keys(context).filter((key) =>
  /damage|sba|statebased|assignment|network|room|protocol|transport|connection/.test(key.toLowerCase()));
const forbiddenResultFields = Object.keys(result).filter((key) =>
  /damage|sba|statebased|assignment|network|room|protocol|transport|connection/.test(key.toLowerCase()));
const deferredBoundaryProof = automaticCombatRuntimeExports.length === 0
  && forbiddenContextFields.length === 0
  && forbiddenResultFields.length === 0;
assert.equal(deferredBoundaryProof, true);
assert.equal(combatRuntimeExports.includes('coreCommanderDamageAgainstV1'), false);
assert.equal(publicExports.includes('coreCommanderDamageAgainstV1'), true);
assert.equal(publicExports.includes('recordCoreCommanderDamageV1'), true);

const forbiddenKeys = /^(disconnect|connected|timeout|browser|transport|network|room|protocol|connection|websocket|automaticdamage|automaticdamageapplication|automaticsba|automaticstatebasedactions|statebasedactions|damageassignment|damageapplication)$/i;
const returnedValues: readonly unknown[] = [
  replacement, identities, castLedger, castFromCommandZone, damageState, damageWithCells,
  provenance, context, combatAfterExit, lifecycle, lifecycleAfterConcession, bundle, result,
];
assert.equal(runtimeKeys(fixture).some((key) => forbiddenKeys.test(key)), false);
assert.equal(returnedValues.some((value) => runtimeKeys(value).some((key) => forbiddenKeys.test(key))), false);
assert.equal(JSON.stringify(fixture), fixtureBefore);
assertFrozenAndSerializable([
  ['replacement', replacement],
  ['castLedger', castLedger],
  ['castFromCommandZone', castFromCommandZone],
  ['damageState', damageState],
  ['damageWithCells', damageWithCells],
  ['provenance', provenance],
  ['context', context],
  ['combatAfterExit', combatAfterExit],
  ['lifecycle', lifecycle],
  ['lifecycleAfterConcession', lifecycleAfterConcession],
  ['bundle', bundle],
  ['result', result],
]);
identities.forEach((identity, index) => {
  assertFrozenAndSerializable([[`identity${index + 1}`, identity]]);
});

console.log(
  `fixture=${fixture.version} commanders=4 damageCells=4 provenanceThreshold=true `
  + 'combat=structural-only/multi-defender/multi-blocker lifecycle=concession+defeat '
  + 'atomicExit=true cleanupDisjoint=true canonical=true frozen=true immutable=true '
  + 'jsonRoundTrip=true networkAuthority=false deferProof=public-exports-and-runtime-shapes',
);
