import { bootstrapFourDeckGenesisV1, type FourDeckBootstrapResultV1 } from '../bootstrap/index';
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
export type StartOnlineFormingLobbyV1Input = Readonly<{ readonly hostParticipantId: string; readonly seatCapability: string }>;

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

export function startOnlineFormingLobbyV1(lobbyInput: unknown, input: StartOnlineFormingLobbyV1Input): Readonly<{ readonly lobby: OnlineFormingLobbyV1; readonly genesis: FourDeckBootstrapResultV1 }> {
  const lobby = validateLobbyInternal(lobbyInput);
  if (lobby.lifecycle !== 'ready' || !exactRecord(input, ['hostParticipantId', 'seatCapability']) || input.hostParticipantId !== lobby.hostParticipantId || seatForCapability(lobby, input.hostParticipantId, input.seatCapability) !== 0) fail('Host authorization rejected');
  const seats = lobby.seats.map((seat) => ({ seatIndex: seat.seatIndex, corePlayerId: seat.corePlayerId, participantId: seat.participantId ?? '', seatCapability: seat.seatCapability, deckId: seat.deckId ?? '', deckText: seat.deckText ?? '' }));
  const genesis = bootstrapFourDeckGenesisV1({ roomId: lobby.roomId, serverBuildId: lobby.serverBuildId, seats });
  if (!genesis.ok) return Object.freeze({ lobby, genesis });
  return Object.freeze({ lobby: validateLobbyInternal(freezeLobby({ ...lobby, lifecycle: 'started' })), genesis });
}

export function projectOnlineFormingLobbyV1(lobbyInput: unknown): OnlineFormingLobbyProjectionV1 {
  const lobby = validateLobbyInternal(lobbyInput);
  return Object.freeze({ kind: 'online-forming-lobby-projection-v1', schemaVersion: 1, lifecycle: lobby.lifecycle, roomId: lobby.roomId, serverBuildId: lobby.serverBuildId, hostParticipantId: lobby.hostParticipantId, seats: Object.freeze(lobby.seats.map((seat) => Object.freeze({ seatIndex: seat.seatIndex, corePlayerId: seat.corePlayerId, participantId: seat.participantId, deckId: seat.deckId, deckSubmitted: seat.deckText !== null, ready: seat.ready }))) });
}
