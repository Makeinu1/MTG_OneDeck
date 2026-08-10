#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  advanceCoreToNextTurnV1,
  analyzeCorePendingTriggerPlacementV1,
  applyCoreCleanupStateActionsV1,
  completeCoreTurnBasedActionCheckpointV1,
  coreApnapPlayerOrderV1,
  createCoreTurnPriorityBundleV1,
  createModeNeutralCorePendingTriggerSliceV1,
  createModeNeutralCoreTurnLifecycleSliceV1,
  passCorePriorityV1,
  placeCorePendingTriggersOnStackV1,
  recordCoreSbaCheckOutcomeV1,
  removeCoreStackObjectV1,
  validateCoreTurnPriorityBundleV1,
} from '../../src/engine/core';
import type {
  CorePlayerId,
  CoreStackTransactionBundleV1,
  CoreTurnPriorityBundleV1,
  CoreTurnPositionV1,
  CoreTurnWindowV1,
} from '../../src/engine/core';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(repositoryRoot, 'src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json');

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain record`);
  }
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

function playerId(value: string): CorePlayerId {
  return value as CorePlayerId;
}

function emptyPending(): ReturnType<typeof createModeNeutralCorePendingTriggerSliceV1> {
  return createModeNeutralCorePendingTriggerSliceV1({ pendingObjectIds: [], byObject: {} });
}

function bundleAt(
  stackBundle: CoreStackTransactionBundleV1,
  pendingTriggers: CoreTurnPriorityBundleV1['pendingTriggers'],
  position: CoreTurnPositionV1,
  window: CoreTurnWindowV1,
  turnNumber = 4,
  positionSequence = 0,
): CoreTurnPriorityBundleV1 {
  return createCoreTurnPriorityBundleV1({
    stackBundle,
    pendingTriggers,
    lifecycle: createModeNeutralCoreTurnLifecycleSliceV1({
      turnNumber,
      positionSequence,
      position,
      window,
    }),
  });
}

function emptyStack(bundle: CoreStackTransactionBundleV1): CoreStackTransactionBundleV1 {
  let current = bundle;
  while (current.objectRegistry.zones.shared.stack.length > 0) {
    const currentObjectId = current.objectRegistry.zones.shared.stack.at(-1);
    if (currentObjectId === undefined) throw new Error('Stack unexpectedly became empty');
    const removal = currentObjectId.startsWith('@')
      ? removeCoreStackObjectV1(current, { kind: 'cease', objectId: currentObjectId })
      : removeCoreStackObjectV1(current, {
        kind: 'card-to-zone',
        objectId: currentObjectId,
        destination: { kind: 'owner-graveyard' },
      });
    current = removal.bundle;
  }
  return current;
}

function passAll(bundle: CoreTurnPriorityBundleV1): CoreTurnPriorityBundleV1 {
  let current = bundle;
  for (const id of ['P2', 'P3', 'P4', 'P1']) {
    current = passCorePriorityV1(current, playerId(id));
  }
  return current;
}

const fixtureInput: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'));
const fixtureRoot = record(fixtureInput, 'fixture');
const fixtureBundleInput = record(fixtureRoot.bundle, 'fixture.bundle');
const before = JSON.stringify(fixtureInput);
const validated = validateCoreTurnPriorityBundleV1(fixtureBundleInput);
assert.equal(validated.ok, true, JSON.stringify(validated));
if (!validated.ok) throw new Error('Turn priority fixture is invalid');
const bundle = createCoreTurnPriorityBundleV1(validated.value);
const registry = bundle.stackBundle.objectRegistry;
assert.equal(registry.turnOrder.length, 4);
assert.equal(registry.activePlayerId, playerId('P2'));
assert.deepEqual(coreApnapPlayerOrderV1(registry), ['P2', 'P3', 'P4', 'P1']);

const triggerWindow = recordCoreSbaCheckOutcomeV1(bundle, { actionsWereApplied: false });
assert.equal(triggerWindow.lifecycle.window.kind, 'trigger-order-required');
const analysis = analyzeCorePendingTriggerPlacementV1(triggerWindow);
assert.equal(analysis.orderKind, 'manual-order-required');
const placed = placeCorePendingTriggersOnStackV1(triggerWindow, analysis.orderedObjectIds);
assert.equal(placed.pendingTriggers.pendingObjectIds.length, 0);
assert.equal(placed.lifecycle.window.kind, 'sba-check-required');

const stackless = emptyStack(placed.stackBundle);
const priority = bundleAt(
  stackless,
  emptyPending(),
  { phase: 'precombat-main', step: null },
  { kind: 'priority', cycleStartPlayerId: playerId('P2'), holderPlayerId: playerId('P2'), passedPlayerIds: [] },
);
const positionReady = passAll(priority);
assert.deepEqual(positionReady.lifecycle.window, { kind: 'position-advance-ready' });
const actionCheckpoint = bundleAt(
  stackless,
  emptyPending(),
  { phase: 'beginning', step: 'untap' },
  { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: playerId('P2') },
);
const upkeep = completeCoreTurnBasedActionCheckpointV1(actionCheckpoint, 'untap-step-actions');
assert.equal(upkeep.lifecycle.position.phase, 'beginning');
assert.equal(upkeep.lifecycle.position.step, 'upkeep');
assert.equal(upkeep.lifecycle.window.kind, 'sba-check-required');

const cleanupReady = bundleAt(
  stackless,
  emptyPending(),
  { phase: 'ending', step: 'cleanup' },
  { kind: 'cleanup-state-actions-required', playerId: playerId('P2') },
);
const cleanupApplied = applyCoreCleanupStateActionsV1(cleanupReady);
assert.equal(cleanupApplied.lifecycle.window.kind, 'sba-check-required');
for (const state of Object.values(cleanupApplied.stackBundle.objectRuntime.byObject)) {
  assert.equal(state.counterDamage.markedDamage, 0);
}
const turnReady = recordCoreSbaCheckOutcomeV1(cleanupApplied, { actionsWereApplied: false });
assert.equal(turnReady.lifecycle.window.kind, 'turn-advance-ready');
const nextTurn = advanceCoreToNextTurnV1(turnReady);
assert.equal(nextTurn.stackBundle.objectRegistry.activePlayerId, playerId('P3'));
assert.equal(nextTurn.lifecycle.turnNumber, 5);
assert.equal(nextTurn.lifecycle.positionSequence, 0);

const roundTrip = validateCoreTurnPriorityBundleV1(JSON.parse(JSON.stringify(nextTurn)) as unknown);
assert.equal(roundTrip.ok, true, JSON.stringify(roundTrip));
assert.equal(deepFrozen(nextTurn), true);
assert.equal(JSON.stringify(fixtureInput), before);

console.log(
  `lifecycle=mode-neutral-core-turn-priority-v1 players=${registry.turnOrder.length}`
  + ` activePlayer=${registry.activePlayerId} turn=${nextTurn.lifecycle.turnNumber}`
  + ` position=${nextTurn.lifecycle.position.phase}/${nextTurn.lifecycle.position.step ?? 'main'}`
  + ` pendingTriggers=${nextTurn.pendingTriggers.pendingObjectIds.length}`
  + ' priority=ok apnap=ok cleanup=ok canonical=ok frozen=true',
);
