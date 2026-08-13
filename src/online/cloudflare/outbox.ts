import {
  validateOnlineCommandEnvelopeV1,
  type OnlineCommandAckV1,
  type OnlineCommandEnvelopeV1,
  type OnlineCommandRejectV1,
} from '../protocol/index';

export type OnlineCloudflareOutboxV1 = Readonly<{
  readonly roomId: string;
  readonly participantId: string;
  readonly entries: readonly OnlineCommandEnvelopeV1[];
}>;

export type OnlineCloudflareOutboxResponseV1 = OnlineCommandAckV1 | OnlineCommandRejectV1;

type SettledResponse = Readonly<{
  readonly kind: 'ack' | 'reject';
  readonly protocolVersion: number;
  readonly roomId: string;
  readonly participantId: string;
  readonly commandId: string;
  readonly baseRevision: number;
}>;

const ISSUE_CODES = new Set([
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

function serialized(value: unknown): string {
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error('Outbox value is not serializable');
  return result;
}

function validateEnvelope(
  outbox: OnlineCloudflareOutboxV1,
  envelope: unknown,
): OnlineCommandEnvelopeV1 {
  const result = validateOnlineCommandEnvelopeV1(envelope);
  if (!result.ok || result.value.roomId !== outbox.roomId || result.value.participantId !== outbox.participantId) throw new Error('Outbox envelope is not bound to this participant');
  return result.value;
}

function closedRecord(value: unknown, expectedKeys: readonly string[]): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const objectValue = value;
    const prototype: object | null = Object.getPrototypeOf(objectValue) as object | null;
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (Object.getOwnPropertySymbols(objectValue).length !== 0) return false;
    const names = Object.getOwnPropertyNames(objectValue).sort();
    if (names.length !== expectedKeys.length || names.some((name, index) => name !== [...expectedKeys].sort()[index])) return false;
    return names.every((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(objectValue, name);
      return descriptor !== undefined && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined;
    });
  } catch {
    return false;
  }
}

function dataValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function closedIssue(value: unknown): boolean {
  if (!closedRecord(value, ['code', 'message', 'path'])) return false;
  const code = dataValue(value, 'code');
  const message = dataValue(value, 'message');
  const path = dataValue(value, 'path');
  return typeof code === 'string' && ISSUE_CODES.has(code) && typeof message === 'string' && typeof path === 'string';
}

function closedIssues(value: unknown): boolean {
  try {
    if (!Array.isArray(value) || Object.getOwnPropertySymbols(value).length !== 0) return false;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || !nonNegativeInteger(lengthDescriptor.value)) return false;
    const length = lengthDescriptor.value;
    const names = Object.getOwnPropertyNames(value).sort();
    const expectedNames = [...Array.from({ length }, (_unused, index) => String(index)), 'length'].sort();
    if (names.length !== expectedNames.length || names.some((name, index) => name !== expectedNames[index])) return false;
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !('value' in descriptor) || !closedIssue(descriptor.value)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function settledResponse(value: unknown): SettledResponse | null {
  try {
    const ackKeys = ['acceptedRevision', 'baseRevision', 'commandId', 'currentRevision', 'duplicate', 'kind', 'participantId', 'protocolVersion', 'roomId', 'status'];
    const rejectKeys = ['baseRevision', 'commandId', 'currentRevision', 'duplicate', 'issues', 'kind', 'participantId', 'protocolVersion', 'resyncRequired', 'roomId'];
    const isAck = closedRecord(value, ackKeys);
    const isReject = closedRecord(value, rejectKeys);
    if (!isAck && !isReject) return null;
    const record = value;
    const kind = dataValue(record, 'kind');
    const protocolVersion = dataValue(record, 'protocolVersion');
    const roomId = dataValue(record, 'roomId');
    const participantId = dataValue(record, 'participantId');
    const commandId = dataValue(record, 'commandId');
    const baseRevision = dataValue(record, 'baseRevision');
    const currentRevision = dataValue(record, 'currentRevision');
    if (kind === 'online-command-ack-v1') {
      const acceptedRevision = dataValue(record, 'acceptedRevision');
      const status = dataValue(record, 'status');
      const duplicate = dataValue(record, 'duplicate');
      if (!nonNegativeInteger(protocolVersion) || typeof roomId !== 'string' || typeof participantId !== 'string' || typeof commandId !== 'string' || !nonNegativeInteger(baseRevision) || !nonNegativeInteger(acceptedRevision) || !nonNegativeInteger(currentRevision) || (status !== 'accepted' && status !== 'accepted-with-warning') || typeof duplicate !== 'boolean') return null;
      return { kind: 'ack', protocolVersion, roomId, participantId, commandId, baseRevision };
    }
    if (kind === 'online-command-reject-v1') {
      const duplicate = dataValue(record, 'duplicate');
      const resyncRequired = dataValue(record, 'resyncRequired');
      const issues = dataValue(record, 'issues');
      if (!nonNegativeInteger(protocolVersion) || typeof roomId !== 'string' || typeof participantId !== 'string' || typeof commandId !== 'string' || !nonNegativeInteger(baseRevision) || !nonNegativeInteger(currentRevision) || typeof duplicate !== 'boolean' || typeof resyncRequired !== 'boolean' || !closedIssues(issues)) return null;
      return { kind: 'reject', protocolVersion, roomId, participantId, commandId, baseRevision };
    }
    return null;
  } catch {
    return null;
  }
}

export function createOnlineCloudflareOutboxV1(
  roomId: string,
  participantId: string,
  entries: readonly OnlineCommandEnvelopeV1[] = [],
): OnlineCloudflareOutboxV1 {
  const outbox: OnlineCloudflareOutboxV1 = Object.freeze({ roomId, participantId, entries: Object.freeze([]) });
  return entries.reduce((current, entry) => enqueueOnlineCloudflareOutboxV1(current, entry), outbox);
}

export function enqueueOnlineCloudflareOutboxV1(
  outbox: OnlineCloudflareOutboxV1,
  envelope: unknown,
): OnlineCloudflareOutboxV1 {
  const value = validateEnvelope(outbox, envelope);
  const existing = outbox.entries.find((entry) => entry.commandId === value.commandId);
  if (existing !== undefined) {
    if (serialized(existing) !== serialized(value)) throw new Error('Command ID is already used by different content');
    return outbox;
  }
  return Object.freeze({ roomId: outbox.roomId, participantId: outbox.participantId, entries: Object.freeze([...outbox.entries, value]) });
}

export function replayOnlineCloudflareOutboxV1(
  outbox: OnlineCloudflareOutboxV1,
): readonly OnlineCommandEnvelopeV1[] {
  return Object.freeze(outbox.entries.map((entry) => {
    const parsed: unknown = JSON.parse(serialized(entry));
    return validateEnvelope(outbox, parsed);
  }));
}

export function settleOnlineCloudflareOutboxV1(
  outbox: OnlineCloudflareOutboxV1,
  response: unknown,
): OnlineCloudflareOutboxV1 {
  const settled = settledResponse(response);
  if (settled === null || settled.roomId !== outbox.roomId || settled.participantId !== outbox.participantId) return outbox;
  const index = outbox.entries.findIndex((entry) => entry.commandId === settled.commandId && entry.baseRevision === settled.baseRevision);
  if (index >= 0 && outbox.entries[index]?.protocolVersion !== settled.protocolVersion) return outbox;
  if (index < 0) return outbox;
  return Object.freeze({ roomId: outbox.roomId, participantId: outbox.participantId, entries: Object.freeze(outbox.entries.filter((_entry, entryIndex) => entryIndex !== index)) });
}
