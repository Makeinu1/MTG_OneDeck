import {
  handleOnlineCommandEnvelopeV1,
  validateOnlineCommandEnvelopeV1,
  validateOnlineProtocolStateV1,
} from '../protocol/index';
import { ConflictError, OnlineCloudflareRepository } from './persistence';
import { genericError, isInvalidRoomPath, isWebSocketUpgrade, jsonResponse, parseRoomPath, readJsonBody, validJsonContentType } from './support';
import {
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
  type OnlineCloudflareDurableObjectState,
  type OnlineCloudflareWebSocket,
  type OnlineCloudflareWebSocketBootstrapV1,
} from './types';

const DEFERRED = Object.freeze(['messages', 'hibernation', 'reconnect', 'outbox'] as const);

function publicProtocolResponse(value: unknown): Response {
  return jsonResponse(value, 200);
}

function websocketPair(): { client: WebSocket; server: OnlineCloudflareWebSocket } {
  const Pair = (globalThis as unknown as { WebSocketPair?: new () => { 0: WebSocket; 1: OnlineCloudflareWebSocket } }).WebSocketPair;
  if (Pair === undefined) throw new Error('WebSocketPair unavailable');
  const pair = new Pair();
  return { client: pair[0], server: pair[1] };
}

export class OnlineRoomDurableObject {
  private readonly repository: OnlineCloudflareRepository;
  private readonly state: OnlineCloudflareDurableObjectState;
  constructor(state: OnlineCloudflareDurableObjectState) { this.state = state; this.repository = new OnlineCloudflareRepository(state.storage); }

  async fetch(request: Request): Promise<Response> {
    try {
      const pathname = new URL(request.url).pathname;
      const route = parseRoomPath(pathname);
      if (route === null) return genericError(isInvalidRoomPath(pathname) ? 400 : 404);
      if (this.state.id.name !== route.roomId) return genericError(400);
      if (route.action === 'room' && request.method === 'GET') {
        const status = this.repository.status();
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
        try { return jsonResponse(this.repository.initialize(route.roomId, validation.value)); } catch (error: unknown) { return error instanceof ConflictError ? genericError(409) : genericError(500); }
      }
      if (route.action === 'commands' && request.method === 'POST') {
        if (!validJsonContentType(request)) return genericError(400);
        const body = await readJsonBody(request);
        if (body === null) return genericError(400);
        const state = this.repository.load();
        if (state === null) return genericError(404);
        const validation = validateOnlineCommandEnvelopeV1(body);
        if (validation.ok && validation.value.roomId !== route.roomId) return genericError(400);
        if (!validation.ok) return publicProtocolResponse(handleOnlineCommandEnvelopeV1(state, body).response);
        const envelope = validation.value;
        const transition = handleOnlineCommandEnvelopeV1(state, envelope);
        if (transition.response.kind === 'online-command-ack-v1' && !transition.response.duplicate) this.repository.commitAccepted(transition.state, envelope);
        return publicProtocolResponse(transition.response);
      }
      if (route.action === 'websocket' && request.method === 'GET') {
        if (!isWebSocketUpgrade(request) || request.body !== null) return genericError(400);
        const status = this.repository.status();
        if (status === null) return genericError(404);
        const pair = websocketPair();
        pair.server.accept();
        const bootstrap: OnlineCloudflareWebSocketBootstrapV1 = Object.freeze({ kind: 'online-cloudflare-websocket-bootstrap-v1', schemaVersion: 1, roomId: route.roomId, revision: status.revision, deferred: DEFERRED });
        pair.server.send(JSON.stringify(bootstrap));
        return new Response(null, { status: 101, webSocket: pair.client } as unknown as ResponseInit);
      }
      return genericError(request.method === 'GET' || request.method === 'PUT' || request.method === 'POST' ? 405 : 405);
    } catch {
      return genericError(500);
    }
  }
}

export function createOnlineRoomDurableObject(state: OnlineCloudflareDurableObjectState): OnlineRoomDurableObject { return new OnlineRoomDurableObject(state); }
