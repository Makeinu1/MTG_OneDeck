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
import { createModeNeutralCoreControlSliceV1 } from '../rules/controlEffectV1';
import { createCoreCombatContextV1 } from '../combat/combatContextV1';
import type { CoreCardZoneDestinationV1 } from '../transition/zoneDestination';
import { nextCoreCardIncarnationV1 } from '../transition/cardReincarnation';
import type { CoreTabletopCommandPayloadV1 } from './commandV1';

type ObjectRecord = Record<CoreObjectId, CoreGameObjectIdentityV2>;
type RuntimeRecord = Record<CoreObjectId, CoreCardObjectRuntimeStateV1>;
type DefinitionRecord = Record<CoreCardDefinitionId, CoreCardDefinitionSnapshotV1>;

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
  const ruleAuthority = createCoreRuleAuthorityBundleV1({
    ...root.ruleAuthority,
    control,
    turnPriorityBundle,
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
  let controller = object.kind === 'card' || object.kind === 'token' ? object.baseControllerPlayerId : null;
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
): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || object.kind !== 'card') fail('INVALID_TARGET', '/payload/objectId', 'Only an existing card object may move');
  const locations = locationsOf(registry, objectId);
  if (locations.length !== 1) fail('INVALID_TARGET', '/payload/objectId', 'Card object must be present in exactly one zone');
  const source = locations[0];
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
  objectId: CoreObjectId,
  tapped: boolean,
): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || (object.kind !== 'card' && object.kind !== 'token')) fail('INVALID_TARGET', '/payload/objectId', 'Tap target must be a card or token');
  if (!registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Tap target must be on the battlefield');
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
  objectId: CoreObjectId,
  counterKind: string,
  delta: number,
): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || (object.kind !== 'card' && object.kind !== 'token')) fail('INVALID_TARGET', '/payload/objectId', 'Counter target must be a card or token');
  if (!registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Counter target must be on the battlefield');
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

function removeToken(root: ModeNeutralCoreRootV1, objectId: CoreObjectId): CoreTabletopOperationResultV1 {
  const registry = stackBundle(root).objectRegistry;
  const object = registry.objects[objectId];
  if (object === undefined || object.kind !== 'token') fail('INVALID_TARGET', '/payload/objectId', 'Token object does not exist');
  if (!registry.zones.shared.battlefield.includes(objectId)) fail('INVALID_TARGET', '/payload/objectId', 'Token must be on the battlefield');
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
  switch (payload.kind) {
    case 'table-draw': return drawCoreTabletopCardsV1(root, actorPlayerId, payload.count);
    case 'table-zone-move': return moveCard(root, actorPlayerId, payload.objectId, payload.destination);
    case 'table-tap': return tapPermanent(root, payload.objectId, payload.tapped);
    case 'table-mana-adjust': return adjustMana(root, actorPlayerId, payload.color, payload.delta);
    case 'table-counter-adjust': return adjustCounter(root, payload.objectId, payload.counterKind, payload.delta);
    case 'table-token-create': return createToken(root, actorPlayerId, payload.tokenSeed, payload.definitionId, payload.definition);
    case 'table-token-remove': return removeToken(root, payload.objectId);
    case 'table-turn-progress': fail('TURN_PROGRESS_REQUIRES_CLOSURE', '/payload', 'Turn progression is composed by the Core closure');
  }
}
