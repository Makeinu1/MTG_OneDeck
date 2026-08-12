import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import {
  authenticateProtocolParticipant,
  reconnectProtocolParticipant,
  requireProtocolState,
  safeRejectFields,
  selectProtocolVersionIssues,
} from './auth';
import { protocolStateCapabilities } from './state';
import { frozenTransition } from './support';
import type {
  OnlineCommandRejectV1,
  OnlineProtocolIssueV1,
  OnlineProtocolStateV1,
  OnlineSnapshotTransitionV1,
} from './types';
import { validateOnlineSnapshotRequestV1 } from './validation';

function rejectedSnapshot(
  state: OnlineProtocolStateV1,
  messageInput: unknown,
  issues: readonly OnlineProtocolIssueV1[],
): OnlineSnapshotTransitionV1 {
  const fields = safeRejectFields(messageInput, protocolStateCapabilities(state));
  const response: OnlineCommandRejectV1 = Object.freeze({
    kind: 'online-command-reject-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: fields.roomId as OnlineCommandRejectV1['roomId'],
    participantId: fields.participantId as OnlineCommandRejectV1['participantId'],
    commandId: null,
    baseRevision: null,
    currentRevision: state.revision,
    duplicate: false,
    resyncRequired: false,
    issues,
  });
  return frozenTransition(state, response);
}

export function handleOnlineSnapshotRequestV1(
  stateInput: unknown,
  messageInput: unknown,
): OnlineSnapshotTransitionV1 {
  const state = requireProtocolState(stateInput);
  const messageResult = validateOnlineSnapshotRequestV1(messageInput);
  if (!messageResult.ok) {
    return rejectedSnapshot(
      state,
      messageInput,
      selectProtocolVersionIssues(messageResult.issues),
    );
  }
  const message = messageResult.value;
  const authentication = authenticateProtocolParticipant(
    state,
    message.roomId,
    message.participantId,
    message.participantCapability,
  );
  if ('code' in authentication) {
    return rejectedSnapshot(state, messageInput, Object.freeze([authentication]));
  }
  const reconnect = reconnectProtocolParticipant(state, authentication);
  if ('code' in reconnect) {
    return rejectedSnapshot(state, messageInput, Object.freeze([reconnect]));
  }
  const projectionRequired = message.knownRevision !== reconnect.state.revision;
  const response = Object.freeze({
    kind: 'online-resync-v1' as const,
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: message.roomId,
    participantId: message.participantId,
    role: authentication.participant.role,
    knownRevision: message.knownRevision,
    revision: reconnect.state.revision,
    serverBuildId: reconnect.state.serverBuildId,
    clientBuildIdMatch: message.clientBuildId === reconnect.state.serverBuildId,
    reason: reconnect.rejoined
      ? ('rejoined' as const)
      : projectionRequired
        ? ('snapshot-required' as const)
        : ('synchronized' as const),
    projectionRequired,
  });
  return frozenTransition(reconnect.state, response);
}
