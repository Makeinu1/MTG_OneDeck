import type {
  CoreManaPoolV1,
  CorePlayerStateV1,
} from '../identityZoneState';
import type {
  ModeNeutralCoreObjectRegistrySliceV2,
  ModeNeutralCoreObjectRuntimeSliceV2,
} from '../object/objectRegistryStateV2';
import type { CoreObjectId, CorePlayerId } from '../ids';
import type { CoreStackTransactionBundleV1 } from '../stack/transaction/stackTransactionBundleV1';
import {
  CoreTurnPriorityOperationErrorV1,
  type CoreTurnPriorityOperationCodeV1,
} from './turnPriorityErrorV1';
import type {
  CoreTurnLifecycleSliceV1,
  CoreTurnWindowV1,
} from './turnLifecycleV1';
import {
  validateCoreTurnPositionV1,
  type CoreTurnPositionV1,
} from './turnPositionV1';

export type CoreTurnPendingTriggerComponentV1 = Readonly<{
  readonly pendingObjectIds: readonly CoreObjectId[];
}>;

export type CoreTurnAdvanceBundleV1<
  TPending extends CoreTurnPendingTriggerComponentV1 = CoreTurnPendingTriggerComponentV1,
> = Readonly<{
  readonly stackBundle: CoreStackTransactionBundleV1;
  readonly pendingTriggers: TPending;
  readonly lifecycle: CoreTurnLifecycleSliceV1;
}>;

export type CoreTurnBasedActionV1 =
  | 'untap-step-actions'
  | 'draw-step-draw'
  | 'precombat-main-actions';

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

function fail(code: CoreTurnPriorityOperationCodeV1, message: string): never {
  throw new CoreTurnPriorityOperationErrorV1(code, message);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function dataPropertyValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
    fail('INVALID_OPERATION_INPUT', `Expected an enumerable data property at ${key}`);
  }
  return descriptor.value;
}

function arrayElementValue(value: readonly unknown[], index: number): unknown {
  const key = String(index);
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
    fail('INVALID_OPERATION_INPUT', `Expected an enumerable data array element at ${key}`);
  }
  return descriptor.value;
}

function cloneDataValue(value: unknown, seen = new Map<object, unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing;

  if (Array.isArray(value)) {
    const arrayValue: readonly unknown[] = value;
    const clone: unknown[] = [];
    seen.set(value, clone);
    const length = arrayValue.length;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
      fail('INVALID_OPERATION_INPUT', 'Expected an ordinary array');
    }
    for (const key of Reflect.ownKeys(value)) {
      if (key === 'length') continue;
      if (typeof key !== 'string' || !/^\d+$/.test(key) || Number(key) >= length || String(Number(key)) !== key) {
        fail('INVALID_OPERATION_INPUT', 'Array has an unsupported property');
      }
    }
    for (let index = 0; index < length; index += 1) {
      clone.push(cloneDataValue(arrayElementValue(value, index), seen));
    }
    return clone;
  }

  if (!isPlainRecord(value)) fail('INVALID_OPERATION_INPUT', 'Expected plain component input');
  const clone = Object.create(null) as Record<string, unknown>;
  seen.set(value, clone);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('INVALID_OPERATION_INPUT', 'Symbol properties are not supported');
    clone[key] = cloneDataValue(dataPropertyValue(value, key), seen);
  }
  return clone;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

export function rebuildCoreTurnAdvanceBundleV1<
  TPending extends CoreTurnPendingTriggerComponentV1,
>(
  bundle: CoreTurnAdvanceBundleV1<TPending>,
  lifecycle: CoreTurnLifecycleSliceV1,
  objectRegistry = bundle.stackBundle.objectRegistry,
): CoreTurnAdvanceBundleV1<TPending> {
  const candidate = {
    stackBundle: {
      objectRegistry,
      objectRuntime: bundle.stackBundle.objectRuntime,
      stackAnnouncements: bundle.stackBundle.stackAnnouncements,
    },
    pendingTriggers: bundle.pendingTriggers,
    lifecycle,
  };
  return deepFreeze(cloneDataValue(candidate)) as CoreTurnAdvanceBundleV1<TPending>;
}

export function assertCoreTurnAdvanceBundleV1<TPending extends CoreTurnPendingTriggerComponentV1>(
  input: CoreTurnAdvanceBundleV1<TPending>,
): CoreTurnAdvanceBundleV1<TPending> {
  if (!isPlainRecord(input)) fail('INVALID_OPERATION_INPUT', 'Turn component bundle must be a plain object');
  const stackBundle = input.stackBundle;
  const pendingTriggers = input.pendingTriggers;
  const lifecycle = input.lifecycle;
  if (!isPlainRecord(stackBundle) || !isPlainRecord(pendingTriggers) || !isPlainRecord(lifecycle)) {
    fail('INVALID_OPERATION_INPUT', 'Turn component bundle has invalid parts');
  }
  if (!isPlainRecord(stackBundle.objectRegistry) || !isPlainRecord(stackBundle.objectRuntime)) {
    fail('INVALID_OPERATION_INPUT', 'Turn component bundle has invalid Registry or Runtime');
  }
  const registry = stackBundle.objectRegistry as ModeNeutralCoreObjectRegistrySliceV2;
  const runtime = stackBundle.objectRuntime as ModeNeutralCoreObjectRuntimeSliceV2;
  if (!isPlainRecord(registry.players) || !Array.isArray(registry.turnOrder)
    || typeof registry.activePlayerId !== 'string' || !isPlainRecord(registry.zones)
    || !isPlainRecord(registry.zones.shared) || !Array.isArray(registry.zones.shared.stack)
    || !isPlainRecord(runtime.byObject) || !Array.isArray(pendingTriggers.pendingObjectIds)) {
    fail('INVALID_OPERATION_INPUT', 'Turn component bundle has invalid structural fields');
  }
  if (!Number.isSafeInteger(lifecycle.turnNumber) || lifecycle.turnNumber < 1
    || !Number.isSafeInteger(lifecycle.positionSequence) || lifecycle.positionSequence < 0) {
    fail('INVALID_OPERATION_INPUT', 'Turn lifecycle counters are invalid');
  }
  const positionResult = validateCoreTurnPositionV1(lifecycle.position);
  if (!positionResult.ok) fail('INVALID_OPERATION_INPUT', 'Turn lifecycle position is invalid');
  return input;
}

function incrementPositionSequence(value: number): number {
  if (value >= MAX_SAFE_INTEGER) fail('POSITION_SEQUENCE_OVERFLOW', 'Position sequence would overflow');
  return value + 1;
}

function incrementTurnNumber(value: number): number {
  if (value >= MAX_SAFE_INTEGER) fail('TURN_NUMBER_OVERFLOW', 'Turn number would overflow');
  return value + 1;
}

function emptyManaPool(): CoreManaPoolV1 {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function playerStateWith(
  player: CorePlayerStateV1,
  changes: Readonly<{
    readonly manaPool?: CoreManaPoolV1;
    readonly landsPlayedThisTurn?: number;
    readonly spellsCastThisTurn?: number;
    readonly drawnThisTurn?: number;
  }>,
): CorePlayerStateV1 {
  return {
    life: player.life,
    poison: player.poison,
    energy: player.energy,
    experience: player.experience,
    manaPool: changes.manaPool ?? player.manaPool,
    mulliganCount: player.mulliganCount,
    landsPlayedThisTurn: changes.landsPlayedThisTurn ?? player.landsPlayedThisTurn,
    spellsCastThisTurn: changes.spellsCastThisTurn ?? player.spellsCastThisTurn,
    drawnThisTurn: changes.drawnThisTurn ?? player.drawnThisTurn,
    maximumHandSizeOverride: player.maximumHandSizeOverride,
  };
}

export function registryWithEmptyManaV1(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
): ModeNeutralCoreObjectRegistrySliceV2 {
  const players: Record<string, CorePlayerStateV1> = Object.create(null) as Record<string, CorePlayerStateV1>;
  for (const playerId of registry.turnOrder) {
    players[playerId] = playerStateWith(registry.players[playerId], { manaPool: emptyManaPool() });
  }
  return {
    kind: registry.kind,
    players,
    turnOrder: registry.turnOrder,
    activePlayerId: registry.activePlayerId,
    cardDefinitions: registry.cardDefinitions,
    physicalCards: registry.physicalCards,
    objects: registry.objects,
    zones: registry.zones,
  };
}

function registryWithTurnStart(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  activePlayerId: CorePlayerId,
): ModeNeutralCoreObjectRegistrySliceV2 {
  const players: Record<string, CorePlayerStateV1> = Object.create(null) as Record<string, CorePlayerStateV1>;
  for (const playerId of registry.turnOrder) {
    players[playerId] = playerStateWith(registry.players[playerId], {
      manaPool: emptyManaPool(),
      landsPlayedThisTurn: 0,
      spellsCastThisTurn: 0,
      drawnThisTurn: 0,
    });
  }
  return {
    kind: registry.kind,
    players,
    turnOrder: registry.turnOrder,
    activePlayerId,
    cardDefinitions: registry.cardDefinitions,
    physicalCards: registry.physicalCards,
    objects: registry.objects,
    zones: registry.zones,
  };
}

function sbaWindow(playerId: CorePlayerId, grantPriorityIfStable = true): CoreTurnWindowV1 {
  return {
    kind: 'sba-check-required',
    priorityRecipientPlayerId: playerId,
    grantPriorityIfStable,
  };
}

function lifecycleWith(
  lifecycle: CoreTurnLifecycleSliceV1,
  position: CoreTurnPositionV1,
  positionSequence: number,
  window: CoreTurnWindowV1,
  turnNumber = lifecycle.turnNumber,
): CoreTurnLifecycleSliceV1 {
  return { kind: lifecycle.kind, turnNumber, positionSequence, position, window };
}

function requireEmptyStack<TPending extends CoreTurnPendingTriggerComponentV1>(
  bundle: CoreTurnAdvanceBundleV1<TPending>,
): void {
  if (bundle.stackBundle.objectRegistry.zones.shared.stack.length !== 0) {
    fail('WINDOW_MISMATCH', 'The stack must be empty at a position or turn boundary');
  }
}

function requireActivePlayer<TPending extends CoreTurnPendingTriggerComponentV1>(
  bundle: CoreTurnAdvanceBundleV1<TPending>,
): CorePlayerId {
  const playerId = bundle.stackBundle.objectRegistry.activePlayerId;
  if (bundle.stackBundle.objectRegistry.players[playerId] === undefined) {
    fail('PLAYER_NOT_SEATED', 'The Registry active player is not seated');
  }
  return playerId;
}

function allowedTransition(from: CoreTurnPositionV1, to: CoreTurnPositionV1): boolean {
  if (from.phase === 'beginning' && from.step === 'upkeep') {
    return to.phase === 'beginning' && to.step === 'draw';
  }
  if (from.phase === 'beginning' && from.step === 'draw') {
    return to.phase === 'precombat-main' && to.step === null;
  }
  if (from.phase === 'precombat-main') {
    return to.phase === 'combat' && to.step === 'beginning-of-combat';
  }
  if (from.phase === 'combat' && from.step === 'beginning-of-combat') {
    return to.phase === 'combat' && to.step === 'declare-attackers';
  }
  if (from.phase === 'combat' && from.step === 'declare-attackers') {
    return to.phase === 'combat' && (to.step === 'declare-blockers' || to.step === 'end-of-combat');
  }
  if (from.phase === 'combat' && from.step === 'declare-blockers') {
    return to.phase === 'combat' && (to.step === 'combat-damage' || to.step === 'end-of-combat');
  }
  if (from.phase === 'combat' && from.step === 'combat-damage') {
    return to.phase === 'combat' && (to.step === 'combat-damage' || to.step === 'end-of-combat');
  }
  if (from.phase === 'combat' && from.step === 'end-of-combat') {
    return to.phase === 'postcombat-main' && to.step === null;
  }
  if (from.phase === 'postcombat-main') {
    return to.phase === 'ending' && to.step === 'end';
  }
  return from.phase === 'ending' && from.step === 'end'
    && to.phase === 'ending' && to.step === 'cleanup';
}

function windowForPosition<TPending extends CoreTurnPendingTriggerComponentV1>(
  bundle: CoreTurnAdvanceBundleV1<TPending>,
  position: CoreTurnPositionV1,
): CoreTurnWindowV1 {
  const playerId = requireActivePlayer(bundle);
  if (position.phase === 'ending' && position.step === 'cleanup') {
    const player = bundle.stackBundle.objectRegistry.players[playerId];
    const override = player.maximumHandSizeOverride;
    const maximum = override === null ? 7 : override === 'none' ? 0 : override;
    if (!Number.isSafeInteger(maximum) || maximum < 0) {
      fail('CANDIDATE_INVALID', 'Maximum hand size override is invalid');
    }
    const requiredCount = Math.max(0, bundle.stackBundle.objectRegistry.zones.byPlayer[playerId].hand.length - maximum);
    if (requiredCount > 0) {
      return { kind: 'cleanup-discard-required', playerId, requiredCount };
    }
    return { kind: 'cleanup-state-actions-required', playerId };
  }
  if (position.phase === 'beginning' && position.step === 'draw') {
    return { kind: 'turn-based-action-required', action: 'draw-step-draw', playerId };
  }
  if (position.phase === 'precombat-main') {
    return { kind: 'turn-based-action-required', action: 'precombat-main-actions', playerId };
  }
  return sbaWindow(playerId);
}

export function advanceCoreTurnPositionV1<TPending extends CoreTurnPendingTriggerComponentV1>(
  input: CoreTurnAdvanceBundleV1<TPending>,
  operation: Readonly<{ readonly nextPosition: CoreTurnPositionV1 }>,
): CoreTurnAdvanceBundleV1<TPending> {
  const bundle = assertCoreTurnAdvanceBundleV1(input);
  if (bundle.lifecycle.window.kind !== 'position-advance-ready') {
    fail('WINDOW_MISMATCH', 'Position advance requires position-advance-ready');
  }
  requireEmptyStack(bundle);
  if (!isPlainRecord(operation)) fail('INVALID_OPERATION_INPUT', 'Position advance input must be a plain object');
  const positionResult = validateCoreTurnPositionV1(operation.nextPosition);
  if (!positionResult.ok || !allowedTransition(bundle.lifecycle.position, operation.nextPosition)) {
    fail('POSITION_TRANSITION_INVALID', 'The requested position is not an allowed successor');
  }
  const registry = registryWithEmptyManaV1(bundle.stackBundle.objectRegistry);
  return rebuildCoreTurnAdvanceBundleV1(
    bundle,
    lifecycleWith(
      bundle.lifecycle,
      positionResult.value,
      incrementPositionSequence(bundle.lifecycle.positionSequence),
      windowForPosition({ ...bundle, stackBundle: { ...bundle.stackBundle, objectRegistry: registry } }, positionResult.value),
    ),
    registry,
  );
}

export function completeCoreTurnBasedActionCheckpointV1<TPending extends CoreTurnPendingTriggerComponentV1>(
  input: CoreTurnAdvanceBundleV1<TPending>,
  action: CoreTurnBasedActionV1,
): CoreTurnAdvanceBundleV1<TPending> {
  const bundle = assertCoreTurnAdvanceBundleV1(input);
  const window = bundle.lifecycle.window;
  if (window.kind !== 'turn-based-action-required' || window.action !== action) {
    fail('TURN_BASED_ACTION_MISMATCH', 'Turn-based action checkpoint does not match the current window');
  }
  const activePlayerId = requireActivePlayer(bundle);
  if (window.playerId !== activePlayerId) fail('PLAYER_NOT_SEATED', 'Turn-based action belongs to a non-active player');
  requireEmptyStack(bundle);
  if (action === 'untap-step-actions') {
    if (bundle.lifecycle.position.phase !== 'beginning' || bundle.lifecycle.position.step !== 'untap') {
      fail('TURN_BASED_ACTION_MISMATCH', 'Untap actions require the untap step');
    }
    const registry = registryWithEmptyManaV1(bundle.stackBundle.objectRegistry);
    return rebuildCoreTurnAdvanceBundleV1(
      bundle,
      lifecycleWith(
        bundle.lifecycle,
        { phase: 'beginning', step: 'upkeep' },
        incrementPositionSequence(bundle.lifecycle.positionSequence),
        sbaWindow(activePlayerId),
      ),
      registry,
    );
  }
  if (action === 'draw-step-draw'
    && (bundle.lifecycle.position.phase !== 'beginning' || bundle.lifecycle.position.step !== 'draw')) {
    fail('TURN_BASED_ACTION_MISMATCH', 'Draw action requires the draw step');
  }
  if (action === 'precombat-main-actions' && bundle.lifecycle.position.phase !== 'precombat-main') {
    fail('TURN_BASED_ACTION_MISMATCH', 'Precombat main actions require precombat main');
  }
  return rebuildCoreTurnAdvanceBundleV1(
    bundle,
    lifecycleWith(bundle.lifecycle, bundle.lifecycle.position, bundle.lifecycle.positionSequence, sbaWindow(activePlayerId)),
  );
}

export function advanceCoreToNextTurnV1<TPending extends CoreTurnPendingTriggerComponentV1>(
  input: CoreTurnAdvanceBundleV1<TPending>,
): CoreTurnAdvanceBundleV1<TPending> {
  const bundle = assertCoreTurnAdvanceBundleV1(input);
  if (bundle.lifecycle.window.kind !== 'turn-advance-ready') {
    fail('WINDOW_MISMATCH', 'Turn advance requires turn-advance-ready');
  }
  if (bundle.lifecycle.position.phase !== 'ending' || bundle.lifecycle.position.step !== 'cleanup') {
    fail('POSITION_TRANSITION_INVALID', 'Turn advance requires cleanup');
  }
  requireEmptyStack(bundle);
  if (bundle.pendingTriggers.pendingObjectIds.length !== 0) {
    fail('WINDOW_MISMATCH', 'Turn advance requires no pending triggers');
  }
  const registry = bundle.stackBundle.objectRegistry;
  const activeIndex = registry.turnOrder.indexOf(registry.activePlayerId);
  if (activeIndex < 0 || registry.turnOrder.length === 0) {
    fail('CANDIDATE_INVALID', 'Active player is not present in turn order');
  }
  const nextActivePlayerId = registry.turnOrder[(activeIndex + 1) % registry.turnOrder.length];
  if (registry.players[nextActivePlayerId] === undefined) {
    fail('PLAYER_NOT_SEATED', 'Next active player is not seated');
  }
  return rebuildCoreTurnAdvanceBundleV1(
    bundle,
    lifecycleWith(
      bundle.lifecycle,
      { phase: 'beginning', step: 'untap' },
      0,
      { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: nextActivePlayerId },
      incrementTurnNumber(bundle.lifecycle.turnNumber),
    ),
    registryWithTurnStart(registry, nextActivePlayerId),
  );
}

export type {
  CoreTurnLifecycleSliceV1,
  CoreTurnWindowV1,
  CoreTurnPositionV1,
};
