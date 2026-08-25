import type { CorePlayerStateV1 } from '../identityZoneState';
import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../ids';
import {
  createCoreCardObjectIdentityV2,
  createModeNeutralCoreObjectRegistryStateV2,
  createModeNeutralCoreObjectRuntimeStateV2,
} from '../object';
import type { ModeNeutralCoreObjectRegistrySliceV2 } from '../object';
import { createModeNeutralCoreRootV1 } from '../closure/rootValidationV1';
import type { ModeNeutralCoreRootV1 } from '../closure/rootV1';
import { createDefaultCoreCardRuntimeAfterZoneChangeV1, nextCoreCardIncarnationV1 } from '../transition/cardReincarnation';
import type {
  CorePregameBottomBatchV1,
  CorePregameMulliganInputV1,
  CorePregameOperationIssueV1,
  CorePregameOperationResultV1,
  CorePregamePlayerPhysicalOrderV1,
  CorePregameSetupResultV1,
} from './typesV1';

type RawRecord = Record<string, unknown>;

function issue(code: string, path: string, message: string): CorePregameOperationIssueV1 {
  return Object.freeze({ code, path, message });
}

function failure(code: string, path: string, message: string): never {
  throw new Error(`${code}:${path}:${message}`);
}

function objectRegistry(root: ModeNeutralCoreRootV1): ModeNeutralCoreObjectRegistrySliceV2 {
  return root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
}

function runtime(root: ModeNeutralCoreRootV1) {
  return root.ruleAuthority.turnPriorityBundle.stackBundle.objectRuntime;
}

function cloneZones(registry: ModeNeutralCoreObjectRegistrySliceV2): {
  readonly byPlayer: Record<CorePlayerId, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }>;
  readonly shared: { battlefield: CoreObjectId[]; stack: CoreObjectId[]; exile: CoreObjectId[]; command: CoreObjectId[] };
} {
  const byPlayer = Object.create(null) as Record<CorePlayerId, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }>;
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    if (zones === undefined) failure('PLAYER_NOT_SEATED', '/turnOrder', 'Player has no zones');
    byPlayer[playerId] = {
      library: [...zones.library],
      hand: [...zones.hand],
      graveyard: [...zones.graveyard],
    };
  }
  return {
    byPlayer,
    shared: {
      battlefield: [...registry.zones.shared.battlefield],
      stack: [...registry.zones.shared.stack],
      exile: [...registry.zones.shared.exile],
      command: [...registry.zones.shared.command],
    },
  };
}

function rebuildRoot(
  root: ModeNeutralCoreRootV1,
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  runtimeState: ReturnType<typeof createModeNeutralCoreObjectRuntimeStateV2>,
  lifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle,
  playerLifecycle = root.playerLifecycle,
  commanderDamage = root.commanderDamage,
  commanderDamageProvenance = root.commanderDamageProvenance,
): ModeNeutralCoreRootV1 {
  const current = root.ruleAuthority.turnPriorityBundle;
  const stackBundle = {
    objectRegistry: registry,
    objectRuntime: runtimeState,
    stackAnnouncements: current.stackBundle.stackAnnouncements,
  };
  const turnPriorityBundle = {
    stackBundle,
    pendingTriggers: current.pendingTriggers,
    lifecycle,
  };
  return createModeNeutralCoreRootV1({
    ...root,
    playerLifecycle,
    commanderDamage,
    commanderDamageProvenance,
    ruleAuthority: { ...root.ruleAuthority, turnPriorityBundle },
  });
}

function validPermutation(
  order: readonly CorePhysicalCardId[],
  expected: readonly CorePhysicalCardId[],
  path: string,
): void {
  if (order.length !== expected.length) failure('INVALID_PERMUTATION', path, 'Permutation length does not match the library');
  const expectedSet = new Set(expected);
  const seen = new Set<CorePhysicalCardId>();
  for (const physicalCardId of order) {
    if (!expectedSet.has(physicalCardId) || seen.has(physicalCardId)) {
      failure('INVALID_PERMUTATION', path, 'Permutation must contain every physical library card exactly once');
    }
    seen.add(physicalCardId);
  }
}

function physicalOf(registry: ModeNeutralCoreObjectRegistrySliceV2, objectId: CoreObjectId): CorePhysicalCardId {
  const object = registry.objects[objectId];
  if (object?.kind !== 'card') failure('INVALID_CARD', '/objectId', 'Pregame setup accepts card objects only');
  return object.physicalCardId;
}

function nextCard(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objects: RawRecord,
  runtimeEntries: RawRecord,
  oldObjectId: CoreObjectId,
): CoreObjectId {
  const object = (objects[oldObjectId] ?? registry.objects[oldObjectId]) as ModeNeutralCoreObjectRegistrySliceV2['objects'][CoreObjectId] | undefined;
  if (object?.kind !== 'card') failure('INVALID_CARD', '/objectId', 'Card object is missing');
  const incarnation = nextCoreCardIncarnationV1(object.incarnation);
  const nextObjectId = `${object.physicalCardId}:${String(incarnation)}` as CoreObjectId;
  delete objects[oldObjectId];
  objects[nextObjectId] = createCoreCardObjectIdentityV2({
    kind: 'card',
    physicalCardId: object.physicalCardId,
    incarnation,
    baseControllerPlayerId: null,
  });
  delete runtimeEntries[oldObjectId];
  runtimeEntries[nextObjectId] = createDefaultCoreCardRuntimeAfterZoneChangeV1();
  return nextObjectId;
}

function playerStateWithMulliganCount(player: CorePlayerStateV1): CorePlayerStateV1 {
  return {
    life: player.life,
    poison: player.poison,
    energy: player.energy,
    experience: player.experience,
    manaPool: player.manaPool,
    mulliganCount: player.mulliganCount + 1,
    landsPlayedThisTurn: player.landsPlayedThisTurn,
    spellsCastThisTurn: player.spellsCastThisTurn,
    drawnThisTurn: 0,
    maximumHandSizeOverride: player.maximumHandSizeOverride,
  };
}

function withPlayers(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  updates: Readonly<Record<CorePlayerId, CorePlayerStateV1>>,
): ModeNeutralCoreObjectRegistrySliceV2['players'] {
  const players: Record<CorePlayerId, CorePlayerStateV1> = Object.create(null) as Record<CorePlayerId, CorePlayerStateV1>;
  for (const playerId of registry.turnOrder) players[playerId] = updates[playerId] ?? registry.players[playerId];
  return players;
}

function applyOrdersAndDeal(
  root: ModeNeutralCoreRootV1,
  orders: readonly CorePregamePlayerPhysicalOrderV1[],
  mulligan: boolean,
  targetPlayers: ReadonlySet<CorePlayerId> | null = null,
): CorePregameSetupResultV1 {
  const registry = objectRegistry(root);
  const orderByPlayer = new Map(orders.map((entry) => [entry.playerId, entry.order]));
  const expectedPlayers = targetPlayers ?? new Set(registry.turnOrder);
  if (orderByPlayer.size !== expectedPlayers.size || [...expectedPlayers].some((playerId) => !orderByPlayer.has(playerId))) failure('INVALID_INPUT', '/orders', 'One order is required for each target player');
  const zones = cloneZones(registry);
  const objects: RawRecord = { ...registry.objects };
  const runtimeEntries: RawRecord = { ...runtime(root).byObject };
  const changed: CoreObjectId[] = [];
  const playerUpdates: Record<CorePlayerId, CorePlayerStateV1> = Object.create(null) as Record<CorePlayerId, CorePlayerStateV1>;
  for (const playerId of registry.turnOrder) {
    if (!expectedPlayers.has(playerId)) continue;
    const currentZones = zones.byPlayer[playerId];
    const currentLibrary = [...currentZones.library];
    const currentHand = mulligan ? [...currentZones.hand] : [];
    const expectedPhysical = currentLibrary.map((objectId) => physicalOf(registry, objectId));
    if (mulligan) expectedPhysical.push(...currentHand.map((objectId) => physicalOf(registry, objectId)));
    if (expectedPhysical.length < 7) failure('LIBRARY_INSUFFICIENT', `/orders/${playerId}`, 'Pregame opening hand requires at least seven eligible cards');
    const order = orderByPlayer.get(playerId);
    if (order === undefined) failure('INVALID_INPUT', '/orders', 'Missing player order');
    validPermutation(order, expectedPhysical, `/orders/${playerId}`);
    const byPhysical = new Map<CorePhysicalCardId, CoreObjectId>();
    for (const oldObjectId of [...currentLibrary, ...currentHand]) {
      const physicalCardId = physicalOf(registry, oldObjectId);
      byPhysical.set(physicalCardId, oldObjectId);
    }
    const currentObjects: CoreObjectId[] = [];
    for (const oldObjectId of currentLibrary) currentObjects.push(oldObjectId);
    if (mulligan) {
      for (const oldObjectId of currentHand) {
        const nextObjectId = nextCard(registry, objects, runtimeEntries, oldObjectId);
        changed.push(oldObjectId, nextObjectId);
        currentObjects.splice(currentObjects.indexOf(oldObjectId), 1);
        currentObjects.push(nextObjectId);
        byPhysical.set(physicalOf(registry, oldObjectId), nextObjectId);
      }
    }
    const orderedLibrary: CoreObjectId[] = [];
    for (const physicalCardId of order) {
      const objectId = byPhysical.get(physicalCardId);
      if (objectId === undefined) failure('INVALID_PERMUTATION', `/orders/${playerId}`, 'Order card is not present');
      orderedLibrary.push(objectId);
    }
    currentZones.library = orderedLibrary;
    currentZones.hand = [];
    const openingCount = 7;
    for (let index = 0; index < openingCount; index += 1) {
      const oldObjectId = currentZones.library.shift();
      if (oldObjectId === undefined) failure('LIBRARY_INSUFFICIENT', `/orders/${playerId}`, 'Library has fewer than seven cards');
      const nextObjectId = nextCard(registry, objects, runtimeEntries, oldObjectId);
      changed.push(oldObjectId, nextObjectId);
      currentZones.hand.push(nextObjectId);
    }
    if (mulligan) playerUpdates[playerId] = playerStateWithMulliganCount(registry.players[playerId]);
  }
  const nextRegistry = createModeNeutralCoreObjectRegistryStateV2({
    players: withPlayers(registry, playerUpdates),
    turnOrder: registry.turnOrder,
    activePlayerId: registry.activePlayerId,
    cardDefinitions: registry.cardDefinitions,
    physicalCards: registry.physicalCards,
    objects: objects as never,
    zones: zones,
  });
  const nextRuntime = createModeNeutralCoreObjectRuntimeStateV2(nextRegistry, { byObject: runtimeEntries as never });
  return Object.freeze({ root: rebuildRoot(root, nextRegistry, nextRuntime), changedObjectIds: Object.freeze(changed) });
}

export function rotateCorePregameTurnOrderV1(
  root: ModeNeutralCoreRootV1,
  startingPlayerId: CorePlayerId,
): ModeNeutralCoreRootV1 {
  const registry = objectRegistry(root);
  const index = registry.turnOrder.indexOf(startingPlayerId);
  if (index < 0) throw new Error('Starting player is not seated');
  const turnOrder = [...registry.turnOrder.slice(index), ...registry.turnOrder.slice(0, index)];
  const players = Object.fromEntries(turnOrder.map((playerId) => [playerId, registry.players[playerId]])) as ModeNeutralCoreObjectRegistrySliceV2['players'];
  const nextRegistry = createModeNeutralCoreObjectRegistryStateV2({
    players,
    turnOrder,
    activePlayerId: startingPlayerId,
    cardDefinitions: registry.cardDefinitions,
    physicalCards: registry.physicalCards,
    objects: registry.objects,
    zones: registry.zones,
  });
  const currentLifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle;
  const lifecycle = currentLifecycle.window.kind === 'turn-based-action-required'
    && currentLifecycle.window.action === 'untap-step-actions'
    ? { ...currentLifecycle, window: { kind: 'turn-based-action-required' as const, action: 'untap-step-actions' as const, playerId: startingPlayerId } }
    : currentLifecycle;
  return rebuildRoot(root, nextRegistry, runtime(root), lifecycle);
}

export function dealCorePregameOpeningHandsV1(
  root: ModeNeutralCoreRootV1,
  orders: readonly CorePregamePlayerPhysicalOrderV1[],
): CorePregameOperationResultV1 {
  try { return { ok: true, value: applyOrdersAndDeal(root, orders, false).root }; }
  catch (error: unknown) { return { ok: false, issues: [issue('INVALID_SETUP', '', error instanceof Error ? error.message : 'Invalid opening deal')] }; }
}

export function applyCorePregameMulliganWaveV1(
  root: ModeNeutralCoreRootV1,
  inputs: readonly CorePregameMulliganInputV1[],
): CorePregameOperationResultV1 {
  try {
    if (inputs.length === 0) failure('INVALID_INPUT', '/inputs', 'At least one mulligan input is required');
    const inputPlayers = new Set<CorePlayerId>();
    for (const input of inputs) {
      if (inputPlayers.has(input.playerId)) failure('INVALID_INPUT', '/inputs', 'Mulligan input players must be distinct');
      if (input.order.length === 0) failure('INVALID_INPUT', '/inputs', 'Mulligan order must be nonempty');
      inputPlayers.add(input.playerId);
    }
    const orders: readonly CorePregamePlayerPhysicalOrderV1[] = inputs.map((input) => ({ playerId: input.playerId, order: input.order }));
    return { ok: true, value: applyOrdersAndDeal(root, orders, true, inputPlayers).root };
  } catch (error: unknown) { return { ok: false, issues: [issue('INVALID_SETUP', '', error instanceof Error ? error.message : 'Invalid mulligan wave')] }; }
}

export function commitCorePregameBottomBatchV1(
  root: ModeNeutralCoreRootV1,
  batch: CorePregameBottomBatchV1,
): CorePregameOperationResultV1 {
  try {
    const registry = objectRegistry(root);
    const byPlayer = new Map(batch.map((entry) => [entry.playerId, entry.objectIds]));
    if (byPlayer.size !== batch.length || batch.some((entry) => !registry.turnOrder.includes(entry.playerId))) failure('INVALID_INPUT', '/batch', 'Bottom batch contains an invalid player');
    const zones = cloneZones(registry);
    const objects: RawRecord = { ...registry.objects };
    const runtimeEntries: RawRecord = { ...runtime(root).byObject };
    const changed: CoreObjectId[] = [];
    for (const entry of batch) {
      const hand = zones.byPlayer[entry.playerId].hand;
      const seen = new Set<CoreObjectId>();
      for (const objectId of entry.objectIds) {
        if (seen.has(objectId) || !hand.includes(objectId)) failure('INVALID_BOTTOM', `/batch/${entry.playerId}`, 'Bottom objects must be distinct cards in the current hand');
        seen.add(objectId);
      }
      for (const oldObjectId of entry.objectIds) {
        const index = hand.indexOf(oldObjectId);
        hand.splice(index, 1);
        const nextObjectId = nextCard(registry, objects, runtimeEntries, oldObjectId);
        changed.push(oldObjectId, nextObjectId);
        zones.byPlayer[entry.playerId].library.push(nextObjectId);
      }
    }
    const nextRegistry = createModeNeutralCoreObjectRegistryStateV2({
      players: registry.players,
      turnOrder: registry.turnOrder,
      activePlayerId: registry.activePlayerId,
      cardDefinitions: registry.cardDefinitions,
      physicalCards: registry.physicalCards,
      objects: objects as never,
      zones: zones,
    });
    const nextRuntime = createModeNeutralCoreObjectRuntimeStateV2(nextRegistry, { byObject: runtimeEntries as never });
    return { ok: true, value: rebuildRoot(root, nextRegistry, nextRuntime) };
  } catch (error: unknown) { return { ok: false, issues: [issue('INVALID_SETUP', '', error instanceof Error ? error.message : 'Invalid bottom batch')] }; }
}

export const setCorePregameStartingPlayerV1 = rotateCorePregameTurnOrderV1;
export const dealCorePregameOpeningHandV1 = dealCorePregameOpeningHandsV1;
export const applyCorePregameMulliganV1 = applyCorePregameMulliganWaveV1;
export const commitCorePregameBottomChoicesV1 = commitCorePregameBottomBatchV1;
