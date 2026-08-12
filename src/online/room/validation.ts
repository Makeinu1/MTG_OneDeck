import { isCoreBaseId, type CorePlayerId } from '../../engine/core/index';
import type {
  OnlineRoomIdV1,
  OnlineRoomLifecycleV1,
  OnlineRoomParticipantIdV1,
  OnlineRoomParticipantRoleV1,
  OnlineRoomParticipantV1,
  OnlineRoomPresenceV1,
  OnlineRoomSeatCapabilityV1,
  OnlineRoomSeatIndexV1,
  OnlineRoomSeatOutcomeV1,
  OnlineRoomSeatV1,
  OnlineRoomV1,
  OnlineRoomValidationIssueV1,
  OnlineRoomValidationResultV1,
} from './types';
import { ONLINE_ROOM_SCHEMA_VERSION_V1 } from './types';
import {
  hasReadableField,
  hasFieldReadIssue,
  isOnlineRoomApplicationIdV1,
  isOnlineRoomSeatCapabilityV1,
  isOnlineRoomSeatIndexV1,
  readDenseArray,
  readExactRecord,
  roomIssue,
  sortedRoomIssues,
  type ReadableRecord,
} from './validationSupport';

const ROOT_FIELDS = [
  'kind',
  'schemaVersion',
  'roomId',
  'lifecycle',
  'hostParticipantId',
  'participants',
  'seats',
] as const;
const PARTICIPANT_FIELDS = ['participantId', 'role', 'presence', 'seatIndex'] as const;
const SEAT_FIELDS = [
  'seatIndex',
  'corePlayerId',
  'seatCapability',
  'participantId',
  'ready',
  'outcome',
] as const;

const LIFECYCLES: readonly OnlineRoomLifecycleV1[] = [
  'forming',
  'ready',
  'started',
  'active',
  'finished',
];
const ROLES: readonly OnlineRoomParticipantRoleV1[] = ['player', 'table', 'spectator'];
const PRESENCES: readonly OnlineRoomPresenceV1[] = ['connected', 'disconnected'];
const OUTCOMES: readonly OnlineRoomSeatOutcomeV1[] = ['pending', 'conceded', 'defeated'];

type ParticipantRead = Readonly<{
  readonly index: number;
  readonly record: ReadableRecord;
  readonly participantId: OnlineRoomParticipantIdV1 | null;
  readonly role: OnlineRoomParticipantRoleV1 | null;
  readonly presence: OnlineRoomPresenceV1 | null;
  readonly seatIndex: OnlineRoomSeatIndexV1 | null | undefined;
  readonly canonical: OnlineRoomParticipantV1 | null;
}>;

type SeatRead = Readonly<{
  readonly index: number;
  readonly record: ReadableRecord;
  readonly seatIndex: OnlineRoomSeatIndexV1 | null;
  readonly corePlayerId: CorePlayerId | null;
  readonly seatCapability: OnlineRoomSeatCapabilityV1 | null;
  readonly participantId: OnlineRoomParticipantIdV1 | null | undefined;
  readonly ready: boolean | null;
  readonly outcome: OnlineRoomSeatOutcomeV1 | null;
  readonly canonical: OnlineRoomSeatV1 | null;
}>;

function isLifecycle(value: unknown): value is OnlineRoomLifecycleV1 {
  return typeof value === 'string' && LIFECYCLES.includes(value as OnlineRoomLifecycleV1);
}

function isRole(value: unknown): value is OnlineRoomParticipantRoleV1 {
  return typeof value === 'string' && ROLES.includes(value as OnlineRoomParticipantRoleV1);
}

function isPresence(value: unknown): value is OnlineRoomPresenceV1 {
  return typeof value === 'string' && PRESENCES.includes(value as OnlineRoomPresenceV1);
}

function isOutcome(value: unknown): value is OnlineRoomSeatOutcomeV1 {
  return typeof value === 'string' && OUTCOMES.includes(value as OnlineRoomSeatOutcomeV1);
}

function normalizeParticipant(
  value: unknown,
  index: number,
  issues: OnlineRoomValidationIssueV1[],
): ParticipantRead | null {
  const path = `/participants/${index}`;
  const record = readExactRecord(value, PARTICIPANT_FIELDS, path, issues);
  if (record === null) return null;

  const participantIdReadable = hasReadableField(record, 'participantId');
  const participantId =
    participantIdReadable && isOnlineRoomApplicationIdV1(record.participantId)
      ? (record.participantId as OnlineRoomParticipantIdV1)
      : null;
  if (
    participantIdReadable &&
    !participantId &&
    !hasFieldReadIssue(issues, `${path}/participantId`)
  ) {
    issues.push(roomIssue('INVALID_ID', `${path}/participantId`, 'Invalid Room participant ID'));
  }

  const roleReadable = hasReadableField(record, 'role');
  const role = roleReadable && isRole(record.role) ? record.role : null;
  if (roleReadable && !role && !hasFieldReadIssue(issues, `${path}/role`))
    issues.push(roomIssue('INVALID_LITERAL', `${path}/role`, 'Invalid participant role'));

  const presenceReadable = hasReadableField(record, 'presence');
  const presence = presenceReadable && isPresence(record.presence) ? record.presence : null;
  if (presenceReadable && !presence && !hasFieldReadIssue(issues, `${path}/presence`))
    issues.push(roomIssue('INVALID_LITERAL', `${path}/presence`, 'Invalid participant presence'));

  let seatIndex: OnlineRoomSeatIndexV1 | null | undefined;
  const seatIndexReadable = hasReadableField(record, 'seatIndex');
  if (!seatIndexReadable) {
    seatIndex = undefined;
  } else if (record.seatIndex === null) {
    seatIndex = null;
  } else if (isOnlineRoomSeatIndexV1(record.seatIndex)) {
    seatIndex = record.seatIndex;
  } else if (!hasFieldReadIssue(issues, `${path}/seatIndex`)) {
    seatIndex = undefined;
    issues.push(
      roomIssue(
        'INVALID_INTEGER',
        `${path}/seatIndex`,
        'Seat index must be null or an integer from 0 through 3',
      ),
    );
  } else {
    seatIndex = undefined;
  }

  let relationValid = true;
  if (role === 'player' && seatIndexReadable && !isOnlineRoomSeatIndexV1(seatIndex)) {
    relationValid = false;
    issues.push(
      roomIssue(
        'INVALID_RELATION',
        `${path}/seatIndex`,
        'Player participants must occupy one seat',
      ),
    );
  } else if (
    (role === 'table' || role === 'spectator') &&
    seatIndexReadable &&
    seatIndex !== null
  ) {
    relationValid = false;
    issues.push(
      roomIssue(
        'INVALID_RELATION',
        `${path}/seatIndex`,
        'Observer participants must not occupy a seat',
      ),
    );
  }

  let canonical: OnlineRoomParticipantV1 | null = null;
  if (participantId && role && presence && seatIndex !== undefined && relationValid) {
    canonical =
      role === 'player'
        ? Object.freeze({
            participantId,
            role,
            presence,
            seatIndex: seatIndex as OnlineRoomSeatIndexV1,
          })
        : Object.freeze({ participantId, role, presence, seatIndex: null });
  }

  return Object.freeze({
    index,
    record,
    participantId,
    role,
    presence,
    seatIndex,
    canonical,
  });
}

function normalizeSeat(
  value: unknown,
  index: number,
  issues: OnlineRoomValidationIssueV1[],
): SeatRead | null {
  const path = `/seats/${index}`;
  const record = readExactRecord(value, SEAT_FIELDS, path, issues);
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
          'Seat index must equal its array position',
        ),
      );
    }
  }

  const corePlayerIdReadable = hasReadableField(record, 'corePlayerId');
  const corePlayerId =
    corePlayerIdReadable && isCoreBaseId(record.corePlayerId)
      ? (record.corePlayerId as CorePlayerId)
      : null;
  if (corePlayerIdReadable && !corePlayerId && !hasFieldReadIssue(issues, `${path}/corePlayerId`)) {
    issues.push(roomIssue('INVALID_ID', `${path}/corePlayerId`, 'Invalid Core player ID'));
  }

  const seatCapabilityReadable = hasReadableField(record, 'seatCapability');
  const seatCapability =
    seatCapabilityReadable && isOnlineRoomSeatCapabilityV1(record.seatCapability)
      ? (record.seatCapability as OnlineRoomSeatCapabilityV1)
      : null;
  if (
    seatCapabilityReadable &&
    !seatCapability &&
    !hasFieldReadIssue(issues, `${path}/seatCapability`)
  ) {
    issues.push(
      roomIssue('INVALID_CAPABILITY', `${path}/seatCapability`, 'Invalid seat capability'),
    );
  }

  let participantId: OnlineRoomParticipantIdV1 | null | undefined;
  const participantIdReadable = hasReadableField(record, 'participantId');
  if (!participantIdReadable) {
    participantId = undefined;
  } else if (record.participantId === null) {
    participantId = null;
  } else if (isOnlineRoomApplicationIdV1(record.participantId)) {
    participantId = record.participantId as OnlineRoomParticipantIdV1;
  } else if (!hasFieldReadIssue(issues, `${path}/participantId`)) {
    participantId = undefined;
    issues.push(roomIssue('INVALID_ID', `${path}/participantId`, 'Invalid Room participant ID'));
  } else {
    participantId = undefined;
  }

  const readyReadable = hasReadableField(record, 'ready');
  const ready = readyReadable && typeof record.ready === 'boolean' ? record.ready : null;
  if (readyReadable && ready === null && !hasFieldReadIssue(issues, `${path}/ready`))
    issues.push(roomIssue('INVALID_TYPE', `${path}/ready`, 'Ready must be a boolean'));

  const outcomeReadable = hasReadableField(record, 'outcome');
  const outcome = outcomeReadable && isOutcome(record.outcome) ? record.outcome : null;
  if (outcomeReadable && !outcome && !hasFieldReadIssue(issues, `${path}/outcome`))
    issues.push(roomIssue('INVALID_LITERAL', `${path}/outcome`, 'Invalid seat outcome'));

  let emptyRelationValid = true;
  if (participantId === null && ready === true) {
    emptyRelationValid = false;
    issues.push(roomIssue('INVALID_RELATION', `${path}/ready`, 'An empty seat cannot be ready'));
  }
  if (participantId === null && outcome !== null && outcome !== 'pending') {
    emptyRelationValid = false;
    issues.push(
      roomIssue('INVALID_RELATION', `${path}/outcome`, 'An empty seat must have a pending outcome'),
    );
  }

  const canonical =
    seatIndex !== null &&
    seatIndex === index &&
    corePlayerId !== null &&
    seatCapability !== null &&
    participantId !== undefined &&
    ready !== null &&
    outcome !== null &&
    emptyRelationValid
      ? Object.freeze({
          seatIndex,
          corePlayerId,
          seatCapability,
          participantId,
          ready,
          outcome,
        })
      : null;

  return Object.freeze({
    index,
    record,
    seatIndex,
    corePlayerId,
    seatCapability,
    participantId,
    ready,
    outcome,
    canonical,
  });
}

function duplicateIssues(
  participants: readonly ParticipantRead[],
  seats: readonly SeatRead[],
  issues: OnlineRoomValidationIssueV1[],
): void {
  const participantIds = new Set<string>();
  let tableCount = 0;
  for (const participant of participants) {
    if (participant.participantId !== null) {
      if (participantIds.has(participant.participantId)) {
        issues.push(
          roomIssue(
            'DUPLICATE_PARTICIPANT',
            `/participants/${participant.index}/participantId`,
            'Participant IDs must be unique within a Room',
          ),
        );
      }
      participantIds.add(participant.participantId);
    }
    if (participant.role === 'table') {
      tableCount += 1;
      if (tableCount > 1) {
        issues.push(
          roomIssue(
            'TOO_MANY_TABLES',
            `/participants/${participant.index}/role`,
            'A Room may contain at most one table participant',
          ),
        );
      }
    }
  }

  const corePlayerIds = new Set<string>();
  const capabilities = new Set<string>();
  for (const seat of seats) {
    if (seat.corePlayerId !== null) {
      if (corePlayerIds.has(seat.corePlayerId)) {
        issues.push(
          roomIssue(
            'DUPLICATE_CORE_PLAYER',
            `/seats/${seat.index}/corePlayerId`,
            'Core player IDs must be unique across Room seats',
          ),
        );
      }
      corePlayerIds.add(seat.corePlayerId);
    }
    if (seat.seatCapability !== null) {
      if (capabilities.has(seat.seatCapability)) {
        issues.push(
          roomIssue(
            'DUPLICATE_CAPABILITY',
            `/seats/${seat.index}/seatCapability`,
            'Seat capabilities must be unique across Room seats',
          ),
        );
      }
      capabilities.add(seat.seatCapability);
    }
  }
}

function relationIssues(
  hostParticipantId: OnlineRoomParticipantIdV1 | null,
  participants: readonly ParticipantRead[],
  seats: readonly SeatRead[],
  issues: OnlineRoomValidationIssueV1[],
): void {
  const seatsByIndex = new Map(seats.map((seat) => [seat.index, seat]));
  for (const participant of participants) {
    if (participant.canonical?.role !== 'player') continue;
    const seat = seatsByIndex.get(participant.canonical.seatIndex);
    if (seat?.participantId !== participant.canonical.participantId) {
      issues.push(
        roomIssue(
          'INVALID_RELATION',
          `/participants/${participant.index}/seatIndex`,
          'Player participant and occupied seat must reference each other',
        ),
      );
    }
  }

  for (const seat of seats) {
    if (seat.participantId === null || seat.participantId === undefined) continue;
    const matching = participants.filter(
      (participant) => participant.canonical?.participantId === seat.participantId,
    );
    if (
      matching.length !== 1 ||
      matching[0]?.canonical?.role !== 'player' ||
      matching[0].canonical.seatIndex !== seat.index
    ) {
      issues.push(
        roomIssue(
          'INVALID_RELATION',
          `/seats/${seat.index}/participantId`,
          'Occupied seat and player participant must reference each other',
        ),
      );
    }
  }

  if (hostParticipantId !== null) {
    const hosts = participants.filter(
      (participant) => participant.participantId === hostParticipantId,
    );
    const host = hosts.length === 1 ? hosts[0]?.canonical : null;
    const hostSeat = host?.role === 'player' ? seatsByIndex.get(host.seatIndex) : undefined;
    if (host?.role !== 'player' || hostSeat?.participantId !== hostParticipantId) {
      issues.push(
        roomIssue(
          'INVALID_RELATION',
          '/hostParticipantId',
          'Host must be the player participant occupying one Room seat',
        ),
      );
    }
  }
}

function lifecycleIssues(
  lifecycle: OnlineRoomLifecycleV1 | null,
  participants: readonly ParticipantRead[],
  seats: readonly SeatRead[],
  issues: OnlineRoomValidationIssueV1[],
): void {
  if (
    lifecycle === null ||
    seats.length !== 4 ||
    seats.some(
      (seat) =>
        seat.seatIndex !== seat.index ||
        seat.corePlayerId === null ||
        seat.seatCapability === null ||
        seat.participantId === undefined ||
        seat.ready === null ||
        seat.outcome === null,
    )
  )
    return;
  const canonicalSeats = seats.map((seat) =>
    Object.freeze({
      seatIndex: seat.seatIndex as OnlineRoomSeatIndexV1,
      corePlayerId: seat.corePlayerId as CorePlayerId,
      seatCapability: seat.seatCapability as OnlineRoomSeatCapabilityV1,
      participantId: seat.participantId as OnlineRoomParticipantIdV1 | null,
      ready: seat.ready as boolean,
      outcome: seat.outcome as OnlineRoomSeatOutcomeV1,
    }),
  );
  const participantById = new Map<string, OnlineRoomParticipantV1>();
  for (const participant of participants) {
    if (
      participant.canonical !== null &&
      !participantById.has(participant.canonical.participantId)
    ) {
      participantById.set(participant.canonical.participantId, participant.canonical);
    }
  }
  const occupied = canonicalSeats.every((seat) => seat.participantId !== null);
  const ready = canonicalSeats.every((seat) => seat.ready);
  const pendingCount = canonicalSeats.filter((seat) => seat.outcome === 'pending').length;
  const everyPending = pendingCount === 4;
  const everyConnected = canonicalSeats.every((seat) => {
    if (seat.participantId === null) return false;
    const participant = participantById.get(seat.participantId);
    return participant?.role === 'player' && participant.presence === 'connected';
  });
  const formingCondition = canonicalSeats.some((seat) => {
    if (seat.participantId === null || !seat.ready) return true;
    return participantById.get(seat.participantId)?.presence !== 'connected';
  });

  const valid =
    lifecycle === 'forming'
      ? everyPending && formingCondition
      : lifecycle === 'ready'
        ? occupied && ready && everyPending && everyConnected
        : lifecycle === 'started'
          ? occupied && ready && everyPending
          : lifecycle === 'active'
            ? occupied && ready && pendingCount >= 2
            : occupied && ready && pendingCount <= 1;

  if (!valid) {
    issues.push(
      roomIssue(
        'LIFECYCLE_MISMATCH',
        '/lifecycle',
        'Room fields do not satisfy the declared lifecycle invariants',
      ),
    );
  }
}

export function validateOnlineRoomV1(input: unknown): OnlineRoomValidationResultV1 {
  try {
    const issues: OnlineRoomValidationIssueV1[] = [];
    const root = readExactRecord(input, ROOT_FIELDS, '', issues);
    if (root === null) {
      return Object.freeze({ ok: false as const, issues: sortedRoomIssues(issues) });
    }

    if (
      hasReadableField(root, 'kind') &&
      root.kind !== 'online-room-v1' &&
      !hasFieldReadIssue(issues, '/kind')
    ) {
      issues.push(roomIssue('INVALID_LITERAL', '/kind', 'Invalid Online Room kind'));
    }
    if (
      hasReadableField(root, 'schemaVersion') &&
      root.schemaVersion !== ONLINE_ROOM_SCHEMA_VERSION_V1 &&
      !hasFieldReadIssue(issues, '/schemaVersion')
    ) {
      issues.push(
        roomIssue('INVALID_VERSION', '/schemaVersion', 'Invalid Online Room schema version'),
      );
    }
    const roomIdReadable = hasReadableField(root, 'roomId');
    const roomId =
      roomIdReadable && isOnlineRoomApplicationIdV1(root.roomId)
        ? (root.roomId as OnlineRoomIdV1)
        : null;
    if (roomIdReadable && !roomId && !hasFieldReadIssue(issues, '/roomId'))
      issues.push(roomIssue('INVALID_ID', '/roomId', 'Invalid Room ID'));

    const lifecycleReadable = hasReadableField(root, 'lifecycle');
    const lifecycle = lifecycleReadable && isLifecycle(root.lifecycle) ? root.lifecycle : null;
    if (lifecycleReadable && !lifecycle && !hasFieldReadIssue(issues, '/lifecycle'))
      issues.push(roomIssue('INVALID_LIFECYCLE', '/lifecycle', 'Invalid Room lifecycle'));

    const hostParticipantIdReadable = hasReadableField(root, 'hostParticipantId');
    const hostParticipantId =
      hostParticipantIdReadable && isOnlineRoomApplicationIdV1(root.hostParticipantId)
        ? (root.hostParticipantId as OnlineRoomParticipantIdV1)
        : null;
    if (
      hostParticipantIdReadable &&
      !hostParticipantId &&
      !hasFieldReadIssue(issues, '/hostParticipantId')
    ) {
      issues.push(roomIssue('INVALID_ID', '/hostParticipantId', 'Invalid host participant ID'));
    }

    const participantArray = hasReadableField(root, 'participants')
      ? readDenseArray(root.participants, '/participants', issues)
      : null;
    const seatArray = hasReadableField(root, 'seats')
      ? readDenseArray(root.seats, '/seats', issues)
      : null;
    if (seatArray !== null && seatArray.length !== 4) {
      issues.push(
        roomIssue('INVALID_ARRAY', '/seats', 'Room seats must be a dense four-element array'),
      );
    }

    const participants = (participantArray?.entries ?? [])
      .map(({ index, value }) => normalizeParticipant(value, index, issues))
      .filter((value): value is ParticipantRead => value !== null);
    const seats = (seatArray?.entries ?? [])
      .map(({ index, value }) => normalizeSeat(value, index, issues))
      .filter((value): value is SeatRead => value !== null);

    duplicateIssues(participants, seats, issues);
    relationIssues(hostParticipantId, participants, seats, issues);
    lifecycleIssues(lifecycle, participants, seats, issues);

    if (
      issues.length > 0 ||
      roomId === null ||
      lifecycle === null ||
      hostParticipantId === null ||
      participantArray === null ||
      seatArray === null ||
      seatArray.length !== 4 ||
      participants.length !== participantArray.length ||
      seats.length !== seatArray.length ||
      participants.some((participant) => participant.canonical === null) ||
      seats.some((seat) => seat.canonical === null)
    ) {
      return Object.freeze({
        ok: false as const,
        issues: sortedRoomIssues(
          issues,
          seats.flatMap((seat) =>
            seat.seatCapability === null ? [] : [seat.seatCapability],
          ),
        ),
      });
    }

    const value: OnlineRoomV1 = Object.freeze({
      kind: 'online-room-v1',
      schemaVersion: ONLINE_ROOM_SCHEMA_VERSION_V1,
      roomId,
      lifecycle,
      hostParticipantId,
      participants: Object.freeze(
        participants.map((participant) => {
          const canonical = participant.canonical as OnlineRoomParticipantV1;
          return canonical.role === 'player'
            ? Object.freeze({
                participantId: canonical.participantId,
                role: canonical.role,
                presence: canonical.presence,
                seatIndex: canonical.seatIndex,
              })
            : Object.freeze({
                participantId: canonical.participantId,
                role: canonical.role,
                presence: canonical.presence,
                seatIndex: null,
              });
        }),
      ),
      seats: Object.freeze(
        seats.map((seat) => {
          const canonical = seat.canonical as OnlineRoomSeatV1;
          return Object.freeze({
            seatIndex: canonical.seatIndex,
            corePlayerId: canonical.corePlayerId,
            seatCapability: canonical.seatCapability,
            participantId: canonical.participantId,
            ready: canonical.ready,
            outcome: canonical.outcome,
          });
        }),
      ),
    });
    return Object.freeze({ ok: true as const, value });
  } catch {
    return Object.freeze({
      ok: false as const,
      issues: sortedRoomIssues([
        roomIssue('INVALID_DESCRIPTOR', '', 'Room input could not be inspected safely'),
      ]),
    });
  }
}
