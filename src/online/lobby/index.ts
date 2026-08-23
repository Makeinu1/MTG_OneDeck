import { isOnlineRoomApplicationIdV1, isOnlineRoomSeatCapabilityV1 } from '../room/validationSupport';
import { validateBuildId } from '../../versioning/index';
import { assertNoConfiguredCapabilityFragmentV1 } from '../cloudflare/codec';

export const ONLINE_FORMING_LOBBY_SCHEMA_VERSION_V1 = 1 as const;
export const ONLINE_FORMING_LOBBY_MAX_DECK_TEXT_BYTES_V1 = 262_144 as const;

export type OnlineFormingLobbyLifecycleV1 = 'forming' | 'ready' | 'started';
export type OnlineFormingLobbySeatIndexV1 = 0 | 1 | 2 | 3;

export type OnlineFormingLobbySeatV1 = Readonly<{
  readonly seatIndex: OnlineFormingLobbySeatIndexV1;
  readonly corePlayerId: 'P1' | 'P2' | 'P3' | 'P4';
  readonly participantId: string | null;
  readonly seatCapability: string;
  readonly inviteCapability: string | null;
  readonly deckId: string | null;
  readonly deckText: string | null;
  readonly ready: boolean;
}>;

export type OnlineFormingLobbyV1 = Readonly<{
  readonly kind: 'online-forming-lobby-v1';
  readonly schemaVersion: typeof ONLINE_FORMING_LOBBY_SCHEMA_VERSION_V1;
  readonly lifecycle: OnlineFormingLobbyLifecycleV1;
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly seats: readonly [OnlineFormingLobbySeatV1, OnlineFormingLobbySeatV1, OnlineFormingLobbySeatV1, OnlineFormingLobbySeatV1];
}>;

export type CreateOnlineFormingLobbyV1Input = Readonly<{
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly seatCapabilities: readonly [string, string, string, string];
  readonly inviteCapabilities: readonly [string, string, string];
}>;

export type ClaimOnlineFormingLobbySeatV1Input = Readonly<{ readonly participantId: string; readonly inviteCapability: string }>;
export type SubmitOnlineFormingLobbyDeckV1Input = Readonly<{ readonly participantId: string; readonly seatCapability: string; readonly deckId: string; readonly deckText: string }>;
export type SetOnlineFormingLobbySeatReadyV1Input = Readonly<{ readonly participantId: string; readonly seatCapability: string; readonly ready: boolean }>;
export type OnlineFormingLobbyProjectionV1 = Readonly<{
  readonly kind: 'online-forming-lobby-projection-v1';
  readonly schemaVersion: typeof ONLINE_FORMING_LOBBY_SCHEMA_VERSION_V1;
  readonly lifecycle: OnlineFormingLobbyLifecycleV1;
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly seats: readonly Readonly<{
    readonly seatIndex: OnlineFormingLobbySeatIndexV1;
    readonly corePlayerId: 'P1' | 'P2' | 'P3' | 'P4';
    readonly participantId: string | null;
    readonly deckId: string | null;
    readonly deckSubmitted: boolean;
    readonly ready: boolean;
  }>[];
}>;

export type OnlineFormingLobbyValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: OnlineFormingLobbyV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly Readonly<{ readonly code: string; readonly path: string; readonly message: string }>[] }>;

const PLAYER_IDS = ['P1', 'P2', 'P3', 'P4'] as const;
const ROOT_FIELDS = ['kind', 'schemaVersion', 'lifecycle', 'roomId', 'serverBuildId', 'hostParticipantId', 'seats'] as const;
const SEAT_FIELDS = ['seatIndex', 'corePlayerId', 'participantId', 'seatCapability', 'inviteCapability', 'deckId', 'deckText', 'ready'] as const;

function fail(message: string): never { throw new Error(message); }

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try { return Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null; } catch { return false; }
}

function ownData(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined
      ? descriptor.value : undefined;
  } catch { return undefined; }
}

function exactRecord(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!plainRecord(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch { return false; }
}

function capability(value: unknown): value is string { return typeof value === 'string' && isOnlineRoomSeatCapabilityV1(value); }
function appId(value: unknown): value is string { return typeof value === 'string' && isOnlineRoomApplicationIdV1(value); }

function capabilitiesOf(lobby: OnlineFormingLobbyV1): readonly string[] {
  return Object.freeze(lobby.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability])]));
}

function assertSafeMetadata(value: string, lobby: OnlineFormingLobbyV1): void {
  try { assertNoConfiguredCapabilityFragmentV1(value, capabilitiesOf(lobby)); } catch { fail('Capability fragment in metadata'); }
}

function normalizeSeat(value: Record<string, unknown>, index: number): OnlineFormingLobbySeatV1 | null {
  if (!exactRecord(value, SEAT_FIELDS)) return null;
  const seatIndex = ownData(value, 'seatIndex');
  const corePlayerId = ownData(value, 'corePlayerId');
  const participantId = ownData(value, 'participantId');
  const seatCapability = ownData(value, 'seatCapability');
  const inviteCapability = ownData(value, 'inviteCapability');
  const deckId = ownData(value, 'deckId');
  const deckText = ownData(value, 'deckText');
  const ready = ownData(value, 'ready');
  if (seatIndex !== index || corePlayerId !== PLAYER_IDS[index] || !capability(seatCapability) || (participantId !== null && !appId(participantId)) || (inviteCapability !== null && !capability(inviteCapability)) || (deckId !== null && !appId(deckId)) || (deckText !== null && typeof deckText !== 'string') || typeof ready !== 'boolean') return null;
  return Object.freeze({ seatIndex: index as OnlineFormingLobbySeatIndexV1, corePlayerId: PLAYER_IDS[index], participantId, seatCapability, inviteCapability, deckId, deckText, ready });
}

function freezeLobby(value: Omit<OnlineFormingLobbyV1, 'seats'> & { seats: readonly OnlineFormingLobbySeatV1[] }): OnlineFormingLobbyV1 {
  return Object.freeze({ ...value, seats: Object.freeze([...value.seats]) as OnlineFormingLobbyV1['seats'] });
}

function validateLobbyInternal(input: unknown): OnlineFormingLobbyV1 {
  if (!exactRecord(input, ROOT_FIELDS)) fail('Invalid lobby record');
  const kind = ownData(input, 'kind');
  const schemaVersion = ownData(input, 'schemaVersion');
  const lifecycle = ownData(input, 'lifecycle');
  const roomId = ownData(input, 'roomId');
  const serverBuildId = ownData(input, 'serverBuildId');
  const hostParticipantId = ownData(input, 'hostParticipantId');
  const rawSeats = ownData(input, 'seats');
  if (kind !== 'online-forming-lobby-v1' || schemaVersion !== 1 || (lifecycle !== 'forming' && lifecycle !== 'ready' && lifecycle !== 'started') || !appId(roomId) || !validateBuildId(serverBuildId).ok || !appId(hostParticipantId) || !Array.isArray(rawSeats) || rawSeats.length !== 4 || Object.getPrototypeOf(rawSeats) !== Array.prototype) fail('Invalid lobby fields');
  const seats: OnlineFormingLobbySeatV1[] = [];
  const participants = new Set<string>();
  const seatCaps = new Set<string>();
  const inviteCaps = new Set<string>();
  for (let index = 0; index < 4; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(rawSeats, index)) fail('Sparse lobby seats');
    const seat = normalizeSeat(rawSeats[index] as Record<string, unknown>, index);
    if (seat === null) fail('Invalid lobby seat');
    if (seat.participantId !== null && participants.has(seat.participantId)) fail('Duplicate participant');
    if (seat.participantId !== null) participants.add(seat.participantId);
    if (seatCaps.has(seat.seatCapability)) fail('Duplicate seat capability');
    seatCaps.add(seat.seatCapability);
    if (seat.inviteCapability !== null) {
      if (inviteCaps.has(seat.inviteCapability) || seatCaps.has(seat.inviteCapability)) fail('Duplicate invite capability');
      inviteCaps.add(seat.inviteCapability);
    }
    if (index === 0 && seat.inviteCapability !== null) fail('Host seat cannot have an invite');
    if (index > 0 && ((seat.participantId === null) !== (seat.inviteCapability !== null))) fail('Seat claim and invite consumption mismatch');
    if ((seat.deckId === null) !== (seat.deckText === null)) fail('Deck metadata mismatch');
    if (seat.ready && (seat.participantId === null || seat.deckId === null || seat.deckText === null)) fail('Ready seat is incomplete');
    if (seat.deckText !== null && new TextEncoder().encode(seat.deckText).length > ONLINE_FORMING_LOBBY_MAX_DECK_TEXT_BYTES_V1) fail('Deck text is oversized');
    seats.push(seat);
  }
  for (const seatCapability of seatCaps) if (inviteCaps.has(seatCapability)) fail('Duplicate invite capability');
  if (seats[0]?.participantId !== hostParticipantId) fail('Host seat mismatch');
  if (!appId(roomId) || !appId(hostParticipantId) || typeof serverBuildId !== 'string' || (lifecycle !== 'forming' && lifecycle !== 'ready' && lifecycle !== 'started')) fail('Invalid lobby identity');
  const configured = [...seatCaps, ...inviteCaps];
  for (const value of [roomId, serverBuildId, hostParticipantId]) assertNoConfiguredCapabilityFragmentV1(value, configured);
  for (const seat of seats) {
    if (seat.participantId !== null) assertNoConfiguredCapabilityFragmentV1(seat.participantId, configured);
    if (seat.deckId !== null) assertNoConfiguredCapabilityFragmentV1(seat.deckId, configured);
  }
  const derivedReady = seats.every((seat) => seat.participantId !== null && seat.deckId !== null && seat.deckText !== null && seat.ready);
  if (lifecycle === 'ready' && !derivedReady) fail('Invalid ready lifecycle');
  if (lifecycle === 'started' && !derivedReady) fail('Invalid started lifecycle');
  if (lifecycle === 'forming' && derivedReady) fail('Invalid forming lifecycle');
  return freezeLobby({ kind: 'online-forming-lobby-v1', schemaVersion: 1, lifecycle, roomId, serverBuildId, hostParticipantId, seats });
}

export function validateOnlineFormingLobbyV1(input: unknown): OnlineFormingLobbyValidationResultV1 {
  try { return Object.freeze({ ok: true as const, value: validateLobbyInternal(input) }); }
  catch (error: unknown) { const message = error instanceof Error ? error.message : 'INVALID_LOBBY'; return Object.freeze({ ok: false as const, issues: Object.freeze([{ code: message, path: '', message }]) }); }
}

export function isOnlineFormingLobbyParticipantIdV1(value: unknown): value is string {
  return appId(value);
}

export function createOnlineFormingLobbyV1(input: CreateOnlineFormingLobbyV1Input): OnlineFormingLobbyV1 {
  if (!exactRecord(input, ['roomId', 'serverBuildId', 'hostParticipantId', 'seatCapabilities', 'inviteCapabilities']) || !appId(input.roomId) || !validateBuildId(input.serverBuildId).ok || !appId(input.hostParticipantId) || !Array.isArray(input.seatCapabilities) || input.seatCapabilities.length !== 4 || !Array.isArray(input.inviteCapabilities) || input.inviteCapabilities.length !== 3) fail('Invalid lobby creation input');
  const seats = input.seatCapabilities.map((seatCapability, index) => {
    if (!capability(seatCapability)) fail('Invalid seat capability');
    const inviteCapability = index === 0 ? null : input.inviteCapabilities[index - 1];
    if (index > 0 && !capability(inviteCapability)) fail('Invalid invite capability');
    return Object.freeze({ seatIndex: index as OnlineFormingLobbySeatIndexV1, corePlayerId: PLAYER_IDS[index], participantId: index === 0 ? input.hostParticipantId : null, seatCapability, inviteCapability: inviteCapability ?? null, deckId: null, deckText: null, ready: false });
  });
  const lobby = freezeLobby({ kind: 'online-forming-lobby-v1', schemaVersion: 1, lifecycle: 'forming', roomId: input.roomId, serverBuildId: input.serverBuildId, hostParticipantId: input.hostParticipantId, seats });
  return validateLobbyInternal(lobby);
}

function seatForCapability(lobby: OnlineFormingLobbyV1, participantId: string, seatCapability: string): number {
  if (!appId(participantId) || !capability(seatCapability)) fail('Invalid seat authorization');
  const index = lobby.seats.findIndex((seat) => seat.participantId === participantId && seat.seatCapability === seatCapability);
  if (index < 0) fail('Seat authorization rejected');
  return index;
}

/** Shared seat authorization used by the v2 deck boundary. */
export function authorizeOnlineFormingLobbySeatV1(lobbyInput: unknown, participantId: string, seatCapability: string): number {
  return seatForCapability(validateLobbyInternal(lobbyInput), participantId, seatCapability);
}

/** Clear only the legacy deck/readiness fields for one authorized seat. */
export function invalidateOnlineFormingLobbySeatDeckV1(lobbyInput: unknown, seatIndex: number): OnlineFormingLobbyV1 {
  const lobby = validateLobbyInternal(lobbyInput);
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= lobby.seats.length) fail('Invalid seat index');
  return withSeat(lobby, seatIndex, { deckId: null, deckText: null, ready: false }, 'forming');
}

function withSeat(lobby: OnlineFormingLobbyV1, index: number, patch: Partial<OnlineFormingLobbySeatV1>, lifecycle?: OnlineFormingLobbyLifecycleV1): OnlineFormingLobbyV1 {
  const seats = lobby.seats.map((seat, seatIndex) => seatIndex === index ? Object.freeze({ ...seat, ...patch }) : seat);
  const ready = seats.every((seat) => seat.participantId !== null && seat.deckId !== null && seat.deckText !== null && seat.ready);
  return validateLobbyInternal(freezeLobby({ ...lobby, lifecycle: lifecycle ?? (ready ? 'ready' : 'forming'), seats }));
}

export function claimOnlineFormingLobbySeatV1(lobbyInput: unknown, input: ClaimOnlineFormingLobbySeatV1Input): Readonly<{ readonly lobby: OnlineFormingLobbyV1; readonly seatCapability: string }> {
  const lobby = validateLobbyInternal(lobbyInput);
  if (lobby.lifecycle !== 'forming' || !exactRecord(input, ['participantId', 'inviteCapability']) || !appId(input.participantId) || !capability(input.inviteCapability)) fail('Invalid claim');
  const index = lobby.seats.findIndex((seat) => seat.inviteCapability === input.inviteCapability && seat.participantId === null);
  if (index < 0) fail('Invite rejected');
  if (lobby.seats.some((seat) => seat.participantId === input.participantId)) fail('Participant already claimed');
  const target = lobby.seats[index];
  if (target === undefined) fail('Invite rejected');
  const next = withSeat(lobby, index, { participantId: input.participantId, inviteCapability: null });
  return Object.freeze({ lobby: next, seatCapability: target.seatCapability });
}

export function submitOnlineFormingLobbyDeckV1(lobbyInput: unknown, input: SubmitOnlineFormingLobbyDeckV1Input): OnlineFormingLobbyV1 {
  const lobby = validateLobbyInternal(lobbyInput);
  if (lobby.lifecycle !== 'forming' && lobby.lifecycle !== 'ready' || !exactRecord(input, ['participantId', 'seatCapability', 'deckId', 'deckText']) || typeof input.deckText !== 'string' || !appId(input.deckId)) fail('Invalid deck submission');
  if (new TextEncoder().encode(input.deckText).length > ONLINE_FORMING_LOBBY_MAX_DECK_TEXT_BYTES_V1) fail('Deck text is oversized');
  assertSafeMetadata(input.deckId, lobby);
  const index = seatForCapability(lobby, input.participantId, input.seatCapability);
  return withSeat(lobby, index, { deckId: input.deckId, deckText: input.deckText, ready: false });
}

export function setOnlineFormingLobbySeatReadyV1(lobbyInput: unknown, input: SetOnlineFormingLobbySeatReadyV1Input): OnlineFormingLobbyV1 {
  const lobby = validateLobbyInternal(lobbyInput);
  if ((lobby.lifecycle !== 'forming' && lobby.lifecycle !== 'ready') || !exactRecord(input, ['participantId', 'seatCapability', 'ready']) || typeof input.ready !== 'boolean') fail('Invalid readiness');
  const index = seatForCapability(lobby, input.participantId, input.seatCapability);
  const seat = lobby.seats[index];
  if (seat === undefined || seat.deckId === null || seat.deckText === null) fail('Deck required before ready');
  return withSeat(lobby, index, { ready: input.ready });
}

export function projectOnlineFormingLobbyV1(lobbyInput: unknown): OnlineFormingLobbyProjectionV1 {
  const lobby = validateLobbyInternal(lobbyInput);
  return Object.freeze({ kind: 'online-forming-lobby-projection-v1', schemaVersion: 1, lifecycle: lobby.lifecycle, roomId: lobby.roomId, serverBuildId: lobby.serverBuildId, hostParticipantId: lobby.hostParticipantId, seats: Object.freeze(lobby.seats.map((seat) => Object.freeze({ seatIndex: seat.seatIndex, corePlayerId: seat.corePlayerId, participantId: seat.participantId, deckId: seat.deckId, deckSubmitted: seat.deckText !== null, ready: seat.ready }))) });
}

/** Shared admission credential persisted alongside the forming four-seat lobby. */
export type OnlineLobbyAdmissionV3 = Readonly<{
  readonly kind: 'online-lobby-admission-v3';
  readonly schemaVersion: 3;
  readonly roomId: string;
  readonly currentCapability: string;
  readonly generation: number;
  readonly open: boolean;
  readonly retiredCapabilities: readonly string[];
}>;

export type OnlineLobbyAdmissionValidationResultV3 =
  | Readonly<{ readonly ok: true; readonly value: OnlineLobbyAdmissionV3 }>
  | Readonly<{ readonly ok: false }>;

function admissionCapability(value: unknown): value is string {
  return typeof value === 'string' && isOnlineRoomSeatCapabilityV1(value);
}

function validateAdmissionInternal(value: unknown): OnlineLobbyAdmissionV3 {
  const fields = ['kind', 'schemaVersion', 'roomId', 'currentCapability', 'generation', 'open', 'retiredCapabilities'] as const;
  if (!exactRecord(value, fields)) fail('Invalid admission record');
  const record = value;
  const kind = ownData(record, 'kind');
  const schemaVersion = ownData(record, 'schemaVersion');
  const roomId = ownData(record, 'roomId');
  const currentCapability = ownData(record, 'currentCapability');
  const generation = ownData(record, 'generation');
  const open = ownData(record, 'open');
  const retired = ownData(record, 'retiredCapabilities');
  if (kind !== 'online-lobby-admission-v3' || schemaVersion !== 3 || !appId(roomId) || !admissionCapability(currentCapability) || typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 1 || typeof open !== 'boolean' || !Array.isArray(retired) || Object.getPrototypeOf(retired) !== Array.prototype || retired.length > 4) fail('Invalid admission fields');
  const retiredValues: string[] = [];
  for (let index = 0; index < retired.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(retired, String(index));
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) fail('Sparse retired capabilities');
    const candidate: unknown = descriptor.value;
    if (!admissionCapability(candidate) || candidate === currentCapability || retiredValues.includes(candidate)) fail('Invalid retired capability');
    retiredValues.push(candidate);
  }
  try { assertNoConfiguredCapabilityFragmentV1(roomId, [currentCapability, ...retiredValues]); } catch { fail('Invalid admission metadata'); }
  return Object.freeze({ kind: 'online-lobby-admission-v3', schemaVersion: 3, roomId, currentCapability, generation, open, retiredCapabilities: Object.freeze(retiredValues) });
}

export function validateOnlineLobbyAdmissionV3(input: unknown): OnlineLobbyAdmissionValidationResultV3 {
  try { return Object.freeze({ ok: true as const, value: validateAdmissionInternal(input) }); }
  catch { return Object.freeze({ ok: false as const }); }
}

export function createOnlineLobbyAdmissionV3(input: Readonly<{ readonly roomId: string; readonly currentCapability: string }>): OnlineLobbyAdmissionV3 {
  if (!exactRecord(input, ['roomId', 'currentCapability']) || !appId(input.roomId) || !admissionCapability(input.currentCapability)) fail('Invalid admission creation input');
  try { assertNoConfiguredCapabilityFragmentV1(input.roomId, [input.currentCapability]); } catch { fail('Invalid admission creation input'); }
  return validateAdmissionInternal({ kind: 'online-lobby-admission-v3', schemaVersion: 3, roomId: input.roomId, currentCapability: input.currentCapability, generation: 1, open: true, retiredCapabilities: [] });
}

function encodeBase64UrlUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa !== 'function') throw new Error('Base64 unavailable');
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64UrlUtf8(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    if (typeof atob !== 'function') return null;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { return null; }
}

export function encodeOnlineSharedInviteCodeV3(roomId: string, admissionCapabilityValue: string): string {
  if (!appId(roomId) || !admissionCapability(admissionCapabilityValue)) fail('Invalid shared invite');
  return `v3.${encodeBase64UrlUtf8(roomId)}.${admissionCapabilityValue}`;
}

export function parseOnlineSharedInviteCodeV3(value: unknown): Readonly<{ readonly roomId: string; readonly admissionCapability: string }> | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v3' || parts[1] === '' || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const roomId = decodeBase64UrlUtf8(parts[1]);
  const admissionCapabilityValue = parts[2];
  if (roomId === null || !appId(roomId) || encodeBase64UrlUtf8(roomId) !== parts[1] || !admissionCapability(admissionCapabilityValue)) return null;
  return Object.freeze({ roomId, admissionCapability: admissionCapabilityValue });
}

export function claimOnlineLobbyAdmissionV3(
  lobbyInput: unknown,
  admissionInput: unknown,
  input: Readonly<{ readonly participantId: string; readonly admissionCapability: string }>,
): Readonly<{ readonly lobby: OnlineFormingLobbyV1; readonly admission: OnlineLobbyAdmissionV3; readonly seatCapability: string }> {
  const lobby = validateLobbyInternal(lobbyInput);
  const admission = validateAdmissionInternal(admissionInput);
  if (admission.roomId !== lobby.roomId || !exactRecord(input, ['participantId', 'admissionCapability']) || !appId(input.participantId) || !admissionCapability(input.admissionCapability)) fail('INVITE_INVALID');
  if (!admission.open) fail('ADMISSION_CLOSED');
  if (input.admissionCapability !== admission.currentCapability) fail(admission.retiredCapabilities.includes(input.admissionCapability) ? 'INVITE_ROTATED' : 'INVITE_INVALID');
  if (lobby.lifecycle !== 'forming') fail('INVALID_LIFECYCLE');
  if (lobby.seats.some((seat) => seat.participantId === input.participantId)) fail('PARTICIPANT_RECOVERABLE');
  const index = lobby.seats.findIndex((seat) => seat.participantId === null);
  if (index < 0) fail('ROOM_FULL');
  const target = lobby.seats[index];
  if (target === undefined) fail('ROOM_FULL');
  const next = withSeat(lobby, index, { participantId: input.participantId, inviteCapability: null });
  return Object.freeze({ lobby: next, admission, seatCapability: target.seatCapability });
}

export function rotateOnlineLobbyAdmissionV3(
  lobbyInput: unknown,
  admissionInput: unknown,
  input: Readonly<{ readonly hostParticipantId: string; readonly seatCapability: string; readonly nextCapability: string }>,
): OnlineLobbyAdmissionV3 {
  const lobby = validateLobbyInternal(lobbyInput);
  const admission = validateAdmissionInternal(admissionInput);
  if (admission.roomId !== lobby.roomId || !exactRecord(input, ['hostParticipantId', 'seatCapability', 'nextCapability']) || input.hostParticipantId !== lobby.hostParticipantId || !admissionCapability(input.nextCapability) || input.nextCapability === admission.currentCapability || admission.retiredCapabilities.includes(input.nextCapability)) fail('HOST_REQUIRED');
  try { seatForCapability(lobby, input.hostParticipantId, input.seatCapability); } catch { fail('HOST_REQUIRED'); }
  if (lobby.lifecycle !== 'forming' && lobby.lifecycle !== 'ready') fail('INVALID_LIFECYCLE');
  return validateAdmissionInternal({ ...admission, currentCapability: input.nextCapability, generation: admission.generation + 1, open: true, retiredCapabilities: [admission.currentCapability, ...admission.retiredCapabilities].slice(0, 4) });
}

export function closeOnlineLobbyAdmissionV3(
  lobbyInput: unknown,
  admissionInput: unknown,
  input: Readonly<{ readonly hostParticipantId: string; readonly seatCapability: string }>,
): OnlineLobbyAdmissionV3 {
  const lobby = validateLobbyInternal(lobbyInput);
  const admission = validateAdmissionInternal(admissionInput);
  if (admission.roomId !== lobby.roomId || !exactRecord(input, ['hostParticipantId', 'seatCapability']) || input.hostParticipantId !== lobby.hostParticipantId) fail('HOST_REQUIRED');
  try { seatForCapability(lobby, input.hostParticipantId, input.seatCapability); } catch { fail('HOST_REQUIRED'); }
  if (lobby.lifecycle !== 'forming' && lobby.lifecycle !== 'ready') fail('INVALID_LIFECYCLE');
  return validateAdmissionInternal({ ...admission, open: false });
}
