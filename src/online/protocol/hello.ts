import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import {
  authenticateProtocolParticipant,
  reconnectProtocolParticipant,
  requireProtocolState,
  selectProtocolVersionIssues,
} from './auth';
import { frozenTransition } from './support';
import type {
  OnlineClientHelloTransitionV1,
  OnlineProtocolIssueV1,
  OnlineServerHelloAcceptedV1,
  OnlineServerHelloRejectedV1,
} from './types';
import { validateOnlineClientHelloV1 } from './validation';

function emptyHelloIssues(): readonly [] {
  const issues: [] = [];
  return Object.freeze(issues);
}

function rejectedHello(
  state: ReturnType<typeof requireProtocolState>,
  issues: readonly OnlineProtocolIssueV1[],
): OnlineClientHelloTransitionV1 {
  const response: OnlineServerHelloRejectedV1 = Object.freeze({
    kind: 'online-server-hello-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    status: 'rejected',
    revision: state.revision,
    serverBuildId: state.serverBuildId,
    roomId: null,
    participantId: null,
    role: null,
    clientBuildIdMatch: null,
    issues,
  });
  return frozenTransition(state, response);
}

export function handleOnlineClientHelloV1(
  stateInput: unknown,
  messageInput: unknown,
): OnlineClientHelloTransitionV1 {
  const state = requireProtocolState(stateInput);
  const messageResult = validateOnlineClientHelloV1(messageInput);
  if (!messageResult.ok) {
    return rejectedHello(state, selectProtocolVersionIssues(messageResult.issues));
  }
  const message = messageResult.value;
  const authentication = authenticateProtocolParticipant(
    state,
    message.roomId,
    message.participantId,
    message.participantCapability,
  );
  if ('code' in authentication) {
    return rejectedHello(state, Object.freeze([authentication]));
  }
  const reconnect = reconnectProtocolParticipant(state, authentication);
  if ('code' in reconnect) return rejectedHello(state, Object.freeze([reconnect]));
  const response: OnlineServerHelloAcceptedV1 = Object.freeze({
    kind: 'online-server-hello-v1' as const,
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    status: 'accepted' as const,
    revision: reconnect.state.revision,
    serverBuildId: reconnect.state.serverBuildId,
    roomId: message.roomId,
    participantId: message.participantId,
    role: authentication.participant.role,
    clientBuildIdMatch: message.clientBuildId === reconnect.state.serverBuildId,
    issues: emptyHelloIssues(),
  });
  return frozenTransition(reconnect.state, response);
}
