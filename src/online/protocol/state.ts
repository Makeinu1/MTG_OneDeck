import {
  validateModeNeutralCoreRootV1,
  type ModeNeutralCoreRootV1,
} from '../../engine/core/index';
import {
  validateOnlineRoomV1,
  type OnlineRoomIdV1,
  type OnlineRoomParticipantIdV1,
  type OnlineRoomV1,
} from '../room/index';
import { CURRENT_CONTRACT_VERSIONS, validateBuildId, type BuildId } from '../../versioning/index';
import { OnlineProtocolCreationErrorV1 } from './errors';
import {
  containsConfiguredCapability,
  freezeProtocolIssues,
  hasFieldReadIssue,
  hasReadableField,
  isOnlineProtocolCommandIdV1,
  isProtocolApplicationId,
  isProtocolCapability,
  isProtocolDigest,
  isProtocolRevision,
  protocolIssue,
  readDenseArray,
  readExactRecord,
} from './support';
import {
  ONLINE_PROTOCOL_SCHEMA_VERSION_V1,
  type OnlineProtocolCommandReceiptOutcomeV1,
  type OnlineProtocolCommandReceiptV1,
  type OnlineProtocolIssueCodeV1,
  type OnlineProtocolIssueV1,
  type OnlineProtocolObserverAuthorizationV1,
  type OnlineProtocolStateV1,
  type OnlineProtocolStateValidationResultV1,
} from './types';

const STATE_FIELDS = [
  'kind',
  'schemaVersion',
  'protocolVersion',
  'serverBuildId',
  'room',
  'coreRoot',
  'revision',
  'observerAuthorizations',
  'receipts',
] as const;

const CREATION_FIELDS = ['serverBuildId', 'room', 'coreRoot', 'observerAuthorizations'] as const;
const OBSERVER_FIELDS = ['participantId', 'observerCapability'] as const;
const RECEIPT_FIELDS = ['participantId', 'commandId', 'requestDigest', 'outcome'] as const;
const OUTCOME_FIELDS = [
  'kind',
  'roomId',
  'baseRevision',
  'acceptedRevision',
  'status',
  'resyncRequired',
  'issues',
] as const;
const STORED_ISSUE_FIELDS = ['code', 'path', 'message'] as const;

const PROTOCOL_ISSUE_CODES = new Set<OnlineProtocolIssueCodeV1>([
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

function requiredField(
  record: Record<string, unknown>,
  field: string,
  path: string,
  issues: OnlineProtocolIssueV1[],
): boolean {
  if (hasReadableField(record, field)) return true;
  const fieldPath = `${path}/${field}`;
  if (!hasFieldReadIssue(issues, fieldPath)) {
    issues.push(protocolIssue('MISSING_FIELD', fieldPath, 'Required field is missing'));
  }
  return false;
}

function parseObserverAuthorizations(
  input: unknown,
  path: string,
  issues: OnlineProtocolIssueV1[],
  capabilities: string[],
): readonly OnlineProtocolObserverAuthorizationV1[] | null {
  const array = readDenseArray(input, path, issues);
  if (array === null) return null;
  const values: OnlineProtocolObserverAuthorizationV1[] = [];
  for (const { index, value } of array.entries) {
    const entryPath = `${path}/${index}`;
    const record = readExactRecord(value, OBSERVER_FIELDS, entryPath, issues);
    if (record === null) continue;
    const participantId = isProtocolApplicationId(record.participantId)
      ? (record.participantId as OnlineRoomParticipantIdV1)
      : null;
    if (
      hasReadableField(record, 'participantId') &&
      participantId === null &&
      !hasFieldReadIssue(issues, `${entryPath}/participantId`)
    ) {
      issues.push(
        protocolIssue('INVALID_ID', `${entryPath}/participantId`, 'Invalid participant ID'),
      );
    }
    const observerCapability = isProtocolCapability(record.observerCapability)
      ? record.observerCapability
      : null;
    if (observerCapability !== null) capabilities.push(observerCapability);
    if (
      hasReadableField(record, 'observerCapability') &&
      observerCapability === null &&
      !hasFieldReadIssue(issues, `${entryPath}/observerCapability`)
    ) {
      issues.push(
        protocolIssue(
          'INVALID_CAPABILITY',
          `${entryPath}/observerCapability`,
          'Invalid observer capability',
        ),
      );
    }
    if (participantId !== null && observerCapability !== null) {
      values.push(Object.freeze({ participantId, observerCapability }));
    }
  }
  return Object.freeze(values);
}

function parseStoredIssues(
  input: unknown,
  path: string,
  issues: OnlineProtocolIssueV1[],
): readonly OnlineProtocolIssueV1[] | null {
  const array = readDenseArray(input, path, issues);
  if (array === null) return null;
  const values: OnlineProtocolIssueV1[] = [];
  for (const { index, value } of array.entries) {
    const entryPath = `${path}/${index}`;
    const record = readExactRecord(value, STORED_ISSUE_FIELDS, entryPath, issues);
    if (record === null) continue;
    const code =
      typeof record.code === 'string' &&
      PROTOCOL_ISSUE_CODES.has(record.code as OnlineProtocolIssueCodeV1)
        ? (record.code as OnlineProtocolIssueCodeV1)
        : null;
    if (hasReadableField(record, 'code') && code === null) {
      issues.push(protocolIssue('INVALID_LITERAL', `${entryPath}/code`, 'Invalid stored issue code'));
    }
    const validPath = typeof record.path === 'string';
    if (hasReadableField(record, 'path') && !validPath) {
      issues.push(protocolIssue('INVALID_TYPE', `${entryPath}/path`, 'Invalid stored issue path'));
    }
    const validMessage = typeof record.message === 'string';
    if (hasReadableField(record, 'message') && !validMessage) {
      issues.push(
        protocolIssue('INVALID_TYPE', `${entryPath}/message`, 'Invalid stored issue message'),
      );
    }
    if (code !== null && validPath && validMessage) {
      const candidate = protocolIssue(code, record.path as string, record.message as string);
      const redacted = freezeProtocolIssues([candidate]);
      if (
        redacted[0]?.code !== candidate.code ||
        redacted[0]?.path !== candidate.path ||
        redacted[0]?.message !== candidate.message
      ) {
        issues.push(
          protocolIssue(
            'INVALID_PROTOCOL_STATE',
            entryPath,
            'Stored issue contains forbidden capability-shaped data',
          ),
        );
      } else {
        values.push(candidate);
      }
    }
  }
  return Object.freeze(values);
}

function parseOutcome(
  input: unknown,
  path: string,
  issues: OnlineProtocolIssueV1[],
): OnlineProtocolCommandReceiptOutcomeV1 | null {
  const record = readExactRecord(input, OUTCOME_FIELDS, path, issues, ['kind']);
  if (record === null) return null;
  const kind = record.kind;
  if (kind !== 'accepted' && kind !== 'rejected') {
    if (hasReadableField(record, 'kind')) {
      issues.push(protocolIssue('INVALID_LITERAL', `${path}/kind`, 'Invalid receipt outcome kind'));
    }
    return null;
  }
  const expectedFields =
    kind === 'accepted'
      ? new Set(['kind', 'roomId', 'baseRevision', 'acceptedRevision', 'status'])
      : new Set(['kind', 'roomId', 'baseRevision', 'resyncRequired', 'issues']);
  for (const field of OUTCOME_FIELDS) {
    if (hasReadableField(record, field) && !expectedFields.has(field)) {
      issues.push(protocolIssue('UNKNOWN_FIELD', `${path}/${field}`, 'Unknown outcome field'));
    }
  }
  for (const field of expectedFields) requiredField(record, field, path, issues);
  const roomId = isProtocolApplicationId(record.roomId)
    ? (record.roomId as OnlineRoomIdV1)
    : null;
  if (hasReadableField(record, 'roomId') && roomId === null) {
    issues.push(protocolIssue('INVALID_ID', `${path}/roomId`, 'Invalid receipt Room ID'));
  }
  const baseRevision = isProtocolRevision(record.baseRevision) ? record.baseRevision : null;
  if (hasReadableField(record, 'baseRevision') && baseRevision === null) {
    issues.push(
      protocolIssue('INVALID_INTEGER', `${path}/baseRevision`, 'Invalid receipt revision'),
    );
  }
  if (kind === 'accepted') {
    const acceptedRevision = isProtocolRevision(record.acceptedRevision)
      ? record.acceptedRevision
      : null;
    if (hasReadableField(record, 'acceptedRevision') && acceptedRevision === null) {
      issues.push(
        protocolIssue('INVALID_INTEGER', `${path}/acceptedRevision`, 'Invalid accepted revision'),
      );
    }
    const status =
      record.status === 'accepted' || record.status === 'accepted-with-warning'
        ? record.status
        : null;
    if (hasReadableField(record, 'status') && status === null) {
      issues.push(protocolIssue('INVALID_LITERAL', `${path}/status`, 'Invalid accepted status'));
    }
    if (
      roomId !== null &&
      baseRevision !== null &&
      acceptedRevision !== null &&
      status !== null
    ) {
      return Object.freeze({ kind, roomId, baseRevision, acceptedRevision, status });
    }
    return null;
  }
  const resyncRequired =
    typeof record.resyncRequired === 'boolean' ? record.resyncRequired : null;
  if (hasReadableField(record, 'resyncRequired') && resyncRequired === null) {
    issues.push(
      protocolIssue('INVALID_TYPE', `${path}/resyncRequired`, 'Invalid resync requirement'),
    );
  }
  const storedIssues = hasReadableField(record, 'issues')
    ? parseStoredIssues(record.issues, `${path}/issues`, issues)
    : null;
  if (
    roomId !== null &&
    baseRevision !== null &&
    resyncRequired !== null &&
    storedIssues !== null
  ) {
    return Object.freeze({
      kind,
      roomId,
      baseRevision,
      resyncRequired,
      issues: storedIssues,
    });
  }
  return null;
}

function parseReceipts(
  input: unknown,
  path: string,
  issues: OnlineProtocolIssueV1[],
): readonly OnlineProtocolCommandReceiptV1[] | null {
  const array = readDenseArray(input, path, issues);
  if (array === null) return null;
  const values: OnlineProtocolCommandReceiptV1[] = [];
  for (const { index, value } of array.entries) {
    const entryPath = `${path}/${index}`;
    const record = readExactRecord(value, RECEIPT_FIELDS, entryPath, issues);
    if (record === null) continue;
    const participantId = isProtocolApplicationId(record.participantId)
      ? (record.participantId as OnlineRoomParticipantIdV1)
      : null;
    if (hasReadableField(record, 'participantId') && participantId === null) {
      issues.push(
        protocolIssue('INVALID_ID', `${entryPath}/participantId`, 'Invalid receipt participant ID'),
      );
    }
    const commandId = isOnlineProtocolCommandIdV1(record.commandId) ? record.commandId : null;
    if (hasReadableField(record, 'commandId') && commandId === null) {
      issues.push(protocolIssue('INVALID_ID', `${entryPath}/commandId`, 'Invalid receipt command ID'));
    }
    const requestDigest = isProtocolDigest(record.requestDigest) ? record.requestDigest : null;
    if (hasReadableField(record, 'requestDigest') && requestDigest === null) {
      issues.push(
        protocolIssue('INVALID_TYPE', `${entryPath}/requestDigest`, 'Invalid request digest'),
      );
    }
    const outcome = hasReadableField(record, 'outcome')
      ? parseOutcome(record.outcome, `${entryPath}/outcome`, issues)
      : null;
    if (participantId !== null && commandId !== null && requestDigest !== null && outcome !== null) {
      values.push(Object.freeze({ participantId, commandId, requestDigest, outcome }));
    }
  }
  return Object.freeze(values);
}

function outcomeForCore(
  entry: ModeNeutralCoreRootV1['playerLifecycle']['players'][number],
): 'pending' | 'conceded' | 'defeated' {
  if (entry.status === 'active') return 'pending';
  return entry.exitCause === 'concession' ? 'conceded' : 'defeated';
}

function validateRelations(
  room: OnlineRoomV1,
  coreRoot: ModeNeutralCoreRootV1,
  authorizations: readonly OnlineProtocolObserverAuthorizationV1[],
  receipts: readonly OnlineProtocolCommandReceiptV1[],
  revision: number,
  requireActive: boolean,
  issues: OnlineProtocolIssueV1[],
): void {
  if (requireActive && room.lifecycle !== 'active') {
    issues.push(protocolIssue('ROOM_NOT_ACTIVE', '/room/lifecycle', 'Room must be active'));
  }
  const corePlayers = coreRoot.playerLifecycle.players;
  if (
    corePlayers.length !== room.seats.length ||
    room.seats.some((seat, index) => corePlayers[index]?.playerId !== seat.corePlayerId)
  ) {
    issues.push(
      protocolIssue('INVALID_PROTOCOL_STATE', '/coreRoot', 'Room and Core rosters do not match'),
    );
  }
  if (
    room.seats.some((seat, index) => {
      const coreEntry = corePlayers[index];
      return coreEntry === undefined || seat.outcome !== outcomeForCore(coreEntry);
    })
  ) {
    issues.push(
      protocolIssue(
        'INVALID_PROTOCOL_STATE',
        '/room/seats',
        'Room and Core lifecycle outcomes do not match',
      ),
    );
  }
  if (revision !== coreRoot.acceptedCommandCount) {
    issues.push(
      protocolIssue('INVALID_PROTOCOL_STATE', '/revision', 'Revision does not match Core state'),
    );
  }
  const observers = room.participants.filter((participant) => participant.role !== 'player');
  if (
    observers.length !== authorizations.length ||
    observers.some(
      (participant, index) => authorizations[index]?.participantId !== participant.participantId,
    )
  ) {
    issues.push(
      protocolIssue(
        'INVALID_PROTOCOL_STATE',
        '/observerAuthorizations',
        'Observer authorization coverage does not match Room order',
      ),
    );
  }
  const capabilitySet = new Set(room.seats.map((seat) => seat.seatCapability as string));
  for (const [index, authorization] of authorizations.entries()) {
    if (capabilitySet.has(authorization.observerCapability)) {
      issues.push(
        protocolIssue(
          'INVALID_PROTOCOL_STATE',
          `/observerAuthorizations/${index}/observerCapability`,
          'Protocol capabilities must be unique',
        ),
      );
    }
    capabilitySet.add(authorization.observerCapability);
  }
  const receiptKeys = new Map<string, Set<string>>();
  let lastAcceptedRevision = -1;
  let lastAcceptedReceiptIndex = -1;
  for (const [index, receipt] of receipts.entries()) {
    const participant = room.participants.find(
      (current) => current.participantId === receipt.participantId,
    );
    if (participant?.role !== 'player') {
      issues.push(
        protocolIssue(
          'INVALID_PROTOCOL_STATE',
          `/receipts/${index}/participantId`,
          'Receipt participant must be a Room player',
        ),
      );
    }
    const participantKeys = receiptKeys.get(receipt.participantId) ?? new Set<string>();
    if (participantKeys.has(receipt.commandId)) {
      issues.push(
        protocolIssue(
          'INVALID_PROTOCOL_STATE',
          `/receipts/${index}/commandId`,
          'Receipt key must be unique',
        ),
      );
    }
    participantKeys.add(receipt.commandId);
    receiptKeys.set(receipt.participantId, participantKeys);
    if (receipt.outcome.roomId !== room.roomId) {
      issues.push(
        protocolIssue(
          'INVALID_PROTOCOL_STATE',
          `/receipts/${index}/outcome/roomId`,
          'Receipt Room ID does not match protocol state',
        ),
      );
    }
    if (receipt.outcome.kind === 'accepted') {
      if (
        receipt.outcome.acceptedRevision !== receipt.outcome.baseRevision + 1 ||
        receipt.outcome.acceptedRevision > revision ||
        receipt.outcome.acceptedRevision <= lastAcceptedRevision ||
        (lastAcceptedRevision >= 0 &&
          receipt.outcome.acceptedRevision !== lastAcceptedRevision + 1)
      ) {
        issues.push(
          protocolIssue(
            'INVALID_PROTOCOL_STATE',
            `/receipts/${index}/outcome/acceptedRevision`,
            'Accepted receipt revision relation is invalid',
          ),
        );
      }
      lastAcceptedRevision = Math.max(lastAcceptedRevision, receipt.outcome.acceptedRevision);
      lastAcceptedReceiptIndex = index;
    } else {
      const storedIssue = receipt.outcome.issues;
      const onlyIssue = storedIssue[0];
      const validStoredReject =
        storedIssue.length === 1 &&
        ((onlyIssue?.code === 'STALE_REVISION' &&
          onlyIssue.path === '/baseRevision' &&
          onlyIssue.message === 'Command revision is stale' &&
          receipt.outcome.resyncRequired) ||
          (onlyIssue?.code === 'CORE_COMMAND_REJECTED' &&
            onlyIssue.path === '/command' &&
            onlyIssue.message === 'Core command was rejected' &&
            !receipt.outcome.resyncRequired));
      if (!validStoredReject) {
        issues.push(
          protocolIssue(
            'INVALID_PROTOCOL_STATE',
            `/receipts/${index}/outcome`,
            'Stored reject outcome relation is invalid',
          ),
        );
      }
    }
  }
  if (lastAcceptedRevision >= 0 && lastAcceptedRevision !== revision) {
    issues.push(
      protocolIssue(
        'INVALID_PROTOCOL_STATE',
        `/receipts/${lastAcceptedReceiptIndex}/outcome/acceptedRevision`,
        'Accepted receipt history does not reach the current revision',
      ),
    );
  }
}

function validateIdentifierSecrecy(
  serverBuildId: string,
  room: OnlineRoomV1,
  receipts: readonly OnlineProtocolCommandReceiptV1[],
  capabilities: readonly string[],
  issues: OnlineProtocolIssueV1[],
): void {
  const stateIdentifiers = [
    serverBuildId,
    room.roomId,
    room.hostParticipantId,
    ...room.participants.map((participant) => participant.participantId),
  ];
  if (stateIdentifiers.some((identifier) => containsConfiguredCapability(identifier, capabilities))) {
    issues.push(
      protocolIssue(
        'INVALID_PROTOCOL_STATE',
        '/room',
        'Protocol identifiers must not contain capability data',
      ),
    );
  }
  for (const [index, receipt] of receipts.entries()) {
    if (
      containsConfiguredCapability(receipt.participantId, capabilities) ||
      containsConfiguredCapability(receipt.commandId, capabilities) ||
      containsConfiguredCapability(receipt.outcome.roomId, capabilities)
    ) {
      issues.push(
        protocolIssue(
          'INVALID_PROTOCOL_STATE',
          `/receipts/${index}`,
          'Receipt identifiers must not contain capability data',
        ),
      );
    }
  }
}

export function buildProtocolStateV1(
  serverBuildId: BuildId,
  room: OnlineRoomV1,
  coreRoot: ModeNeutralCoreRootV1,
  observerAuthorizations: readonly OnlineProtocolObserverAuthorizationV1[],
  receipts: readonly OnlineProtocolCommandReceiptV1[],
): OnlineProtocolStateV1 {
  return Object.freeze({
    kind: 'online-protocol-state-v1',
    schemaVersion: ONLINE_PROTOCOL_SCHEMA_VERSION_V1,
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    serverBuildId,
    room,
    coreRoot,
    revision: coreRoot.acceptedCommandCount,
    observerAuthorizations: Object.freeze(observerAuthorizations.slice()),
    receipts: Object.freeze(receipts.slice()),
  });
}

export function protocolStateCapabilities(state: OnlineProtocolStateV1): readonly string[] {
  return Object.freeze([
    ...state.room.seats.map((seat) => seat.seatCapability),
    ...state.observerAuthorizations.map((authorization) => authorization.observerCapability),
  ]);
}

export function validateOnlineProtocolStateV1(input: unknown): OnlineProtocolStateValidationResultV1 {
  try {
    const issues: OnlineProtocolIssueV1[] = [];
    const capabilities: string[] = [];
    const record = readExactRecord(input, STATE_FIELDS, '', issues);
    if (record === null) {
      return Object.freeze({ ok: false as const, issues: freezeProtocolIssues(issues) });
    }
    if (hasReadableField(record, 'kind') && record.kind !== 'online-protocol-state-v1') {
      issues.push(protocolIssue('INVALID_LITERAL', '/kind', 'Invalid protocol state kind'));
    }
    if (
      hasReadableField(record, 'schemaVersion') &&
      record.schemaVersion !== ONLINE_PROTOCOL_SCHEMA_VERSION_V1
    ) {
      issues.push(protocolIssue('INVALID_VERSION', '/schemaVersion', 'Invalid state schema version'));
    }
    if (
      hasReadableField(record, 'protocolVersion') &&
      record.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion
    ) {
      issues.push(
        protocolIssue(
          'PROTOCOL_VERSION_MISMATCH',
          '/protocolVersion',
          'Protocol version is not supported',
        ),
      );
    }
    const build = hasReadableField(record, 'serverBuildId')
      ? validateBuildId(record.serverBuildId)
      : null;
    if (build !== null && !build.ok) {
      issues.push(protocolIssue('INVALID_BUILD_ID', '/serverBuildId', 'Invalid server Build ID'));
    }
    let room: OnlineRoomV1 | null = null;
    if (hasReadableField(record, 'room')) {
      try {
        const result = validateOnlineRoomV1(record.room);
        if (result.ok) {
          room = result.value;
          capabilities.push(...room.seats.map((seat) => seat.seatCapability));
        } else {
          issues.push(protocolIssue('INVALID_PROTOCOL_STATE', '/room', 'Invalid Room state'));
        }
      } catch {
        issues.push(protocolIssue('INVALID_PROTOCOL_STATE', '/room', 'Invalid Room state'));
      }
    }
    let coreRoot: ModeNeutralCoreRootV1 | null = null;
    if (hasReadableField(record, 'coreRoot')) {
      try {
        const result = validateModeNeutralCoreRootV1(record.coreRoot);
        if (result.ok) coreRoot = result.value;
        else issues.push(protocolIssue('INVALID_PROTOCOL_STATE', '/coreRoot', 'Invalid Core state'));
      } catch {
        issues.push(protocolIssue('INVALID_PROTOCOL_STATE', '/coreRoot', 'Invalid Core state'));
      }
    }
    const revision = isProtocolRevision(record.revision) ? record.revision : null;
    if (hasReadableField(record, 'revision') && revision === null) {
      issues.push(protocolIssue('INVALID_INTEGER', '/revision', 'Invalid protocol revision'));
    }
    const authorizations = hasReadableField(record, 'observerAuthorizations')
      ? parseObserverAuthorizations(
          record.observerAuthorizations,
          '/observerAuthorizations',
          issues,
          capabilities,
        )
      : null;
    const receipts = hasReadableField(record, 'receipts')
      ? parseReceipts(record.receipts, '/receipts', issues)
      : null;
    if (
      room !== null &&
      coreRoot !== null &&
      revision !== null &&
      authorizations !== null &&
      receipts !== null
    ) {
      validateRelations(room, coreRoot, authorizations, receipts, revision, false, issues);
      if (build?.ok) {
        validateIdentifierSecrecy(build.value, room, receipts, capabilities, issues);
      }
    }
    if (
      issues.length > 0 ||
      record.kind !== 'online-protocol-state-v1' ||
      record.schemaVersion !== ONLINE_PROTOCOL_SCHEMA_VERSION_V1 ||
      record.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion ||
      build === null ||
      !build.ok ||
      room === null ||
      coreRoot === null ||
      revision === null ||
      authorizations === null ||
      receipts === null
    ) {
      return Object.freeze({
        ok: false as const,
        issues: freezeProtocolIssues(issues, capabilities),
      });
    }
    const value = buildProtocolStateV1(
      build.value,
      room,
      coreRoot,
      authorizations,
      receipts,
    );
    return Object.freeze({ ok: true as const, value });
  } catch {
    return Object.freeze({
      ok: false as const,
      issues: freezeProtocolIssues([
        protocolIssue('INVALID_DESCRIPTOR', '', 'Protocol state could not be inspected safely'),
      ]),
    });
  }
}

export function createOnlineProtocolStateV1(input: unknown): OnlineProtocolStateV1 {
  const issues: OnlineProtocolIssueV1[] = [];
  const capabilities: string[] = [];
  try {
    const record = readExactRecord(input, CREATION_FIELDS, '', issues);
    if (record === null) throw new OnlineProtocolCreationErrorV1(issues, capabilities);
    const build = hasReadableField(record, 'serverBuildId')
      ? validateBuildId(record.serverBuildId)
      : null;
    if (build !== null && !build.ok) {
      issues.push(protocolIssue('INVALID_BUILD_ID', '/serverBuildId', 'Invalid server Build ID'));
    }
    let room: OnlineRoomV1 | null = null;
    if (hasReadableField(record, 'room')) {
      try {
        const result = validateOnlineRoomV1(record.room);
        if (result.ok) {
          room = result.value;
          capabilities.push(...room.seats.map((seat) => seat.seatCapability));
        } else issues.push(protocolIssue('INVALID_PROTOCOL_STATE', '/room', 'Invalid Room state'));
      } catch {
        issues.push(protocolIssue('INVALID_PROTOCOL_STATE', '/room', 'Invalid Room state'));
      }
    }
    let coreRoot: ModeNeutralCoreRootV1 | null = null;
    if (hasReadableField(record, 'coreRoot')) {
      try {
        const result = validateModeNeutralCoreRootV1(record.coreRoot);
        if (result.ok) coreRoot = result.value;
        else issues.push(protocolIssue('INVALID_PROTOCOL_STATE', '/coreRoot', 'Invalid Core state'));
      } catch {
        issues.push(protocolIssue('INVALID_PROTOCOL_STATE', '/coreRoot', 'Invalid Core state'));
      }
    }
    const authorizations = hasReadableField(record, 'observerAuthorizations')
      ? parseObserverAuthorizations(
          record.observerAuthorizations,
          '/observerAuthorizations',
          issues,
          capabilities,
        )
      : null;
    if (room !== null && coreRoot !== null && authorizations !== null) {
      validateRelations(
        room,
        coreRoot,
        authorizations,
        Object.freeze([]),
        coreRoot.acceptedCommandCount,
        true,
        issues,
      );
      if (build?.ok) {
        validateIdentifierSecrecy(build.value, room, Object.freeze([]), capabilities, issues);
      }
    }
    if (
      issues.length > 0 ||
      build === null ||
      !build.ok ||
      room === null ||
      coreRoot === null ||
      authorizations === null
    ) {
      throw new OnlineProtocolCreationErrorV1(issues, capabilities);
    }
    return buildProtocolStateV1(build.value, room, coreRoot, authorizations, Object.freeze([]));
  } catch (error: unknown) {
    if (error instanceof OnlineProtocolCreationErrorV1) throw error;
    throw new OnlineProtocolCreationErrorV1(
      [protocolIssue('INVALID_DESCRIPTOR', '', 'State input could not be inspected safely')],
      capabilities,
    );
  }
}
