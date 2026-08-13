import type {
  OnlineCommandAckV1,
  OnlineCommandRejectV1,
  OnlineProtocolStateV1,
} from '../protocol/index';
import type { OnlineRoomLifecycleV1 } from '../room/index';

export const ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1 = 1 as const;
export const ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 = 1_048_576 as const;
export const ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1 = 16_384 as const;

export type OnlineCloudflareRoomStatusV1 = Readonly<{
  readonly kind: 'online-cloudflare-room-status-v1';
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1;
  readonly roomId: string;
  readonly revision: number;
  readonly roomLifecycle: OnlineRoomLifecycleV1;
  readonly acceptedCommandCount: number;
}>;

export type OnlineCloudflareInitializeV1 = Readonly<{
  readonly kind: 'online-cloudflare-room-initialize-v1';
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1;
  readonly state: OnlineProtocolStateV1;
}>;

export type OnlineCloudflareSocketRoleV1 = 'player' | 'table' | 'spectator';

export type OnlineCloudflareSocketAttachmentV1 = Readonly<{
  readonly kind: 'online-cloudflare-socket-attachment-v1';
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1;
  readonly roomId: string;
  readonly participantId: string | null;
  readonly role: OnlineCloudflareSocketRoleV1 | null;
  readonly authenticated: boolean;
  readonly connectionId: number;
  readonly capabilityGeneration: number | null;
  readonly capabilityExpiresAt: number | null;
  readonly messageWindowStartedAt: number;
  readonly messageCount: number;
  readonly malformedWindowStartedAt: number;
  readonly malformedCount: number;
}>;

export type OnlineCloudflareWebSocketReadyV1 = Readonly<{
  readonly kind: 'online-cloudflare-websocket-ready-v1';
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1;
  readonly roomId: string;
  readonly revision: number;
  readonly transport: 'hibernation';
  readonly authenticationRequired: true;
}>;

export type OnlineCloudflareWebSocketErrorCodeV1 =
  | 'INVALID_MESSAGE'
  | 'AUTHENTICATION_REQUIRED'
  | 'IDENTITY_MISMATCH'
  | 'CAPABILITY_REJECTED'
  | 'ROLE_NOT_ALLOWED'
  | 'CONTROLLER_LEASE_REQUIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type OnlineCloudflareWebSocketErrorV1 = Readonly<{
  readonly kind: 'online-cloudflare-websocket-error-v1';
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1;
  readonly code: OnlineCloudflareWebSocketErrorCodeV1;
}>;

export type OnlineCloudflareRevisionNoticeV1 = Readonly<{
  readonly kind: 'online-cloudflare-revision-v1';
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1;
  readonly roomId: string;
  readonly revision: number;
}>;

export type OnlineCloudflareCommandResponseV1 = OnlineCommandAckV1 | OnlineCommandRejectV1;

export interface OnlineCloudflareSqlCursor<Row extends Record<string, unknown>> {
  toArray(): Row[];
}

export interface OnlineCloudflareSql {
  exec<Row extends Record<string, unknown>>(
    query: string,
    ...bindings: readonly unknown[]
  ): OnlineCloudflareSqlCursor<Row>;
}

export interface OnlineCloudflareSqlStorage {
  readonly sql: OnlineCloudflareSql;
  transactionSync<T>(callback: () => T): T;
}

export interface OnlineCloudflareDurableObjectId {
  readonly name: string | null;
}

export interface OnlineCloudflareDurableObjectState {
  readonly id: OnlineCloudflareDurableObjectId;
  readonly storage: OnlineCloudflareSqlStorage;
  readonly acceptWebSocket: (socket: OnlineCloudflareWebSocket, tags?: readonly string[]) => void;
  readonly getWebSockets: () => readonly OnlineCloudflareWebSocket[];
  readonly now?: () => number;
}

export interface OnlineCloudflareDurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export interface OnlineCloudflareWebSocket {
  send(data: string): void;
  serializeAttachment(attachment: OnlineCloudflareSocketAttachmentV1): void;
  deserializeAttachment(): unknown;
}

export interface OnlineCloudflareRoomNamespace {
  getByName(name: string): OnlineCloudflareDurableObjectStub;
}

export type OnlineCloudflareEnv = Readonly<{
  readonly ONLINE_ROOMS?: OnlineCloudflareRoomNamespace;
}>;
