import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import {
  checkedBuildId,
  freezeProjectionIssues,
  isApplicationId,
  isNonNegativeInteger,
  isProjectionCapability,
  projectionIssue,
  readExactRecord,
  validateDecisionContext,
} from './support';
import type {
  OnlineProjectionIssueV1,
  OnlineProjectionRequestV1,
  OnlineProjectionRequestValidationResultV1,
} from './types';

const FIELDS = [
  'kind',
  'protocolVersion',
  'roomId',
  'participantId',
  'participantCapability',
  'knownRevision',
  'clientBuildId',
  'decisionContext',
] as const;

export function validateOnlineProjectionRequestV1(
  input: unknown,
): OnlineProjectionRequestValidationResultV1 {
  const issues: OnlineProjectionIssueV1[] = [];
  const record = readExactRecord(input, FIELDS, '', issues);
  const suppliedCapability = record !== null && isProjectionCapability(record.participantCapability)
    ? record.participantCapability
    : null;
  if (record === null) return Object.freeze({ ok: false, issues: freezeProjectionIssues(issues) });
  if (record.kind !== 'online-projection-request-v1') issues.push(projectionIssue('INVALID_LITERAL', '/kind', 'Invalid projection request kind'));
  if (record.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion) issues.push(projectionIssue('PROTOCOL_VERSION_MISMATCH', '/protocolVersion', 'Protocol version is not supported'));
  if (!isApplicationId(record.roomId)) issues.push(projectionIssue('INVALID_ID', '/roomId', 'Invalid room ID'));
  if (!isApplicationId(record.participantId)) issues.push(projectionIssue('INVALID_ID', '/participantId', 'Invalid participant ID'));
  if (!isProjectionCapability(record.participantCapability)) issues.push(projectionIssue('INVALID_CAPABILITY', '/participantCapability', 'Invalid participant capability'));
  if (!isNonNegativeInteger(record.knownRevision)) issues.push(projectionIssue('INVALID_INTEGER', '/knownRevision', 'Known revision must be a non-negative safe integer'));
  const buildId = checkedBuildId(record.clientBuildId);
  if (buildId === null) issues.push(projectionIssue('INVALID_BUILD_ID', '/clientBuildId', 'Invalid client Build ID'));
  const decisionContext = validateDecisionContext(record.decisionContext, '/decisionContext', issues);
  if (issues.length > 0 || suppliedCapability === null || buildId === null || decisionContext === undefined) {
    return Object.freeze({
      ok: false,
      issues: freezeProjectionIssues(issues, suppliedCapability === null ? [] : [suppliedCapability]),
    });
  }
  const value: OnlineProjectionRequestV1 = Object.freeze({
    kind: 'online-projection-request-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: record.roomId as OnlineProjectionRequestV1['roomId'],
    participantId: record.participantId as OnlineProjectionRequestV1['participantId'],
    participantCapability: suppliedCapability as OnlineProjectionRequestV1['participantCapability'],
    knownRevision: record.knownRevision as number,
    clientBuildId: buildId,
    decisionContext,
  });
  return Object.freeze({ ok: true, value });
}
