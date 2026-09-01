import { validateOnlineCommandEnvelopeV1 } from '../protocol/index';
import { validateOnlineTabletopIntentEnvelopeV1 } from '../tabletopManual/index';
import {
  validateOnlineParticipantProjectionAny,
  type OnlineParticipantProjectionV1,
} from '../projection/index';
import { CURRENT_CONTRACT_VERSIONS, validateBuildId } from '../../versioning/index';
import type {
  OnlineBrowserCancelScheduleV1,
  OnlineBrowserCommandSettlementV1,
  OnlineBrowserCommandIntentV1,
  OnlineBrowserIssueCodeV1,
  OnlineBrowserPendingCommandV1,
  OnlineBrowserScheduleHandleV1,
  OnlineBrowserScheduleV1,
  OnlineBrowserSocketFactoryV1,
  OnlineBrowserSocketV1,
  OnlineBrowserStateV1,
  OnlineBrowserSharedUndoIntentV1,
  OnlineBrowserManualCombatDamageIntentV1,
  OnlineBrowserTabletopIntentV1,
  OnlineBrowserSubmitResultV1,
  OnlineBrowserSubscriptionV1,
  OnlineBrowserUnsubscribeV1,
  OnlineBrowserWebSocketClientConfigV1,
  OnlineBrowserWebSocketClientV1,
} from './types';
import { validateOnlineVisibilityIntentV1 } from '../visibilityDecisions/index';
import type { OnlineBrowserVisibilityIntentV1 } from './types';
import {
  ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1,
  ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1,
} from './types';

const MAX_SERIALIZED_FRAME_BYTES_V1 = 65_536;
const APPLICATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const MINIMUM_CAPABILITY_FRAGMENT_LENGTH = 8;
const CORE_BASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const CORE_INCARNATION_PATTERN = /^(0|[1-9][0-9]*)$/u;
const ROOM_ROUTE_PREFIX = '/api/online/rooms/';
const ROOM_ROUTE_SUFFIX = '/websocket';
const ROOM_ROLES = new Set(['player', 'table', 'spectator']);

/** Browser-local wire validator.  Keeping this tiny parser here avoids a
 * dependency from the transport client into the Core implementation while
 * preserving the canonical object-id grammar used at the protocol boundary. */
function canonicalObjectId(value: string): boolean {
  const validBase = (candidate: string): boolean => CORE_BASE_ID_PATTERN.test(candidate);
  const validIncarnation = (candidate: string): boolean => {
    if (!CORE_INCARNATION_PATTERN.test(candidate)) return false;
    const parsed = Number(candidate);
    return Number.isSafeInteger(parsed) && parsed >= 0;
  };
  if (value.startsWith('@token:')) {
    const body = value.slice('@token:'.length);
    const separator = body.indexOf(':');
    return separator > 0 && separator === body.lastIndexOf(':') && separator < body.length - 1
      && validBase(body.slice(0, separator)) && validIncarnation(body.slice(separator + 1));
  }
  for (const prefix of ['@spell-copy:', '@activated-ability:', '@triggered-ability:'] as const) {
    if (value.startsWith(prefix)) return validBase(value.slice(prefix.length));
  }
  const separator = value.indexOf(':');
  return separator > 0 && separator === value.lastIndexOf(':') && separator < value.length - 1
    && validBase(value.slice(0, separator)) && validIncarnation(value.slice(separator + 1));
}
const PROTOCOL_ISSUE_CODES = new Set([
  'INVALID_ROOT', 'MISSING_FIELD', 'UNKNOWN_FIELD', 'INVALID_DESCRIPTOR', 'INVALID_TYPE',
  'INVALID_LITERAL', 'INVALID_VERSION', 'INVALID_ID', 'INVALID_CAPABILITY', 'INVALID_INTEGER',
  'INVALID_ARRAY', 'NON_DENSE_ARRAY', 'INVALID_BUILD_ID', 'INVALID_PROTOCOL_STATE',
  'PROTOCOL_VERSION_MISMATCH', 'ROOM_MISMATCH', 'AUTHORIZATION_REJECTED',
  'PARTICIPANT_NOT_CONNECTED', 'ROLE_NOT_ALLOWED', 'ROOM_NOT_ACTIVE', 'PLAYER_NOT_PENDING',
  'ACTOR_MISMATCH', 'COMMAND_SEQUENCE_MISMATCH', 'COMMAND_ID_REUSE_MISMATCH', 'STALE_REVISION',
  'CORE_COMMAND_REJECTED', 'CORE_RECONCILIATION_REJECTED',
]);
const PROJECTION_ISSUE_CODES = new Set([
  'INVALID_ROOT', 'MISSING_FIELD', 'UNKNOWN_FIELD', 'INVALID_DESCRIPTOR', 'INVALID_TYPE',
  'INVALID_LITERAL', 'INVALID_VERSION', 'INVALID_ID', 'INVALID_CAPABILITY', 'INVALID_INTEGER',
  'INVALID_ARRAY', 'NON_DENSE_ARRAY', 'INVALID_BUILD_ID', 'PROTOCOL_VERSION_MISMATCH',
  'AUTHORIZATION_REJECTED', 'PROJECTION_REJECTED', 'INVALID_PROTOCOL_STATE', 'INVALID_RELATION',
  'DUPLICATE_VALUE',
]);

type MutableConfigV1 = Readonly<{
  readonly webSocketUrl: string;
  readonly protocolVersion: number;
  readonly roomId: string;
  readonly participantId: string;
  readonly ['participantCapability']: string;
  readonly clientBuildId: string;
  readonly socketFactory: OnlineBrowserSocketFactoryV1;
  readonly schedule: OnlineBrowserScheduleV1;
  readonly cancelSchedule: OnlineBrowserCancelScheduleV1;
}>;

type PendingEntryV1 =
  | Readonly<{
    readonly commandId: string;
    readonly baseRevision: number;
    readonly kind: 'command';
    readonly command: OnlineBrowserCommandIntentV1['command'];
    readonly fingerprint: string;
  }>
  | Readonly<{
    readonly commandId: string;
    readonly baseRevision: number;
    readonly kind: 'tabletop';
    readonly tabletop: OnlineBrowserTabletopIntentV1;
    readonly fingerprint: string;
  }>
  | Readonly<{
    readonly commandId: string;
    readonly baseRevision: number;
    readonly kind: 'visibility';
    readonly visibility: OnlineBrowserVisibilityIntentV1;
    readonly fingerprint: string;
  }>
  | Readonly<{
    readonly commandId: string;
    readonly baseRevision: number;
    readonly kind: 'sharedUndo';
    readonly sharedUndo: OnlineBrowserSharedUndoIntentV1;
    readonly fingerprint: string;
  }>
  | Readonly<{
    readonly commandId: string;
    readonly baseRevision: number;
    readonly kind: 'manualCombatDamage';
    readonly manualCombatDamage: OnlineBrowserManualCombatDamageIntentV1;
    readonly fingerprint: string;
  }>;

type SocketEpochV1 = Readonly<{
  readonly socket: OnlineBrowserSocketV1;
  readonly epoch: number;
}>;

type ParsedRecordV1 = Record<string, unknown>;

function ownDataValue(record: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function closedRecord(value: unknown, expectedKeys: readonly string[]): value is ParsedRecordV1 {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype: object | null = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (Object.getOwnPropertySymbols(value).length !== 0) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Object.getOwnPropertyNames(value).sort();
    const expected = [...expectedKeys].sort();
    if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) return false;
    return names.every((name) => {
      const descriptor = descriptors[name];
      return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor
        && descriptor.get === undefined && descriptor.set === undefined;
    });
  } catch {
    return false;
  }
}

function validSharedUndoPayload(value: unknown): value is OnlineBrowserSharedUndoIntentV1 {
  if (!closedRecord(value, ['baseRevision', 'commandId', 'kind', 'schemaVersion'])) return false;
  const commandId = ownDataValue(value, 'commandId');
  const baseRevision = ownDataValue(value, 'baseRevision');
  return ownDataValue(value, 'kind') === 'online-shared-undo-intent-v1'
    && ownDataValue(value, 'schemaVersion') === 1
    && typeof commandId === 'string' && APPLICATION_ID_PATTERN.test(commandId)
    && nonNegativeInteger(baseRevision);
}

function validManualCombatDamagePayload(value: unknown): value is OnlineBrowserManualCombatDamageIntentV1 {
  if (!closedRecord(value, ['baseRevision', 'commanderObjectId', 'commandId', 'damage', 'defendingPlayerId', 'kind', 'schemaVersion'])) return false;
  const commandId = ownDataValue(value, 'commandId');
  const baseRevision = ownDataValue(value, 'baseRevision');
  const defender = ownDataValue(value, 'defendingPlayerId');
  const damage = ownDataValue(value, 'damage');
  const commanderObjectId = ownDataValue(value, 'commanderObjectId');
  return ownDataValue(value, 'kind') === 'online-manual-combat-damage-intent-v1'
    && ownDataValue(value, 'schemaVersion') === 1
    && typeof commandId === 'string' && APPLICATION_ID_PATTERN.test(commandId)
    && nonNegativeInteger(baseRevision)
    && typeof defender === 'string' && applicationId(defender)
    && typeof damage === 'number' && Number.isSafeInteger(damage) && damage > 0 && damage <= 120
    && (commanderObjectId === null || typeof commanderObjectId === 'string' && canonicalObjectId(commanderObjectId));
}

function closedVisibilityIntent(value: unknown): value is ParsedRecordV1 {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype: object | null = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (Object.getOwnPropertySymbols(value).length !== 0) return false;
    const allowed = new Set(['baseRevision', 'commandId', 'kind', 'schemaVersion', 'look', 'reveal', 'choose']);
    const required = new Set(['baseRevision', 'commandId', 'kind', 'schemaVersion']);
    const names = Object.getOwnPropertyNames(value);
    if (names.some((name) => !allowed.has(name)) || [...required].some((name) => !names.includes(name))) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return names.every((name) => {
      const descriptor = descriptors[name];
      return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor
        && descriptor.get === undefined && descriptor.set === undefined;
    });
  } catch {
    return false;
  }
}

function denseArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    if (Object.getOwnPropertySymbols(value).length !== 0) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor)
      || typeof lengthDescriptor.value !== 'number' || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0) return null;
    const length = lengthDescriptor.value;
    const names = Object.getOwnPropertyNames(value).sort();
    const expected = [...Array.from({ length }, (_unused, index) => String(index)), 'length'].sort();
    if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true
        || descriptor.get !== undefined || descriptor.set !== undefined) return null;
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function applicationId(value: unknown): value is string {
  return typeof value === 'string' && APPLICATION_ID_PATTERN.test(value)
    && value !== '__proto__' && value !== 'prototype' && value !== 'constructor';
}

function capability(value: unknown): value is string {
  return typeof value === 'string' && CAPABILITY_PATTERN.test(value);
}

function capabilityFragmentPresent(value: unknown, configured: string): boolean {
  if (!configured) return false;
  let inspectedCodeUnits = 0;
  const hasFragment = (text: string): boolean => {
    inspectedCodeUnits += text.length;
    if (text.length > MAX_SERIALIZED_FRAME_BYTES_V1 || inspectedCodeUnits > MAX_SERIALIZED_FRAME_BYTES_V1) return true;
    if (text.includes(configured)) return true;
    for (let offset = 0; offset <= configured.length - MINIMUM_CAPABILITY_FRAGMENT_LENGTH; offset += 1) {
      if (text.includes(configured.slice(offset, offset + MINIMUM_CAPABILITY_FRAGMENT_LENGTH))) return true;
    }
    return false;
  };
  const seen = new Set<object>();
  const pendingValues: unknown[] = [value];
  let inspected = 0;
  while (pendingValues.length > 0) {
    const current = pendingValues.pop();
    if (typeof current === 'string') {
      if (hasFragment(current)) return true;
      continue;
    }
    if (current === null || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);
    inspected += 1;
    if (inspected > 10_000) return true;
    let keys: readonly PropertyKey[];
    try { keys = Reflect.ownKeys(current); } catch { return true; }
    for (const key of keys) {
      if (typeof key !== 'string') return true;
      if (hasFragment(key)) return true;
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(current, key); } catch { return true; }
      if (descriptor === undefined || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return true;
      pendingValues.push(descriptor.value);
    }
  }
  return false;
}

function serializedBytes(value: string): number {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function validWebSocketUrl(value: string, roomId: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return false;
    if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return false;
    const expectedPath = `${ROOM_ROUTE_PREFIX}${encodeURIComponent(roomId)}${ROOM_ROUTE_SUFFIX}`;
    return url.pathname === expectedPath;
  } catch {
    return false;
  }
}

function defaultSocketFactory(url: string): OnlineBrowserSocketV1 {
  const constructorValue = globalThis.WebSocket;
  if (typeof constructorValue !== 'function') throw new Error('WebSocket is unavailable');
  return new constructorValue(url) as unknown as OnlineBrowserSocketV1;
}

function defaultSchedule(delayMs: number, task: () => void): OnlineBrowserScheduleHandleV1 {
  return setTimeout(task, delayMs);
}

function defaultCancelSchedule(handle: OnlineBrowserScheduleHandleV1): void {
  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

function readConfig(input: unknown): MutableConfigV1 | null {
  try {
    if (!closedRecord(input, [
      'webSocketUrl', 'protocolVersion', 'roomId', 'participantId', 'participantCapability',
      'clientBuildId', 'socketFactory', 'schedule', 'cancelSchedule',
    ])) {
      // Optional adapter fields are allowed to be absent, but no other fields are.
      if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
      const prototype: object | null = Reflect.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) return null;
      if (Object.getOwnPropertySymbols(input).length !== 0) return null;
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const names = Object.getOwnPropertyNames(input);
      const allowed = new Set([
        'webSocketUrl', 'protocolVersion', 'roomId', 'participantId', 'participantCapability',
        'clientBuildId', 'socketFactory', 'schedule', 'cancelSchedule',
      ]);
      if (names.some((name) => !allowed.has(name))) return null;
      if (names.some((name) => {
        const descriptor = descriptors[name];
        return descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)
          || descriptor.get !== undefined || descriptor.set !== undefined;
      })) return null;
    }
    const record = input;
    const webSocketUrl = ownDataValue(record, 'webSocketUrl');
    const protocolVersion = ownDataValue(record, 'protocolVersion');
    const roomId = ownDataValue(record, 'roomId');
    const participantId = ownDataValue(record, 'participantId');
    const participantCapability = ownDataValue(record, 'participantCapability');
    const clientBuildId = ownDataValue(record, 'clientBuildId');
    const socketFactoryValue = ownDataValue(record, 'socketFactory');
    const scheduleValue = ownDataValue(record, 'schedule');
    const cancelScheduleValue = ownDataValue(record, 'cancelSchedule');
    if (typeof webSocketUrl !== 'string' || !nonNegativeInteger(protocolVersion)
      || !applicationId(roomId) || !applicationId(participantId) || !capability(participantCapability)
      || typeof clientBuildId !== 'string' || !validateBuildId(clientBuildId).ok
      || (socketFactoryValue !== undefined && typeof socketFactoryValue !== 'function')
      || (scheduleValue !== undefined && typeof scheduleValue !== 'function')
      || (cancelScheduleValue !== undefined && typeof cancelScheduleValue !== 'function')) return null;
    return Object.freeze({
      webSocketUrl,
      protocolVersion,
      roomId,
      participantId,
      participantCapability,
      clientBuildId,
      socketFactory: (socketFactoryValue as OnlineBrowserSocketFactoryV1 | undefined) ?? defaultSocketFactory,
      schedule: (scheduleValue as OnlineBrowserScheduleV1 | undefined) ?? defaultSchedule,
      cancelSchedule: (cancelScheduleValue as OnlineBrowserCancelScheduleV1 | undefined) ?? defaultCancelSchedule,
    });
  } catch {
    return null;
  }
}

function parseFrame(data: unknown, configuredCapability: string): ParsedRecordV1 | null {
  try {
    if (typeof data !== 'string' || data.length === 0 || serializedBytes(data) > MAX_SERIALIZED_FRAME_BYTES_V1) return null;
    const parsed: unknown = JSON.parse(data);
    if (!closedRecord(parsed, Object.getOwnPropertyNames(parsed))) return null;
    if (capabilityFragmentPresent(parsed, configuredCapability)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function issueArray(value: unknown, projection: boolean): boolean {
  const values = denseArray(value);
  if (values === null) return false;
  return values.every((entry) => {
    if (!closedRecord(entry, ['code', 'message', 'path'])) return false;
    const code = ownDataValue(entry, 'code');
    const path = ownDataValue(entry, 'path');
    const message = ownDataValue(entry, 'message');
    return typeof code === 'string' && (projection ? PROJECTION_ISSUE_CODES.has(code) : PROTOCOL_ISSUE_CODES.has(code))
      && typeof path === 'string' && typeof message === 'string';
  });
}

function issueCodeFrom(value: unknown, projection: boolean): OnlineBrowserIssueCodeV1 | null {
  const values = denseArray(value);
  if (values === null || values.length === 0) return null;
  const first = values[0];
  if (!closedRecord(first, ['code', 'message', 'path'])) return null;
  const code = ownDataValue(first, 'code');
  if (typeof code !== 'string' || (projection ? !PROJECTION_ISSUE_CODES.has(code) : !PROTOCOL_ISSUE_CODES.has(code))) return null;
  return code as OnlineBrowserIssueCodeV1;
}

function closeSocket(socket: OnlineBrowserSocketV1): void {
  try { socket.close(1000, 'client disconnect'); } catch { /* A closed socket is already inert. */ }
}

function frozenSubmitResult(result: OnlineBrowserSubmitResultV1): OnlineBrowserSubmitResultV1 {
  return Object.freeze(result);
}

export function createOnlineBrowserWebSocketClientV1(
  input: OnlineBrowserWebSocketClientConfigV1,
): OnlineBrowserWebSocketClientV1 {
  const parsedConfig = readConfig(input);
  const config = parsedConfig ?? Object.freeze({
    webSocketUrl: '',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: '',
    participantId: '',
    ['participantCapability']: '',
    clientBuildId: '',
    socketFactory: defaultSocketFactory,
    schedule: defaultSchedule,
    cancelSchedule: defaultCancelSchedule,
  });
  const configValid = parsedConfig !== null
    && config.protocolVersion === CURRENT_CONTRACT_VERSIONS.protocolVersion
    && validWebSocketUrl(config.webSocketUrl, config.roomId)
    && !capabilityFragmentPresent(config.webSocketUrl, config.participantCapability)
    && !capabilityFragmentPresent({ roomId: config.roomId, participantId: config.participantId, clientBuildId: config.clientBuildId }, config.participantCapability);
  const publicRoomId = (configValid ? config.roomId : '') as OnlineBrowserStateV1['roomId'];
  const publicParticipantId = (configValid ? config.participantId : '') as OnlineBrowserStateV1['participantId'];

  let phase: OnlineBrowserStateV1['phase'] = configValid ? 'idle' : 'failed';
  let connectionEpoch = 0;
  let knownRevision = 0;
  let projection: OnlineParticipantProjectionV1 | null = null;
  let recoveryAttempt = 0;
  let issueCode: OnlineBrowserIssueCodeV1 | null = configValid
    ? null
    : parsedConfig !== null && !validWebSocketUrl(config.webSocketUrl, config.roomId)
      ? 'INVALID_URL'
      : 'INVALID_CONFIG';
  let currentSocket: SocketEpochV1 | null = null;
  let scheduledRecovery: OnlineBrowserScheduleHandleV1 | null = null;
  let scheduleGeneration = 0;
  let projectionRequestSent = false;
  let requestedProjectionRevision = -1;
  let lastProjectedRevision = -1;
  let currentReadyRevision: number | null = null;
  let acceptedServerBuildId: string | null = null;
  let lastCommandSettlement: OnlineBrowserCommandSettlementV1 | null = null;
  let recoveryOutcome: OnlineBrowserStateV1['recoveryOutcome'] = null;
  const pending: PendingEntryV1[] = [];
  const settled = new Map<string, string>();
  const listeners = new Set<OnlineBrowserSubscriptionV1>();

  const redactedPending = (): readonly OnlineBrowserPendingCommandV1[] => Object.freeze(
    pending.map((entry) => Object.freeze({ commandId: entry.commandId as OnlineBrowserPendingCommandV1['commandId'], baseRevision: entry.baseRevision })),
  );

  let snapshot: OnlineBrowserStateV1 = Object.freeze({
    phase,
    roomId: publicRoomId,
    participantId: publicParticipantId,
    connectionEpoch,
    knownRevision,
    projection,
    pendingCommands: redactedPending(),
    lastCommandSettlement,
    recoveryOutcome,
    recoveryAttempt,
    issueCode,
  });

  const publish = (): void => {
    snapshot = Object.freeze({
      phase,
      roomId: publicRoomId,
      participantId: publicParticipantId,
      connectionEpoch,
      knownRevision,
      projection,
      pendingCommands: redactedPending(),
      lastCommandSettlement,
      recoveryOutcome,
      recoveryAttempt,
      issueCode,
    });
    for (const listener of [...listeners]) {
      try { listener(snapshot); } catch { /* Subscriber failures cannot affect transport state. */ }
    }
  };

  const current = (socket: OnlineBrowserSocketV1, epoch: number): boolean =>
    currentSocket !== null && currentSocket.socket === socket && currentSocket.epoch === epoch;

  const failConnection = (socket: OnlineBrowserSocketV1, epoch: number, code: OnlineBrowserIssueCodeV1): void => {
    if (!current(socket, epoch)) return;
    currentSocket = null;
    phase = 'failed';
    issueCode = code;
    recoveryOutcome = null;
    closeSocket(socket);
    publish();
  };

  const sendFrame = (socket: OnlineBrowserSocketV1, value: unknown): boolean => {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined || serializedBytes(serialized) > MAX_SERIALIZED_FRAME_BYTES_V1) return false;
      socket.send(serialized);
      return true;
    } catch {
      return false;
    }
  };

  const cancelRecovery = (): void => {
    scheduleGeneration += 1;
    if (scheduledRecovery !== null) {
      try { config.cancelSchedule(scheduledRecovery); } catch { /* Cancellation is best effort. */ }
      scheduledRecovery = null;
    }
  };

  const replayPending = (socket: OnlineBrowserSocketV1, epoch: number): void => {
    for (const entry of [...pending]) {
      if (!current(socket, epoch) || phase !== 'open') return;
      if (!pending.some((candidate) => candidate.commandId === entry.commandId && candidate.fingerprint === entry.fingerprint)) continue;
      const envelope = entry.kind === 'tabletop'
        ? Object.freeze({
          ...entry.tabletop,
          protocolVersion: config.protocolVersion,
          roomId: config.roomId,
          participantId: config.participantId,
          ['participantCapability']: config.participantCapability,
        })
        : entry.kind === 'visibility'
        ? Object.freeze({
          ...entry.visibility,
          protocolVersion: config.protocolVersion,
          roomId: config.roomId,
          participantId: config.participantId,
          ['participantCapability']: config.participantCapability,
        })
        : entry.kind === 'sharedUndo'
        ? Object.freeze({
          ...entry.sharedUndo,
          protocolVersion: config.protocolVersion,
          roomId: config.roomId,
          participantId: config.participantId,
          ['participantCapability']: config.participantCapability,
        })
        : entry.kind === 'manualCombatDamage'
        ? Object.freeze({
          ...entry.manualCombatDamage,
          protocolVersion: config.protocolVersion,
          roomId: config.roomId,
          participantId: config.participantId,
          ['participantCapability']: config.participantCapability,
        })
        : Object.freeze({
          kind: 'online-command-envelope-v1' as const,
          protocolVersion: config.protocolVersion,
          roomId: config.roomId,
          participantId: config.participantId,
          ['participantCapability']: config.participantCapability,
          commandId: entry.commandId,
          baseRevision: entry.baseRevision,
          command: entry.command,
        });
      const validation = entry.kind === 'tabletop'
        ? validateOnlineTabletopIntentEnvelopeV1(entry.tabletop)
        : entry.kind === 'visibility'
        ? validateOnlineVisibilityIntentV1(entry.visibility)
        : entry.kind === 'sharedUndo'
        ? { ok: validSharedUndoPayload(entry.sharedUndo) }
        : entry.kind === 'manualCombatDamage'
        ? { ok: validManualCombatDamagePayload(entry.manualCombatDamage) }
        : validateOnlineCommandEnvelopeV1(envelope);
      const validationOk = typeof validation === 'boolean' ? validation : validation.ok;
      if (!validationOk || !sendFrame(socket, envelope)) {
        issueCode = validationOk ? 'SEND_FAILED' : 'INVALID_COMMAND';
        beginRecovery(socket, epoch, issueCode);
        return;
      }
    }
  };

  const scheduleRecovery = (reason: OnlineBrowserIssueCodeV1 | null): void => {
    if (phase === 'closed' || phase === 'failed') return;
    if (recoveryAttempt >= ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1.length) {
      phase = 'failed';
      issueCode = 'RECONNECT_EXHAUSTED';
      publish();
      return;
    }
    phase = 'recovering';
    issueCode = reason;
    recoveryOutcome = null;
    recoveryAttempt += 1;
    publish();
    const delay = ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1[recoveryAttempt - 1];
    const generation = ++scheduleGeneration;
    try {
      scheduledRecovery = config.schedule(delay, () => {
        if (generation !== scheduleGeneration || phase !== 'recovering') return;
        scheduledRecovery = null;
        openSocket();
      });
    } catch {
      scheduledRecovery = null;
      phase = 'failed';
      issueCode = 'SOCKET_ERROR';
      publish();
    }
  };

  const beginRecovery = (socket: OnlineBrowserSocketV1, epoch: number, reason: OnlineBrowserIssueCodeV1 | null): void => {
    if (!current(socket, epoch) || phase === 'closed' || phase === 'failed') return;
    currentSocket = null;
    if (reason !== 'SOCKET_CLOSED') closeSocket(socket);
    scheduleRecovery(reason);
  };

  const handleProjectionRequest = (socket: OnlineBrowserSocketV1, epoch: number): void => {
    if (!current(socket, epoch) || projectionRequestSent || phase === 'closed' || phase === 'failed') return;
    projectionRequestSent = true;
    requestedProjectionRevision = knownRevision;
    phase = 'resyncing';
    publish();
    const request = Object.freeze({
      kind: 'online-projection-request-v1' as const,
      protocolVersion: config.protocolVersion,
      roomId: config.roomId,
      participantId: config.participantId,
      ['participantCapability']: config.participantCapability,
      knownRevision,
      clientBuildId: config.clientBuildId,
      decisionContext: null,
    });
    if (!sendFrame(socket, request)) beginRecovery(socket, epoch, 'SEND_FAILED');
  };

  const handleInbound = (socket: OnlineBrowserSocketV1, epoch: number, record: ParsedRecordV1): void => {
    if (!current(socket, epoch)) return;
    const kind = ownDataValue(record, 'kind');
    if (kind === 'online-cloudflare-websocket-ready-v1') {
      if (phase !== 'awaiting-ready') return;
      if (!closedRecord(record, ['authenticationRequired', 'kind', 'revision', 'roomId', 'schemaVersion', 'transport'])
        || ownDataValue(record, 'schemaVersion') !== 1
        || ownDataValue(record, 'roomId') !== config.roomId
        || !nonNegativeInteger(ownDataValue(record, 'revision'))
        || ownDataValue(record, 'transport') !== 'hibernation'
        || ownDataValue(record, 'authenticationRequired') !== true) { issueCode = 'INVALID_FRAME'; publish(); return; }
      const readyRevision = ownDataValue(record, 'revision') as number;
      if (readyRevision < knownRevision || readyRevision < lastProjectedRevision) {
        failConnection(socket, epoch, 'INVALID_FRAME');
        return;
      }
      currentReadyRevision = readyRevision;
      phase = 'authenticating';
      issueCode = null;
      publish();
      const hello = Object.freeze({
        kind: 'online-client-hello-v1' as const,
        protocolVersion: config.protocolVersion,
        roomId: config.roomId,
        participantId: config.participantId,
        ['participantCapability']: config.participantCapability,
        clientBuildId: config.clientBuildId,
      });
      if (!sendFrame(socket, hello)) beginRecovery(socket, epoch, 'SEND_FAILED');
      return;
    }
    if (kind === 'online-cloudflare-websocket-error-v1') {
      if (!closedRecord(record, ['code', 'kind', 'schemaVersion']) || ownDataValue(record, 'schemaVersion') !== 1
        || typeof ownDataValue(record, 'code') !== 'string') { issueCode = 'INVALID_FRAME'; publish(); return; }
      const code = ownDataValue(record, 'code');
      issueCode = code === 'AUTHENTICATION_REQUIRED' || code === 'CAPABILITY_REJECTED'
        || code === 'IDENTITY_MISMATCH' || code === 'ROLE_NOT_ALLOWED'
        ? 'AUTHENTICATION_REJECTED' : code === 'INVALID_MESSAGE' ? 'INVALID_FRAME' : 'SOCKET_ERROR';
      phase = 'failed';
      const active = currentSocket;
      currentSocket = null;
      if (active !== null) closeSocket(active.socket);
      publish();
      return;
    }
    if (kind === 'online-cloudflare-revision-v1') {
      if (!closedRecord(record, ['kind', 'revision', 'roomId', 'schemaVersion'])
        || ownDataValue(record, 'schemaVersion') !== 1 || ownDataValue(record, 'roomId') !== config.roomId
        || !nonNegativeInteger(ownDataValue(record, 'revision'))) { issueCode = 'INVALID_FRAME'; publish(); return; }
      if (phase !== 'open' && phase !== 'resyncing') return;
      const revision = ownDataValue(record, 'revision') as number;
      if (revision < lastProjectedRevision) return;
      if (revision > knownRevision) {
        knownRevision = revision;
        publish();
      }
      handleProjectionRequest(socket, epoch);
      return;
    }
    if (kind === 'online-server-hello-v1') {
      if (phase !== 'authenticating') return;
      const keysAccepted = ['clientBuildIdMatch', 'issues', 'kind', 'participantId', 'protocolVersion', 'revision', 'role', 'roomId', 'serverBuildId', 'status'] as const;
      const keysRejected = ['clientBuildIdMatch', 'issues', 'kind', 'participantId', 'protocolVersion', 'revision', 'role', 'roomId', 'serverBuildId', 'status'] as const;
      if (!closedRecord(record, keysAccepted) && !closedRecord(record, keysRejected)) { issueCode = 'INVALID_FRAME'; publish(); return; }
      if (ownDataValue(record, 'protocolVersion') !== config.protocolVersion || !nonNegativeInteger(ownDataValue(record, 'revision'))
        || !validateBuildId(ownDataValue(record, 'serverBuildId')).ok) { issueCode = 'INVALID_FRAME'; publish(); return; }
      const serverRevision = ownDataValue(record, 'revision') as number;
      if (currentReadyRevision === null || serverRevision < currentReadyRevision || serverRevision < knownRevision || serverRevision < lastProjectedRevision) {
        failConnection(socket, epoch, 'INVALID_FRAME');
        return;
      }
      const status = ownDataValue(record, 'status');
      const issues = ownDataValue(record, 'issues');
      const isAccepted = status === 'accepted';
      if (!issueArray(issues, false) || (isAccepted && (ownDataValue(record, 'roomId') !== config.roomId
        || ownDataValue(record, 'participantId') !== config.participantId || !ROOM_ROLES.has(String(ownDataValue(record, 'role')))
        || ownDataValue(record, 'clientBuildIdMatch') !== true && ownDataValue(record, 'clientBuildIdMatch') !== false
        || denseArray(issues)?.length !== 0))
        || (!isAccepted && (status !== 'rejected' || ownDataValue(record, 'roomId') !== null
          || ownDataValue(record, 'participantId') !== null || ownDataValue(record, 'role') !== null
          || ownDataValue(record, 'clientBuildIdMatch') !== null))) { issueCode = 'INVALID_FRAME'; publish(); return; }
      if (!isAccepted) {
        issueCode = issueCodeFrom(issues, false) ?? 'AUTHENTICATION_REJECTED';
        phase = 'failed';
        const active = currentSocket;
        currentSocket = null;
        if (active !== null) closeSocket(active.socket);
        publish();
        return;
      }
      acceptedServerBuildId = ownDataValue(record, 'serverBuildId') as string;
      if (serverRevision > knownRevision) knownRevision = serverRevision;
      issueCode = null;
      publish();
      handleProjectionRequest(socket, epoch);
      return;
    }
    if (kind === 'online-projected-snapshot-v1') {
      if (phase !== 'resyncing') return;
      const keysAccepted = ['clientBuildIdMatch', 'issues', 'knownRevision', 'kind', 'participantId', 'projection', 'protocolVersion', 'reason', 'revision', 'role', 'roomId', 'serverBuildId', 'status'] as const;
      if (!closedRecord(record, keysAccepted) || ownDataValue(record, 'protocolVersion') !== config.protocolVersion
        || !nonNegativeInteger(ownDataValue(record, 'revision')) || !validateBuildId(ownDataValue(record, 'serverBuildId')).ok) { issueCode = 'INVALID_FRAME'; publish(); return; }
      const status = ownDataValue(record, 'status');
      const issues = ownDataValue(record, 'issues');
      const serverBuildId = ownDataValue(record, 'serverBuildId');
      if (acceptedServerBuildId !== null && serverBuildId !== acceptedServerBuildId) { issueCode = 'INVALID_FRAME'; publish(); return; }
      if (status === 'rejected') {
        if (ownDataValue(record, 'roomId') !== null || ownDataValue(record, 'participantId') !== null
          || ownDataValue(record, 'role') !== null || ownDataValue(record, 'knownRevision') !== null
          || ownDataValue(record, 'clientBuildIdMatch') !== null || ownDataValue(record, 'reason') !== null
          || ownDataValue(record, 'projection') !== null || !issueArray(issues, true)) { issueCode = 'INVALID_FRAME'; publish(); return; }
        issueCode = issueCodeFrom(issues, true) ?? 'PROJECTION_REJECTED';
        phase = 'failed';
        const active = currentSocket;
        currentSocket = null;
        if (active !== null) closeSocket(active.socket);
        publish();
        return;
      }
      if (status !== 'accepted' || !issueArray(issues, true) || denseArray(issues)?.length !== 0
        || ownDataValue(record, 'roomId') !== config.roomId || ownDataValue(record, 'participantId') !== config.participantId
        || !ROOM_ROLES.has(String(ownDataValue(record, 'role'))) || !nonNegativeInteger(ownDataValue(record, 'knownRevision'))
        || (ownDataValue(record, 'knownRevision') as number) > (ownDataValue(record, 'revision') as number)
        || (ownDataValue(record, 'clientBuildIdMatch') !== true && ownDataValue(record, 'clientBuildIdMatch') !== false)
        || !['synchronized', 'snapshot-required', 'rejoined'].includes(String(ownDataValue(record, 'reason')))) { issueCode = 'INVALID_FRAME'; publish(); return; }
      const revision = ownDataValue(record, 'revision') as number;
      const resyncReason = ownDataValue(record, 'reason');
      if (currentReadyRevision !== null && revision < currentReadyRevision) {
        failConnection(socket, epoch, 'INVALID_FRAME');
        return;
      }
      if (revision < knownRevision) {
        if (projectionRequestSent && requestedProjectionRevision < knownRevision) {
          projectionRequestSent = false;
          handleProjectionRequest(socket, epoch);
        }
        return;
      }
      const projectionResult = validateOnlineParticipantProjectionAny(ownDataValue(record, 'projection'));
      if (!projectionResult.ok) { issueCode = 'PROJECTION_REJECTED'; publish(); return; }
      const accepted = projectionResult.value;
      if (accepted.roomId !== config.roomId || accepted.participantId !== config.participantId
        || accepted.protocolVersion !== config.protocolVersion || accepted.revision !== revision
        || accepted.role !== ownDataValue(record, 'role')) { issueCode = 'PROJECTION_REJECTED'; publish(); return; }
      knownRevision = revision;
      projection = accepted;
      lastProjectedRevision = revision;
      projectionRequestSent = false;
      requestedProjectionRevision = -1;
      recoveryAttempt = 0;
      phase = 'open';
      issueCode = null;
      if (resyncReason === 'rejoined') recoveryOutcome = 'rejoined';
      publish();
      replayPending(socket, epoch);
      return;
    }
    if (kind === 'online-command-ack-v1' || kind === 'online-command-reject-v1') {
      if (phase !== 'open') return;
      const isAck = kind === 'online-command-ack-v1';
      const keys = isAck
        ? ['acceptedRevision', 'baseRevision', 'commandId', 'currentRevision', 'duplicate', 'kind', 'participantId', 'protocolVersion', 'roomId', 'status'] as const
        : ['baseRevision', 'commandId', 'currentRevision', 'duplicate', 'issues', 'kind', 'participantId', 'protocolVersion', 'resyncRequired', 'roomId'] as const;
      if (!closedRecord(record, keys)) { issueCode = 'INVALID_FRAME'; publish(); return; }
      if (ownDataValue(record, 'protocolVersion') !== config.protocolVersion || ownDataValue(record, 'roomId') !== config.roomId
        || ownDataValue(record, 'participantId') !== config.participantId) return;
      if (!applicationId(ownDataValue(record, 'commandId'))
        || !nonNegativeInteger(ownDataValue(record, 'baseRevision')) || !nonNegativeInteger(ownDataValue(record, 'currentRevision'))
        || ownDataValue(record, 'duplicate') !== true && ownDataValue(record, 'duplicate') !== false) { issueCode = 'INVALID_FRAME'; publish(); return; }
      if (isAck && (!nonNegativeInteger(ownDataValue(record, 'acceptedRevision'))
        || (ownDataValue(record, 'status') !== 'accepted' && ownDataValue(record, 'status') !== 'accepted-with-warning')
        || (ownDataValue(record, 'acceptedRevision') as number) < (ownDataValue(record, 'baseRevision') as number)
        || (ownDataValue(record, 'acceptedRevision') as number) > (ownDataValue(record, 'currentRevision') as number)
        || (ownDataValue(record, 'baseRevision') as number) > (ownDataValue(record, 'currentRevision') as number))) { issueCode = 'INVALID_FRAME'; publish(); return; }
      if (!isAck && (ownDataValue(record, 'resyncRequired') !== true && ownDataValue(record, 'resyncRequired') !== false)
        || (!isAck && !issueArray(ownDataValue(record, 'issues'), false))
        || (!isAck && (ownDataValue(record, 'baseRevision') as number) > (ownDataValue(record, 'currentRevision') as number))) { issueCode = 'INVALID_FRAME'; publish(); return; }
      const currentRevision = ownDataValue(record, 'currentRevision') as number;
      if (currentRevision < knownRevision) return;
      const commandId = ownDataValue(record, 'commandId') as string;
      const baseRevision = ownDataValue(record, 'baseRevision') as number;
      const index = pending.findIndex((entry) => entry.commandId === commandId && entry.baseRevision === baseRevision);
      if (index < 0) return;
      const settledEntry = pending[index];
      if (settledEntry !== undefined) settled.set(settledEntry.commandId, settledEntry.fingerprint);
      knownRevision = Math.max(knownRevision, currentRevision, isAck ? ownDataValue(record, 'acceptedRevision') as number : 0);
      const requiresProjectionResync = isAck && currentRevision > lastProjectedRevision;
      pending.splice(index, 1);
      const settlementIssue = isAck
        ? null
        : issueCodeFrom(ownDataValue(record, 'issues'), false) ?? 'SOCKET_ERROR';
      issueCode = settlementIssue;
      if (settledEntry !== undefined) {
        lastCommandSettlement = Object.freeze({
          commandId: settledEntry.commandId as OnlineBrowserCommandSettlementV1['commandId'],
          baseRevision: settledEntry.baseRevision,
          currentRevision,
          acceptedRevision: isAck ? ownDataValue(record, 'acceptedRevision') as number : null,
          commandKind: settledEntry.kind,
          operation: settledEntry.kind === 'tabletop' ? settledEntry.tabletop.primitive.kind : null,
          outcome: isAck ? 'accepted' : 'rejected',
          issueCode: settlementIssue,
        });
      }
      publish();
      if (requiresProjectionResync) handleProjectionRequest(socket, epoch);
      else if (!isAck && ownDataValue(record, 'resyncRequired') === true) handleProjectionRequest(socket, epoch);
      return;
    }
    issueCode = 'INVALID_FRAME';
    publish();
  };

  function openSocket(): void {
    if (phase === 'closed' || phase === 'failed' || !configValid) return;
    connectionEpoch += 1;
    const epoch = connectionEpoch;
    phase = 'connecting';
    recoveryOutcome = null;
    projectionRequestSent = false;
    currentReadyRevision = null;
    publish();
    let socket: OnlineBrowserSocketV1;
    try { socket = config.socketFactory(config.webSocketUrl); } catch { scheduleRecovery('SOCKET_ERROR'); return; }
    if (socket === null || typeof socket !== 'object') { scheduleRecovery('SOCKET_ERROR'); return; }
    currentSocket = Object.freeze({ socket, epoch });
    try {
      socket.onopen = () => {
        if (!current(socket, epoch)) return;
        phase = 'awaiting-ready';
        issueCode = null;
        publish();
      };
      socket.onmessage = (event) => {
        if (!current(socket, epoch)) return;
        let data: unknown;
        try { data = event.data; } catch { issueCode = 'INVALID_FRAME'; publish(); return; }
        const parsed = parseFrame(data, config.participantCapability);
        if (parsed === null) { issueCode = 'INVALID_FRAME'; publish(); return; }
        handleInbound(socket, epoch, parsed);
      };
      socket.onerror = () => {
        if (!current(socket, epoch)) return;
        beginRecovery(socket, epoch, 'SOCKET_ERROR');
      };
      socket.onclose = () => {
        if (!current(socket, epoch)) return;
        beginRecovery(socket, epoch, 'SOCKET_CLOSED');
      };
    } catch {
      currentSocket = null;
      scheduleRecovery('SOCKET_ERROR');
    }
  }

  const connect = (): void => {
    if (!configValid) return;
    if (phase === 'connecting' || phase === 'awaiting-ready' || phase === 'authenticating'
      || phase === 'resyncing' || phase === 'open') return;
    cancelRecovery();
    if (currentSocket !== null) {
      const previous = currentSocket.socket;
      currentSocket = null;
      closeSocket(previous);
    }
    recoveryAttempt = 0;
    issueCode = null;
    phase = 'idle';
    openSocket();
  };

  const disconnect = (): void => {
    cancelRecovery();
    if (currentSocket !== null) {
      const previous = currentSocket.socket;
      currentSocket = null;
      closeSocket(previous);
    }
    phase = 'closed';
    issueCode = null;
    recoveryOutcome = null;
    publish();
  };

  const submit = (intent: OnlineBrowserCommandIntentV1): OnlineBrowserSubmitResultV1 => {
    try {
      if (!closedRecord(intent, ['baseRevision', 'command', 'commandId'])
        || capabilityFragmentPresent(intent, config.participantCapability)) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const commandId = ownDataValue(intent, 'commandId');
      const baseRevision = ownDataValue(intent, 'baseRevision');
      const command = ownDataValue(intent, 'command');
      if (!applicationId(commandId) || !nonNegativeInteger(baseRevision)) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const envelopeValidation = validateOnlineCommandEnvelopeV1(Object.freeze({
        kind: 'online-command-envelope-v1' as const,
        protocolVersion: config.protocolVersion,
        roomId: config.roomId,
        participantId: config.participantId,
        ['participantCapability']: config.participantCapability,
        commandId,
        baseRevision,
        command,
      }));
      if (!envelopeValidation.ok) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const normalizedCommand = envelopeValidation.value.command;
      const fingerprint = JSON.stringify({ commandId, baseRevision, command: normalizedCommand });
      const existing = pending.find((entry) => entry.commandId === commandId);
      if (existing !== undefined) {
        return existing.fingerprint === fingerprint
          ? frozenSubmitResult({ ok: true })
          : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      }
      const settledFingerprint = settled.get(commandId);
      if (settledFingerprint !== undefined) {
        return settledFingerprint === fingerprint
          ? frozenSubmitResult({ ok: true })
          : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      }
      if (pending.length >= ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1) return frozenSubmitResult({ ok: false, code: 'OUTBOX_FULL' });
      pending.push(Object.freeze({ kind: 'command' as const, commandId, baseRevision, command: normalizedCommand, fingerprint }));
      publish();
      if (currentSocket !== null && phase === 'open') {
        const sent = sendFrame(currentSocket.socket, Object.freeze({
          kind: 'online-command-envelope-v1' as const,
          protocolVersion: config.protocolVersion,
          roomId: config.roomId,
          participantId: config.participantId,
          ['participantCapability']: config.participantCapability,
          commandId,
          baseRevision,
          command: normalizedCommand,
        }));
        if (!sent) beginRecovery(currentSocket.socket, currentSocket.epoch, 'SEND_FAILED');
      }
      return frozenSubmitResult({ ok: true });
    } catch {
      return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
    }
  };

  const submitTabletop = (intent: OnlineBrowserTabletopIntentV1): OnlineBrowserSubmitResultV1 => {
    try {
      if (!closedRecord(intent, ['baseRevision', 'commandId', 'kind', 'mode', 'primitive', 'schemaVersion'])
        || capabilityFragmentPresent(intent, config.participantCapability)) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const checked = validateOnlineTabletopIntentEnvelopeV1(intent);
      if (!checked.ok) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const normalized = checked.value;
      const commandId = normalized.commandId;
      const baseRevision = normalized.baseRevision;
      const fingerprint = JSON.stringify({ kind: 'tabletop', intent: normalized });
      const existing = pending.find((entry) => entry.commandId === commandId);
      if (existing !== undefined) return existing.fingerprint === fingerprint
        ? frozenSubmitResult({ ok: true }) : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      const settledFingerprint = settled.get(commandId);
      if (settledFingerprint !== undefined) return settledFingerprint === fingerprint
        ? frozenSubmitResult({ ok: true }) : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      if (pending.length >= ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1) return frozenSubmitResult({ ok: false, code: 'OUTBOX_FULL' });
      pending.push(Object.freeze({ kind: 'tabletop' as const, commandId, baseRevision, tabletop: normalized, fingerprint }));
      publish();
      if (currentSocket !== null && phase === 'open') {
        const frame = Object.freeze({
          ...normalized,
          protocolVersion: config.protocolVersion,
          roomId: config.roomId,
          participantId: config.participantId,
          ['participantCapability']: config.participantCapability,
        });
        if (!sendFrame(currentSocket.socket, frame)) beginRecovery(currentSocket.socket, currentSocket.epoch, 'SEND_FAILED');
      }
      return frozenSubmitResult({ ok: true });
    } catch {
      return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
    }
  };

  const submitVisibility = (intent: OnlineBrowserVisibilityIntentV1): OnlineBrowserSubmitResultV1 => {
    try {
      if (!closedVisibilityIntent(intent)
        || capabilityFragmentPresent(intent, config.participantCapability)) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const checked = validateOnlineVisibilityIntentV1(intent);
      if (!checked.ok) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const normalized = checked.value;
      const commandId = normalized.commandId;
      const baseRevision = normalized.baseRevision;
      const fingerprint = JSON.stringify({ kind: 'visibility', intent: normalized });
      const existing = pending.find((entry) => entry.commandId === commandId);
      if (existing !== undefined) return existing.fingerprint === fingerprint ? frozenSubmitResult({ ok: true }) : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      const settledFingerprint = settled.get(commandId);
      if (settledFingerprint !== undefined) return settledFingerprint === fingerprint ? frozenSubmitResult({ ok: true }) : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      if (pending.length >= ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1) return frozenSubmitResult({ ok: false, code: 'OUTBOX_FULL' });
      pending.push(Object.freeze({ kind: 'visibility' as const, commandId, baseRevision, visibility: normalized, fingerprint }));
      publish();
      if (currentSocket !== null && phase === 'open') {
        const frame = Object.freeze({ ...normalized, protocolVersion: config.protocolVersion, roomId: config.roomId, participantId: config.participantId, ['participantCapability']: config.participantCapability });
        if (!sendFrame(currentSocket.socket, frame)) beginRecovery(currentSocket.socket, currentSocket.epoch, 'SEND_FAILED');
      }
      return frozenSubmitResult({ ok: true });
    } catch { return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' }); }
  };

  const submitSharedUndo = (intent: OnlineBrowserSharedUndoIntentV1): OnlineBrowserSubmitResultV1 => {
    try {
      if (!validSharedUndoPayload(intent) || capabilityFragmentPresent(intent, config.participantCapability)) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const commandId = ownDataValue(intent, 'commandId') as string;
      const baseRevision = ownDataValue(intent, 'baseRevision') as number;
      const normalized = Object.freeze({ kind: 'online-shared-undo-intent-v1' as const, schemaVersion: 1 as const, commandId, baseRevision });
      const fingerprint = JSON.stringify({ kind: 'sharedUndo', intent: normalized });
      const existing = pending.find((entry) => entry.commandId === commandId);
      if (existing !== undefined) return existing.fingerprint === fingerprint
        ? frozenSubmitResult({ ok: true }) : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      const settledFingerprint = settled.get(commandId);
      if (settledFingerprint !== undefined) return settledFingerprint === fingerprint
        ? frozenSubmitResult({ ok: true }) : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      if (pending.length >= ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1) return frozenSubmitResult({ ok: false, code: 'OUTBOX_FULL' });
      pending.push(Object.freeze({ kind: 'sharedUndo' as const, commandId, baseRevision, sharedUndo: normalized, fingerprint }));
      publish();
      if (currentSocket !== null && phase === 'open') {
        const frame = Object.freeze({
          ...normalized,
          protocolVersion: config.protocolVersion,
          roomId: config.roomId,
          participantId: config.participantId,
          ['participantCapability']: config.participantCapability,
        });
        if (!sendFrame(currentSocket.socket, frame)) beginRecovery(currentSocket.socket, currentSocket.epoch, 'SEND_FAILED');
      }
      return frozenSubmitResult({ ok: true });
    } catch {
      return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
    }
  };

  const submitManualCombatDamage = (intent: OnlineBrowserManualCombatDamageIntentV1): OnlineBrowserSubmitResultV1 => {
    try {
      if (!validManualCombatDamagePayload(intent) || capabilityFragmentPresent(intent, config.participantCapability)) return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' });
      const commandId = ownDataValue(intent, 'commandId') as string;
      const baseRevision = ownDataValue(intent, 'baseRevision') as number;
      const normalized = Object.freeze({ kind: 'online-manual-combat-damage-intent-v1' as const, schemaVersion: 1 as const, commandId, baseRevision, defendingPlayerId: ownDataValue(intent, 'defendingPlayerId') as string, damage: ownDataValue(intent, 'damage') as number, commanderObjectId: ownDataValue(intent, 'commanderObjectId') as string | null });
      const fingerprint = JSON.stringify({ kind: 'manualCombatDamage', intent: normalized });
      const existing = pending.find((entry) => entry.commandId === commandId);
      if (existing !== undefined) return existing.fingerprint === fingerprint ? frozenSubmitResult({ ok: true }) : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      const settledFingerprint = settled.get(commandId);
      if (settledFingerprint !== undefined) return settledFingerprint === fingerprint ? frozenSubmitResult({ ok: true }) : frozenSubmitResult({ ok: false, code: 'COMMAND_ID_REUSE' });
      if (pending.length >= ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1) return frozenSubmitResult({ ok: false, code: 'OUTBOX_FULL' });
      pending.push(Object.freeze({ kind: 'manualCombatDamage' as const, commandId, baseRevision, manualCombatDamage: normalized, fingerprint }));
      publish();
      if (currentSocket !== null && phase === 'open') {
        const frame = Object.freeze({ ...normalized, protocolVersion: config.protocolVersion, roomId: config.roomId, participantId: config.participantId, ['participantCapability']: config.participantCapability });
        if (!sendFrame(currentSocket.socket, frame)) beginRecovery(currentSocket.socket, currentSocket.epoch, 'SEND_FAILED');
      }
      return frozenSubmitResult({ ok: true });
    } catch { return frozenSubmitResult({ ok: false, code: 'INVALID_COMMAND' }); }
  };

  const subscribe = (listener: OnlineBrowserSubscriptionV1): OnlineBrowserUnsubscribeV1 => {
    if (typeof listener !== 'function') return () => undefined;
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };

  const client: OnlineBrowserWebSocketClientV1 = Object.freeze({
    connect,
    disconnect,
    submit,
    submitTabletop,
    submitVisibility,
    submitSharedUndo,
    submitManualCombatDamage,
    getSnapshot: () => snapshot,
    subscribe,
  });
  return client;
}
