import {
  rejoinOnlineRoomPlayerV1,
  validateOnlineRoomV1,
  type OnlineRoomParticipantV1,
  type OnlineRoomV1,
} from '../room/index';
import { OnlineProtocolOperationErrorV1 } from './errors';
import { buildProtocolStateV1, protocolStateCapabilities, validateOnlineProtocolStateV1 } from './state';
import {
  containsConfiguredCapability,
  isDeeplyFrozenDescriptorSafe,
  isProtocolCapability,
  protocolIssue,
  readExactRecord,
} from './support';
import type {
  OnlineProtocolIssueV1,
  OnlineProtocolParticipantCapabilityV1,
  OnlineProtocolStateV1,
} from './types';

export type ProtocolAuthentication = Readonly<{
  readonly participant: OnlineRoomParticipantV1;
  readonly capability: OnlineProtocolParticipantCapabilityV1;
}>;

export function requireProtocolState(input: unknown): OnlineProtocolStateV1 {
  const result = validateOnlineProtocolStateV1(input);
  if (!result.ok) {
    throw new OnlineProtocolOperationErrorV1([
      protocolIssue('INVALID_PROTOCOL_STATE', '', 'Invalid protocol state'),
    ]);
  }
  return isDeeplyFrozenDescriptorSafe(input) ? (input as OnlineProtocolStateV1) : result.value;
}

export function authenticateProtocolParticipant(
  state: OnlineProtocolStateV1,
  roomId: string,
  participantId: string,
  participantCapability: OnlineProtocolParticipantCapabilityV1,
): ProtocolAuthentication | OnlineProtocolIssueV1 {
  if (roomId !== state.room.roomId) {
    return protocolIssue('ROOM_MISMATCH', '/roomId', 'Room does not match protocol state');
  }
  const participant = state.room.participants.find(
    (current) => current.participantId === participantId,
  );
  if (participant === undefined) {
    return protocolIssue(
      'AUTHORIZATION_REJECTED',
      '/participantCapability',
      'Participant authorization was rejected',
    );
  }
  const expected =
    participant.role === 'player'
      ? state.room.seats[participant.seatIndex]?.seatCapability
      : state.observerAuthorizations.find(
          (authorization) => authorization.participantId === participant.participantId,
        )?.observerCapability;
  if (expected === undefined || expected !== participantCapability) {
    return protocolIssue(
      'AUTHORIZATION_REJECTED',
      '/participantCapability',
      'Participant authorization was rejected',
    );
  }
  return Object.freeze({ participant, capability: participantCapability });
}

export function reconnectProtocolParticipant(
  state: OnlineProtocolStateV1,
  authentication: ProtocolAuthentication,
): Readonly<{ readonly state: OnlineProtocolStateV1; readonly rejoined: boolean }> | OnlineProtocolIssueV1 {
  const participant = authentication.participant;
  if (participant.presence === 'connected') {
    return Object.freeze({ state, rejoined: false });
  }
  let room: OnlineRoomV1;
  if (participant.role === 'player') {
    const seat = state.room.seats[participant.seatIndex];
    if (seat?.outcome !== 'pending') {
      return protocolIssue(
        'AUTHORIZATION_REJECTED',
        '/participantCapability',
        'Participant authorization was rejected',
      );
    }
    try {
      room = rejoinOnlineRoomPlayerV1(state.room, {
        participantId: participant.participantId,
        seatCapability: seat.seatCapability,
      });
    } catch {
      return protocolIssue(
        'AUTHORIZATION_REJECTED',
        '/participantCapability',
        'Participant authorization was rejected',
      );
    }
  } else {
    const participants = Object.freeze(
      state.room.participants.map((current) =>
        current.participantId === participant.participantId
          ? Object.freeze({
              participantId: current.participantId,
              role: current.role,
              presence: 'connected' as const,
              seatIndex: null,
            })
          : current,
      ),
    );
    const candidate = {
      kind: state.room.kind,
      schemaVersion: state.room.schemaVersion,
      roomId: state.room.roomId,
      lifecycle: state.room.lifecycle,
      hostParticipantId: state.room.hostParticipantId,
      participants,
      seats: state.room.seats,
    };
    const result = validateOnlineRoomV1(candidate);
    if (!result.ok) {
      throw new OnlineProtocolOperationErrorV1(
        [protocolIssue('INVALID_PROTOCOL_STATE', '/room', 'Observer reconnect failed')],
        protocolStateCapabilities(state),
      );
    }
    room = result.value;
  }
  return Object.freeze({
    state: buildProtocolStateV1(
      state.serverBuildId,
      room,
      state.coreRoot,
      state.observerAuthorizations,
      state.receipts,
    ),
    rejoined: true,
  });
}

export function selectProtocolVersionIssues(
  issues: readonly OnlineProtocolIssueV1[],
): readonly OnlineProtocolIssueV1[] {
  const mismatches = issues.filter((issue) => issue.code === 'PROTOCOL_VERSION_MISMATCH');
  return mismatches.length > 0 ? Object.freeze(mismatches) : issues;
}

export function safeRejectFields(
  input: unknown,
  configuredCapabilities: readonly string[],
): Readonly<{
  readonly roomId: string | null;
  readonly participantId: string | null;
  readonly commandId: string | null;
  readonly baseRevision: number | null;
}> {
  const ignored: OnlineProtocolIssueV1[] = [];
  const record = readExactRecord(
    input,
    [
      'kind',
      'protocolVersion',
      'roomId',
      'participantId',
      'participantCapability',
      'commandId',
      'baseRevision',
      'knownRevision',
      'clientBuildId',
      'command',
    ],
    '',
    ignored,
    [],
  );
  if (record === null) {
    return Object.freeze({ roomId: null, participantId: null, commandId: null, baseRevision: null });
  }
  const inputCapability = isProtocolCapability(record.participantCapability)
    ? record.participantCapability
    : null;
  const forbiddenCapabilities =
    inputCapability === null
      ? configuredCapabilities
      : Object.freeze([...configuredCapabilities, inputCapability]);
  const applicationId = (value: unknown): string | null =>
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value) &&
    !['__proto__', 'prototype', 'constructor'].includes(value) &&
    !containsConfiguredCapability(value, forbiddenCapabilities)
      ? value
      : null;
  const commandId = applicationId(record.commandId);
  const baseRevision =
    typeof record.baseRevision === 'number' &&
    Number.isSafeInteger(record.baseRevision) &&
    record.baseRevision >= 0
      ? record.baseRevision
      : null;
  return Object.freeze({
    roomId: applicationId(record.roomId),
    participantId: applicationId(record.participantId),
    commandId,
    baseRevision,
  });
}
