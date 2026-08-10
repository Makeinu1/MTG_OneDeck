import type { CoreObjectId, CorePlayerId } from '../ids';
import type {
  CoreCardDefinitionRecordV1,
  CorePhysicalCardRecordV1,
} from '../cardDefinition';
import type {
  CoreManaPoolV1,
  CorePlayerStateV1,
  CorePlayerZonesV1,
  CoreZonesV1,
} from '../identityZoneState';
import {
  createModeNeutralCoreObjectRegistryStateV2,
  validateCoreTriggeredAbilityObjectIdentityV2,
} from '../object';
import type {
  CoreGameObjectIdentityV2,
  ModeNeutralCoreObjectRegistrySliceV2,
} from '../object';
import type { CoreStackRemovalResultV1 } from './stackTransactionAccessV1';
import {
  passCorePriorityV1 as passCorePriorityComponentV1,
  resumeCoreAfterPriorityActionV1 as resumeCoreAfterPriorityActionComponentV1,
  startCorePriorityCycleV1 as startCorePriorityCycleComponentV1,
} from './priorityPassV1';
import { coreApnapPlayerOrderV1 as coreApnapPlayerOrderComponentV1 } from './triggerApnapV1';
import { CoreTurnPriorityOperationErrorV1 as TurnPriorityOperationErrorV1 } from './turnPriorityErrorV1';
import type { CorePriorityPassComponentInputV1 } from './priorityPassV1';
import {
  completeCoreResolutionAfterRemovalV1 as completeCoreResolutionAfterRemovalComponentV1,
} from './resolutionBoundaryV1';
import {
  analyzeCorePendingTriggerPlacementOnBundleV1,
  appendCorePendingTriggeredAbilitiesToBundleV1,
} from './triggerPlacementV1';
import {
  createCoreTurnPriorityBundleV1,
  validateCoreTurnPriorityBundleV1,
} from './turnPriorityBundleV1';
import { createModeNeutralCorePendingTriggerSliceV1 as createPendingWithRegistryV1 } from './pendingTriggerV1';
import type {
  CorePendingTriggeredAbilityAppendInputV1,
  CreateModeNeutralCorePendingTriggerSliceV1Input,
  ModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerV1';
import type { CoreTurnPriorityBundleV1 } from './turnPriorityBundleV1';
import type { CoreTurnPositionV1 } from './turnPositionV1';

function validBundle(input: CoreTurnPriorityBundleV1): CoreTurnPriorityBundleV1 {
  const result = validateCoreTurnPriorityBundleV1(input);
  if (!result.ok) {
    throw new TurnPriorityOperationErrorV1(
      'INVALID_TURN_PRIORITY_BUNDLE',
      result.issues[0]?.message ?? 'Invalid turn priority bundle',
      [{
        code: 'INVALID_TURN_PRIORITY_BUNDLE',
        path: '',
        message: result.issues[0]?.message ?? 'Invalid turn priority bundle',
      }],
    );
  }
  return result.value;
}

function componentOf(bundle: CoreTurnPriorityBundleV1): CorePriorityPassComponentInputV1 {
  return {
    stackBundle: bundle.stackBundle,
    lifecycle: bundle.lifecycle,
  };
}

function bundleOf(
  original: CoreTurnPriorityBundleV1,
  component: CorePriorityPassComponentInputV1,
): CoreTurnPriorityBundleV1 {
  return createCoreTurnPriorityBundleV1({
    stackBundle: component.stackBundle,
    pendingTriggers: original.pendingTriggers,
    lifecycle: component.lifecycle,
  });
}

export type { CoreTurnPositionV1 } from './turnPositionV1';
export type {
  CoreTurnWindowV1,
  CoreTurnLifecycleSliceV1,
  ModeNeutralCoreTurnLifecycleSliceV1,
  CreateModeNeutralCoreTurnLifecycleSliceV1Input,
} from './turnLifecycleV1';
export {
  createModeNeutralCoreTurnLifecycleSliceV1,
  validateCoreTurnPositionV1,
  validateCoreTurnWindowV1,
  validateModeNeutralCoreTurnLifecycleSliceV1,
} from './turnLifecycleV1';

export type {
  CoreTriggerStackPlacementBucketV1,
  CorePendingTriggeredAbilityV1,
  CorePendingTriggerSliceV1,
  ModeNeutralCorePendingTriggerSliceV1,
  CreateModeNeutralCorePendingTriggerSliceV1Input,
  CorePendingTriggeredAbilityAppendInputV1,
} from './pendingTriggerV1';
export function createModeNeutralCorePendingTriggerSliceV1(
  input: CreateModeNeutralCorePendingTriggerSliceV1Input,
): ModeNeutralCorePendingTriggerSliceV1;
export function createModeNeutralCorePendingTriggerSliceV1(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  input: CreateModeNeutralCorePendingTriggerSliceV1Input,
): ModeNeutralCorePendingTriggerSliceV1;
export function createModeNeutralCorePendingTriggerSliceV1(
  first: ModeNeutralCoreObjectRegistrySliceV2
    | CreateModeNeutralCorePendingTriggerSliceV1Input,
  second?: CreateModeNeutralCorePendingTriggerSliceV1Input,
): ModeNeutralCorePendingTriggerSliceV1 {
  if (second === undefined) {
    return createPendingWithRegistryV1(
      standalonePendingRegistry(first),
      first as CreateModeNeutralCorePendingTriggerSliceV1Input,
    );
  }
  return createPendingWithRegistryV1(first as ModeNeutralCoreObjectRegistrySliceV2, second);
}
export { validateModeNeutralCorePendingTriggerSliceV1 } from './pendingTriggerV1';
export type {
  CorePendingTriggerOrderGroupV1,
} from './triggerApnapV1';

type RawRecord = Record<string, unknown>;

function plainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function unknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function dataField(root: RawRecord, field: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(root, field);
  if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
    throw new TypeError(`Invalid pending trigger field: ${field}`);
  }
  return descriptor.value;
}

function standalonePendingRegistry(input: unknown): ModeNeutralCoreObjectRegistrySliceV2 {
  if (!plainRecord(input)) throw new TypeError('Pending trigger input must be a plain object');
  const pendingObjectIds = dataField(input, 'pendingObjectIds');
  const byObject = dataField(input, 'byObject');
  if (!unknownArray(pendingObjectIds) || !plainRecord(byObject)) {
    throw new TypeError('Pending trigger input has invalid collections');
  }

  const pendingIds: readonly unknown[] = pendingObjectIds;
  const playerIds: CorePlayerId[] = [];
  const seenPlayers = new Set<string>();
  for (const objectIdValue of pendingIds) {
    if (typeof objectIdValue !== 'string') throw new TypeError('Pending object ID must be a string');
    const record = byObject[objectIdValue];
    if (!plainRecord(record)) throw new TypeError('Pending trigger record must be a plain object');
    const object = dataField(record, 'object');
    const objectResult = validateCoreTriggeredAbilityObjectIdentityV2(object);
    if (!objectResult.ok) throw new TypeError('Pending trigger object identity is invalid');
    const playerId = objectResult.value.controllerPlayerId;
    if (!seenPlayers.has(playerId)) {
      seenPlayers.add(playerId);
      playerIds.push(playerId);
    }
  }
  if (playerIds.length === 0) playerIds.push('P1' as CorePlayerId);

  const emptyManaPool: CoreManaPoolV1 = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const players: Record<CorePlayerId, CorePlayerStateV1> = Object.create(null) as Record<CorePlayerId, CorePlayerStateV1>;
  const byPlayer: Record<CorePlayerId, CorePlayerZonesV1> = Object.create(null) as Record<CorePlayerId, CorePlayerZonesV1>;
  for (const playerId of playerIds) {
    players[playerId] = {
      life: 20,
      poison: 0,
      energy: 0,
      experience: 0,
      manaPool: emptyManaPool,
      mulliganCount: 0,
      landsPlayedThisTurn: 0,
      spellsCastThisTurn: 0,
      drawnThisTurn: 0,
      maximumHandSizeOverride: null,
    };
    byPlayer[playerId] = { library: [], hand: [], graveyard: [] };
  }
  const zones: CoreZonesV1 = {
    byPlayer,
    shared: { battlefield: [], stack: [], exile: [], command: [] },
  };
  const cardDefinitions: CoreCardDefinitionRecordV1 = Object.create(null) as CoreCardDefinitionRecordV1;
  const physicalCards: CorePhysicalCardRecordV1 = Object.create(null) as CorePhysicalCardRecordV1;
  const objects: Record<CoreObjectId, CoreGameObjectIdentityV2> = Object.create(null) as Record<CoreObjectId, CoreGameObjectIdentityV2>;
  return createModeNeutralCoreObjectRegistryStateV2({
    players,
    turnOrder: playerIds,
    activePlayerId: playerIds[0],
    cardDefinitions,
    physicalCards,
    objects,
    zones,
  });
}

export type {
  CoreTurnPriorityBundleV1,
  CreateCoreTurnPriorityBundleV1Input,
} from './turnPriorityBundleV1';
export {
  createCoreTurnPriorityBundleV1,
  validateCoreTurnPriorityBundleV1,
} from './turnPriorityBundleV1';
export type {
  CoreTurnPriorityBundleValidationCodeV1 as CoreTurnPriorityValidationCodeV1,
  CoreTurnPriorityBundleValidationIssueV1 as CoreTurnPriorityValidationIssueV1,
  CoreTurnPriorityBundleValidationResultV1 as CoreTurnPriorityValidationResultV1,
} from './turnPriorityBundleValidationV1';

export function coreApnapPlayerOrderV1(
  objectRegistry: ModeNeutralCoreObjectRegistrySliceV2,
): readonly CorePlayerId[] {
  return coreApnapPlayerOrderComponentV1(objectRegistry);
}

export {
  validateCorePendingTriggerOrderV1,
} from './triggerApnapV1';

export function analyzeCorePendingTriggerPlacementV1(
  bundle: CoreTurnPriorityBundleV1,
): ReturnType<typeof analyzeCorePendingTriggerPlacementOnBundleV1> & Readonly<{ readonly orderKind: string }> {
  const analysis = analyzeCorePendingTriggerPlacementOnBundleV1(validBundle(bundle));
  return Object.freeze({ ...analysis, orderKind: analysis.kind });
}

export function appendCorePendingTriggeredAbilitiesV1(
  bundle: CoreTurnPriorityBundleV1,
  additions: ModeNeutralCorePendingTriggerSliceV1,
): CoreTurnPriorityBundleV1 {
  const normalized: readonly CorePendingTriggeredAbilityAppendInputV1[] = additions.pendingObjectIds.map(
    (objectId) => ({ objectId, ...additions.byObject[objectId] }),
  );
  return appendCorePendingTriggeredAbilitiesToBundleV1(bundle, normalized);
}
export { placeCorePendingTriggersOnStackV1 } from './triggerPlacementV1';
export { recordCoreSbaCheckOutcomeV1 } from './sbaTriggerBoundaryV1';
export type { CoreSbaCheckOutcomeV1 } from './sbaTriggerBoundaryV1';

export function startCorePriorityCycleV1(
  bundle: CoreTurnPriorityBundleV1,
): CoreTurnPriorityBundleV1 {
  const original = validBundle(bundle);
  return bundleOf(original, startCorePriorityCycleComponentV1(componentOf(original)));
}

export function passCorePriorityV1(
  bundle: CoreTurnPriorityBundleV1,
  playerId: CorePlayerId,
): CoreTurnPriorityBundleV1 {
  const original = validBundle(bundle);
  return bundleOf(original, passCorePriorityComponentV1(componentOf(original), playerId));
}

export function resumeCoreAfterPriorityActionV1(
  bundle: CoreTurnPriorityBundleV1,
  actingPlayerId: CorePlayerId,
): CoreTurnPriorityBundleV1 {
  const original = validBundle(bundle);
  return bundleOf(original, resumeCoreAfterPriorityActionComponentV1(componentOf(original), actingPlayerId));
}

export function completeCoreResolutionAfterRemovalV1(
  bundle: CoreTurnPriorityBundleV1,
  removalResult: CoreStackRemovalResultV1,
): CoreTurnPriorityBundleV1 {
  const original = validBundle(bundle);
  return bundleOf(
    original,
    completeCoreResolutionAfterRemovalComponentV1(componentOf(original), removalResult),
  );
}

export type CoreTurnPositionAdvanceInputV1 = Readonly<{
  readonly nextPosition: CoreTurnPositionV1;
}>;
export {
  advanceCoreTurnPositionV1,
  completeCoreTurnBasedActionCheckpointV1,
  advanceCoreToNextTurnV1,
} from './turnAdvanceV1';
export {
  completeCoreCleanupDiscardCheckpointV1,
  applyCoreCleanupStateActionsV1,
  startCoreRepeatedCleanupV1,
} from './cleanupV1';

export type {
  CoreTurnBasedActionV1,
  CoreTurnAdvanceBundleV1,
} from './turnAdvanceV1';

export type {
  CoreTurnPriorityOperationCodeV1,
  CoreTurnPriorityOperationErrorCodeV1,
  CoreTurnPriorityOperationIssueV1,
} from './turnPriorityErrorV1';
export {
  CoreTurnPriorityErrorV1,
  CoreTurnPriorityOperationErrorV1,
} from './turnPriorityErrorV1';
