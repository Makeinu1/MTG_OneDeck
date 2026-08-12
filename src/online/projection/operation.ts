import {
  handleOnlineSnapshotRequestV1,
  validateOnlineProtocolStateV1,
  type OnlineProtocolIssueV1,
  type OnlineProtocolStateV1,
  type OnlineResyncV1,
} from '../protocol/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import { constructParticipantProjectionV1 } from './project';
import { validateOnlineProjectionRequestV1 } from './request';
import {
  freezeProjectionIssues,
  graphContainsCapability,
  isDeeplyFrozenDescriptorSafe,
  projectionIssue,
} from './support';
import type {
  OnlineProjectedSnapshotAcceptedV1,
  OnlineProjectedSnapshotRejectedV1,
  OnlineProjectedSnapshotTransitionV1,
  OnlineProjectionIssueCodeV1,
  OnlineProjectionIssueV1,
  OnlineProjectionLogEntryV1,
} from './types';

const EMPTY_ISSUES: readonly [] = Object.freeze([]);

function capabilities(state: OnlineProtocolStateV1): readonly string[] {
  return Object.freeze([
    ...state.room.seats.map((seat) => seat.seatCapability),
    ...state.observerAuthorizations.map((entry) => entry.observerCapability),
  ]);
}

export class OnlineProjectionOperationErrorV1 extends Error {
  readonly issues: readonly OnlineProjectionIssueV1[];
  constructor(issues: readonly OnlineProjectionIssueV1[]) {
    super(`Invalid Online Projection operation (${issues.length} issue(s))`);
    this.name = 'OnlineProjectionOperationErrorV1';
    this.issues = freezeProjectionIssues(issues);
    Object.freeze(this);
  }
}

function rejected(
  state: OnlineProtocolStateV1,
  issueCodes: readonly OnlineProjectionIssueCodeV1[],
): OnlineProjectedSnapshotTransitionV1 {
  const issues = freezeProjectionIssues(issueCodes.map((code) => projectionIssue(code, '',
    code === 'PROJECTION_REJECTED' ? 'Projection was rejected' :
      code === 'PROTOCOL_VERSION_MISMATCH' ? 'Protocol version is not supported' :
        'Projection request was rejected')));
  const response: OnlineProjectedSnapshotRejectedV1 = Object.freeze({
    kind: 'online-projected-snapshot-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    status: 'rejected',
    roomId: null,
    participantId: null,
    role: null,
    knownRevision: null,
    revision: state.revision,
    serverBuildId: state.serverBuildId,
    clientBuildIdMatch: null,
    reason: null,
    projection: null,
    issues,
  });
  const log: OnlineProjectionLogEntryV1 = Object.freeze({
    kind: 'online-projection-log-v1',
    status: 'rejected',
    revision: state.revision,
    role: null,
    reason: null,
    issueCodes: Object.freeze(issues.map((issue) => issue.code)),
  });
  return Object.freeze({ state, response, log });
}

function selectedRequestCodes(issues: readonly OnlineProjectionIssueV1[]): readonly OnlineProjectionIssueCodeV1[] {
  const version = issues.filter((issue) => issue.code === 'PROTOCOL_VERSION_MISMATCH');
  return Object.freeze((version.length > 0 ? version : issues).map((issue) => issue.code));
}

function protocolRejectCodes(issues: readonly OnlineProtocolIssueV1[]): readonly OnlineProjectionIssueCodeV1[] {
  if (issues.some((issue) => issue.code === 'PROTOCOL_VERSION_MISMATCH')) return Object.freeze(['PROTOCOL_VERSION_MISMATCH']);
  return Object.freeze(['AUTHORIZATION_REJECTED']);
}

export function handleOnlineProjectedSnapshotRequestV1(
  stateInput: unknown,
  requestInput: unknown,
): OnlineProjectedSnapshotTransitionV1 {
  let state: OnlineProtocolStateV1;
  try {
    const result = validateOnlineProtocolStateV1(stateInput);
    if (!result.ok) throw new OnlineProjectionOperationErrorV1([
      projectionIssue('INVALID_PROTOCOL_STATE', '', 'Invalid protocol state'),
    ]);
    state = isDeeplyFrozenDescriptorSafe(stateInput) ? stateInput as OnlineProtocolStateV1 : result.value;
  } catch (error: unknown) {
    if (error instanceof OnlineProjectionOperationErrorV1) throw error;
    throw new OnlineProjectionOperationErrorV1([
      projectionIssue('INVALID_PROTOCOL_STATE', '', 'Invalid protocol state'),
    ]);
  }
  const requestResult = validateOnlineProjectionRequestV1(requestInput);
  if (!requestResult.ok) return rejected(state, selectedRequestCodes(requestResult.issues));
  const request = requestResult.value;
  const snapshot = handleOnlineSnapshotRequestV1(state, {
    kind: 'online-snapshot-request-v1',
    protocolVersion: request.protocolVersion,
    roomId: request.roomId,
    participantId: request.participantId,
    participantCapability: request.participantCapability,
    knownRevision: request.knownRevision,
    clientBuildId: request.clientBuildId,
  });
  if (snapshot.response.kind !== 'online-resync-v1') {
    return rejected(snapshot.state, protocolRejectCodes(snapshot.response.issues));
  }
  const resync: OnlineResyncV1 = snapshot.response;
  const participant = snapshot.state.room.participants.find((value) =>
    value.participantId === request.participantId && value.role === resync.role);
  if (participant === undefined) return rejected(snapshot.state, ['PROJECTION_REJECTED']);
  try {
    const projection = constructParticipantProjectionV1(snapshot.state, request, participant);
    const response: OnlineProjectedSnapshotAcceptedV1 = Object.freeze({
      kind: 'online-projected-snapshot-v1' as const,
      protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
      status: 'accepted' as const,
      roomId: resync.roomId,
      participantId: resync.participantId,
      role: resync.role,
      knownRevision: resync.knownRevision,
      revision: resync.revision,
      serverBuildId: resync.serverBuildId,
      clientBuildIdMatch: resync.clientBuildIdMatch,
      reason: resync.reason,
      projection,
      issues: EMPTY_ISSUES,
    });
    const log: OnlineProjectionLogEntryV1 = Object.freeze({
      kind: 'online-projection-log-v1',
      status: 'accepted',
      revision: resync.revision,
      role: resync.role,
      reason: resync.reason,
      issueCodes: Object.freeze([]),
    });
    if (graphContainsCapability(response, capabilities(snapshot.state)) || graphContainsCapability(log, capabilities(snapshot.state))) {
      return rejected(snapshot.state, ['PROJECTION_REJECTED']);
    }
    return Object.freeze({ state: snapshot.state, response, log });
  } catch {
    return rejected(snapshot.state, ['PROJECTION_REJECTED']);
  }
}
