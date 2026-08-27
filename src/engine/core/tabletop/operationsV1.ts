import type { CoreDomainEventPayloadV1 } from '../closure/domainEventV1';
import type { ModeNeutralCoreRootV1 } from '../closure/rootV1';
import {
  createModeNeutralCoreRootV1,
} from '../closure/rootValidationV1';
import type { CoreCardObjectRuntimeStateV1 } from '../runtime/cardRuntimeState';
import type { CoreCounterEntryV1 } from '../runtime/counterDamage';
import type { CoreManaPoolV1, CorePlayerStateV1 } from '../identityZoneState';
import { createCoreCardOrientationStateV1 } from '../runtime/cardOrientation';
import { createCoreCounterDamageStateV1 } from '../runtime/counterDamage';
import { createCoreAttachmentStateV1 } from '../runtime/attachment';
import { createDefaultCoreCardRuntimeAfterZoneChangeV1 } from '../transition/cardReincarnation';
import type {
  CoreCardDefinitionSnapshotV1,
  CoreManaColorV1,
} from '../cardDefinition';
import type {
  CoreCardDefinitionId,
  CoreObjectId,
  CorePlayerId,
} from '../ids';
import { isCoreBaseId, isCoreUnsafeRecordKey } from '../ids';
import {
  createModeNeutralCoreObjectRegistryStateV2,
  createModeNeutralCoreObjectRuntimeStateV2,
  createCoreCardObjectIdentityV2,
  createCoreTokenObjectIdentityV2,
  coreTokenObjectIdOfV2,
  parseCoreObjectIdV2,
} from '../object';
import type {
  CoreGameObjectIdentityV2,
  ModeNeutralCoreObjectRegistryStateV2,
  ModeNeutralCoreObjectRuntimeStateV2,
} from '../object';
import {
  createCoreRuleAuthorityBundleV1,
} from '../rules/ruleAuthorityBundleV1';
import { pruneCoreVisibilityGrantsV1 } from '../rules/visibilityGrantOperationsV1';
import { createModeNeutralCoreControlSliceV1 } from '../rules/controlEffectV1';
import { applyCoreControlEffectV1 } from '../rules/controlEffectV1';
import { createCoreCombatContextV1 } from '../combat/combatContextV1';
import type { CoreCardZoneDestinationV1 } from '../transition/zoneDestination';
import { nextCoreCardIncarnationV1 } from '../transition/cardReincarnation';
import { removeCoreStackObjectV1 } from '../stack/transaction/stackRemovalV1';
import type { CoreTabletopCommandPayloadV1 } from './commandV1';
import { createCoreTabletopManualStateV1, type CoreTabletopManualModeV1, type CoreTabletopManualStateV1 } from './manualStateV1';

type ObjectRecord = Record<CoreObjectId, CoreGameObjectIdentityV2>;
type RuntimeRecord = Record<CoreObjectId, CoreCardObjectRuntimeStateV1>;
type DefinitionRecord = Record<CoreCardDefinitionId, CoreCardDefinitionSnapshotV1>;

const TOKEN_DEFINITION_MAX_SERIALIZED_BYTES_V1 = 8_192;
const TOKEN_DEFINITION_MAX_STRING_LENGTH_V1 = 512;
const TOKEN_DEFINITION_MAX_KEYWORDS_V1 = 16;
const TOKEN_DEFINITION_MAX_FACES_V1 = 2;
const TOKEN_DEFINITION_MAX_COLORS_V1 = 5;
const TOKEN_DEFINITION_MAX_PRODUCED_MANA_V1 = 6;
const MANUAL_NOTES_MAX_COUNT_V1 = 128;
const MANUAL_STACK_MAX_COUNT_V1 = 128;
const MANUAL_NOTES_MAX_SERIALIZED_BYTES_V1 = 24_576;
const MANUAL_STACK_MAX_SERIALIZED_BYTES_V1 = 24_576;
const MANUAL_STATE_MAX_SERIALIZED_BYTES_V1 = 32_768;

function applicationId(value: string): boolean {
  return isCoreBaseId(value) && !isCoreUnsafeRecordKey(value) && value.length <= 80;
}

function boundedTokenDefinition(definition: CoreCardDefinitionSnapshotV1): void {
  if (definition.source.kind !== 'engine-synthetic') fail('INVALID_DEFINITION', '/payload/definition/source', 'Token definitions must be engine-synthetic');
  if (definition.colorIdentity.length > TOKEN_DEFINITION_MAX_COLORS_V1) fail('INVALID_DEFINITION', '/payload/definition/colorIdentity', 'Token color identity exceeds the bounded limit');
  if (definition.keywords.length > TOKEN_DEFINITION_MAX_KEYWORDS_V1) fail('INVALID_DEFINITION', '/payload/definition/keywords', 'Token keywords exceed the bounded limit');
  if (definition.producedMana.length > TOKEN_DEFINITION_MAX_PRODUCED_MANA_V1) fail('INVALID_DEFINITION', '/payload/definition/producedMana', 'Token produced mana exceeds the bounded limit');
  if (definition.faces.length === 0 || definition.faces.length > TOKEN_DEFINITION_MAX_FACES_V1) fail('INVALID_DEFINITION', '/payload/definition/faces', 'Token faces exceed the bounded limit');
  const textFields: readonly (string | null)[] = [
    definition.name,
    definition.layout,
    definition.typeLine,
    ...definition.faces.flatMap((face) => [face.name, face.manaCost, face.typeLine, face.oracleText, face.power, face.toughness, face.loyalty, face.defense]),
  ];
  if (textFields.some((value) => value !== null && (typeof value !== 'string' || value.length > TOKEN_DEFINITION_MAX_STRING_LENGTH_V1))) fail('INVALID_DEFINITION', '/payload/definition', 'Token definition text exceeds the bounded limit');
  let serialized: string;
  try { serialized = JSON.stringify(definition); } catch { fail('INVALID_DEFINITION', '/payload/definition', 'Token definition could not be serialized safely'); }
  if (new TextEncoder().encode(serialized).length > TOKEN_DEFINITION_MAX_SERIALIZED_BYTES_V1) fail('INVALID_DEFINITION', '/payload/definition', 'Token definition exceeds the bounded projection budget');
}

function serializedBytes(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : new TextEncoder().encode(serialized).length;
  } catch {
    return null;
  }
}

function assertManualStateBudget(state: CoreTabletopManualStateV1): void {
  if (state.noteOrder.length > MANUAL_NOTES_MAX_COUNT_V1) fail('MANUAL_STATE_TOO_LARGE', '/tabletopManual/notes', 'Manual notes exceed the bounded collection limit');
  if (state.stackEntries.length > MANUAL_STACK_MAX_COUNT_V1) fail('MANUAL_STATE_TOO_LARGE', '/tabletopManual/stackEntries', 'Manual stack exceeds the bounded collection limit');
  const notesBytes = serializedBytes({ notes: state.notes, noteOrder: state.noteOrder });
  if (notesBytes === null || notesBytes > MANUAL_NOTES_MAX_SERIALIZED_BYTES_V1) fail('MANUAL_STATE_TOO_LARGE', '/tabletopManual/notes', 'Manual notes exceed the bounded serialized size');
  const stackBytes = serializedBytes({ stackEntries: state.stackEntries });
  if (stackBytes === null || stackBytes > MANUAL_STACK_MAX_SERIALIZED_BYTES_V1) fail('MANUAL_STATE_TOO_LARGE', '/tabletopManual/stackEntries', 'Manual stack exceeds the bounded serialized size');
  const aggregateBytes = serializedBytes({ notes: state.notes, noteOrder: state.noteOrder, stackEntries: state.stackEntries });
  if (aggregateBytes === null || aggregateBytes > MANUAL_STATE_MAX_SERIALIZED_BYTES_V1) fail('MANUAL_STATE_TOO_LARGE', '/tabletopManual', 'Manual state exceeds the bounded serialized size');
}

export type CoreTabletopOperationResultV1 = Readonly<{
  readonly root: ModeNeutralCoreRootV1;
  readonly payloads: readonly CoreDomainEventPayloadV1[];
}>;

export class CoreTabletopOperationErrorV1 extends Error {
  readonly issues: readonly Readonly<{ readonly code: string; readonly path: string; readonly message: string }>[];

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = 'CoreTabletopOperationErrorV1';
    this.issues = Object.freeze([Object.freeze({ code, path, message })]);
  }
}

function fail(code: string, path: string, message: string): never {
  throw new CoreTabletopOperationErrorV1(code, path, message);
}

function stackBundle(root: ModeNeutralCoreRootV1) {
  return root.ruleAuthority.turnPriorityBundle.stackBundle;
}

function rebuildRoot(
  root: ModeNeutralCoreRootV1,
  registry: ModeNeutralCoreObjectRegistryStateV2,
  runtime: ModeNeutralCoreObjectRuntimeStateV2,
  lifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle,
  removedObjectIds: ReadonlySet<string> = new Set<string>(),
): ModeNeutralCoreRootV1 {
  const current = stackBundle(root);
  const announcementByObject = Object.fromEntries(
    Object.entries(current.stackAnnouncements.byObject).filter(([objectId]) => !removedObjectIds.has(objectId)),
  );
  // Keep this adapter structural: the closure boundary owns the stack module,
  // while the RuleAuthority factory below performs the canonical validation.
  const stackAnnouncements = {
    kind: current.stackAnnouncements.kind,
    byObject: announcementByObject,
  };
  const remainingEffectOrder = root.ruleAuthority.control.effectOrder.filter((key) => {
    const effect = root.ruleAuthority.control.byEffect[key];
    return registry.objects[effect.targetObjectId] !== undefined
      && (effect.sourceObjectId === null || registry.objects[effect.sourceObjectId] !== undefined);
  });
  const remainingEffects = Object.fromEntries(remainingEffectOrder.map((key) => [key, root.ruleAuthority.control.byEffect[key]]));
  const continuity: Record<string, { readonly controllerPlayerId: CorePlayerId; readonly continuousSinceMostRecentTurnBegan: boolean }> = Object.create(null) as Record<string, { readonly controllerPlayerId: CorePlayerId; readonly continuousSinceMostRecentTurnBegan: boolean }>;
  for (const objectId of registry.zones.shared.battlefield) {
    const object = registry.objects[objectId];
    if (object === undefined || (object.kind !== 'card' && object.kind !== 'token')) continue;
    let controller = object.baseControllerPlayerId;
    for (const key of remainingEffectOrder) {
      const effect = root.ruleAuthority.control.byEffect[key];
      if (effect.targetObjectId === objectId) controller = effect.gainingControllerPlayerId;
    }
    if (controller === null) continue;
    const previous = root.ruleAuthority.control.continuityByObject[objectId];
    continuity[objectId] = previous ?? { controllerPlayerId: controller, continuousSinceMostRecentTurnBegan: false };
  }
  const control = createModeNeutralCoreControlSliceV1({
    effectOrder: remainingEffectOrder,
    byEffect: remainingEffects,
    continuityByObject: continuity,
  });
  const combatContext = root.combatContext === null ? null : createCoreCombatContextV1({
    ...root.combatContext,
    attacks: root.combatContext.attacks.filter((attack) => registry.objects[attack.attackerObjectId] !== undefined),
    blocks: root.combatContext.blocks.filter((block) =>
      registry.objects[block.blockerObjectId] !== undefined
      && registry.objects[block.attackedObjectId] !== undefined
      && root.combatContext?.attacks.some((attack) => attack.attackerObjectId === block.attackedObjectId && attack.defendingPlayerId === block.defendingPlayerId)),
  });
  const stack = {
    objectRegistry: registry,
    objectRuntime: runtime,
    stackAnnouncements,
  };
  const turnPriorityBundle = {
    stackBundle: stack,
    pendingTriggers: root.ruleAuthority.turnPriorityBundle.pendingTriggers,
    lifecycle,
  };
  // A tabletop transition may remove or reincarnate an object that an active
  // visibility grant references.  Reconcile against the *next* registry
  // before the root factory validates cross-slice object relations; otherwise
  // a stale source/subject/top-prefix grant rejects an otherwise valid atomic
  // transition before closure can be recorded.
  const visibility = pruneCoreVisibilityGrantsV1(root.ruleAuthority.visibility, {
    registry,
    currentSequence: root.acceptedCommandCount + 1,
    activePlayerIds: root.playerLifecycle.players.filter((entry) => entry.status === 'active').map((entry) => entry.playerId),
    searchSessionIds: root.ruleAuthority.searchSessions.sessionOrder,
    currentTurnNumber: lifecycle.turnNumber,
  }).value;
  const ruleAuthority = createCoreRuleAuthorityBundleV1({
    ...root.ruleAuthority,
    control,
    turnPriorityBundle,
    visibility,
  });
  return createModeNeutralCoreRootV1({ ...root, ruleAuthority, combatContext });
}

function replaceRegistry(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  patch: Partial<ModeNeutralCoreObjectRegistryStateV2>,
): ModeNeutralCoreObjectRegistryStateV2 {
  return createModeNeutralCoreObjectRegistryStateV2({
    players: patch.players ?? registry.players,
    turnOrder: patch.turnOrder ?? registry.turnOrder,
    activePlayerId: patch.activePlayerId ?? registry.activePlayerId,
    cardDefinitions: patch.cardDefinitions ?? registry.cardDefinitions,
    physicalCards: patch.physicalCards ?? registry.physicalCards,
    objects: patch.objects ?? registry.objects,
    zones: patch.zones ?? registry.zones,
  });
}

function replaceRuntime(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  runtime: ModeNeutralCoreObjectRuntimeStateV2,
): ModeNeutralCoreObjectRuntimeStateV2 {
  return createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtime.byObject });
}

type PlayerZone = 'library' | 'hand' | 'graveyard';
type SharedZone = 'battlefield' | 'stack' | 'exile' | 'command';
type Location =
  | Readonly<{ readonly scope: 'player'; readonly playerId: CorePlayerId; readonly zone: PlayerZone; readonly index: number }>
  | Readonly<{ readonly scope: 'shared'; readonly zone: SharedZone; readonly index: number }>;

function locationsOf(registry: ModeNeutralCoreObjectRegistryStateV2, objectId: CoreObjectId): readonly Location[] {
  const locations: Location[] = [];
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      zones[zone].forEach((candidate, index) => {
        if (candidate === objectId) locations.push({ scope: 'player', playerId, zone, index });
      });
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    registry.zones.shared[zone].forEach((candidate, index) => {
      if (candidate === objectId) locations.push({ scope: 'shared', zone, index });
    });
  }
  return locations;
}

function cloneZones(registry: ModeNeutralCoreObjectRegistryStateV2): {
  readonly byPlayer: Record<CorePlayerId, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }>;
  readonly shared: { battlefield: CoreObjectId[]; stack: CoreObjectId[]; exile: CoreObjectId[]; command: CoreObjectId[] };
} {
  const byPlayer = Object.create(null) as Record<CorePlayerId, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }>;
  for (const playerId of registry.turnOrder) {
    const current = registry.zones.byPlayer[playerId];
    byPlayer[playerId] = {
      library: current.library.slice(),
      hand: current.hand.slice(),
      graveyard: current.graveyard.slice(),
    };
  }
  const shared = {
    battlefield: registry.zones.shared.battlefield.slice(),
    stack: registry.zones.shared.stack.slice(),
    exile: registry.zones.shared.exile.slice(),
    command: registry.zones.shared.command.slice(),
  };
  return { byPlayer, shared };
}

function zonesValue(
  value: ReturnType<typeof cloneZones>,
): ModeNeutralCoreObjectRegistryStateV2['zones'] {
  return {
    byPlayer: value.byPlayer,
    shared: value.shared,
  };
}

function clearAttachmentReferences(
  entries: RuntimeRecord,
  removedObjectIds: ReadonlySet<string>,
): void {
  for (const [objectId, runtime] of Object.entries(entries) as [CoreObjectId, CoreCardObjectRuntimeStateV1][]) {
    const attachedTo = runtime.attachment.attachedTo;
    if (attachedTo !== null && attachedTo.kind === 'object' && removedObjectIds.has(attachedTo.objectId)) {
      entries[objectId] = {
        orientation: runtime.orientation,
        counterDamage: runtime.counterDamage,
        attachment: createCoreAttachmentStateV1({ attachedTo: null }),
      };
    }
  }
}

function locationArray(value: ReturnType<typeof cloneZones>, location: Location): CoreObjectId[] {
  return location.scope === 'player'
    ? value.byPlayer[location.playerId][location.zone]
    : value.shared[location.zone];
}

function controllerOf(root: ModeNeutralCoreRootV1, objectId: CoreObjectId): CorePlayerId | null {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined) return null;
  let controller = object.kind === 'card' || object.kind === 'token'
    ? object.baseControllerPlayerId
    : object.controllerPlayerId;
  for (const key of root.ruleAuthority.control.effectOrder) {
    const effect = root.ruleAuthority.control.byEffect[key];
    if (effect.targetObjectId === objectId) controller = effect.gainingControllerPlayerId;
  }
  return controller;
}

function destinationLocation(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  cardObjectId: CoreObjectId,
  destination: CoreCardZoneDestinationV1,
): Location {
  const object = registry.objects[cardObjectId];
  if (object === undefined || object.kind !== 'card') fail('INVALID_TARGET', '/payload/objectId', 'Only card objects may move between zones');
  const owner = registry.physicalCards[object.physicalCardId]?.ownerPlayerId;
  if (owner === undefined) fail('INVALID_TARGET', '/payload/objectId', 'Card owner is not registered');
  if (destination.kind === 'owner-library') return { scope: 'player', playerId: owner, zone: 'library', index: 0 };
  if (destination.kind === 'owner-hand') return { scope: 'player', playerId: owner, zone: 'hand', index: 0 };
  if (destination.kind === 'owner-graveyard') return { scope: 'player', playerId: owner, zone: 'graveyard', index: 0 };
  return { scope: 'shared', zone: destination.kind, index: 0 };
}

function sameLocation(left: Location, right: Location): boolean {
  return left.scope === right.scope && left.zone === right.zone
    && (left.scope === 'shared' || right.scope === 'shared' || left.playerId === right.playerId);
}

function playerWith(
  player: CorePlayerStateV1,
  changes: Readonly<{ readonly manaPool?: CoreManaPoolV1; readonly drawnThisTurn?: number }>,
): CorePlayerStateV1 {
  return {
    life: player.life,
    poison: player.poison,
    energy: player.energy,
    experience: player.experience,
    manaPool: changes.manaPool ?? player.manaPool,
    mulliganCount: player.mulliganCount,
    landsPlayedThisTurn: player.landsPlayedThisTurn,
    spellsCastThisTurn: player.spellsCastThisTurn,
    drawnThisTurn: changes.drawnThisTurn ?? player.drawnThisTurn,
    maximumHandSizeOverride: player.maximumHandSizeOverride,
  };
}

function manualStateOf(root: ModeNeutralCoreRootV1): CoreTabletopManualStateV1 {
  return root.tabletopManual ?? createCoreTabletopManualStateV1();
}

function withManualState(root: ModeNeutralCoreRootV1, state: CoreTabletopManualStateV1): ModeNeutralCoreRootV1 {
  // Manual facts record the revision that the enclosing command is about to
  // accept. Build the intermediate root at that revision so the root
  // validator can enforce the same invariant used by persisted state.
  assertManualStateBudget(state);
  return createModeNeutralCoreRootV1({ ...root, acceptedCommandCount: root.acceptedCommandCount + 1, tabletopManual: state });
}

function manualModeOf(payload: CoreTabletopCommandPayloadV1): CoreTabletopManualModeV1 | undefined {
  if (!('manualMode' in payload)) return undefined;
  return payload.manualMode === 'structured' || payload.manualMode === 'freeform' ? payload.manualMode : undefined;
}

export function drawCoreTabletopCardsV1(
  root: ModeNeutralCoreRootV1,
  actorPlayerId: CorePlayerId,
  count: number,
): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const player = registry.players[actorPlayerId];
  if (player === undefined) fail('PLAYER_NOT_SEATED', '/actorPlayerId', 'Actor is not seated');
  const currentLibrary = registry.zones.byPlayer[actorPlayerId]?.library;
  if (currentLibrary === undefined || currentLibrary.length < count) {
    fail('LIBRARY_INSUFFICIENT', '/payload/count', 'The library does not contain enough cards');
  }
  const zones = cloneZones(registry);
  const objects: ObjectRecord = { ...registry.objects };
  const runtimeEntries: RuntimeRecord = { ...stackBundle(root).objectRuntime.byObject };
  const removedObjectIds = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const oldId = zones.byPlayer[actorPlayerId].library.shift();
    if (oldId === undefined) fail('LIBRARY_INSUFFICIENT', '/payload/count', 'The library does not contain enough cards');
    const oldObject = registry.objects[oldId];
    if (oldObject === undefined || oldObject.kind !== 'card') fail('INVALID_LIBRARY', '/payload', 'The library contains a non-card object');
    const nextIncarnation = nextCoreCardIncarnationV1(oldObject.incarnation);
    const nextId = `${oldObject.physicalCardId}:${nextIncarnation}` as CoreObjectId;
    objects[nextId] = createCoreCardObjectIdentityV2({
      kind: 'card',
      physicalCardId: oldObject.physicalCardId,
      incarnation: nextIncarnation,
      baseControllerPlayerId: null,
    });
    delete objects[oldId];
    delete runtimeEntries[oldId];
    removedObjectIds.add(oldId);
    runtimeEntries[nextId] = createDefaultCoreCardRuntimeAfterZoneChangeV1();
    zones.byPlayer[actorPlayerId].hand.push(nextId);
  }
  clearAttachmentReferences(runtimeEntries, removedObjectIds);
  const players = { ...registry.players, [actorPlayerId]: playerWith(player, { drawnThisTurn: player.drawnThisTurn + count }) };
  const nextRegistry = replaceRegistry(registry, { objects, players, zones: zonesValue(zones) });
  const nextRuntime = replaceRuntime(nextRegistry, createModeNeutralCoreObjectRuntimeStateV2(nextRegistry, { byObject: runtimeEntries }));
  return {
    root: rebuildRoot(root, nextRegistry, nextRuntime, root.ruleAuthority.turnPriorityBundle.lifecycle, removedObjectIds),
    payloads: [{ kind: 'table-draw', playerId: actorPlayerId, count }],
  };
}

function moveCard(
  root: ModeNeutralCoreRootV1,
  actorPlayerId: CorePlayerId,
  objectId: CoreObjectId,
  destination: CoreCardZoneDestinationV1,
  requireAuthority = false,
): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || object.kind !== 'card') fail('INVALID_TARGET', '/payload/objectId', 'Only an existing card object may move');
  const locations = locationsOf(registry, objectId);
  if (locations.length !== 1) fail('INVALID_TARGET', '/payload/objectId', 'Card object must be present in exactly one zone');
  const source = locations[0];
  if (requireAuthority) {
    if (source.scope === 'player' && source.playerId !== actorPlayerId) {
      fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not own the source zone');
    }
    if (source.scope === 'player' && source.zone === 'library') {
      fail('HIDDEN_SOURCE_UNAVAILABLE', '/payload/objectId', 'Library objects may only be addressed by Draw or Shuffle');
    }
    if (source.scope === 'shared' && (source.zone === 'battlefield' || source.zone === 'stack')
      && controllerOf(root, objectId) !== actorPlayerId) {
      fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not control the public object');
    }
    if (source.scope === 'shared' && (source.zone === 'exile' || source.zone === 'command')) {
      const owner = registry.physicalCards[object.physicalCardId]?.ownerPlayerId;
      if (owner !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not own the public object');
    }
    if (destination.kind === 'owner-library' && destination.placement.kind === 'index') {
      fail('INVALID_DESTINATION', '/payload/destination/placement', 'Indexed library placement is not available to manual operations');
    }
    if ((destination.kind === 'battlefield' || destination.kind === 'stack')
      && destination.baseControllerPlayerId !== actorPlayerId) {
      fail('UNAUTHORIZED_OBJECT', '/payload/destination/baseControllerPlayerId', 'Actor must remain the destination controller');
    }
  }
  if (source.scope === 'player' && (source.zone === 'library' || source.zone === 'hand') && source.playerId !== actorPlayerId) {
    fail('HIDDEN_SOURCE_AUTHORITY', '/payload/objectId', 'The actor does not own the hidden source zone');
  }
  const target = destinationLocation(registry, objectId, destination);
  if (sameLocation(source, target)) fail('SAME_ZONE_TRANSITION', '/payload/destination', 'Same-zone reorder is not supported');
  const nextIncarnation = nextCoreCardIncarnationV1(object.incarnation);
  const nextId = `${object.physicalCardId}:${nextIncarnation}` as CoreObjectId;
  const zones = cloneZones(registry);
  const sourceArray = locationArray(zones, source);
  if (sourceArray.splice(source.index, 1)[0] !== objectId) fail('INVALID_TARGET', '/payload/objectId', 'Card source is inconsistent');
  const targetArray = locationArray(zones, target);
  const placement = destination.kind === 'owner-library' ? destination.placement : null;
  const targetIndex = placement?.kind === 'top' ? 0 : placement?.kind === 'bottom' ? targetArray.length : placement?.kind === 'index' ? placement.index : targetArray.length;
  if (targetIndex > targetArray.length) fail('INVALID_DESTINATION', '/payload/destination', 'Library placement exceeds the library length');
  targetArray.splice(targetIndex, 0, nextId);
  const objects: ObjectRecord = { ...registry.objects };
  delete objects[objectId];
  objects[nextId] = createCoreCardObjectIdentityV2({
    kind: 'card', physicalCardId: object.physicalCardId, incarnation: nextIncarnation,
    baseControllerPlayerId: destination.kind === 'battlefield' || destination.kind === 'stack' ? destination.baseControllerPlayerId : null,
  });
  const nextRegistry = replaceRegistry(registry, { objects, zones: zonesValue(zones) });
  const runtimeEntries: RuntimeRecord = { ...stackBundle(root).objectRuntime.byObject };
  delete runtimeEntries[objectId];
  clearAttachmentReferences(runtimeEntries, new Set([objectId]));
  runtimeEntries[nextId] = createDefaultCoreCardRuntimeAfterZoneChangeV1();
  const nextRuntime = replaceRuntime(nextRegistry, createModeNeutralCoreObjectRuntimeStateV2(nextRegistry, { byObject: runtimeEntries }));
  return {
    root: rebuildRoot(root, nextRegistry, nextRuntime, root.ruleAuthority.turnPriorityBundle.lifecycle, new Set([objectId])),
    payloads: [{ kind: 'table-zone-moved', objectId, newObjectId: nextId, destination: destination.kind }],
  };
}

function tapPermanent(
  root: ModeNeutralCoreRootV1,
  actorPlayerId: CorePlayerId,
  objectId: CoreObjectId,
  tapped: boolean,
  requireAuthority = false,
): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || (object.kind !== 'card' && object.kind !== 'token')) fail('INVALID_TARGET', '/payload/objectId', 'Tap target must be a card or token');
  if (!registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Tap target must be on the battlefield');
  if (requireAuthority && controllerOf(root, objectId) !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not control tap target');
  const current = stackBundle(root).objectRuntime.byObject[objectId];
  if (current === undefined) fail('INVALID_TARGET', '/payload/objectId', 'Tap target runtime is missing');
  if (current.orientation.tapped === tapped) fail('NO_OP', '/payload/tapped', 'Tap command would not change orientation');
  const runtimeEntries: RuntimeRecord = { ...stackBundle(root).objectRuntime.byObject };
  runtimeEntries[objectId] = {
    orientation: createCoreCardOrientationStateV1({ ...current.orientation, tapped }),
    counterDamage: current.counterDamage,
    attachment: current.attachment,
  };
  const nextRuntime = replaceRuntime(registry, createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtimeEntries }));
  return {
    root: rebuildRoot(root, registry, nextRuntime),
    payloads: [{ kind: 'table-tap-changed', objectId, tapped }],
  };
}

function adjustMana(
  root: ModeNeutralCoreRootV1,
  actorPlayerId: CorePlayerId,
  color: CoreManaColorV1,
  delta: number,
): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const player = registry.players[actorPlayerId];
  if (player === undefined) fail('PLAYER_NOT_SEATED', '/actorPlayerId', 'Actor is not seated');
  const current = player.manaPool[color];
  const next = current + delta;
  if (next < 0) fail('MANA_UNDERFLOW', '/payload/delta', 'Mana pool cannot become negative');
  if (!Number.isSafeInteger(next)) fail('MANA_OVERFLOW', '/payload/delta', 'Mana pool would overflow a safe integer');
  const manaPool: CoreManaPoolV1 = { ...player.manaPool, [color]: next };
  const players = { ...registry.players, [actorPlayerId]: playerWith(player, { manaPool }) };
  const nextRegistry = replaceRegistry(registry, { players });
  return {
    root: rebuildRoot(root, nextRegistry, stackBundle(root).objectRuntime),
    payloads: [{ kind: 'table-mana-adjusted', playerId: actorPlayerId, color, delta, resultingAmount: next }],
  };
}

function adjustCounter(
  root: ModeNeutralCoreRootV1,
  actorPlayerId: CorePlayerId,
  objectId: CoreObjectId,
  counterKind: string,
  delta: number,
  requireAuthority = false,
): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || (object.kind !== 'card' && object.kind !== 'token')) fail('INVALID_TARGET', '/payload/objectId', 'Counter target must be a card or token');
  if (!registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Counter target must be on the battlefield');
  if (requireAuthority && controllerOf(root, objectId) !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not control counter target');
  const current = stackBundle(root).objectRuntime.byObject[objectId];
  if (current === undefined) fail('INVALID_TARGET', '/payload/objectId', 'Counter target runtime is missing');
  const existing = current.counterDamage.counters.find((entry) => entry.kind === counterKind)?.count ?? 0;
  const next = existing + delta;
  if (next < 0) fail('COUNTER_UNDERFLOW', '/payload/delta', 'Counter count cannot become negative');
  if (!Number.isSafeInteger(next)) fail('COUNTER_OVERFLOW', '/payload/delta', 'Counter count would overflow a safe integer');
  const entries: CoreCounterEntryV1[] = current.counterDamage.counters.filter((entry) => entry.kind !== counterKind).map((entry) => ({ kind: entry.kind, count: entry.count }));
  if (next > 0) entries.push({ kind: counterKind, count: next });
  entries.sort((left, right) => left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0);
  const runtimeEntries: RuntimeRecord = { ...stackBundle(root).objectRuntime.byObject };
  runtimeEntries[objectId] = {
    orientation: current.orientation,
    counterDamage: createCoreCounterDamageStateV1({ counters: entries, markedDamage: current.counterDamage.markedDamage }),
    attachment: current.attachment,
  };
  const nextRuntime = replaceRuntime(registry, createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtimeEntries }));
  return {
    root: rebuildRoot(root, registry, nextRuntime),
    payloads: [{ kind: 'table-counter-adjusted', objectId, counterKind, delta, resultingCount: next }],
  };
}

function createToken(
  root: ModeNeutralCoreRootV1,
  actorPlayerId: CorePlayerId,
  tokenSeed: string,
  definitionId: CoreCardDefinitionId,
  definition: CoreCardDefinitionSnapshotV1,
): CoreTabletopOperationResultV1 {
  boundedTokenDefinition(definition);
  const registry = stackBundle(root).objectRegistry;
  const tokenId = coreTokenObjectIdOfV2(tokenSeed, 0);
  if (Object.prototype.hasOwnProperty.call(registry.objects, tokenId)
    || Object.keys(registry.objects).some((candidate) => {
      const parsed = parseCoreObjectIdV2(candidate);
      return parsed !== null && parsed.kind === 'token' && parsed.seed === tokenSeed;
    })) {
    fail('TOKEN_COLLISION', '/payload/tokenSeed', 'Token seed is already in use');
  }
  if (registry.cardDefinitions[definitionId] !== undefined) fail('DEFINITION_COLLISION', '/payload/definitionId', 'Token definition ID is already registered');
  const identity = createCoreTokenObjectIdentityV2({
    kind: 'token', definitionId, ownerPlayerId: actorPlayerId, incarnation: 0,
    baseControllerPlayerId: actorPlayerId, origin: { kind: 'created', sourceObjectId: null },
  });
  const zones = cloneZones(registry);
  zones.shared.battlefield.push(tokenId);
  const objects: ObjectRecord = { ...registry.objects, [tokenId]: identity };
  const cardDefinitions: DefinitionRecord = { ...registry.cardDefinitions, [definitionId]: definition };
  const nextRegistry = replaceRegistry(registry, { cardDefinitions, objects, zones: zonesValue(zones) });
  const runtimeEntries: RuntimeRecord = { ...stackBundle(root).objectRuntime.byObject, [tokenId]: createDefaultCoreCardRuntimeAfterZoneChangeV1() };
  const nextRuntime = replaceRuntime(nextRegistry, createModeNeutralCoreObjectRuntimeStateV2(nextRegistry, { byObject: runtimeEntries }));
  return {
    root: rebuildRoot(root, nextRegistry, nextRuntime),
    payloads: [{ kind: 'table-token-created', objectId: tokenId, definitionId, controllerPlayerId: actorPlayerId }],
  };
}

function removeToken(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, objectId: CoreObjectId, requireAuthority = false): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || object.kind !== 'token') fail('INVALID_TARGET', '/payload/objectId', 'Token object does not exist');
  if (!registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Token must be on the battlefield');
  if (requireAuthority && controllerOf(root, objectId) !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not control token');
  const zones = cloneZones(registry);
  zones.shared.battlefield = zones.shared.battlefield.filter((candidate) => candidate !== objectId);
  const objects: ObjectRecord = { ...registry.objects };
  delete objects[objectId];
  const nextRegistry = replaceRegistry(registry, { objects, zones: zonesValue(zones) });
  const runtimeEntries: RuntimeRecord = { ...stackBundle(root).objectRuntime.byObject };
  delete runtimeEntries[objectId];
  clearAttachmentReferences(runtimeEntries, new Set([objectId]));
  const nextRuntime = replaceRuntime(nextRegistry, createModeNeutralCoreObjectRuntimeStateV2(nextRegistry, { byObject: runtimeEntries }));
  return {
    root: rebuildRoot(root, nextRegistry, nextRuntime),
    payloads: [{ kind: 'table-token-removed', objectId }],
  };
}

function reorderPublicZone(root: ModeNeutralCoreRootV1, zone: Extract<CoreTabletopCommandPayloadV1, { readonly kind: 'table-reorder' }>['zone'], order: readonly CoreObjectId[]): CoreTabletopOperationResultV1 {
  if (zone.kind !== 'shared-zone') fail('INVALID_ZONE', '/payload/zone', 'Reorder is limited to a public zone');
  const registry = stackBundle(root).objectRegistry;
  const current = registry.zones.shared[zone.zone];
  if (order.length !== current.length || new Set(order).size !== current.length || order.some((id) => !current.includes(id))) fail('INVALID_ORDER', '/payload/order', 'Order must be an exact public-zone permutation');
  const zones = cloneZones(registry); zones.shared[zone.zone] = order.slice();
  const nextRegistry = replaceRegistry(registry, { zones: zonesValue(zones) });
  return { root: rebuildRoot(root, nextRegistry, stackBundle(root).objectRuntime), payloads: [{ kind: 'table-reordered', zone: zone.zone, count: order.length }] };
}

function adjustLife(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, field: Extract<CoreTabletopCommandPayloadV1, { readonly kind: 'table-life-adjust' }>['field'], delta: number): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const player = registry.players[actorPlayerId];
  if (player === undefined) fail('PLAYER_NOT_SEATED', '/actorPlayerId', 'Actor is not seated');
  const current = player[field];
  const next = current + delta;
  if (!Number.isSafeInteger(next) || next < 0) fail('PLAYER_FACT_UNDERFLOW', '/payload/delta', 'Player fact cannot become negative');
  const players = { ...registry.players, [actorPlayerId]: { ...player, [field]: next } };
  const nextRegistry = replaceRegistry(registry, { players });
  return { root: rebuildRoot(root, nextRegistry, stackBundle(root).objectRuntime), payloads: [{ kind: 'table-life-adjusted', playerId: actorPlayerId, field, delta, resultingAmount: next }] };
}

function changeController(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, objectId: CoreObjectId, gainingControllerPlayerId: CorePlayerId): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || !registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Controller target must be public battlefield object');
  if (controllerOf(root, objectId) !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not control object');
  if (!registry.players[gainingControllerPlayerId]) fail('PLAYER_NOT_SEATED', '/payload/gainingControllerPlayerId', 'Gaining controller is not seated');
  if (root.playerLifecycle.players.find((entry) => entry.playerId === gainingControllerPlayerId)?.status !== 'active') {
    fail('PLAYER_NOT_ACTIVE', '/payload/gainingControllerPlayerId', 'Gaining controller is not active');
  }
  const effect = { targetObjectId: objectId, gainingControllerPlayerId, sourceObjectId: null, duration: { kind: 'manual' as const } };
  const effectKey = (`manual-control-${root.acceptedCommandCount + 1}`) as never;
  const result = applyCoreControlEffectV1(root.ruleAuthority.control, effectKey, effect);
  const nextRoot = createModeNeutralCoreRootV1({ ...root, ruleAuthority: createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, control: result.value }) });
  return { root: nextRoot, payloads: [{ kind: 'table-controller-changed', objectId, gainingControllerPlayerId }] };
}

function changeAttachment(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, objectId: CoreObjectId, targetObjectId: CoreObjectId | null): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  if (!registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Attachment source must be public battlefield object');
  if (controllerOf(root, objectId) !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not control attaching object');
  if (targetObjectId !== null && (!registry.zones.shared.battlefield.includes(targetObjectId) || targetObjectId === objectId)) fail('INVALID_TARGET', '/payload/targetObjectId', 'Attachment target must be another public battlefield object');
  const current = stackBundle(root).objectRuntime.byObject[objectId];
  if (current === undefined) fail('INVALID_TARGET', '/payload/objectId', 'Attachment runtime is missing');
  const runtimeEntries: RuntimeRecord = { ...stackBundle(root).objectRuntime.byObject, [objectId]: { orientation: current.orientation, counterDamage: current.counterDamage, attachment: createCoreAttachmentStateV1({ attachedTo: targetObjectId === null ? null : { kind: 'object', objectId: targetObjectId } }) } };
  const nextRuntime = replaceRuntime(registry, createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtimeEntries }));
  return { root: rebuildRoot(root, registry, nextRuntime), payloads: [{ kind: 'table-attachment-changed', objectId, targetObjectId }] };
}

function markDamage(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, objectId: CoreObjectId, amount: number): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  if (!registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Damage target must be public battlefield object');
  if (controllerOf(root, objectId) !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload/objectId', 'Actor does not control damage target');
  const current = stackBundle(root).objectRuntime.byObject[objectId];
  if (current === undefined) fail('INVALID_TARGET', '/payload/objectId', 'Damage runtime is missing');
  const next = current.counterDamage.markedDamage + amount;
  if (!Number.isSafeInteger(next) || next < 0) fail('DAMAGE_UNDERFLOW', '/payload/amount', 'Marked damage cannot become negative');
  const runtimeEntries: RuntimeRecord = { ...stackBundle(root).objectRuntime.byObject, [objectId]: { orientation: current.orientation, counterDamage: createCoreCounterDamageStateV1({ counters: current.counterDamage.counters, markedDamage: next }), attachment: current.attachment } };
  const nextRuntime = replaceRuntime(registry, createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtimeEntries }));
  return { root: rebuildRoot(root, registry, nextRuntime), payloads: [{ kind: 'table-damage-marked', objectId, amount, resultingAmount: next }] };
}

function setNote(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, payload: Extract<CoreTabletopCommandPayloadV1, { readonly kind: 'table-note-set' }>): CoreTabletopOperationResultV1 {
  if (!applicationId(payload.noteId)) fail('INVALID_ID', '/payload/noteId', 'Invalid application ID');
  const state = manualStateOf(root);
  const existing = state.notes[payload.noteId];
  if (existing !== undefined && existing.authorPlayerId !== actorPlayerId) {
    fail('UNAUTHORIZED_NOTE', '/payload/noteId', 'Only note author may update it');
  }
  const creationRevision = existing?.creationRevision ?? root.acceptedCommandCount + 1;
  const notes = { ...state.notes, [payload.noteId]: Object.freeze({ id: payload.noteId, authorPlayerId: existing?.authorPlayerId ?? actorPlayerId, text: payload.text, creationRevision }) };
  const noteOrder = state.noteOrder.includes(payload.noteId) ? state.noteOrder : [...state.noteOrder, payload.noteId];
  return { root: withManualState(root, createCoreTabletopManualStateV1({ notes, noteOrder, stackEntries: state.stackEntries })), payloads: [{ kind: 'table-note-set', noteId: payload.noteId, authorPlayerId: existing?.authorPlayerId ?? actorPlayerId, creationRevision }] };
}

function clearNote(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, payload: Extract<CoreTabletopCommandPayloadV1, { readonly kind: 'table-note-clear' }>): CoreTabletopOperationResultV1 {
  if (!applicationId(payload.noteId)) fail('INVALID_ID', '/payload/noteId', 'Invalid application ID');
  const state = manualStateOf(root); const note = state.notes[payload.noteId];
  if (note === undefined) fail('NOTE_NOT_FOUND', '/payload/noteId', 'Note does not exist');
  if (note.authorPlayerId !== actorPlayerId) fail('UNAUTHORIZED_NOTE', '/payload/noteId', 'Only note author may clear it');
  const notes = { ...state.notes }; delete notes[payload.noteId];
  return { root: withManualState(root, createCoreTabletopManualStateV1({ notes, noteOrder: state.noteOrder.filter((id) => id !== payload.noteId), stackEntries: state.stackEntries })), payloads: [{ kind: 'table-note-cleared', noteId: payload.noteId, authorPlayerId: actorPlayerId }] };
}

function addStackEntry(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, payload: Extract<CoreTabletopCommandPayloadV1, { readonly kind: 'table-stack-entry' }>): CoreTabletopOperationResultV1 {
  if (!applicationId(payload.entryId)) fail('INVALID_ID', '/payload/entryId', 'Invalid application ID');
  const state = manualStateOf(root);
  if (state.stackEntries.some((entry) => entry.id === payload.entryId)) fail('ENTRY_COLLISION', '/payload/entryId', 'Manual stack entry ID is already in use');
  if (payload.sourceObjectId !== undefined && payload.sourceObjectId !== null) {
    const registry = stackBundle(root).objectRegistry;
    const source = registry.objects[payload.sourceObjectId];
    if (source === undefined || !registry.zones.shared.stack.includes(payload.sourceObjectId)) fail('INVALID_TARGET', '/payload/sourceObjectId', 'Manual stack source must be a public stack object');
    if (controllerOf(root, payload.sourceObjectId) !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload/sourceObjectId', 'Actor does not control manual stack source');
  }
  const provenance: CoreTabletopManualModeV1 = payload.manualMode === 'structured' ? 'structured' : 'freeform';
  const entry = Object.freeze({ id: payload.entryId, label: payload.label, provenance, sourceObjectId: payload.sourceObjectId ?? null, authorPlayerId: actorPlayerId, creationRevision: root.acceptedCommandCount + 1 });
  return { root: withManualState(root, createCoreTabletopManualStateV1({ notes: state.notes, noteOrder: state.noteOrder, stackEntries: [...state.stackEntries, entry] })), payloads: [{ kind: 'table-stack-entry-added', entryId: entry.id, authorPlayerId: actorPlayerId, creationRevision: entry.creationRevision }] };
}

function resolveManual(root: ModeNeutralCoreRootV1, actorPlayerId: CorePlayerId, payload: Extract<CoreTabletopCommandPayloadV1, { readonly kind: 'table-manual-resolve' }>): CoreTabletopOperationResultV1 {
  if (payload.entryId !== undefined && !applicationId(payload.entryId)) fail('INVALID_ID', '/payload/entryId', 'Invalid application ID');
  const state = manualStateOf(root); const top = state.stackEntries[state.stackEntries.length - 1];
  if (top === undefined || (payload.entryId !== undefined && payload.entryId !== top.id)) fail('STACK_TOP_ONLY', '/payload/entryId', 'Only the current manual stack top may resolve');
  if (top.authorPlayerId !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload', 'Only the entry author may resolve this manual entry');
  const entries = state.stackEntries.slice(0, -1);
  // Remove the metadata entry before moving its represented stack object so
  // the intermediate root remains internally consistent at every boundary.
  let workingRoot = withManualState(root, createCoreTabletopManualStateV1({ notes: state.notes, noteOrder: state.noteOrder, stackEntries: entries }));
  if (top.sourceObjectId !== null) {
    if (controllerOf(workingRoot, top.sourceObjectId) !== actorPlayerId) fail('UNAUTHORIZED_OBJECT', '/payload', 'Actor does not control manual stack source');
    const source = stackBundle(workingRoot).objectRegistry.objects[top.sourceObjectId];
    if (source === undefined) fail('INVALID_TARGET', '/payload', 'Manual stack source is missing');
    if (source.kind === 'card') {
      const destination = { kind: 'owner-graveyard' as const };
      const moved = moveCard(workingRoot, actorPlayerId, top.sourceObjectId, destination, true);
      workingRoot = moved.root;
    } else if (source.kind === 'spell-copy' || source.kind === 'activated-ability' || source.kind === 'triggered-ability') {
      const removed = removeCoreStackObjectV1(stackBundle(workingRoot), { kind: 'cease', objectId: top.sourceObjectId });
      workingRoot = rebuildRoot(workingRoot, removed.bundle.objectRegistry, removed.bundle.objectRuntime, workingRoot.ruleAuthority.turnPriorityBundle.lifecycle, new Set([top.sourceObjectId]));
    } else {
      fail('INVALID_TARGET', '/payload', 'Manual stack source is not resolvable');
    }
  }
  return { root: workingRoot, payloads: [{ kind: 'table-manual-resolved', entryId: top.id, objectId: top.sourceObjectId }] };
}

export function untapCoreTabletopPermanentsV1(
  root: ModeNeutralCoreRootV1,
  registry: ModeNeutralCoreObjectRegistryStateV2,
  runtime: ModeNeutralCoreObjectRuntimeStateV2,
  activePlayerId: CorePlayerId,
): ModeNeutralCoreObjectRuntimeStateV2 {
  const runtimeEntries: RuntimeRecord = { ...runtime.byObject };
  for (const objectId of registry.zones.shared.battlefield) {
    if (controllerOf(root, objectId) !== activePlayerId) continue;
    const current = runtime.byObject[objectId];
    if (current === undefined || !current.orientation.tapped) continue;
    runtimeEntries[objectId] = {
      orientation: createCoreCardOrientationStateV1({ ...current.orientation, tapped: false }),
      counterDamage: current.counterDamage,
      attachment: current.attachment,
    };
  }
  return replaceRuntime(registry, createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtimeEntries }));
}

export function applyCoreTabletopPayloadV1(
  root: ModeNeutralCoreRootV1,
  actorPlayerId: CorePlayerId,
  payload: CoreTabletopCommandPayloadV1,
): CoreTabletopOperationResultV1 {
  let result: CoreTabletopOperationResultV1;
  const requireAuthority = manualModeOf(payload) !== undefined;
  switch (payload.kind) {
    case 'table-draw': result = drawCoreTabletopCardsV1(root, actorPlayerId, payload.count); break;
    case 'table-zone-move': result = moveCard(root, actorPlayerId, payload.objectId, payload.destination, requireAuthority); break;
    case 'table-tap': result = tapPermanent(root, actorPlayerId, payload.objectId, payload.tapped, requireAuthority); break;
    case 'table-mana-adjust': result = adjustMana(root, actorPlayerId, payload.color, payload.delta); break;
    case 'table-counter-adjust': result = adjustCounter(root, actorPlayerId, payload.objectId, payload.counterKind, payload.delta, requireAuthority); break;
    case 'table-token-create': result = createToken(root, actorPlayerId, payload.tokenSeed, payload.definitionId, payload.definition); break;
    case 'table-token-remove': result = removeToken(root, actorPlayerId, payload.objectId, requireAuthority); break;
    case 'table-shuffle': fail('SHUFFLE_REQUIRES_SERVER_RANDOM', '/payload', 'Shuffle must be bound to a server-authoritative random order'); break;
    case 'table-reorder': result = reorderPublicZone(root, payload.zone, payload.order); break;
    case 'table-life-adjust': result = adjustLife(root, actorPlayerId, payload.field, payload.delta); break;
    case 'table-controller-change': result = changeController(root, actorPlayerId, payload.objectId, payload.gainingControllerPlayerId); break;
    case 'table-attach': result = changeAttachment(root, actorPlayerId, payload.objectId, payload.targetObjectId); break;
    case 'table-damage-mark': result = markDamage(root, actorPlayerId, payload.objectId, payload.amount); break;
    case 'table-note-set': result = setNote(root, actorPlayerId, payload); break;
    case 'table-note-clear': result = clearNote(root, actorPlayerId, payload); break;
    case 'table-stack-entry': result = addStackEntry(root, actorPlayerId, payload); break;
    case 'table-manual-resolve': result = resolveManual(root, actorPlayerId, payload); break;
    case 'table-turn-progress': fail('TURN_PROGRESS_REQUIRES_CLOSURE', '/payload', 'Turn progression is composed by the Core closure');
  }
  const mode = manualModeOf(payload);
  if (mode === undefined) return result;
  return { root: result.root, payloads: result.payloads.map((entry) => ({ ...entry, manualMode: mode })) };
}
