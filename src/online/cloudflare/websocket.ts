import {
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
  ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1,
  ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1,
  type OnlineCloudflareRevisionNoticeV1,
  type OnlineCloudflareSocketAttachmentV1,
  type OnlineCloudflareSocketRoleV1,
  type OnlineCloudflareWebSocketErrorCodeV1,
  type OnlineCloudflareWebSocketErrorV1,
  type OnlineCloudflareWebSocketReadyV1,
} from './types';

export type OnlineCloudflareWebSocketFrameV1 = Readonly<Record<string, unknown>>;

type OnlineCloudflareValidationResultV1<T> =
  | Readonly<{ readonly ok: true; readonly value: T }>
  | Readonly<{ readonly ok: false }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasDataDescriptors(value: object): boolean {
  try {
    const prototype: object | null = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    return Object.values(descriptors).every(
      (descriptor) => 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined,
    );
  } catch {
    return false;
  }
}

function ownDataValue(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value as unknown : undefined;
}

function ownDataString(value: Record<string, unknown>, key: string): string | null {
  const field = ownDataValue(value, key);
  return typeof field === 'string'
    ? field
    : null;
}

function serializedAttachmentBytes(value: OnlineCloudflareSocketAttachmentV1): number | null {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return null;
    return new TextEncoder().encode(serialized).length;
  } catch {
    return null;
  }
}

function assertAttachmentSize(value: OnlineCloudflareSocketAttachmentV1): void {
  const bytes = serializedAttachmentBytes(value);
  if (bytes === null || bytes > ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1) throw new Error('Serialized socket attachment is oversized');
}

export function validateOnlineCloudflareSocketAttachmentV1(
  input: unknown,
  roomId?: string,
): OnlineCloudflareValidationResultV1<OnlineCloudflareSocketAttachmentV1> {
  if (!isRecord(input) || !hasDataDescriptors(input)) return { ok: false };
  if (Object.getOwnPropertySymbols(input).length !== 0) return { ok: false };
  const keys = Object.getOwnPropertyNames(input).sort();
  if (keys.join('\u0000') !== ['authenticated', 'kind', 'participantId', 'role', 'roomId', 'schemaVersion'].join('\u0000')) return { ok: false };
  const kind = ownDataString(input, 'kind');
  const attachmentRoomId = ownDataString(input, 'roomId');
  const participantId = ownDataValue(input, 'participantId');
  const role = ownDataValue(input, 'role');
  const schemaVersion = ownDataValue(input, 'schemaVersion');
  const authenticated = ownDataValue(input, 'authenticated');
  if (
    kind !== 'online-cloudflare-socket-attachment-v1' ||
    attachmentRoomId === null ||
    (roomId !== undefined && attachmentRoomId !== roomId) ||
    schemaVersion !== ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1 ||
    typeof authenticated !== 'boolean' ||
    participantId === undefined ||
    role === undefined
  ) return { ok: false };
  if (participantId !== null && typeof participantId !== 'string') return { ok: false };
  const validRole = role === null || role === 'player' || role === 'table' || role === 'spectator';
  if (!validRole || (authenticated && (participantId === null || role === null)) || (!authenticated && (participantId !== null || role !== null))) return { ok: false };
  const normalized = Object.freeze({
    kind: 'online-cloudflare-socket-attachment-v1' as const,
    schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
    roomId: attachmentRoomId,
    participantId,
    role,
    authenticated,
  });
  const normalizedBytes = serializedAttachmentBytes(normalized);
  if (normalizedBytes === null || normalizedBytes > ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1) return { ok: false };
  return {
    ok: true,
    value: normalized,
  };
}

export function createOnlineCloudflareSocketAttachmentV1(
  roomId: string,
): OnlineCloudflareSocketAttachmentV1 {
  const value = Object.freeze({
    kind: 'online-cloudflare-socket-attachment-v1',
    schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
    roomId,
    participantId: null,
    role: null,
    authenticated: false,
  });
  assertAttachmentSize(value);
  return value;
}

export function createAuthenticatedOnlineCloudflareSocketAttachmentV1(
  roomId: string,
  participantId: string,
  role: OnlineCloudflareSocketRoleV1,
): OnlineCloudflareSocketAttachmentV1 {
  const value = Object.freeze({
    kind: 'online-cloudflare-socket-attachment-v1',
    schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
    roomId,
    participantId,
    role,
    authenticated: true,
  });
  assertAttachmentSize(value);
  return value;
}

export function parseOnlineCloudflareWebSocketFrameV1(
  message: unknown,
): OnlineCloudflareValidationResultV1<OnlineCloudflareWebSocketFrameV1> {
  if (typeof message !== 'string') return { ok: false };
  if (new TextEncoder().encode(message).length === 0 || new TextEncoder().encode(message).length > ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1) return { ok: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return { ok: false };
  }
  if (!isRecord(parsed) || !hasDataDescriptors(parsed)) return { ok: false };
  return { ok: true, value: parsed };
}

export function createOnlineCloudflareWebSocketReadyV1(
  roomId: string,
  revision: number,
): OnlineCloudflareWebSocketReadyV1 {
  return Object.freeze({
    kind: 'online-cloudflare-websocket-ready-v1',
    schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
    roomId,
    revision,
    transport: 'hibernation',
    authenticationRequired: true,
  });
}

export function createOnlineCloudflareWebSocketErrorV1(
  code: OnlineCloudflareWebSocketErrorCodeV1,
): OnlineCloudflareWebSocketErrorV1 {
  return Object.freeze({
    kind: 'online-cloudflare-websocket-error-v1',
    schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
    code,
  });
}

export function createOnlineCloudflareRevisionNoticeV1(
  roomId: string,
  revision: number,
): OnlineCloudflareRevisionNoticeV1 {
  return Object.freeze({
    kind: 'online-cloudflare-revision-v1',
    schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
    roomId,
    revision,
  });
}

export function frameKind(frame: OnlineCloudflareWebSocketFrameV1): string | null {
  return ownDataString(frame, 'kind');
}

export function frameStringField(frame: OnlineCloudflareWebSocketFrameV1, key: string): string | null {
  return ownDataString(frame, key);
}

export function serializeOnlineCloudflareWebSocketValueV1(value: unknown): string | null {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined || new TextEncoder().encode(serialized).length > ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1) return null;
    return serialized;
  } catch {
    return null;
  }
}
