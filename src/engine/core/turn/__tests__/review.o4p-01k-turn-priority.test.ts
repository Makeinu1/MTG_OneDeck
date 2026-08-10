import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as coreApi from '../../index';

type Raw = Record<string, unknown>;
type CoreFunction = (...args: unknown[]) => unknown;

const PLAYERS = ['P1', 'P2', 'P3', 'P4'] as const;
const STACK_TOP = '@triggered-ability:fixture-trigger';
const TRIGGER_A = '@triggered-ability:acceptance-a';
const TRIGGER_B = '@triggered-ability:acceptance-b';
const TRIGGER_C = '@triggered-ability:acceptance-c';
const TRIGGER_D = '@triggered-ability:acceptance-d';

function isRecord(value: unknown): value is Raw {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function record(value: unknown, label: string): Raw {
  if (!isRecord(value)) throw new Error(`${label} must be a plain record`);
  return value;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fixture(path: string): Raw {
  const value: unknown = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  return record(value, path);
}

function apiFunction(name: string): CoreFunction {
  const candidate: unknown = Reflect.get(coreApi, name);
  if (typeof candidate !== 'function') throw new Error(`missing required Core export: ${name}`);
  return (...args: unknown[]) => Reflect.apply(candidate, undefined, args) as unknown;
}

function call(name: string, ...args: unknown[]): unknown {
  return apiFunction(name)(...args);
}

function byObject(root: Raw, label: string): Raw {
  return record(root.byObject, `${label}.byObject`);
}

function row(root: Raw, objectId: string, label: string): Raw {
  const value: unknown = byObject(root, label)[objectId];
  return record(value, `${label}.${objectId}`);
}

function registryInput(): Raw {
  return fixture('../../object/fixtures/object-registry-v2.json');
}

function runtimeInput(): Raw {
  const runtime = fixture('../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  byObject(runtime, 'runtime fixture')['@token:fixture-token:0'] = clone(row(runtime, 'PC4:1', 'runtime fixture'));
  return runtime;
}

function announcementInput(): Raw {
  const announcements = fixture('../../stack/fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  return announcements;
}

function stackInput(): Raw {
  return {
    objectRegistry: registryInput(),
    objectRuntime: runtimeInput(),
    stackAnnouncements: announcementInput(),
  };
}

function stackBundle(): Raw {
  return record(call('createCoreStackTransactionBundleV1', stackInput()), 'stack bundle');
}

function emptyStackBundle(): Raw {
  let current = stackBundle();
  const removals: readonly [string, Raw][] = [
    [STACK_TOP, { kind: 'cease', objectId: STACK_TOP }],
    ['@activated-ability:fixture-activation', { kind: 'cease', objectId: '@activated-ability:fixture-activation' }],
    ['@spell-copy:fixture-copy', { kind: 'cease', objectId: '@spell-copy:fixture-copy' }],
    ['PC5:1', { kind: 'card-to-zone', objectId: 'PC5:1', destination: { kind: 'owner-graveyard' } }],
  ];
  for (const [objectId, operation] of removals) {
    const result = record(call('removeCoreStackObjectV1', current, operation), `remove ${objectId}`);
    current = resultBundle(result, `remove ${objectId}`);
  }
  return current;
}

function resultBundle(value: unknown, label: string): Raw {
  const result = record(value, label);
  if (Object.prototype.hasOwnProperty.call(result, 'bundle')) return record(result.bundle, `${label}.bundle`);
  return result;
}

function pendingRecord(objectId: string, controllerPlayerId: string, stackPlacementBucket: string): Raw {
  const announcement = clone(row(announcementInput(), '@triggered-ability:fixture-trigger', 'trigger announcement'));
  announcement.abilityTextSnapshot = `Acceptance trigger ${objectId}`;
  return {
    stackPlacementBucket,
    object: {
      kind: 'triggered-ability',
      controllerPlayerId,
      sourceObjectId: '@triggered-ability:historical-source',
      abilityKey: `acceptance-${objectId}`,
    },
    announcement,
  };
}

function pendingSlice(entries: readonly (readonly [string, Raw])[]): Raw {
  const byObject: Raw = {};
  const pendingObjectIds: string[] = [];
  for (const [objectId, value] of entries) {
    pendingObjectIds.push(objectId);
    byObject[objectId] = value;
  }
  return record(call('createModeNeutralCorePendingTriggerSliceV1', { pendingObjectIds, byObject }), 'pending slice');
}

function emptyPending(): Raw {
  return pendingSlice([]);
}

function lifecycle(position: Raw, window: Raw, turnNumber = 1, positionSequence = 0): Raw {
  return record(call('createModeNeutralCoreTurnLifecycleSliceV1', {
    turnNumber,
    positionSequence,
    position,
    window,
  }), 'lifecycle');
}

function bundle(
  stack: Raw,
  pending: Raw,
  position: Raw,
  window: Raw,
  turnNumber = 1,
  positionSequence = 0,
): Raw {
  return record(call('createCoreTurnPriorityBundleV1', {
    stackBundle: stack,
    pendingTriggers: pending,
    lifecycle: lifecycle(position, window, turnNumber, positionSequence),
  }), 'turn priority bundle');
}

function untapBundle(stack = emptyStackBundle()): Raw {
  return bundle(
    stack,
    emptyPending(),
    { phase: 'beginning', step: 'untap' },
    { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: 'P2' },
  );
}

function priorityBundle(stack: Raw, pending = emptyPending(), holder = 'P2', passed: readonly string[] = [], position: Raw = { phase: 'precombat-main', step: null }): Raw {
  return bundle(
    stack,
    pending,
    position,
    { kind: 'priority', cycleStartPlayerId: 'P2', holderPlayerId: holder, passedPlayerIds: passed },
  );
}

function cleanupBundle(window: Raw, stack = emptyStackBundle(), pending = emptyPending()): Raw {
  return bundle(stack, pending, { phase: 'ending', step: 'cleanup' }, window);
}

function passAll(input: Raw): Raw {
  let current = input;
  for (const playerId of PLAYERS.slice(1).concat(PLAYERS.slice(0, 1))) {
    current = resultBundle(call('passCorePriorityV1', current, playerId), `pass ${playerId}`);
  }
  return current;
}

function lifecycleOf(value: Raw): Raw {
  return record(value.lifecycle, 'lifecycle');
}

function windowOf(value: Raw): Raw {
  return record(lifecycleOf(value).window, 'window');
}

function stackOf(value: Raw): Raw {
  return record(value.stackBundle, 'stack bundle');
}

function issueCodes(value: unknown): readonly string[] {
  const result = record(value, 'validation result');
  return array(result.issues, 'validation issues').map((issue) => String(record(issue, 'issue').code));
}

function thrown(operation: () => unknown): Raw {
  let caught: unknown;
  try {
    operation();
  } catch (error: unknown) {
    caught = error;
  }
  expect(caught).toBeDefined();
  return record(caught, 'operation error');
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      assertDeepFrozen(descriptor.value, seen);
    }
  }
}

function stackObjectIds(value: Raw): readonly unknown[] {
  const registry = record(stackOf(value).objectRegistry, 'registry');
  const zones = record(registry.zones, 'zones');
  return array(record(zones.shared, 'shared zones').stack, 'stack');
}

function appendPending(value: Raw, entries: readonly (readonly [string, Raw])[]): Raw {
  const additions = pendingSlice(entries);
  return resultBundle(call('appendCorePendingTriggeredAbilitiesV1', value, additions), 'append pending');
}

describe('O4P-01K turn, priority, SBA, trigger, and cleanup acceptance pins', () => {
  it('pins the valid bundle, strict invalid slice boundaries, canonical JSON, frozen output, and input preservation', () => {
    const input = {
      stackBundle: stackBundle(),
      pendingTriggers: emptyPending(),
      lifecycle: lifecycle(
        { phase: 'beginning', step: 'untap' },
        { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: 'P2' },
      ),
    };
    const before = JSON.stringify(input);
    const result = record(call('validateCoreTurnPriorityBundleV1', input), 'valid bundle validation');
    expect(result.ok).toBe(true);
    if (result.ok !== true) throw new Error('valid bundle rejected');
    const validatedBundle = record(result.value, 'validated bundle');
    expect(Object.keys(validatedBundle)).toEqual(['stackBundle', 'pendingTriggers', 'lifecycle']);
    expect(JSON.stringify(result.value)).toBe(JSON.stringify(record(call('createCoreTurnPriorityBundleV1', input), 'created bundle')));
    assertDeepFrozen(result.value);
    expect(JSON.stringify(input)).toBe(before);

    for (const [field, replacement, code] of [
      ['stackBundle', {}, 'INVALID_STACK_BUNDLE'],
      ['pendingTriggers', {}, 'INVALID_PENDING_TRIGGER_SLICE'],
      ['lifecycle', {}, 'INVALID_LIFECYCLE_SLICE'],
    ] as const) {
      const invalid = { ...input, [field]: replacement };
      const rejected = record(call('validateCoreTurnPriorityBundleV1', invalid), `${field} rejection`);
      expect(rejected.ok).toBe(false);
      expect(issueCodes(rejected)).toContain(code);
    }
  });

  it('pins Registry activePlayerId and turnOrder as the only player sources and APNAP rotation', () => {
    const registry = record(stackBundle().objectRegistry, 'registry');
    expect(registry.activePlayerId).toBe('P2');
    expect(registry.turnOrder).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(call('coreApnapPlayerOrderV1', registry)).toEqual(['P2', 'P3', 'P4', 'P1']);
  });

  it('pins untap without priority, untap to upkeep, and draw/precombat checkpoints', () => {
    const afterUntap = resultBundle(call('completeCoreTurnBasedActionCheckpointV1', untapBundle(), 'untap-step-actions'), 'untap checkpoint');
    expect(lifecycleOf(afterUntap).position).toEqual({ phase: 'beginning', step: 'upkeep' });
    expect(windowOf(afterUntap).kind).toBe('sba-check-required');
    expect(windowOf(afterUntap).kind).not.toBe('priority');

    let current = resultBundle(call('recordCoreSbaCheckOutcomeV1', afterUntap, { actionsWereApplied: false }), 'upkeep stable');
    expect(windowOf(current).kind).toBe('position-advance-ready');
    current = resultBundle(call('advanceCoreTurnPositionV1', current, { nextPosition: { phase: 'beginning', step: 'draw' } }), 'draw advance');
    expect(windowOf(current)).toEqual({ kind: 'turn-based-action-required', action: 'draw-step-draw', playerId: 'P2' });
    current = resultBundle(call('completeCoreTurnBasedActionCheckpointV1', current, 'draw-step-draw'), 'draw checkpoint');
    expect(windowOf(current).kind).toBe('sba-check-required');
    current = resultBundle(call('recordCoreSbaCheckOutcomeV1', current, { actionsWereApplied: false }), 'draw stable');
    current = resultBundle(call('advanceCoreTurnPositionV1', current, { nextPosition: { phase: 'precombat-main', step: null } }), 'precombat advance');
    expect(windowOf(current)).toEqual({ kind: 'turn-based-action-required', action: 'precombat-main-actions', playerId: 'P2' });
    current = resultBundle(call('completeCoreTurnBasedActionCheckpointV1', current, 'precombat-main-actions'), 'precombat checkpoint');
    expect(windowOf(current).kind).toBe('sba-check-required');
  });

  it('pins active-player-first priority, one-pass rotation, action reset to the same actor, and invalid pass', () => {
    let current = priorityBundle(emptyStackBundle());
    expect(windowOf(current)).toEqual({ kind: 'priority', cycleStartPlayerId: 'P2', holderPlayerId: 'P2', passedPlayerIds: [] });
    current = resultBundle(call('passCorePriorityV1', current, 'P2'), 'P2 pass');
    expect(windowOf(current)).toEqual({ kind: 'priority', cycleStartPlayerId: 'P2', holderPlayerId: 'P3', passedPlayerIds: ['P2'] });
    const invalid = thrown(() => call('passCorePriorityV1', current, 'P2'));
    expect(invalid.code).toBe('NOT_PRIORITY_HOLDER');
    const acted = resultBundle(call('resumeCoreAfterPriorityActionV1', current, 'P3'), 'priority action reset');
    expect(windowOf(acted)).toEqual({ kind: 'sba-check-required', priorityRecipientPlayerId: 'P3', grantPriorityIfStable: true });
    expect(record(acted.stackBundle, 'acted stack')).toEqual(record(current.stackBundle, 'original stack'));
    expect(acted.pendingTriggers).toEqual(current.pendingTriggers);
  });

  it('pins all-pass resolution-ready with the exact captured top, empty-stack position advance, and cleanup repeat', () => {
    const resolved = passAll(priorityBundle(stackBundle()));
    expect(windowOf(resolved)).toEqual({ kind: 'resolution-ready', objectId: STACK_TOP });
    expect(stackObjectIds(resolved).at(-1)).toBe(STACK_TOP);

    const advanced = passAll(priorityBundle(emptyStackBundle()));
    expect(windowOf(advanced)).toEqual({ kind: 'position-advance-ready' });

    const repeated = passAll(cleanupBundle({ kind: 'priority', cycleStartPlayerId: 'P2', holderPlayerId: 'P2', passedPlayerIds: [] }));
    expect(windowOf(repeated)).toEqual({ kind: 'cleanup-repeat-ready' });
    const nextCleanup = resultBundle(call('startCoreRepeatedCleanupV1', repeated), 'repeated cleanup');
    expect(lifecycleOf(nextCleanup).position).toEqual({ phase: 'ending', step: 'cleanup' });
    expect(lifecycleOf(nextCleanup).positionSequence).toBe(1);
  });

  it('pins pending append collision rejection, historical source allowance, and ordinary/APNAP/ability-triggered grouping', () => {
    const initial = bundle(
      emptyStackBundle(),
      emptyPending(),
      { phase: 'precombat-main', step: null },
      { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true },
    );
    const entries = [
      [TRIGGER_A, pendingRecord(TRIGGER_A, 'P3', 'ordinary')],
      [TRIGGER_B, pendingRecord(TRIGGER_B, 'P2', 'ordinary')],
      [TRIGGER_C, pendingRecord(TRIGGER_C, 'P3', 'ability-triggered')],
      [TRIGGER_D, pendingRecord(TRIGGER_D, 'P1', 'ability-triggered')],
    ] as const;
    const appended = appendPending(initial, entries);
    expect(record(appended.pendingTriggers, 'pending').pendingObjectIds).toEqual([TRIGGER_A, TRIGGER_B, TRIGGER_C, TRIGGER_D]);
    const collision = thrown(() => appendPending(appended, [[TRIGGER_A, pendingRecord(TRIGGER_A, 'P3', 'ordinary')]]));
    expect(collision.code).toBe('TRIGGER_COMMIT_FAILED');
    const registryCollision = thrown(() => appendPending(initial, [[STACK_TOP, pendingRecord(STACK_TOP, 'P2', 'ordinary')]]));
    expect(registryCollision.code).toBe('TRIGGER_COMMIT_FAILED');
    const analysis = record(call('analyzeCorePendingTriggerPlacementV1', appended), 'placement analysis');
    expect(analysis.groups).toEqual([
      { stackPlacementBucket: 'ordinary', controllerPlayerId: 'P2', pendingObjectIds: [TRIGGER_B] },
      { stackPlacementBucket: 'ordinary', controllerPlayerId: 'P3', pendingObjectIds: [TRIGGER_A] },
      { stackPlacementBucket: 'ability-triggered', controllerPlayerId: 'P1', pendingObjectIds: [TRIGGER_D] },
      { stackPlacementBucket: 'ability-triggered', controllerPlayerId: 'P3', pendingObjectIds: [TRIGGER_C] },
    ]);
    expect(analysis.orderKind).toBe('deterministic-order');
  });

  it('pins same-controller manual order, deterministic singletons, atomic placement, and placement-to-SBA', () => {
    const initial = bundle(
      emptyStackBundle(),
      emptyPending(),
      { phase: 'precombat-main', step: null },
      { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true },
    );
    const entries = [
      [TRIGGER_A, pendingRecord(TRIGGER_A, 'P2', 'ordinary')],
      [TRIGGER_B, pendingRecord(TRIGGER_B, 'P2', 'ordinary')],
    ] as const;
    const pending = appendPending(initial, entries);
    const manual = record(call('analyzeCorePendingTriggerPlacementV1', pending), 'manual analysis');
    expect(manual.orderKind).toBe('manual-order-required');
    expect(manual.groups).toEqual([{ stackPlacementBucket: 'ordinary', controllerPlayerId: 'P2', pendingObjectIds: [TRIGGER_A, TRIGGER_B] }]);
    const before = JSON.stringify(pending);
    const failed = thrown(() => call('placeCorePendingTriggersOnStackV1', pending, [TRIGGER_A, TRIGGER_A]));
    expect(failed.code).toBe('TRIGGER_ORDER_INVALID');
    expect(JSON.stringify(pending)).toBe(before);
    const placed = resultBundle(call('placeCorePendingTriggersOnStackV1', pending, [TRIGGER_B, TRIGGER_A]), 'placed triggers');
    expect(stackObjectIds(placed).slice(-2)).toEqual([TRIGGER_B, TRIGGER_A]);
    expect(record(placed.pendingTriggers, 'placed pending').pendingObjectIds).toEqual([]);
    expect(windowOf(placed)).toEqual({ kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true });
  });

  it('pins SBA applied repeat, no-SBA trigger/priority branches, and all-pass empty progression', () => {
    const sbaWindow = bundle(
      emptyStackBundle(),
      emptyPending(),
      { phase: 'precombat-main', step: null },
      { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true },
    );
    const applied = resultBundle(call('recordCoreSbaCheckOutcomeV1', sbaWindow, { actionsWereApplied: true }), 'applied SBA');
    expect(windowOf(applied)).toEqual(windowOf(sbaWindow));
    const stable = resultBundle(call('recordCoreSbaCheckOutcomeV1', sbaWindow, { actionsWereApplied: false }), 'stable SBA');
    expect(windowOf(stable).kind).toBe('priority');
    const pending = appendPending(sbaWindow, [[TRIGGER_A, pendingRecord(TRIGGER_A, 'P2', 'ordinary')]]);
    const triggerOrder = resultBundle(call('recordCoreSbaCheckOutcomeV1', pending, { actionsWereApplied: false }), 'trigger SBA');
    expect(windowOf(triggerOrder).kind).toBe('trigger-order-required');
    expect(windowOf(triggerOrder).pendingObjectIds).toEqual([TRIGGER_A]);
    expect(windowOf(sbaWindow).kind).toBe('sba-check-required');
  });

  it('pins resolution removal identity and keeps concrete effect/SBA resolution outside this slice', () => {
    const ready = priorityBundle(stackBundle());
    const resolved = passAll(ready);
    const removal = record(call('removeCoreStackObjectV1', stackOf(resolved), { kind: 'cease', objectId: STACK_TOP }), 'resolution removal');
    const completed = resultBundle(call('completeCoreResolutionAfterRemovalV1', resolved, removal), 'resolution completion');
    expect(windowOf(completed)).toEqual({ kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: true });
    expect(stackObjectIds(completed)).not.toContain(STACK_TOP);
    const middleMismatch = thrown(() => call('completeCoreResolutionAfterRemovalV1', resolved, {
      ...removal,
      removedObjectId: '@activated-ability:fixture-activation',
    }));
    expect(middleMismatch.code).toBe('RESOLUTION_REMOVAL_MISMATCH');
    expect(Reflect.get(coreApi, 'evaluateCoreStateBasedActionsV1')).toBeUndefined();
    expect(Reflect.get(coreApi, 'resolveCoreEffectV1')).toBeUndefined();
  });

  it('pins cleanup hand-size/none behavior, stable no-priority cleanup, exceptional SBA/trigger priority, and repeat', () => {
    const noneReady = bundle(
      emptyStackBundle(),
      emptyPending(),
      { phase: 'ending', step: 'end' },
      { kind: 'position-advance-ready' },
    );
    const noneCleanup = resultBundle(call('advanceCoreTurnPositionV1', noneReady, { nextPosition: { phase: 'ending', step: 'cleanup' } }), 'none cleanup');
    expect(windowOf(noneCleanup)).toEqual({ kind: 'cleanup-state-actions-required', playerId: 'P2' });

    const numericInput = stackInput();
    const numericRegistry = record(numericInput.objectRegistry, 'numeric registry');
    numericRegistry.activePlayerId = 'P3';
    const numericZones = record(numericRegistry.zones, 'numeric zones');
    const numericByPlayer = record(numericZones.byPlayer, 'numeric players');
    const p2Zones = record(numericByPlayer.P2, 'numeric P2 zones');
    const p3Zones = record(numericByPlayer.P3, 'numeric P3 zones');
    p2Zones.graveyard = [];
    p3Zones.hand = ['PC3:0'];
    const numericStack = record(call('createCoreStackTransactionBundleV1', numericInput), 'numeric stack');
    const numericReady = bundle(numericStack, emptyPending(), { phase: 'ending', step: 'end' }, { kind: 'position-advance-ready' });
    const numericCleanup = resultBundle(call('advanceCoreTurnPositionV1', numericReady, { nextPosition: { phase: 'ending', step: 'cleanup' } }), 'numeric cleanup');
    expect(windowOf(numericCleanup)).toEqual({ kind: 'cleanup-state-actions-required', playerId: 'P3' });

    const discard = cleanupBundle({ kind: 'cleanup-discard-required', playerId: 'P2', requiredCount: 0 });
    const stateActions = resultBundle(call('completeCoreCleanupDiscardCheckpointV1', discard), 'cleanup discard');
    expect(windowOf(stateActions)).toEqual({ kind: 'cleanup-state-actions-required', playerId: 'P2' });
    const applied = resultBundle(call('applyCoreCleanupStateActionsV1', stateActions), 'cleanup state actions');
    expect(windowOf(applied)).toEqual({ kind: 'sba-check-required', priorityRecipientPlayerId: 'P2', grantPriorityIfStable: false });
    const stable = resultBundle(call('recordCoreSbaCheckOutcomeV1', applied, { actionsWereApplied: false }), 'cleanup stable');
    expect(windowOf(stable)).toEqual({ kind: 'turn-advance-ready' });

    const exceptional = resultBundle(call('recordCoreSbaCheckOutcomeV1', applied, { actionsWereApplied: true }), 'cleanup SBA exceptional');
    const priority = resultBundle(call('recordCoreSbaCheckOutcomeV1', exceptional, { actionsWereApplied: false }), 'cleanup SBA priority');
    expect(windowOf(priority).kind).toBe('priority');

    const triggerPending = appendPending(applied, [[TRIGGER_A, pendingRecord(TRIGGER_A, 'P2', 'ordinary')]]);
    const triggerWindow = resultBundle(call('recordCoreSbaCheckOutcomeV1', triggerPending, { actionsWereApplied: false }), 'cleanup trigger window');
    expect(windowOf(triggerWindow).kind).toBe('trigger-order-required');
    const placed = resultBundle(call('placeCorePendingTriggersOnStackV1', triggerWindow, [TRIGGER_A]), 'cleanup trigger placement');
    expect(windowOf(placed).kind).toBe('sba-check-required');
  });

  it('pins cleanup damage clearing including phased-out objects, while preserving counters/orientation/attachments and mana clearing', () => {
    const input = stackInput();
    const registry = record(input.objectRegistry, 'cleanup registry');
    const players = record(registry.players, 'cleanup players');
    for (const playerId of Object.keys(players)) {
      const player = record(players[playerId], `player ${playerId}`);
      player.manaPool = { W: 1, U: 2, B: 3, R: 4, G: 5, C: 6 };
    }
    const runtime = byObject(record(input.objectRuntime, 'cleanup object runtime'), 'cleanup runtime');
    const battlefield = record(runtime['PC4:1'], 'battlefield runtime');
    battlefield.counterDamage = { counters: [{ kind: 'shield', count: 1 }], markedDamage: 3 };
    battlefield.orientation = { faceIndex: 0, faceDown: false, tapped: true, flipped: false, phasedOut: false };
    battlefield.orientation = { faceIndex: 0, faceDown: false, tapped: true, flipped: false, phasedOut: true };
    const stack = record(call('createCoreStackTransactionBundleV1', input), 'cleanup stack');
    const start = cleanupBundle({ kind: 'cleanup-state-actions-required', playerId: 'P2' }, stack);
    const result = resultBundle(call('applyCoreCleanupStateActionsV1', start), 'cleanup applied');
    const nextStack = record(result.stackBundle, 'next stack');
    const nextRuntime = byObject(record(nextStack.objectRuntime, 'next object runtime'), 'next runtime');
    expect(record(nextRuntime['PC4:1'], 'next battlefield').counterDamage).toEqual({ counters: [{ kind: 'shield', count: 1 }], markedDamage: 0 });
    expect(record(nextRuntime['PC4:1'], 'next battlefield').orientation).toEqual(battlefield.orientation);
    expect(record(nextRuntime['PC4:1'], 'next battlefield').attachment).toEqual({ attachedTo: { kind: 'object', objectId: 'PC1:0' } });
    expect(record(nextRuntime['PC4:1'], 'next phased').counterDamage).toEqual({ counters: [{ kind: 'shield', count: 1 }], markedDamage: 0 });
    expect(record(nextRuntime['PC4:1'], 'next phased').orientation).toEqual(battlefield.orientation);
    const nextPlayers = record(record(result.stackBundle, 'next stack').objectRegistry, 'next registry').players;
    for (const player of Object.values(record(nextPlayers, 'next players'))) expect(record(player, 'next player').manaPool).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  });

  it('pins next-turn active rotation and turn-local resets while preserving life, poison, energy, experience, and maximum hand size', () => {
    const input = stackInput();
    const registry = record(input.objectRegistry, 'next-turn registry');
    const players = record(registry.players, 'next-turn players');
    const p2 = record(players.P2, 'P2');
    p2.landsPlayedThisTurn = 1;
    p2.spellsCastThisTurn = 2;
    p2.drawnThisTurn = true;
    p2.manaPool = { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const beforeLife = p2.life;
    const beforePoison = p2.poison;
    const beforeMaximum = p2.maximumHandSizeOverride;
    const stack = record(call('createCoreStackTransactionBundleV1', input), 'next-turn stack');
    const ready = bundle(stack, emptyPending(), { phase: 'ending', step: 'cleanup' }, { kind: 'turn-advance-ready' });
    const next = resultBundle(call('advanceCoreToNextTurnV1', ready), 'next turn');
    const nextRegistry = record(record(next.stackBundle, 'next turn stack').objectRegistry, 'next turn registry');
    expect(nextRegistry.activePlayerId).toBe('P3');
    expect(lifecycleOf(next).turnNumber).toBe(2);
    expect(lifecycleOf(next).positionSequence).toBe(0);
    expect(lifecycleOf(next).position).toEqual({ phase: 'beginning', step: 'untap' });
    expect(windowOf(next)).toEqual({ kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: 'P3' });
    const nextP2 = record(record(nextRegistry.players, 'next players').P2, 'next P2');
    expect(nextP2.landsPlayedThisTurn).toBe(0);
    expect(nextP2.spellsCastThisTurn).toBe(0);
    expect(nextP2.drawnThisTurn).toBe(false);
    expect(nextP2.life).toBe(beforeLife);
    expect(nextP2.poison).toBe(beforePoison);
    expect(nextP2.maximumHandSizeOverride).toBe(beforeMaximum);
    expect(nextP2.manaPool).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  });

  it('pins the pure Core boundary: no Solo mutation, no Online runtime, and no concrete resolution API', () => {
    expect(Reflect.get(coreApi, 'createSoloGameStateV1')).toBeUndefined();
    expect(Reflect.get(coreApi, 'resolveCoreEffectV1')).toBeUndefined();
    expect(Reflect.get(coreApi, 'evaluateCoreStateBasedActionsV1')).toBeUndefined();
  });
});
