import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Core from '../../core';
import {
  SOLO_CORE_COMPATIBILITY_CATALOG_V1,
  createSoloCoreIdentityMapV1,
  projectCoreCompatibilityViewV1,
  projectSoloCompatibilityViewV1,
  soloCoreCompatibilityEntryForV1,
} from '../soloCoreCompatibilityV1';
import { compareSoloCoreCompatibilityV1 } from '../soloCoreParityV1';
import type { SoloCoreComparableViewV1 } from '../soloCoreCompatibilityV1';

const baseView: SoloCoreComparableViewV1 = Object.freeze({
  kind: 'solo-core-comparable-view-v1',
  schemaVersion: 1,
  activePlayerId: 'P1' as never,
  turnNumber: 4,
  turnPosition: Object.freeze({ phase: 'beginning', step: 'upkeep' }),
  orderedZones: Object.freeze([
    Object.freeze({ playerId: 'P1' as never, zone: 'library', objectIds: Object.freeze(['PC1:0'] as never[]) }),
    Object.freeze({ playerId: null, zone: 'battlefield', objectIds: Object.freeze([] as never[]) }),
  ]),
  commanders: Object.freeze([{ physicalCardId: 'PC1' as never, ownerPlayerId: 'P1' as never, castCount: 0 }]),
  combat: null,
});

function cloneView(): SoloCoreComparableViewV1 {
  return {
    ...baseView,
    turnPosition: { ...baseView.turnPosition },
    orderedZones: baseView.orderedZones.map((zone) => ({ ...zone, objectIds: [...zone.objectIds] })),
    commanders: baseView.commanders.map((commander) => ({ ...commander })),
    combat: null,
  };
}

function isDeeplyFrozen(input: unknown, seen = new WeakSet<object>()): boolean {
  if (input === null || typeof input !== 'object') return true;
  if (seen.has(input)) return true;
  seen.add(input);
  if (!Object.isFrozen(input)) return false;
  return Reflect.ownKeys(input).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor === undefined || !('value' in descriptor) || isDeeplyFrozen(descriptor.value, seen);
  });
}

function fourPlayerPair(): Readonly<{
  readonly solo: unknown;
  readonly root: Core.ModeNeutralCoreRootV1;
  readonly map: ReturnType<typeof createSoloCoreIdentityMapV1>;
}> {
  const fixture = JSON.parse(readFileSync(new URL('../../core/turn/fixtures/turn-priority-lifecycle-v1.json', import.meta.url), 'utf8')) as { bundle: unknown };
  const source = Core.createCoreTurnPriorityBundleV1(fixture.bundle as never);
  const baseRegistry = source.stackBundle.objectRegistry;
  type CoreCardObject = Extract<Core.CoreGameObjectIdentityV2, { readonly kind: 'card' }>;
  const cardObjects = Object.fromEntries(Object.entries(baseRegistry.objects).filter(([objectId, object]) => !objectId.startsWith('@') && object.kind === 'card')) as Record<string, CoreCardObject>;
  const objectRegistry = Core.createModeNeutralCoreObjectRegistryStateV2({
    players: baseRegistry.players,
    turnOrder: baseRegistry.turnOrder,
    activePlayerId: baseRegistry.activePlayerId,
    cardDefinitions: baseRegistry.cardDefinitions,
    physicalCards: baseRegistry.physicalCards,
    objects: cardObjects,
    zones: {
      byPlayer: baseRegistry.zones.byPlayer,
      shared: { ...baseRegistry.zones.shared, stack: ['PC5:1' as Core.CoreObjectId] },
    },
  });
  const objectRuntime = Core.createModeNeutralCoreObjectRuntimeStateV2(objectRegistry, {
    byObject: Object.fromEntries(Object.entries(source.stackBundle.objectRuntime.byObject).filter(([objectId]) => objectId in cardObjects)),
  });
  const announcementRecord: Record<string, unknown> = { 'PC5:1': Object.entries(source.stackBundle.stackAnnouncements.byObject).find(([objectId]) => objectId === 'PC5:1')?.[1] };
  const stackAnnouncements = Core.createModeNeutralCoreStackAnnouncementSliceV1(objectRegistry, { byObject: announcementRecord });
  const stackBundle = Core.createCoreStackTransactionBundleV1({ objectRegistry, objectRuntime, stackAnnouncements });
  const pendingTriggers = Core.createModeNeutralCorePendingTriggerSliceV1(objectRegistry, { pendingObjectIds: [], byObject: {} });
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({ stackBundle, pendingTriggers, lifecycle: source.lifecycle });
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle,
    control: Core.createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: { 'PC6:0': { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false } } as never }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
  });
  const physicalRecords = baseRegistry.physicalCards as unknown as Record<string, { readonly ownerPlayerId: Core.CorePlayerId }>;
  const commanderPhysicalIds = ['PC1', 'PC3', 'PC6', 'PC5'] as const;
  const commanders = commanderPhysicalIds.map((physicalCardId) => Core.createCoreCommanderIdentityV1({ physicalCardId, ownerPlayerId: physicalRecords[physicalCardId].ownerPlayerId }));
  const root = Core.createModeNeutralCoreRootV1({
    versions: Core.CORE_CLOSURE_VERSION_VECTOR_V1,
    acceptedCommandCount: 0,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({ players: baseRegistry.turnOrder.map((playerId) => ({ playerId, status: 'active', exitCause: null })) }),
    commanders,
    commanderCastLedgers: commanders.map((commander) => Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 })),
    commanderDamage: Core.createCoreCommanderDamageStateV1({ commanders, defendingPlayerIds: baseRegistry.turnOrder, entries: [] }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({ commanders, defendingPlayerIds: baseRegistry.turnOrder, records: [] }),
    combatContext: null,
  });
  const soloPlayerNames = ['solo-a', 'solo-b', 'solo-c', 'solo-d'] as const;
  const soloPlayerByCore = new Map(baseRegistry.turnOrder.map((corePlayerId, index) => [corePlayerId, soloPlayerNames[index]]));
  const soloPhysicalByCore = new Map(Object.keys(baseRegistry.physicalCards).map((corePhysicalCardId, index) => [corePhysicalCardId, `solo-card-${index + 1}`]));
  const soloObjectByCore = new Map(Object.entries(cardObjects).map(([coreObjectId, object]) => [
    coreObjectId,
    `${soloPhysicalByCore.get(object.physicalCardId)}:${object.incarnation}`,
  ]));
  const coreObjectToCard = new Map<string, string>();
  const zoneByObject = new Map<string, string>();
  for (const playerId of objectRegistry.turnOrder) {
    const current = objectRegistry.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) for (const objectId of current[zone]) zoneByObject.set(objectId, zone);
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) for (const objectId of objectRegistry.zones.shared[zone]) zoneByObject.set(objectId, zone);
  const cards: Record<string, unknown> = {};
  for (const [objectId, object] of Object.entries(cardObjects)) {
    const cardId = soloPhysicalByCore.get(object.physicalCardId);
    if (cardId === undefined) throw new Error('Missing Solo physical-card mapping');
    coreObjectToCard.set(objectId, cardId);
    const zone = zoneByObject.get(objectId) ?? 'library';
    const coreOwner = physicalRecords[object.physicalCardId].ownerPlayerId;
    const owner = soloPlayerByCore.get(coreOwner);
    const controller = soloPlayerByCore.get(object.baseControllerPlayerId ?? coreOwner);
    if (owner === undefined || controller === undefined) throw new Error('Missing Solo player mapping');
    cards[cardId] = { id: cardId, zone, ownerId: owner, controllerId: controller, zoneChangeCounter: object.incarnation };
  }
  const byPlayer: Record<string, Readonly<{ readonly library: readonly (string | undefined)[]; readonly hand: readonly (string | undefined)[]; readonly graveyard: readonly (string | undefined)[] }>> = {};
  for (const playerId of baseRegistry.turnOrder) {
    const current = objectRegistry.zones.byPlayer[playerId];
    const soloPlayerId = soloPlayerByCore.get(playerId);
    if (soloPlayerId === undefined) throw new Error('Missing Solo player mapping');
    byPlayer[soloPlayerId] = {
      library: current.library.map((objectId) => coreObjectToCard.get(objectId)),
      hand: current.hand.map((objectId) => coreObjectToCard.get(objectId)),
      graveyard: current.graveyard.map((objectId) => coreObjectToCard.get(objectId)),
    };
  }
  const solo = {
    cards,
    zones: Object.fromEntries((['library', 'hand', 'graveyard'] as const).map((zone) => [zone, []])),
    zonesByPlayer: byPlayer,
    turnOrder: baseRegistry.turnOrder.map((playerId) => soloPlayerByCore.get(playerId)),
    activePlayerId: soloPlayerByCore.get(baseRegistry.activePlayerId),
    turn: source.lifecycle.turnNumber,
    phase: 'upkeep',
    combat: null,
    commanders: commanderPhysicalIds.map((physicalCardId) => ({ cardId: soloPhysicalByCore.get(physicalCardId), castCount: 0 })),
  } as Record<string, unknown>;
  solo.zones = {
    library: objectRegistry.zones.byPlayer[baseRegistry.turnOrder[0]].library.map((objectId: string) => coreObjectToCard.get(objectId)),
    hand: objectRegistry.zones.byPlayer[baseRegistry.turnOrder[0]].hand.map((objectId: string) => coreObjectToCard.get(objectId)),
    graveyard: [],
    battlefield: objectRegistry.zones.shared.battlefield.map((objectId) => coreObjectToCard.get(objectId)),
    stack: objectRegistry.zones.shared.stack.map((objectId) => coreObjectToCard.get(objectId)),
    exile: objectRegistry.zones.shared.exile.map((objectId) => coreObjectToCard.get(objectId)),
    command: objectRegistry.zones.shared.command.map((objectId) => coreObjectToCard.get(objectId)),
  };
  const map = createSoloCoreIdentityMapV1({
    players: baseRegistry.turnOrder.map((corePlayerId) => ({ soloPlayerId: soloPlayerByCore.get(corePlayerId), corePlayerId })),
    physicalCards: Object.keys(baseRegistry.physicalCards).map((corePhysicalCardId) => ({ soloPhysicalCardId: soloPhysicalByCore.get(corePhysicalCardId), corePhysicalCardId })),
    objects: Object.keys(cardObjects).map((coreObjectId) => ({ soloObjectId: soloObjectByCore.get(coreObjectId), coreObjectId })),
  });
  return { solo, root, map };
}

describe('soloCoreParityV1 differential comparator', () => {
  it('imports Core APIs only through the public barrel', () => {
    const source = readFileSync(new URL('../soloCoreCompatibilityV1.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/from ['"]\.\.\/core['"]/u);
    expect(source).not.toMatch(/from ['"]\.\.\/core\//u);
  });

  it('projects a four-player pair with distinct Solo/Core player, physical-card, and object IDs', () => {
    const pair = fourPlayerPair();
    expect(pair.map.players.every((entry) => entry.soloPlayerId !== entry.corePlayerId)).toBe(true);
    expect(pair.map.physicalCards.every((entry) => entry.soloPhysicalCardId !== entry.corePhysicalCardId)).toBe(true);
    expect(pair.map.objects.every((entry) => entry.soloObjectId !== entry.coreObjectId)).toBe(true);
    const soloProjection = projectSoloCompatibilityViewV1(pair.solo, pair.map);
    const coreProjection = projectCoreCompatibilityViewV1(pair.root, pair.map);
    expect(soloProjection.kind).toBe('projected');
    expect(coreProjection.kind).toBe('projected');
    if (soloProjection.kind === 'projected' && coreProjection.kind === 'projected') {
      expect(soloProjection.view.activePlayerId).toBe(pair.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId);
      expect(coreProjection.view.activePlayerId).toBe(pair.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId);
      expect(coreProjection.view.commanders.map((commander) => commander.ownerPlayerId)).toEqual(pair.root.commanders.map((commander) => commander.ownerPlayerId));
      expect(soloProjection.view.commanders.map((commander) => commander.physicalCardId)).toEqual(pair.root.commanders.map((commander) => commander.physicalCardId));
      expect(compareSoloCoreCompatibilityV1(soloProjection.view, coreProjection.view).kind).toBe('compatible');
    }
  });

  it('rejects a Core combat object omitted from the identity map', () => {
    const pair = fourPlayerPair();
    const identityMap = pair.map;
    const registry = pair.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    const attackerObjectId = registry.zones.shared.battlefield[0];
    expect(attackerObjectId).toBeDefined();
    const combatContext = Core.createCoreCombatContextV1({
      combatId: 'compatibility-map-guard',
      turnNumber: pair.root.ruleAuthority.turnPriorityBundle.lifecycle.turnNumber,
      step: 'declare-attackers',
      attackingPlayerId: 'P1',
      defendingPlayerIds: ['P2'],
      attacks: [{
        attackerObjectId,
        attackerControllerPlayerId: 'P1',
        defendingPlayerId: 'P2',
      }],
      blocks: [],
    });
    const root = Core.createModeNeutralCoreRootV1({
      versions: pair.root.versions,
      acceptedCommandCount: pair.root.acceptedCommandCount,
      ruleAuthority: pair.root.ruleAuthority,
      playerLifecycle: pair.root.playerLifecycle,
      commanders: pair.root.commanders,
      commanderCastLedgers: pair.root.commanderCastLedgers,
      commanderDamage: pair.root.commanderDamage,
      commanderDamageProvenance: pair.root.commanderDamageProvenance,
      combatContext,
    });
    const missingCombatObjectMap = createSoloCoreIdentityMapV1({
      players: identityMap.players,
      physicalCards: identityMap.physicalCards,
      objects: identityMap.objects.filter((entry) => entry.coreObjectId !== attackerObjectId),
    });
    const result = projectCoreCompatibilityViewV1(root, missingCombatObjectMap);
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'UNMAPPED_OBJECT',
          path: '/combat/attacks/0/attackerObjectId',
        }),
      ]));
    }
  });

  it('returns compatible with fresh deeply frozen normalized views', () => {
    const solo = cloneView();
    const core = cloneView();
    const result = compareSoloCoreCompatibilityV1(solo, core);
    expect(result.kind).toBe('compatible');
    expect(result.issues).toEqual([]);
    expect(result.soloView).not.toBe(solo);
    expect(result.coreView).not.toBe(core);
    expect(Object.isFrozen(result.soloView)).toBe(true);
    expect(Object.isFrozen(result.soloView.orderedZones[0]?.objectIds)).toBe(true);
  });

  it.each([
    ['/kind', (view: SoloCoreComparableViewV1) => ({ ...view, kind: 'wrong' as never })],
    ['/schemaVersion', (view: SoloCoreComparableViewV1) => ({ ...view, schemaVersion: 2 as never })],
    ['/activePlayerId', (view: SoloCoreComparableViewV1) => ({ ...view, activePlayerId: 'P2' as never })],
    ['/turnNumber', (view: SoloCoreComparableViewV1) => ({ ...view, turnNumber: 5 })],
    ['/turnPosition/step', (view: SoloCoreComparableViewV1) => ({ ...view, turnPosition: { phase: 'beginning', step: 'draw' } })],
    ['/orderedZones/0/objectIds/0', (view: SoloCoreComparableViewV1) => ({ ...view, orderedZones: [{ ...view.orderedZones[0], objectIds: ['PC2:0'] }, ...view.orderedZones.slice(1)] })],
    ['/commanders/0/castCount', (view: SoloCoreComparableViewV1) => ({ ...view, commanders: [{ ...view.commanders[0], castCount: 1 }] })],
    ['/combat', (view: SoloCoreComparableViewV1) => ({ ...view, combat: { turnNumber: 4, step: 'declare-attackers' as const, attackingPlayerId: 'P1' as never, defendingPlayerIds: ['P2'] as never, attacks: [], blocks: [] } })],
  ])('reports every comparable mutation at %s', (path, mutate) => {
    const result = compareSoloCoreCompatibilityV1(cloneView(), mutate(cloneView()) as unknown as SoloCoreComparableViewV1);
    expect(result.kind).toBe('incompatible');
    if (result.kind === 'incompatible') expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
  });

  it('preserves array order and reports all mismatch paths deterministically', () => {
    const left = cloneView();
    const right = { ...cloneView(), orderedZones: [cloneView().orderedZones[1], cloneView().orderedZones[0]] };
    const first = compareSoloCoreCompatibilityV1(left, right);
    const second = compareSoloCoreCompatibilityV1(left, right);
    expect(first.kind).toBe('incompatible');
    expect(JSON.stringify(first.issues)).toBe(JSON.stringify(second.issues));
    if (first.kind === 'incompatible') expect(first.issues[0]?.path).toBe('/orderedZones/0/objectIds');
  });

  it('fails closed with fresh deeply frozen evidence for revoked, accessor, and sparse inputs', () => {
    const ordinary = cloneView();
    const sparseZones = [cloneView().orderedZones[0]];
    sparseZones.length = 2;
    const sparse = { ...cloneView(), orderedZones: sparseZones } as SoloCoreComparableViewV1;
    const sparseKeysBefore = Reflect.ownKeys(sparseZones);

    let getterCalls = 0;
    const accessor = cloneView();
    Object.defineProperty(accessor, 'orderedZones', {
      configurable: true,
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return baseView.orderedZones;
      },
    });
    const accessorDescriptor = Object.getOwnPropertyDescriptor(accessor, 'orderedZones');

    const revoked = Proxy.revocable(cloneView(), {});
    revoked.revoke();
    const hostileInputs = [revoked.proxy, accessor, sparse] as readonly SoloCoreComparableViewV1[];
    for (const hostile of hostileInputs) {
      let result: ReturnType<typeof compareSoloCoreCompatibilityV1> | undefined;
      expect(() => { result = compareSoloCoreCompatibilityV1(hostile, ordinary); }).not.toThrow();
      expect(result?.kind).toBe('incompatible');
      expect(Object.is(result?.soloView, hostile)).toBe(false);
      expect(Object.is(result?.coreView, ordinary)).toBe(false);
      expect(isDeeplyFrozen(result?.soloView)).toBe(true);
      expect(isDeeplyFrozen(result?.coreView)).toBe(true);
    }
    expect(getterCalls).toBe(0);
    expect(Object.getOwnPropertyDescriptor(accessor, 'orderedZones')).toEqual(accessorDescriptor);
    expect(Reflect.ownKeys(sparseZones)).toEqual(sparseKeysBefore);
  });

  it('keeps non-transformable catalog concerns outside the comparator closed view surface', () => {
    const excludedConcerns = [
      'player-roster', 'commander-damage', 'general-life', 'stack-subset', 'search-control-subset',
      'full-combat-damage', 'pending-trigger-sba-turn-advance', 'poison-energy-experience',
      'mana-payment', 'undo-redo', 'indexeddb-snapshot', 'typed-manual-correction', 'core-replay-package',
    ] as const;
    for (const concern of excludedConcerns) {
      expect(soloCoreCompatibilityEntryForV1(concern)?.classification).not.toBe('transformable');
    }
    expect(SOLO_CORE_COMPATIBILITY_CATALOG_V1.filter((entry) => entry.classification !== 'transformable')).toHaveLength(excludedConcerns.length);
    expect(compareSoloCoreCompatibilityV1.length).toBe(2);
    expect(Object.keys(baseView)).toEqual([
      'kind', 'schemaVersion', 'activePlayerId', 'turnNumber', 'turnPosition', 'orderedZones', 'commanders', 'combat',
    ]);
    expect(Object.keys(compareSoloCoreCompatibilityV1(cloneView(), cloneView()))).toEqual(['kind', 'soloView', 'coreView', 'issues']);
  });
});
