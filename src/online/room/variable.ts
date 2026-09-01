import type { CorePlayerId, ModeNeutralCoreRootV1 } from '../../engine/core/index';

/** Variable-roster Room contract introduced by O4P-08C. Legacy v1 remains untouched. */
export const ONLINE_ROOM_SCHEMA_VERSION_V2 = 2 as const;
export type OnlineVariablePlayerCountV2 = 2 | 4;
export type OnlineVariableStartingLifeV2 = 20 | 40;
export type OnlineVariableRoomConfigurationV2 = Readonly<{
  readonly playerCount: OnlineVariablePlayerCountV2;
  readonly startingLife: OnlineVariableStartingLifeV2;
}>;
export type OnlineVariableRoomSeatIndexV2 = 0 | 1 | 2 | 3;
export type OnlineVariableRoomLifecycleV2 = 'forming' | 'ready' | 'started' | 'active' | 'finished';

export type OnlineVariableRoomSeatV2 = Readonly<{
  readonly seatIndex: OnlineVariableRoomSeatIndexV2;
  readonly corePlayerId: CorePlayerId;
  readonly seatCapability: string;
  readonly participantId: string | null;
  readonly acceptedDeck: boolean;
  readonly ready: boolean;
  readonly outcome: 'pending' | 'conceded' | 'defeated';
}>;

export type OnlineVariableRoomParticipantV2 = Readonly<{
  readonly participantId: string;
  readonly role: 'player' | 'table' | 'spectator';
  readonly presence: 'connected' | 'disconnected';
  readonly seatIndex: OnlineVariableRoomSeatIndexV2 | null;
}>;

export type OnlineVariableRoomV2 = Readonly<{
  readonly kind: 'online-room-v2';
  readonly schemaVersion: typeof ONLINE_ROOM_SCHEMA_VERSION_V2;
  readonly roomId: string;
  readonly configuration: OnlineVariableRoomConfigurationV2;
  readonly lifecycle: OnlineVariableRoomLifecycleV2;
  readonly hostParticipantId: string;
  readonly participants: readonly OnlineVariableRoomParticipantV2[];
  readonly seats: readonly OnlineVariableRoomSeatV2[];
}>;

export type CreateOnlineVariableRoomV2Input = Readonly<{
  readonly roomId: string;
  readonly configuration: OnlineVariableRoomConfigurationV2;
  readonly seatAssignments: readonly OnlineVariableRoomSeatAssignmentV2[];
  readonly host: Readonly<{ readonly participantId: string; readonly seatCapability: string }>;
}>;
export type OnlineVariableRoomSeatAssignmentV2 = Readonly<{
  readonly seatIndex: OnlineVariableRoomSeatIndexV2;
  readonly corePlayerId: CorePlayerId;
  readonly seatCapability: string;
}>;

export type OnlineVariableRoomValidationResultV2 =
  | Readonly<{ readonly ok: true; readonly value: OnlineVariableRoomV2 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly Readonly<{ readonly code: string; readonly path: string; readonly message: string }>[] }>;

function fail(message: string): never { throw new Error(message); }
function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try { return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null; } catch { return false; }
}
function exact(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch { return false; }
}
function id(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value); }
function capability(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value); }
function playerId(index: number): CorePlayerId { return `P${index + 1}` as CorePlayerId; }
function configuration(value: unknown): value is OnlineVariableRoomConfigurationV2 {
  if (!exact(value, ['playerCount', 'startingLife'])) return false;
  const count = value.playerCount;
  const life = value.startingLife;
  return (count === 2 || count === 4) && (life === 20 || life === 40) && (count !== 4 || life === 40);
}
function seatCount(config: OnlineVariableRoomConfigurationV2): number { return config.playerCount; }

function freezeRoom(room: OnlineVariableRoomV2): OnlineVariableRoomV2 {
  return Object.freeze({ ...room, configuration: Object.freeze({ ...room.configuration }), participants: Object.freeze(room.participants.map((entry) => Object.freeze({ ...entry }))), seats: Object.freeze(room.seats.map((entry) => Object.freeze({ ...entry }))) });
}

function validateInternal(input: unknown): OnlineVariableRoomV2 {
  if (!exact(input, ['kind', 'schemaVersion', 'roomId', 'configuration', 'lifecycle', 'hostParticipantId', 'participants', 'seats'])) fail('Invalid variable Room record');
  const config = configuration(input.configuration) ? input.configuration : null;
  if (input.kind !== 'online-room-v2' || input.schemaVersion !== 2 || !config || !id(input.roomId) || !id(input.hostParticipantId)) fail('Invalid variable Room fields');
  if (!['forming', 'ready', 'started', 'active', 'finished'].includes(input.lifecycle as string)) fail('Invalid variable Room lifecycle');
  if (!Array.isArray(input.participants) || input.participants.length > 0xffff || !Array.isArray(input.seats) || input.seats.length !== seatCount(config)) fail('Invalid variable Room roster');
  const seats: OnlineVariableRoomSeatV2[] = [];
  const participants: OnlineVariableRoomParticipantV2[] = [];
  const participantIds = new Set<string>();
  const capabilities = new Set<string>();
  const rawSeats = input.seats as readonly unknown[];
  for (let index = 0; index < rawSeats.length; index += 1) {
    const raw = rawSeats[index];
    if (!exact(raw, ['seatIndex', 'corePlayerId', 'seatCapability', 'participantId', 'acceptedDeck', 'ready', 'outcome'])) fail('Invalid variable Room seat');
    if (raw.seatIndex !== index || raw.corePlayerId !== playerId(index) || !capability(raw.seatCapability) || capabilities.has(raw.seatCapability) || (raw.participantId !== null && !id(raw.participantId)) || typeof raw.acceptedDeck !== 'boolean' || typeof raw.ready !== 'boolean' || !['pending', 'conceded', 'defeated'].includes(raw.outcome as string)) fail('Invalid variable Room seat relation');
    capabilities.add(raw.seatCapability);
    if (raw.participantId !== null) {
      if (participantIds.has(raw.participantId)) fail('Duplicate variable Room participant');
      participantIds.add(raw.participantId);
      participants.push(Object.freeze({ participantId: raw.participantId, role: 'player', presence: 'connected', seatIndex: index as OnlineVariableRoomSeatIndexV2 }));
    }
    if (raw.ready && (!raw.acceptedDeck || raw.participantId === null)) fail('Ready variable Room seat is incomplete');
    const outcome = raw.outcome as 'pending' | 'conceded' | 'defeated';
    seats.push(Object.freeze({ seatIndex: index as OnlineVariableRoomSeatIndexV2, corePlayerId: playerId(index), seatCapability: raw.seatCapability, participantId: raw.participantId, acceptedDeck: raw.acceptedDeck, ready: raw.ready, outcome }));
  }
  if (seats[0]?.participantId !== input.hostParticipantId) fail('Variable Room host mismatch');
  const suppliedParticipants = input.participants as readonly unknown[];
  if (suppliedParticipants.length !== participants.length) fail('Variable Room participant relation mismatch');
  for (let index = 0; index < suppliedParticipants.length; index += 1) {
    const raw = suppliedParticipants[index];
    if (!exact(raw, ['participantId', 'role', 'presence', 'seatIndex']) || !id(raw.participantId) || !['player', 'table', 'spectator'].includes(raw.role as string) || !['connected', 'disconnected'].includes(raw.presence as string)) fail('Invalid variable Room participant');
    const expected = participants[index];
    if (raw.role !== 'player' || raw.seatIndex !== index || expected?.participantId !== raw.participantId) fail('Variable Room participants must be dense players');
    participants[index] = Object.freeze({
      participantId: raw.participantId,
      role: 'player' as const,
      presence: raw.presence as 'connected' | 'disconnected',
      seatIndex: index as OnlineVariableRoomSeatIndexV2,
    });
  }
  const complete = seats.every((seat) => seat.participantId !== null && seat.acceptedDeck && seat.ready);
  if ((input.lifecycle === 'ready' || input.lifecycle === 'started' || input.lifecycle === 'active') && !complete) fail('Variable Room lifecycle is not ready');
  return freezeRoom({ kind: 'online-room-v2', schemaVersion: 2, roomId: input.roomId, configuration: config, lifecycle: input.lifecycle as OnlineVariableRoomLifecycleV2, hostParticipantId: input.hostParticipantId, participants, seats });
}

export function validateOnlineVariableRoomV2(input: unknown): OnlineVariableRoomValidationResultV2 {
  try { return Object.freeze({ ok: true as const, value: validateInternal(input) }); }
  catch (error: unknown) { return Object.freeze({ ok: false as const, issues: Object.freeze([{ code: 'INVALID_ROOM', path: '', message: error instanceof Error ? error.message : 'Invalid variable Room' }]) }); }
}

export function createOnlineVariableRoomV2(input: CreateOnlineVariableRoomV2Input): OnlineVariableRoomV2 {
  if (!exact(input, ['roomId', 'configuration', 'seatAssignments', 'host']) || !id(input.roomId) || !configuration(input.configuration) || !Array.isArray(input.seatAssignments) || input.seatAssignments.length !== input.configuration.playerCount || !exact(input.host, ['participantId', 'seatCapability']) || !id(input.host.participantId)) fail('Invalid variable Room creation input');
  const assignments = input.seatAssignments;
  const seats = assignments.map((assignment, index) => {
    if (!exact(assignment, ['seatIndex', 'corePlayerId', 'seatCapability']) || assignment.seatIndex !== index || assignment.corePlayerId !== playerId(index) || !capability(assignment.seatCapability)) fail('Invalid variable Room seat assignment');
    return { seatIndex: index as OnlineVariableRoomSeatIndexV2, corePlayerId: playerId(index), seatCapability: assignment.seatCapability, participantId: index === 0 ? input.host.participantId : null, acceptedDeck: false, ready: false, outcome: 'pending' as const };
  });
  return validateInternal({ kind: 'online-room-v2', schemaVersion: 2, roomId: input.roomId, configuration: input.configuration, lifecycle: 'forming', hostParticipantId: input.host.participantId, participants: [{ participantId: input.host.participantId, role: 'player', presence: 'connected', seatIndex: 0 }], seats });
}

function cloneWith(room: OnlineVariableRoomV2, patch: Partial<OnlineVariableRoomV2>): OnlineVariableRoomV2 { return validateInternal({ ...room, ...patch }); }

export function disconnectOnlineVariableRoomParticipantV2(roomInput: unknown, participantId: string): OnlineVariableRoomV2 {
  const room = validateInternal(roomInput);
  if (!id(participantId)) fail('Invalid variable Room participant');
  const index = room.participants.findIndex((participant) => participant.participantId === participantId);
  const participant = room.participants[index];
  if (participant === undefined) fail('Variable Room participant not found');
  if (participant.presence === 'disconnected') return room;
  return cloneWith(room, { participants: room.participants.map((entry, entryIndex) => entryIndex === index ? { ...entry, presence: 'disconnected' as const } : entry) });
}

export function rejoinOnlineVariableRoomParticipantV2(roomInput: unknown, participantId: string): OnlineVariableRoomV2 {
  const room = validateInternal(roomInput);
  if (!id(participantId)) fail('Invalid variable Room participant');
  const index = room.participants.findIndex((participant) => participant.participantId === participantId);
  const participant = room.participants[index];
  if (participant === undefined) fail('Variable Room participant not found');
  if (participant.seatIndex === null) fail('Variable Room player seat missing');
  const seat = room.seats[participant.seatIndex];
  if (seat === undefined || seat.outcome !== 'pending') fail('Variable Room player cannot rejoin');
  if (participant.presence === 'connected') return room;
  return cloneWith(room, { participants: room.participants.map((entry, entryIndex) => entryIndex === index ? { ...entry, presence: 'connected' as const } : entry) });
}

export function joinOnlineVariableRoomV2(roomInput: unknown, input: Readonly<{ readonly participantId: string; readonly seatCapability: string }>): OnlineVariableRoomV2 {
  const room = validateInternal(roomInput);
  if (room.lifecycle !== 'forming' || !exact(input, ['participantId', 'seatCapability']) || !id(input.participantId) || !capability(input.seatCapability)) fail('Invalid variable Room join');
  if (room.participants.some((participant) => participant.participantId === input.participantId)) fail('Participant already exists');
  const index = room.seats.findIndex((seat) => seat.participantId === null && seat.seatCapability === input.seatCapability);
  if (index < 0) fail('Room is full or capability rejected');
  const seats = room.seats.map((seat, seatIndex) => seatIndex === index ? { ...seat, participantId: input.participantId } : seat);
  const participants = [...room.participants, { participantId: input.participantId, role: 'player' as const, presence: 'connected' as const, seatIndex: index as OnlineVariableRoomSeatIndexV2 }];
  return cloneWith(room, { seats, participants });
}

export function acceptOnlineVariableRoomDeckV2(roomInput: unknown, participantId: string, accepted = true): OnlineVariableRoomV2 {
  const room = validateInternal(roomInput); const index = room.seats.findIndex((seat) => seat.participantId === participantId);
  if (index < 0) fail('Participant not found');
  return cloneWith(room, { seats: room.seats.map((seat, seatIndex) => seatIndex === index ? { ...seat, acceptedDeck: accepted, ready: accepted ? seat.ready : false } : seat), lifecycle: 'forming' });
}

export function setOnlineVariableRoomPlayerReadyV2(roomInput: unknown, participantId: string, ready: boolean): OnlineVariableRoomV2 {
  const room = validateInternal(roomInput); const index = room.seats.findIndex((seat) => seat.participantId === participantId);
  if (index < 0 || !room.seats[index]?.acceptedDeck) fail('Accepted deck required');
  const seats = room.seats.map((seat, seatIndex) => seatIndex === index ? { ...seat, ready } : seat);
  const complete = seats.every((seat) => seat.participantId !== null && seat.acceptedDeck && seat.ready);
  return cloneWith(room, { seats, lifecycle: complete ? 'ready' : 'forming' });
}

export function startOnlineVariableRoomV2(roomInput: unknown, hostParticipantId: string): OnlineVariableRoomV2 {
  const room = validateInternal(roomInput);
  if (room.hostParticipantId !== hostParticipantId || room.lifecycle !== 'ready' || room.seats.length !== room.configuration.playerCount || room.seats.some((seat) => seat.participantId === null || !seat.acceptedDeck || !seat.ready)) fail('Variable Room is not ready');
  return cloneWith(room, { lifecycle: 'started' });
}

export function activateOnlineVariableRoomV2(roomInput: unknown, coreRoot: ModeNeutralCoreRootV1): OnlineVariableRoomV2 {
  const room = validateInternal(roomInput);
  if (room.lifecycle !== 'started' || coreRoot.playerLifecycle.players.length !== room.configuration.playerCount || coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.turnOrder.length !== room.configuration.playerCount) fail('Variable Room/Core roster mismatch');
  return cloneWith(room, { lifecycle: 'active' });
}

export type OnlineRoomV2 = OnlineVariableRoomV2;
export type OnlineRoomConfigurationV2 = OnlineVariableRoomConfigurationV2;
export const createOnlineRoomV2 = createOnlineVariableRoomV2;
export const validateOnlineRoomV2 = validateOnlineVariableRoomV2;
