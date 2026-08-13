import { ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 } from './types';

export const JSON_CONTENT_TYPE = /^application\/json(?:\s*;.*)?$/i;
export const GENERIC_ERROR = Object.freeze({ kind: 'online-cloudflare-error-v1' as const });

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function genericError(status: 400 | 401 | 403 | 404 | 405 | 409 | 413 | 429 | 500): Response {
  return jsonResponse(GENERIC_ERROR, status);
}

export function isSafeRoomId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)
    && value !== '__proto__'
    && value !== 'prototype'
    && value !== 'constructor';
}

const ROOM_PATH_PREFIX = '/api/online/rooms/';

export function isInvalidRoomPath(pathname: string): boolean {
  if (!pathname.startsWith(ROOM_PATH_PREFIX)) return false;
  const firstSegment = pathname.slice(ROOM_PATH_PREFIX.length).split('/')[0] ?? '';
  if (firstSegment.length === 0) return true;
  let roomId: string;
  try {
    roomId = decodeURIComponent(firstSegment);
  } catch {
    return true;
  }
  return !isSafeRoomId(roomId)
    || roomId === '.'
    || roomId === '..'
    || roomId.includes('/')
    || roomId.includes('\\');
}

export function parseRoomPath(pathname: string): Readonly<{ roomId: string; action: 'room' | 'commands' | 'capabilities' | 'websocket' }> | null {
  if (!pathname.startsWith(ROOM_PATH_PREFIX)) return null;
  const tail = pathname.slice(ROOM_PATH_PREFIX.length);
  const pieces = tail.split('/');
  if (pieces.length !== 1 && pieces.length !== 2) return null;
  let roomId: string;
  try {
    roomId = decodeURIComponent(pieces[0] ?? '');
  } catch {
    return null;
  }
  if (!isSafeRoomId(roomId) || roomId === '.' || roomId === '..' || roomId.includes('/') || roomId.includes('\\')) return null;
  const action = pieces.length === 1
    ? 'room'
    : pieces[1] === 'commands'
      ? 'commands'
      : pieces[1] === 'capabilities'
        ? 'capabilities'
        : pieces[1] === 'websocket'
          ? 'websocket'
          : null;
  return action === null ? null : Object.freeze({ roomId, action });
}

export function validJsonContentType(request: Request): boolean {
  const contentType = request.headers.get('content-type');
  return contentType !== null && JSON_CONTENT_TYPE.test(contentType);
}

export function validContentLength(request: Request): boolean {
  const value = request.headers.get('content-length');
  return value === null || /^(?:0|[1-9][0-9]*)$/.test(value) && Number(value) <= ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!validContentLength(request)) return null;
  const bytes = new TextEncoder().encode(await request.text());
  if (bytes.length === 0 || bytes.length > ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket';
}
