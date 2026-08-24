import {
  handleOnlineCommandEnvelopeV1,
  handleOnlineVariableCommandEnvelopeV2,
  handleOnlineClientHelloV1,
  validateOnlineCommandEnvelopeV1,
  validateOnlineProtocolStateV1,
  type OnlineVariableProtocolStateV2,
} from '../protocol/index';
import { handleOnlineProjectedSnapshotRequestV1, projectOnlineVariableProtocolV2, projectOnlineVariableProtocolV3 } from '../projection/index';
import { disconnectOnlineRoomParticipantV1 } from '../room/index';
import { ConflictError, OnlineCloudflareRepository } from './persistence';
import { assertNoConfiguredCapabilityFragmentV1 } from './codec';
import {
  ONLINE_CLOUDFLARE_MALFORMED_MESSAGE_WINDOW_MS_V1,
  ONLINE_CLOUDFLARE_MAX_ATTACHED_SOCKETS_V1,
  ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1,
  ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1,
  ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1,
  OnlineCloudflareSecurityError,
  OnlineCloudflareSecurityRepository,
  type OnlineCloudflareSecurityAdmissionV1,
} from './security';
import { genericError, isInvalidRoomPath, isWebSocketUpgrade, jsonResponse, parseRoomPath, readJsonBody, validJsonContentType } from './support';
import {
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
  type OnlineCloudflareRevisionNoticeV1,
  type OnlineCloudflareDurableObjectState,
  type OnlineCloudflareSocketAttachmentV1,
  type OnlineCloudflareSocketRoleV1,
  type OnlineCloudflareWebSocket,
} from './types';
import { emitRuntimeStartFactV1, emitFailureFactV1, emitWebSocketFactV1, isCanonicalVersionIdentifier } from './facts';
import {
  claimOnlineFormingLobbySeatV1,
  authorizeOnlineFormingLobbySeatV1,
  encodeOnlineSharedInviteCodeV3,
  validateOnlineLobbyAdmissionV3,
  ONLINE_FORMING_LOBBY_MAX_DECK_TEXT_BYTES_V1,
  projectOnlineFormingLobbyV1,
  validateOnlineFormingLobbyV1,
  claimOnlineVariableLobbySeatV4,
  type OnlineFormingLobbyV1,
} from '../lobby/index';
import { validateOnlineVariableLobbyV4, projectOnlineVariableLobbyV4 } from '../lobby/index';
import { isOnlineRoomApplicationIdV1, isOnlineRoomSeatCapabilityV1 } from '../room/validationSupport';
import { OnlineDeckScryfallResolverV2 } from './scryfallResolver';
import type { OnlineDeckResolverV2 } from '../deckSubmission/index';
import {
  createAuthenticatedOnlineCloudflareSocketAttachmentV1,
  createOnlineCloudflareRevisionNoticeV1,
  createOnlineCloudflareSocketAttachmentV1,
  createOnlineCloudflareWebSocketErrorV1,
  createOnlineCloudflareWebSocketReadyV1,
  frameKind,
  frameStringField,
  parseOnlineCloudflareWebSocketFrameV1,
  serializeOnlineCloudflareWebSocketValueV1,
  validateOnlineCloudflareSocketAttachmentV1,
  type OnlineCloudflareWebSocketFrameV1,
} from './websocket';

function publicProtocolResponse(value: unknown): Response {
  return jsonResponse(value, 200);
}

function runtimeRandomToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  const cryptoObject = globalThis.crypto;
  if (cryptoObject === undefined || typeof cryptoObject.getRandomValues !== 'function' || typeof btoa !== 'function') throw new Error('Randomness unavailable');
  cryptoObject.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${prefix}_${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}

type OnlinePublicErrorCodeV3 = 'ROOM_NOT_FOUND' | 'ROOM_EXPIRED' | 'INVITE_INVALID' | 'INVITE_ROTATED' | 'ADMISSION_CLOSED' | 'ROOM_FULL' | 'PARTICIPANT_RECOVERABLE' | 'CREDENTIAL_REJECTED' | 'CREDENTIAL_KICKED' | 'HOST_REQUIRED' | 'INVALID_LIFECYCLE' | 'DECK_REQUIRED' | 'DECK_RESOLVING' | 'DECK_NEEDS_ATTENTION' | 'PLAYERS_NOT_READY' | 'CLIENT_UPGRADE_REQUIRED' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE';
type OnlinePublicHttpStatusV3 = 400 | 401 | 403 | 404 | 405 | 409 | 410 | 413 | 426 | 429 | 500 | 503;
const PUBLIC_ERROR_RETRYABLE: Readonly<Record<OnlinePublicErrorCodeV3, boolean>> = Object.freeze({ ROOM_NOT_FOUND: false, ROOM_EXPIRED: false, INVITE_INVALID: false, INVITE_ROTATED: false, ADMISSION_CLOSED: false, ROOM_FULL: false, PARTICIPANT_RECOVERABLE: true, CREDENTIAL_REJECTED: false, CREDENTIAL_KICKED: false, HOST_REQUIRED: false, INVALID_LIFECYCLE: false, DECK_REQUIRED: false, DECK_RESOLVING: true, DECK_NEEDS_ATTENTION: false, PLAYERS_NOT_READY: true, CLIENT_UPGRADE_REQUIRED: false, RATE_LIMITED: true, SERVICE_UNAVAILABLE: true });
function onlinePublicErrorV3(code: OnlinePublicErrorCodeV3, status: OnlinePublicHttpStatusV3): Response {
  let correlationId: string;
  try { correlationId = `correlation_${runtimeRandomToken('id').slice(3)}`; } catch { return genericError(status); }
  return jsonResponse({ kind: 'online-public-error-v3', schemaVersion: 3, code, retryable: PUBLIC_ERROR_RETRYABLE[code], correlationId }, status);
}
function publicErrorCode(error: unknown): OnlinePublicErrorCodeV3 | null {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Seat authorization rejected' || message === 'Invalid seat authorization') return 'CREDENTIAL_REJECTED';
  if (!(message in PUBLIC_ERROR_RETRYABLE)) return null;
  return message as OnlinePublicErrorCodeV3;
}
function publicErrorStatus(code: OnlinePublicErrorCodeV3): OnlinePublicHttpStatusV3 {
  if (code === 'SERVICE_UNAVAILABLE') return 503;
  if (code === 'RATE_LIMITED') return 429;
  if (code === 'CLIENT_UPGRADE_REQUIRED') return 426;
  if (code === 'ROOM_EXPIRED' || code === 'INVITE_ROTATED' || code === 'CREDENTIAL_KICKED') return 410;
  if (code === 'ROOM_NOT_FOUND') return 404;
  if (code === 'INVITE_INVALID') return 404;
  if (code === 'ADMISSION_CLOSED' || code === 'HOST_REQUIRED') return 403;
  if (code === 'ROOM_FULL' || code === 'PARTICIPANT_RECOVERABLE' || code === 'INVALID_LIFECYCLE' || code === 'DECK_REQUIRED' || code === 'DECK_RESOLVING' || code === 'DECK_NEEDS_ATTENTION' || code === 'PLAYERS_NOT_READY') return 409;
  if (code === 'CREDENTIAL_REJECTED') return 401;
  return 400;
}

function websocketPair(): { client: WebSocket; server: OnlineCloudflareWebSocket } {
  const Pair = (globalThis as unknown as { WebSocketPair?: new () => { 0: WebSocket; 1: OnlineCloudflareWebSocket } }).WebSocketPair;
  if (Pair === undefined) throw new Error('WebSocketPair unavailable');
  const pair = new Pair();
  return { client: pair[0], server: pair[1] };
}

function isSocketRole(value: unknown): value is OnlineCloudflareSocketRoleV1 {
  return value === 'player' || value === 'table' || value === 'spectator';
}

function transitionResponseRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function ownDataValue(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function ownDataString(value: Record<string, unknown>, key: string): string | null {
  const result = ownDataValue(value, key);
  return typeof result === 'string' ? result : null;
}

function cloneWithProtocolCapability(frame: OnlineCloudflareWebSocketFrameV1, capability: string): Record<string, unknown> {
  const copy = Object.create(null) as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(frame)) {
    const descriptor = Object.getOwnPropertyDescriptor(frame, key);
    if (descriptor === undefined || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new Error('Hostile frame descriptor');
    copy[key] = descriptor.value;
  }
  copy.participantCapability = capability;
  return copy;
}

function assertNoBearerCollision(value: unknown, capabilities: readonly string[]): void {
  const seen = new Set<object>();
  const visit = (current: unknown, capabilityField: boolean, root: boolean): void => {
    if (typeof current === 'string') {
      if (!capabilityField) assertNoConfiguredCapabilityFragmentV1(current, capabilities);
      return;
    }
    if (current === null || typeof current !== 'object') return;
    if (seen.has(current)) return;
    seen.add(current);
    const isArray = Array.isArray(current);
    const prototype: object | null = Object.getPrototypeOf(current) as object | null;
    if ((!isArray && prototype !== Object.prototype && prototype !== null) || (isArray && prototype !== Array.prototype)) throw new Error('Hostile bearer container');
    if (Object.getOwnPropertySymbols(current).length !== 0) throw new Error('Hostile bearer symbol');
    for (const name of Object.getOwnPropertyNames(current)) {
      if (isArray && name === 'length') continue;
      if (name !== 'participantCapability') assertNoConfiguredCapabilityFragmentV1(name, capabilities);
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new Error('Hostile bearer descriptor');
      visit(descriptor.value, root && name === 'participantCapability', false);
    }
  };
  visit(value, false, true);
}

function capabilityNeedles(snapshot: ReturnType<OnlineCloudflareSecurityRepository['read']>, networkCapability: string, now: number): readonly string[] {
  return Object.freeze([
    networkCapability,
    ...snapshot.grants.flatMap((grant) => [
      grant.currentToken,
      ...grant.retiredCapabilities.filter((retired) => now < retired.expiresAt).map((retired) => retired.token),
      ...(grant.protocolCapability === null ? [] : [grant.protocolCapability]),
    ]),
  ]);
}

function windowIsExhausted(startedAt: number, count: number, now: number, duration: number, limit: number): boolean | null {
  const boundary = startedAt + duration;
  if (!Number.isSafeInteger(boundary) || !Number.isSafeInteger(now) || now < 0) return null;
  return now < boundary && count >= limit;
}

function securityStatus(result: OnlineCloudflareSecurityAdmissionV1): 401 | 403 | 429 | null {
  if (result.ok) return null;
  return result.reason === 'capability' ? 401 : result.reason === 'role' ? 403 : 429;
}

function isExactRecord(value: Record<string, unknown>, expected: readonly string[]): boolean {
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) return false;
    const names = Object.getOwnPropertyNames(value).sort();
    const keys = [...expected].sort();
    return names.length === keys.length && names.every((name, index) => name === keys[index]);
  } catch {
    return false;
  }
}

const LEGACY_UPGRADE_REQUIRED = Object.freeze({
  kind: 'online-forming-lobby-upgrade-required-v1',
  schemaVersion: 1,
  requiredSchemaVersion: 2,
});
const LEGACY_UPGRADE_RESPONSE = Object.freeze({ status: 426 });

const LEGACY_UPGRADE_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'online-forming-lobby-deck-submit-v1': ['kind', 'schemaVersion', 'participantId', 'seatCapability', 'deckId', 'deckText'],
  'online-forming-lobby-ready-v1': ['kind', 'schemaVersion', 'participantId', 'seatCapability', 'ready'],
  'online-forming-lobby-start-v1': ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability'],
  'online-forming-lobby-start-with-table-v1': ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability', 'tableParticipantId', 'tableCapability'],
});

function isValidLegacyUpgradeRequest(body: Record<string, unknown>, kind: string | null, schemaVersion: unknown, lobby: OnlineFormingLobbyV1): boolean {
  if (schemaVersion !== 1 || kind === null) return false;
  if (lobby.lifecycle === 'started') return false;
  const fields = LEGACY_UPGRADE_FIELDS[kind];
  if (fields === undefined || !isExactRecord(body, fields)) return false;
  const applicationIdField = (name: string): boolean => {
    const value = ownDataValue(body, name);
    return typeof value === 'string' && isOnlineRoomApplicationIdV1(value);
  };
  const seatCapabilityField = (name: string): boolean => {
    const value = ownDataValue(body, name);
    return typeof value === 'string' && isOnlineRoomSeatCapabilityV1(value);
  };
  const tableCapabilityField = (name: string): boolean => {
    const value = ownDataValue(body, name);
    return typeof value === 'string' && isOnlineRoomSeatCapabilityV1(value);
  };
  const configuredCapabilities = lobby.seats.flatMap((seat) => [seat.seatCapability, ...(seat.inviteCapability === null ? [] : [seat.inviteCapability])]);
  if (kind === 'online-forming-lobby-deck-submit-v1') {
    const deckId = ownDataValue(body, 'deckId');
    const deckText = ownDataValue(body, 'deckText');
    if (!applicationIdField('participantId') || !seatCapabilityField('seatCapability') || !applicationIdField('deckId') || typeof deckId !== 'string' || typeof deckText !== 'string') return false;
    if (new TextEncoder().encode(deckText).length > ONLINE_FORMING_LOBBY_MAX_DECK_TEXT_BYTES_V1) return false;
    try {
      assertNoConfiguredCapabilityFragmentV1(deckId, configuredCapabilities);
    } catch {
      return false;
    }
    return true;
  }
  if (kind === 'online-forming-lobby-ready-v1') {
    return applicationIdField('participantId') && seatCapabilityField('seatCapability') && typeof ownDataValue(body, 'ready') === 'boolean';
  }
  if (kind === 'online-forming-lobby-start-v1') return applicationIdField('hostParticipantId') && seatCapabilityField('seatCapability');
  const hostParticipantId = ownDataValue(body, 'hostParticipantId');
  const tableParticipantId = ownDataValue(body, 'tableParticipantId');
  const tableCapability = ownDataValue(body, 'tableCapability');
  if (!applicationIdField('hostParticipantId') || !seatCapabilityField('seatCapability') || !applicationIdField('tableParticipantId') || !tableCapabilityField('tableCapability') || typeof hostParticipantId !== 'string' || typeof tableParticipantId !== 'string' || typeof tableCapability !== 'string') return false;
  const occupiedParticipants = [lobby.hostParticipantId, ...lobby.seats.flatMap((seat) => seat.participantId === null ? [] : [seat.participantId])];
  if (tableParticipantId === hostParticipantId || occupiedParticipants.includes(tableParticipantId)) return false;
  if (tableCapability === ownDataValue(body, 'seatCapability') || configuredCapabilities.includes(tableCapability)) return false;
  const allCapabilities = [...configuredCapabilities, tableCapability];
  try {
    for (let index = 0; index < allCapabilities.length; index += 1) {
      const current = allCapabilities[index];
      if (current !== undefined) assertNoConfiguredCapabilityFragmentV1(current, allCapabilities.filter((_, candidateIndex) => candidateIndex !== index));
    }
    assertNoConfiguredCapabilityFragmentV1(tableParticipantId, allCapabilities);
    for (const identifier of [lobby.roomId, lobby.serverBuildId, lobby.hostParticipantId, ...lobby.seats.flatMap((seat) => [seat.participantId, seat.deckId].filter((value): value is string => value !== null))]) {
      assertNoConfiguredCapabilityFragmentV1(identifier, [tableCapability]);
    }
  } catch {
    return false;
  }
  return true;
}

function rejectionStatus(error: unknown): 400 | 401 | 403 | 404 | 405 | 409 | 413 | 429 | 500 {
  if (!(error instanceof OnlineCloudflareSecurityError)) return 500;
  if (error.code === 'INVALID_INPUT') return 400;
  if (error.code === 'CAPABILITY_REJECTED') return 401;
  if (error.code === 'ROLE_NOT_ALLOWED') return 403;
  if (error.code === 'ROTATION_CONFLICT' || error.code === 'CONTROLLER_LEASE_REQUIRED' || error.code === 'CAS_CONFLICT') return 409;
  if (error.code === 'RATE_LIMITED') return 429;
  return 500;
}

function allowedBrowserOrigin(origin: string | null): boolean {
  return origin === null || origin === 'https://makeinu1.github.io' || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173';
}

export class OnlineRoomDurableObject {
  private readonly repository: OnlineCloudflareRepository;
  private readonly security: OnlineCloudflareSecurityRepository;
  private readonly state: OnlineCloudflareDurableObjectState;
  private readonly versionIdentifier: string | null;
  private readonly deckResolver: OnlineDeckResolverV2;
  private lobbyV3WindowStartedAt = 0;
  private lobbyV3MutationCount = 0;

  constructor(state: OnlineCloudflareDurableObjectState, env: import('./types').OnlineCloudflareEnv = {}, deckResolver: OnlineDeckResolverV2 = new OnlineDeckScryfallResolverV2()) {
    this.state = state;
    const version = env.CF_VERSION_METADATA?.id;
    if (version !== undefined && version !== null && !isCanonicalVersionIdentifier(version)) throw new Error('Invalid Cloudflare version metadata');
    this.versionIdentifier = isCanonicalVersionIdentifier(version) ? version : null;
    this.deckResolver = deckResolver;
    this.repository = new OnlineCloudflareRepository(state.storage, false, this.versionIdentifier);
    this.security = new OnlineCloudflareSecurityRepository(state.storage);
    try {
      const changed = this.repository.migrateApplicationSchema();
      const loaded = this.repository.load();
      emitRuntimeStartFactV1(1, changed, loaded !== null, this.versionIdentifier, loaded?.room.roomId ?? state.id.name);
    } catch {
      emitFailureFactV1('migration-failure', 'MIGRATION_FAILED', this.versionIdentifier, state.id.name);
      throw new Error('Durable Object migration failed');
    }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      if (!allowedBrowserOrigin(request.headers.get('origin'))) return genericError(403);
      const pathname = new URL(request.url).pathname;
      const route = parseRoomPath(pathname);
      if (route === null) return genericError(isInvalidRoomPath(pathname) ? 400 : 404);
      if (this.state.id.name !== route.roomId) return genericError(400);
      if (route.action === 'room' && request.method === 'GET') {
        const variableState = this.repository.loadVariableProtocolV2(route.roomId);
        if (variableState !== null) return jsonResponse({ kind: 'online-cloudflare-room-status-v2', schemaVersion: 2, roomId: route.roomId, playerCount: variableState.configuration.playerCount, startingLife: variableState.configuration.startingLife, revision: variableState.revision, roomLifecycle: variableState.room.lifecycle });
        const status = this.repository.secureStatus();
        return status === null ? genericError(404) : jsonResponse(status);
      }
      if (route.action === 'room' && request.method === 'PUT') {
        if (!validJsonContentType(request)) return genericError(400);
        const body = await readJsonBody(request);
        if (body === null) return genericError(400);
        const fields = Object.keys(body);
        if (
          fields.length !== 3 ||
          !Object.prototype.hasOwnProperty.call(body, 'kind') ||
          !Object.prototype.hasOwnProperty.call(body, 'schemaVersion') ||
          !Object.prototype.hasOwnProperty.call(body, 'state') ||
          body.kind !== 'online-cloudflare-room-initialize-v1' ||
          body.schemaVersion !== ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1
        ) return genericError(400);
        const validation = validateOnlineProtocolStateV1(body.state);
        if (
          !validation.ok ||
          validation.value.room.roomId !== route.roomId ||
          validation.value.revision !== 0 ||
          validation.value.coreRoot.acceptedCommandCount !== 0 ||
          validation.value.receipts.length !== 0
        ) return genericError(400);
        try {
          return jsonResponse(this.repository.initialize(route.roomId, validation.value, this.now()));
        } catch (error: unknown) {
          return genericError(error instanceof ConflictError ? 409 : rejectionStatus(error));
        }
      }
      if (route.action === 'lobby' && request.method === 'GET') {
        const variableLobby = this.repository.loadVariableLobbyV4(route.roomId);
        if (variableLobby !== null) return jsonResponse(this.repository.projectVariableLobbyV4(route.roomId, variableLobby));
        const lobby = this.repository.loadLobby(route.roomId);
        if (lobby === null) return genericError(404);
        return new URL(request.url).searchParams.get('schemaVersion') === '2'
          ? jsonResponse(this.repository.projectLobbyV2(route.roomId, lobby))
          : jsonResponse(projectOnlineFormingLobbyV1(lobby));
      }
      if (route.action === 'lobby' && request.method === 'POST') {
        if (!validJsonContentType(request)) return genericError(400);
        const body = await readJsonBody(request);
        if (body === null) return genericError(400);
        const kind = ownDataString(body, 'kind');
        const schemaVersion = ownDataValue(body, 'schemaVersion');
        if (kind === 'online-forming-lobby-initialize-v1') {
          if (!isExactRecord(body, ['kind', 'schemaVersion', 'lobby'])) return genericError(400);
          if (schemaVersion !== 1) return genericError(400);
          const checked = validateOnlineFormingLobbyV1(ownDataValue(body, 'lobby'));
          if (!checked.ok || checked.value.roomId !== route.roomId) return genericError(400);
          try {
            this.repository.initializeLobby(checked.value);
            return jsonResponse({ kind: 'online-forming-lobby-created-v1', schemaVersion: 1, roomId: checked.value.roomId, projection: projectOnlineFormingLobbyV1(checked.value) });
          } catch (error: unknown) {
            return genericError(error instanceof ConflictError ? 409 : 400);
          }
        }
        if (kind === 'online-forming-lobby-initialize-v3') {
          if (!isExactRecord(body, ['kind', 'schemaVersion', 'lobby', 'admission', 'tableParticipantId', 'tableCapability']) || schemaVersion !== 3) return genericError(400);
          const checkedLobby = validateOnlineFormingLobbyV1(ownDataValue(body, 'lobby'));
          const checkedAdmission = validateOnlineLobbyAdmissionV3(ownDataValue(body, 'admission'));
          const tableParticipantId = ownDataString(body, 'tableParticipantId');
          const tableCapability = ownDataString(body, 'tableCapability');
          if (!checkedLobby.ok || !checkedAdmission.ok || checkedLobby.value.roomId !== route.roomId || checkedAdmission.value.roomId !== route.roomId || tableParticipantId === null || tableCapability === null) return genericError(400);
          try {
            this.repository.initializeLobbyV3(checkedLobby.value, checkedAdmission.value, tableParticipantId, tableCapability);
            return jsonResponse({ kind: 'online-forming-lobby-created-v3', schemaVersion: 3, roomId: route.roomId, projection: this.repository.projectLobbyV2(route.roomId, checkedLobby.value) });
          } catch (error: unknown) { return genericError(error instanceof ConflictError ? 409 : 400); }
        }
        if (kind === 'online-forming-lobby-initialize-v4') {
          if (!isExactRecord(body, ['kind', 'schemaVersion', 'lobby']) || schemaVersion !== 4) return genericError(400);
          const checked = validateOnlineVariableLobbyV4(ownDataValue(body, 'lobby'));
          if (!checked.ok || checked.value.roomId !== route.roomId) return genericError(400);
          try {
            this.repository.initializeVariableLobbyV4(checked.value);
            return jsonResponse({ kind: 'online-forming-lobby-created-v4', schemaVersion: 4, roomId: checked.value.roomId, projection: projectOnlineVariableLobbyV4(checked.value) });
          } catch (error: unknown) { return genericError(error instanceof ConflictError ? 409 : 400); }
        }
        const variableLobby = this.repository.loadVariableLobbyV4(route.roomId);
        if (variableLobby !== null) {
          try {
            const startedVariable = this.repository.loadVariableProtocolV2(route.roomId);
            if (startedVariable !== null && kind !== 'online-forming-lobby-recover-v5') throw new Error('INVALID_LIFECYCLE');
            if ((kind === 'online-forming-lobby-shared-claim-v4' || kind === 'online-forming-lobby-shared-claim-v3') && isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'admissionCapability']) && body.schemaVersion === (kind === 'online-forming-lobby-shared-claim-v4' ? 4 : 3) && typeof body.participantId === 'string' && typeof body.admissionCapability === 'string') {
              const claimed = claimOnlineVariableLobbySeatV4(variableLobby, body.participantId, body.admissionCapability); this.repository.persistVariableLobbyV4(variableLobby, claimed.lobby);
              return jsonResponse({ kind: kind.endsWith('-v3') ? 'online-forming-lobby-shared-claimed-v3' : 'online-forming-lobby-shared-claimed-v4', schemaVersion: kind.endsWith('-v3') ? 3 : 4, roomId: route.roomId, participantId: body.participantId, seatCapability: claimed.seatCapability, projection: projectOnlineVariableLobbyV4(claimed.lobby) });
            }
            if (kind === 'online-forming-lobby-recover-v5' && isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'seatCapability']) && body.schemaVersion === 5 && typeof body.participantId === 'string' && typeof body.seatCapability === 'string') {
              const seat = variableLobby.seats.find((candidate) => candidate.participantId === body.participantId && candidate.seatCapability === body.seatCapability); if (seat === undefined) throw new Error('CREDENTIAL_KICKED'); const isHost = body.participantId === variableLobby.hostParticipantId;
              return jsonResponse({ kind: 'online-forming-lobby-recovered-v5', schemaVersion: 5, roomId: route.roomId, participantId: body.participantId, playerCount: variableLobby.configuration.playerCount, startingLife: variableLobby.configuration.startingLife, ...(isHost ? { admissionOpen: variableLobby.admissionOpen, inviteCode: encodeOnlineSharedInviteCodeV3(route.roomId, variableLobby.admissionCapability), tableParticipantId: variableLobby.tableParticipantId, tableCapability: variableLobby.tableCapability } : {}), projection: projectOnlineVariableLobbyV4(variableLobby) });
            }
            if (kind === 'online-forming-lobby-admission-rotate-v3' && isExactRecord(body, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability']) && schemaVersion === 3 && typeof body.hostParticipantId === 'string' && typeof body.seatCapability === 'string') { const rotated = this.repository.rotateVariableLobbyV4(route.roomId, body.hostParticipantId, body.seatCapability, runtimeRandomToken('admission')); return jsonResponse({ kind: 'online-forming-lobby-admission-rotated-v3', schemaVersion: 3, roomId: route.roomId, inviteCode: encodeOnlineSharedInviteCodeV3(route.roomId, rotated.admissionCapability), projection: rotated.projection }); }
            if (kind === 'online-forming-lobby-admission-close-v3' && isExactRecord(body, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability']) && schemaVersion === 3 && typeof body.hostParticipantId === 'string' && typeof body.seatCapability === 'string') return jsonResponse({ kind: 'online-forming-lobby-admission-closed-v3', schemaVersion: 3, roomId: route.roomId, projection: this.repository.closeVariableLobbyV4(route.roomId, body.hostParticipantId, body.seatCapability) });
            if (kind === 'online-forming-lobby-kick-v3' && isExactRecord(body, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability', 'targetParticipantId']) && schemaVersion === 3 && typeof body.hostParticipantId === 'string' && typeof body.seatCapability === 'string' && typeof body.targetParticipantId === 'string') return jsonResponse({ kind: 'online-forming-lobby-kicked-v3', schemaVersion: 3, roomId: route.roomId, projection: this.repository.kickVariableLobbySeatV4(route.roomId, body.hostParticipantId, body.seatCapability, body.targetParticipantId, runtimeRandomToken('seat'), runtimeRandomToken('admission')) });
            if (kind === 'online-forming-lobby-leave-v3' && isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'seatCapability']) && schemaVersion === 3 && typeof body.participantId === 'string' && typeof body.seatCapability === 'string') {
              const target = variableLobby.seats.find((candidate) => candidate.participantId === body.participantId && candidate.seatCapability === body.seatCapability); if (target === undefined) throw new Error('CREDENTIAL_KICKED'); if (target.seatIndex === 0) { this.repository.deleteVariableLobbyV4(route.roomId); return jsonResponse({ kind: 'online-forming-lobby-left-v3', schemaVersion: 3, roomId: route.roomId, closed: true }); }
              return jsonResponse({ kind: 'online-forming-lobby-left-v3', schemaVersion: 3, roomId: route.roomId, projection: this.repository.leaveVariableLobbySeatV4(route.roomId, body.participantId, body.seatCapability, runtimeRandomToken('seat'), runtimeRandomToken('admission')) });
            }
            if (kind === 'online-forming-lobby-deck-submit-v2') return jsonResponse(await this.repository.submitVariableDeckV2(route.roomId, body, this.deckResolver));
            if (kind === 'online-forming-lobby-ready-v4' && isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'seatCapability', 'ready']) && body.schemaVersion === 4 && typeof body.participantId === 'string' && typeof body.seatCapability === 'string' && typeof body.ready === 'boolean') return jsonResponse({ kind, schemaVersion: 4, roomId: route.roomId, projection: this.repository.setVariableReadyV4(route.roomId, body.participantId, body.seatCapability, body.ready) });
            if (kind === 'online-forming-lobby-ready-v2' && isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'seatCapability', 'ready']) && body.schemaVersion === 2 && typeof body.participantId === 'string' && typeof body.seatCapability === 'string' && typeof body.ready === 'boolean') return jsonResponse({ kind, schemaVersion: 2, roomId: route.roomId, projection: this.repository.setVariableReadyV4(route.roomId, body.participantId, body.seatCapability, body.ready) });
            if (kind === 'online-forming-lobby-start-v4' && isExactRecord(body, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability']) && body.schemaVersion === 4 && typeof body.hostParticipantId === 'string' && typeof body.seatCapability === 'string') return jsonResponse(this.repository.startVariableV4(route.roomId, body.hostParticipantId, body.seatCapability));
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '';
            const code = message === 'Room is full' ? 'ROOM_FULL' : message === 'Invite rejected' ? 'INVITE_INVALID' : message === 'HOST_REQUIRED' ? 'HOST_REQUIRED' : message === 'CREDENTIAL_KICKED' ? 'CREDENTIAL_KICKED' : message === 'ADMISSION_CLOSED' ? 'ADMISSION_CLOSED' : message === 'INVALID_LIFECYCLE' ? 'INVALID_LIFECYCLE' : message === 'PLAYERS_NOT_READY' ? 'PLAYERS_NOT_READY' : message === 'Accepted v2 deck required before ready' || message === 'Accepted snapshot relation invalid' ? 'DECK_REQUIRED' : message === 'ROOM_NOT_FOUND' ? 'ROOM_NOT_FOUND' : null;
            if (code !== null) return onlinePublicErrorV3(code, publicErrorStatus(code));
            return genericError(error instanceof ConflictError ? 409 : 400);
          }
          return genericError(400);
        }
        const lobby = this.repository.loadLobby(route.roomId);
        const isRecoverV4 = kind === 'online-forming-lobby-recover-v4' && schemaVersion === 4;
        const isRecognizedV3Kind = kind === 'online-forming-lobby-shared-claim-v3' || kind === 'online-forming-lobby-recover-v3' || kind === 'online-forming-lobby-admission-rotate-v3' || kind === 'online-forming-lobby-admission-close-v3' || kind === 'online-forming-lobby-kick-v3' || kind === 'online-forming-lobby-leave-v3';
        if (lobby === null) return (isRecognizedV3Kind && schemaVersion === 3) || isRecoverV4 ? onlinePublicErrorV3('ROOM_NOT_FOUND', 404) : genericError(404);
        if (kind?.endsWith('-v3') === true || schemaVersion === 3 || isRecoverV4) {
          const recognized = kind === 'online-forming-lobby-shared-claim-v3' || kind === 'online-forming-lobby-recover-v3' || kind === 'online-forming-lobby-recover-v4' || kind === 'online-forming-lobby-admission-rotate-v3' || kind === 'online-forming-lobby-admission-close-v3' || kind === 'online-forming-lobby-kick-v3' || kind === 'online-forming-lobby-leave-v3';
          if (!recognized) return genericError(400);
          try {
            const admission = this.repository.loadAdmissionV3(route.roomId);
            if (admission === null) throw new Error('ROOM_NOT_FOUND');
            const roomLifecycle = this.repository.load()?.room.lifecycle;
            if (kind === 'online-forming-lobby-shared-claim-v3') {
              if (!isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'admissionCapability']) || schemaVersion !== 3) return genericError(400);
              const participantId = ownDataString(body, 'participantId'); const admissionCapability = ownDataString(body, 'admissionCapability');
              if (participantId === null || admissionCapability === null || !isOnlineRoomApplicationIdV1(participantId) || !isOnlineRoomSeatCapabilityV1(admissionCapability)) return genericError(400);
              this.consumeLobbyV3Mutation();
              if (roomLifecycle === 'finished') throw new Error('ROOM_EXPIRED');
              if (roomLifecycle === 'started' || roomLifecycle === 'active' || lobby.lifecycle === 'started') throw new Error('INVALID_LIFECYCLE');
              const result = this.repository.claimLobbyAdmissionV3(route.roomId, { participantId, admissionCapability });
              return jsonResponse({ kind: 'online-forming-lobby-shared-claimed-v3', schemaVersion: 3, roomId: route.roomId, participantId, seatCapability: result.seatCapability, projection: this.repository.projectLobbyV2(route.roomId, result.lobby) });
            }
            if (kind === 'online-forming-lobby-recover-v3' || kind === 'online-forming-lobby-recover-v4') {
              const recoveryVersion = kind === 'online-forming-lobby-recover-v4' ? 4 : 3;
              if (!isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'seatCapability']) || schemaVersion !== recoveryVersion) return genericError(400);
              const participantId = ownDataString(body, 'participantId'); const seatCapability = ownDataString(body, 'seatCapability');
              if (participantId === null || seatCapability === null || !isOnlineRoomApplicationIdV1(participantId) || !isOnlineRoomSeatCapabilityV1(seatCapability)) return genericError(400);
              this.consumeLobbyV3Mutation();
              if (roomLifecycle === 'finished') throw new Error('ROOM_EXPIRED');
              if (this.repository.isRevokedCredentialV3(route.roomId, participantId, seatCapability)) throw new Error('CREDENTIAL_KICKED');
              const seatIndex = authorizeOnlineFormingLobbySeatV1(lobby, participantId, seatCapability);
              const isHost = seatIndex === 0;
              const table = this.repository.tableCredentialsV3(route.roomId);
              if (isHost && (table === null || !isOnlineRoomApplicationIdV1(table.participantId) || !isOnlineRoomSeatCapabilityV1(table.capability))) throw new Error('SERVICE_UNAVAILABLE');
              return jsonResponse({ kind: recoveryVersion === 4 ? 'online-forming-lobby-recovered-v4' : 'online-forming-lobby-recovered-v3', schemaVersion: recoveryVersion, roomId: route.roomId, participantId, seatCapability, ...(isHost ? { ...(recoveryVersion === 4 ? { admissionOpen: admission.open } : {}), inviteCode: encodeOnlineSharedInviteCodeV3(route.roomId, admission.currentCapability), tableParticipantId: table?.participantId ?? null, tableCapability: table?.capability ?? null } : {}), projection: this.repository.projectLobbyV2(route.roomId, lobby) });
            }
            if (kind === 'online-forming-lobby-admission-rotate-v3') {
              if (!isExactRecord(body, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability']) || schemaVersion !== 3) return genericError(400);
              const hostParticipantId = ownDataString(body, 'hostParticipantId'); const seatCapability = ownDataString(body, 'seatCapability');
              if (hostParticipantId === null || seatCapability === null || !isOnlineRoomApplicationIdV1(hostParticipantId) || !isOnlineRoomSeatCapabilityV1(seatCapability)) return genericError(400);
              this.consumeLobbyV3Mutation();
              if (roomLifecycle === 'finished') throw new Error('ROOM_EXPIRED');
              if (roomLifecycle === 'started' || roomLifecycle === 'active' || lobby.lifecycle === 'started') throw new Error('INVALID_LIFECYCLE');
              const next = this.repository.rotateLobbyAdmissionV3(route.roomId, { hostParticipantId, seatCapability, nextCapability: runtimeRandomToken('admission') });
              return jsonResponse({ kind: 'online-forming-lobby-admission-rotated-v3', schemaVersion: 3, roomId: route.roomId, inviteCode: encodeOnlineSharedInviteCodeV3(route.roomId, next.currentCapability), projection: this.repository.projectLobbyV2(route.roomId, lobby) });
            }
            if (kind === 'online-forming-lobby-admission-close-v3') {
              if (!isExactRecord(body, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability']) || schemaVersion !== 3) return genericError(400);
              const hostParticipantId = ownDataString(body, 'hostParticipantId'); const seatCapability = ownDataString(body, 'seatCapability');
              if (hostParticipantId === null || seatCapability === null || !isOnlineRoomApplicationIdV1(hostParticipantId) || !isOnlineRoomSeatCapabilityV1(seatCapability)) return genericError(400);
              this.consumeLobbyV3Mutation();
              if (roomLifecycle === 'finished') throw new Error('ROOM_EXPIRED');
              if (roomLifecycle === 'started' || roomLifecycle === 'active' || lobby.lifecycle === 'started') throw new Error('INVALID_LIFECYCLE');
              this.repository.closeLobbyAdmissionV3(route.roomId, { hostParticipantId, seatCapability });
              return jsonResponse({ kind: 'online-forming-lobby-admission-closed-v3', schemaVersion: 3, roomId: route.roomId, projection: this.repository.projectLobbyV2(route.roomId, lobby) });
            }
            if (kind === 'online-forming-lobby-kick-v3') {
              if (!isExactRecord(body, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability', 'targetParticipantId']) || schemaVersion !== 3) return genericError(400);
              const hostParticipantId = ownDataString(body, 'hostParticipantId'); const seatCapability = ownDataString(body, 'seatCapability'); const targetParticipantId = ownDataString(body, 'targetParticipantId');
              if (hostParticipantId === null || seatCapability === null || targetParticipantId === null || !isOnlineRoomApplicationIdV1(hostParticipantId) || !isOnlineRoomSeatCapabilityV1(seatCapability) || !isOnlineRoomApplicationIdV1(targetParticipantId)) return genericError(400);
              this.consumeLobbyV3Mutation();
              if (roomLifecycle === 'finished') throw new Error('ROOM_EXPIRED');
              if (roomLifecycle === 'started' || roomLifecycle === 'active' || lobby.lifecycle === 'started') throw new Error('INVALID_LIFECYCLE');
              let hostSeat: number;
              try { hostSeat = authorizeOnlineFormingLobbySeatV1(lobby, hostParticipantId, seatCapability); } catch { throw new Error('HOST_REQUIRED'); }
              if (hostSeat !== 0) throw new Error('HOST_REQUIRED');
              const result = this.repository.replaceLobbySeatV3(route.roomId, targetParticipantId, runtimeRandomToken('seat'), runtimeRandomToken('invite'), true);
              return jsonResponse({ kind: 'online-forming-lobby-kicked-v3', schemaVersion: 3, roomId: route.roomId, projection: this.repository.projectLobbyV2(route.roomId, result.lobby) });
            }
            if (kind === 'online-forming-lobby-leave-v3') {
              if (!isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'seatCapability']) || schemaVersion !== 3) return genericError(400);
              const participantId = ownDataString(body, 'participantId'); const seatCapability = ownDataString(body, 'seatCapability');
              if (participantId === null || seatCapability === null || !isOnlineRoomApplicationIdV1(participantId) || !isOnlineRoomSeatCapabilityV1(seatCapability)) return genericError(400);
              this.consumeLobbyV3Mutation();
              if (roomLifecycle === 'finished') throw new Error('ROOM_EXPIRED');
              if (roomLifecycle === 'started' || roomLifecycle === 'active' || lobby.lifecycle === 'started') throw new Error('INVALID_LIFECYCLE');
              const seatIndex = authorizeOnlineFormingLobbySeatV1(lobby, participantId, seatCapability);
              if (seatIndex === 0) { this.repository.deleteFormingLobbyV3(route.roomId); return jsonResponse({ kind: 'online-forming-lobby-left-v3', schemaVersion: 3, roomId: route.roomId, closed: true }); }
              const result = this.repository.replaceLobbySeatV3(route.roomId, participantId, runtimeRandomToken('seat'), runtimeRandomToken('invite'), false);
              return jsonResponse({ kind: 'online-forming-lobby-left-v3', schemaVersion: 3, roomId: route.roomId, projection: this.repository.projectLobbyV2(route.roomId, result.lobby) });
            }
          } catch (error: unknown) {
            const code = publicErrorCode(error);
            if (code !== null) return onlinePublicErrorV3(code, publicErrorStatus(code));
            return onlinePublicErrorV3('SERVICE_UNAVAILABLE', 503);
          }
        }
        const roomLifecycle = this.repository.load()?.room.lifecycle;
        if ((roomLifecycle === 'started' || roomLifecycle === 'active' || roomLifecycle === 'finished') && (kind === 'online-forming-lobby-seat-claim-v1' || kind === 'online-forming-lobby-deck-submit-v1' || kind === 'online-forming-lobby-ready-v1' || kind === 'online-forming-lobby-start-v1' || kind === 'online-forming-lobby-start-with-table-v1')) return genericError(400);
        if (isValidLegacyUpgradeRequest(body, kind, schemaVersion, lobby)) return jsonResponse(LEGACY_UPGRADE_REQUIRED, LEGACY_UPGRADE_RESPONSE.status);
        try {
          if (kind === 'online-forming-lobby-deck-submit-v2' && isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'seatCapability', 'deckId', 'submissionId', 'entries']) && schemaVersion === 2) {
            const result = await this.repository.submitDeckV2(route.roomId, body, this.deckResolver);
            return jsonResponse(result);
          }
          if (kind === 'online-forming-lobby-ready-v2' && isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'seatCapability', 'ready']) && schemaVersion === 2) {
            const ready = ownDataValue(body, 'ready');
            const participantId = ownDataString(body, 'participantId');
            const seatCapability = ownDataString(body, 'seatCapability');
            if (typeof ready !== 'boolean' || participantId === null || seatCapability === null) return genericError(400);
            if (roomLifecycle === 'finished') return onlinePublicErrorV3('ROOM_EXPIRED', 410);
            if (roomLifecycle === 'started' || roomLifecycle === 'active' || lobby.lifecycle === 'started') return onlinePublicErrorV3('INVALID_LIFECYCLE', 409);
            let seatIndex: number;
            try { seatIndex = authorizeOnlineFormingLobbySeatV1(lobby, participantId, seatCapability); } catch { return onlinePublicErrorV3('CREDENTIAL_REJECTED', 401); }
            const current = this.repository.projectLobbyV2(route.roomId, lobby).seats[seatIndex];
            if (current === undefined || current.deckState === 'none') return onlinePublicErrorV3('DECK_REQUIRED', 409);
            if (current.deckState === 'resolving') return onlinePublicErrorV3('DECK_RESOLVING', 409);
            if (current.deckState === 'needs-attention') return onlinePublicErrorV3('DECK_NEEDS_ATTENTION', 409);
            const projection = this.repository.setReadyV2(route.roomId, participantId, seatCapability, ready);
            return jsonResponse({ kind: 'online-forming-lobby-ready-v2', schemaVersion: 2, roomId: route.roomId, projection });
          }
          if (kind === 'online-forming-lobby-start-with-table-v2' && isExactRecord(body, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability', 'tableParticipantId', 'tableCapability']) && schemaVersion === 2) {
            const hostParticipantId = ownDataString(body, 'hostParticipantId');
            const seatCapability = ownDataString(body, 'seatCapability');
            const tableParticipantId = ownDataString(body, 'tableParticipantId');
            const tableCapability = ownDataString(body, 'tableCapability');
            if (hostParticipantId === null || seatCapability === null || tableParticipantId === null || tableCapability === null) return genericError(400);
            if (roomLifecycle === 'finished') return onlinePublicErrorV3('ROOM_EXPIRED', 410);
            if (roomLifecycle === 'started' || roomLifecycle === 'active' || lobby.lifecycle === 'started') return onlinePublicErrorV3('INVALID_LIFECYCLE', 409);
            let hostSeat: number;
            try { hostSeat = authorizeOnlineFormingLobbySeatV1(lobby, hostParticipantId, seatCapability); } catch { return onlinePublicErrorV3('HOST_REQUIRED', 403); }
            if (hostSeat !== 0 || hostParticipantId !== lobby.hostParticipantId) return onlinePublicErrorV3('HOST_REQUIRED', 403);
            const current = this.repository.projectLobbyV2(route.roomId, lobby);
            if (current.lifecycle === 'started') return onlinePublicErrorV3('INVALID_LIFECYCLE', 409);
            if (current.seats.some((seat) => seat.deckState === 'resolving')) return onlinePublicErrorV3('DECK_RESOLVING', 409);
            if (current.seats.some((seat) => seat.deckState === 'needs-attention')) return onlinePublicErrorV3('DECK_NEEDS_ATTENTION', 409);
            if (current.seats.some((seat) => seat.participantId === null || seat.deckState === 'none')) return onlinePublicErrorV3('DECK_REQUIRED', 409);
            if (current.seats.some((seat) => !seat.ready)) return onlinePublicErrorV3('PLAYERS_NOT_READY', 409);
            return jsonResponse(this.repository.startWithTableV2(route.roomId, { hostParticipantId, seatCapability, tableParticipantId, tableCapability }));
          }
          if (kind === 'online-forming-lobby-seat-claim-v1' && isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'inviteCapability']) && schemaVersion === 1) {
            const transitioned = claimOnlineFormingLobbySeatV1(lobby, { participantId: ownDataString(body, 'participantId') ?? '', inviteCapability: ownDataString(body, 'inviteCapability') ?? '' });
            this.repository.persistLobby(lobby, transitioned.lobby);
            return jsonResponse({ kind: 'online-forming-lobby-seat-claimed-v1', schemaVersion: 1, roomId: route.roomId, seatCapability: transitioned.seatCapability, projection: projectOnlineFormingLobbyV1(transitioned.lobby) });
          }
        } catch (error: unknown) {
          return genericError(error instanceof ConflictError ? 409 : 400);
        }
        return genericError(400);
      }
      if (route.action === 'capabilities' && request.method === 'POST') {
        if (!validJsonContentType(request)) return genericError(400);
        const body = await readJsonBody(request);
        if (body === null || !isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'currentCapability', 'nextCapability'])) return genericError(400);
        const participantId = ownDataString(body, 'participantId');
        const currentCapability = ownDataString(body, 'currentCapability');
        const nextCapability = ownDataString(body, 'nextCapability');
        if (body.kind !== 'online-cloudflare-capability-rotate-v1' || body.schemaVersion !== 1 || participantId === null || currentCapability === null || nextCapability === null) return genericError(400);
        const state = this.repository.load() ?? this.repository.loadVariableProtocolV2(route.roomId);
        if (state === null) return genericError(404);
        try {
          const response = this.security.rotate(state, participantId, currentCapability, nextCapability, this.now());
          return jsonResponse(response);
        } catch (error: unknown) {
          return genericError(rejectionStatus(error));
        }
      }
      if (route.action === 'commands' && request.method === 'POST') {
        if (!validJsonContentType(request)) return genericError(400);
        const body = await readJsonBody(request);
        if (body === null) return genericError(400);
        const roomId = ownDataString(body, 'roomId');
        const participantId = ownDataString(body, 'participantId');
        const networkCapability = ownDataString(body, 'participantCapability');
        if (roomId !== null && roomId !== route.roomId) return genericError(400);
        if (participantId === null || networkCapability === null) return genericError(400);
        const legacyState = this.repository.load();
        const state = legacyState ?? this.repository.loadVariableProtocolV2(route.roomId);
        if (state === null) return genericError(404);
        const now = this.now();
        const admission = this.security.consumeHttpAction(state, participantId, networkCapability, 'command', now);
        const status = securityStatus(admission);
        if (status !== null) return genericError(status);
        if (!admission.ok) return genericError(500);
        try {
          assertNoBearerCollision(body, capabilityNeedles(this.security.read(state), networkCapability, now));
        } catch {
          return genericError(401);
        }
        const internalMessage = cloneWithProtocolCapability(body, admission.authorization.protocolCapability);
        const validation = validateOnlineCommandEnvelopeV1(internalMessage);
        if (validation.ok) {
          const acquired = this.security.acquireControllerLease(
            state,
            participantId,
            admission.authorization.generation,
            { kind: 'http', connectionId: null },
            now,
          );
          if (!acquired) return genericError(409);
        }
        const transition = state.kind === 'online-protocol-state-v2'
          ? handleOnlineVariableCommandEnvelopeV2(state, internalMessage)
          : handleOnlineCommandEnvelopeV1(state, internalMessage);
        if (validation.ok && transition.response.kind === 'online-command-ack-v1' && !transition.response.duplicate) {
          if (state.kind === 'online-protocol-state-v2') this.repository.commitVariableAcceptedV2(state, transition.state as OnlineVariableProtocolStateV2, validation.value);
          else this.repository.commitAccepted(transition.state as typeof state, validation.value);
        }
        return publicProtocolResponse(transition.response);
      }
      if (route.action === 'websocket' && request.method === 'GET') {
        if (!isWebSocketUpgrade(request) || request.body !== null) return genericError(400);
        const state = this.repository.load() ?? this.repository.loadVariableProtocolV2(route.roomId);
        if (state === null) return genericError(404);
        this.security.read(state);
        let sockets: readonly OnlineCloudflareWebSocket[];
        try {
          sockets = this.state.getWebSockets();
        } catch {
          return genericError(500);
        }
        if (sockets.length >= ONLINE_CLOUDFLARE_MAX_ATTACHED_SOCKETS_V1) return genericError(429);
        const now = this.now();
        const connectionId = this.security.allocateConnectionId(state, now);
        const pair = websocketPair();
        const attachment = createOnlineCloudflareSocketAttachmentV1(route.roomId, connectionId, now);
        pair.server.serializeAttachment(attachment);
        this.state.acceptWebSocket(pair.server);
        pair.server.send(JSON.stringify(createOnlineCloudflareWebSocketReadyV1(route.roomId, state.revision)));
        emitWebSocketFactV1('accepted', null, 'ok', this.versionIdentifier, route.roomId);
        return new Response(null, { status: 101, webSocket: pair.client } as unknown as ResponseInit);
      }
      return genericError(405);
    } catch (error: unknown) {
      return genericError(rejectionStatus(error));
    }
  }

  webSocketMessage(socket: OnlineCloudflareWebSocket, message: unknown): void {
    const attachment = this.attachment(socket);
    if (attachment === null) {
      this.sendError(socket, 'INTERNAL_ERROR');
      return;
    }
    const now = this.now();
    const messageExhausted = windowIsExhausted(attachment.messageWindowStartedAt, attachment.messageCount, now, ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1, ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1);
    const malformedExhausted = windowIsExhausted(attachment.malformedWindowStartedAt, attachment.malformedCount, now, ONLINE_CLOUDFLARE_MALFORMED_MESSAGE_WINDOW_MS_V1, ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1);
    if (messageExhausted === null || malformedExhausted === null) {
      this.sendError(socket, 'INTERNAL_ERROR');
      return;
    }
    if (messageExhausted || malformedExhausted) {
      try {
        const securitySnapshot = this.security.readSecuritySnapshot();
        this.security.validateClockFromSnapshot(securitySnapshot, now);
        this.security.recordRateRejectionFromSnapshot(
          attachment.participantId,
          attachment.connectionId,
          now,
          messageExhausted ? 'RATE_REJECTED' : 'MALFORMED_THRESHOLD',
        );
      } catch {
        this.sendError(socket, 'INTERNAL_ERROR');
        return;
      }
      this.sendError(socket, 'RATE_LIMITED');
      return;
    }
    let state: Exclude<ReturnType<OnlineCloudflareRepository['load']>, null> | OnlineVariableProtocolStateV2;
    let securitySnapshot: ReturnType<OnlineCloudflareSecurityRepository['read']>;
    try {
      const loaded = this.repository.load() ?? this.repository.loadVariableProtocolV2(attachment.roomId);
      if (loaded === null) throw new Error('Missing protocol state');
      state = loaded;
      securitySnapshot = this.security.read(loaded);
      this.security.validateClockFromSnapshot(securitySnapshot, now);
    } catch {
      this.sendError(socket, 'INTERNAL_ERROR');
      return;
    }
    const counted = this.countMessage(socket, attachment, now);
    if (counted === null || counted.rateLimited) {
      if (counted?.rateLimited) this.sendError(socket, 'RATE_LIMITED');
      else this.sendError(socket, 'INTERNAL_ERROR');
      return;
    }
    const parsed = parseOnlineCloudflareWebSocketFrameV1(message);
    if (!parsed.ok) {
      this.malformedMessage(socket, counted.attachment, now);
      return;
    }
    const frame = parsed.value;
    const kind = frameKind(frame);
    if (kind !== 'online-client-hello-v1' && kind !== 'online-projection-request-v1' && kind !== 'online-command-envelope-v1') {
      this.malformedMessage(socket, counted.attachment, now);
      return;
    }
    const currentAttachment = counted.attachment;
    if (!currentAttachment.authenticated && kind !== 'online-client-hello-v1') {
      this.sendError(socket, 'AUTHENTICATION_REQUIRED');
      return;
    }
    const participantId = frameStringField(frame, 'participantId');
    const networkCapability = frameStringField(frame, 'participantCapability');
    if (participantId === null || networkCapability === null) {
      this.sendError(socket, 'CAPABILITY_REJECTED');
      return;
    }
    if (currentAttachment.authenticated && (participantId !== currentAttachment.participantId || frameStringField(frame, 'roomId') !== currentAttachment.roomId)) {
      this.sendError(socket, 'IDENTITY_MISMATCH');
      return;
    }
    try {
      const action = kind === 'online-client-hello-v1' ? 'hello' : kind === 'online-projection-request-v1' ? 'projected-snapshot' : 'command';
      const admission = this.security.authorizeSocket(state, participantId, networkCapability, action, currentAttachment.capabilityGeneration, now, currentAttachment.connectionId, securitySnapshot);
      if (!admission.ok) {
        this.sendError(socket, admission.reason === 'role' ? 'ROLE_NOT_ALLOWED' : 'CAPABILITY_REJECTED');
        return;
      }
      try {
        assertNoBearerCollision(frame, capabilityNeedles(securitySnapshot, networkCapability, now));
      } catch {
        this.sendError(socket, 'CAPABILITY_REJECTED');
        return;
      }
      const internalMessage = cloneWithProtocolCapability(frame, admission.authorization.protocolCapability);
      if (state.kind === 'online-protocol-state-v2') {
        if (kind === 'online-client-hello-v1') this.handleVariableHello(socket, internalMessage, currentAttachment, state, admission.authorization);
        else if (kind === 'online-projection-request-v1') this.handleVariableProjection(socket, internalMessage, state);
        else this.handleVariableCommand(socket, internalMessage, state, admission.authorization, now);
      } else if (kind === 'online-client-hello-v1') {
        this.handleHello(socket, internalMessage, currentAttachment, state, admission.authorization);
      } else if (kind === 'online-projection-request-v1') {
        this.handleProjection(socket, internalMessage, state);
      } else {
        this.handleCommand(socket, internalMessage, state, admission.authorization, now);
      }
    } catch {
      this.sendError(socket, 'INTERNAL_ERROR');
    }
  }

  webSocketClose(socket: OnlineCloudflareWebSocket): void {
    const attachment = this.attachment(socket);
    emitWebSocketFactV1('close', attachment?.role ?? null, 'ok', this.versionIdentifier, attachment?.roomId ?? this.state.id.name);
    this.handleDisconnect(socket);
  }

  webSocketError(socket: OnlineCloudflareWebSocket): void {
    const attachment = this.attachment(socket);
    emitWebSocketFactV1('error', attachment?.role ?? null, 'error', this.versionIdentifier, attachment?.roomId ?? this.state.id.name);
  }

  private now(): number {
    try {
      return this.state.now?.() ?? Date.now();
    } catch {
      return Number.NaN;
    }
  }

  private consumeLobbyV3Mutation(): void {
    const now = this.now();
    if (!Number.isFinite(now)) throw new Error('SERVICE_UNAVAILABLE');
    if (this.lobbyV3WindowStartedAt === 0 || now - this.lobbyV3WindowStartedAt >= 60_000) {
      this.lobbyV3WindowStartedAt = now;
      this.lobbyV3MutationCount = 0;
    }
    if (now < this.lobbyV3WindowStartedAt) throw new Error('SERVICE_UNAVAILABLE');
    this.lobbyV3MutationCount += 1;
    if (this.lobbyV3MutationCount > 256) throw new Error('RATE_LIMITED');
  }

  private attachment(socket: OnlineCloudflareWebSocket): OnlineCloudflareSocketAttachmentV1 | null {
    try {
      const result = validateOnlineCloudflareSocketAttachmentV1(socket.deserializeAttachment(), this.state.id.name ?? undefined);
      return result.ok ? result.value : null;
    } catch {
      return null;
    }
  }

  private sendError(socket: OnlineCloudflareWebSocket, code: Parameters<typeof createOnlineCloudflareWebSocketErrorV1>[0]): void {
    const serialized = serializeOnlineCloudflareWebSocketValueV1(createOnlineCloudflareWebSocketErrorV1(code));
    if (serialized === null) return;
    try { socket.send(serialized); } catch { /* Error delivery is deliberately opaque. */ }
  }

  private countMessage(socket: OnlineCloudflareWebSocket, attachment: OnlineCloudflareSocketAttachmentV1, now: number): Readonly<{ readonly attachment: OnlineCloudflareSocketAttachmentV1; readonly rateLimited: boolean }> | null {
    if (!Number.isSafeInteger(now) || now < 0) return null;
    try {
      const boundary = attachment.messageWindowStartedAt + ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1;
      if (!Number.isSafeInteger(boundary)) return null;
      const reset = now >= boundary;
      if (!reset && attachment.messageCount >= ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1) return Object.freeze({ attachment, rateLimited: true });
      const next = createAuthenticatedOrUnauthenticatedAttachment(attachment, reset ? now : attachment.messageWindowStartedAt, reset ? 1 : attachment.messageCount + 1, attachment.malformedWindowStartedAt, attachment.malformedCount);
      socket.serializeAttachment(next);
      return Object.freeze({ attachment: next, rateLimited: false });
    } catch {
      return null;
    }
  }

  private malformedMessage(socket: OnlineCloudflareWebSocket, attachment: OnlineCloudflareSocketAttachmentV1, now: number): void {
    try {
      const boundary = attachment.malformedWindowStartedAt + ONLINE_CLOUDFLARE_MALFORMED_MESSAGE_WINDOW_MS_V1;
      if (!Number.isSafeInteger(boundary)) throw new Error('Malformed clock overflow');
      const reset = now >= boundary;
      if (!reset && attachment.malformedCount >= ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1) {
        this.sendError(socket, 'RATE_LIMITED');
        this.recordRateRejection(attachment, now, 'MALFORMED_THRESHOLD');
        return;
      }
      const nextCount = reset ? 1 : attachment.malformedCount + 1;
      const next = createAuthenticatedOrUnauthenticatedAttachment(attachment, attachment.messageWindowStartedAt, attachment.messageCount, reset ? now : attachment.malformedWindowStartedAt, nextCount);
      socket.serializeAttachment(next);
      this.sendError(socket, 'INVALID_MESSAGE');
    } catch {
      this.sendError(socket, 'INTERNAL_ERROR');
    }
  }

  private recordRateRejection(
    attachment: OnlineCloudflareSocketAttachmentV1,
    now: number,
    eventCode: 'RATE_REJECTED' | 'MALFORMED_THRESHOLD',
  ): void {
    try {
      this.security.recordRateRejectionFromSnapshot(attachment.participantId, attachment.connectionId, now, eventCode);
    } catch {
      /* A rate rejection stays closed if audit persistence fails. */
    }
  }

  private handleHello(
    socket: OnlineCloudflareWebSocket,
    frame: OnlineCloudflareWebSocketFrameV1,
    attachment: OnlineCloudflareSocketAttachmentV1,
    state: Exclude<ReturnType<OnlineCloudflareRepository['load']>, null>,
    authorization: { readonly participantId: string; readonly authority: 'host' | 'seat' | 'table' | 'spectator'; readonly generation: number; readonly expiresAt: number },
  ): void {
    const transition = handleOnlineClientHelloV1(state, frame);
    const responseRecord = transitionResponseRecord(transition.response);
    if (responseRecord?.status !== 'accepted') {
      this.sendApplicationValue(socket, transition.response);
      return;
    }
    const participantId = typeof responseRecord.participantId === 'string' ? responseRecord.participantId : null;
    const role = isSocketRole(responseRecord.role) ? responseRecord.role : null;
    if (participantId === null || role === null || participantId !== authorization.participantId) {
      this.sendError(socket, 'IDENTITY_MISMATCH');
      return;
    }
    const nextAttachment = createAuthenticatedOrUnauthenticatedAttachment(
      attachment,
      attachment.messageWindowStartedAt,
      attachment.messageCount,
      attachment.malformedWindowStartedAt,
      attachment.malformedCount,
      participantId,
      role,
      authorization.generation,
      authorization.expiresAt,
    );
    socket.serializeAttachment(nextAttachment);
    emitWebSocketFactV1('authenticated', role, 'ok', this.versionIdentifier, state.room.roomId);
    const previousParticipant = state.room.participants.find((participant) => participant.participantId === participantId);
    if (previousParticipant?.presence === 'disconnected') emitWebSocketFactV1('reconnect', role, 'ok', this.versionIdentifier, state.room.roomId);
    this.persistPresenceIfChanged(state, transition.state);
    this.sendApplicationValue(socket, transition.response);
  }

  private handleProjection(
    socket: OnlineCloudflareWebSocket,
    frame: OnlineCloudflareWebSocketFrameV1,
    state: Exclude<ReturnType<OnlineCloudflareRepository['load']>, null>,
  ): void {
    const transition = handleOnlineProjectedSnapshotRequestV1(state, frame);
    this.persistPresenceIfChanged(state, transition.state);
    this.sendApplicationValue(socket, transition.response);
    emitWebSocketFactV1('hibernation-message', this.attachment(socket)?.role ?? null, 'ok', this.versionIdentifier, state.room.roomId);
  }

  private handleCommand(
    socket: OnlineCloudflareWebSocket,
    frame: OnlineCloudflareWebSocketFrameV1,
    state: Exclude<ReturnType<OnlineCloudflareRepository['load']>, null>,
    authorization: { readonly participantId: string; readonly authority: 'host' | 'seat' | 'table' | 'spectator'; readonly generation: number; readonly expiresAt: number },
    now: number,
  ): void {
    const validation = validateOnlineCommandEnvelopeV1(frame);
    if (!validation.ok) {
      const transition = handleOnlineCommandEnvelopeV1(state, frame);
      this.sendApplicationValue(socket, transition.response);
      return;
    }
    const acquired = this.security.acquireControllerLease(
      state,
      authorization.participantId,
      authorization.generation,
      { kind: 'socket', connectionId: this.attachment(socket)?.connectionId ?? null },
      now,
    );
    if (!acquired) {
      this.sendError(socket, 'CONTROLLER_LEASE_REQUIRED');
      return;
    }
    const transition = handleOnlineCommandEnvelopeV1(state, frame);
    const responseRecord = transitionResponseRecord(transition.response);
    if (responseRecord?.kind === 'online-command-ack-v1' && responseRecord.duplicate === false) {
      this.repository.commitAccepted(transition.state, validation.value);
      try {
        this.sendApplicationValue(socket, transition.response);
      } finally {
        this.broadcastRevision(state.room.roomId, transition.state.revision);
      }
      return;
    }
    this.sendApplicationValue(socket, transition.response);
  }

  private handleVariableHello(
    socket: OnlineCloudflareWebSocket,
    frame: OnlineCloudflareWebSocketFrameV1,
    attachment: OnlineCloudflareSocketAttachmentV1,
    state: OnlineVariableProtocolStateV2,
    authorization: { readonly participantId: string; readonly authority: 'host' | 'seat' | 'table' | 'spectator'; readonly generation: number; readonly expiresAt: number },
  ): void {
    const roomId = frameStringField(frame, 'roomId'); const participantId = frameStringField(frame, 'participantId'); const clientBuildId = frameStringField(frame, 'clientBuildId');
    if (roomId !== state.room.roomId || participantId !== authorization.participantId || clientBuildId === null) { this.sendError(socket, 'IDENTITY_MISMATCH'); return; }
    const role: OnlineCloudflareSocketRoleV1 = authorization.authority === 'host' || authorization.authority === 'seat' ? 'player' : authorization.authority;
    socket.serializeAttachment(createAuthenticatedOnlineCloudflareSocketAttachmentV1(attachment.roomId, participantId, role, attachment.connectionId, authorization.generation, authorization.expiresAt, attachment.messageWindowStartedAt, attachment.messageCount, attachment.malformedWindowStartedAt, attachment.malformedCount));
    this.sendApplicationValue(socket, Object.freeze({ kind: 'online-server-hello-v1', protocolVersion: state.protocolVersion, revision: state.revision, serverBuildId: state.serverBuildId, status: 'accepted', roomId, participantId, role, clientBuildIdMatch: clientBuildId === state.serverBuildId, issues: Object.freeze([]) }));
  }

  private handleVariableProjection(socket: OnlineCloudflareWebSocket, frame: OnlineCloudflareWebSocketFrameV1, state: OnlineVariableProtocolStateV2): void {
    const participantId = frameStringField(frame, 'participantId'); const clientBuildId = frameStringField(frame, 'clientBuildId'); const record = transitionResponseRecord(frame); const knownRevision = record?.knownRevision;
    if (participantId === null || clientBuildId === null || typeof knownRevision !== 'number' || !Number.isSafeInteger(knownRevision) || knownRevision < 0) { this.sendError(socket, 'INVALID_MESSAGE'); return; }
    const role = state.room.participants.some((entry) => entry.participantId === participantId) ? 'player' : 'table';
    // Existing O4P-08C clients remain on the compact v2 wire; the shipped v3
    // browser identifies itself with the D client build and receives the full
    // exact-roster projection. Both generations are validated client-side.
    const projection = clientBuildId === 'o4p-08d-client'
      ? projectOnlineVariableProtocolV3(state, participantId)
      : projectOnlineVariableProtocolV2(state, participantId);
    this.sendApplicationValue(socket, Object.freeze({ kind: 'online-projected-snapshot-v1', protocolVersion: state.protocolVersion, status: 'accepted', roomId: state.room.roomId, participantId, role, knownRevision, revision: state.revision, serverBuildId: state.serverBuildId, clientBuildIdMatch: clientBuildId === state.serverBuildId, reason: knownRevision === state.revision ? 'synchronized' : 'snapshot-required', projection, issues: Object.freeze([]) }));
  }

  private handleVariableCommand(
    socket: OnlineCloudflareWebSocket,
    frame: OnlineCloudflareWebSocketFrameV1,
    state: OnlineVariableProtocolStateV2,
    authorization: { readonly participantId: string; readonly authority: 'host' | 'seat' | 'table' | 'spectator'; readonly generation: number; readonly expiresAt: number },
    now: number,
  ): void {
    const validation = validateOnlineCommandEnvelopeV1(frame); const transition = handleOnlineVariableCommandEnvelopeV2(state, frame);
    if (!validation.ok) { this.sendApplicationValue(socket, transition.response); return; }
    const acquired = this.security.acquireControllerLease(state, authorization.participantId, authorization.generation, { kind: 'socket', connectionId: this.attachment(socket)?.connectionId ?? null }, now);
    if (!acquired) { this.sendError(socket, 'CONTROLLER_LEASE_REQUIRED'); return; }
    if (transition.response.kind === 'online-command-ack-v1' && !transition.response.duplicate) {
      this.repository.commitVariableAcceptedV2(state, transition.state, validation.value); this.sendApplicationValue(socket, transition.response); this.broadcastRevision(state.room.roomId, transition.state.revision); return;
    }
    this.sendApplicationValue(socket, transition.response);
  }

  private persistPresenceIfChanged(
    previous: Exclude<ReturnType<OnlineCloudflareRepository['load']>, null>,
    next: Exclude<ReturnType<OnlineCloudflareRepository['load']>, null>,
  ): void {
    if (JSON.stringify(previous) !== JSON.stringify(next)) this.repository.persistSameRevision(previous, next);
  }

  private sendApplicationValue(socket: OnlineCloudflareWebSocket, value: unknown): void {
    const serialized = serializeOnlineCloudflareWebSocketValueV1(value);
    if (serialized === null) throw new Error('Application response is not serializable');
    socket.send(serialized);
  }

  private broadcastRevision(roomId: string, revision: number): void {
    let sockets: readonly OnlineCloudflareWebSocket[];
    try {
      sockets = this.state.getWebSockets();
    } catch {
      return;
    }
    const notice: OnlineCloudflareRevisionNoticeV1 = createOnlineCloudflareRevisionNoticeV1(roomId, revision);
    const serialized = serializeOnlineCloudflareWebSocketValueV1(notice);
    if (serialized === null) return;
    for (const candidate of sockets) {
      const attachment = this.attachment(candidate);
      if (attachment === null || !attachment.authenticated || attachment.roomId !== roomId) continue;
      try { candidate.send(serialized); } catch { /* Peer failure does not change committed state. */ }
    }
  }

  private handleDisconnect(socket: OnlineCloudflareWebSocket): void {
    const attachment = this.attachment(socket);
    if (attachment === null || !attachment.authenticated || attachment.participantId === null || attachment.capabilityGeneration === null) return;
    let state: ReturnType<OnlineCloudflareRepository['load']> | OnlineVariableProtocolStateV2;
    try {
      state = this.repository.load() ?? this.repository.loadVariableProtocolV2(attachment.roomId);
      if (state === null) return;
      const grant = state.room.participants.find((participant) => participant.participantId === attachment.participantId);
      if (grant?.role === 'player') {
        this.security.releaseControllerLease(state, attachment.participantId, attachment.capabilityGeneration, { kind: 'socket', connectionId: attachment.connectionId }, this.now());
      }
    } catch {
      return;
    }
    let sockets: readonly OnlineCloudflareWebSocket[];
    if (state.kind === 'online-protocol-state-v2') return;
    try {
      sockets = this.state.getWebSockets();
      for (const candidate of sockets) {
        if (candidate === socket) continue;
        const other = this.attachment(candidate);
        if (other?.authenticated && other.roomId === attachment.roomId && other.participantId === attachment.participantId) return;
      }
    } catch {
      return;
    }
    try {
      const room = disconnectOnlineRoomParticipantV1(state.room, attachment.participantId);
      const validation = validateOnlineProtocolStateV1({ ...state, room });
      if (validation.ok) this.persistPresenceIfChanged(state, validation.value);
    } catch {
      /* Close handling is idempotent and emits no public error. */
    }
  }
}

function createAuthenticatedOrUnauthenticatedAttachment(
  attachment: OnlineCloudflareSocketAttachmentV1,
  messageWindowStartedAt: number,
  messageCount: number,
  malformedWindowStartedAt: number,
  malformedCount: number,
  participantId: string | null = attachment.participantId,
  role: OnlineCloudflareSocketRoleV1 | null = attachment.role,
  capabilityGeneration: number | null = attachment.capabilityGeneration,
  capabilityExpiresAt: number | null = attachment.capabilityExpiresAt,
): OnlineCloudflareSocketAttachmentV1 {
  if (participantId === null || role === null) {
    return createOnlineCloudflareSocketAttachmentV1(attachment.roomId, attachment.connectionId, messageWindowStartedAt, messageCount, malformedWindowStartedAt, malformedCount);
  }
  return createAuthenticatedOnlineCloudflareSocketAttachmentV1(
    attachment.roomId,
    participantId,
    role,
    attachment.connectionId,
    capabilityGeneration ?? 0,
    capabilityExpiresAt ?? 1,
    messageWindowStartedAt,
    messageCount,
    malformedWindowStartedAt,
    malformedCount,
  );
}

export function createOnlineRoomDurableObject(state: OnlineCloudflareDurableObjectState, env: import('./types').OnlineCloudflareEnv = {}, deckResolver?: OnlineDeckResolverV2): OnlineRoomDurableObject {
  return deckResolver === undefined ? new OnlineRoomDurableObject(state, env) : new OnlineRoomDurableObject(state, env, deckResolver);
}
