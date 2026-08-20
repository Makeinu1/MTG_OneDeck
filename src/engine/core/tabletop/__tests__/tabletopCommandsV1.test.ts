import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Core from '../../index';
import * as Closure from '../../closure/index';

function root(): Closure.ModeNeutralCoreRootV1 {
  const fixture = JSON.parse(readFileSync(new URL('../../turn/fixtures/turn-priority-lifecycle-v1.json', import.meta.url), 'utf8')) as { bundle: unknown };
  const turn = Core.createCoreTurnPriorityBundleV1(fixture.bundle as never);
  const registry = turn.stackBundle.objectRegistry;
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: turn,
    control: Core.createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: { 'PC6:0': { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false } } as never }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
  });
  const commander = Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC1', ownerPlayerId: 'P1' });
  return Closure.createModeNeutralCoreRootV1({
    versions: Closure.CORE_CLOSURE_VERSION_VECTOR_V1,
    acceptedCommandCount: 0,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({ players: registry.turnOrder.map((playerId) => ({ playerId, status: 'active', exitCause: null })) }),
    commanders: [commander],
    commanderCastLedgers: [Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 })],
    commanderDamage: Core.createCoreCommanderDamageStateV1({ commanders: [commander], defendingPlayerIds: registry.turnOrder, entries: [] }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({ commanders: [commander], defendingPlayerIds: registry.turnOrder, records: [] }),
    combatContext: null,
  });
}

function command(rootValue: Closure.ModeNeutralCoreRootV1, payload: Core.CoreCommandPayloadV1): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence: rootValue.acceptedCommandCount + 1,
    actorPlayerId: 'P1' as never,
    decisionMakerPlayerId: 'P1' as never,
    decisionContext: { kind: 'decision', decisionKey: 'tabletop' },
    payload,
  });
}

describe('O4P-06B ordinary tabletop command matrix', () => {
  it('draws atomically and reincarnates cards', () => {
    const initial = root();
    const result = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-draw', count: 1 }));
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    const registry = result.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(registry.zones.byPlayer['P1' as never]?.library).toHaveLength(0);
    expect(registry.zones.byPlayer['P1' as never]?.hand).toEqual(['PC2:0', 'PC1:1']);
    expect(registry.players['P1' as never]?.drawnThisTurn).toBe(1);
    expect(registry.objects['PC1:0' as never]).toBeUndefined();
    expect(result.events[0]?.payload.kind).toBe('table-draw');
    expect(Object.isFrozen(result.root)).toBe(true);
    expect(Object.isFrozen(result.events)).toBe(true);
    expect(Object.isFrozen(result.events[0])).toBe(true);
    expect(Object.isFrozen(result.events[0]?.payload)).toBe(true);
  });

  it('clears attachment references to the old library incarnation when drawing', () => {
    const initial = root();
    const turn = initial.ruleAuthority.turnPriorityBundle;
    const registry = turn.stackBundle.objectRegistry;
    const oldLibraryObjectId = registry.zones.byPlayer['P1' as never]?.library[0];
    const battlefieldObjectId = registry.zones.shared.battlefield[0];
    expect(oldLibraryObjectId).toBeDefined();
    expect(battlefieldObjectId).toBeDefined();
    if (oldLibraryObjectId === undefined || battlefieldObjectId === undefined) return;
    const currentRuntime = turn.stackBundle.objectRuntime.byObject[battlefieldObjectId];
    if (currentRuntime === undefined) throw new Error('Battlefield runtime is required');
    const runtime = Core.createModeNeutralCoreObjectRuntimeStateV2(registry, {
      byObject: {
        ...turn.stackBundle.objectRuntime.byObject,
        [battlefieldObjectId]: {
          ...currentRuntime,
          attachment: Core.createCoreAttachmentStateV1({
            attachedTo: { kind: 'object', objectId: oldLibraryObjectId },
          }),
        },
      },
    });
    const stackBundle = Core.createCoreStackTransactionBundleV1({
      ...turn.stackBundle,
      objectRuntime: runtime,
    });
    const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
      ...turn,
      stackBundle,
    });
    const ruleAuthority = Core.createCoreRuleAuthorityBundleV1({
      ...initial.ruleAuthority,
      turnPriorityBundle,
    });
    const attached = Core.createModeNeutralCoreRootV1({ ...initial, ruleAuthority });
    const result = Core.applyCoreCommandV1(
      attached,
      command(attached, { kind: 'table-draw', count: 1 }),
    );
    expect(result.status).toBe('accepted');
    if (result.status === 'rejected') return;
    expect(
      result.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRuntime
        .byObject[battlefieldObjectId]?.attachment.attachedTo,
    ).toBeNull();
  });

  it('adjusts mana and rejects underflow without changing identity', () => {
    const initial = root();
    const accepted = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-mana-adjust', color: 'G', delta: 2 }));
    expect(accepted.status).toBe('accepted');
    if (accepted.status !== 'accepted') return;
    const rejected = Core.applyCoreCommandV1(accepted.root, command(accepted.root, { kind: 'table-mana-adjust', color: 'G', delta: -3 }));
    expect(rejected.status).toBe('rejected');
    expect(rejected.root).toBe(accepted.root);
  });

  it('moves cards with reincarnation and updates public runtime actions', () => {
    const initial = root();
    const moved = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-zone-move', objectId: 'PC1:0' as never, destination: { kind: 'battlefield', baseControllerPlayerId: 'P1' as never },
    }));
    expect(moved.status).toBe('accepted');
    if (moved.status !== 'accepted') return;
    const registry = moved.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(registry.zones.byPlayer['P1' as never]?.library).toEqual([]);
    expect(registry.zones.shared.battlefield).toContain('PC1:1' as never);
    const tapped = Core.applyCoreCommandV1(moved.root, command(moved.root, { kind: 'table-tap', objectId: 'PC1:1' as never, tapped: true }));
    expect(tapped.status).toBe('accepted');
    if (tapped.status !== 'accepted') return;
    const counted = Core.applyCoreCommandV1(tapped.root, command(tapped.root, { kind: 'table-counter-adjust', objectId: 'PC1:1' as never, counterKind: 'charge', delta: 2 }));
    expect(counted.status).toBe('accepted');
  });

  it('removes a moved stack card from its stack announcement record', () => {
    const initial = root();
    const moved = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-zone-move', objectId: 'PC5:1' as never, destination: { kind: 'owner-graveyard' },
    }));
    expect(moved.status).toBe('accepted');
    if (moved.status !== 'accepted') return;
    expect(moved.root.ruleAuthority.turnPriorityBundle.stackBundle.stackAnnouncements.byObject['PC5:1' as never]).toBeUndefined();
  });

  it('creates and removes an engine-synthetic token with canonical runtime', () => {
    const initial = root();
    const definition = initial.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.cardDefinitions['def.fixture-card' as never];
    const created = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-token-create', tokenSeed: 'table-token', definitionId: 'table-definition' as never, definition,
    }));
    expect(created.status).toBe('accepted');
    if (created.status !== 'accepted') return;
    const registry = created.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(registry.zones.shared.battlefield).toContain('@token:table-token:0' as never);
    const removed = Core.applyCoreCommandV1(created.root, command(created.root, { kind: 'table-token-remove', objectId: '@token:table-token:0' as never }));
    expect(removed.status).toBe('accepted');
    if (removed.status !== 'accepted') return;
    expect(removed.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.objects['@token:table-token:0' as never]).toBeUndefined();
  });

  it('round-trips accepted ordinary commands through the shipped journal replay', () => {
    const initial = root();
    const first = command(initial, { kind: 'table-draw', count: 1 });
    const firstResult = Core.applyCoreCommandV1(initial, first);
    expect(firstResult.status).toBe('accepted');
    if (firstResult.status !== 'accepted') return;
    const second = command(firstResult.root, { kind: 'table-mana-adjust', color: 'U', delta: 1 });
    const secondResult = Core.applyCoreCommandV1(firstResult.root, second);
    expect(secondResult.status).toBe('accepted');
    if (secondResult.status !== 'accepted') return;
    const journal = Core.appendCoreCommandJournalEntryV1([], first, firstResult);
    const completeJournal = Core.appendCoreCommandJournalEntryV1(journal, second, secondResult);
    const replay = Core.replayCoreCommandsFromRootV1(initial, completeJournal);
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.finalStateDigest).toBe(secondResult.afterStateDigest);
  });
});
