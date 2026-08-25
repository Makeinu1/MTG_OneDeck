import {
  validateOnlineCommandEnvelopeV1,
  type OnlineCommandAckV1,
  type OnlineCommandRejectV1,
  type OnlineProtocolIssueCodeV1,
} from '../protocol/index';
import { validateOnlineParticipantProjectionV3 } from '../projection/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import {
  isOnlineProtocolCommandIdV1,
  type OnlineProtocolRevisionV1,
} from '../protocol/index';
import {
  GAME_APPLICATION_SCHEMA_VERSION_V1,
  type GameApplicationAdapterV1,
  type GameApplicationAttemptV1,
  type GameApplicationAuthorityV1,
  type GameApplicationExchangeV1,
  type GameApplicationExecutionV1,
  type GameApplicationIssueCodeV1,
  type GameApplicationIssueV1,
  type GameApplicationReceiptV1,
  type GameIntentV1,
  lookupGameApplicationAdapterV1,
} from './types';
import { validateGameIntentV1 } from './gameIntentV1';

const AUTHORITY_FIELDS = ['protocolVersion', 'roomId', 'participantId', 'participantCapability'] as const;
const EXCHANGE_FIELDS = ['kind', 'receipt', 'projection'] as const;
const ACK_FIELDS = [
  'kind',
  'protocolVersion',
  'roomId',
  'participantId',
  'commandId',
  'baseRevision',
  'acceptedRevision',
  'currentRevision',
  'status',
  'duplicate',
] as const;
const REJECT_FIELDS = [
  'kind',
  'protocolVersion',
  'roomId',
  'participantId',
  'commandId',
  'baseRevision',
  'currentRevision',
  'duplicate',
  'resyncRequired',
  'issues',
] as const;
const APPLICATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const CAPABILITY = /^[A-Za-z0-9_-]{32,128}$/u;
const SAFE_PROTOCOL_ISSUE_CODES = new Set<OnlineProtocolIssueCodeV1>([
  'INVALID_ROOT',
  'MISSING_FIELD',
  'UNKNOWN_FIELD',
  'INVALID_DESCRIPTOR',
  'INVALID_TYPE',
  'INVALID_LITERAL',
  'INVALID_VERSION',
  'INVALID_ID',
  'INVALID_CAPABILITY',
  'INVALID_INTEGER',
  'INVALID_ARRAY',
  'NON_DENSE_ARRAY',
  'INVALID_BUILD_ID',
  'INVALID_PROTOCOL_STATE',
  'PROTOCOL_VERSION_MISMATCH',
  'ROOM_MISMATCH',
  'AUTHORIZATION_REJECTED',
  'PARTICIPANT_NOT_CONNECTED',
  'ROLE_NOT_ALLOWED',
  'ROOM_NOT_ACTIVE',
  'PLAYER_NOT_PENDING',
  'ACTOR_MISMATCH',
  'COMMAND_SEQUENCE_MISMATCH',
  'COMMAND_ID_REUSE_MISMATCH',
  'STALE_REVISION',
  'CORE_COMMAND_REJECTED',
  'CORE_RECONCILIATION_REJECTED',
]);
const APPLICATION_ISSUE_CODES = new Set<GameApplicationIssueCodeV1>([
  'INVALID_INTENT',
  'INVALID_DESCRIPTOR',
  'INVALID_AUTHORITY',
  'INVALID_ENVELOPE',
  'INVALID_RECEIPT',
  'INVALID_PROJECTION',
  'TRANSPORT_FAILURE',
  'APPLICATION_FAILURE',
]);

function issue(code: GameApplicationIssueCodeV1, path: string, message: string): GameApplicationIssueV1 {
  return Object.freeze({ code, path, message });
}

function failure(
  code: GameApplicationIssueCodeV1,
  path: string,
  message: string,
): Readonly<{ readonly ok: false; readonly issues: readonly GameApplicationIssueV1[] }> {
  return Object.freeze({ ok: false as const, issues: Object.freeze([issue(code, path, message)]) });
}

function exactRecord(input: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = Reflect.getPrototypeOf(input);
    keys = Reflect.ownKeys(input);
  } catch {
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) return null;
  const allowed = new Set(fields);
  if (keys.length !== fields.length) return null;
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) return null;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      return null;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
}

function revision(value: unknown): value is OnlineProtocolRevisionV1 {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function applicationId(value: unknown): value is string {
  return typeof value === 'string' && APPLICATION_ID.test(value)
    && value !== '__proto__' && value !== 'prototype' && value !== 'constructor';
}

function normalizedIssues(
  issues: readonly GameApplicationIssueV1[],
): readonly GameApplicationIssueV1[] {
  return Object.freeze(issues.slice(0, 8).map((current) => Object.freeze({
    code: APPLICATION_ISSUE_CODES.has(current.code) ? current.code : 'APPLICATION_FAILURE',
    path: '',
    message: current.code === 'TRANSPORT_FAILURE' ? 'Remote application transport failed' : 'Application execution failed',
  })));
}

function validateAuthorityRecord(input: unknown): GameApplicationAuthorityV1 | null {
  const record = exactRecord(input, AUTHORITY_FIELDS);
  if (record === null) return null;
  if (
    typeof record.protocolVersion !== 'number'
    || !Number.isSafeInteger(record.protocolVersion)
    || record.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion
    || !applicationId(record.roomId)
    || !applicationId(record.participantId)
    || typeof record.participantCapability !== 'string'
    || !CAPABILITY.test(record.participantCapability)
  ) return null;
  return Object.freeze({
    protocolVersion: record.protocolVersion,
    roomId: record.roomId,
    participantId: record.participantId,
    participantCapability: record.participantCapability,
  });
}

export function validateGameApplicationAuthorityV1(
  input: unknown,
): Readonly<
  | { readonly ok: true; readonly value: GameApplicationAuthorityV1 }
  | { readonly ok: false; readonly issues: readonly GameApplicationIssueV1[] }
> {
  const value = validateAuthorityRecord(input);
  return value === null
    ? failure('INVALID_AUTHORITY', '', 'Application authority is invalid')
    : Object.freeze({ ok: true as const, value });
}

function protocolIssueShape(input: unknown): input is Readonly<{ readonly code: string; readonly path: string; readonly message: string }> {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    && exactRecord(input, ['code', 'path', 'message']) !== null;
}

function sanitizeProtocolIssues(input: unknown): readonly Readonly<{ readonly code: OnlineProtocolIssueCodeV1; readonly path: string; readonly message: string }>[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 8) return null;
  const result: Readonly<{ readonly code: OnlineProtocolIssueCodeV1; readonly path: string; readonly message: string }>[] = [];
  for (const entry of input) {
    if (!protocolIssueShape(entry)) return null;
    const record = exactRecord(entry, ['code', 'path', 'message']);
    if (record === null || typeof record.code !== 'string' || !SAFE_PROTOCOL_ISSUE_CODES.has(record.code as OnlineProtocolIssueCodeV1)) return null;
    const path = '';
    result.push(Object.freeze({
      code: record.code as OnlineProtocolIssueCodeV1,
      path,
      message: 'Command was rejected',
    }));
  }
  return Object.freeze(result);
}

function receiptRecord(
  input: unknown,
  expected: Readonly<{ readonly authority: GameApplicationAuthorityV1; readonly intent: GameIntentV1; readonly projectionRevision: number }>,
): GameApplicationReceiptV1 | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  const kind = (() => {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(input, 'kind');
      return descriptor !== undefined && 'value' in descriptor ? descriptor.value as unknown : null;
    } catch {
      return null;
    }
  })();
  if (kind === 'online-command-ack-v1') {
    const record = exactRecord(input, ACK_FIELDS);
    if (record === null) return null;
    if (
      record.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion
      || !applicationId(record.roomId)
      || record.roomId !== expected.authority.roomId
      || !applicationId(record.participantId)
      || record.participantId !== expected.authority.participantId
      || !isOnlineProtocolCommandIdV1(record.commandId)
      || record.commandId !== expected.intent.commandId
      || !revision(record.baseRevision)
      || record.baseRevision !== expected.intent.baseRevision
      || !revision(record.acceptedRevision)
      || !revision(record.currentRevision)
      || record.acceptedRevision !== record.baseRevision + 1
      || record.currentRevision !== expected.projectionRevision
      || record.currentRevision < record.acceptedRevision
      || (!record.duplicate && record.acceptedRevision !== record.currentRevision)
      || (record.status !== 'accepted' && record.status !== 'accepted-with-warning')
      || typeof record.duplicate !== 'boolean'
    ) return null;
    return Object.freeze({
      kind: 'online-command-ack-v1',
      protocolVersion: record.protocolVersion,
      roomId: record.roomId as OnlineCommandAckV1['roomId'],
      participantId: record.participantId as OnlineCommandAckV1['participantId'],
      commandId: record.commandId,
      baseRevision: record.baseRevision,
      acceptedRevision: record.acceptedRevision,
      currentRevision: record.currentRevision,
      status: record.status,
      duplicate: record.duplicate,
    });
  }
  if (kind !== 'online-command-reject-v1') return null;
  const record = exactRecord(input, REJECT_FIELDS);
  if (record === null) return null;
  const issues = sanitizeProtocolIssues(record.issues);
  if (
    issues === null
    || issues.length !== 1
    || record.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion
    || record.roomId !== expected.authority.roomId
    || record.participantId !== expected.authority.participantId
    || record.commandId !== expected.intent.commandId
    || record.baseRevision !== expected.intent.baseRevision
    || (issues[0]?.code === 'STALE_REVISION' && record.baseRevision === record.currentRevision)
    || !revision(record.currentRevision)
    || record.currentRevision !== expected.projectionRevision
    || record.duplicate !== false
    || record.resyncRequired !== (issues[0]?.code === 'STALE_REVISION')
  ) return null;
  return Object.freeze({
    kind: 'online-command-reject-v1',
    protocolVersion: record.protocolVersion,
    roomId: record.roomId as OnlineCommandRejectV1['roomId'],
    participantId: record.participantId as OnlineCommandRejectV1['participantId'],
    commandId: record.commandId as OnlineCommandRejectV1['commandId'],
    baseRevision: record.baseRevision,
    currentRevision: record.currentRevision,
    duplicate: record.duplicate,
    resyncRequired: record.resyncRequired,
    issues,
  });
}

export function validateGameApplicationExchangeV1(
  input: unknown,
  authorityInput: unknown,
  intentInput: unknown,
): Readonly<
  | { readonly ok: true; readonly value: GameApplicationExchangeV1 }
  | { readonly ok: false; readonly issues: readonly GameApplicationIssueV1[] }
> {
  const authority = validateAuthorityRecord(authorityInput);
  const intentResult = validateGameIntentV1(intentInput);
  if (authority === null) return failure('INVALID_AUTHORITY', '', 'Application authority is invalid');
  if (!intentResult.ok) return failure('INVALID_INTENT', '', 'Game intent is invalid');
  const record = exactRecord(input, EXCHANGE_FIELDS);
  if (record === null || record.kind !== 'game-application-exchange-v1') return failure('INVALID_RECEIPT', '', 'Application exchange is invalid');
  const projectionResult = validateOnlineParticipantProjectionV3(record.projection);
  if (!projectionResult.ok) return failure('INVALID_PROJECTION', '', 'Participant projection is invalid');
  const projection = projectionResult.value;
  if (
    projection.protocolVersion !== authority.protocolVersion
    || projection.roomId !== authority.roomId
    || projection.participantId !== authority.participantId
    || projection.role !== 'player'
  ) return failure('INVALID_PROJECTION', '', 'Participant projection identity is invalid');
  const receipt = receiptRecord(record.receipt, {
    authority,
    intent: intentResult.value,
    projectionRevision: projection.revision,
  });
  if (receipt === null) return failure('INVALID_RECEIPT', '', 'Command receipt is invalid');
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({ kind: 'game-application-exchange-v1', receipt, projection }),
  });
}

export function validateGameApplicationAttemptV1(
  input: unknown,
  authorityInput: unknown,
  intentInput: unknown,
): Readonly<
  | { readonly ok: true; readonly value: GameApplicationAttemptV1 }
  | { readonly ok: false; readonly issues: readonly GameApplicationIssueV1[] }
> {
  try {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return failure('APPLICATION_FAILURE', '', 'Application attempt is invalid');
    let okDescriptor: PropertyDescriptor | undefined;
    try {
      okDescriptor = Object.getOwnPropertyDescriptor(input, 'ok');
    } catch {
      return failure('INVALID_DESCRIPTOR', '', 'Application attempt is invalid');
    }
    if (okDescriptor === undefined || !('value' in okDescriptor) || typeof okDescriptor.value !== 'boolean') return failure('APPLICATION_FAILURE', '', 'Application attempt is invalid');
    if (okDescriptor.value) {
      const record = exactRecord(input, ['ok', 'value']);
      if (record === null) return failure('APPLICATION_FAILURE', '', 'Application attempt is invalid');
      const exchange = validateGameApplicationExchangeV1(record.value, authorityInput, intentInput);
      if (!exchange.ok) return exchange;
      return Object.freeze({ ok: true as const, value: Object.freeze({ ok: true as const, value: exchange.value }) });
    }
    const record = exactRecord(input, ['ok', 'issues']);
    if (record === null || !Array.isArray(record.issues) || record.issues.length === 0 || record.issues.length > 8) return failure('APPLICATION_FAILURE', '', 'Application attempt is invalid');
    const issues: GameApplicationIssueV1[] = [];
    for (const entry of record.issues) {
      const issueRecord = exactRecord(entry, ['code', 'path', 'message']);
      if (
        issueRecord === null
        || typeof issueRecord.code !== 'string'
        || !APPLICATION_ISSUE_CODES.has(issueRecord.code as GameApplicationIssueCodeV1)
        || typeof issueRecord.path !== 'string'
        || typeof issueRecord.message !== 'string'
      ) return failure('APPLICATION_FAILURE', '', 'Application attempt is invalid');
      issues.push(Object.freeze({
        code: issueRecord.code as GameApplicationIssueCodeV1,
        path: '',
        message: 'Application failed',
      }));
    }
    return Object.freeze({ ok: true as const, value: Object.freeze({ ok: false as const, issues: Object.freeze(issues) }) });
  } catch {
    return failure('INVALID_DESCRIPTOR', '', 'Application attempt is invalid');
  }
}

function executionFailure(execution: GameApplicationExecutionV1): GameApplicationAttemptV1 {
  if (execution.ok) return Object.freeze({ ok: false as const, issues: Object.freeze([issue('APPLICATION_FAILURE', '', 'Application execution was invalid')]) });
  return Object.freeze({ ok: false as const, issues: normalizedIssues(execution.issues) });
}

export async function applyGameIntentV1(
  adapterInput: GameApplicationAdapterV1,
  input: unknown,
): Promise<GameApplicationAttemptV1> {
  const adapter = lookupGameApplicationAdapterV1(adapterInput);
  if (adapter === null) return failure('INVALID_AUTHORITY', '', 'Application adapter is invalid');
  const intentResult = validateGameIntentV1(input);
  if (!intentResult.ok) return failure('INVALID_INTENT', '', 'Game intent is invalid');
  const intent = intentResult.value;
  const envelopeCandidate = Object.freeze({
    kind: 'online-command-envelope-v1' as const,
    protocolVersion: adapter.authority.protocolVersion,
    roomId: adapter.authority.roomId,
    participantId: adapter.authority.participantId,
    participantCapability: adapter.authority.participantCapability,
    commandId: intent.commandId,
    baseRevision: intent.baseRevision,
    command: intent.command,
  });
  const envelopeResult = validateOnlineCommandEnvelopeV1(envelopeCandidate);
  if (!envelopeResult.ok) return failure('INVALID_ENVELOPE', '', 'Command envelope is invalid');
  let execution: GameApplicationExecutionV1;
  try {
    execution = await adapter.applyEnvelope(envelopeResult.value);
  } catch {
    return failure(adapter.kind === 'remote' ? 'TRANSPORT_FAILURE' : 'APPLICATION_FAILURE', '', 'Application execution failed');
  }
  if (!execution.ok) return executionFailure(execution);
  const exchangeResult = validateGameApplicationExchangeV1(execution.value, adapter.authority, intent);
  if (!exchangeResult.ok) return exchangeResult;
  return exchangeResult;
}

export { GAME_APPLICATION_SCHEMA_VERSION_V1 };
export { GAME_INTENT_SCHEMA_VERSION_V1 } from './types';
export { validateGameIntentV1 } from './gameIntentV1';
