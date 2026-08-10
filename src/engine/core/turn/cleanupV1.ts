import type {
  CoreCardObjectRuntimeStateV1,
} from '../runtime/cardRuntimeState';
import type { ModeNeutralCoreObjectRuntimeSliceV2 } from '../object/objectRegistryStateV2';
import type { CoreObjectId } from '../ids';
import type {
  CoreTurnAdvanceBundleV1,
  CoreTurnPendingTriggerComponentV1,
} from './turnAdvanceV1';
import {
  CoreTurnPriorityOperationErrorV1,
  type CoreTurnPriorityOperationCodeV1,
} from './turnPriorityErrorV1';
import {
  assertCoreTurnAdvanceBundleV1,
  rebuildCoreTurnAdvanceBundleV1,
  registryWithEmptyManaV1,
} from './turnAdvanceV1';

function fail(code: CoreTurnPriorityOperationCodeV1, message: string): never {
  throw new CoreTurnPriorityOperationErrorV1(code, message);
}

function activePlayer<TPending extends CoreTurnPendingTriggerComponentV1>(
  bundle: CoreTurnAdvanceBundleV1<TPending>,
): ReturnType<typeof registryWithEmptyManaV1>['activePlayerId'] {
  const registry = bundle.stackBundle.objectRegistry;
  if (registry.players[registry.activePlayerId] === undefined) {
    fail('PLAYER_NOT_SEATED', 'The Registry active player is not seated');
  }
  return registry.activePlayerId;
}

function requireCleanupDiscard<TPending extends CoreTurnPendingTriggerComponentV1>(
  bundle: CoreTurnAdvanceBundleV1<TPending>,
): { readonly playerId: ReturnType<typeof activePlayer<TPending>>; readonly requiredCount: number } {
  if (bundle.lifecycle.position.phase !== 'ending' || bundle.lifecycle.position.step !== 'cleanup'
    || bundle.lifecycle.window.kind !== 'cleanup-discard-required') {
    fail('WINDOW_MISMATCH', 'Cleanup discard confirmation requires cleanup-discard-required');
  }
  const playerId = activePlayer(bundle);
  if (bundle.stackBundle.objectRegistry.zones.shared.stack.length !== 0) {
    fail('WINDOW_MISMATCH', 'Cleanup discard confirmation requires an empty stack');
  }
  if (bundle.lifecycle.window.playerId !== playerId) fail('PLAYER_NOT_SEATED', 'Cleanup discard belongs to a non-active player');
  return { playerId, requiredCount: bundle.lifecycle.window.requiredCount };
}

function maximumHandSize<TPending extends CoreTurnPendingTriggerComponentV1>(
  bundle: CoreTurnAdvanceBundleV1<TPending>,
  playerId: ReturnType<typeof activePlayer<TPending>>,
): number {
  const override = bundle.stackBundle.objectRegistry.players[playerId].maximumHandSizeOverride;
  const maximum = override === null ? 7 : override === 'none' ? 0 : override;
  if (!Number.isSafeInteger(maximum) || maximum < 0) fail('CANDIDATE_INVALID', 'Maximum hand size override is invalid');
  return maximum;
}

export function completeCoreCleanupDiscardCheckpointV1<TPending extends CoreTurnPendingTriggerComponentV1>(
  input: CoreTurnAdvanceBundleV1<TPending>,
): CoreTurnAdvanceBundleV1<TPending> {
  const bundle = assertCoreTurnAdvanceBundleV1(input);
  const requirement = requireCleanupDiscard(bundle);
  const handCount = bundle.stackBundle.objectRegistry.zones.byPlayer[requirement.playerId].hand.length;
  const maximum = maximumHandSize(bundle, requirement.playerId);
  if (handCount > maximum) {
    fail('CLEANUP_DISCARD_INCOMPLETE', 'Cleanup confirmation requires the current hand to be within maximum size');
  }
  return rebuildCoreTurnAdvanceBundleV1(bundle, {
    kind: bundle.lifecycle.kind,
    turnNumber: bundle.lifecycle.turnNumber,
    positionSequence: bundle.lifecycle.positionSequence,
    position: bundle.lifecycle.position,
    window: { kind: 'cleanup-state-actions-required', playerId: requirement.playerId },
  });
}

function clearMarkedDamage(
  runtime: ModeNeutralCoreObjectRuntimeSliceV2,
): ModeNeutralCoreObjectRuntimeSliceV2 {
  const byObject: Record<string, CoreCardObjectRuntimeStateV1> = Object.create(null) as Record<string, CoreCardObjectRuntimeStateV1>;
  for (const objectId of Object.keys(runtime.byObject) as CoreObjectId[]) {
    const state = runtime.byObject[objectId];
    byObject[objectId] = {
      orientation: state.orientation,
      counterDamage: {
        counters: state.counterDamage.counters,
        markedDamage: 0,
      },
      attachment: state.attachment,
    };
  }
  return {
    kind: runtime.kind,
    byObject,
  };
}

export function applyCoreCleanupStateActionsV1<TPending extends CoreTurnPendingTriggerComponentV1>(
  input: CoreTurnAdvanceBundleV1<TPending>,
): CoreTurnAdvanceBundleV1<TPending> {
  const bundle = assertCoreTurnAdvanceBundleV1(input);
  if (bundle.lifecycle.position.phase !== 'ending' || bundle.lifecycle.position.step !== 'cleanup'
    || bundle.lifecycle.window.kind !== 'cleanup-state-actions-required') {
    fail('WINDOW_MISMATCH', 'Cleanup state actions require cleanup-state-actions-required');
  }
  const playerId = activePlayer(bundle);
  if (bundle.lifecycle.window.playerId !== playerId) fail('PLAYER_NOT_SEATED', 'Cleanup state actions belong to a non-active player');
  if (bundle.stackBundle.objectRegistry.zones.shared.stack.length !== 0) {
    fail('WINDOW_MISMATCH', 'Cleanup state actions require an empty stack');
  }
  const runtime = clearMarkedDamage(bundle.stackBundle.objectRuntime);
  const stackBundle = {
    objectRegistry: registryWithEmptyManaV1(bundle.stackBundle.objectRegistry),
    objectRuntime: runtime,
    stackAnnouncements: bundle.stackBundle.stackAnnouncements,
  };
  return rebuildCoreTurnAdvanceBundleV1(
    { ...bundle, stackBundle },
    {
      kind: bundle.lifecycle.kind,
      turnNumber: bundle.lifecycle.turnNumber,
      positionSequence: bundle.lifecycle.positionSequence,
      position: bundle.lifecycle.position,
      window: { kind: 'sba-check-required', priorityRecipientPlayerId: playerId, grantPriorityIfStable: false },
    },
  );
}

export function startCoreRepeatedCleanupV1<TPending extends CoreTurnPendingTriggerComponentV1>(
  input: CoreTurnAdvanceBundleV1<TPending>,
): CoreTurnAdvanceBundleV1<TPending> {
  const bundle = assertCoreTurnAdvanceBundleV1(input);
  if (bundle.lifecycle.position.phase !== 'ending' || bundle.lifecycle.position.step !== 'cleanup'
    || bundle.lifecycle.window.kind !== 'cleanup-repeat-ready') {
    fail('WINDOW_MISMATCH', 'Repeated cleanup requires cleanup-repeat-ready');
  }
  if (bundle.stackBundle.objectRegistry.zones.shared.stack.length !== 0) {
    fail('WINDOW_MISMATCH', 'Repeated cleanup requires an empty stack');
  }
  const playerId = activePlayer(bundle);
  const maximum = maximumHandSize(bundle, playerId);
  const handCount = bundle.stackBundle.objectRegistry.zones.byPlayer[playerId].hand.length;
  const requiredCount = Math.max(0, handCount - maximum);
  const window = requiredCount > 0
    ? { kind: 'cleanup-discard-required' as const, playerId, requiredCount }
    : { kind: 'cleanup-state-actions-required' as const, playerId };
  return rebuildCoreTurnAdvanceBundleV1(bundle, {
    kind: bundle.lifecycle.kind,
    turnNumber: bundle.lifecycle.turnNumber,
    positionSequence: bundle.lifecycle.positionSequence >= Number.MAX_SAFE_INTEGER
      ? (() => fail('POSITION_SEQUENCE_OVERFLOW', 'Position sequence would overflow'))()
      : bundle.lifecycle.positionSequence + 1,
    position: bundle.lifecycle.position,
    window,
  });
}
