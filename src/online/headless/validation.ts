import {
  validateCoreCommandV1,
  type CoreCommandV1,
  type CoreDecisionContextV1,
  type CorePlayerId,
} from '../../engine/core/index';
import {
  isOnlineProtocolCommandIdV1,
  validateOnlineProtocolStateV1,
  type OnlineProtocolParticipantCapabilityV1,
  type OnlineProtocolStateV1,
} from '../protocol/index';
import type { OnlineRoomParticipantIdV1 } from '../room/index';
import {
  CURRENT_CONTRACT_VERSIONS,
  validateBuildId,
} from '../../versioning/index';
import {
  freezeHeadlessIssues,
  hasHeadlessField,
  headlessIssue,
  headlessPointer,
  isHeadlessApplicationId,
  isHeadlessCapability,
  isHeadlessCoreKey,
  isHeadlessNonNegativeInteger,
  inspectHeadlessPublicGraph,
  readHeadlessDenseArray,
  readHeadlessExactRecord,
  type HeadlessReadableRecord,
} from './support';
import {
  ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1,
  type OnlineHeadlessRoomGateActionV1,
  type OnlineHeadlessRoomGateClientV1,
  type OnlineHeadlessRoomGateCountsV1,
  type OnlineHeadlessRoomGateCoverageV1,
  type OnlineHeadlessRoomGateInputValidationResultV1,
  type OnlineHeadlessRoomGateIssueV1,
  type OnlineHeadlessRoomGateReportClientV1,
  type OnlineHeadlessRoomGateReportV1,
  type OnlineHeadlessRoomGateReportValidationResultV1,
} from './types';

const INPUT_FIELDS = ['kind', 'schemaVersion', 'state', 'clients', 'actions'] as const;
const CLIENT_FIELDS = ['participantId', 'participantCapability', 'clientBuildId'] as const;
const ACTION_FIELDS = [
  'kind',
  'participantId',
  'commandId',
  'baseRevision',
  'command',
  'knownRevision',
  'decisionContext',
] as const;
const REPORT_FIELDS = [
  'kind',
  'schemaVersion',
  'protocolVersion',
  'roomId',
  'initialRevision',
  'finalRevision',
  'finalRoomLifecycle',
  'clients',
  'counts',
  'coverage',
  'deferred',
] as const;
const REPORT_CLIENT_FIELDS = ['participantId', 'role', 'corePlayerId', 'presence'] as const;
const COUNT_FIELDS = [
  'clientHellosAccepted',
  'clientHellosRejected',
  'commandsAccepted',
  'commandsRejected',
  'commandDuplicates',
  'staleRevisionRejections',
  'roleRejections',
  'projectionsAccepted',
  'projectionsRejected',
  'disconnects',
  'playerRejoins',
  'tableRejoins',
] as const;
const COVERAGE_FIELDS = [
  'fourPlayers',
  'tableDisplay',
  'allClientHellos',
  'allClientProjections',
  'acceptedCommand',
  'rejectedCommand',
  'duplicateCommand',
  'staleRevision',
  'roleIsolation',
  'playerReconnect',
  'tableReconnect',
  'privacyGate',
  'replay',
] as const;
const DEFERRED = Object.freeze([
  'cloudflare',
  'worker',
  'durable-object',
  'sqlite',
  'websocket',
  'persistence',
  'ui',
] as const);

function freshDeferred(): OnlineHeadlessRoomGateReportV1['deferred'] {
  const value: [
    'cloudflare',
    'worker',
    'durable-object',
    'sqlite',
    'websocket',
    'persistence',
    'ui',
  ] = [...DEFERRED];
  return Object.freeze(value);
}

function failure(
  issues: readonly OnlineHeadlessRoomGateIssueV1[],
  capabilities: readonly string[] = [],
): { readonly ok: false; readonly issues: readonly OnlineHeadlessRoomGateIssueV1[] } {
  return Object.freeze({ ok: false as const, issues: freezeHeadlessIssues(issues, capabilities) });
}

function success<T>(value: T): { readonly ok: true; readonly value: T } {
  return Object.freeze({ ok: true as const, value });
}

function validateDecisionContext(
  input: unknown,
  path: string,
  issues: OnlineHeadlessRoomGateIssueV1[],
  capabilities: readonly string[],
): CoreDecisionContextV1 | null | undefined {
  if (input === null) return null;
  const record = readHeadlessExactRecord(
    input,
    ['kind', 'decisionKey', 'searchSessionId', 'turnNumber'],
    path,
    issues,
    ['kind'],
    capabilities,
  );
  if (record === null) return undefined;
  const optionalTurn = hasHeadlessField(record, 'turnNumber');
  let canonicalTurn: number | undefined;
  if (optionalTurn && isHeadlessNonNegativeInteger(record.turnNumber)) {
    canonicalTurn = record.turnNumber;
  }
  if (optionalTurn && !isHeadlessNonNegativeInteger(record.turnNumber)) {
    issues.push(headlessIssue(
      'INVALID_INTEGER',
      headlessPointer(path, 'turnNumber'),
      'Turn number must be a non-negative safe integer',
    ));
  }
  if (record.kind === 'decision') {
    if (!hasHeadlessField(record, 'decisionKey')) {
      issues.push(headlessIssue(
        'MISSING_FIELD',
        headlessPointer(path, 'decisionKey'),
        'Required field is missing',
      ));
    } else if (!isHeadlessCoreKey(record.decisionKey)) {
      issues.push(headlessIssue('INVALID_ID', headlessPointer(path, 'decisionKey'), 'Invalid decision key'));
    }
    if (hasHeadlessField(record, 'searchSessionId')) {
      issues.push(headlessIssue(
        'UNKNOWN_FIELD',
        headlessPointer(path, 'searchSessionId'),
        'Field is not valid for this decision context',
      ));
    }
    if (isHeadlessCoreKey(record.decisionKey)
      && (!optionalTurn || isHeadlessNonNegativeInteger(record.turnNumber))) {
      return Object.freeze({
        kind: 'decision' as const,
        decisionKey: record.decisionKey,
        ...(canonicalTurn === undefined ? {} : { turnNumber: canonicalTurn }),
      });
    }
    return undefined;
  }
  if (record.kind === 'search-session') {
    if (!hasHeadlessField(record, 'searchSessionId')) {
      issues.push(headlessIssue(
        'MISSING_FIELD',
        headlessPointer(path, 'searchSessionId'),
        'Required field is missing',
      ));
    } else if (!isHeadlessCoreKey(record.searchSessionId)) {
      issues.push(headlessIssue(
        'INVALID_ID',
        headlessPointer(path, 'searchSessionId'),
        'Invalid search session ID',
      ));
    }
    if (hasHeadlessField(record, 'decisionKey')) {
      issues.push(headlessIssue(
        'UNKNOWN_FIELD',
        headlessPointer(path, 'decisionKey'),
        'Field is not valid for this decision context',
      ));
    }
    if (isHeadlessCoreKey(record.searchSessionId)
      && (!optionalTurn || isHeadlessNonNegativeInteger(record.turnNumber))) {
      return Object.freeze({
        kind: 'search-session' as const,
        searchSessionId: record.searchSessionId,
        ...(canonicalTurn === undefined ? {} : { turnNumber: canonicalTurn }),
      });
    }
    return undefined;
  }
  issues.push(headlessIssue(
    'INVALID_LITERAL',
    headlessPointer(path, 'kind'),
    'Invalid decision context kind',
  ));
  return undefined;
}

function parseClient(
  input: unknown,
  path: string,
  issues: OnlineHeadlessRoomGateIssueV1[],
  capabilities: string[],
): OnlineHeadlessRoomGateClientV1 | null {
  const record = readHeadlessExactRecord(
    input,
    CLIENT_FIELDS,
    path,
    issues,
    CLIENT_FIELDS,
    capabilities,
  );
  if (record === null) return null;
  if (!isHeadlessApplicationId(record.participantId)) {
    issues.push(headlessIssue('INVALID_ID', `${path}/participantId`, 'Invalid participant ID'));
  }
  if (!isHeadlessCapability(record.participantCapability)) {
    issues.push(headlessIssue(
      'INVALID_CAPABILITY',
      `${path}/participantCapability`,
      'Invalid participant capability',
    ));
  } else {
    capabilities.push(record.participantCapability);
  }
  const build = validateBuildId(record.clientBuildId);
  if (!build.ok) {
    issues.push(headlessIssue('INVALID_BUILD_ID', `${path}/clientBuildId`, 'Invalid client Build ID'));
  }
  if (!isHeadlessApplicationId(record.participantId)
    || !isHeadlessCapability(record.participantCapability)
    || !build.ok) return null;
  return Object.freeze({
    participantId: record.participantId as OnlineRoomParticipantIdV1,
    participantCapability:
      record.participantCapability as OnlineProtocolParticipantCapabilityV1,
    clientBuildId: build.value,
  });
}

function actionRequiredFields(kind: unknown): readonly string[] {
  if (kind === 'client-hello' || kind === 'disconnect') return ['kind', 'participantId'];
  if (kind === 'command') {
    return ['kind', 'participantId', 'commandId', 'baseRevision', 'command'];
  }
  if (kind === 'projection') {
    return ['kind', 'participantId', 'knownRevision', 'decisionContext'];
  }
  return ['kind'];
}

function rejectFieldsForActionKind(
  record: HeadlessReadableRecord,
  allowed: readonly string[],
  path: string,
  issues: OnlineHeadlessRoomGateIssueV1[],
): void {
  const allowedSet = new Set(allowed);
  for (const field of ACTION_FIELDS) {
    if (hasHeadlessField(record, field) && !allowedSet.has(field)) {
      issues.push(headlessIssue(
        'UNKNOWN_FIELD',
        `${path}/${field}`,
        'Field is not valid for this action kind',
      ));
    }
  }
}

function parseAction(
  input: unknown,
  path: string,
  issues: OnlineHeadlessRoomGateIssueV1[],
  capabilities: readonly string[],
): OnlineHeadlessRoomGateActionV1 | null {
  const first = readHeadlessExactRecord(
    input,
    ACTION_FIELDS,
    path,
    issues,
    ['kind'],
    capabilities,
  );
  if (first === null) {
    issues.push(headlessIssue('INVALID_ACTION', path, 'Invalid headless action'));
    return null;
  }
  const required = actionRequiredFields(first.kind);
  for (const field of required) {
    if (!hasHeadlessField(first, field)) {
      issues.push(headlessIssue('MISSING_FIELD', `${path}/${field}`, 'Required field is missing'));
    }
  }
  if (first.kind !== 'client-hello'
    && first.kind !== 'disconnect'
    && first.kind !== 'command'
    && first.kind !== 'projection') {
    issues.push(headlessIssue('INVALID_ACTION', `${path}/kind`, 'Invalid headless action kind'));
    return null;
  }
  if (!isHeadlessApplicationId(first.participantId)) {
    issues.push(headlessIssue('INVALID_ID', `${path}/participantId`, 'Invalid participant ID'));
  }
  if (first.kind === 'client-hello' || first.kind === 'disconnect') {
    rejectFieldsForActionKind(first, ['kind', 'participantId'], path, issues);
    if (!isHeadlessApplicationId(first.participantId)) return null;
    return Object.freeze({
      kind: first.kind,
      participantId: first.participantId as OnlineRoomParticipantIdV1,
    });
  }
  if (first.kind === 'command') {
    rejectFieldsForActionKind(
      first,
      ['kind', 'participantId', 'commandId', 'baseRevision', 'command'],
      path,
      issues,
    );
    if (!isOnlineProtocolCommandIdV1(first.commandId)) {
      issues.push(headlessIssue('INVALID_ID', `${path}/commandId`, 'Invalid command ID'));
    }
    if (!isHeadlessNonNegativeInteger(first.baseRevision)) {
      issues.push(headlessIssue(
        'INVALID_INTEGER',
        `${path}/baseRevision`,
        'Base revision must be a non-negative safe integer',
      ));
    }
    let command: CoreCommandV1 | null = null;
    try {
      const checked = validateCoreCommandV1(first.command);
      if (checked.ok) command = checked.value;
      else issues.push(headlessIssue('INVALID_ACTION', `${path}/command`, 'Invalid Core command'));
    } catch {
      issues.push(headlessIssue('INVALID_ACTION', `${path}/command`, 'Invalid Core command'));
    }
    if (!isHeadlessApplicationId(first.participantId)
      || !isOnlineProtocolCommandIdV1(first.commandId)
      || !isHeadlessNonNegativeInteger(first.baseRevision)
      || command === null) return null;
    return Object.freeze({
      kind: 'command' as const,
      participantId: first.participantId as OnlineRoomParticipantIdV1,
      commandId: first.commandId,
      baseRevision: first.baseRevision,
      command,
    });
  }
  rejectFieldsForActionKind(
    first,
    ['kind', 'participantId', 'knownRevision', 'decisionContext'],
    path,
    issues,
  );
  if (!isHeadlessNonNegativeInteger(first.knownRevision)) {
    issues.push(headlessIssue(
      'INVALID_INTEGER',
      `${path}/knownRevision`,
      'Known revision must be a non-negative safe integer',
    ));
  }
  const context = validateDecisionContext(
    first.decisionContext,
    `${path}/decisionContext`,
    issues,
    capabilities,
  );
  if (!isHeadlessApplicationId(first.participantId)
    || !isHeadlessNonNegativeInteger(first.knownRevision)
    || context === undefined) return null;
  return Object.freeze({
    kind: 'projection' as const,
    participantId: first.participantId as OnlineRoomParticipantIdV1,
    knownRevision: first.knownRevision,
    decisionContext: context,
  });
}

function validateStartingRelations(
  state: OnlineProtocolStateV1,
  clients: readonly OnlineHeadlessRoomGateClientV1[],
  actions: readonly OnlineHeadlessRoomGateActionV1[],
  issues: OnlineHeadlessRoomGateIssueV1[],
): void {
  if (state.room.lifecycle !== 'active' || state.revision !== 0 || state.receipts.length !== 0) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/state',
      'Starting protocol state must be fresh and active',
    ));
  }
  const players = state.room.participants.filter((participant) => participant.role === 'player');
  const tables = state.room.participants.filter((participant) => participant.role === 'table');
  const spectators = state.room.participants.filter((participant) => participant.role === 'spectator');
  const connected = state.room.participants.every((participant) => participant.presence === 'connected');
  const expectedCorePlayerIds = ['P1', 'P2', 'P3', 'P4'] as const;
  if (state.room.seats.length !== 4
    || state.room.seats.some((seat, index) => seat.corePlayerId !== expectedCorePlayerIds[index])
    || players.length !== 4
    || tables.length !== 1
    || spectators.length !== 0
    || state.room.participants.length !== 5
    || !connected) {
    issues.push(headlessIssue(
      'INVALID_CLIENT_SET',
      '/state/room',
      'Starting Room must contain four connected Players and one connected Table',
    ));
  }
  if (state.room.seats.some((seat) => !seat.ready || seat.outcome !== 'pending')) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/state/room/seats',
      'Starting seats must be ready with pending outcomes',
    ));
  }
  const lifecyclePlayers = state.coreRoot.playerLifecycle.players;
  if (lifecyclePlayers.length !== 4
    || lifecyclePlayers.some((player, index) =>
      player.playerId !== expectedCorePlayerIds[index]
      || player.status !== 'active'
      || player.exitCause !== null)) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/state/coreRoot/playerLifecycle',
      'Starting Core player lifecycle must contain active P1 through P4 in order',
    ));
  }
  const orderedPlayers = state.room.seats.map((seat) => {
    if (seat.participantId === null) return null;
    return state.room.participants.find((participant) =>
      participant.participantId === seat.participantId
      && participant.role === 'player'
      && participant.seatIndex === seat.seatIndex) ?? null;
  });
  const table = tables[0] ?? null;
  const tableAuthorization = table === null
    ? null
    : state.observerAuthorizations.find((entry) => entry.participantId === table.participantId) ?? null;
  if (state.observerAuthorizations.length !== 1 || tableAuthorization === null) {
    issues.push(headlessIssue(
      'INVALID_CLIENT_SET',
      '/state/observerAuthorizations',
      'Table authorization set does not match the Room',
    ));
  }
  if (clients.length !== 5 || orderedPlayers.some((participant) => participant === null) || table === null) {
    issues.push(headlessIssue(
      'INVALID_CLIENT_SET',
      '/clients',
      'Client set does not match the Room',
    ));
    return;
  }
  const expectedIds = [
    ...orderedPlayers.map((participant) => participant?.participantId),
    table.participantId,
  ];
  const expectedCapabilities = [
    ...state.room.seats.map((seat) => seat.seatCapability),
    tableAuthorization?.observerCapability,
  ];
  const seenIds = new Set<string>();
  const seenCapabilities = new Set<string>();
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index];
    if (client === undefined) continue;
    if (client.participantId !== expectedIds[index]
      || client.participantCapability !== expectedCapabilities[index]
      || seenIds.has(client.participantId)
      || seenCapabilities.has(client.participantCapability)) {
      issues.push(headlessIssue(
        'INVALID_CLIENT_SET',
        `/clients/${index}`,
        'Client identity or capability does not match the starting state',
      ));
    }
    seenIds.add(client.participantId);
    seenCapabilities.add(client.participantCapability);
  }
  const clientIds = new Set(clients.map((client) => client.participantId));
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    if (action !== undefined && !clientIds.has(action.participantId)) {
      issues.push(headlessIssue(
        'INVALID_RELATION',
        `/actions/${index}/participantId`,
        'Action participant is not a configured client',
      ));
    }
  }
}

export function validateOnlineHeadlessRoomGateInputV1(
  input: unknown,
): OnlineHeadlessRoomGateInputValidationResultV1 {
  const issues: OnlineHeadlessRoomGateIssueV1[] = [];
  const capabilities: string[] = [];
  try {
    const root = readHeadlessExactRecord(input, INPUT_FIELDS, '', issues, INPUT_FIELDS);
    if (root === null) return failure(issues);
    if (root.kind !== 'online-local-headless-room-gate-input-v1') {
      issues.push(headlessIssue('INVALID_LITERAL', '/kind', 'Invalid headless gate input kind'));
    }
    if (root.schemaVersion !== ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1) {
      issues.push(headlessIssue('INVALID_VERSION', '/schemaVersion', 'Invalid headless gate schema version'));
    }
    let state: OnlineProtocolStateV1 | null = null;
    try {
      const checked = validateOnlineProtocolStateV1(root.state);
      if (checked.ok) {
        state = checked.value;
        capabilities.push(
          ...state.room.seats.map((seat) => seat.seatCapability),
          ...state.observerAuthorizations.map((entry) => entry.observerCapability),
        );
      } else {
        issues.push(headlessIssue('INVALID_PROTOCOL_STATE', '/state', 'Invalid protocol state'));
      }
    } catch {
      issues.push(headlessIssue('INVALID_PROTOCOL_STATE', '/state', 'Invalid protocol state'));
    }
    const clientArray = readHeadlessDenseArray(root.clients, '/clients', issues, 5, capabilities);
    const clients: OnlineHeadlessRoomGateClientV1[] = [];
    if (clientArray !== null) {
      for (let index = 0; index < clientArray.length; index += 1) {
        const parsed = parseClient(clientArray.values[index], `/clients/${index}`, issues, capabilities);
        if (parsed !== null) clients.push(parsed);
      }
    }
    const actionArray = readHeadlessDenseArray(root.actions, '/actions', issues, 256, capabilities);
    const actions: OnlineHeadlessRoomGateActionV1[] = [];
    if (actionArray !== null) {
      for (let index = 0; index < actionArray.length; index += 1) {
        const parsed = parseAction(actionArray.values[index], `/actions/${index}`, issues, capabilities);
        if (parsed !== null) {
          if (inspectHeadlessPublicGraph(parsed, capabilities) === 'contains-capability') {
            issues.push(headlessIssue(
              'INVALID_CAPABILITY',
              `/actions/${index}`,
              'Action contains configured capability data',
            ));
          } else {
            actions.push(parsed);
          }
        }
      }
    }
    if (state !== null
      && clientArray !== null
      && clients.length === clientArray.length
      && actionArray !== null
      && actions.length === actionArray.length) {
      validateStartingRelations(state, clients, actions, issues);
    }
    if (issues.length > 0
      || state === null
      || clientArray === null
      || clients.length !== clientArray.length
      || actionArray === null
      || actions.length !== actionArray.length) {
      return failure(issues, capabilities);
    }
    return success(Object.freeze({
      kind: 'online-local-headless-room-gate-input-v1' as const,
      schemaVersion: ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1,
      state,
      clients: Object.freeze(clients.slice()),
      actions: Object.freeze(actions.slice()),
    }));
  } catch {
    return failure([
      headlessIssue('INVALID_DESCRIPTOR', '', 'Input could not be inspected safely'),
    ], capabilities);
  }
}

function parseReportClient(
  input: unknown,
  path: string,
  issues: OnlineHeadlessRoomGateIssueV1[],
): OnlineHeadlessRoomGateReportClientV1 | null {
  const record = readHeadlessExactRecord(input, REPORT_CLIENT_FIELDS, path, issues);
  if (record === null) return null;
  if (!isHeadlessApplicationId(record.participantId)) {
    issues.push(headlessIssue('INVALID_ID', `${path}/participantId`, 'Invalid participant ID'));
  }
  if (record.role !== 'player' && record.role !== 'table') {
    issues.push(headlessIssue('INVALID_LITERAL', `${path}/role`, 'Invalid report client role'));
  }
  if (record.role === 'player') {
    if (record.corePlayerId !== 'P1'
      && record.corePlayerId !== 'P2'
      && record.corePlayerId !== 'P3'
      && record.corePlayerId !== 'P4') {
      issues.push(headlessIssue('INVALID_ID', `${path}/corePlayerId`, 'Invalid Core player ID'));
    }
  } else if (record.role === 'table' && record.corePlayerId !== null) {
    issues.push(headlessIssue('INVALID_RELATION', `${path}/corePlayerId`, 'Table has no Core player ID'));
  }
  if (record.presence !== 'connected' && record.presence !== 'disconnected') {
    issues.push(headlessIssue('INVALID_LITERAL', `${path}/presence`, 'Invalid report client presence'));
  } else if (record.presence !== 'connected') {
    issues.push(headlessIssue('INVALID_RELATION', `${path}/presence`, 'Final client must be connected'));
  }
  if (!isHeadlessApplicationId(record.participantId)
    || (record.role !== 'player' && record.role !== 'table')
    || (record.role === 'player'
      && record.corePlayerId !== 'P1'
      && record.corePlayerId !== 'P2'
      && record.corePlayerId !== 'P3'
      && record.corePlayerId !== 'P4')
    || (record.role === 'table' && record.corePlayerId !== null)
    || record.presence !== 'connected') return null;
  return Object.freeze({
    participantId: record.participantId as OnlineRoomParticipantIdV1,
    role: record.role,
    corePlayerId: record.corePlayerId as CorePlayerId | null,
    presence: 'connected' as const,
  });
}

function parseCounts(
  input: unknown,
  issues: OnlineHeadlessRoomGateIssueV1[],
): OnlineHeadlessRoomGateCountsV1 | null {
  const record = readHeadlessExactRecord(input, COUNT_FIELDS, '/counts', issues);
  if (record === null) return null;
  for (const field of COUNT_FIELDS) {
    if (!isHeadlessNonNegativeInteger(record[field])) {
      issues.push(headlessIssue(
        'INVALID_INTEGER',
        `/counts/${field}`,
        'Count must be a non-negative safe integer',
      ));
    }
  }
  if (!COUNT_FIELDS.every((field) => isHeadlessNonNegativeInteger(record[field]))) return null;
  return Object.freeze(Object.fromEntries(
    COUNT_FIELDS.map((field) => [field, record[field] as number]),
  )) as OnlineHeadlessRoomGateCountsV1;
}

function parseCoverage(
  input: unknown,
  issues: OnlineHeadlessRoomGateIssueV1[],
): OnlineHeadlessRoomGateCoverageV1 | null {
  const record = readHeadlessExactRecord(input, COVERAGE_FIELDS, '/coverage', issues);
  if (record === null) return null;
  for (const field of COVERAGE_FIELDS) {
    if (record[field] !== true) {
      issues.push(headlessIssue(
        'INVALID_LITERAL',
        `/coverage/${field}`,
        'Successful coverage value must be true',
      ));
    }
  }
  if (!COVERAGE_FIELDS.every((field) => record[field] === true)) return null;
  return Object.freeze(Object.fromEntries(
    COVERAGE_FIELDS.map((field) => [field, true]),
  )) as OnlineHeadlessRoomGateCoverageV1;
}

function exceedsHeadlessCountBudget(
  values: readonly number[],
  maximum: number,
): boolean {
  let remaining = maximum;
  for (const value of values) {
    if (value > remaining) return true;
    remaining -= value;
  }
  return false;
}

function validateReportRelations(
  finalRevision: number,
  clients: readonly OnlineHeadlessRoomGateReportClientV1[],
  counts: OnlineHeadlessRoomGateCountsV1,
  issues: OnlineHeadlessRoomGateIssueV1[],
): void {
  if (clients.length !== 5
    || clients.slice(0, 4).some((client) => client.role !== 'player' || client.corePlayerId === null)
    || clients.slice(0, 4).some((client, index) =>
      client.corePlayerId !== (['P1', 'P2', 'P3', 'P4'] as const)[index])
    || clients[4]?.role !== 'table'
    || clients[4]?.corePlayerId !== null) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/clients',
      'Report clients must be four Players followed by Table',
    ));
  }
  const participantIds = clients.map((client) => client.participantId);
  const corePlayerIds = clients
    .filter((client) => client.role === 'player')
    .map((client) => client.corePlayerId);
  if (new Set(participantIds).size !== participantIds.length
    || new Set(corePlayerIds).size !== corePlayerIds.length) {
    issues.push(headlessIssue('INVALID_RELATION', '/clients', 'Report client identities must be unique'));
  }
  if (finalRevision !== counts.commandsAccepted) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/finalRevision',
      'Final revision must equal accepted unique command count',
    ));
  }
  if (counts.commandsAccepted < 2) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/commandsAccepted',
      'At least two unique commands must be accepted',
    ));
  }
  if (counts.clientHellosAccepted < 5) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/clientHellosAccepted',
      'Every client must have an accepted hello',
    ));
  }
  if (counts.projectionsAccepted < 5) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/projectionsAccepted',
      'Every client must have an accepted projection',
    ));
  }
  if (counts.commandDuplicates < 1) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/commandDuplicates',
      'An accepted duplicate command witness is required',
    ));
  }
  if (counts.staleRevisionRejections < 1
    || counts.staleRevisionRejections > counts.commandsRejected) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/staleRevisionRejections',
      'Stale rejection count must be a non-empty command-rejection subset',
    ));
  }
  if (counts.roleRejections < 1 || counts.roleRejections > counts.commandsRejected) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/roleRejections',
      'Role rejection count must be a non-empty command-rejection subset',
    ));
  }
  if (exceedsHeadlessCountBudget([
    counts.staleRevisionRejections,
    counts.roleRejections,
    1,
  ], counts.commandsRejected)) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/commandsRejected',
      'Rejected commands must include stale, role, and another Player rejection',
    ));
  }
  if (counts.disconnects < 2) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/disconnects',
      'Player and Table disconnect witnesses are required',
    ));
  }
  if (counts.playerRejoins < 1 || counts.tableRejoins < 1
    || exceedsHeadlessCountBudget([
      counts.playerRejoins,
      counts.tableRejoins,
    ], counts.projectionsAccepted)) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/playerRejoins',
      'Player and Table rejoins must be accepted projection subsets',
    ));
  }
  if (exceedsHeadlessCountBudget([
    counts.playerRejoins,
    counts.tableRejoins,
  ], counts.disconnects)) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts/playerRejoins',
      'Player and Table rejoins must be backed by disconnects',
    ));
  }
  if (exceedsHeadlessCountBudget([
    counts.clientHellosAccepted,
    counts.clientHellosRejected,
    counts.commandsAccepted,
    counts.commandsRejected,
    counts.commandDuplicates,
    counts.projectionsAccepted,
    counts.projectionsRejected,
    counts.disconnects,
  ], 256)) {
    issues.push(headlessIssue(
      'INVALID_RELATION',
      '/counts',
      'Aggregate action outcome counts must not exceed the action limit',
    ));
  }
}

export function validateOnlineHeadlessRoomGateReportV1(
  input: unknown,
): OnlineHeadlessRoomGateReportValidationResultV1 {
  const issues: OnlineHeadlessRoomGateIssueV1[] = [];
  try {
    const root = readHeadlessExactRecord(input, REPORT_FIELDS, '', issues);
    if (root === null) return failure(issues);
    if (root.kind !== 'online-local-headless-room-gate-report-v1') {
      issues.push(headlessIssue('INVALID_LITERAL', '/kind', 'Invalid headless gate report kind'));
    }
    if (root.schemaVersion !== ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1) {
      issues.push(headlessIssue('INVALID_VERSION', '/schemaVersion', 'Invalid headless gate schema version'));
    }
    if (root.protocolVersion !== CURRENT_CONTRACT_VERSIONS.protocolVersion
      || root.protocolVersion !== 1) {
      issues.push(headlessIssue('INVALID_VERSION', '/protocolVersion', 'Invalid protocol version'));
    }
    if (!isHeadlessApplicationId(root.roomId)) {
      issues.push(headlessIssue('INVALID_ID', '/roomId', 'Invalid Room ID'));
    }
    if (root.initialRevision !== 0) {
      issues.push(headlessIssue('INVALID_LITERAL', '/initialRevision', 'Initial revision must be zero'));
    }
    if (!isHeadlessNonNegativeInteger(root.finalRevision)) {
      issues.push(headlessIssue(
        'INVALID_INTEGER',
        '/finalRevision',
        'Final revision must be a non-negative safe integer',
      ));
    }
    if (root.finalRoomLifecycle !== 'active' && root.finalRoomLifecycle !== 'finished') {
      issues.push(headlessIssue(
        'INVALID_LITERAL',
        '/finalRoomLifecycle',
        'Invalid final Room lifecycle',
      ));
    }
    const clientArray = readHeadlessDenseArray(root.clients, '/clients', issues, 5);
    const clients: OnlineHeadlessRoomGateReportClientV1[] = [];
    if (clientArray !== null) {
      for (let index = 0; index < clientArray.length; index += 1) {
        const parsed = parseReportClient(clientArray.values[index], `/clients/${index}`, issues);
        if (parsed !== null) clients.push(parsed);
      }
    }
    const counts = parseCounts(root.counts, issues);
    const coverage = parseCoverage(root.coverage, issues);
    const deferred = readHeadlessDenseArray(root.deferred, '/deferred', issues, 7);
    if (deferred !== null) {
      if (deferred.length !== DEFERRED.length) {
        issues.push(headlessIssue('INVALID_RELATION', '/deferred', 'Invalid deferred boundary'));
      }
      for (let index = 0; index < Math.max(deferred.length, DEFERRED.length); index += 1) {
        if (deferred.values[index] !== DEFERRED[index]) {
          issues.push(headlessIssue(
            'INVALID_LITERAL',
            `/deferred/${index}`,
            'Invalid deferred boundary entry',
          ));
        }
      }
    }
    if (isHeadlessNonNegativeInteger(root.finalRevision)
      && clientArray !== null
      && clients.length === clientArray.length
      && counts !== null) {
      validateReportRelations(root.finalRevision, clients, counts, issues);
    }
    if (issues.length > 0
      || root.kind !== 'online-local-headless-room-gate-report-v1'
      || root.schemaVersion !== ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1
      || root.protocolVersion !== 1
      || !isHeadlessApplicationId(root.roomId)
      || root.initialRevision !== 0
      || !isHeadlessNonNegativeInteger(root.finalRevision)
      || (root.finalRoomLifecycle !== 'active' && root.finalRoomLifecycle !== 'finished')
      || clientArray === null
      || clients.length !== clientArray.length
      || counts === null
      || coverage === null
      || deferred === null
      || deferred.length !== DEFERRED.length) {
      return failure(issues);
    }
    const value: OnlineHeadlessRoomGateReportV1 = Object.freeze({
      kind: 'online-local-headless-room-gate-report-v1',
      schemaVersion: ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1,
      protocolVersion: 1,
      roomId: root.roomId as OnlineHeadlessRoomGateReportV1['roomId'],
      initialRevision: 0,
      finalRevision: root.finalRevision,
      finalRoomLifecycle: root.finalRoomLifecycle,
      clients: Object.freeze(clients.slice()),
      counts,
      coverage,
      deferred: freshDeferred(),
    });
    return success(value);
  } catch {
    return failure([headlessIssue(
      'INVALID_DESCRIPTOR',
      '',
      'Report could not be inspected safely',
    )]);
  }
}

export { DEFERRED as ONLINE_HEADLESS_ROOM_GATE_DEFERRED_V1 };
