import type { CoreObjectId, CorePlayerId } from '../../engine/core/index';
import { isCoreUndoAuthorizedPlayerV1 } from '../../engine/core/index';
import { currentCoreObjectControllerV1 } from '../../engine/core/rules/controlEffectV1';
import { constructParticipantProjectionV1, constructParticipantProjectionV2 } from './project';
import type { OnlineProjectionRequestV1 } from './types';
import type { OnlineProtocolStateV1 } from '../protocol/index';
import type { OnlineRoomParticipantV1 } from '../room/index';
import { validateOnlineVariableProtocolStateV2, type OnlineVariableProtocolStateV2 } from '../protocol/index';
import { onlineProjectedSearchSessionHandleV1 } from '../visibilityDecisions/sessionHandle';

export const ONLINE_PROJECTION_SCHEMA_VERSION_V2 = 2 as const;
export type OnlineVariableParticipantProjectionV2 = Readonly<{
  readonly kind: 'online-participant-projection-v2';
  readonly schemaVersion: typeof ONLINE_PROJECTION_SCHEMA_VERSION_V2;
  readonly protocolVersion: number;
  readonly roomId: string;
  readonly participantId: string;
  readonly revision: number;
  readonly configuration: OnlineVariableProtocolStateV2['configuration'];
  readonly room: Readonly<{ readonly lifecycle: OnlineVariableProtocolStateV2['room']['lifecycle']; readonly hostParticipantId: string; readonly participants: readonly Readonly<{ readonly participantId: string; readonly role: 'player' | 'table' | 'spectator'; readonly presence: 'connected' | 'disconnected'; readonly seatIndex: number | null }>[]; readonly seats: readonly Readonly<{ readonly seatIndex: number; readonly corePlayerId: CorePlayerId; readonly participantId: string | null; readonly acceptedDeck: boolean; readonly ready: boolean; readonly outcome: 'pending' | 'conceded' | 'defeated' }>[] }>;
  readonly game: Readonly<{ readonly turnOrder: readonly CorePlayerId[]; readonly players: readonly Readonly<{ readonly playerId: CorePlayerId; readonly life: number; readonly poison: number; readonly zones: Readonly<{ readonly library: number; readonly hand: number; readonly graveyard: number }> }>[] }>;
}>;

function fail(message: string): never { throw new Error(message); }
export function projectOnlineVariableProtocolV2(stateInput: unknown, participantId: string): OnlineVariableParticipantProjectionV2 {
  const checked = validateOnlineVariableProtocolStateV2(stateInput); if (!checked.ok) fail('Invalid variable protocol state');
  const state = checked.value;
  const authorized = state.room.participants.some((entry) => entry.participantId === participantId)
    || state.observerAuthorizations.some((entry) => entry.participantId === participantId);
  if (!authorized) fail('Participant not found');
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const players = state.coreRoot.playerLifecycle.players.map((entry) => {
    const counters = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players[entry.playerId];
    const zones = registry.zones.byPlayer[entry.playerId];
    const life = counters?.life ?? 0;
    return Object.freeze({ playerId: entry.playerId, life, poison: counters?.poison ?? 0, zones: Object.freeze({ library: zones?.library.length ?? 0, hand: zones?.hand.length ?? 0, graveyard: zones?.graveyard.length ?? 0 }) });
  });
  return Object.freeze({ kind: 'online-participant-projection-v2', schemaVersion: 2, protocolVersion: state.protocolVersion, roomId: state.room.roomId, participantId, revision: state.revision, configuration: state.configuration, room: Object.freeze({ lifecycle: state.room.lifecycle, hostParticipantId: state.room.hostParticipantId, participants: Object.freeze(state.room.participants.map((entry) => Object.freeze({ participantId: entry.participantId, role: entry.role, presence: entry.presence, seatIndex: entry.seatIndex }))), seats: Object.freeze(state.room.seats.map((seat) => Object.freeze({ seatIndex: seat.seatIndex, corePlayerId: seat.corePlayerId, participantId: seat.participantId, acceptedDeck: seat.acceptedDeck, ready: seat.ready, outcome: seat.outcome }))) }), game: Object.freeze({ turnOrder: Object.freeze([...registry.turnOrder]), players: Object.freeze(players) }) });
}

export const projectOnlineVariableRoomV2 = projectOnlineVariableProtocolV2;
export type OnlineParticipantProjectionV2 = OnlineVariableParticipantProjectionV2;

/**
 * Full variable-roster projection.  This is intentionally additive to the
 * compact v2 projection above: v2 remains the wire used by the O4P-08C
 * compatibility lane while v3 carries the complete browser game surface.
 */
export const ONLINE_PROJECTION_SCHEMA_VERSION_V3 = 3 as const;
/** Version 4 carries the shared assisted-priority/HOLD projection fields. */
export const ONLINE_PROJECTION_SCHEMA_VERSION_V4 = 4 as const;
/** Secret-safe controller seat carried only on concealed battlefield entries. */
export type OnlineProjectedConcealedBattlefieldObjectV4 = Readonly<{
  readonly kind: 'concealed-object';
  readonly objectId: CoreObjectId;
  readonly objectKind: string;
  readonly runtime: Readonly<Record<string, unknown>>;
  readonly controllerPlayerId: CorePlayerId | null;
}>;
/** Causal context for the current public stack boundary. */
export type OnlineProjectedAssistedPriorityV4 = Readonly<{
  readonly holderPlayerId: CorePlayerId | null;
  readonly stewardPlayerId: CorePlayerId | null;
  readonly windowKind: string;
  readonly holds: readonly CorePlayerId[];
  readonly responseWindow: string | null;
  readonly topStackObjectId: CoreObjectId | null;
  readonly sourceObjectId: CoreObjectId | null;
  readonly targetObjectIds: readonly CoreObjectId[];
  readonly targetPlayerIds: readonly CorePlayerId[];
  readonly undoAuthorizedPlayerId: CorePlayerId | null;
  readonly recentResolution: Readonly<{
    readonly objectId: CoreObjectId | null;
    readonly destination: 'battlefield' | 'owner-graveyard' | 'cease' | 'manual';
    readonly acceptedRevision: number;
  }> | null;
}>;
export type OnlineVariableParticipantProjectionV3 = Readonly<{
  readonly kind: 'online-participant-projection-v3';
  readonly schemaVersion: typeof ONLINE_PROJECTION_SCHEMA_VERSION_V3;
  readonly protocolVersion: number;
  readonly roomId: string;
  readonly participantId: string;
  readonly role: 'player' | 'table' | 'spectator';
  readonly corePlayerId: CorePlayerId | null;
  readonly revision: number;
  readonly configuration: OnlineVariableProtocolStateV2['configuration'];
  readonly room: Readonly<{
    readonly lifecycle: OnlineVariableProtocolStateV2['room']['lifecycle'];
    readonly hostParticipantId: string;
    readonly participants: readonly Readonly<{
      readonly participantId: string;
      readonly role: 'player' | 'table' | 'spectator';
      readonly presence: 'connected' | 'disconnected';
      readonly seatIndex: number | null;
    }>[];
    readonly seats: readonly Readonly<{
      readonly seatIndex: number;
      readonly corePlayerId: CorePlayerId;
      readonly participantId: string | null;
      readonly acceptedDeck: boolean;
      readonly ready: boolean;
      readonly outcome: 'pending' | 'conceded' | 'defeated';
    }>[];
  }>;
  readonly game: OnlineVariableParticipantProjectionV3Game;
}>;
export type OnlineVariableParticipantProjectionV4 = Readonly<Omit<OnlineVariableParticipantProjectionV3, 'kind' | 'schemaVersion' | 'game'> & {
  readonly kind: 'online-participant-projection-v4';
  readonly schemaVersion: typeof ONLINE_PROJECTION_SCHEMA_VERSION_V4;
  readonly game: OnlineVariableParticipantProjectionV3['game'] & {
    readonly priorityHolds: readonly Readonly<{ readonly playerId: CorePlayerId; readonly setRevision: number }>[];
    readonly assistedPriority: OnlineProjectedAssistedPriorityV4;
  };
}>;

/** The game payload is the established v1 game projection, shared verbatim. */
export type OnlineVariableParticipantProjectionV3Game = Readonly<{
  readonly turnOrder: readonly CorePlayerId[];
  readonly turn: Readonly<Record<string, unknown>>;
  readonly players: readonly Readonly<Record<string, unknown>>[];
  readonly zones: Readonly<Record<string, unknown>>;
  readonly visibilityGrants: readonly Readonly<Record<string, unknown>>[];
  readonly searchSessions: readonly Readonly<Record<string, unknown>>[];
  readonly searchResults?: readonly Readonly<Record<string, unknown>>[];
  readonly playPermissions: readonly Readonly<Record<string, unknown>>[];
}>;

type V2State = OnlineVariableProtocolStateV2;

function stateAsV1(state: V2State): OnlineProtocolStateV1 {
  const room = state.room;
  const roomV1 = {
    kind: 'online-room-v1' as const,
    schemaVersion: 1 as const,
    roomId: room.roomId,
    lifecycle: room.lifecycle,
    hostParticipantId: room.hostParticipantId,
    participants: room.participants.map((entry) => ({
      participantId: entry.participantId,
      role: entry.role,
      presence: entry.presence,
      seatIndex: entry.seatIndex,
    })),
    seats: room.seats.map((seat) => ({
      seatIndex: seat.seatIndex,
      corePlayerId: seat.corePlayerId,
      seatCapability: seat.seatCapability,
      participantId: seat.participantId,
      ready: seat.ready,
      outcome: seat.outcome,
    })),
  };
  return {
    kind: 'online-protocol-state-v1',
    schemaVersion: 1,
    protocolVersion: state.protocolVersion,
    serverBuildId: state.serverBuildId,
    room: roomV1,
    coreRoot: state.coreRoot,
    revision: state.revision,
    observerAuthorizations: state.observerAuthorizations.map((entry) => ({
      participantId: entry.participantId,
      observerCapability: entry.observerCapability,
    })),
    receipts: [],
  } as unknown as OnlineProtocolStateV1;
}

function participantFor(state: V2State, participantId: string): OnlineRoomParticipantV1 {
  const player = state.room.participants.find((entry) => entry.participantId === participantId);
  if (player !== undefined) return player as OnlineRoomParticipantV1;
  if (state.observerAuthorizations.some((entry) => entry.participantId === participantId)) {
    return { participantId: participantId as OnlineRoomParticipantV1['participantId'], role: 'table', presence: 'connected', seatIndex: null };
  }
  fail('Participant not found');
}

function searchResults(state: V2State): readonly Readonly<Record<string, unknown>>[] {
  const results: Readonly<Record<string, unknown>>[] = [];
  for (const receipt of state.receipts) {
    const completion = receipt.completion;
    if (completion === undefined) continue;
    results.push(Object.freeze({
      sessionId: onlineProjectedSearchSessionHandleV1(completion.sessionKey, receipt.acceptedRevision),
      selectedCount: completion.selectedCount,
      revealFound: completion.revealFound,
      ...(completion.revealFound ? { selectedObjectIds: Object.freeze(completion.selectedObjectIds.slice()) } : {}),
    }));
  }
  return Object.freeze(results);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function publicSharedObjectIds(state: V2State): ReadonlySet<CoreObjectId> {
  const shared = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.shared;
  return new Set<CoreObjectId>([
    ...shared.battlefield,
    ...shared.stack,
    ...shared.exile,
    ...shared.command,
  ]);
}

function concealedBattlefieldController(
  state: V2State,
  objectId: CoreObjectId,
): CorePlayerId | null {
  const identity = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.objects[objectId];
  if (identity === undefined || (identity.kind !== 'card' && identity.kind !== 'token')) return null;
  return currentCoreObjectControllerV1(
    state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry,
    state.coreRoot.ruleAuthority.control,
    objectId,
  );
}

function projectV4BattlefieldControllers(
  state: V2State,
  game: OnlineVariableParticipantProjectionV3Game,
): OnlineVariableParticipantProjectionV3Game {
  if (!record(game.zones)) return game;
  const battlefield = game.zones.battlefield;
  if (!record(battlefield) || !unknownArray(battlefield.entries)) return game;
  const entries = battlefield.entries.map((entry: unknown) => {
    if (!record(entry) || entry.kind !== 'concealed-object' || typeof entry.objectId !== 'string') return entry;
    return Object.freeze({
      ...entry,
      controllerPlayerId: concealedBattlefieldController(state, entry.objectId as CoreObjectId),
    });
  });
  return Object.freeze({
    ...game,
    zones: Object.freeze({
      ...game.zones,
      battlefield: Object.freeze({ ...battlefield, entries: Object.freeze(entries) }),
    }),
  });
}

function causalAssistedPriority(
  state: V2State,
  assistedPriority: Readonly<Record<string, unknown>>,
  undoAuthorizedPlayerId: CorePlayerId | null,
): OnlineProjectedAssistedPriorityV4 {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const topStackObjectId = assistedPriority.topStackObjectId === null || typeof assistedPriority.topStackObjectId !== 'string'
    ? null
    : assistedPriority.topStackObjectId as CoreObjectId;
  const publicIds = publicSharedObjectIds(state);
  const identity = topStackObjectId === null ? undefined : registry.objects[topStackObjectId];
  let sourceObjectId: CoreObjectId | null = null;
  if (identity?.kind === 'activated-ability' || identity?.kind === 'triggered-ability') sourceObjectId = identity.sourceObjectId;
  else if (identity?.kind === 'spell-copy') sourceObjectId = identity.copiedFromObjectId;
  else if (topStackObjectId !== null) sourceObjectId = topStackObjectId;
  if (sourceObjectId !== null && !publicIds.has(sourceObjectId)) sourceObjectId = null;

  const targetObjectIds: CoreObjectId[] = [];
  const targetPlayerIds: CorePlayerId[] = [];
  const announcement = topStackObjectId === null ? undefined : state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.stackAnnouncements.byObject[topStackObjectId];
  for (const selection of announcement?.targetSelections ?? []) {
    const target = selection.target;
    if (target.kind === 'object') {
      if (publicIds.has(target.objectId) && !targetObjectIds.includes(target.objectId) && targetObjectIds.length < 8) targetObjectIds.push(target.objectId);
    } else if (registry.turnOrder.includes(target.playerId) && !targetPlayerIds.includes(target.playerId) && targetPlayerIds.length < 4) {
      targetPlayerIds.push(target.playerId);
    }
  }
  return Object.freeze({
    holderPlayerId: assistedPriority.holderPlayerId as CorePlayerId | null,
    stewardPlayerId: assistedPriority.stewardPlayerId as CorePlayerId | null,
    windowKind: String(assistedPriority.windowKind),
    holds: Object.freeze(Array.isArray(assistedPriority.holds) ? assistedPriority.holds.slice() as CorePlayerId[] : []),
    responseWindow: assistedPriority.responseWindow as string | null,
    topStackObjectId,
    sourceObjectId,
    targetObjectIds: Object.freeze(targetObjectIds),
    targetPlayerIds: Object.freeze(targetPlayerIds),
    undoAuthorizedPlayerId,
    recentResolution: state.coreRoot.tabletopManual?.recentResolution ?? null,
  });
}

/** Construct the full variable projection while preserving the v1 game facts. */
export function projectOnlineVariableProtocolV3(stateInput: unknown, participantId: string): OnlineVariableParticipantProjectionV3 {
  const checked = validateOnlineVariableProtocolStateV2(stateInput);
  if (!checked.ok) fail('Invalid variable protocol state');
  const state = checked.value;
  const participant = participantFor(state, participantId);
  const request: OnlineProjectionRequestV1 = {
    kind: 'online-projection-request-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId as OnlineProjectionRequestV1['roomId'],
    participantId: participantId as OnlineProjectionRequestV1['participantId'],
    participantCapability: (participant.role === 'player'
      ? state.room.seats[participant.seatIndex]?.seatCapability
      : state.observerAuthorizations.find((entry) => entry.participantId === participantId)?.observerCapability) as OnlineProjectionRequestV1['participantCapability'],
    knownRevision: state.revision,
    clientBuildId: state.serverBuildId,
    decisionContext: null,
  };
  const base = constructParticipantProjectionV1(stateAsV1(state), request, participant);
  // The v1 constructor retains authoritative Core keys for its legacy
  // protocol.  The production variable projection is the E authority
  // boundary, so replace every search-session/result identifier with the
  // deterministic opaque handle before it can reach a client.
  const projectedSearchSessions = Object.freeze(base.game.searchSessions.map((entry) => {
    const sessionId = entry.sessionId;
    return typeof sessionId !== 'string'
      ? entry
      : Object.freeze({ ...entry, sessionId: onlineProjectedSearchSessionHandleV1(sessionId, state.revision) });
  }));
  return Object.freeze({
    kind: 'online-participant-projection-v3',
    schemaVersion: ONLINE_PROJECTION_SCHEMA_VERSION_V3,
    protocolVersion: base.protocolVersion,
    roomId: base.roomId,
    participantId: base.participantId,
    role: base.role,
    corePlayerId: base.corePlayerId,
    revision: base.revision,
    configuration: state.configuration,
    room: Object.freeze({
      lifecycle: base.room.lifecycle,
      hostParticipantId: base.room.hostParticipantId,
      participants: Object.freeze([
        ...base.room.participants,
        ...state.observerAuthorizations.map((entry) => Object.freeze({
          participantId: entry.participantId,
          role: 'table' as const,
          presence: 'connected' as const,
          seatIndex: null,
        })),
      ]),
      seats: Object.freeze(state.room.seats.map((seat) => Object.freeze({
        seatIndex: seat.seatIndex,
        corePlayerId: seat.corePlayerId,
        participantId: seat.participantId,
        acceptedDeck: seat.acceptedDeck,
        ready: seat.ready,
        outcome: seat.outcome,
      }))),
    }),
    game: Object.freeze({ ...base.game, searchSessions: projectedSearchSessions, searchResults: searchResults(state) }),
  });
}

/** Current variable projection wire. It upgrades the legacy v3 envelope with
 * a versioned, exact assisted-priority projection while retaining the same
 * room/zone redaction rules and opaque search handles. */
export function projectOnlineVariableProtocolV4(stateInput: unknown, participantId: string): OnlineVariableParticipantProjectionV4 {
  const checked = validateOnlineVariableProtocolStateV2(stateInput);
  if (!checked.ok) fail('Invalid variable protocol state');
  const legacy = projectOnlineVariableProtocolV3(checked.value, participantId);
  const participant = participantFor(checked.value, participantId);
  const request: OnlineProjectionRequestV1 = {
    kind: 'online-projection-request-v1',
    protocolVersion: checked.value.protocolVersion,
    roomId: checked.value.room.roomId as OnlineProjectionRequestV1['roomId'],
    participantId: participantId as OnlineProjectionRequestV1['participantId'],
    participantCapability: (participant.role === 'player'
      ? checked.value.room.seats[participant.seatIndex]?.seatCapability
      : checked.value.observerAuthorizations.find((entry) => entry.participantId === participantId)?.observerCapability) as OnlineProjectionRequestV1['participantCapability'],
    knownRevision: checked.value.revision,
    clientBuildId: checked.value.serverBuildId,
    decisionContext: null,
  };
  const base = constructParticipantProjectionV2(stateAsV1(checked.value), request, participant);
  const projectedGame = projectV4BattlefieldControllers(checked.value, legacy.game);
  const viewerPlayerId = participant.role === 'player' && participant.seatIndex !== null
    ? checked.value.room.seats[participant.seatIndex]?.corePlayerId ?? null
    : null;
  const undoAuthorizedPlayerId = viewerPlayerId !== null && isCoreUndoAuthorizedPlayerV1(checked.value.coreRoot, viewerPlayerId)
    ? viewerPlayerId
    : null;
  const enrichedGame = Object.freeze({
    ...projectedGame,
    priorityHolds: base.game.priorityHolds,
    assistedPriority: causalAssistedPriority(checked.value, base.game.assistedPriority as Readonly<Record<string, unknown>>, undoAuthorizedPlayerId),
  });
  return Object.freeze({ ...legacy, kind: 'online-participant-projection-v4', schemaVersion: ONLINE_PROJECTION_SCHEMA_VERSION_V4, game: enrichedGame });
}

export const projectOnlineVariableRoomV3 = projectOnlineVariableProtocolV3;
export const projectOnlineVariableRoomV4 = projectOnlineVariableProtocolV4;
export type OnlineParticipantProjectionV3 = OnlineVariableParticipantProjectionV3;
export type OnlineParticipantProjectionV4 = OnlineVariableParticipantProjectionV4;
// Full-generation validation is exported from validation.ts as
// validateOnlineParticipantProjectionV3; it remains separate from this
// constructor so the v1/v2 wire literals stay immutable.
