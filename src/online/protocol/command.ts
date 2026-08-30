import {
  applyCoreCommandV1,
  coreCanonicalDigestFromValueV1,
} from '../../engine/core/index';
import { reconcileOnlineRoomCoreLifecycleV1 } from '../room/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import {
  authenticateProtocolParticipant,
  requireProtocolState,
  safeRejectFields,
  selectProtocolVersionIssues,
} from './auth';
import { buildProtocolStateV1, protocolStateCapabilities } from './state';
import {
  containsConfiguredCapability,
  freezeProtocolIssues,
  frozenTransition,
  inspectGraphForConfiguredCapability,
  protocolIssue,
} from './support';
import type {
  OnlineCommandAckV1,
  OnlineCommandEnvelopeV1,
  OnlineCommandRejectV1,
  OnlineCommandTransitionV1,
  OnlineProtocolCommandReceiptV1,
  OnlineProtocolIssueV1,
  OnlineProtocolStateV1,
} from './types';
import { validateOnlineCommandEnvelopeV1 } from './validation';

function rejectResponse(
  state: OnlineProtocolStateV1,
  messageInput: unknown,
  issues: readonly OnlineProtocolIssueV1[],
  duplicate = false,
  resyncRequired = false,
): OnlineCommandRejectV1 {
  const fields = safeRejectFields(messageInput, protocolStateCapabilities(state));
  return Object.freeze({
    kind: 'online-command-reject-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: fields.roomId as OnlineCommandRejectV1['roomId'],
    participantId: fields.participantId as OnlineCommandRejectV1['participantId'],
    commandId: fields.commandId as OnlineCommandRejectV1['commandId'],
    baseRevision: fields.baseRevision,
    currentRevision: state.revision,
    duplicate,
    resyncRequired,
    issues,
  });
}

function rejectTransition(
  state: OnlineProtocolStateV1,
  messageInput: unknown,
  issue: OnlineProtocolIssueV1,
): OnlineCommandTransitionV1 {
  return frozenTransition(state, rejectResponse(state, messageInput, Object.freeze([issue])));
}

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

function requiresTrustedTabletopBinder(command: OnlineCommandEnvelopeV1['command']): boolean {
  const kind = command.payload.kind;
  return kind === 'stack-remove-object'
    || kind === 'table-turn-progress'
    || kind === 'table-manual-resolve';
}

function appendReceipt(
  state: OnlineProtocolStateV1,
  receipt: OnlineProtocolCommandReceiptV1,
): OnlineProtocolStateV1 {
  return buildProtocolStateV1(
    state.serverBuildId,
    state.room,
    state.coreRoot,
    state.observerAuthorizations,
    Object.freeze([...state.receipts, receipt]),
  );
}

function duplicateTransition(
  state: OnlineProtocolStateV1,
  receipt: OnlineProtocolCommandReceiptV1,
): OnlineCommandTransitionV1 {
  const outcome = receipt.outcome;
  if (outcome.kind === 'accepted') {
    const response: OnlineCommandAckV1 = Object.freeze({
      kind: 'online-command-ack-v1',
      protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
      roomId: outcome.roomId,
      participantId: receipt.participantId,
      commandId: receipt.commandId,
      baseRevision: outcome.baseRevision,
      acceptedRevision: outcome.acceptedRevision,
      currentRevision: state.revision,
      status: outcome.status,
      duplicate: true,
    });
    return frozenTransition(state, response);
  }
  const response: OnlineCommandRejectV1 = Object.freeze({
    kind: 'online-command-reject-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: outcome.roomId,
    participantId: receipt.participantId,
    commandId: receipt.commandId,
    baseRevision: outcome.baseRevision,
    currentRevision: state.revision,
    duplicate: true,
    resyncRequired: outcome.resyncRequired,
    issues: outcome.issues,
  });
  return frozenTransition(state, response);
}

function storedReject(
  state: OnlineProtocolStateV1,
  message: OnlineCommandEnvelopeV1,
  digest: string,
  issue: OnlineProtocolIssueV1,
  resyncRequired: boolean,
): OnlineCommandTransitionV1 {
  const issues = freezeProtocolIssues([issue]);
  const receipt: OnlineProtocolCommandReceiptV1 = Object.freeze({
    participantId: message.participantId,
    commandId: message.commandId,
    requestDigest: digest,
    outcome: Object.freeze({
      kind: 'rejected',
      roomId: message.roomId,
      baseRevision: message.baseRevision,
      resyncRequired,
      issues,
    }),
  });
  const nextState = appendReceipt(state, receipt);
  return frozenTransition(
    nextState,
    Object.freeze({
      kind: 'online-command-reject-v1' as const,
      protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
      roomId: message.roomId,
      participantId: message.participantId,
      commandId: message.commandId,
      baseRevision: message.baseRevision,
      currentRevision: nextState.revision,
      duplicate: false,
      resyncRequired,
      issues,
    }),
  );
}

export function handleOnlineCommandEnvelopeV1(
  stateInput: unknown,
  messageInput: unknown,
  trustedTabletopBinder = false,
): OnlineCommandTransitionV1 {
  const state = requireProtocolState(stateInput);
  const messageResult = validateOnlineCommandEnvelopeV1(messageInput);
  if (!messageResult.ok) {
    return frozenTransition(
      state,
      rejectResponse(
        state,
        messageInput,
        selectProtocolVersionIssues(messageResult.issues),
      ),
    );
  }
  const message = messageResult.value;
  const configuredCapabilities = protocolStateCapabilities(state);
  if (
    containsConfiguredCapability(message.roomId, configuredCapabilities) ||
    containsConfiguredCapability(message.participantId, configuredCapabilities) ||
    containsConfiguredCapability(message.commandId, [
      ...configuredCapabilities,
      message.participantCapability,
    ])
  ) {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue('INVALID_ID', '/commandId', 'Protocol identifier contains forbidden data'),
    );
  }
  const authentication = authenticateProtocolParticipant(
    state,
    message.roomId,
    message.participantId,
    message.participantCapability,
  );
  if ('code' in authentication) return rejectTransition(state, messageInput, authentication);
  if (authentication.participant.presence !== 'connected') {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue(
        'PARTICIPANT_NOT_CONNECTED',
        '/participantId',
        'Participant is not connected',
      ),
    );
  }

  const commandCapabilityInspection = inspectGraphForConfiguredCapability(
    message.command,
    configuredCapabilities,
  );
  if (commandCapabilityInspection !== 'clear') {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue(
        commandCapabilityInspection === 'contains-configured-capability'
          ? 'INVALID_CAPABILITY'
          : 'INVALID_DESCRIPTOR',
        '/command',
        'Core command contains forbidden protocol data',
      ),
    );
  }

  const digest = requestDigest(message);
  const existing = state.receipts.find(
    (receipt) =>
      receipt.participantId === message.participantId && receipt.commandId === message.commandId,
  );
  if (existing !== undefined) {
    if (existing.requestDigest === digest) return duplicateTransition(state, existing);
    return rejectTransition(
      state,
      messageInput,
      protocolIssue(
        'COMMAND_ID_REUSE_MISMATCH',
        '/commandId',
        'Command ID was already used for a different request',
      ),
    );
  }

  if (state.room.lifecycle !== 'active') {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue('ROOM_NOT_ACTIVE', '/roomId', 'Room is not active'),
    );
  }
  const participant = authentication.participant;
  if (participant.role !== 'player') {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue('ROLE_NOT_ALLOWED', '/participantId', 'Participant role cannot send commands'),
    );
  }
  const seat = state.room.seats[participant.seatIndex];
  if (seat?.outcome !== 'pending') {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue('PLAYER_NOT_PENDING', '/participantId', 'Player is not pending'),
    );
  }
  if (message.command.actorPlayerId !== seat.corePlayerId) {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue('ACTOR_MISMATCH', '/command', 'Core command actor does not match Room seat'),
    );
  }
  if (message.command.sequence !== message.baseRevision + 1) {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue(
        'COMMAND_SEQUENCE_MISMATCH',
        '/command',
        'Core command sequence does not match base revision',
      ),
    );
  }
  if (message.baseRevision !== state.revision) {
    return storedReject(
      state,
      message,
      digest,
      protocolIssue('STALE_REVISION', '/baseRevision', 'Command revision is stale'),
      true,
    );
  }

  if (!trustedTabletopBinder && requiresTrustedTabletopBinder(message.command)) {
    return storedReject(
      state,
      message,
      digest,
      protocolIssue('AUTHORIZATION_REJECTED', '/command', 'Steward-owned tabletop commands require the server tabletop binder'),
      false,
    );
  }

  const coreResult = applyCoreCommandV1(state.coreRoot, message.command);
  if (coreResult.status === 'rejected') {
    return storedReject(
      state,
      message,
      digest,
      protocolIssue('CORE_COMMAND_REJECTED', '/command', 'Core command was rejected'),
      false,
    );
  }

  let room;
  try {
    room = reconcileOnlineRoomCoreLifecycleV1(state.room, coreResult.root);
  } catch {
    return rejectTransition(
      state,
      messageInput,
      protocolIssue(
        'CORE_RECONCILIATION_REJECTED',
        '/command',
        'Core lifecycle reconciliation was rejected',
      ),
    );
  }
  const receipt: OnlineProtocolCommandReceiptV1 = Object.freeze({
    participantId: message.participantId,
    commandId: message.commandId,
    requestDigest: digest,
    outcome: Object.freeze({
      kind: 'accepted',
      roomId: message.roomId,
      baseRevision: message.baseRevision,
      acceptedRevision: coreResult.root.acceptedCommandCount,
      status: coreResult.status,
    }),
  });
  const nextState = buildProtocolStateV1(
    state.serverBuildId,
    room,
    coreResult.root,
    state.observerAuthorizations,
    Object.freeze([...state.receipts, receipt]),
  );
  const response: OnlineCommandAckV1 = Object.freeze({
    kind: 'online-command-ack-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: message.roomId,
    participantId: message.participantId,
    commandId: message.commandId,
    baseRevision: message.baseRevision,
    acceptedRevision: nextState.revision,
    currentRevision: nextState.revision,
    status: coreResult.status,
    duplicate: false,
  });
  return frozenTransition(nextState, response);
}
