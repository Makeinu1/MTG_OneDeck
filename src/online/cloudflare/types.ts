import type {
  OnlineCommandAckV1,
  OnlineCommandRejectV1,
  OnlineProtocolStateV1,
} from '../protocol/index';
import type { OnlineRoomLifecycleV1 } from '../room/index';

export const ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1 = 1 as const;
export const ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 = 1_048_576 as const;

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

export type OnlineCloudflareWebSocketBootstrapV1 = Readonly<{
  readonly kind: 'online-cloudflare-websocket-bootstrap-v1';
  readonly schemaVersion: typeof ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1;
  readonly roomId: string;
  readonly revision: number;
  readonly deferred: readonly ['messages', 'hibernation', 'reconnect', 'outbox'];
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
}

export interface OnlineCloudflareDurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export interface OnlineCloudflareWebSocket {
  accept(): void;
  send(data: string): void;
}

export interface OnlineCloudflareRoomNamespace {
  getByName(name: string): OnlineCloudflareDurableObjectStub;
}

export type OnlineCloudflareEnv = Readonly<{
  readonly ONLINE_ROOMS?: OnlineCloudflareRoomNamespace;
}>;
