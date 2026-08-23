import { createOnlineFormingLobbyV1, createOnlineLobbyAdmissionV3, encodeOnlineSharedInviteCodeV3, isOnlineFormingLobbyParticipantIdV1 } from '../lobby/index';
import { assertNoConfiguredCapabilityFragmentV1 } from './codec';
import { genericError, isInvalidRoomPath, isWebSocketUpgrade, parseRoomPath, readJsonBody, validContentLength, validJsonContentType, jsonResponse } from './support';
import type { OnlineCloudflareEnv } from './types';
import { emitWorkerRequestFactV1, isCanonicalVersionIdentifier } from './facts';

export { OnlineRoomDurableObject } from './runtime';

const ALLOWED_ORIGINS = Object.freeze([
  'https://makeinu1.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const CREATE_PATH = '/api/online/rooms';
const FORMING_CREATE_KIND = 'online-forming-lobby-create-v1';
const FORMING_CREATE_V3_KIND = 'online-forming-lobby-create-v3';

function originOf(request: Request): string | null {
  const value = request.headers.get('origin');
  return value === null ? null : value;
}

function allowedOrigin(value: string | null): value is string {
  return value !== null && ALLOWED_ORIGINS.includes(value);
}

function withCors(response: Response, origin: string | null): Response {
  if (origin === null || response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  const vary = headers.get('vary');
  if (vary === null) headers.set('vary', 'Origin');
  else if (!vary.split(',').some((value) => value.trim().toLowerCase() === 'origin')) headers.set('vary', `${vary}, Origin`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function preflight(origin: string, method: string, headersValue: string | null): Response {
  const requestedHeaders = headersValue === null || headersValue.trim() === ''
    ? []
    : headersValue.split(',').map((value) => value.trim().toLowerCase());
  if (requestedHeaders.some((value) => value !== 'content-type')) return genericError(400);
  return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': method,
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  }});
}

function preflightMethodAllowed(route: Readonly<{ readonly action: 'create' | 'room' | 'lobby' | 'commands' | 'capabilities' | 'websocket' }>, method: string): boolean {
  if (route.action === 'create') return method === 'POST';
  if (route.action === 'room') return method === 'GET';
  if (route.action === 'lobby') return method === 'GET' || method === 'POST';
  if (route.action === 'commands' || route.action === 'capabilities') return method === 'POST';
  return false;
}

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  const cryptoObject = globalThis.crypto;
  if (cryptoObject === undefined || typeof cryptoObject.getRandomValues !== 'function') throw new Error('Randomness unavailable');
  cryptoObject.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${prefix}_${encoded}`;
}

function serviceUnavailableV3(): Response {
  try {
    const correlationId = `correlation_${randomToken('id').slice(3)}`;
    return jsonResponse({ kind: 'online-public-error-v3', schemaVersion: 3, code: 'SERVICE_UNAVAILABLE', retryable: true, correlationId }, 503);
  } catch { return genericError(503); }
}

function exactRecord(value: Record<string, unknown>, expected: readonly string[]): boolean {
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) return false;
    const names = Object.getOwnPropertyNames(value).sort();
    const keys = [...expected].sort();
    return names.length === keys.length && names.every((name, index) => name === keys[index]) && keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined;
    });
  } catch { return false; }
}

function recognizedPublicLobbyV3(value: Record<string, unknown>): boolean {
  if (value.schemaVersion !== 3 || typeof value.kind !== 'string') return false;
  const participant = (key: string): boolean => isOnlineFormingLobbyParticipantIdV1(value[key]);
  const capability = (key: string): boolean => typeof value[key] === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value[key]);
  if (value.kind === 'online-forming-lobby-shared-claim-v3') return exactRecord(value, ['kind', 'schemaVersion', 'participantId', 'admissionCapability']) && participant('participantId') && capability('admissionCapability');
  if (value.kind === 'online-forming-lobby-recover-v3' || value.kind === 'online-forming-lobby-leave-v3') return exactRecord(value, ['kind', 'schemaVersion', 'participantId', 'seatCapability']) && participant('participantId') && capability('seatCapability');
  if (value.kind === 'online-forming-lobby-admission-rotate-v3' || value.kind === 'online-forming-lobby-admission-close-v3') return exactRecord(value, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability']) && participant('hostParticipantId') && capability('seatCapability');
  if (value.kind === 'online-forming-lobby-kick-v3') return exactRecord(value, ['kind', 'schemaVersion', 'hostParticipantId', 'seatCapability', 'targetParticipantId']) && participant('hostParticipantId') && capability('seatCapability') && participant('targetParticipantId');
  return false;
}

async function handleCreate(request: Request, env: OnlineCloudflareEnv): Promise<Response> {
  if (!validJsonContentType(request) || !validContentLength(request)) return genericError(400);
  const body = await readJsonBody(request.clone());
  if (body === null || !isOnlineFormingLobbyParticipantIdV1(body.participantId) || !exactRecord(body, ['kind', 'schemaVersion', 'participantId']) || (body.kind !== FORMING_CREATE_KIND && body.kind !== FORMING_CREATE_V3_KIND) || (body.kind === FORMING_CREATE_KIND ? body.schemaVersion !== 1 : body.schemaVersion !== 3)) return genericError(400);
  if (env.ONLINE_ROOMS === undefined) return body.kind === FORMING_CREATE_V3_KIND ? serviceUnavailableV3() : genericError(500);
  let roomId: string;
  let serverBuildId: string;
  let seatCapabilities: [string, string, string, string];
  let inviteCapabilities: [string, string, string];
  let tableParticipantId: string;
  let tableCapability: string;
  try {
    roomId = randomToken('room').slice(0, 64);
    serverBuildId = isCanonicalVersionIdentifier(env.CF_VERSION_METADATA?.id) ? env.CF_VERSION_METADATA.id : 'o4p-06c-server';
    seatCapabilities = [randomToken('seat'), randomToken('seat'), randomToken('seat'), randomToken('seat')];
    inviteCapabilities = [randomToken('invite'), randomToken('invite'), randomToken('invite')];
    tableParticipantId = randomToken('table').slice(0, 64);
    tableCapability = randomToken('observer');
  } catch { return body.kind === FORMING_CREATE_V3_KIND ? serviceUnavailableV3() : genericError(500); }
  if (body.kind === FORMING_CREATE_V3_KIND) {
    try {
      const admissionCapability = randomToken('admission');
      if (new Set([...seatCapabilities, ...inviteCapabilities, tableCapability, admissionCapability]).size !== 9) return serviceUnavailableV3();
      const admission = createOnlineLobbyAdmissionV3({ roomId, currentCapability: admissionCapability });
      const lobby = createOnlineFormingLobbyV1({ roomId, serverBuildId, hostParticipantId: body.participantId, seatCapabilities, inviteCapabilities });
      for (const identifier of [roomId, serverBuildId, body.participantId, tableParticipantId]) assertNoConfiguredCapabilityFragmentV1(identifier, [...seatCapabilities, ...inviteCapabilities, tableCapability, admissionCapability]);
      const internal = new Request(`https://worker.internal/api/online/rooms/${encodeURIComponent(roomId)}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-initialize-v3', schemaVersion: 3, lobby, admission, tableParticipantId, tableCapability }) });
      const result = await env.ONLINE_ROOMS.getByName(roomId).fetch(internal);
      if (!result.ok) return serviceUnavailableV3();
      const resultBody = await result.json() as Record<string, unknown>;
      return jsonResponse({ kind: 'online-forming-lobby-created-v3', schemaVersion: 3, roomId, participantId: body.participantId, seatCapability: seatCapabilities[0], inviteCode: encodeOnlineSharedInviteCodeV3(roomId, admissionCapability), tableParticipantId, tableCapability, projection: resultBody.projection });
    } catch { return serviceUnavailableV3(); }
  }
  if (new Set([...seatCapabilities, ...inviteCapabilities, tableCapability]).size !== 8) return genericError(500);
  const lobby = createOnlineFormingLobbyV1({ roomId, serverBuildId, hostParticipantId: body.participantId, seatCapabilities, inviteCapabilities });
  for (const identifier of [roomId, serverBuildId, body.participantId, tableParticipantId]) assertNoConfiguredCapabilityFragmentV1(identifier, [...seatCapabilities, ...inviteCapabilities, tableCapability]);
  assertNoConfiguredCapabilityFragmentV1(tableCapability, [...seatCapabilities, ...inviteCapabilities]);
  const internal = new Request(`https://worker.internal/api/online/rooms/${encodeURIComponent(roomId)}/lobby`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'online-forming-lobby-initialize-v1', schemaVersion: 1, lobby }),
  });
  const result = await env.ONLINE_ROOMS.getByName(roomId).fetch(internal);
  if (!result.ok) return genericError(result.status === 409 ? 409 : 500);
  const resultBody = await result.json() as Record<string, unknown>;
  return jsonResponse({ kind: 'online-forming-lobby-created-v1', schemaVersion: 1, roomId, seatCapability: seatCapabilities[0], inviteCapabilities: Object.freeze([...inviteCapabilities]), tableParticipantId, tableCapability, projection: resultBody.projection });
}

export default {
  async fetch(request: Request, env: OnlineCloudflareEnv): Promise<Response> {
    const origin = originOf(request);
    let roomId: string | null = null;
    let action = 'unknown';
    let response: Response;
    try {
      const pathname = new URL(request.url).pathname;
      if (origin !== null && !allowedOrigin(origin)) response = genericError(403);
      else if (request.method === 'OPTIONS') {
        const route = pathname === CREATE_PATH ? { action: 'create' as const } : parseRoomPath(pathname);
        const requestedMethod = request.headers.get('access-control-request-method')?.toUpperCase() ?? '';
        if (origin === null) response = genericError(403);
        else if (route === null) response = genericError(isInvalidRoomPath(pathname) ? 400 : 404);
        else if (!preflightMethodAllowed(route, requestedMethod)) response = genericError(400);
        else response = preflight(origin, requestedMethod, request.headers.get('access-control-request-headers'));
      } else if (pathname === CREATE_PATH) {
        action = 'create';
        if (request.method !== 'POST') response = genericError(405);
        else response = await handleCreate(request, env);
      } else {
        const route = parseRoomPath(pathname);
        if (route === null) response = genericError(isInvalidRoomPath(pathname) ? 400 : 404);
        else {
          roomId = route.roomId;
          action = route.action;
          const methodAllowed = route.action === 'room' ? request.method === 'GET' || (request.method === 'PUT' && origin === null) : route.action === 'lobby' ? request.method === 'GET' || request.method === 'POST' : route.action === 'commands' ? request.method === 'POST' : route.action === 'capabilities' ? request.method === 'POST' : request.method === 'GET';
          if (!methodAllowed) response = genericError(405);
          else if (route.action === 'websocket' && (!isWebSocketUpgrade(request) || request.body !== null)) response = genericError(400);
          else if (route.action !== 'websocket' && (request.method === 'POST' || request.method === 'PUT') && (!validJsonContentType(request) || !validContentLength(request))) response = genericError(400);
          else {
            let bodyValid = true;
            let recognizedV3 = false;
            if (route.action !== 'websocket' && (request.method === 'POST' || request.method === 'PUT')) {
              try {
                const parsed = await readJsonBody(request.clone());
                const internalInitializer = route.action === 'lobby' && (parsed?.kind === 'online-forming-lobby-initialize-v1' || parsed?.kind === 'online-forming-lobby-initialize-v3');
                bodyValid = parsed !== null && !internalInitializer;
                recognizedV3 = parsed !== null && route.action === 'lobby' && recognizedPublicLobbyV3(parsed);
              } catch { bodyValid = false; }
            }
            if (!bodyValid) response = genericError(400);
            else if (env.ONLINE_ROOMS === undefined) response = recognizedV3 ? serviceUnavailableV3() : genericError(500);
            else {
              try { response = await env.ONLINE_ROOMS.getByName(route.roomId).fetch(request); }
              catch { response = recognizedV3 ? serviceUnavailableV3() : genericError(500); }
            }
          }
        }
      }
    } catch {
      response = genericError(500);
    }
    const finalResponse = withCors(response!, allowedOrigin(origin) ? origin : null);
    const methodClass = request.method === 'GET' || request.method === 'PUT' || request.method === 'POST' ? request.method : 'OTHER';
    const status = finalResponse.status;
    const versionIdentifier = isCanonicalVersionIdentifier(env.CF_VERSION_METADATA?.id) ? env.CF_VERSION_METADATA.id : null;
    emitWorkerRequestFactV1(action, methodClass, status, status < 400 ? 'ok' : 'error', versionIdentifier, roomId);
    return finalResponse;
  },
} satisfies { fetch(request: Request, env: OnlineCloudflareEnv): Promise<Response> };

export type OnlineCloudflareWorkerHandler = typeof import('./worker').default;
