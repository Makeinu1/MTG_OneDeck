import type { OnlineVariablePlayerCountV2, OnlineVariableRoomConfigurationV2, OnlineVariableRoomSeatIndexV2, OnlineVariableStartingLifeV2 } from '../room/variable';

export const ONLINE_FORMING_LOBBY_SCHEMA_VERSION_V4 = 4 as const;
export type OnlineVariableLobbyLifecycleV4 = 'forming' | 'ready' | 'started';
export type OnlineVariableLobbySeatV4 = Readonly<{
  readonly seatIndex: OnlineVariableRoomSeatIndexV2;
  readonly corePlayerId: `P${1 | 2 | 3 | 4}`;
  readonly participantId: string | null;
  readonly seatCapability: string;
  readonly acceptedDeck: boolean;
  readonly ready: boolean;
}>;
export type OnlineVariableLobbyV4 = Readonly<{
  readonly kind: 'online-forming-lobby-v4';
  readonly schemaVersion: typeof ONLINE_FORMING_LOBBY_SCHEMA_VERSION_V4;
  readonly lifecycle: OnlineVariableLobbyLifecycleV4;
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly configuration: OnlineVariableRoomConfigurationV2;
  readonly admissionCapability: string;
  readonly admissionOpen: boolean;
  readonly tableParticipantId: string | null;
  readonly tableCapability: string | null;
  readonly seats: readonly OnlineVariableLobbySeatV4[];
}>;
export type CreateOnlineVariableLobbyV4Input = Readonly<{
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly configuration: OnlineVariableRoomConfigurationV2;
  readonly seatCapabilities: readonly string[];
  readonly admissionCapability: string;
  readonly tableParticipantId?: string;
  readonly tableCapability?: string;
}>;
export type OnlineVariableLobbyProjectionV4 = Readonly<{
  readonly kind: 'online-forming-lobby-projection-v4';
  readonly schemaVersion: typeof ONLINE_FORMING_LOBBY_SCHEMA_VERSION_V4;
  readonly lifecycle: OnlineVariableLobbyLifecycleV4;
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly configuration: OnlineVariableRoomConfigurationV2;
  readonly seats: readonly Readonly<{ readonly seatIndex: OnlineVariableRoomSeatIndexV2; readonly corePlayerId: `P${1 | 2 | 3 | 4}`; readonly participantId: string | null; readonly acceptedDeck: boolean; readonly ready: boolean }>[];
}>;

function fail(message: string): never { throw new Error(message); }
function record(value: unknown): value is Record<string, unknown> { if (value === null || typeof value !== 'object' || Array.isArray(value)) return false; try { return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null; } catch { return false; } }
function exact(value: unknown, fields: readonly string[]): value is Record<string, unknown> { if (!record(value)) return false; try { const keys = Reflect.ownKeys(value); return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key)); } catch { return false; } }
function id(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value); }
function capability(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value); }
function config(value: unknown): value is OnlineVariableRoomConfigurationV2 { if (!exact(value, ['playerCount', 'startingLife'])) return false; const count = value.playerCount; const life = value.startingLife; return (count === 2 || count === 4) && (life === 20 || life === 40) && (count !== 4 || life === 40); }
function count(value: OnlineVariableRoomConfigurationV2): OnlineVariablePlayerCountV2 { return value.playerCount; }
function p(index: number): `P${1 | 2 | 3 | 4}` { return `P${index + 1}` as `P${1 | 2 | 3 | 4}`; }
function createInputShape(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false;
  const required = ['roomId', 'serverBuildId', 'hostParticipantId', 'configuration', 'seatCapabilities', 'admissionCapability'];
  const optional = ['tableParticipantId', 'tableCapability'];
  try {
    const keys = Reflect.ownKeys(value);
    return keys.length >= required.length && keys.every((key) => typeof key === 'string' && (required.includes(key) || optional.includes(key)) && Object.prototype.propertyIsEnumerable.call(value, key)) && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
  } catch { return false; }
}
function validateInternal(input: unknown): OnlineVariableLobbyV4 {
  if (!exact(input, ['kind', 'schemaVersion', 'lifecycle', 'roomId', 'serverBuildId', 'hostParticipantId', 'configuration', 'admissionCapability', 'admissionOpen', 'tableParticipantId', 'tableCapability', 'seats'])) fail('Invalid variable lobby record');
  if (input.kind !== 'online-forming-lobby-v4' || input.schemaVersion !== 4 || !id(input.roomId) || typeof input.serverBuildId !== 'string' || !id(input.hostParticipantId) || !config(input.configuration) || !capability(input.admissionCapability) || typeof input.admissionOpen !== 'boolean' || (input.tableParticipantId !== null && !id(input.tableParticipantId)) || (input.tableCapability !== null && !capability(input.tableCapability)) || !['forming', 'ready', 'started'].includes(input.lifecycle as string) || !Array.isArray(input.seats) || input.seats.length !== count(input.configuration)) fail('Invalid variable lobby fields');
  const caps = new Set<string>(); const participants = new Set<string>(); const seats: OnlineVariableLobbySeatV4[] = []; const rawSeats = input.seats as readonly unknown[];
  if (caps.has(input.admissionCapability) || (input.tableCapability !== null && input.tableCapability === input.admissionCapability) || (input.tableParticipantId === null) !== (input.tableCapability === null)) fail('Invalid variable lobby credential relation');
  for (let index = 0; index < rawSeats.length; index += 1) {
    const raw = rawSeats[index];
    if (!exact(raw, ['seatIndex', 'corePlayerId', 'participantId', 'seatCapability', 'acceptedDeck', 'ready']) || raw.seatIndex !== index || raw.corePlayerId !== p(index) || !capability(raw.seatCapability) || caps.has(raw.seatCapability) || (raw.participantId !== null && !id(raw.participantId)) || typeof raw.acceptedDeck !== 'boolean' || typeof raw.ready !== 'boolean') fail('Invalid variable lobby seat');
    caps.add(raw.seatCapability);
    if (raw.participantId !== null) { if (participants.has(raw.participantId)) fail('Duplicate variable lobby participant'); participants.add(raw.participantId); }
    if (raw.ready && (!raw.acceptedDeck || raw.participantId === null)) fail('Ready variable lobby seat is incomplete');
    seats.push(Object.freeze({ seatIndex: index as OnlineVariableRoomSeatIndexV2, corePlayerId: p(index), participantId: raw.participantId, seatCapability: raw.seatCapability, acceptedDeck: raw.acceptedDeck, ready: raw.ready }));
  }
  if (seats[0]?.participantId !== input.hostParticipantId) fail('Variable lobby host mismatch');
  if (input.tableParticipantId !== null && participants.has(input.tableParticipantId)) fail('Variable lobby table participant collision');
  if (seats.some((seat) => seat.seatCapability === input.admissionCapability || (input.tableCapability !== null && seat.seatCapability === input.tableCapability))) fail('Duplicate variable lobby capability');
  const ready = seats.every((seat) => seat.participantId !== null && seat.acceptedDeck && seat.ready);
  if ((input.lifecycle === 'ready' || input.lifecycle === 'started') && !ready) fail('Variable lobby lifecycle mismatch');
  if (input.lifecycle === 'forming' && ready) fail('Variable lobby cannot be forming when ready');
  return Object.freeze({ kind: 'online-forming-lobby-v4', schemaVersion: 4, lifecycle: input.lifecycle as OnlineVariableLobbyLifecycleV4, roomId: input.roomId, serverBuildId: input.serverBuildId, hostParticipantId: input.hostParticipantId, configuration: Object.freeze({ ...input.configuration }), admissionCapability: input.admissionCapability, admissionOpen: input.admissionOpen, tableParticipantId: input.tableParticipantId, tableCapability: input.tableCapability, seats: Object.freeze(seats) });
}
export function validateOnlineVariableLobbyV4(input: unknown): Readonly<{ readonly ok: true; readonly value: OnlineVariableLobbyV4 } | { readonly ok: false; readonly issues: readonly Readonly<{ readonly code: string; readonly path: string; readonly message: string }>[] }> { try { return Object.freeze({ ok: true as const, value: validateInternal(input) }); } catch (error: unknown) { return Object.freeze({ ok: false as const, issues: Object.freeze([{ code: 'INVALID_LOBBY', path: '', message: error instanceof Error ? error.message : 'Invalid variable lobby' }]) }); } }
export function createOnlineVariableLobbyV4(input: CreateOnlineVariableLobbyV4Input): OnlineVariableLobbyV4 {
  if (!createInputShape(input) || !id(input.roomId) || typeof input.serverBuildId !== 'string' || !id(input.hostParticipantId) || !config(input.configuration) || !Array.isArray(input.seatCapabilities) || input.seatCapabilities.length !== input.configuration.playerCount || !capability(input.admissionCapability) || (input.tableParticipantId !== undefined && !id(input.tableParticipantId)) || (input.tableCapability !== undefined && !capability(input.tableCapability)) || input.seatCapabilities.some((value) => !capability(value))) fail('Invalid variable lobby creation input');
  const seatCapabilities = input.seatCapabilities as readonly string[];
  const seats = seatCapabilities.map((seatCapability, index) => ({ seatIndex: index, corePlayerId: p(index), participantId: index === 0 ? input.hostParticipantId : null, seatCapability, acceptedDeck: false, ready: false }));
  return validateInternal({ kind: 'online-forming-lobby-v4', schemaVersion: 4, lifecycle: 'forming', roomId: input.roomId, serverBuildId: input.serverBuildId, hostParticipantId: input.hostParticipantId, configuration: input.configuration, admissionCapability: input.admissionCapability, admissionOpen: true, tableParticipantId: input.tableParticipantId ?? null, tableCapability: input.tableCapability ?? null, seats });
}
function mutate(lobby: OnlineVariableLobbyV4, seats: readonly OnlineVariableLobbySeatV4[], lifecycle?: OnlineVariableLobbyLifecycleV4): OnlineVariableLobbyV4 { const ready = seats.every((seat) => seat.participantId !== null && seat.acceptedDeck && seat.ready); return validateInternal({ ...lobby, lifecycle: lifecycle ?? (ready ? 'ready' : 'forming'), seats }); }
export function claimOnlineVariableLobbySeatV4(lobbyInput: unknown, participantId: string, inviteCapability: string): Readonly<{ readonly lobby: OnlineVariableLobbyV4; readonly seatCapability: string }> { const lobby = validateInternal(lobbyInput); if (!lobby.admissionOpen) fail('ADMISSION_CLOSED'); if (lobby.lifecycle !== 'forming' || !id(participantId) || !capability(inviteCapability) || inviteCapability !== lobby.admissionCapability) fail('Invite rejected'); const index = lobby.seats.findIndex((seat) => seat.participantId === null); if (index < 0 || lobby.seats.some((seat) => seat.participantId === participantId)) fail('Room is full'); const target = lobby.seats[index]; if (target === undefined) fail('Room is full'); const seats = lobby.seats.map((seat, seatIndex) => seatIndex === index ? { ...seat, participantId } : seat); return Object.freeze({ lobby: mutate(lobby, seats), seatCapability: target.seatCapability }); }
export function setOnlineVariableLobbyDeckAcceptedV4(lobbyInput: unknown, participantId: string, accepted: boolean): OnlineVariableLobbyV4 { const lobby = validateInternal(lobbyInput); const index = lobby.seats.findIndex((seat) => seat.participantId === participantId); if (index < 0) fail('Participant not found'); return mutate(lobby, lobby.seats.map((seat, seatIndex) => seatIndex === index ? { ...seat, acceptedDeck: accepted, ready: false } : seat)); }
export function setOnlineVariableLobbyReadyV4(lobbyInput: unknown, participantId: string, ready: boolean): OnlineVariableLobbyV4 { const lobby = validateInternal(lobbyInput); const index = lobby.seats.findIndex((seat) => seat.participantId === participantId); if (index < 0 || !lobby.seats[index]?.acceptedDeck) fail('Accepted deck required'); return mutate(lobby, lobby.seats.map((seat, seatIndex) => seatIndex === index ? { ...seat, ready } : seat)); }
export function projectOnlineVariableLobbyV4(lobbyInput: unknown): OnlineVariableLobbyProjectionV4 { const lobby = validateInternal(lobbyInput); return Object.freeze({ kind: 'online-forming-lobby-projection-v4', schemaVersion: 4, lifecycle: lobby.lifecycle, roomId: lobby.roomId, serverBuildId: lobby.serverBuildId, hostParticipantId: lobby.hostParticipantId, configuration: lobby.configuration, seats: Object.freeze(lobby.seats.map((seat) => Object.freeze({ seatIndex: seat.seatIndex, corePlayerId: seat.corePlayerId, participantId: seat.participantId, acceptedDeck: seat.acceptedDeck, ready: seat.ready }))) }); }
export function startOnlineVariableLobbyV4(lobbyInput: unknown): OnlineVariableLobbyV4 { const lobby = validateInternal(lobbyInput); if (lobby.lifecycle !== 'ready') fail('Variable lobby is not ready'); return validateInternal({ ...lobby, lifecycle: 'started' }); }

export function rotateOnlineVariableLobbyAdmissionV4(lobbyInput: unknown, nextCapability: string): OnlineVariableLobbyV4 {
  const lobby = validateInternal(lobbyInput); if (lobby.lifecycle !== 'forming' || !capability(nextCapability) || lobby.seats.some((seat) => seat.seatCapability === nextCapability) || nextCapability === lobby.admissionCapability) fail('Invalid admission rotation');
  return validateInternal({ ...lobby, admissionCapability: nextCapability, admissionOpen: true });
}
export function closeOnlineVariableLobbyAdmissionV4(lobbyInput: unknown): OnlineVariableLobbyV4 {
  const lobby = validateInternal(lobbyInput); if (lobby.lifecycle !== 'forming') fail('Invalid admission lifecycle'); return validateInternal({ ...lobby, admissionOpen: false });
}
export function replaceOnlineVariableLobbySeatV4(lobbyInput: unknown, participantId: string, nextSeatCapability: string, nextAdmissionCapability: string): OnlineVariableLobbyV4 {
  const lobby = validateInternal(lobbyInput); if (lobby.lifecycle !== 'forming' || !id(participantId) || !capability(nextSeatCapability) || !capability(nextAdmissionCapability)) fail('Invalid variable seat replacement');
  const index = lobby.seats.findIndex((seat) => seat.participantId === participantId); if (index <= 0) fail(index === 0 ? 'HOST_REQUIRED' : 'Participant not found');
  if (lobby.seats.some((seat) => seat.seatCapability === nextSeatCapability) || nextAdmissionCapability === lobby.admissionCapability) fail('Credential collision');
  const seats = lobby.seats.map((seat, seatIndex) => seatIndex === index ? { ...seat, participantId: null, seatCapability: nextSeatCapability, acceptedDeck: false, ready: false } : seat);
  return validateInternal({ ...lobby, seats, admissionCapability: nextAdmissionCapability, admissionOpen: true });
}
export function leaveOnlineVariableLobbyParticipantV4(lobbyInput: unknown, participantId: string): Readonly<{ readonly closed: boolean; readonly lobby: OnlineVariableLobbyV4 | null }> {
  const lobby = validateInternal(lobbyInput); if (participantId === lobby.hostParticipantId) return Object.freeze({ closed: true, lobby: null });
  return Object.freeze({ closed: false, lobby: replaceOnlineVariableLobbySeatV4(lobby, participantId, `${lobby.seats.find((seat) => seat.participantId === participantId)?.seatCapability ?? 'seat_'}${'r'.repeat(32)}`.slice(0, 40), lobby.admissionCapability) });
}

export type OnlineVariableLobbyConfigurationV4 = OnlineVariableRoomConfigurationV2;
export type OnlineVariableLobbyPlayerCountV4 = OnlineVariablePlayerCountV2;
export type OnlineVariableLobbyStartingLifeV4 = OnlineVariableStartingLifeV2;
export type OnlineLobbyV4 = OnlineVariableLobbyV4;
export type OnlineLobbyProjectionV4 = OnlineVariableLobbyProjectionV4;
export const createOnlineLobbyV4 = createOnlineVariableLobbyV4;
export const validateOnlineLobbyV4 = validateOnlineVariableLobbyV4;
