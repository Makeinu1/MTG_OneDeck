import {
  handleOnlineCommandEnvelopeV1,
  handleOnlineClientHelloV1,
  validateOnlineCommandEnvelopeV1,
  validateOnlineProtocolStateV1,
} from '../protocol/index';
import { handleOnlineProjectedSnapshotRequestV1 } from '../projection/index';
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

function rejectionStatus(error: unknown): 400 | 401 | 403 | 404 | 405 | 409 | 413 | 429 | 500 {
  if (!(error instanceof OnlineCloudflareSecurityError)) return 500;
  if (error.code === 'INVALID_INPUT') return 400;
  if (error.code === 'CAPABILITY_REJECTED') return 401;
  if (error.code === 'ROLE_NOT_ALLOWED') return 403;
  if (error.code === 'ROTATION_CONFLICT' || error.code === 'CONTROLLER_LEASE_REQUIRED' || error.code === 'CAS_CONFLICT') return 409;
  if (error.code === 'RATE_LIMITED') return 429;
  return 500;
}

export class OnlineRoomDurableObject {
  private readonly repository: OnlineCloudflareRepository;
  private readonly security: OnlineCloudflareSecurityRepository;
  private readonly state: OnlineCloudflareDurableObjectState;
  private readonly versionIdentifier: string | null;

  constructor(state: OnlineCloudflareDurableObjectState, env: import('./types').OnlineCloudflareEnv = {}) {
    this.state = state;
    const version = env.CF_VERSION_METADATA?.id;
    if (version !== undefined && version !== null && !isCanonicalVersionIdentifier(version)) throw new Error('Invalid Cloudflare version metadata');
    this.versionIdentifier = isCanonicalVersionIdentifier(version) ? version : null;
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
      const pathname = new URL(request.url).pathname;
      const route = parseRoomPath(pathname);
      if (route === null) return genericError(isInvalidRoomPath(pathname) ? 400 : 404);
      if (this.state.id.name !== route.roomId) return genericError(400);
      if (route.action === 'room' && request.method === 'GET') {
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
      if (route.action === 'capabilities' && request.method === 'POST') {
        if (!validJsonContentType(request)) return genericError(400);
        const body = await readJsonBody(request);
        if (body === null || !isExactRecord(body, ['kind', 'schemaVersion', 'participantId', 'currentCapability', 'nextCapability'])) return genericError(400);
        const participantId = ownDataString(body, 'participantId');
        const currentCapability = ownDataString(body, 'currentCapability');
        const nextCapability = ownDataString(body, 'nextCapability');
        if (body.kind !== 'online-cloudflare-capability-rotate-v1' || body.schemaVersion !== 1 || participantId === null || currentCapability === null || nextCapability === null) return genericError(400);
        const state = this.repository.load();
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
        const state = this.repository.load();
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
        const transition = handleOnlineCommandEnvelopeV1(state, internalMessage);
        if (validation.ok && transition.response.kind === 'online-command-ack-v1' && !transition.response.duplicate) this.repository.commitAccepted(transition.state, validation.value);
        return publicProtocolResponse(transition.response);
      }
      if (route.action === 'websocket' && request.method === 'GET') {
        if (!isWebSocketUpgrade(request) || request.body !== null) return genericError(400);
        const state = this.repository.load();
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
    let state: Exclude<ReturnType<OnlineCloudflareRepository['load']>, null>;
    let securitySnapshot: ReturnType<OnlineCloudflareSecurityRepository['read']>;
    try {
      const loaded = this.repository.load();
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
      if (kind === 'online-client-hello-v1') {
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
    let state: ReturnType<OnlineCloudflareRepository['load']>;
    try {
      state = this.repository.load();
      if (state === null) return;
      const grant = state.room.participants.find((participant) => participant.participantId === attachment.participantId);
      if (grant?.role === 'player') {
        this.security.releaseControllerLease(state, attachment.participantId, attachment.capabilityGeneration, { kind: 'socket', connectionId: attachment.connectionId }, this.now());
      }
    } catch {
      return;
    }
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

export function createOnlineRoomDurableObject(state: OnlineCloudflareDurableObjectState, env: import('./types').OnlineCloudflareEnv = {}): OnlineRoomDurableObject {
  return new OnlineRoomDurableObject(state, env);
}
