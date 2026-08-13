import {
  handleOnlineCommandEnvelopeV1,
  handleOnlineClientHelloV1,
  validateOnlineCommandEnvelopeV1,
  validateOnlineProtocolStateV1,
} from '../protocol/index';
import { handleOnlineProjectedSnapshotRequestV1 } from '../projection/index';
import { disconnectOnlineRoomParticipantV1 } from '../room/index';
import { ConflictError, OnlineCloudflareRepository } from './persistence';
import { genericError, isInvalidRoomPath, isWebSocketUpgrade, jsonResponse, parseRoomPath, readJsonBody, validJsonContentType } from './support';
import {
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
  type OnlineCloudflareRevisionNoticeV1,
  type OnlineCloudflareDurableObjectState,
  type OnlineCloudflareSocketAttachmentV1,
  type OnlineCloudflareSocketRoleV1,
  type OnlineCloudflareWebSocket,
} from './types';
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

export class OnlineRoomDurableObject {
  private readonly repository: OnlineCloudflareRepository;
  private readonly state: OnlineCloudflareDurableObjectState;
  constructor(state: OnlineCloudflareDurableObjectState) {
    this.state = state;
    this.repository = new OnlineCloudflareRepository(state.storage);
  }

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
        this.state.acceptWebSocket(pair.server);
        pair.server.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(route.roomId));
        pair.server.send(JSON.stringify(createOnlineCloudflareWebSocketReadyV1(route.roomId, status.revision)));
        return new Response(null, { status: 101, webSocket: pair.client } as unknown as ResponseInit);
      }
      return genericError(request.method === 'GET' || request.method === 'PUT' || request.method === 'POST' ? 405 : 405);
    } catch {
      return genericError(500);
    }
  }

  webSocketMessage(socket: OnlineCloudflareWebSocket, message: unknown): void {
    const attachment = this.attachment(socket);
    if (attachment === null) {
      this.sendError(socket, 'INTERNAL_ERROR');
      return;
    }
    const parsed = parseOnlineCloudflareWebSocketFrameV1(message);
    if (!parsed.ok) {
      this.sendError(socket, 'INVALID_MESSAGE');
      return;
    }
    const frame = parsed.value;
    const kind = frameKind(frame);
    if (kind !== 'online-client-hello-v1' && kind !== 'online-projection-request-v1' && kind !== 'online-command-envelope-v1') {
      this.sendError(socket, 'INVALID_MESSAGE');
      return;
    }
    if (!attachment.authenticated && kind !== 'online-client-hello-v1') {
      this.sendError(socket, 'AUTHENTICATION_REQUIRED');
      return;
    }
    if (attachment.authenticated && kind === 'online-client-hello-v1') {
      const participantId = frameStringField(frame, 'participantId');
      if (frameStringField(frame, 'roomId') !== attachment.roomId || participantId === null || participantId !== attachment.participantId) {
        this.sendError(socket, 'IDENTITY_MISMATCH');
        return;
      }
    }
    if (kind !== 'online-client-hello-v1' && !this.matchesAttachment(frame, attachment)) {
      this.sendError(socket, 'IDENTITY_MISMATCH');
      return;
    }
    let state: ReturnType<OnlineCloudflareRepository['load']>;
    try {
      state = this.repository.load();
    } catch {
      this.sendError(socket, 'INTERNAL_ERROR');
      return;
    }
    if (state === null) {
      this.sendError(socket, 'INTERNAL_ERROR');
      return;
    }
    try {
      if (kind === 'online-client-hello-v1') {
        this.handleHello(socket, frame, attachment, state);
      } else if (kind === 'online-projection-request-v1') {
        this.handleProjection(socket, frame, state);
      } else {
        this.handleCommand(socket, frame, state);
      }
    } catch {
      this.sendError(socket, 'INTERNAL_ERROR');
    }
  }

  webSocketClose(socket: OnlineCloudflareWebSocket): void {
    this.handleDisconnect(socket);
  }

  webSocketError(socket: OnlineCloudflareWebSocket): void {
    void socket;
    /* Cloudflare defines this as a non-disconnection notification. */
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
    try { socket.send(serialized); } catch { /* A failed error send is intentionally opaque. */ }
  }

  private matchesAttachment(frame: OnlineCloudflareWebSocketFrameV1, attachment: OnlineCloudflareSocketAttachmentV1): boolean {
    return frameStringField(frame, 'roomId') === attachment.roomId && frameStringField(frame, 'participantId') === attachment.participantId;
  }

  private handleHello(
    socket: OnlineCloudflareWebSocket,
    frame: OnlineCloudflareWebSocketFrameV1,
    attachment: OnlineCloudflareSocketAttachmentV1,
    state: ReturnType<OnlineCloudflareRepository['load']> extends infer Loaded ? Exclude<Loaded, null> : never,
  ): void {
    const transition = handleOnlineClientHelloV1(state, frame);
    const responseRecord = transitionResponseRecord(transition.response);
    if (responseRecord?.status !== 'accepted') {
      this.sendApplicationValue(socket, transition.response);
      return;
    }
    const participantId = typeof responseRecord.participantId === 'string' ? responseRecord.participantId : null;
    const role = isSocketRole(responseRecord.role) ? responseRecord.role : null;
    if (participantId === null || role === null || (attachment.authenticated && (participantId !== attachment.participantId || role !== attachment.role))) {
      this.sendError(socket, 'IDENTITY_MISMATCH');
      return;
    }
    this.persistPresenceIfChanged(state, transition.state);
    socket.serializeAttachment(createAuthenticatedOnlineCloudflareSocketAttachmentV1(state.room.roomId, participantId, role));
    this.sendApplicationValue(socket, transition.response);
  }

  private handleProjection(
    socket: OnlineCloudflareWebSocket,
    frame: OnlineCloudflareWebSocketFrameV1,
    state: ReturnType<OnlineCloudflareRepository['load']> extends infer Loaded ? Exclude<Loaded, null> : never,
  ): void {
    const transition = handleOnlineProjectedSnapshotRequestV1(state, frame);
    this.persistPresenceIfChanged(state, transition.state);
    this.sendApplicationValue(socket, transition.response);
  }

  private handleCommand(
    socket: OnlineCloudflareWebSocket,
    frame: OnlineCloudflareWebSocketFrameV1,
    state: ReturnType<OnlineCloudflareRepository['load']> extends infer Loaded ? Exclude<Loaded, null> : never,
  ): void {
    const transition = handleOnlineCommandEnvelopeV1(state, frame);
    const responseRecord = transitionResponseRecord(transition.response);
    if (responseRecord?.kind === 'online-command-ack-v1' && responseRecord.duplicate === false) {
      const validation = validateOnlineCommandEnvelopeV1(frame);
      if (!validation.ok) throw new Error('Accepted command was not valid');
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

  private persistPresenceIfChanged(
    previous: ReturnType<OnlineCloudflareRepository['load']> extends infer Loaded ? Exclude<Loaded, null> : never,
    next: ReturnType<OnlineCloudflareRepository['load']> extends infer Loaded ? Exclude<Loaded, null> : never,
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
      try { candidate.send(serialized); } catch { /* A peer failure does not change the committed state. */ }
    }
  }

  private handleDisconnect(socket: OnlineCloudflareWebSocket): void {
    const attachment = this.attachment(socket);
    if (attachment === null || !attachment.authenticated || attachment.participantId === null) return;
    let sockets: readonly OnlineCloudflareWebSocket[];
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
    let state: ReturnType<OnlineCloudflareRepository['load']>;
    try {
      state = this.repository.load();
    } catch {
      return;
    }
    if (state === null) return;
    try {
      const room = disconnectOnlineRoomParticipantV1(state.room, attachment.participantId);
      const validation = validateOnlineProtocolStateV1({ ...state, room });
      if (!validation.ok) return;
      this.persistPresenceIfChanged(state, validation.value);
    } catch {
      /* Close handling is idempotent and deliberately emits no public error. */
    }
  }
}

export function createOnlineRoomDurableObject(state: OnlineCloudflareDurableObjectState): OnlineRoomDurableObject { return new OnlineRoomDurableObject(state); }
