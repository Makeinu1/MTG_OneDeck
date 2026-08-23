import type { CorePlayerId } from '../../engine/core/index';
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
