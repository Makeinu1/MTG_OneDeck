#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Compatibility from '../../src/engine/compatibility';
import { applyCommand } from '../../src/engine/commands';
import * as Core from '../../src/engine/core';
import { makeDef } from '../../src/engine/__tests__/helpers';
import { initGame, type InitDeckCard } from '../../src/engine/init';
import {
  DEFAULT_OPPONENT_ID,
  DEFAULT_OPPONENT_LIFE_LABEL,
  type GameState,
  type PlayerId,
} from '../../src/engine/types';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../src/data/gameSnapshot';

type RecordValue = Record<string, unknown>;

const repositoryRoot = resolve(new URL('../..', import.meta.url).pathname);
const fixturePath = resolve(
  repositoryRoot,
  'src/engine/compatibility/fixtures/o4p-02a-solo-core-compatibility-v1.json',
);
const turnFixturePath = resolve(
  repositoryRoot,
  'src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json',
);

const corePlayers = ['P1', 'P2', 'P3', 'P4'] as const;
const soloPlayers = ['P1', DEFAULT_OPPONENT_ID, 'opponent:B', 'opponent:C'] as const;
const soloPlayerByCore = new Map<string, PlayerId>(
  corePlayers.map((playerId, index) => [playerId, soloPlayers[index]]),
);

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record`);
  }
  return value as RecordValue;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined || !('value' in descriptor) || deepFrozen(descriptor.value, seen);
  });
}

function makeCoreRoot(): Core.ModeNeutralCoreRootV1 {
  const fixture = record(JSON.parse(readFileSync(turnFixturePath, 'utf8')) as unknown, 'turn fixture');
  const turnBundle = record(fixture.bundle, 'turn bundle') as unknown as Parameters<typeof Core.createCoreTurnPriorityBundleV1>[0];
  const source = Core.createCoreTurnPriorityBundleV1(turnBundle);
  const baseRegistry = source.stackBundle.objectRegistry;
  const pc1 = 'PC1' as Core.CorePhysicalCardId;
  const pc7 = 'PC7' as Core.CorePhysicalCardId;
  const o1 = 'PC1:0' as Core.CoreObjectId;
  const o7 = 'PC7:0' as Core.CoreObjectId;
  const p1 = 'P1' as Core.CorePlayerId;
  const p3 = 'P3' as Core.CorePlayerId;
  const pc6ObjectId = 'PC6:0' as Core.CoreObjectId;
  const p1Zones = baseRegistry.zones.byPlayer[p1];
  assert.ok(p1Zones);
  const cardObjects = Object.fromEntries(
    Object.entries(baseRegistry.objects).filter(([, object]) => object.kind === 'card'),
  ) as Record<Core.CoreObjectId, Extract<Core.CoreGameObjectIdentityV2, { readonly kind: 'card' }>>;
  cardObjects[o7] = Core.createCoreCardObjectIdentityV2({
    kind: 'card',
    physicalCardId: pc7,
    incarnation: 0,
    baseControllerPlayerId: null,
  });
  const objectRegistry = Core.createModeNeutralCoreObjectRegistryStateV2({
    players: baseRegistry.players,
    turnOrder: baseRegistry.turnOrder,
    activePlayerId: baseRegistry.activePlayerId,
    cardDefinitions: baseRegistry.cardDefinitions,
    physicalCards: {
      ...baseRegistry.physicalCards,
      [pc7]: { ...baseRegistry.physicalCards[pc1] },
    },
    objects: cardObjects,
    zones: {
      byPlayer: {
        ...baseRegistry.zones.byPlayer,
        [p1]: {
          ...p1Zones,
          library: [...p1Zones.library, o7],
        },
      },
      shared: {
        ...baseRegistry.zones.shared,
        stack: baseRegistry.zones.shared.stack.filter((objectId) => objectId === 'PC5:1'),
      },
    },
  });
  const objectRuntime = Core.createModeNeutralCoreObjectRuntimeStateV2(objectRegistry, {
    byObject: {
      ...Object.fromEntries(
        Object.entries(source.stackBundle.objectRuntime.byObject)
          .filter(([objectId]) => Object.prototype.hasOwnProperty.call(cardObjects, objectId)),
      ),
      [o7]: source.stackBundle.objectRuntime.byObject[o1],
    },
  });
  const cardAnnouncement = source.stackBundle.stackAnnouncements.byObject['PC5:1' as Core.CoreObjectId];
  assert.ok(cardAnnouncement);
  const stackAnnouncements = Core.createModeNeutralCoreStackAnnouncementSliceV1(objectRegistry, {
    byObject: { 'PC5:1': cardAnnouncement },
  });
  const stackBundle = Core.createCoreStackTransactionBundleV1({
    objectRegistry,
    objectRuntime,
    stackAnnouncements,
  });
  const pendingTriggers = Core.createModeNeutralCorePendingTriggerSliceV1(objectRegistry, {
    pendingObjectIds: [],
    byObject: {},
  });
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
    stackBundle,
    pendingTriggers,
    lifecycle: source.lifecycle,
  });
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle,
    control: Core.createModeNeutralCoreControlSliceV1({
      effectOrder: [],
      byEffect: {},
      continuityByObject: {
        [pc6ObjectId]: {
          controllerPlayerId: p3,
          continuousSinceMostRecentTurnBegan: false,
        },
      },
    }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({
      authorityOrder: [],
      byAuthority: {},
    }),
  });
  const commanderInputs = [
    ['PC1', 'P1'],
    ['PC3', 'P2'],
    ['PC6', 'P3'],
    ['PC5', 'P4'],
  ] as const;
  const commanders = commanderInputs.map(([physicalCardId, ownerPlayerId]) => (
    Core.createCoreCommanderIdentityV1({ physicalCardId, ownerPlayerId })
  ));
  return Core.createModeNeutralCoreRootV1({
    versions: Core.CORE_CLOSURE_VERSION_VECTOR_V1,
    acceptedCommandCount: 0,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({
      players: corePlayers.map((playerId) => ({ playerId, status: 'active', exitCause: null })),
    }),
    commanders,
    commanderCastLedgers: commanders.map((commander) => (
      Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 })
    )),
    commanderDamage: Core.createCoreCommanderDamageStateV1({
      commanders,
      defendingPlayerIds: corePlayers,
      entries: [],
    }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({
      commanders,
      defendingPlayerIds: corePlayers,
      records: [],
    }),
    combatContext: null,
  });
}

function makeSoloAndMap(root: Core.ModeNeutralCoreRootV1): Readonly<{
  readonly state: GameState;
  readonly map: Compatibility.SoloCoreIdentityMapV1;
}> {
  const registry = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const cardObjects = Object.entries(registry.objects)
    .filter((entry): entry is [string, Extract<Core.CoreGameObjectIdentityV2, { readonly kind: 'card' }>] => (
      entry[1].kind === 'card'
    ));
  const deck: InitDeckCard[] = cardObjects.map(([objectId]) => ({
    def: makeDef({ scryfallId: `compat-${objectId}`, typeLine: 'Creature' }),
    isCommander: false,
  }));
  const skeleton = initGame(deck, 17);
  const templates = Object.values(skeleton.cards);
  assert.equal(templates.length, cardObjects.length);

  const soloPhysicalByCore = new Map<string, string>();
  const soloObjectByCore = new Map<string, string>();
  const coreObjectBySoloPhysical = new Map<string, string>();
  const cards: GameState['cards'] = {};
  const zoneByCoreObject = new Map<string, GameState['cards'][string]['zone']>();
  for (const playerId of registry.turnOrder) {
    const privateZones = registry.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      for (const objectId of privateZones[zone]) zoneByCoreObject.set(objectId, zone);
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    for (const objectId of registry.zones.shared[zone]) zoneByCoreObject.set(objectId, zone);
  }

  for (const [[coreObjectId, object], template] of cardObjects.map((entry, index) => [entry, templates[index]] as const)) {
    const soloPhysicalCardId = `solo-${object.physicalCardId}`;
    const coreOwner = registry.physicalCards[object.physicalCardId].ownerPlayerId;
    const soloOwner = soloPlayerByCore.get(coreOwner);
    const soloController = soloPlayerByCore.get(object.baseControllerPlayerId ?? coreOwner);
    assert.ok(soloOwner);
    assert.ok(soloController);
    soloPhysicalByCore.set(object.physicalCardId, soloPhysicalCardId);
    soloObjectByCore.set(coreObjectId, `${soloPhysicalCardId}:${object.incarnation}`);
    coreObjectBySoloPhysical.set(soloPhysicalCardId, coreObjectId);
    cards[soloPhysicalCardId] = {
      ...template,
      id: soloPhysicalCardId,
      zone: zoneByCoreObject.get(coreObjectId) ?? 'library',
      ownerId: soloOwner,
      controllerId: soloController,
      zoneChangeCounter: object.incarnation,
      isCommander: root.commanders.some((commander) => (
        commander.physicalCardId === object.physicalCardId
      )),
    };
  }

  const soloCardId = (coreObjectId: string): string => {
    const object = registry.objects[coreObjectId as Core.CoreObjectId];
    assert.equal(object?.kind, 'card');
    const mapped = object && object.kind === 'card'
      ? soloPhysicalByCore.get(object.physicalCardId)
      : undefined;
    assert.ok(mapped);
    return mapped;
  };
  const zonesByPlayer: GameState['zonesByPlayer'] = {};
  for (const corePlayerId of registry.turnOrder) {
    const playerId = soloPlayerByCore.get(corePlayerId);
    assert.ok(playerId);
    const source = registry.zones.byPlayer[corePlayerId];
    zonesByPlayer[playerId] = {
      library: source.library.map(soloCardId),
      hand: source.hand.map(soloCardId),
      graveyard: source.graveyard.map(soloCardId),
    };
  }

  const p1Zones = zonesByPlayer.P1;
  assert.ok(p1Zones);
  const localPlayer = skeleton.players.P1;
  const opponentPlayer = skeleton.players[DEFAULT_OPPONENT_ID];
  assert.ok(localPlayer);
  assert.ok(opponentPlayer);
  const state: GameState = {
    ...skeleton,
    cards,
    zones: {
      library: [...p1Zones.library],
      hand: [...p1Zones.hand],
      graveyard: [...p1Zones.graveyard],
      battlefield: registry.zones.shared.battlefield.map(soloCardId),
      stack: registry.zones.shared.stack.map(soloCardId),
      exile: registry.zones.shared.exile.map(soloCardId),
      command: registry.zones.shared.command.map(soloCardId),
    },
    zonesByPlayer,
    players: {
      P1: { ...localPlayer, id: 'P1' },
      [DEFAULT_OPPONENT_ID]: { ...opponentPlayer, id: DEFAULT_OPPONENT_ID },
      'opponent:B': { ...opponentPlayer, id: 'opponent:B', label: 'B' },
      'opponent:C': { ...opponentPlayer, id: 'opponent:C', label: 'C' },
    },
    commanders: root.commanders.map((commander, index) => {
      const cardId = soloPhysicalByCore.get(commander.physicalCardId);
      assert.ok(cardId);
      return { cardId, castCount: root.commanderCastLedgers[index].castCount };
    }),
    activePlayerId: soloPlayerByCore.get(registry.activePlayerId) ?? 'missing',
    turnOrder: registry.turnOrder.map((playerId) => soloPlayerByCore.get(playerId) ?? 'missing'),
    localPlayerId: 'P1',
    turn: root.ruleAuthority.turnPriorityBundle.lifecycle.turnNumber,
    phase: 'upkeep',
    combat: null,
    opponentLife: {
      [DEFAULT_OPPONENT_LIFE_LABEL]: 40,
      B: 40,
      C: 40,
    },
  };
  const map = Compatibility.createSoloCoreIdentityMapV1({
    players: registry.turnOrder.map((corePlayerId) => ({
      soloPlayerId: soloPlayerByCore.get(corePlayerId),
      corePlayerId,
    })),
    physicalCards: Object.keys(registry.physicalCards).map((corePhysicalCardId) => ({
      soloPhysicalCardId: soloPhysicalByCore.get(corePhysicalCardId),
      corePhysicalCardId,
    })),
    objects: Object.keys(registry.objects).map((coreObjectId) => {
      const object = registry.objects[coreObjectId as Core.CoreObjectId];
      const soloPhysical = object.kind === 'card'
        ? soloPhysicalByCore.get(object.physicalCardId)
        : undefined;
      assert.ok(soloPhysical);
      assert.equal(coreObjectBySoloPhysical.get(soloPhysical), coreObjectId);
      return { soloObjectId: soloObjectByCore.get(coreObjectId), coreObjectId };
    }),
  });
  return Object.freeze({ state, map });
}

const fixture = record(JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown, 'compatibility fixture');
assert.equal(fixture.version, 'solo-core-compatibility-v1');
assert.equal(fixture.schemaVersion, 1);
assert.equal(Array.isArray(fixture.concerns) ? fixture.concerns.length : 0, 20);
assert.equal(Compatibility.SOLO_CORE_COMPATIBILITY_SCHEMA_VERSION_V1, 1);
assert.equal(Compatibility.SOLO_CORE_COMPATIBILITY_CATALOG_V1.length, 20);
assert.deepEqual(
  Compatibility.SOLO_CORE_COMPATIBILITY_CATALOG_V1.map(({ concern, classification }) => ({
    concern,
    classification,
  })),
  fixture.concerns,
);

const initialRoot = makeCoreRoot();
const { state: initialSolo, map } = makeSoloAndMap(initialRoot);
const initialSoloView = Compatibility.projectSoloCompatibilityViewV1(initialSolo, map);
const initialCoreView = Compatibility.projectCoreCompatibilityViewV1(initialRoot, map);
assert.equal(initialSoloView.kind, 'projected');
assert.equal(initialCoreView.kind, 'projected');
assert.ok(initialSoloView.kind === 'projected' && initialCoreView.kind === 'projected');
assert.equal(
  Compatibility.compareSoloCoreCompatibilityV1(initialSoloView.view, initialCoreView.view).kind,
  'compatible',
);

const p1 = 'P1' as Core.CorePlayerId;
const coreLibraryBefore = initialRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry
  .zones.byPlayer[p1].library;
const coreLibraryAfter = [...coreLibraryBefore].reverse();
const soloLibraryBefore = initialSolo.zonesByPlayer.P1.library;
const soloLibraryAfter = [...soloLibraryBefore].reverse();
const soloResult = applyCommand(initialSolo, {
  type: 'shuffle',
  playerId: 'P1',
  order: soloLibraryAfter,
});
const coreCommand = Core.createCoreCommandV1({
  schemaVersion: 1,
  sequence: 1,
  actorPlayerId: p1,
  decisionMakerPlayerId: p1,
  decisionContext: { kind: 'decision', decisionKey: 'o4p-02a-differential-shuffle' },
  payload: {
    kind: 'random-zone-order',
    randomDecisionId: 'o4p-02a-recorded-shuffle',
    zone: { kind: 'player-zone', playerId: p1, zone: 'library' },
    beforeOrder: coreLibraryBefore,
    afterOrder: coreLibraryAfter,
  },
});
const coreResult = Core.applyCoreCommandV1(initialRoot, coreCommand);
assert.notEqual(coreResult.status, 'rejected');
assert.ok(coreResult.status !== 'rejected');
const soloAfterView = Compatibility.projectSoloCompatibilityViewV1(soloResult.state, map);
const coreAfterView = Compatibility.projectCoreCompatibilityViewV1(coreResult.root, map);
assert.equal(soloAfterView.kind, 'projected');
assert.equal(coreAfterView.kind, 'projected');
assert.ok(soloAfterView.kind === 'projected' && coreAfterView.kind === 'projected');
const parity = Compatibility.compareSoloCoreCompatibilityV1(soloAfterView.view, coreAfterView.view);
assert.equal(parity.kind, 'compatible');
assert.equal(deepFrozen(parity), true);
assert.deepEqual(soloResult.state.zonesByPlayer.P1.library, soloLibraryAfter);
assert.deepEqual(
  coreResult.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[p1].library,
  coreLibraryAfter,
);

const snapshot: GameSnapshot = {
  version: SNAPSHOT_VERSION,
  state: initialSolo,
  deck: [],
  autoAdvanceToMain: false,
};
assert.equal(SNAPSHOT_VERSION, 1);
assert.deepEqual(Object.keys(snapshot), ['version', 'state', 'deck', 'autoAdvanceToMain']);
assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'coreRoot'), false);

console.log(
  'fixture=solo-core-compatibility-v1 concerns=20 distinct-identities=true '
  + 'initial-parity=compatible differential=recorded-shuffle-compatible '
  + 'snapshot-version=1 offline=true immutable=true',
);
