import {
  validateCoreCommandV1,
  type CoreCommandV1,
} from '../../engine/core/index';
import type {
  OnlineRoomIdV1,
  OnlineRoomParticipantIdV1,
  OnlineRoomSeatCapabilityV1,
} from '../room/index';
import { CURRENT_CONTRACT_VERSIONS, validateBuildId, type BuildId } from '../../versioning/index';
import {
  emptyFrozenArray,
  freezeProtocolIssues,
  hasFieldReadIssue,
  hasReadableField,
  isOnlineProtocolCommandIdV1,
  isProtocolApplicationId,
  isProtocolCapability,
  isProtocolRevision,
  protocolIssue,
  readExactRecord,
} from './support';
import type {
  OnlineClientHelloV1,
  OnlineClientHelloValidationResultV1,
  OnlineCommandEnvelopeV1,
  OnlineCommandEnvelopeValidationResultV1,
  OnlineProtocolCommandIdV1,
  OnlineProtocolIssueV1,
  OnlineProtocolParticipantCapabilityV1,
  OnlineSnapshotRequestV1,
  OnlineSnapshotRequestValidationResultV1,
} from './types';

const HELLO_FIELDS = [
  'kind',
  'protocolVersion',
  'roomId',
  'participantId',
  'participantCapability',
  'clientBuildId',
] as const;

const COMMAND_FIELDS = [
  'kind',
  'protocolVersion',
  'roomId',
  'participantId',
  'participantCapability',
  'commandId',
  'baseRevision',
  'command',
] as const;

const SNAPSHOT_FIELDS = [
  'kind',
  'protocolVersion',
  'roomId',
  'participantId',
  'participantCapability',
  'knownRevision',
  'clientBuildId',
] as const;

function validateKind(
  record: Record<string, unknown>,
  expected: string,
  issues: OnlineProtocolIssueV1[],
): boolean {
  if (!hasReadableField(record, 'kind')) return false;
  if (record.kind !== expected && !hasFieldReadIssue(issues, '/kind')) {
    issues.push(protocolIssue('INVALID_LITERAL', '/kind', 'Invalid protocol message kind'));
    return false;
  }
  return record.kind === expected;
}

function validateProtocolVersion(
  record: Record<string, unknown>,
  issues: OnlineProtocolIssueV1[],
): number | null {
  if (!hasReadableField(record, 'protocolVersion')) return null;
  const value = record.protocolVersion;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    if (!hasFieldReadIssue(issues, '/protocolVersion')) {
      issues.push(protocolIssue('INVALID_VERSION', '/protocolVersion', 'Invalid protocol version'));
    }
    return null;
  }
  if (value !== CURRENT_CONTRACT_VERSIONS.protocolVersion) {
    issues.push(
      protocolIssue(
        'PROTOCOL_VERSION_MISMATCH',
        '/protocolVersion',
        'Protocol version is not supported',
      ),
    );
  }
  return value;
}

function validateApplicationId(
  record: Record<string, unknown>,
  field: 'roomId' | 'participantId',
  issues: OnlineProtocolIssueV1[],
): string | null {
  const path = `/${field}`;
  if (!hasReadableField(record, field)) return null;
  if (!isProtocolApplicationId(record[field])) {
    if (!hasFieldReadIssue(issues, path)) {
      issues.push(protocolIssue('INVALID_ID', path, 'Invalid protocol application ID'));
    }
    return null;
  }
  return record[field];
}

function validateCapability(
  record: Record<string, unknown>,
  issues: OnlineProtocolIssueV1[],
): OnlineProtocolParticipantCapabilityV1 | null {
  if (!hasReadableField(record, 'participantCapability')) return null;
  if (!isProtocolCapability(record.participantCapability)) {
    if (!hasFieldReadIssue(issues, '/participantCapability')) {
      issues.push(
        protocolIssue('INVALID_CAPABILITY', '/participantCapability', 'Invalid capability'),
      );
    }
    return null;
  }
  return record.participantCapability;
}

function validateClientBuildId(
  record: Record<string, unknown>,
  issues: OnlineProtocolIssueV1[],
): BuildId | null {
  if (!hasReadableField(record, 'clientBuildId')) return null;
  const result = validateBuildId(record.clientBuildId);
  if (!result.ok) {
    if (!hasFieldReadIssue(issues, '/clientBuildId')) {
      issues.push(protocolIssue('INVALID_BUILD_ID', '/clientBuildId', 'Invalid client Build ID'));
    }
    return null;
  }
  return result.value;
}

function validateRevisionField(
  record: Record<string, unknown>,
  field: 'baseRevision' | 'knownRevision',
  issues: OnlineProtocolIssueV1[],
): number | null {
  const path = `/${field}`;
  if (!hasReadableField(record, field)) return null;
  if (!isProtocolRevision(record[field])) {
    if (!hasFieldReadIssue(issues, path)) {
      issues.push(protocolIssue('INVALID_INTEGER', path, 'Revision must be a non-negative integer'));
    }
    return null;
  }
  return record[field];
}

function failure<T>(
  issues: readonly OnlineProtocolIssueV1[],
  capabilities: readonly string[] = [],
): import('./types').OnlineProtocolValidationResultV1<T> {
  return Object.freeze({ ok: false as const, issues: freezeProtocolIssues(issues, capabilities) });
}

export function validateOnlineClientHelloV1(input: unknown): OnlineClientHelloValidationResultV1 {
  try {
    const issues: OnlineProtocolIssueV1[] = [];
    const record = readExactRecord(input, HELLO_FIELDS, '', issues);
    if (record === null) return failure(issues);
    const validKind = validateKind(record, 'online-client-hello-v1', issues);
    const protocolVersion = validateProtocolVersion(record, issues);
    const roomId = validateApplicationId(record, 'roomId', issues);
    const participantId = validateApplicationId(record, 'participantId', issues);
    const participantCapability = validateCapability(record, issues);
    const clientBuildId = validateClientBuildId(record, issues);
    const capabilities = participantCapability === null ? [] : [participantCapability];
    if (
      issues.length > 0 ||
      !validKind ||
      protocolVersion === null ||
      roomId === null ||
      participantId === null ||
      participantCapability === null ||
      clientBuildId === null
    ) {
      return failure(issues, capabilities);
    }
    const value: OnlineClientHelloV1 = Object.freeze({
      kind: 'online-client-hello-v1',
      protocolVersion,
      roomId: roomId as OnlineRoomIdV1,
      participantId: participantId as OnlineRoomParticipantIdV1,
      participantCapability,
      clientBuildId,
    });
    return Object.freeze({ ok: true as const, value });
  } catch {
    return failure([
      protocolIssue('INVALID_DESCRIPTOR', '', 'Protocol message could not be inspected safely'),
    ]);
  }
}

export function validateOnlineCommandEnvelopeV1(
  input: unknown,
): OnlineCommandEnvelopeValidationResultV1 {
  try {
    const issues: OnlineProtocolIssueV1[] = [];
    const record = readExactRecord(input, COMMAND_FIELDS, '', issues);
    if (record === null) return failure(issues);
    const validKind = validateKind(record, 'online-command-envelope-v1', issues);
    const protocolVersion = validateProtocolVersion(record, issues);
    const roomId = validateApplicationId(record, 'roomId', issues);
    const participantId = validateApplicationId(record, 'participantId', issues);
    const participantCapability = validateCapability(record, issues);
    let commandId: OnlineProtocolCommandIdV1 | null = null;
    if (hasReadableField(record, 'commandId')) {
      if (isOnlineProtocolCommandIdV1(record.commandId)) commandId = record.commandId;
      else if (!hasFieldReadIssue(issues, '/commandId')) {
        issues.push(protocolIssue('INVALID_ID', '/commandId', 'Invalid protocol command ID'));
      }
    }
    const baseRevision = validateRevisionField(record, 'baseRevision', issues);
    let command: CoreCommandV1 | null = null;
    if (hasReadableField(record, 'command')) {
      try {
        const result = validateCoreCommandV1(record.command);
        if (result.ok) command = result.value;
        else {
          issues.push(protocolIssue('INVALID_TYPE', '/command', 'Invalid Core command'));
        }
      } catch {
        issues.push(protocolIssue('INVALID_DESCRIPTOR', '/command', 'Core command is not readable'));
      }
    }
    const capabilities = participantCapability === null ? [] : [participantCapability];
    if (
      issues.length > 0 ||
      !validKind ||
      protocolVersion === null ||
      roomId === null ||
      participantId === null ||
      participantCapability === null ||
      commandId === null ||
      baseRevision === null ||
      command === null
    ) {
      return failure(issues, capabilities);
    }
    const value: OnlineCommandEnvelopeV1 = Object.freeze({
      kind: 'online-command-envelope-v1',
      protocolVersion,
      roomId: roomId as OnlineRoomIdV1,
      participantId: participantId as OnlineRoomParticipantIdV1,
      participantCapability: participantCapability as OnlineRoomSeatCapabilityV1,
      commandId,
      baseRevision,
      command,
    });
    return Object.freeze({ ok: true as const, value });
  } catch {
    return failure([
      protocolIssue('INVALID_DESCRIPTOR', '', 'Protocol message could not be inspected safely'),
    ]);
  }
}

export function validateOnlineSnapshotRequestV1(
  input: unknown,
): OnlineSnapshotRequestValidationResultV1 {
  try {
    const issues: OnlineProtocolIssueV1[] = [];
    const record = readExactRecord(input, SNAPSHOT_FIELDS, '', issues);
    if (record === null) return failure(issues);
    const validKind = validateKind(record, 'online-snapshot-request-v1', issues);
    const protocolVersion = validateProtocolVersion(record, issues);
    const roomId = validateApplicationId(record, 'roomId', issues);
    const participantId = validateApplicationId(record, 'participantId', issues);
    const participantCapability = validateCapability(record, issues);
    const knownRevision = validateRevisionField(record, 'knownRevision', issues);
    const clientBuildId = validateClientBuildId(record, issues);
    const capabilities = participantCapability === null ? [] : [participantCapability];
    if (
      issues.length > 0 ||
      !validKind ||
      protocolVersion === null ||
      roomId === null ||
      participantId === null ||
      participantCapability === null ||
      knownRevision === null ||
      clientBuildId === null
    ) {
      return failure(issues, capabilities);
    }
    const value: OnlineSnapshotRequestV1 = Object.freeze({
      kind: 'online-snapshot-request-v1',
      protocolVersion,
      roomId: roomId as OnlineRoomIdV1,
      participantId: participantId as OnlineRoomParticipantIdV1,
      participantCapability,
      knownRevision,
      clientBuildId,
    });
    return Object.freeze({ ok: true as const, value });
  } catch {
    return failure([
      protocolIssue('INVALID_DESCRIPTOR', '', 'Protocol message could not be inspected safely'),
    ]);
  }
}

export function noProtocolIssues(): readonly [] {
  return emptyFrozenArray<never>() as readonly [];
}
