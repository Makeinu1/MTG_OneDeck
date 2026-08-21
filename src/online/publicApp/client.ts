import {
  createOnlineBrowserWebSocketClientV1,
  type OnlineBrowserStateV1,
  type OnlineBrowserWebSocketClientV1,
} from '../browser/index';
import {
  bindPersonalWorkbenchActionV1,
  type OnlineDisplayPairingSessionV1,
} from '../displayPairing/index';
import { bindOnlineGuidedCommandActionV1 } from '../guidedActions/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import { validateBuildId } from '../../versioning/index';
import {
  PUBLIC_ONLINE_ERROR_V1,
  type PublicOnlineControllerV1,
  type PublicOnlineDeckOptionV1,
  type PublicOnlineSnapshotV1,
  type PublicOnlineValidationResultV1,
} from './types';
import { PUBLIC_ONLINE_ENDPOINT_V1 } from './index';

const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_DECK_BYTES = 262_144;
const BUILD_ID = 'o4p-06e-client';
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const LOBBY_FIELDS = ['kind', 'schemaVersion', 'lifecycle', 'roomId', 'serverBuildId', 'hostParticipantId', 'seats'] as const;
const SEAT_FIELDS = ['seatIndex', 'corePlayerId', 'participantId', 'deckId', 'deckSubmitted', 'ready'] as const;

type RecordValue = Record<string, unknown>;
type LobbyProjection = Readonly<RecordValue>;
type SecretBundle = Readonly<{
  readonly participantId: string;
  readonly seatCapability: string;
  readonly inviteCapabilities: readonly string[];
  readonly tableParticipantId: string | null;
  readonly tableCapability: string | null;
}>;

function plainRecord(value: unknown): value is RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function own(value: RecordValue, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function exact(value: unknown, fields: readonly string[]): value is RecordValue {
  if (!plainRecord(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch {
    return false;
  }
}

function dense(value: unknown, maxLength: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || lengthDescriptor.get !== undefined || lengthDescriptor.set !== undefined) return null;
    const rawLength: unknown = lengthDescriptor.value;
    if (typeof rawLength !== 'number' || !Number.isSafeInteger(rawLength) || rawLength < 0 || rawLength > maxLength) return null;
    const length = rawLength;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => {
      if (typeof key !== 'string') return true;
      if (key === 'length') return false;
      if (!/^(?:0|[1-9]\d*)$/.test(key)) return true;
      const index = Number(key);
      return !Number.isSafeInteger(index) || index >= length;
    })) return null;
    const copied: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return null;
      copied.push(descriptor.value);
    }
    return Object.freeze(copied);
  } catch {
    return null;
  }
}

function applicationId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value) && value !== '__proto__' && value !== 'prototype' && value !== 'constructor';
}

function capability(value: unknown): value is string {
  return typeof value === 'string' && CAPABILITY_PATTERN.test(value);
}

function hasCapabilityFragment(value: string, capabilities: readonly string[]): boolean {
  return capabilities.some((configured) => {
    for (let offset = 0; offset <= configured.length - 8; offset += 1) {
      if (value.includes(configured.slice(offset, offset + 8))) return true;
    }
    return false;
  });
}

function hasPairwiseCapabilityFragment(values: readonly string[]): boolean {
  for (let left = 0; left < values.length; left += 1) {
    for (let right = 0; right < values.length; right += 1) {
      if (left !== right && hasCapabilityFragment(values[left] ?? '', [values[right] ?? ''])) return true;
    }
  }
  return false;
}

function graphHasCapabilityFragment(value: unknown, capabilities: readonly string[]): boolean {
  const seen = new Set<object>();
  const pending: unknown[] = [value];
  let inspected = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === 'string') {
      if (hasCapabilityFragment(current, capabilities)) return true;
      continue;
    }
    if (current === null || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);
    inspected += 1;
    if (inspected > 512) return true;
    let keys: readonly PropertyKey[];
    try { keys = Reflect.ownKeys(current); } catch { return true; }
    for (const key of keys) {
      if (typeof key !== 'string' || hasCapabilityFragment(key, capabilities)) return true;
      let descriptor: PropertyDescriptor | undefined;
      try { descriptor = Object.getOwnPropertyDescriptor(current, key); } catch { return true; }
      if (descriptor === undefined || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return true;
      pending.push(descriptor.value);
    }
  }
  return false;
}

function configuredSecrets(secrets: SecretBundle): readonly string[] {
  return Object.freeze([
    secrets.seatCapability,
    ...secrets.inviteCapabilities,
    ...(secrets.tableCapability === null ? [] : [secrets.tableCapability]),
  ]);
}

function lifecycle(value: unknown): value is 'forming' | 'ready' | 'started' {
  return value === 'forming' || value === 'ready' || value === 'started';
}

function safeText(value: unknown, maxBytes: number): value is string {
  if (typeof value !== 'string') return false;
  try { return new TextEncoder().encode(value).length <= maxBytes; } catch { return false; }
}

function parseSeat(value: unknown, index: number, capabilities: readonly string[]): RecordValue | null {
  if (!exact(value, SEAT_FIELDS)) return null;
  const seatIndex = own(value, 'seatIndex');
  const player = own(value, 'corePlayerId');
  const participantId = own(value, 'participantId');
  const deckId = own(value, 'deckId');
  const submitted = own(value, 'deckSubmitted');
  const ready = own(value, 'ready');
  if (seatIndex !== index || player !== `P${index + 1}` || (participantId !== null && !applicationId(participantId)) || (deckId !== null && !applicationId(deckId)) || typeof submitted !== 'boolean' || typeof ready !== 'boolean') return null;
  if (typeof participantId === 'string' && hasCapabilityFragment(participantId, capabilities)) return null;
  if (typeof deckId === 'string' && hasCapabilityFragment(deckId, capabilities)) return null;
  if (ready && (participantId === null || deckId === null || submitted !== true)) return null;
  return Object.freeze({ seatIndex, corePlayerId: player, participantId, deckId, deckSubmitted: submitted, ready });
}

export function validatePublicOnlineProjectionV1(input: unknown): PublicOnlineValidationResultV1<LobbyProjection> {
  try {
    if (!exact(input, LOBBY_FIELDS)) return { ok: false };
    const roomId = own(input, 'roomId');
    const serverBuildId = own(input, 'serverBuildId');
    const host = own(input, 'hostParticipantId');
    const rawSeats = dense(own(input, 'seats'), 4);
    if (own(input, 'kind') !== 'online-forming-lobby-projection-v1' || own(input, 'schemaVersion') !== 1 || !applicationId(roomId) || !safeText(serverBuildId, 256) || !validateBuildId(serverBuildId).ok || !applicationId(host) || !lifecycle(own(input, 'lifecycle')) || rawSeats === null || rawSeats.length !== 4) return { ok: false };
    const seats: RecordValue[] = [];
    for (let index = 0; index < rawSeats.length; index += 1) {
      const seat = parseSeat(rawSeats[index], index, []);
      if (seat === null) return { ok: false };
      seats.push(seat);
    }
    const participants = new Set<string>();
    const deckIds = new Set<string>();
    for (const seat of seats) {
      const participantId = seat.participantId;
      const deckId = seat.deckId;
      if (typeof participantId === 'string') {
        if (participants.has(participantId)) return { ok: false };
        participants.add(participantId);
      }
      if (typeof deckId === 'string') {
        if (deckIds.has(deckId)) return { ok: false };
        deckIds.add(deckId);
      }
      if ((deckId === null) !== (seat.deckSubmitted !== true)) return { ok: false };
    }
    if (seats[0]?.participantId !== host) return { ok: false };
    const complete = seats.every((seat) => seat.participantId !== null && seat.deckId !== null && seat.deckSubmitted === true && seat.ready === true);
    const currentLifecycle = own(input, 'lifecycle');
    if ((currentLifecycle === 'forming' && complete) || ((currentLifecycle === 'ready' || currentLifecycle === 'started') && !complete)) return { ok: false };
    return { ok: true, value: Object.freeze({ kind: own(input, 'kind'), schemaVersion: own(input, 'schemaVersion'), lifecycle: own(input, 'lifecycle'), roomId, serverBuildId, hostParticipantId: host, seats: Object.freeze(seats) }) };
  } catch {
    return { ok: false };
  }
}

function validateProjectionWithSecrets(input: unknown, roomId: string, capabilities: readonly string[]): PublicOnlineValidationResultV1<LobbyProjection> {
  const checked = validatePublicOnlineProjectionV1(input);
  if (!checked.ok) return checked;
  const value = checked.value;
  if (value.roomId !== roomId || hasCapabilityFragment(value.roomId, capabilities) || hasCapabilityFragment(String(value.serverBuildId), capabilities) || hasCapabilityFragment(String(value.hostParticipantId), capabilities) || (value.seats as readonly RecordValue[]).some((seat) => (typeof seat.participantId === 'string' && hasCapabilityFragment(seat.participantId, capabilities)) || (typeof seat.deckId === 'string' && hasCapabilityFragment(seat.deckId, capabilities)))) return { ok: false };
  return checked;
}

function createdResponse(value: unknown, expectedParticipantId: string): Readonly<{ readonly roomId: string; readonly seatCapability: string; readonly invites: readonly string[]; readonly tableParticipantId: string; readonly tableCapability: string; readonly projection: LobbyProjection }> | null {
  if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'seatCapability', 'inviteCapabilities', 'tableParticipantId', 'tableCapability', 'projection'])) return null;
  const roomId = own(value, 'roomId');
  const seatCapability = own(value, 'seatCapability');
  const rawInvites = dense(own(value, 'inviteCapabilities'), 3);
  const tableParticipantId = own(value, 'tableParticipantId');
  const tableCapability = own(value, 'tableCapability');
  let invites: string[] | null = null;
  if (rawInvites !== null && rawInvites.length === 3) {
    const parsedInvites: string[] = [];
    for (let index = 0; index < rawInvites.length; index += 1) {
      const invite = rawInvites[index];
      if (!capability(invite)) { parsedInvites.length = 0; break; }
      parsedInvites.push(invite);
    }
    if (parsedInvites.length === 3) invites = parsedInvites;
  }
  if (own(value, 'kind') !== 'online-forming-lobby-created-v1' || own(value, 'schemaVersion') !== 1 || !applicationId(roomId) || !capability(seatCapability) || invites === null || invites.length !== 3 || !applicationId(tableParticipantId) || !capability(tableCapability)) return null;
  const all = [seatCapability, ...invites, tableCapability];
  if (new Set(all).size !== all.length || hasPairwiseCapabilityFragment(all) || hasCapabilityFragment(roomId, all) || hasCapabilityFragment(tableParticipantId, all)) return null;
  const projection = validateProjectionWithSecrets(own(value, 'projection'), roomId, all);
  if (!projection.ok) return null;
  if (projection.value.lifecycle !== 'forming' || graphHasCapabilityFragment(projection.value, all)) return null;
  const projectionSeats = projection.value.seats as readonly RecordValue[];
  if (projection.value.hostParticipantId !== expectedParticipantId || projectionSeats.length !== 4 || projectionSeats[0]?.participantId !== expectedParticipantId) return null;
  return Object.freeze({ roomId, seatCapability, invites: Object.freeze([...invites]), tableParticipantId, tableCapability, projection: projection.value });
}

function claimedResponse(value: unknown, expectedRoomId: string, expectedParticipantId: string, configuredCapabilities: readonly string[]): Readonly<{ readonly seatCapability: string; readonly projection: LobbyProjection }> | null {
  if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'seatCapability', 'projection']) || own(value, 'kind') !== 'online-forming-lobby-seat-claimed-v1' || own(value, 'schemaVersion') !== 1 || own(value, 'roomId') !== expectedRoomId || !capability(own(value, 'seatCapability'))) return null;
  const seatCapability = own(value, 'seatCapability') as string;
  const capabilities = [seatCapability, ...configuredCapabilities];
  if (new Set(capabilities).size !== capabilities.length || hasPairwiseCapabilityFragment(capabilities)) return null;
  const projection = validateProjectionWithSecrets(own(value, 'projection'), expectedRoomId, capabilities);
  if (!projection.ok) return null;
  if (graphHasCapabilityFragment(projection.value, capabilities)) return null;
  const matchingSeats = (projection.value.seats as readonly RecordValue[]).filter((seat) => seat.participantId === expectedParticipantId);
  return matchingSeats.length === 1 ? Object.freeze({ seatCapability, projection: projection.value }) : null;
}

function projectionResponse(value: unknown, expectedKind: string, expectedRoomId: string, capabilities: readonly string[]): LobbyProjection | null {
  if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'projection']) || own(value, 'kind') !== expectedKind || own(value, 'schemaVersion') !== 1 || own(value, 'roomId') !== expectedRoomId) return null;
  const projection = validateProjectionWithSecrets(own(value, 'projection'), expectedRoomId, capabilities);
  return projection.ok && !graphHasCapabilityFragment(projection.value, capabilities) ? projection.value : null;
}

function startResponse(value: unknown, expectedRoomId: string): boolean {
  if (!exact(value, ['kind', 'schemaVersion', 'roomId', 'status']) || own(value, 'kind') !== 'online-forming-lobby-started-v1' || own(value, 'schemaVersion') !== 1 || own(value, 'roomId') !== expectedRoomId) return false;
  const status = own(value, 'status');
  if (!exact(status, ['kind', 'schemaVersion', 'roomId', 'revision', 'roomLifecycle', 'acceptedCommandCount'])) return false;
  return own(status, 'kind') === 'online-cloudflare-room-status-v1' && own(status, 'schemaVersion') === 1 && own(status, 'roomId') === expectedRoomId && Number.isSafeInteger(own(status, 'revision')) && own(status, 'revision') === 0 && own(status, 'roomLifecycle') === 'active' && own(status, 'acceptedCommandCount') === 0;
}

async function responseJson(response: Response): Promise<unknown> {
  if (!(response instanceof Response) || !response.ok) throw new Error(PUBLIC_ONLINE_ERROR_V1);
  const contentType = response.headers.get('content-type');
  if (contentType === null || !/^application\/json(?:\s*;|\s*$)/i.test(contentType)) throw new Error(PUBLIC_ONLINE_ERROR_V1);
  const text = await response.text();
  if (!safeText(text, MAX_RESPONSE_BYTES)) throw new Error(PUBLIC_ONLINE_ERROR_V1);
  return JSON.parse(text) as unknown;
}

function identifier(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject === undefined || typeof cryptoObject.getRandomValues !== 'function') throw new Error(PUBLIC_ONLINE_ERROR_V1);
  const bytes = new Uint8Array(18);
  cryptoObject.getRandomValues(bytes);
  let result = 'p_';
  for (const byte of bytes) result += byte.toString(36).padStart(2, '0');
  return result.slice(0, 40);
}

function commandIdentifier(): string {
  return identifier().replace(/^p_/, 'c_');
}

function browserState(client: OnlineBrowserWebSocketClientV1 | null): OnlineBrowserStateV1 | null {
  return client === null ? null : client.getSnapshot();
}

function connectionState(player: OnlineBrowserStateV1 | null, table: OnlineBrowserStateV1 | null): PublicOnlineSnapshotV1['connection'] {
  const phase = player?.phase ?? table?.phase;
  if (player?.phase === 'failed' || table?.phase === 'failed' || phase === 'failed') return 'failed';
  if (player !== null && player.phase === 'open' && (table === null || table.phase === 'open')) return 'ready';
  if (player?.phase === 'closed' || table?.phase === 'closed' || phase === 'closed') return 'offline';
  if (phase === undefined || phase === 'idle') return 'offline';
  return phase === 'recovering' ? 'offline' : phase === 'connecting' || phase === 'awaiting-ready' || phase === 'authenticating' || phase === 'resyncing' ? 'connecting' : 'updating';
}

export function createPublicOnlineControllerV1(): PublicOnlineControllerV1 {
  let epoch = 0;
  let requestSequence = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abort: AbortController | null = null;
  let projectionInternal: LobbyProjection | null = null;
  let secrets: SecretBundle | null = null;
  let playerClient: OnlineBrowserWebSocketClientV1 | null = null;
  let tableClient: OnlineBrowserWebSocketClientV1 | null = null;
  let playerUnsubscribe: (() => void) | null = null;
  let tableUnsubscribe: (() => void) | null = null;
  let browsersStartedForEpoch = -1;
  let selectedDeckId = '';
  const inFlight = new Set<'create' | 'join' | 'refresh' | 'deck' | 'ready' | 'start'>();
  const listeners = new Set<(snapshot: PublicOnlineSnapshotV1) => void>();
  let snapshot: PublicOnlineSnapshotV1 = Object.freeze({ mode: 'entry', roomId: null, participantId: null, isHost: false, lifecycle: null, projection: null, invites: Object.freeze([]), selectedDeckId, busy: null, connection: 'offline', player: null, table: null, error: null });

  const publish = (error: string | null = snapshot.error): void => {
    const player = browserState(playerClient);
    const table = browserState(tableClient);
    const currentProjection = projectionInternal;
    const safeProjection = currentProjection === null ? null : Object.freeze({ ...currentProjection, hostParticipantId: null, seats: Object.freeze((currentProjection.seats as readonly RecordValue[]).map((seat) => Object.freeze({ ...seat, participantId: null, occupied: seat.participantId !== null }))) });
    snapshot = Object.freeze({ mode: snapshot.mode, roomId: snapshot.roomId, participantId: null, isHost: snapshot.isHost, lifecycle: currentProjection === null ? null : currentProjection.lifecycle as 'forming' | 'ready' | 'started', projection: safeProjection, invites: snapshot.invites, selectedDeckId, busy: snapshot.busy, connection: connectionState(player, table), player, table, error });
    for (const listener of listeners) { try { listener(snapshot); } catch { /* UI listeners are isolated. */ } }
  };

  const clearTimer = (): void => { if (timer !== null) { clearTimeout(timer); timer = null; } };
  const closeClients = (): void => {
    playerUnsubscribe?.(); tableUnsubscribe?.(); playerUnsubscribe = null; tableUnsubscribe = null;
    playerClient?.disconnect(); tableClient?.disconnect(); playerClient = null; tableClient = null;
  };
  const reset = (): void => {
    clearTimer(); abort?.abort(); abort = null; closeClients(); projectionInternal = null; secrets = null; selectedDeckId = ''; browsersStartedForEpoch = -1; inFlight.clear(); epoch += 1;
    snapshot = Object.freeze({ mode: 'entry', roomId: null, participantId: null, isHost: false, lifecycle: null, projection: null, invites: Object.freeze([]), selectedDeckId: '', busy: null, connection: 'offline', player: null, table: null, error: null });
  };
  const fetchJson = async (url: string, init: RequestInit, requestEpoch: number, sequence: number): Promise<unknown> => {
    if (requestEpoch !== epoch || sequence !== requestSequence) throw new Error(PUBLIC_ONLINE_ERROR_V1);
    abort?.abort();
    const controller = new AbortController(); abort = controller;
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (requestEpoch !== epoch || sequence !== requestSequence) throw new Error(PUBLIC_ONLINE_ERROR_V1);
    const parsed = await responseJson(response);
    if (requestEpoch !== epoch || sequence !== requestSequence) throw new Error(PUBLIC_ONLINE_ERROR_V1);
    return parsed;
  };
  const beginBusy = (kind: 'create' | 'join' | 'refresh' | 'deck' | 'ready' | 'start'): boolean => {
    if (inFlight.size > 0) return false;
    inFlight.add(kind);
    snapshot = Object.freeze({ ...snapshot, busy: kind });
    publish(null);
    return true;
  };
  const endBusy = (kind: 'create' | 'join' | 'refresh' | 'deck' | 'ready' | 'start'): void => {
    inFlight.delete(kind);
    if (snapshot.busy === kind) {
      snapshot = Object.freeze({ ...snapshot, busy: null });
      publish(snapshot.error);
    }
  };
  const updateProjection = (next: LobbyProjection): void => {
    projectionInternal = next;
    snapshot = Object.freeze({ ...snapshot, mode: next.lifecycle === 'started' ? 'started' : snapshot.mode, lifecycle: next.lifecycle as 'forming' | 'ready' | 'started' });
    publish(null);
  };
  const schedulePoll = (): void => {
    clearTimer();
    if (projectionInternal === null || (projectionInternal.lifecycle !== 'forming' && projectionInternal.lifecycle !== 'ready')) return;
    const scheduledEpoch = epoch;
    timer = setTimeout(() => { timer = null; void refresh(scheduledEpoch).finally(() => { if (scheduledEpoch === epoch) schedulePoll(); }); }, 2000);
  };
  const startBrowsers = (): void => {
    if (secrets === null || projectionInternal === null || projectionInternal.lifecycle !== 'started') return;
    if (browsersStartedForEpoch === epoch) return;
    browsersStartedForEpoch = epoch;
    closeClients();
    const roomId = projectionInternal.roomId as string;
    const websocketOrigin = PUBLIC_ONLINE_ENDPOINT_V1.replace(/^https:/, 'wss:');
    const create = (participantId: string, capabilityValue: string): OnlineBrowserWebSocketClientV1 => createOnlineBrowserWebSocketClientV1({ webSocketUrl: `${websocketOrigin}/api/online/rooms/${encodeURIComponent(roomId)}/websocket`, protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: roomId as never, participantId: participantId as never, participantCapability: capabilityValue as never, clientBuildId: BUILD_ID });
    playerClient = create(secrets.participantId, secrets.seatCapability);
    playerUnsubscribe = playerClient.subscribe(() => publish(null));
    playerClient.connect();
    if (secrets.tableParticipantId !== null && secrets.tableCapability !== null) {
      tableClient = create(secrets.tableParticipantId, secrets.tableCapability);
      tableUnsubscribe = tableClient.subscribe(() => publish(null));
      tableClient.connect();
    }
    publish(null);
  };
  async function refresh(requestEpoch = epoch): Promise<void> {
    if (requestEpoch !== epoch) return;
    if (!beginBusy('refresh')) return;
    const sequence = ++requestSequence;
    try {
      if (projectionInternal === null || secrets === null || requestEpoch !== epoch) return;
      const body = await fetchJson(`${PUBLIC_ONLINE_ENDPOINT_V1}/api/online/rooms/${encodeURIComponent(projectionInternal.roomId as string)}/lobby`, { method: 'GET', headers: { accept: 'application/json' } }, requestEpoch, sequence);
      const nextValidation = validateProjectionWithSecrets(body, projectionInternal.roomId as string, configuredSecrets(secrets));
      const next = nextValidation.ok ? nextValidation.value : null;
      if (next === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      updateProjection(next);
      if (next.lifecycle === 'started') startBrowsers();
    } catch {
      if (requestEpoch === epoch && sequence === requestSequence) publish(PUBLIC_ONLINE_ERROR_V1);
    } finally {
      endBusy('refresh');
    }
  }
  async function mutate(kind: string, payload: RecordValue, responseKind: string): Promise<void> {
    if (projectionInternal === null || secrets === null) return;
    const requestEpoch = epoch;
    const sequence = ++requestSequence;
    try {
      const body = await fetchJson(`${PUBLIC_ONLINE_ENDPOINT_V1}/api/online/rooms/${encodeURIComponent(projectionInternal.roomId as string)}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, schemaVersion: 1, ...payload }) }, requestEpoch, sequence);
      const next = projectionResponse(body, responseKind, projectionInternal.roomId as string, configuredSecrets(secrets));
      if (next === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      updateProjection(next);
      schedulePoll();
    } catch { if (requestEpoch === epoch && sequence === requestSequence) publish(PUBLIC_ONLINE_ERROR_V1); }
  }
  const create = async (): Promise<void> => {
    if (!beginBusy('create')) return;
    const requestEpoch = epoch + 1; epoch = requestEpoch; reset(); epoch = requestEpoch;
    const sequence = ++requestSequence;
    inFlight.add('create'); snapshot = Object.freeze({ ...snapshot, busy: 'create' }); publish(null);
    try {
      const participantId = identifier();
      const body = await fetchJson(`${PUBLIC_ONLINE_ENDPOINT_V1}/api/online/rooms`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-create-v1', schemaVersion: 1, participantId }) }, requestEpoch, sequence);
      const result = createdResponse(body, participantId); if (result === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      secrets = Object.freeze({ participantId, seatCapability: result.seatCapability, inviteCapabilities: result.invites, tableParticipantId: result.tableParticipantId, tableCapability: result.tableCapability });
      projectionInternal = result.projection;
      snapshot = Object.freeze({ ...snapshot, mode: 'forming', roomId: result.roomId, isHost: true, invites: result.invites, error: null });
      publish(null); schedulePoll();
    } catch { if (requestEpoch === epoch && sequence === requestSequence) { snapshot = Object.freeze({ ...snapshot, mode: 'failed', error: PUBLIC_ONLINE_ERROR_V1 }); publish(PUBLIC_ONLINE_ERROR_V1); } }
    finally { endBusy('create'); }
  };
  const join = async (roomId: string, inviteCapability: string): Promise<void> => {
    if (!beginBusy('join')) return;
    if (!applicationId(roomId) || !capability(inviteCapability)) { endBusy('join'); publish(PUBLIC_ONLINE_ERROR_V1); return; }
    const requestEpoch = epoch + 1; epoch = requestEpoch; reset(); epoch = requestEpoch;
    const sequence = ++requestSequence;
    inFlight.add('join'); snapshot = Object.freeze({ ...snapshot, busy: 'join' }); publish(null);
    try {
      const participantId = identifier();
      const body = await fetchJson(`${PUBLIC_ONLINE_ENDPOINT_V1}/api/online/rooms/${encodeURIComponent(roomId)}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-seat-claim-v1', schemaVersion: 1, participantId, inviteCapability }) }, requestEpoch, sequence);
      const result = claimedResponse(body, roomId, participantId, [inviteCapability]); if (result === null) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      secrets = Object.freeze({ participantId, seatCapability: result.seatCapability, inviteCapabilities: Object.freeze([inviteCapability]), tableParticipantId: null, tableCapability: null });
      projectionInternal = result.projection;
      const started = result.projection.lifecycle === 'started';
      snapshot = Object.freeze({ ...snapshot, mode: started ? 'started' : 'forming', roomId, isHost: false, invites: Object.freeze([]), error: null });
      publish(null);
      if (started) startBrowsers(); else schedulePoll();
    } catch { if (requestEpoch === epoch && sequence === requestSequence) { snapshot = Object.freeze({ ...snapshot, mode: 'failed', error: PUBLIC_ONLINE_ERROR_V1 }); publish(PUBLIC_ONLINE_ERROR_V1); } }
    finally { endBusy('join'); }
  };
  const submitDeck = async (deck: PublicOnlineDeckOptionV1): Promise<void> => {
    if (!beginBusy('deck')) return;
    if (secrets === null || !applicationId(deck.id) || !safeText(deck.deckText, MAX_DECK_BYTES) || deck.deckText.length === 0) { endBusy('deck'); publish(PUBLIC_ONLINE_ERROR_V1); return; }
    selectedDeckId = deck.id;
    await mutate('online-forming-lobby-deck-submit-v1', { participantId: secrets.participantId, seatCapability: secrets.seatCapability, deckId: deck.id, deckText: deck.deckText }, 'online-forming-lobby-deck-submitted-v1');
    endBusy('deck');
  };
  const toggleReady = async (): Promise<void> => {
    if (!beginBusy('ready')) return;
    if (secrets === null || projectionInternal === null) { endBusy('ready'); return; }
    const seat = (projectionInternal.seats as readonly RecordValue[]).find((candidate) => candidate.deckId === selectedDeckId) ?? (projectionInternal.seats as readonly RecordValue[]).find((candidate) => candidate.participantId === secrets?.participantId);
    await mutate('online-forming-lobby-ready-v1', { participantId: secrets.participantId, seatCapability: secrets.seatCapability, ready: !(seat?.ready === true) }, 'online-forming-lobby-ready-v1');
    endBusy('ready');
  };
  const start = async (): Promise<void> => {
    if (!beginBusy('start')) return;
    if (secrets === null || !snapshot.isHost || projectionInternal?.lifecycle !== 'ready' || secrets.tableParticipantId === null || secrets.tableCapability === null) { endBusy('start'); return; }
    const requestEpoch = epoch;
    const sequence = ++requestSequence;
    try {
      const body = await fetchJson(`${PUBLIC_ONLINE_ENDPOINT_V1}/api/online/rooms/${encodeURIComponent(projectionInternal.roomId as string)}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-start-with-table-v1', schemaVersion: 1, hostParticipantId: secrets.participantId, seatCapability: secrets.seatCapability, tableParticipantId: secrets.tableParticipantId, tableCapability: secrets.tableCapability }) }, requestEpoch, sequence);
      if (!startResponse(body, projectionInternal.roomId as string)) throw new Error(PUBLIC_ONLINE_ERROR_V1);
      projectionInternal = Object.freeze({ ...projectionInternal, lifecycle: 'started' }); snapshot = Object.freeze({ ...snapshot, mode: 'started', lifecycle: 'started', error: null }); clearTimer(); publish(null); startBrowsers();
    } catch { if (requestEpoch === epoch && sequence === requestSequence) publish(PUBLIC_ONLINE_ERROR_V1); }
    finally { endBusy('start'); }
  };
  const submitAction = (action: unknown, guided: boolean): void => {
    if (secrets === null || playerClient === null || projectionInternal === null || playerClient.getSnapshot().projection === null) return;
    if (guided && action !== null && typeof action === 'object') {
      const actionKind = (action as RecordValue).kind;
      if (actionKind === 'note-face-down' || actionKind === 'request-life-correction' || actionKind === 'note-commander-damage-correction') return;
    }
    const projection = playerClient.getSnapshot().projection as RecordValue;
    const corePlayerId = own(projection, 'corePlayerId');
    if (typeof corePlayerId !== 'string') return;
    const session: OnlineDisplayPairingSessionV1 = { protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion, roomId: projectionInternal.roomId as string, participantId: secrets.participantId, participantCapability: secrets.seatCapability as never, clientBuildId: BUILD_ID, corePlayerId: corePlayerId as never, personalProjection: projection };
    try {
      const commandId = commandIdentifier();
      const frame = guided ? bindOnlineGuidedCommandActionV1({ session, action, commandId: commandId as never }) : bindPersonalWorkbenchActionV1({ session, action, commandId: action !== null && typeof action === 'object' && (action as RecordValue).kind === 'request-refresh' ? null : commandId });
      if (frame.kind !== 'online-command-envelope-v1') { playerClient.disconnect(); playerClient.connect(); return; }
      const submitted = playerClient.submit({ commandId: frame.commandId, baseRevision: frame.baseRevision, command: frame.command });
      if (!submitted.ok) publish(PUBLIC_ONLINE_ERROR_V1);
    } catch { publish(PUBLIC_ONLINE_ERROR_V1); }
  };
  const controller: PublicOnlineControllerV1 = Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: (listener) => { if (typeof listener !== 'function') return () => undefined; listeners.add(listener); listener(snapshot); return () => { listeners.delete(listener); }; },
    create,
    join,
    refresh: () => refresh(),
    submitDeck,
    toggleReady,
    start,
    copyInvite: async (invite) => { if (!snapshot.invites.includes(invite) || typeof navigator === 'undefined' || !navigator.clipboard) return; try { await navigator.clipboard.writeText(invite); } catch { /* fixed UI error is intentionally omitted for copy failures. */ } },
    submitPersonalAction: (action) => submitAction(action, false),
    submitGuidedAction: (action) => submitAction(action, true),
    disconnect: () => { reset(); snapshot = Object.freeze({ mode: 'entry', roomId: null, participantId: null, isHost: false, lifecycle: null, projection: null, invites: Object.freeze([]), selectedDeckId: '', busy: null, connection: 'offline', player: null, table: null, error: null }); publish(null); },
  });
  return controller;
}
