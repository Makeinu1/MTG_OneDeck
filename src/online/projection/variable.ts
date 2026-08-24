import type { CorePlayerId } from '../../engine/core/index';
import { constructParticipantProjectionV1 } from './project';
import type { OnlineProjectionRequestV1 } from './types';
import type { OnlineProtocolStateV1 } from '../protocol/index';
import type { OnlineRoomParticipantV1 } from '../room/index';
import { validateOnlineVariableProtocolStateV2, type OnlineVariableProtocolStateV2 } from '../protocol/index';

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

/** The game payload is the established v1 game projection, shared verbatim. */
export type OnlineVariableParticipantProjectionV3Game = Readonly<{
  readonly turnOrder: readonly CorePlayerId[];
  readonly turn: Readonly<Record<string, unknown>>;
  readonly players: readonly Readonly<Record<string, unknown>>[];
  readonly zones: Readonly<Record<string, unknown>>;
  readonly visibilityGrants: readonly Readonly<Record<string, unknown>>[];
  readonly searchSessions: readonly Readonly<Record<string, unknown>>[];
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
    game: base.game,
  });
}

export const projectOnlineVariableRoomV3 = projectOnlineVariableProtocolV3;
export type OnlineParticipantProjectionV3 = OnlineVariableParticipantProjectionV3;
// Full-generation validation is exported from validation.ts as
// validateOnlineParticipantProjectionV3; it remains separate from this
// constructor so the v1/v2 wire literals stay immutable.
