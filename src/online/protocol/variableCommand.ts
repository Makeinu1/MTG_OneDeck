import {
  applyCoreCommandV1,
  coreCanonicalDigestFromValueV1,
} from '../../engine/core/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import { validateOnlineVariableRoomV2 } from '../room/variable';
import {
  inspectGraphForConfiguredCapability,
  protocolIssue,
} from './support';
import type {
  OnlineCommandAckV1,
  OnlineCommandEnvelopeV1,
  OnlineCommandRejectV1,
  OnlineProtocolIssueCodeV1,
} from './types';
import { validateOnlineCommandEnvelopeV1 } from './validation';
import {
  validateOnlineVariableProtocolStateV2,
  type OnlineVariableProtocolStateV2,
} from './variable';

export type OnlineVariableCommandTransitionV2 = Readonly<{
  readonly state: OnlineVariableProtocolStateV2;
  readonly response: OnlineCommandAckV1 | OnlineCommandRejectV1;
}>;

function requestDigest(message: OnlineCommandEnvelopeV1): string {
  return coreCanonicalDigestFromValueV1({
    kind: message.kind,
    protocolVersion: message.protocolVersion,
    roomId: message.roomId,
    participantId: message.participantId,
    commandId: message.commandId,
    baseRevision: message.baseRevision,
    command: message.command,
  });
}

function reject(
  state: OnlineVariableProtocolStateV2,
  code: OnlineProtocolIssueCodeV1,
  message: string,
  envelope: OnlineCommandEnvelopeV1 | null = null,
  resyncRequired = false,
): OnlineVariableCommandTransitionV2 {
  const response: OnlineCommandRejectV1 = Object.freeze({
    kind: 'online-command-reject-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: envelope?.roomId ?? null,
    participantId: envelope?.participantId ?? null,
    commandId: envelope?.commandId ?? null,
    baseRevision: envelope?.baseRevision ?? null,
    currentRevision: state.revision,
    duplicate: false,
    resyncRequired,
    issues: Object.freeze([protocolIssue(code, '', message)]),
  });
  return Object.freeze({ state, response });
}

function outcome(status: string, exitCause: string | null): 'pending' | 'conceded' | 'defeated' {
  if (status === 'active') return 'pending';
  return exitCause === 'concession' ? 'conceded' : 'defeated';
}

export function handleOnlineVariableCommandEnvelopeV2(
  stateInput: unknown,
  messageInput: unknown,
): OnlineVariableCommandTransitionV2 {
  const checked = validateOnlineVariableProtocolStateV2(stateInput);
  if (!checked.ok) throw new Error('Invalid variable protocol state');
  const state = checked.value;
  const messageResult = validateOnlineCommandEnvelopeV1(messageInput);
  if (!messageResult.ok) return reject(state, 'INVALID_PROTOCOL_STATE', 'Invalid command envelope');
  const message = messageResult.value;
  if (message.roomId !== state.room.roomId) return reject(state, 'ROOM_MISMATCH', 'Room mismatch', message);
  const participant = state.room.participants.find((entry) => entry.participantId === message.participantId);
  const seat = participant === undefined || participant.role !== 'player' || participant.seatIndex === null
    ? undefined
    : state.room.seats[participant.seatIndex];
  if (seat === undefined || seat.seatCapability !== message.participantCapability) return reject(state, 'AUTHORIZATION_REJECTED', 'Authorization rejected', message);
  const capabilities = [...state.room.seats.map((entry) => entry.seatCapability), ...state.observerAuthorizations.map((entry) => entry.observerCapability)];
  const inspection = inspectGraphForConfiguredCapability(message.command, capabilities);
  if (inspection !== 'clear') return reject(state, inspection === 'contains-configured-capability' ? 'INVALID_CAPABILITY' : 'INVALID_DESCRIPTOR', 'Command contains invalid protocol data', message);
  const digest = requestDigest(message);
  const existing = state.receipts.find((entry) => entry.participantId === message.participantId && entry.commandId === message.commandId);
  if (existing !== undefined) {
    if (existing.requestDigest !== digest) return reject(state, 'COMMAND_ID_REUSE_MISMATCH', 'Command ID reuse mismatch', message);
    return Object.freeze({ state, response: Object.freeze({ kind: 'online-command-ack-v1', protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: message.roomId, participantId: message.participantId, commandId: message.commandId, baseRevision: existing.acceptedRevision - 1, acceptedRevision: existing.acceptedRevision, currentRevision: state.revision, status: existing.status, duplicate: true }) });
  }
  if (state.room.lifecycle !== 'active') return reject(state, 'ROOM_NOT_ACTIVE', 'Room is not active', message);
  if (seat.outcome !== 'pending') return reject(state, 'PLAYER_NOT_PENDING', 'Player is not pending', message);
  if (message.command.actorPlayerId !== seat.corePlayerId) return reject(state, 'ACTOR_MISMATCH', 'Actor does not match seat', message);
  if (message.command.sequence !== message.baseRevision + 1) return reject(state, 'COMMAND_SEQUENCE_MISMATCH', 'Command sequence mismatch', message);
  if (message.baseRevision !== state.revision) return reject(state, 'STALE_REVISION', 'Stale revision', message, true);
  const coreResult = applyCoreCommandV1(state.coreRoot, message.command);
  if (coreResult.status === 'rejected') return reject(state, 'CORE_COMMAND_REJECTED', 'Core command rejected', message);
  const lifecycle = coreResult.root.playerLifecycle.players;
  const seats = state.room.seats.map((entry) => {
    const player = lifecycle.find((candidate) => candidate.playerId === entry.corePlayerId);
    if (player === undefined) throw new Error('Variable Core roster mismatch');
    return Object.freeze({ ...entry, outcome: outcome(player.status, player.exitCause) });
  });
  const activeCount = lifecycle.filter((entry) => entry.status === 'active').length;
  const roomResult = validateOnlineVariableRoomV2({ ...state.room, seats, lifecycle: activeCount <= 1 ? 'finished' : 'active' });
  if (!roomResult.ok) return reject(state, 'CORE_RECONCILIATION_REJECTED', 'Core reconciliation rejected', message);
  const nextCandidate = {
    ...state,
    room: roomResult.value,
    coreRoot: coreResult.root,
    revision: coreResult.root.acceptedCommandCount,
    receipts: [...state.receipts, Object.freeze({ participantId: message.participantId, commandId: message.commandId, requestDigest: digest, acceptedRevision: coreResult.root.acceptedCommandCount, status: coreResult.status })],
  };
  const nextResult = validateOnlineVariableProtocolStateV2(nextCandidate);
  if (!nextResult.ok) return reject(state, 'CORE_RECONCILIATION_REJECTED', 'Protocol reconciliation rejected', message);
  const nextState = nextResult.value;
  return Object.freeze({ state: nextState, response: Object.freeze({ kind: 'online-command-ack-v1', protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: message.roomId, participantId: message.participantId, commandId: message.commandId, baseRevision: message.baseRevision, acceptedRevision: nextState.revision, currentRevision: nextState.revision, status: coreResult.status, duplicate: false }) });
}
