import { describe, expect, it } from 'vitest';
import * as Core from '../../../engine/core/index';
import {
  activateOnlineVariableRoomV2,
  acceptOnlineVariableRoomDeckV2,
  createOnlineVariableRoomV2,
  joinOnlineVariableRoomV2,
  setOnlineVariableRoomPlayerReadyV2,
  startOnlineVariableRoomV2,
} from '../../room/index';
import { createOnlineVariableProtocolStateV2, handleOnlineVariableCommandEnvelopeV2 } from '../../protocol/index';
import { projectOnlineVariableProtocolV3, validateOnlineParticipantProjectionV3 } from '../../projection/index';
import { makeCoreRoot } from '../../room/__tests__/testHelpers';
import { bindOnlineVisibilityV1 } from '../binding';
import { onlineProjectedSearchSessionHandleV1 } from '../sessionHandle';

const participants = ['host', 'player-2', 'player-3', 'player-4'] as const;
const capabilities = ['a', 'b', 'c', 'd'].map((letter) => `seat_${letter.repeat(32)}`);

function stateWithSearch(delegated = false, observer = false) {
  let root = makeCoreRoot();
  const opened = Core.openCoreSearchSessionV1(
    root.ruleAuthority,
    'search-1' as never,
    {
      zone: { kind: 'player-zone', playerId: 'P1' as Core.CorePlayerId, zone: 'library' }, portion: { kind: 'all' },
      criteria: { kind: 'quantity', minimum: 1, maximum: 1 }, revealFound: false, shuffleAfter: false,
    },
  );
  const openedAuthority = opened.value as Core.CoreRuleAuthorityBundleV1;
  let searchSessions = openedAuthority.searchSessions;
  let authorities = openedAuthority.decisionAuthorities;
  if (delegated) {
    const session = searchSessions.bySession['search-1'];
    if (session === undefined) throw new Error('Missing search session');
    searchSessions = Core.createModeNeutralCoreSearchSessionSliceV1({
      sessionOrder: ['search-1'], bySession: { 'search-1': { ...session, selectorPlayerId: 'P2' as Core.CorePlayerId } },
    });
    authorities = Core.addCoreDecisionAuthorityV1(authorities, 'search-control', {
      controlledPlayerId: 'P1' as Core.CorePlayerId, decisionMakerPlayerId: 'P2' as Core.CorePlayerId, sourceObjectId: null,
      scope: { kind: 'search-session', searchSessionId: 'search-1' },
    }).value;
  }
  root = Core.createModeNeutralCoreRootV1({ ...root, ruleAuthority: Core.createCoreRuleAuthorityBundleV1({ ...openedAuthority, searchSessions, decisionAuthorities: authorities }) });
  let room = createOnlineVariableRoomV2({
    roomId: delegated ? 'binding-delegated' : 'binding-ordinary',
    configuration: { playerCount: 4, startingLife: 40 },
    seatAssignments: participants.map((_, index) => ({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: `P${index + 1}` as never, ['seatCapability']: capabilities[index] ?? '' })),
    host: { participantId: participants[0], ['seatCapability']: capabilities[0] ?? '' },
  });
  for (let index = 1; index < participants.length; index += 1) room = joinOnlineVariableRoomV2(room, { participantId: participants[index] ?? '', ['seatCapability']: capabilities[index] ?? '' });
  for (const participant of participants) { room = acceptOnlineVariableRoomDeckV2(room, participant, true); room = setOnlineVariableRoomPlayerReadyV2(room, participant, true); }
  room = activateOnlineVariableRoomV2(startOnlineVariableRoomV2(room, participants[0]), root);
  return createOnlineVariableProtocolStateV2({ serverBuildId: 'binding-build', room, coreRoot: root, observerAuthorizations: observer ? [{ participantId: 'table-observer', ['observerCapability']: `observer_${'z'.repeat(32)}` }] : [] });
}

function stateWithQualifiedSearch(mayFailToFind = true) {
  const state = stateWithSearch();
  const root = state.coreRoot;
  const session = root.ruleAuthority.searchSessions.bySession['search-1'];
  if (session === undefined) throw new Error('Missing search session');
  const searchSessions = Core.createModeNeutralCoreSearchSessionSliceV1({
    sessionOrder: ['search-1'],
    bySession: {
      'search-1': {
        ...session,
        criteria: {
          kind: 'qualified',
          criteriaKey: 'opaque.criteria',
          minimum: 1,
          maximum: 1,
          mayFailToFind,
        },
      },
    },
  });
  const coreRoot = Core.createModeNeutralCoreRootV1({
    ...root,
    ruleAuthority: Core.createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, searchSessions }),
  });
  return createOnlineVariableProtocolStateV2({ ...state, coreRoot });
}

function stateWithoutSearch() {
  const state = stateWithSearch();
  const root = state.coreRoot;
  const authority = Core.createCoreRuleAuthorityBundleV1({
    ...root.ruleAuthority,
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
  });
  const coreRoot = Core.createModeNeutralCoreRootV1({ ...root, ruleAuthority: authority });
  return createOnlineVariableProtocolStateV2({ ...state, coreRoot });
}

function stateWithSearchRevealFound(): ReturnType<typeof stateWithSearch> {
  const state = stateWithSearch(false, true);
  const root = state.coreRoot;
  const session = root.ruleAuthority.searchSessions.bySession['search-1'];
  if (session === undefined) throw new Error('Missing search session');
  const searchSessions = Core.createModeNeutralCoreSearchSessionSliceV1({
    sessionOrder: ['search-1'],
    bySession: { 'search-1': { ...session, revealFound: true } },
  });
  const coreRoot = Core.createModeNeutralCoreRootV1({
    ...root,
    ruleAuthority: Core.createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, searchSessions }),
  });
  return createOnlineVariableProtocolStateV2({ ...state, coreRoot });
}

function stateWithoutSearchWithTwoLibraryCards() {
  const state = stateWithoutSearch();
  const root = state.coreRoot;
  const turn = root.ruleAuthority.turnPriorityBundle;
  const sourceRegistry = turn.stackBundle.objectRegistry;
  const extraObjectId = 'PC7:0' as Core.CoreObjectId;
  const extraPhysicalId = 'PC7' as Core.CorePhysicalCardId;
  const basePhysical = sourceRegistry.physicalCards['PC1' as Core.CorePhysicalCardId];
  const baseRuntime = turn.stackBundle.objectRuntime.byObject['PC1:0' as Core.CoreObjectId];
  const p1Zones = sourceRegistry.zones.byPlayer['P1' as Core.CorePlayerId];
  if (basePhysical === undefined || baseRuntime === undefined || p1Zones === undefined) throw new Error('Missing library fixture');
  const registry = Core.createModeNeutralCoreObjectRegistryStateV2({
    players: sourceRegistry.players,
    turnOrder: sourceRegistry.turnOrder,
    activePlayerId: sourceRegistry.activePlayerId,
    cardDefinitions: sourceRegistry.cardDefinitions,
    physicalCards: { ...sourceRegistry.physicalCards, [extraPhysicalId]: { ...basePhysical, ownerPlayerId: 'P1', isCommander: false } },
    objects: { ...sourceRegistry.objects, [extraObjectId]: Core.createCoreCardObjectIdentityV2({ kind: 'card', physicalCardId: extraPhysicalId, incarnation: 0, baseControllerPlayerId: null }) },
    zones: { byPlayer: { ...sourceRegistry.zones.byPlayer, ['P1' as Core.CorePlayerId]: { ...p1Zones, library: [...p1Zones.library, extraObjectId] } }, shared: sourceRegistry.zones.shared },
  });
  const runtime = Core.createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: { ...turn.stackBundle.objectRuntime.byObject, [extraObjectId]: baseRuntime } });
  const announcements = Core.createModeNeutralCoreStackAnnouncementSliceV1(registry, { byObject: turn.stackBundle.stackAnnouncements.byObject });
  const stackBundle = Core.createCoreStackTransactionBundleV1({ objectRegistry: registry, objectRuntime: runtime, stackAnnouncements: announcements });
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({ ...turn, stackBundle });
  const authority = Core.createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, turnPriorityBundle });
  const coreRoot = Core.createModeNeutralCoreRootV1({ ...root, ruleAuthority: authority });
  return createOnlineVariableProtocolStateV2({ ...state, coreRoot });
}

function twoPlayerCoreRoot(): Core.ModeNeutralCoreRootV1 {
  const source = makeCoreRoot();
  const sourceTurn = source.ruleAuthority.turnPriorityBundle;
  const sourceRegistry = sourceTurn.stackBundle.objectRegistry;
  const playerIds = ['P1', 'P2'] as const;
  const keep = new Set<string>(playerIds);
  const p1 = sourceRegistry.players['P1' as Core.CorePlayerId];
  const p2 = sourceRegistry.players['P2' as Core.CorePlayerId];
  if (p1 === undefined || p2 === undefined) throw new Error('Missing two-player state');
  const players = { ['P1' as Core.CorePlayerId]: p1, ['P2' as Core.CorePlayerId]: p2 };
  const physicalCards = Object.fromEntries(Object.entries(sourceRegistry.physicalCards).filter(([, card]) => keep.has(card.ownerPlayerId)));
  const objects = Object.fromEntries(Object.entries(sourceRegistry.objects).filter(([objectId, object]) => object.kind === 'card' && Object.prototype.hasOwnProperty.call(physicalCards, object.physicalCardId) && objectId.includes(':')));
  const byPlayer = Object.fromEntries(playerIds.map((playerId) => {
    const zones = sourceRegistry.zones.byPlayer[playerId as Core.CorePlayerId];
    if (zones === undefined) throw new Error('Missing two-player zones');
    return [playerId, {
      library: zones.library.filter((objectId) => Object.prototype.hasOwnProperty.call(objects, objectId)),
      hand: zones.hand.filter((objectId) => Object.prototype.hasOwnProperty.call(objects, objectId)),
      graveyard: zones.graveyard.filter((objectId) => Object.prototype.hasOwnProperty.call(objects, objectId)),
    }];
  }));
  const registry = Core.createModeNeutralCoreObjectRegistryStateV2({
    players,
    turnOrder: [...playerIds] as Core.CorePlayerId[],
    activePlayerId: 'P2' as Core.CorePlayerId,
    cardDefinitions: sourceRegistry.cardDefinitions,
    physicalCards,
    objects,
    zones: { byPlayer, shared: { battlefield: [], stack: [], exile: [], command: [] } },
  });
  const runtime = Core.createModeNeutralCoreObjectRuntimeStateV2(registry, {
    byObject: Object.fromEntries(Object.entries(sourceTurn.stackBundle.objectRuntime.byObject).filter(([objectId]) => Object.prototype.hasOwnProperty.call(objects, objectId))),
  });
  const announcements = Core.createModeNeutralCoreStackAnnouncementSliceV1(registry, { byObject: {} });
  const stackBundle = Core.createCoreStackTransactionBundleV1({ objectRegistry: registry, objectRuntime: runtime, stackAnnouncements: announcements });
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
    stackBundle,
    pendingTriggers: Core.createModeNeutralCorePendingTriggerSliceV1(registry, { pendingObjectIds: [], byObject: {} }),
    lifecycle: sourceTurn.lifecycle,
  });
  const commanders = source.commanders.filter((commander) => keep.has(commander.ownerPlayerId));
  const commanderCastLedgers = source.commanderCastLedgers.filter((ledger) => keep.has(ledger.commander.ownerPlayerId));
  const authority = Core.createCoreRuleAuthorityBundleV1({
    ...source.ruleAuthority,
    turnPriorityBundle,
    control: Core.createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: {} }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
  });
  return Core.createModeNeutralCoreRootV1({
    ...source,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({ players: source.playerLifecycle.players.filter((entry) => keep.has(entry.playerId)) }),
    commanders,
    commanderCastLedgers,
    commanderDamage: Core.createCoreCommanderDamageStateV1({ commanders, defendingPlayerIds: [...playerIds], entries: [] }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({ commanders, defendingPlayerIds: [...playerIds], records: [] }),
  });
}

function stateWithSearchTwoPlayers(observer = false) {
  let root = twoPlayerCoreRoot();
  const opened = Core.openCoreSearchSessionV1(
    root.ruleAuthority,
    'search-1' as never,
    {
      zone: { kind: 'player-zone', playerId: 'P1' as Core.CorePlayerId, zone: 'library' }, portion: { kind: 'all' },
      criteria: { kind: 'quantity', minimum: 1, maximum: 1 }, revealFound: false, shuffleAfter: false,
    },
  );
  const openedAuthority = opened.value as Core.CoreRuleAuthorityBundleV1;
  root = Core.createModeNeutralCoreRootV1({ ...root, ruleAuthority: openedAuthority });
  const twoParticipants = participants.slice(0, 2);
  let room = createOnlineVariableRoomV2({
    roomId: 'binding-two-player',
    configuration: { playerCount: 2, startingLife: 20 },
    seatAssignments: twoParticipants.map((_, index) => ({ seatIndex: index as 0 | 1, corePlayerId: `P${index + 1}` as never, ['seatCapability']: capabilities[index] ?? '' })),
    host: { participantId: twoParticipants[0] ?? '', ['seatCapability']: capabilities[0] ?? '' },
  });
  for (let index = 1; index < twoParticipants.length; index += 1) room = joinOnlineVariableRoomV2(room, { participantId: twoParticipants[index] ?? '', ['seatCapability']: capabilities[index] ?? '' });
  for (const participant of twoParticipants) { room = acceptOnlineVariableRoomDeckV2(room, participant, true); room = setOnlineVariableRoomPlayerReadyV2(room, participant, true); }
  room = activateOnlineVariableRoomV2(startOnlineVariableRoomV2(room, twoParticipants[0] ?? ''), root);
  return createOnlineVariableProtocolStateV2({ serverBuildId: 'binding-two-player-build', room, coreRoot: root, observerAuthorizations: observer ? [{ participantId: 'table-observer', ['observerCapability']: `observer_${'z'.repeat(32)}` }] : [] });
}

function look(baseRevision: number, duration: unknown): Record<string, unknown> {
  return { kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'look-command', baseRevision, look: { subject: { kind: 'top-of-library', count: 1 }, viewerPlayerIds: ['P1'], duration } };
}

function choose(baseRevision: number, commandId = 'choose-command'): Record<string, unknown> {
  return { kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId, baseRevision, choose: { searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', baseRevision), candidateHandles: ['PC1:0'] } };
}

function firstLibraryEntryKind(projection: ReturnType<typeof projectOnlineVariableProtocolV3>, playerId: string): string | undefined {
  const game = projection.game as unknown as Readonly<{ readonly zones: Readonly<{ readonly byPlayer: readonly Readonly<{ readonly playerId: string; readonly zones: Readonly<{ readonly library: Readonly<{ readonly entries: readonly Readonly<{ readonly kind: string }>[] }> }> }>[] }> }>;
  return game.zones.byPlayer.find((entry) => entry.playerId === playerId)?.zones.library.entries[0]?.kind;
}

function unknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function coreTestCommand(
  root: Core.ModeNeutralCoreRootV1,
  actorPlayerId: string,
  payload: Core.CoreCommandV1['payload'],
  decisionContext: Core.CoreCommandV1['decisionContext'] = { kind: 'decision', decisionKey: 'binding-closure-test' },
  decisionMakerPlayerId = actorPlayerId,
): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence: root.acceptedCommandCount + 1,
    actorPlayerId: actorPlayerId as never,
    decisionMakerPlayerId: decisionMakerPlayerId as never,
    decisionContext,
    payload,
  });
}

describe('online visibility binding', () => {
  it('requires a projected current session for choice-bound durations', () => {
    const state = stateWithSearch();
    expect(() => bindOnlineVisibilityV1({ state, participantId: 'host', envelope: look(0, { kind: 'choice-bound', searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', 0) }) as never, projection: { game: { searchSessions: [] } } })).toThrow('choice');
    const projection = projectOnlineVariableProtocolV3(state, 'host');
    const bound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: look(0, { kind: 'choice-bound', searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', 0) }) as never, projection });
    expect(bound.command.payload.kind).toBe('visibility-open');
    if (bound.command.payload.kind === 'visibility-open') expect(bound.command.payload.grant.duration).toEqual({ kind: 'until-search-completes', searchSessionId: 'search-1' });
  });

  it('binds an actor-owned concealed-object handle without widening identity', () => {
    const state = stateWithSearch();
    const projection = projectOnlineVariableProtocolV3(state, 'host');
    type Entry = Readonly<{ readonly objectId?: unknown; readonly runtime?: unknown }>;
    type Group = Readonly<{ readonly zones: Readonly<{ readonly hand: Readonly<{ readonly entries: readonly Entry[] }> }> }>;
    const byPlayer = (projection.game.zones as unknown as Readonly<{ readonly byPlayer: readonly Group[] }>).byPlayer;
    const concealedProjection = {
      ...projection,
      game: {
        ...projection.game,
        zones: {
          ...projection.game.zones,
          byPlayer: byPlayer.map((group, index) => index === 0
            ? { ...group, zones: { ...group.zones, hand: { ...group.zones.hand, entries: group.zones.hand.entries.map((entry) => entry.objectId === 'PC2:0'
              ? { kind: 'concealed-object' as const, objectId: 'PC2:0', objectKind: 'card' as const, runtime: entry.runtime }
              : entry) } } }
            : group),
        },
      },
    } as never;
    const envelope = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'concealed-subject', baseRevision: 0,
      look: { subject: { kind: 'object', handle: 'PC2:0' }, viewerPlayerIds: ['P1'], duration: { kind: 'next-command' } },
    };
    const bound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: envelope as never, projection: concealedProjection });
    expect(bound.command.payload).toMatchObject({ kind: 'visibility-open', grant: { subject: { kind: 'object', objectId: 'PC2:0' } } });
  });

  it('uses an opaque projected session handle and resolves it to the Core key only at binding', () => {
    const state = stateWithSearch();
    const projection = projectOnlineVariableProtocolV3(state, 'host');
    const projected = projection.game.searchSessions[0];
    if (projected === undefined || typeof projected.sessionId !== 'string') throw new Error('Missing projected session');
    const handle = projected.sessionId;
    expect(handle).not.toContain('search-1');
    expect(JSON.stringify(projection)).not.toContain('search-1');
    const bound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: choose(0) as never, projection });
    expect(bound.command.decisionContext).toEqual({ kind: 'search-session', searchSessionId: 'search-1' });
    expect(bound.command.payload).toMatchObject({ kind: 'search-complete', sessionKey: 'search-1' });

    const removed = { ...projection, game: { ...projection.game, searchSessions: [] } } as never;
    expect(() => bindOnlineVisibilityV1({ state, participantId: 'host', envelope: choose(0) as never, projection: removed })).toThrow('session');
    const stale = { ...projection, revision: projection.revision + 1 } as never;
    expect(() => bindOnlineVisibilityV1({ state, participantId: 'host', envelope: choose(0) as never, projection: stale })).toThrow('session');
    const colliding = { ...projection, game: { ...projection.game, searchSessions: [projected, projected] } } as never;
    expect(() => bindOnlineVisibilityV1({ state, participantId: 'host', envelope: choose(0) as never, projection: colliding })).toThrow('session');
    const raw = { ...choose(0), choose: { searchSessionId: 'search-1', candidateHandles: ['PC1:0'] } } as never;
    expect(() => bindOnlineVisibilityV1({ state, participantId: 'host', envelope: raw, projection })).toThrow('session');
  });

  it('keeps search-session handles incarnation-safe across completion and reopening', () => {
    const initial = stateWithSearch();
    const initialProjection = projectOnlineVariableProtocolV3(initial, 'host');
    const firstHandle = initialProjection.game.searchSessions[0]?.sessionId;
    if (typeof firstHandle !== 'string') throw new Error('Missing initial projected session handle');
    const firstBound = bindOnlineVisibilityV1({ state: initial, participantId: 'host', envelope: choose(0, 'choose-first') as never, projection: initialProjection });
    const firstEnvelope = {
      kind: 'online-command-envelope-v1' as const,
      protocolVersion: initial.protocolVersion,
      roomId: initial.room.roomId,
      participantId: 'host',
      ['participantCapability']: capabilities[0],
      commandId: 'choose-first',
      baseRevision: initial.revision,
      command: firstBound.command,
    };
    const completed = handleOnlineVariableCommandEnvelopeV2(initial, firstEnvelope);
    expect(completed.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: 1 });

    const reopenedCommand = coreTestCommand(completed.state.coreRoot, 'P1', {
      kind: 'search-open',
      sessionKey: 'search-1',
      input: {
        zone: { kind: 'player-zone', playerId: 'P1' as Core.CorePlayerId, zone: 'library' },
        portion: { kind: 'all' },
        criteria: { kind: 'quantity', minimum: 1, maximum: 1 },
        revealFound: false,
        shuffleAfter: false,
        rulesActorPlayerId: 'P1' as Core.CorePlayerId,
      },
    });
    const reopened = handleOnlineVariableCommandEnvelopeV2(completed.state, {
      kind: 'online-command-envelope-v1',
      protocolVersion: completed.state.protocolVersion,
      roomId: completed.state.room.roomId,
      participantId: 'host',
      ['participantCapability']: capabilities[0],
      commandId: 'search-reopen',
      baseRevision: completed.state.revision,
      command: reopenedCommand,
    });
    expect(reopened.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: 2 });
    const reopenedProjection = projectOnlineVariableProtocolV3(reopened.state, 'host');
    const reopenedSession = reopenedProjection.game.searchSessions[0];
    if (reopenedSession === undefined || typeof reopenedSession.sessionId !== 'string') throw new Error('Missing reopened projected session');
    expect(reopenedSession.sessionId).not.toBe(firstHandle);
    expect(validateOnlineParticipantProjectionV3(reopenedProjection)).toMatchObject({ ok: true });

    const staleEnvelope = {
      ...choose(reopened.state.revision, 'choose-stale'),
      choose: { searchSessionId: firstHandle, candidateHandles: ['PC1:0'] },
    };
    expect(() => bindOnlineVisibilityV1({ state: reopened.state, participantId: 'host', envelope: staleEnvelope as never, projection: reopenedProjection })).toThrow('session');
    const secondInput = choose(reopened.state.revision, 'choose-second');
    const secondBound = bindOnlineVisibilityV1({ state: reopened.state, participantId: 'host', envelope: secondInput as never, projection: reopenedProjection });
    const secondEnvelope = {
      kind: 'online-command-envelope-v1' as const,
      protocolVersion: reopened.state.protocolVersion,
      roomId: reopened.state.room.roomId,
      participantId: 'host',
      ['participantCapability']: capabilities[0],
      commandId: 'choose-second',
      baseRevision: reopened.state.revision,
      command: secondBound.command,
    };
    const completedAgain = handleOnlineVariableCommandEnvelopeV2(reopened.state, secondEnvelope);
    expect(completedAgain.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: 3 });
    const finalProjection = projectOnlineVariableProtocolV3(completedAgain.state, 'host');
    const checkedFinal = validateOnlineParticipantProjectionV3(finalProjection);
    expect(checkedFinal).toMatchObject({ ok: true });
    const resultHandles = finalProjection.game.searchResults?.map((result) => result.sessionId) ?? [];
    expect(resultHandles).toHaveLength(2);
    expect(new Set(resultHandles).size).toBe(2);
    expect(resultHandles).toContain(onlineProjectedSearchSessionHandleV1('search-1', completed.state.revision));
    expect(resultHandles).toContain(onlineProjectedSearchSessionHandleV1('search-1', completedAgain.state.revision));
    expect(JSON.stringify(finalProjection)).not.toContain('search-1');
    const duplicate = handleOnlineVariableCommandEnvelopeV2(reopened.state, secondEnvelope);
    expect(duplicate.response).toEqual(completedAgain.response);
    expect(duplicate.state).toEqual(completedAgain.state);
  });

  it('binds a source-bound grant to the projected source, independently of its subject', () => {
    const state = stateWithSearch();
    const projection = projectOnlineVariableProtocolV3(state, 'host');
    const envelope = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'source-bound-command', baseRevision: 0,
      look: {
        subject: { kind: 'object', handle: 'PC2:0' },
        viewerPlayerIds: ['P1'],
        duration: { kind: 'source-bound', sourceHandle: 'PC5:1' },
      },
    };
    const bound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: envelope as never, projection });
    const payload = bound.command.payload;
    if (payload.kind !== 'visibility-open') throw new Error('Expected visibility-open payload');
    expect(payload.grant.subject).toEqual({ kind: 'object', objectId: 'PC2:0' });
    expect(payload.grant.sourceObjectId).toBe('PC5:1');
    expect(payload.grant.duration).toEqual({ kind: 'while-source-exists', sourceObjectId: 'PC5:1' });

    const accepted = handleOnlineVariableCommandEnvelopeV2(state, {
      kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId,
      participantId: 'host', ['participantCapability']: capabilities[0], commandId: 'source-bound-command', baseRevision: 0,
      command: bound.command,
    });
    expect(accepted.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const retryProjection = projectOnlineVariableProtocolV3(accepted.state, 'host');
    expect(bindOnlineVisibilityV1({ state: accepted.state, participantId: 'host', envelope: envelope as never, projection: retryProjection, existingCommand: bound.command }).command).toEqual(bound.command);
    const mismatchedSubject = {
      ...envelope,
      look: { ...envelope.look, subject: { kind: 'object', handle: 'PC1:0' } },
    };
    expect(() => bindOnlineVisibilityV1({ state: accepted.state, participantId: 'host', envelope: mismatchedSubject as never, projection: retryProjection, existingCommand: bound.command })).toThrow('stale');
  });

  it('binds delegated Choose to the session rules actor and connected selector, then protocol accepts only that exception', () => {
    const state = stateWithSearch(true);
    const projection = projectOnlineVariableProtocolV3(state, 'player-2');
    const bound = bindOnlineVisibilityV1({ state, participantId: 'player-2', envelope: choose(0) as never, projection });
    expect(bound.actorPlayerId).toBe('P1');
    expect(bound.decisionMakerPlayerId).toBe('P2');
    const envelope = {
      kind: 'online-command-envelope-v1' as const, protocolVersion: state.protocolVersion,
      roomId: state.room.roomId, participantId: 'player-2', ['participantCapability']: capabilities[1],
      commandId: 'choose-command', baseRevision: 0, command: bound.command,
    };
    const delegatedTransition = handleOnlineVariableCommandEnvelopeV2(state, envelope);
    expect(delegatedTransition.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const wrong = { ...envelope, participantId: 'player-3', ['participantCapability']: capabilities[2] };
    expect(handleOnlineVariableCommandEnvelopeV2(state, wrong).response).toMatchObject({ kind: 'online-command-reject-v1', issues: [{ code: 'ACTOR_MISMATCH' }] });
  });

  it('rejects non-empty qualified Choose at the E boundary but allows may-fail empty completion', () => {
    const state = stateWithQualifiedSearch(true);
    const projection = projectOnlineVariableProtocolV3(state, 'host');
    const projectedSession = projection.game.searchSessions[0];
    const projectedCandidates = projectedSession?.candidates;
    if (!unknownArray(projectedCandidates)) throw new Error('Missing projected search candidate list');
    const candidateValue = projectedCandidates[0];
    const candidate = candidateValue !== null && typeof candidateValue === 'object' && !Array.isArray(candidateValue)
      ? candidateValue as Record<string, unknown>
      : undefined;
    if (candidate === undefined || typeof candidate.objectId !== 'string') throw new Error('Missing projected search candidate');
    expect(() => bindOnlineVisibilityV1({
      state,
      participantId: 'host',
      projection,
      envelope: {
        ...choose(0),
        choose: { searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', 0), candidateHandles: [candidate.objectId] },
      } as never,
    })).toThrow('criteria');

    const emptyEnvelope = { ...choose(0), choose: { searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', 0), candidateHandles: [] } };
    const bound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: emptyEnvelope as never, projection });
    const transition = handleOnlineVariableCommandEnvelopeV2(state, {
      kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId,
      participantId: 'host', ['participantCapability']: capabilities[0], commandId: 'choose-command', baseRevision: 0,
      command: bound.command,
    });
    expect(transition.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    expect(transition.state.receipts[0]?.completion).toMatchObject({ sessionKey: 'search-1', selectedCount: 0, revealFound: false });

    const noMayFailState = stateWithQualifiedSearch(false);
    const noMayFailProjection = projectOnlineVariableProtocolV3(noMayFailState, 'host');
    expect(() => bindOnlineVisibilityV1({
      state: noMayFailState,
      participantId: 'host',
      projection: noMayFailProjection,
      envelope: { ...emptyEnvelope, baseRevision: noMayFailState.revision } as never,
    })).toThrow('criteria');
  });

  it('rejects delegated Choose from the wrong selector, with an unprojected candidate, or with illegal cardinality', () => {
    const state = stateWithSearch(true);
    const selectorProjection = projectOnlineVariableProtocolV3(state, 'player-2');
    expect(() => bindOnlineVisibilityV1({ state, participantId: 'host', envelope: choose(0) as never, projection: projectOnlineVariableProtocolV3(state, 'host') })).toThrow('selector');
    expect(() => bindOnlineVisibilityV1({
      state, participantId: 'player-2', projection: selectorProjection,
      envelope: { ...choose(0), choose: { searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', 0), candidateHandles: ['PC2:0'] } } as never,
    })).toThrow('subject');

    const emptyChoice = { ...choose(0), choose: { searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', 0), candidateHandles: [] } };
    const bound = bindOnlineVisibilityV1({ state, participantId: 'player-2', envelope: emptyChoice as never, projection: selectorProjection });
    const transition = handleOnlineVariableCommandEnvelopeV2(state, {
      kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId,
      participantId: 'player-2', ['participantCapability']: capabilities[1], commandId: 'choose-command', baseRevision: 0,
      command: bound.command,
    });
    expect(transition.response).toMatchObject({ kind: 'online-command-reject-v1', issues: [{ code: 'CORE_COMMAND_REJECTED' }] });
    expect(transition.state).toEqual(state);
  });

  it('only reuses an accepted Look command for the exact high-level intent', () => {
    const state = stateWithSearch();
    const envelope = look(0, { kind: 'next-command' });
    const projection = projectOnlineVariableProtocolV3(state, 'host');
    const bound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: envelope as never, projection });
    const accepted = handleOnlineVariableCommandEnvelopeV2(state, {
      kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId,
      participantId: 'host', ['participantCapability']: capabilities[0], commandId: 'look-command', baseRevision: 0,
      command: bound.command,
    });
    expect(accepted.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const retryState = accepted.state;
    const retryProjection = projectOnlineVariableProtocolV3(retryState, 'host');
    const duplicate = bindOnlineVisibilityV1({ state: retryState, participantId: 'host', envelope: envelope as never, projection: retryProjection, existingCommand: bound.command });
    expect(duplicate.command).toEqual(bound.command);
    expect(() => bindOnlineVisibilityV1({
      state: retryState,
      participantId: 'host',
      envelope: { ...envelope, look: { ...(envelope.look as Record<string, unknown>), viewerPlayerIds: ['P2'] } } as never,
      projection: retryProjection,
      existingCommand: bound.command,
    })).toThrow('stale');
  });

  it('only reuses an accepted delegated Choose for the exact selected handles', () => {
    const state = stateWithSearch(true);
    const envelope = choose(0);
    const projection = projectOnlineVariableProtocolV3(state, 'player-2');
    const bound = bindOnlineVisibilityV1({ state, participantId: 'player-2', envelope: envelope as never, projection });
    const accepted = handleOnlineVariableCommandEnvelopeV2(state, {
      kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId,
      participantId: 'player-2', ['participantCapability']: capabilities[1], commandId: 'choose-command', baseRevision: 0,
      command: bound.command,
    });
    expect(accepted.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const duplicate = bindOnlineVisibilityV1({ state: accepted.state, participantId: 'player-2', envelope: envelope as never, existingCommand: bound.command });
    expect(duplicate.command).toEqual(bound.command);
    expect(() => bindOnlineVisibilityV1({
      state: accepted.state,
      participantId: 'player-2',
      envelope: { ...envelope, choose: { ...(envelope.choose as Record<string, unknown>), candidateHandles: [] } } as never,
      existingCommand: bound.command,
    })).toThrow('stale');
  });

  it('persists one typed Choose result and redacts identities unless revealFound is true', () => {
    const hiddenState = stateWithSearch(true);
    const hiddenProjection = projectOnlineVariableProtocolV3(hiddenState, 'player-2');
    const hiddenBound = bindOnlineVisibilityV1({ state: hiddenState, participantId: 'player-2', envelope: choose(0) as never, projection: hiddenProjection });
    const hiddenEnvelope = {
      kind: 'online-command-envelope-v1' as const, protocolVersion: hiddenState.protocolVersion, roomId: hiddenState.room.roomId,
      participantId: 'player-2', ['participantCapability']: capabilities[1], commandId: 'choose-command', baseRevision: 0, command: hiddenBound.command,
    };
    const hiddenAccepted = handleOnlineVariableCommandEnvelopeV2(hiddenState, hiddenEnvelope);
    expect(hiddenAccepted.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    expect(hiddenAccepted.state.receipts[0]?.completion).toMatchObject({ sessionKey: 'search-1', selectedCount: 1, revealFound: false });
    expect(hiddenAccepted.state.receipts[0]?.completion).not.toBeUndefined();
    const hiddenResult = projectOnlineVariableProtocolV3(hiddenAccepted.state, 'player-2').game.searchResults?.[0];
    expect(hiddenResult).toMatchObject({ sessionId: onlineProjectedSearchSessionHandleV1('search-1', hiddenAccepted.state.revision), selectedCount: 1, revealFound: false });
    expect(hiddenResult && 'selectedObjectIds' in hiddenResult).toBe(false);
    const hiddenDuplicate = handleOnlineVariableCommandEnvelopeV2(hiddenAccepted.state, hiddenEnvelope);
    expect(hiddenDuplicate.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true });
    expect(hiddenDuplicate.state.receipts).toHaveLength(1);

    const publicState = stateWithSearchRevealFound();
    const publicProjection = projectOnlineVariableProtocolV3(publicState, 'host');
    const publicBound = bindOnlineVisibilityV1({ state: publicState, participantId: 'host', envelope: choose(0) as never, projection: publicProjection });
    const publicEnvelope = { ...hiddenEnvelope, roomId: publicState.room.roomId, participantId: 'host', ['participantCapability']: capabilities[0], command: publicBound.command };
    const publicAccepted = handleOnlineVariableCommandEnvelopeV2(publicState, publicEnvelope);
    expect(publicAccepted.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const publicResult = projectOnlineVariableProtocolV3(publicAccepted.state, 'host').game.searchResults?.[0];
    expect(publicResult).toMatchObject({ sessionId: onlineProjectedSearchSessionHandleV1('search-1', publicAccepted.state.revision), selectedCount: 1, revealFound: true, selectedObjectIds: ['PC1:0'] });
    expect(projectOnlineVariableProtocolV3(publicAccepted.state, 'table-observer').game.searchResults?.[0]).toMatchObject({ selectedObjectIds: ['PC1:0'] });
  });

  it('derives distinct grant keys for the same command ID across sequential seats', () => {
    const initial = stateWithoutSearch();
    const first = bindOnlineVisibilityV1({ state: initial, participantId: 'host', envelope: look(0, { kind: 'next-command' }) as never, projection: projectOnlineVariableProtocolV3(initial, 'host') });
    const firstEnvelope = {
      kind: 'online-command-envelope-v1' as const, protocolVersion: initial.protocolVersion, roomId: initial.room.roomId,
      participantId: 'host', ['participantCapability']: capabilities[0], commandId: 'look-command', baseRevision: 0, command: first.command,
    };
    const firstAccepted = handleOnlineVariableCommandEnvelopeV2(initial, firstEnvelope);
    expect(firstAccepted.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const secondInput = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'look-command', baseRevision: firstAccepted.state.revision,
      look: { subject: { kind: 'object', handle: 'PC3:0' }, viewerPlayerIds: ['P1'], duration: { kind: 'next-command' } },
    };
    const second = bindOnlineVisibilityV1({ state: firstAccepted.state, participantId: 'player-2', envelope: secondInput as never, projection: projectOnlineVariableProtocolV3(firstAccepted.state, 'player-2') });
    expect(first.grantKey).toBeDefined();
    expect(second.grantKey).toBeDefined();
    expect(second.grantKey).not.toBe(first.grantKey);
  });

  it('projects an accepted E Look to the exact viewer, then an all-player Reveal to players and an observer', () => {
    const state = stateWithSearch(false, true);
    const lookBound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: look(0, { kind: 'next-command' }) as never, projection: projectOnlineVariableProtocolV3(state, 'host') });
    const lookEnvelope = { kind: 'online-command-envelope-v1' as const, protocolVersion: state.protocolVersion, roomId: state.room.roomId, participantId: 'host', ['participantCapability']: capabilities[0], commandId: 'look-command', baseRevision: 0, command: lookBound.command };
    const looked = handleOnlineVariableCommandEnvelopeV2(state, lookEnvelope);
    expect(looked.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const p1Look = projectOnlineVariableProtocolV3(looked.state, 'host');
    const p2Look = projectOnlineVariableProtocolV3(looked.state, 'player-2');
    expect(firstLibraryEntryKind(p1Look, 'P1')).toBe('visible-object');
    expect(firstLibraryEntryKind(p2Look, 'P1')).toBe('hidden-card');

    const revealEnvelopeInput = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'reveal-command', baseRevision: looked.state.revision,
      reveal: { subject: { kind: 'top-of-library', count: 1 }, duration: { kind: 'end-of-turn' } },
    };
    const revealBound = bindOnlineVisibilityV1({ state: looked.state, participantId: 'host', envelope: revealEnvelopeInput as never, projection: p1Look });
    const revealed = handleOnlineVariableCommandEnvelopeV2(looked.state, { ...lookEnvelope, commandId: 'reveal-command', baseRevision: looked.state.revision, command: revealBound.command });
    expect(revealed.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const observer = projectOnlineVariableProtocolV3(revealed.state, 'table-observer');
    expect(firstLibraryEntryKind(observer, 'P1')).toBe('visible-object');
    const serialized = JSON.stringify(observer);
    expect(serialized).not.toMatch(/grantKey|sourceObjectId|topLibraryPrefixDigest|decisionAuthorities/u);
  });

  it('runs the ordinary two-player Look/Reveal/Choose journey with exact projection redaction', () => {
    const state = stateWithSearchTwoPlayers(true);
    expect(state.room.seats).toHaveLength(2);
    const hostProjection = projectOnlineVariableProtocolV3(state, 'host');
    const guestProjection = projectOnlineVariableProtocolV3(state, 'player-2');
    expect(hostProjection.game.searchSessions).toHaveLength(1);
    expect(guestProjection.game.searchSessions).toHaveLength(0);
    const projectedSession = hostProjection.game.searchSessions[0];
    const projectedCandidates = projectedSession?.candidates;
    if (!unknownArray(projectedCandidates)) throw new Error('Missing projected candidate list');
    const candidateValue = projectedCandidates[0];
    const candidate = candidateValue !== null && typeof candidateValue === 'object' && !Array.isArray(candidateValue)
      ? candidateValue as Record<string, unknown>
      : undefined;
    if (candidate === undefined || typeof candidate.objectId !== 'string') throw new Error('Missing projected search candidate');

    const lookInput = look(0, { kind: 'next-command' });
    const lookBound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: lookInput as never, projection: hostProjection });
    const lookEnvelope = {
      kind: 'online-command-envelope-v1' as const, protocolVersion: state.protocolVersion, roomId: state.room.roomId,
      participantId: 'host', ['participantCapability']: capabilities[0], commandId: 'look-command', baseRevision: 0, command: lookBound.command,
    };
    const looked = handleOnlineVariableCommandEnvelopeV2(state, lookEnvelope);
    expect(looked.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const hostLook = projectOnlineVariableProtocolV3(looked.state, 'host');
    const guestLook = projectOnlineVariableProtocolV3(looked.state, 'player-2');
    expect(firstLibraryEntryKind(hostLook, 'P1')).toBe('visible-object');
    expect(firstLibraryEntryKind(guestLook, 'P1')).toBe('hidden-card');

    const revealInput = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'reveal-two-player', baseRevision: looked.state.revision,
      reveal: { subject: { kind: 'top-of-library', count: 1 }, duration: { kind: 'end-of-turn' } },
    };
    const revealBound = bindOnlineVisibilityV1({ state: looked.state, participantId: 'host', envelope: revealInput as never, projection: hostLook });
    const revealed = handleOnlineVariableCommandEnvelopeV2(looked.state, { ...lookEnvelope, commandId: 'reveal-two-player', baseRevision: looked.state.revision, command: revealBound.command });
    expect(revealed.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    expect(firstLibraryEntryKind(projectOnlineVariableProtocolV3(revealed.state, 'host'), 'P1')).toBe('visible-object');
    expect(firstLibraryEntryKind(projectOnlineVariableProtocolV3(revealed.state, 'player-2'), 'P1')).toBe('visible-object');
    expect(firstLibraryEntryKind(projectOnlineVariableProtocolV3(revealed.state, 'table-observer'), 'P1')).toBe('visible-object');

    const chooserProjection = projectOnlineVariableProtocolV3(revealed.state, 'host');
    const chooseInput = choose(revealed.state.revision, 'choose-two-player');
    expect(() => bindOnlineVisibilityV1({ state: revealed.state, participantId: 'player-2', envelope: chooseInput as never, projection: projectOnlineVariableProtocolV3(revealed.state, 'player-2') })).toThrow('selector');
    const chooseBound = bindOnlineVisibilityV1({ state: revealed.state, participantId: 'host', envelope: { ...chooseInput, choose: { searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', revealed.state.revision), candidateHandles: [candidate.objectId] } } as never, projection: chooserProjection });
    const chosen = handleOnlineVariableCommandEnvelopeV2(revealed.state, {
      kind: 'online-command-envelope-v1', protocolVersion: revealed.state.protocolVersion, roomId: revealed.state.room.roomId,
      participantId: 'host', ['participantCapability']: capabilities[0], commandId: 'choose-two-player', baseRevision: revealed.state.revision, command: chooseBound.command,
    });
    expect(chosen.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    expect(projectOnlineVariableProtocolV3(chosen.state, 'host').game.searchSessions).toHaveLength(0);
    const observerSerialized = JSON.stringify(projectOnlineVariableProtocolV3(revealed.state, 'table-observer'));
    expect(observerSerialized).not.toMatch(/grantKey|sourceObjectId|topLibraryPrefixDigest|decisionAuthorities|P3|P4/u);
  });

  it('closes bounded grants only on accepted transitions and on their semantic invalidation', () => {
    const nextState = stateWithSearch();
    const nextBound = bindOnlineVisibilityV1({ state: nextState, participantId: 'host', envelope: look(0, { kind: 'next-command' }) as never, projection: projectOnlineVariableProtocolV3(nextState, 'host') });
    const nextOpened = Core.applyCoreCommandV1(nextState.coreRoot, nextBound.command);
    expect(nextOpened.status).toBe('accepted');
    if (nextOpened.status !== 'accepted') return;
    const rejectedCommand = coreTestCommand(nextOpened.root, 'P1', { kind: 'priority-pass', playerId: 'P2' as never });
    const rejected = Core.applyCoreCommandV1(nextOpened.root, rejectedCommand);
    expect(rejected.status).toBe('rejected');
    expect(rejected.root.ruleAuthority.visibility.grantOrder).toEqual(nextOpened.root.ruleAuthority.visibility.grantOrder);
    const acceptedCommand = coreTestCommand(nextOpened.root, 'P1', { kind: 'table-note-set', noteId: 'accepted-after-look', text: 'accepted', manualMode: 'structured' });
    const accepted = Core.applyCoreCommandV1(nextOpened.root, acceptedCommand);
    expect(accepted.status).toBe('accepted');
    if (accepted.status === 'accepted') {
      expect(accepted.root.ruleAuthority.visibility.grantOrder).toEqual([]);
      const journal = Core.appendCoreCommandJournalEntryV1([], nextBound.command, nextOpened);
      const withRejected = Core.appendCoreCommandJournalEntryV1(journal, rejectedCommand, rejected);
      const completeJournal = Core.appendCoreCommandJournalEntryV1(withRejected, acceptedCommand, accepted);
      const replay = Core.replayCoreCommandsFromRootV1(nextState.coreRoot, completeJournal);
      expect(replay.ok).toBe(true);
      if (replay.ok) expect(replay.finalStateDigest).toBe(accepted.afterStateDigest);
    }

    const choiceState = stateWithSearch();
    const choiceBound = bindOnlineVisibilityV1({ state: choiceState, participantId: 'host', envelope: look(0, { kind: 'choice-bound', searchSessionId: onlineProjectedSearchSessionHandleV1('search-1', 0) }) as never, projection: projectOnlineVariableProtocolV3(choiceState, 'host') });
    const choiceOpened = Core.applyCoreCommandV1(choiceState.coreRoot, choiceBound.command);
    expect(choiceOpened.status).toBe('accepted');
    if (choiceOpened.status !== 'accepted') return;
    const completed = Core.applyCoreCommandV1(choiceOpened.root, coreTestCommand(choiceOpened.root, 'P1', { kind: 'search-complete', sessionKey: 'search-1', selectedObjectIds: ['PC1:0' as never] }, { kind: 'search-session', searchSessionId: 'search-1' }));
    expect(completed.status).toBe('accepted');
    if (completed.status === 'accepted') expect(completed.root.ruleAuthority.visibility.grantOrder).toEqual([]);

    const sourceState = stateWithSearch();
    const sourceEnvelope = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'source-close-command', baseRevision: 0,
      look: { subject: { kind: 'object', handle: 'PC2:0' }, viewerPlayerIds: ['P1'], duration: { kind: 'source-bound', sourceHandle: 'PC5:1' } },
    };
    const sourceBound = bindOnlineVisibilityV1({ state: sourceState, participantId: 'host', envelope: sourceEnvelope as never, projection: projectOnlineVariableProtocolV3(sourceState, 'host') });
    const sourceOpened = Core.applyCoreCommandV1(sourceState.coreRoot, sourceBound.command);
    expect(sourceOpened.status).toBe('accepted');
    if (sourceOpened.status !== 'accepted') return;
    const moved = Core.applyCoreCommandV1(sourceOpened.root, coreTestCommand(sourceOpened.root, 'P1', { kind: 'table-zone-move', objectId: 'PC5:1' as never, destination: { kind: 'owner-graveyard' }, manualMode: 'structured' }));
    expect(moved.status).toBe('accepted');
    if (moved.status === 'accepted') expect(moved.root.ruleAuthority.visibility.grantOrder).toEqual([]);

    const topState = stateWithoutSearch();
    const topBound = bindOnlineVisibilityV1({ state: topState, participantId: 'host', envelope: look(0, { kind: 'end-of-turn' }) as never, projection: projectOnlineVariableProtocolV3(topState, 'host') });
    const topOpened = Core.applyCoreCommandV1(topState.coreRoot, topBound.command);
    expect(topOpened.status).toBe('accepted');
    if (topOpened.status !== 'accepted') return;
    const drawn = Core.applyCoreCommandV1(topOpened.root, coreTestCommand(topOpened.root, 'P1', { kind: 'table-draw', count: 1, manualMode: 'structured' }));
    expect(drawn.status).toBe('accepted');
    if (drawn.status === 'accepted') expect(drawn.root.ruleAuthority.visibility.grantOrder).toEqual([]);

    const audienceState = stateWithoutSearch();
    const audienceEnvelope = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'audience-exit-command', baseRevision: 0,
      look: { subject: { kind: 'object', handle: 'PC2:0' }, viewerPlayerIds: ['P1', 'P4'], duration: { kind: 'end-of-turn' } },
    };
    const audienceBound = bindOnlineVisibilityV1({ state: audienceState, participantId: 'host', envelope: audienceEnvelope as never, projection: projectOnlineVariableProtocolV3(audienceState, 'host') });
    const audienceOpened = Core.applyCoreCommandV1(audienceState.coreRoot, audienceBound.command);
    expect(audienceOpened.status).toBe('accepted');
    if (audienceOpened.status !== 'accepted') return;
    const audienceExit = Core.applyCoreCommandV1(audienceOpened.root, coreTestCommand(audienceOpened.root, 'P4', { kind: 'player-exit', playerId: 'P4' as never, cause: 'concession' }));
    expect(audienceExit.status).toBe('accepted');
    if (audienceExit.status === 'accepted') expect(audienceExit.root.ruleAuthority.visibility.grantOrder).toEqual([]);

    const subjectState = stateWithoutSearch();
    const subjectEnvelope = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'subject-exit-command', baseRevision: 0,
      look: { subject: { kind: 'object', handle: 'PC2:0' }, viewerPlayerIds: ['P1'], duration: { kind: 'end-of-turn' } },
    };
    const subjectBound = bindOnlineVisibilityV1({ state: subjectState, participantId: 'host', envelope: subjectEnvelope as never, projection: projectOnlineVariableProtocolV3(subjectState, 'host') });
    const subjectOpened = Core.applyCoreCommandV1(subjectState.coreRoot, subjectBound.command);
    expect(subjectOpened.status).toBe('accepted');
    if (subjectOpened.status !== 'accepted') return;
    const subjectExit = Core.applyCoreCommandV1(subjectOpened.root, coreTestCommand(subjectOpened.root, 'P1', { kind: 'player-exit', playerId: 'P1' as never, cause: 'concession' }));
    expect(subjectExit.status).toBe('accepted');
    if (subjectExit.status === 'accepted') expect(subjectExit.root.ruleAuthority.visibility.grantOrder).toEqual([]);
  }, 30000);

  it('closes a top-prefix grant when a server-recorded reorder changes the prefix', () => {
    const state = stateWithoutSearchWithTwoLibraryCards();
    const projection = projectOnlineVariableProtocolV3(state, 'host');
    const envelope = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'top-reorder-command', baseRevision: 0,
      look: { subject: { kind: 'top-of-library', count: 2 }, viewerPlayerIds: ['P1'], duration: { kind: 'end-of-turn' } },
    };
    const bound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: envelope as never, projection });
    const opened = Core.applyCoreCommandV1(state.coreRoot, bound.command);
    expect(opened.status).toBe('accepted');
    if (opened.status !== 'accepted') return;
    const reordered = Core.applyCoreCommandV1(opened.root, coreTestCommand(opened.root, 'P1', {
      kind: 'random-zone-order', randomDecisionId: 'recorded-shuffle',
      zone: { kind: 'player-zone', playerId: 'P1' as never, zone: 'library' },
      beforeOrder: ['PC1:0' as never, 'PC7:0' as never], afterOrder: ['PC7:0' as never, 'PC1:0' as never], manualMode: 'structured',
    }));
    expect(reordered.status).toBe('accepted');
    if (reordered.status !== 'accepted') return;
    expect(reordered.root.ruleAuthority.visibility.grantOrder).toEqual([]);
    const closed = reordered.events.filter((event) => event.payload.kind === 'visibility-closed');
    expect(closed).toHaveLength(1);
    expect(closed[0]?.payload).toMatchObject({ reason: 'automatic' });
  });

  it('closes a top-library grant when an accepted reorder preserves the prefix IDs', () => {
    const state = stateWithoutSearchWithTwoLibraryCards();
    const projection = projectOnlineVariableProtocolV3(state, 'host');
    const envelope = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: 'top-same-prefix-command', baseRevision: 0,
      look: { subject: { kind: 'top-of-library', count: 1 }, viewerPlayerIds: ['P1'], duration: { kind: 'end-of-turn' } },
    };
    const bound = bindOnlineVisibilityV1({ state, participantId: 'host', envelope: envelope as never, projection });
    const opened = Core.applyCoreCommandV1(state.coreRoot, bound.command);
    expect(opened.status).toBe('accepted');
    if (opened.status !== 'accepted') return;
    const reordered = Core.applyCoreCommandV1(opened.root, coreTestCommand(opened.root, 'P1', {
      kind: 'random-zone-order', randomDecisionId: 'recorded-same-order',
      zone: { kind: 'player-zone', playerId: 'P1' as never, zone: 'library' },
      beforeOrder: ['PC1:0' as never, 'PC7:0' as never], afterOrder: ['PC1:0' as never, 'PC7:0' as never], manualMode: 'structured',
    }));
    expect(reordered.status).toBe('accepted');
    if (reordered.status !== 'accepted') return;
    expect(reordered.root.ruleAuthority.visibility.grantOrder).toEqual([]);
    expect(reordered.events.filter((event) => event.payload.kind === 'visibility-closed')).toHaveLength(1);
  });
});
