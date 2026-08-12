import {
  isCoreBaseId,
  validateModeNeutralCoreRootV1,
  type CorePlayerId,
  type ModeNeutralCoreRootV1,
} from '../../engine/core/index';
import { OnlineRoomCreationErrorV1, OnlineRoomOperationErrorV1 } from './errors';
import type {
  OnlineRoomLifecycleV1,
  OnlineRoomParticipantIdV1,
  OnlineRoomParticipantV1,
  OnlineRoomSeatCapabilityV1,
  OnlineRoomSeatIndexV1,
  OnlineRoomSeatOutcomeV1,
  OnlineRoomSeatV1,
  OnlineRoomV1,
  OnlineRoomValidationIssueV1,
} from './types';
import { ONLINE_ROOM_SCHEMA_VERSION_V1 } from './types';
import { validateOnlineRoomV1 } from './validation';
import {
  hasReadableField,
  hasFieldReadIssue,
  isOnlineRoomApplicationIdV1,
  isOnlineRoomSeatCapabilityV1,
  isOnlineRoomSeatIndexV1,
  readDenseArray,
  readExactRecord,
  roomIssue,
} from './validationSupport';

const CREATION_FIELDS = ['roomId', 'seatAssignments', 'host'] as const;
const SEAT_ASSIGNMENT_FIELDS = ['seatIndex', 'corePlayerId', 'seatCapability'] as const;
const HOST_FIELDS = ['participantId', 'seatCapability'] as const;
const JOIN_FIELDS = ['participantId', 'role', 'seatCapability'] as const;
const REJOIN_FIELDS = ['participantId', 'seatCapability'] as const;
const READY_FIELDS = ['participantId', 'seatCapability', 'ready'] as const;
const ACTIVATE_FIELDS = ['hostParticipantId', 'coreRoot'] as const;

type ParsedSeatAssignment = Readonly<{
  readonly inputIndex: number;
  readonly seatIndex: OnlineRoomSeatIndexV1;
  readonly corePlayerId: CorePlayerId;
  readonly seatCapability: OnlineRoomSeatCapabilityV1;
}>;

type ParsedJoin =
  | Readonly<{
      readonly participantId: OnlineRoomParticipantIdV1;
      readonly role: 'player';
      readonly seatCapability: OnlineRoomSeatCapabilityV1;
    }>
  | Readonly<{
      readonly participantId: OnlineRoomParticipantIdV1;
      readonly role: 'table' | 'spectator';
    }>;

function throwCreation(
  issues: readonly OnlineRoomValidationIssueV1[],
  configuredCapabilities: readonly string[] = [],
): never {
  throw new OnlineRoomCreationErrorV1(issues, configuredCapabilities);
}

function throwOperation(
  issues: readonly OnlineRoomValidationIssueV1[],
  configuredCapabilities: readonly string[] = [],
): never {
  throw new OnlineRoomOperationErrorV1(issues, configuredCapabilities);
}

function failOperation(
  code: OnlineRoomValidationIssueV1['code'],
  path: string,
  message: string,
  configuredCapabilities: readonly string[] = [],
): never {
  return throwOperation([roomIssue(code, path, message)], configuredCapabilities);
}

function roomCapabilities(room: OnlineRoomV1): readonly OnlineRoomSeatCapabilityV1[] {
  return room.seats.map((seat) => seat.seatCapability);
}

function validatedRoom(input: unknown): OnlineRoomV1 {
  const result = validateOnlineRoomV1(input);
  if (!result.ok) throwOperation(result.issues);
  return result.value;
}

function validatedOperationRoom(candidate: unknown): OnlineRoomV1 {
  const result = validateOnlineRoomV1(candidate);
  if (!result.ok) throwOperation(result.issues);
  return result.value;
}

function validatedCreationRoom(candidate: unknown): OnlineRoomV1 {
  const result = validateOnlineRoomV1(candidate);
  if (!result.ok) throwCreation(result.issues);
  return result.value;
}

function participantFor(
  room: OnlineRoomV1,
  participantId: OnlineRoomParticipantIdV1,
): OnlineRoomParticipantV1 | undefined {
  return room.participants.find((participant) => participant.participantId === participantId);
}

function participantIndexFor(room: OnlineRoomV1, participantId: OnlineRoomParticipantIdV1): number {
  return room.participants.findIndex((participant) => participant.participantId === participantId);
}

function derivePreStartLifecycle(
  participants: readonly OnlineRoomParticipantV1[],
  seats: readonly OnlineRoomSeatV1[],
): 'forming' | 'ready' {
  const participantsById = new Map(
    participants.map((participant) => [participant.participantId, participant]),
  );
  const allReady = seats.every((seat) => {
    if (seat.participantId === null || !seat.ready || seat.outcome !== 'pending') return false;
    const participant = participantsById.get(seat.participantId);
    return participant?.role === 'player' && participant.presence === 'connected';
  });
  return allReady ? 'ready' : 'forming';
}

function roomCandidate(
  room: OnlineRoomV1,
  lifecycle: OnlineRoomLifecycleV1,
  participants: readonly OnlineRoomParticipantV1[] = room.participants,
  seats: readonly OnlineRoomSeatV1[] = room.seats,
): unknown {
  return {
    kind: 'online-room-v1',
    schemaVersion: ONLINE_ROOM_SCHEMA_VERSION_V1,
    roomId: room.roomId,
    lifecycle,
    hostParticipantId: room.hostParticipantId,
    participants,
    seats,
  };
}

function parseSeatAssignment(
  input: unknown,
  index: number,
  issues: OnlineRoomValidationIssueV1[],
  configuredCapabilities: string[],
): ParsedSeatAssignment | null {
  const path = `/seatAssignments/${index}`;
  const record = readExactRecord(input, SEAT_ASSIGNMENT_FIELDS, path, issues);
  if (record === null) return null;

  const seatIndexReadable = hasReadableField(record, 'seatIndex');
  const seatIndex =
    seatIndexReadable && isOnlineRoomSeatIndexV1(record.seatIndex) ? record.seatIndex : null;
  if (seatIndexReadable) {
    if (seatIndex === null && !hasFieldReadIssue(issues, `${path}/seatIndex`)) {
      issues.push(
        roomIssue(
          'INVALID_INTEGER',
          `${path}/seatIndex`,
          'Seat index must be an integer from 0 through 3',
        ),
      );
    } else if (seatIndex !== index) {
      issues.push(
        roomIssue(
          'INVALID_RELATION',
          `${path}/seatIndex`,
          'Seat assignment index must equal its array position',
        ),
      );
    }
  }
  const corePlayerIdReadable = hasReadableField(record, 'corePlayerId');
  const corePlayerId =
    corePlayerIdReadable && isCoreBaseId(record.corePlayerId)
      ? (record.corePlayerId as CorePlayerId)
      : null;
  if (corePlayerIdReadable && !corePlayerId && !hasFieldReadIssue(issues, `${path}/corePlayerId`))
    issues.push(roomIssue('INVALID_ID', `${path}/corePlayerId`, 'Invalid Core player ID'));
  const seatCapabilityReadable = hasReadableField(record, 'seatCapability');
  const seatCapability =
    seatCapabilityReadable && isOnlineRoomSeatCapabilityV1(record.seatCapability)
      ? (record.seatCapability as OnlineRoomSeatCapabilityV1)
      : null;
  if (seatCapability !== null) configuredCapabilities.push(seatCapability);
  if (
    seatCapabilityReadable &&
    !seatCapability &&
    !hasFieldReadIssue(issues, `${path}/seatCapability`)
  ) {
    issues.push(
      roomIssue('INVALID_CAPABILITY', `${path}/seatCapability`, 'Invalid seat capability'),
    );
  }
  if (seatIndex === null || seatIndex !== index || corePlayerId === null || seatCapability === null)
    return null;
  return Object.freeze({ inputIndex: index, seatIndex, corePlayerId, seatCapability });
}

export function createOnlineRoomV1(input: unknown): OnlineRoomV1 {
  const issues: OnlineRoomValidationIssueV1[] = [];
  const configuredCapabilities: string[] = [];
  const root = readExactRecord(input, CREATION_FIELDS, '', issues);
  if (root === null) throwCreation(issues, configuredCapabilities);

  const roomIdReadable = hasReadableField(root, 'roomId');
  const roomId = roomIdReadable && isOnlineRoomApplicationIdV1(root.roomId) ? root.roomId : null;
  if (roomIdReadable && roomId === null && !hasFieldReadIssue(issues, '/roomId'))
    issues.push(roomIssue('INVALID_ID', '/roomId', 'Invalid Room ID'));

  const rawAssignments = hasReadableField(root, 'seatAssignments')
    ? readDenseArray(root.seatAssignments, '/seatAssignments', issues)
    : null;
  if (rawAssignments !== null && rawAssignments.length !== 4) {
    issues.push(
      roomIssue(
        'INVALID_ARRAY',
        '/seatAssignments',
        'Seat assignments must contain exactly four entries',
      ),
    );
  }
  const assignments = (rawAssignments?.entries ?? [])
    .map(({ index, value }) =>
      parseSeatAssignment(value, index, issues, configuredCapabilities),
    )
    .filter((value): value is ParsedSeatAssignment => value !== null);

  const coreIds = new Set<string>();
  const capabilities = new Set<string>();
  for (const assignment of assignments) {
    if (coreIds.has(assignment.corePlayerId)) {
      issues.push(
        roomIssue(
          'DUPLICATE_CORE_PLAYER',
          `/seatAssignments/${assignment.inputIndex}/corePlayerId`,
          'Core player IDs must be unique across Room seats',
        ),
      );
    }
    coreIds.add(assignment.corePlayerId);
    if (capabilities.has(assignment.seatCapability)) {
      issues.push(
        roomIssue(
          'DUPLICATE_CAPABILITY',
          `/seatAssignments/${assignment.inputIndex}/seatCapability`,
          'Seat capabilities must be unique across Room seats',
        ),
      );
    }
    capabilities.add(assignment.seatCapability);
  }

  const host = hasReadableField(root, 'host')
    ? readExactRecord(root.host, HOST_FIELDS, '/host', issues)
    : null;
  const hostParticipantIdReadable = host !== null && hasReadableField(host, 'participantId');
  const hostParticipantId =
    hostParticipantIdReadable && isOnlineRoomApplicationIdV1(host.participantId)
      ? (host.participantId as OnlineRoomParticipantIdV1)
      : null;
  if (
    hostParticipantIdReadable &&
    hostParticipantId === null &&
    !hasFieldReadIssue(issues, '/host/participantId')
  ) {
    issues.push(roomIssue('INVALID_ID', '/host/participantId', 'Invalid host participant ID'));
  }
  const hostCapabilityReadable = host !== null && hasReadableField(host, 'seatCapability');
  const hostCapability =
    hostCapabilityReadable && isOnlineRoomSeatCapabilityV1(host.seatCapability)
      ? (host.seatCapability as OnlineRoomSeatCapabilityV1)
      : null;
  if (hostCapability !== null) configuredCapabilities.push(hostCapability);
  if (
    hostCapabilityReadable &&
    hostCapability === null &&
    !hasFieldReadIssue(issues, '/host/seatCapability')
  ) {
    issues.push(roomIssue('INVALID_CAPABILITY', '/host/seatCapability', 'Invalid seat capability'));
  }
  const hostSeat =
    hostCapability === null
      ? undefined
      : assignments.find((assignment) => assignment.seatCapability === hostCapability);
  if (hostCapability !== null && hostSeat === undefined) {
    issues.push(
      roomIssue('CAPABILITY_REJECTED', '/host/seatCapability', 'Seat capability was rejected'),
    );
  }

  if (
    issues.length > 0 ||
    roomId === null ||
    rawAssignments === null ||
    rawAssignments.length !== 4 ||
    assignments.length !== 4 ||
    hostParticipantId === null ||
    hostCapability === null ||
    hostSeat === undefined
  ) {
    throwCreation(issues, configuredCapabilities);
  }

  const participants: readonly OnlineRoomParticipantV1[] = [
    Object.freeze({
      participantId: hostParticipantId,
      role: 'player',
      presence: 'connected',
      seatIndex: hostSeat.seatIndex,
    }),
  ];
  const seats = assignments.map((assignment) =>
    Object.freeze({
      seatIndex: assignment.seatIndex,
      corePlayerId: assignment.corePlayerId,
      seatCapability: assignment.seatCapability,
      participantId: assignment.seatIndex === hostSeat.seatIndex ? hostParticipantId : null,
      ready: false,
      outcome: 'pending' as const,
    }),
  );
  return validatedCreationRoom({
    kind: 'online-room-v1',
    schemaVersion: ONLINE_ROOM_SCHEMA_VERSION_V1,
    roomId,
    lifecycle: 'forming',
    hostParticipantId,
    participants,
    seats,
  });
}

function parseJoinInput(
  input: unknown,
  configuredCapabilities: string[],
): ParsedJoin {
  const issues: OnlineRoomValidationIssueV1[] = [];
  const record = readExactRecord(input, JOIN_FIELDS, '', issues, ['participantId', 'role']);
  if (record === null) throwOperation(issues, configuredCapabilities);

  const participantIdReadable = hasReadableField(record, 'participantId');
  const participantId =
    participantIdReadable && isOnlineRoomApplicationIdV1(record.participantId)
      ? (record.participantId as OnlineRoomParticipantIdV1)
      : null;
  if (
    participantIdReadable &&
    participantId === null &&
    !hasFieldReadIssue(issues, '/participantId')
  )
    issues.push(roomIssue('INVALID_ID', '/participantId', 'Invalid Room participant ID'));

  const roleReadable = hasReadableField(record, 'role');
  const role =
    roleReadable &&
    (record.role === 'player' || record.role === 'table' || record.role === 'spectator')
      ? record.role
      : null;
  if (roleReadable && role === null && !hasFieldReadIssue(issues, '/role'))
    issues.push(roomIssue('INVALID_LITERAL', '/role', 'Invalid participant role'));

  const readableSeatCapability =
    hasReadableField(record, 'seatCapability') &&
    isOnlineRoomSeatCapabilityV1(record.seatCapability)
      ? (record.seatCapability as OnlineRoomSeatCapabilityV1)
      : null;
  if (readableSeatCapability !== null) configuredCapabilities.push(readableSeatCapability);

  let seatCapability: OnlineRoomSeatCapabilityV1 | null = null;
  if (role === 'player') {
    const capabilityDescriptorIssue = issues.some(
      (current) => current.path === '/seatCapability' && current.code === 'INVALID_DESCRIPTOR',
    );
    if (!hasReadableField(record, 'seatCapability')) {
      if (!capabilityDescriptorIssue) {
        issues.push(roomIssue('MISSING_FIELD', '/seatCapability', 'Missing field: seatCapability'));
      }
    } else if (
      !isOnlineRoomSeatCapabilityV1(record.seatCapability) &&
      !hasFieldReadIssue(issues, '/seatCapability')
    ) {
      issues.push(roomIssue('INVALID_CAPABILITY', '/seatCapability', 'Invalid seat capability'));
    } else {
      seatCapability = readableSeatCapability;
    }
  } else if (
    (role === 'table' || role === 'spectator') &&
    hasReadableField(record, 'seatCapability')
  ) {
    issues.push(
      roomIssue(
        'UNKNOWN_FIELD',
        '/seatCapability',
        'Observer join input must not contain a capability',
      ),
    );
  }

  if (issues.length > 0 || participantId === null || role === null)
    throwOperation(issues, configuredCapabilities);
  if (role === 'player') {
    if (seatCapability === null) throwOperation(issues, configuredCapabilities);
    return Object.freeze({ participantId, role, seatCapability });
  }
  return Object.freeze({ participantId, role });
}

export function joinOnlineRoomV1(roomInput: unknown, input: unknown): OnlineRoomV1 {
  const room = validatedRoom(roomInput);
  const configuredCapabilities = [...roomCapabilities(room)];
  const join = parseJoinInput(input, configuredCapabilities);
  if (room.lifecycle === 'finished') {
    failOperation(
      'INVALID_LIFECYCLE',
      '/lifecycle',
      'Participants cannot join a finished Room',
      configuredCapabilities,
    );
  }
  if (participantFor(room, join.participantId) !== undefined) {
    failOperation(
      'PARTICIPANT_ALREADY_EXISTS',
      '/participantId',
      'Participant ID is already present in the Room',
      configuredCapabilities,
    );
  }

  if (join.role === 'player') {
    if (room.lifecycle !== 'forming' && room.lifecycle !== 'ready') {
      failOperation(
        'INVALID_LIFECYCLE',
        '/lifecycle',
        'Players may join only before Room start',
        configuredCapabilities,
      );
    }
    const seatIndex = room.seats.findIndex((seat) => seat.seatCapability === join.seatCapability);
    const seat = seatIndex < 0 ? undefined : room.seats[seatIndex];
    if (seat === undefined || seat.participantId !== null || seat.outcome !== 'pending') {
      failOperation(
        'CAPABILITY_REJECTED',
        '/seatCapability',
        'Seat capability was rejected',
        configuredCapabilities,
      );
    }
    const participant: OnlineRoomParticipantV1 = Object.freeze({
      participantId: join.participantId,
      role: 'player',
      presence: 'connected',
      seatIndex: seat.seatIndex,
    });
    const participants = Object.freeze([...room.participants, participant]);
    const seats = Object.freeze(
      room.seats.map((current) =>
        current.seatIndex === seat.seatIndex
          ? Object.freeze({
              seatIndex: current.seatIndex,
              corePlayerId: current.corePlayerId,
              seatCapability: current.seatCapability,
              participantId: join.participantId,
              ready: false,
              outcome: current.outcome,
            })
          : current,
      ),
    );
    return validatedOperationRoom(
      roomCandidate(room, derivePreStartLifecycle(participants, seats), participants, seats),
    );
  }

  if (
    join.role === 'table' &&
    room.participants.some((participant) => participant.role === 'table')
  ) {
    failOperation(
      'TABLE_ALREADY_PRESENT',
      '/role',
      'A Room may contain at most one table participant',
      configuredCapabilities,
    );
  }
  const participant: OnlineRoomParticipantV1 = Object.freeze({
    participantId: join.participantId,
    role: join.role,
    presence: 'connected',
    seatIndex: null,
  });
  return validatedOperationRoom(
    roomCandidate(room, room.lifecycle, Object.freeze([...room.participants, participant])),
  );
}

export function disconnectOnlineRoomParticipantV1(
  roomInput: unknown,
  participantIdInput: unknown,
): OnlineRoomV1 {
  const room = validatedRoom(roomInput);
  const configuredCapabilities = roomCapabilities(room);
  if (!isOnlineRoomApplicationIdV1(participantIdInput)) {
    failOperation(
      'INVALID_ID',
      '/participantId',
      'Invalid Room participant ID',
      configuredCapabilities,
    );
  }
  const participantId = participantIdInput as OnlineRoomParticipantIdV1;
  const participantIndex = participantIndexFor(room, participantId);
  const participant = participantIndex < 0 ? undefined : room.participants[participantIndex];
  if (participant === undefined) {
    failOperation(
      'PARTICIPANT_NOT_FOUND',
      '/participantId',
      'Participant is not present in the Room',
      configuredCapabilities,
    );
  }
  if (participant.presence === 'disconnected') {
    failOperation(
      'PARTICIPANT_ALREADY_DISCONNECTED',
      '/participantId',
      'Participant is already disconnected',
      configuredCapabilities,
    );
  }

  const participants = Object.freeze(
    room.participants.map((current, index) =>
      index === participantIndex
        ? current.role === 'player'
          ? Object.freeze({
              participantId: current.participantId,
              role: current.role,
              presence: 'disconnected' as const,
              seatIndex: current.seatIndex,
            })
          : Object.freeze({
              participantId: current.participantId,
              role: current.role,
              presence: 'disconnected' as const,
              seatIndex: null,
            })
        : current,
    ),
  );

  let seats = room.seats;
  let lifecycle = room.lifecycle;
  if (
    participant.role === 'player' &&
    (room.lifecycle === 'forming' || room.lifecycle === 'ready')
  ) {
    seats = Object.freeze(
      room.seats.map((seat) =>
        seat.seatIndex === participant.seatIndex
          ? Object.freeze({
              seatIndex: seat.seatIndex,
              corePlayerId: seat.corePlayerId,
              seatCapability: seat.seatCapability,
              participantId: seat.participantId,
              ready: false,
              outcome: seat.outcome,
            })
          : seat,
      ),
    );
    lifecycle = derivePreStartLifecycle(participants, seats);
  }
  return validatedOperationRoom(roomCandidate(room, lifecycle, participants, seats));
}

function parsePlayerCapabilityInput(
  input: unknown,
  fields: readonly string[],
  includeReady: boolean,
  configuredCapabilities: string[],
): Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly seatCapability: OnlineRoomSeatCapabilityV1;
  readonly ready?: boolean;
}> {
  const issues: OnlineRoomValidationIssueV1[] = [];
  const record = readExactRecord(input, fields, '', issues);
  if (record === null) throwOperation(issues, configuredCapabilities);
  const participantIdReadable = hasReadableField(record, 'participantId');
  const participantId =
    participantIdReadable && isOnlineRoomApplicationIdV1(record.participantId)
      ? (record.participantId as OnlineRoomParticipantIdV1)
      : null;
  if (
    participantIdReadable &&
    participantId === null &&
    !hasFieldReadIssue(issues, '/participantId')
  )
    issues.push(roomIssue('INVALID_ID', '/participantId', 'Invalid Room participant ID'));
  const seatCapabilityReadable = hasReadableField(record, 'seatCapability');
  const seatCapability =
    seatCapabilityReadable && isOnlineRoomSeatCapabilityV1(record.seatCapability)
      ? (record.seatCapability as OnlineRoomSeatCapabilityV1)
      : null;
  if (seatCapability !== null) configuredCapabilities.push(seatCapability);
  if (
    seatCapabilityReadable &&
    seatCapability === null &&
    !hasFieldReadIssue(issues, '/seatCapability')
  ) {
    issues.push(roomIssue('INVALID_CAPABILITY', '/seatCapability', 'Invalid seat capability'));
  }
  const readyReadable = hasReadableField(record, 'ready');
  const ready =
    includeReady && readyReadable && typeof record.ready === 'boolean' ? record.ready : undefined;
  if (includeReady && readyReadable && ready === undefined && !hasFieldReadIssue(issues, '/ready'))
    issues.push(roomIssue('INVALID_TYPE', '/ready', 'Ready must be a boolean'));
  if (issues.length > 0 || participantId === null || seatCapability === null)
    throwOperation(issues, configuredCapabilities);
  return includeReady
    ? Object.freeze({ participantId, seatCapability, ready: ready as boolean })
    : Object.freeze({ participantId, seatCapability });
}

export function rejoinOnlineRoomPlayerV1(roomInput: unknown, input: unknown): OnlineRoomV1 {
  const room = validatedRoom(roomInput);
  const configuredCapabilities = [...roomCapabilities(room)];
  const rejoin = parsePlayerCapabilityInput(
    input,
    REJOIN_FIELDS,
    false,
    configuredCapabilities,
  );
  const participantIndex = participantIndexFor(room, rejoin.participantId);
  const participant = participantIndex < 0 ? undefined : room.participants[participantIndex];
  if (participant === undefined) {
    failOperation(
      'PARTICIPANT_NOT_FOUND',
      '/participantId',
      'Participant is not present in the Room',
      configuredCapabilities,
    );
  }
  if (participant.role !== 'player') {
    failOperation(
      'INVALID_RELATION',
      '/participantId',
      'Only Room players may use player rejoin',
      configuredCapabilities,
    );
  }
  const seat = room.seats[participant.seatIndex];
  if (seat.seatCapability !== rejoin.seatCapability) {
    failOperation(
      'CAPABILITY_REJECTED',
      '/seatCapability',
      'Seat capability was rejected',
      configuredCapabilities,
    );
  }
  if (participant.presence !== 'disconnected') {
    failOperation(
      'PARTICIPANT_NOT_DISCONNECTED',
      '/participantId',
      'Player is not disconnected',
      configuredCapabilities,
    );
  }
  if (seat.outcome !== 'pending') {
    failOperation(
      'PLAYER_NOT_PENDING',
      '/participantId',
      'A terminal player cannot rejoin',
      configuredCapabilities,
    );
  }

  const participants = Object.freeze(
    room.participants.map((current, index) =>
      index === participantIndex
        ? Object.freeze({
            participantId: participant.participantId,
            role: 'player' as const,
            presence: 'connected' as const,
            seatIndex: participant.seatIndex,
          })
        : current,
    ),
  );
  const lifecycle =
    room.lifecycle === 'forming' || room.lifecycle === 'ready'
      ? derivePreStartLifecycle(participants, room.seats)
      : room.lifecycle;
  return validatedOperationRoom(roomCandidate(room, lifecycle, participants));
}

export function setOnlineRoomPlayerReadyV1(roomInput: unknown, input: unknown): OnlineRoomV1 {
  const room = validatedRoom(roomInput);
  const configuredCapabilities = [...roomCapabilities(room)];
  const readyInput = parsePlayerCapabilityInput(
    input,
    READY_FIELDS,
    true,
    configuredCapabilities,
  );
  if (room.lifecycle !== 'forming' && room.lifecycle !== 'ready') {
    failOperation(
      'INVALID_LIFECYCLE',
      '/lifecycle',
      'Readiness may change only before Room start',
      configuredCapabilities,
    );
  }
  const participant = participantFor(room, readyInput.participantId);
  if (participant === undefined) {
    failOperation(
      'PARTICIPANT_NOT_FOUND',
      '/participantId',
      'Participant is not present in the Room',
      configuredCapabilities,
    );
  }
  if (participant.role !== 'player') {
    failOperation(
      'INVALID_RELATION',
      '/participantId',
      'Only Room players have readiness',
      configuredCapabilities,
    );
  }
  const seat = room.seats[participant.seatIndex];
  if (seat.seatCapability !== readyInput.seatCapability) {
    failOperation(
      'CAPABILITY_REJECTED',
      '/seatCapability',
      'Seat capability was rejected',
      configuredCapabilities,
    );
  }
  if (participant.presence !== 'connected') {
    failOperation(
      'PLAYER_NOT_CONNECTED',
      '/participantId',
      'Disconnected players cannot change readiness',
      configuredCapabilities,
    );
  }
  if (seat.outcome !== 'pending') {
    failOperation(
      'PLAYER_NOT_PENDING',
      '/participantId',
      'Terminal players cannot change readiness',
      configuredCapabilities,
    );
  }

  const seats = Object.freeze(
    room.seats.map((current) =>
      current.seatIndex === seat.seatIndex
        ? Object.freeze({
            seatIndex: current.seatIndex,
            corePlayerId: current.corePlayerId,
            seatCapability: current.seatCapability,
            participantId: current.participantId,
            ready: readyInput.ready as boolean,
            outcome: current.outcome,
          })
        : current,
    ),
  );
  return validatedOperationRoom(
    roomCandidate(
      room,
      derivePreStartLifecycle(room.participants, seats),
      room.participants,
      seats,
    ),
  );
}

export function startOnlineRoomV1(
  roomInput: unknown,
  hostParticipantIdInput: unknown,
): OnlineRoomV1 {
  const room = validatedRoom(roomInput);
  const configuredCapabilities = roomCapabilities(room);
  if (!isOnlineRoomApplicationIdV1(hostParticipantIdInput)) {
    failOperation(
      'INVALID_ID',
      '/hostParticipantId',
      'Invalid host participant ID',
      configuredCapabilities,
    );
  }
  const hostParticipantId = hostParticipantIdInput as OnlineRoomParticipantIdV1;
  if (hostParticipantId !== room.hostParticipantId) {
    failOperation(
      'HOST_AUTHORITY_REQUIRED',
      '/hostParticipantId',
      'Immutable Room host authority is required',
      configuredCapabilities,
    );
  }
  if (room.lifecycle !== 'ready') {
    failOperation(
      'INVALID_LIFECYCLE',
      '/lifecycle',
      'Only a ready Room may start',
      configuredCapabilities,
    );
  }
  const host = participantFor(room, room.hostParticipantId);
  const hostSeat = host?.role === 'player' ? room.seats[host.seatIndex] : undefined;
  if (host?.role !== 'player' || host.presence !== 'connected') {
    failOperation(
      'PLAYER_NOT_CONNECTED',
      '/hostParticipantId',
      'Room host must be connected',
      configuredCapabilities,
    );
  }
  if (hostSeat?.outcome !== 'pending') {
    failOperation(
      'PLAYER_NOT_PENDING',
      '/hostParticipantId',
      'Room host must have a pending outcome',
      configuredCapabilities,
    );
  }
  return validatedOperationRoom(roomCandidate(room, 'started'));
}

function parseActivateInput(
  input: unknown,
  configuredCapabilities: readonly string[],
): Readonly<{
  readonly hostParticipantId: OnlineRoomParticipantIdV1;
  readonly coreRoot: unknown;
}> {
  const issues: OnlineRoomValidationIssueV1[] = [];
  const record = readExactRecord(input, ACTIVATE_FIELDS, '', issues);
  if (record === null) throwOperation(issues, configuredCapabilities);
  const hostParticipantIdReadable = hasReadableField(record, 'hostParticipantId');
  const hostParticipantId =
    hostParticipantIdReadable && isOnlineRoomApplicationIdV1(record.hostParticipantId)
      ? (record.hostParticipantId as OnlineRoomParticipantIdV1)
      : null;
  if (
    hostParticipantIdReadable &&
    hostParticipantId === null &&
    !hasFieldReadIssue(issues, '/hostParticipantId')
  ) {
    issues.push(roomIssue('INVALID_ID', '/hostParticipantId', 'Invalid host participant ID'));
  }
  if (issues.length > 0 || hostParticipantId === null)
    throwOperation(issues, configuredCapabilities);
  return Object.freeze({ hostParticipantId, coreRoot: record.coreRoot });
}

function validateCoreRootForRoom(
  input: unknown,
  configuredCapabilities: readonly string[],
): ModeNeutralCoreRootV1 {
  try {
    const result = validateModeNeutralCoreRootV1(input);
    if (!result.ok) {
      throwOperation(
        result.issues.map((current) =>
          roomIssue('INVALID_CORE_ROOT', `/coreRoot${current.path}`, current.message),
        ),
        configuredCapabilities,
      );
    }
    return result.value;
  } catch (error: unknown) {
    if (error instanceof OnlineRoomOperationErrorV1) throw error;
    return failOperation(
      'INVALID_CORE_ROOT',
      '/coreRoot',
      'Core root could not be inspected safely',
      configuredCapabilities,
    );
  }
}

function validateCoreRoster(
  room: OnlineRoomV1,
  coreRoot: ModeNeutralCoreRootV1,
  configuredCapabilities: readonly string[],
): void {
  const roomRoster = room.seats.map((seat) => seat.corePlayerId);
  const coreRoster = coreRoot.playerLifecycle.players.map((player) => player.playerId);
  if (
    roomRoster.length !== coreRoster.length ||
    roomRoster.some((playerId, index) => coreRoster[index] !== playerId)
  ) {
    failOperation(
      'CORE_ROSTER_MISMATCH',
      '/coreRoot/playerLifecycle/players',
      'Core full roster must equal Room seat order',
      configuredCapabilities,
    );
  }
}

function requireConnectedPendingHost(
  room: OnlineRoomV1,
  hostParticipantId: OnlineRoomParticipantIdV1,
  configuredCapabilities: readonly string[],
): void {
  if (hostParticipantId !== room.hostParticipantId) {
    failOperation(
      'HOST_AUTHORITY_REQUIRED',
      '/hostParticipantId',
      'Immutable Room host authority is required',
      configuredCapabilities,
    );
  }
  const host = participantFor(room, room.hostParticipantId);
  const hostSeat = host?.role === 'player' ? room.seats[host.seatIndex] : undefined;
  if (host?.role !== 'player' || host.presence !== 'connected') {
    failOperation(
      'PLAYER_NOT_CONNECTED',
      '/hostParticipantId',
      'Room host must be connected',
      configuredCapabilities,
    );
  }
  if (hostSeat?.outcome !== 'pending') {
    failOperation(
      'PLAYER_NOT_PENDING',
      '/hostParticipantId',
      'Room host must have a pending outcome',
      configuredCapabilities,
    );
  }
}

export function activateOnlineRoomV1(roomInput: unknown, input: unknown): OnlineRoomV1 {
  const room = validatedRoom(roomInput);
  const configuredCapabilities = roomCapabilities(room);
  const activation = parseActivateInput(input, configuredCapabilities);
  if (room.lifecycle !== 'started') {
    failOperation(
      'INVALID_LIFECYCLE',
      '/lifecycle',
      'Only a started Room may activate',
      configuredCapabilities,
    );
  }
  requireConnectedPendingHost(room, activation.hostParticipantId, configuredCapabilities);
  const coreRoot = validateCoreRootForRoom(activation.coreRoot, configuredCapabilities);
  validateCoreRoster(room, coreRoot, configuredCapabilities);
  const invalidEntryIndex = coreRoot.playerLifecycle.players.findIndex(
    (entry) => entry.status !== 'active' || entry.exitCause !== null,
  );
  if (invalidEntryIndex >= 0) {
    failOperation(
      'CORE_LIFECYCLE_MISMATCH',
      `/coreRoot/playerLifecycle/players/${invalidEntryIndex}`,
      'Activation requires four active Core players with null exit causes',
      configuredCapabilities,
    );
  }
  return validatedOperationRoom(roomCandidate(room, 'active'));
}

function outcomeForCoreEntry(
  entry: ModeNeutralCoreRootV1['playerLifecycle']['players'][number],
): OnlineRoomSeatOutcomeV1 {
  if (entry.status === 'active') return 'pending';
  return entry.exitCause === 'concession' ? 'conceded' : 'defeated';
}

export function reconcileOnlineRoomCoreLifecycleV1(
  roomInput: unknown,
  coreRootInput: unknown,
): OnlineRoomV1 {
  const room = validatedRoom(roomInput);
  const configuredCapabilities = roomCapabilities(room);
  if (room.lifecycle !== 'active') {
    failOperation(
      'INVALID_LIFECYCLE',
      '/lifecycle',
      'Only an active Room may reconcile Core lifecycle',
      configuredCapabilities,
    );
  }
  const coreRoot = validateCoreRootForRoom(coreRootInput, configuredCapabilities);
  validateCoreRoster(room, coreRoot, configuredCapabilities);

  const nextOutcomes = coreRoot.playerLifecycle.players.map(outcomeForCoreEntry);
  const monotonicIssues: OnlineRoomValidationIssueV1[] = [];
  for (const [index, seat] of room.seats.entries()) {
    const nextOutcome = nextOutcomes[index];
    if (nextOutcome === undefined) continue;
    if (seat.outcome !== 'pending' && seat.outcome !== nextOutcome) {
      monotonicIssues.push(
        roomIssue(
          'OUTCOME_REGRESSION',
          `/seats/${index}/outcome`,
          'Room seat outcomes are monotonic and cannot change or return to pending',
        ),
      );
    }
  }
  if (monotonicIssues.length > 0) throwOperation(monotonicIssues, configuredCapabilities);

  const seats = Object.freeze(
    room.seats.map((seat, index) =>
      Object.freeze({
        seatIndex: seat.seatIndex,
        corePlayerId: seat.corePlayerId,
        seatCapability: seat.seatCapability,
        participantId: seat.participantId,
        ready: seat.ready,
        outcome: nextOutcomes[index],
      }),
    ),
  );
  const activeCount = nextOutcomes.filter((outcome) => outcome === 'pending').length;
  return validatedOperationRoom(
    roomCandidate(room, activeCount <= 1 ? 'finished' : 'active', room.participants, seats),
  );
}
