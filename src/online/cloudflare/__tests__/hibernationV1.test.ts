import { describe, expect, it, vi } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import { activateOnlineRoomV1, disconnectOnlineRoomParticipantV1, startOnlineRoomV1 } from '../../room/index';
import { CAPABILITIES, makeCoreRoot, PARTICIPANTS, readyAllPlayers } from '../../room/__tests__/testHelpers';
import { createOnlineProtocolStateV1, type OnlineCommandEnvelopeV1, type OnlineProtocolStateV1 } from '../../protocol/index';
import { createAuthenticatedOnlineCloudflareSocketAttachmentV1, createOnlineCloudflareSocketAttachmentV1, OnlineRoomDurableObject, ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1, type OnlineCloudflareSocketAttachmentV1, type OnlineCloudflareWebSocket, validateOnlineCloudflareSocketAttachmentV1 } from '../index';
import { SecuritySqlFixture } from './securitySqlFixture';

class TestSqlStorage extends SecuritySqlFixture {}

class TestSocket implements OnlineCloudflareWebSocket {
  attachment: unknown;
  readonly sent: string[] = [];
  send(value: string): void { this.sent.push(value); }
  serializeAttachment(value: OnlineCloudflareSocketAttachmentV1): void { this.attachment = value; }
  deserializeAttachment(): unknown { return this.attachment; }
}

class TestDurableObjectState {
  readonly id: { readonly name: string };
  readonly storage: TestSqlStorage;
  readonly sockets: TestSocket[] = [];
  acceptCount = 0;
  failSocketEnumeration = false;
  nowValue = 0;
  constructor(storage: TestSqlStorage, roomId: string) { this.storage = storage; this.id = { name: roomId }; }
  now = (): number => this.nowValue;
  acceptWebSocket = (socket: OnlineCloudflareWebSocket): void => { this.acceptCount += 1; this.sockets.push(socket as TestSocket); };
  getWebSockets = (): readonly TestSocket[] => {
    if (this.failSocketEnumeration) throw new Error('hostile socket enumeration failure');
    return this.sockets;
  };
}

function protocolState(disconnectedParticipant: string | null = null): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  const started = startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]);
  const active = activateOnlineRoomV1(started, { hostParticipantId: PARTICIPANTS[0], coreRoot });
  const room = disconnectedParticipant === null ? active : disconnectOnlineRoomParticipantV1(active, disconnectedParticipant);
  return createOnlineProtocolStateV1({ serverBuildId: 'ordinary-cloudflare-hibernation-build', room, coreRoot, observerAuthorizations: [] });
}

function hello(state: OnlineProtocolStateV1, capability: string = CAPABILITIES[0], participantId: string = PARTICIPANTS[0]): Record<string, unknown> {
  return { kind: 'online-client-hello-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId, participantId, participantCapability: capability, clientBuildId: 'client-build' };
}

function projectionRequest(state: OnlineProtocolStateV1): Record<string, unknown> {
  return { kind: 'online-projection-request-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId, participantId: PARTICIPANTS[0], participantCapability: CAPABILITIES[0], knownRevision: state.revision, clientBuildId: 'client-build', decisionContext: { kind: 'decision', decisionKey: 'ordinary-projection' } };
}

function commandEnvelope(state: OnlineProtocolStateV1, commandId = 'ordinary-cloudflare-hibernation-command'): OnlineCommandEnvelopeV1 {
  return { kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: state.room.roomId, participantId: PARTICIPANTS[0] as never, participantCapability: CAPABILITIES[0] as never, commandId: commandId as never, baseRevision: state.revision, command: createCoreCommandV1({ schemaVersion: 1, sequence: state.revision + 1, actorPlayerId: 'P1' as never, decisionMakerPlayerId: 'P1' as never, decisionContext: { kind: 'decision', decisionKey: 'ordinary-hibernation-command' }, payload: { kind: 'commander-cast-record', physicalCardId: 'PC1' as never, origin: 'command-zone', accepted: true } }) };
}

function initializeRequest(state: OnlineProtocolStateV1): Request {
  return new Request(`https://room.test/api/online/rooms/${state.room.roomId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-cloudflare-room-initialize-v1', schemaVersion: 1, state }) });
}

function objectFor(storage: TestSqlStorage, state: OnlineProtocolStateV1): { object: OnlineRoomDurableObject; runtime: TestDurableObjectState } {
  const runtime = new TestDurableObjectState(storage, state.room.roomId);
  return { object: new OnlineRoomDurableObject(runtime), runtime };
}

function messageKind(value: string): string | null {
  const parsed: unknown = JSON.parse(value);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const kind = (parsed as Record<string, unknown>)['kind'];
  return typeof kind === 'string' ? kind : null;
}

describe('O4P-03B hibernatable Cloudflare transport', () => {
  it('accepts once, sends a closed ready frame, authenticates, reloads projection, and recovers on a new instance', async () => {
    const storage = new TestSqlStorage();
    const state = protocolState('host');
    const first = objectFor(storage, state);
    expect((await first.object.fetch(initializeRequest(state))).status).toBe(200);
    const NativeResponse = globalThis.Response;
    class CloudflareResponse { readonly status: number; readonly webSocket: unknown; constructor(_body: BodyInit | null, init: ResponseInit & { webSocket?: unknown } = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket; } }
    const socket = new TestSocket();
    class Pair { readonly 0 = Object.freeze({ side: 'client' }); readonly 1 = socket; }
    vi.stubGlobal('WebSocketPair', Pair);
    vi.stubGlobal('Response', CloudflareResponse);
    try {
      const response = await first.object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}/websocket`, { headers: { upgrade: 'websocket' } }));
      expect(response.status).toBe(101);
      expect(first.runtime.acceptCount).toBe(1);
      expect(socket.sent).toEqual([JSON.stringify({ kind: 'online-cloudflare-websocket-ready-v1', schemaVersion: 1, roomId: state.room.roomId, revision: 0, transport: 'hibernation', authenticationRequired: true })]);
      expect(JSON.stringify(socket.attachment)).not.toContain(CAPABILITIES[0]);
      const rejectedWrites = storage.writeCount;
      first.object.webSocketMessage(socket, JSON.stringify(hello(state, 'wrong-capability')));
      expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'CAPABILITY_REJECTED' });
      expect(storage.writeCount).toBeGreaterThan(rejectedWrites);
      first.object.webSocketMessage(socket, JSON.stringify(hello(state)));
      expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-server-hello-v1', status: 'accepted', participantId: 'host', role: 'player' });
      expect(JSON.stringify(socket.attachment)).not.toContain(CAPABILITIES[0]);
      first.object.webSocketMessage(socket, JSON.stringify(hello(state, CAPABILITIES[1], PARTICIPANTS[1])));
      expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'IDENTITY_MISMATCH' });
      expect(socket.attachment).toMatchObject({
        participantId: 'host',
        role: 'player',
        authenticated: true,
        messageCount: 3,
      });
      first.object.webSocketMessage(socket, JSON.stringify(projectionRequest(state)));
      const projected = JSON.parse(socket.sent.at(-1) ?? '{}') as Record<string, unknown>;
      expect(projected).toMatchObject({ kind: 'online-projected-snapshot-v1', status: 'accepted' });
      expect(projected).not.toHaveProperty('log');
      expect(projected).not.toHaveProperty('state');
      expect(JSON.stringify(projected)).not.toContain('coreRoot');
      const recreated = objectFor(storage, state);
      recreated.object.webSocketMessage(socket, JSON.stringify(projectionRequest(state)));
      expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-projected-snapshot-v1', revision: 0 });
    } finally {
      vi.stubGlobal('Response', NativeResponse);
      vi.unstubAllGlobals();
    }
  });

  it('commits accepted commands once, deduplicates replay, broadcasts one revision notice, and persists last-socket disconnect', async () => {
    const storage = new TestSqlStorage();
    const state = protocolState();
    const first = objectFor(storage, state);
    expect((await first.object.fetch(initializeRequest(state))).status).toBe(200);
    const socketA = new TestSocket();
    const socketB = new TestSocket();
    first.runtime.acceptWebSocket(socketA);
    first.runtime.acceptWebSocket(socketB);
    socketA.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 1, 0));
    socketB.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 2, 0));
    first.object.webSocketMessage(socketA, JSON.stringify(hello(state)));
    first.object.webSocketMessage(socketB, JSON.stringify(hello(state)));
    const beforeCommandWrites = storage.writeCount;
    const envelope = commandEnvelope(state);
    first.object.webSocketMessage(socketA, JSON.stringify(envelope));
    expect(JSON.parse(socketA.sent.at(-2) ?? '{}')).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    expect(socketA.sent.filter((value) => messageKind(value) === 'online-cloudflare-revision-v1')).toHaveLength(1);
    expect(socketB.sent.filter((value) => messageKind(value) === 'online-cloudflare-revision-v1')).toHaveLength(1);
    expect(storage.room?.revision).toBe(1);
    const afterAcceptedWrites = storage.writeCount;
    expect(afterAcceptedWrites).toBeGreaterThan(beforeCommandWrites);
    first.object.webSocketMessage(socketA, JSON.stringify(envelope));
    expect(JSON.parse(socketA.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true });
    expect(storage.writeCount).toBeGreaterThan(afterAcceptedWrites);
    expect(socketA.sent.filter((value) => messageKind(value) === 'online-cloudflare-revision-v1')).toHaveLength(1);
    first.runtime.sockets.splice(first.runtime.sockets.indexOf(socketA), 1);
    first.object.webSocketClose(socketA);
    expect(storage.room?.state_json).toContain('"presence":"connected"');
    first.runtime.sockets.splice(first.runtime.sockets.indexOf(socketB), 1);
    first.object.webSocketClose(socketB);
    expect(storage.room?.state_json).toContain('"presence":"disconnected"');
    expect(storage.room?.revision).toBe(1);
  });

  it('returns only closed safe errors for binary, malformed, oversized, unknown, and unauthenticated frames', async () => {
    const storage = new TestSqlStorage();
    const state = protocolState();
    const { object, runtime } = objectFor(storage, state);
    expect((await object.fetch(initializeRequest(state))).status).toBe(200);
    const socket = new TestSocket();
    runtime.acceptWebSocket(socket);
    socket.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 1, 0));
    object.webSocketMessage(socket, new ArrayBuffer(4));
    object.webSocketMessage(socket, '{');
    object.webSocketMessage(socket, JSON.stringify({ kind: 'unknown-v1' }));
    object.webSocketMessage(socket, JSON.stringify({ kind: 'online-projection-request-v1' }));
    object.webSocketMessage(socket, ' '.repeat(1_048_577));
    const errors = socket.sent.map((value) => JSON.parse(value) as Record<string, unknown>);
    expect(errors.slice(0, 4)).toEqual([
      { kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'INVALID_MESSAGE' },
      { kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'INVALID_MESSAGE' },
      { kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'INVALID_MESSAGE' },
      { kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'AUTHENTICATION_REQUIRED' },
    ]);
    expect(errors.at(-1)).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'INVALID_MESSAGE' });
    expect(errors.every((error) => Object.keys(error).sort().join(',') === 'code,kind,schemaVersion')).toBe(true);
  });

  it('validates the complete protocol and security snapshot before malformed-frame accounting', async () => {
    const storage = new TestSqlStorage();
    const state = protocolState();
    const { object, runtime } = objectFor(storage, state);
    expect((await object.fetch(initializeRequest(state))).status).toBe(200);
    const socket = new TestSocket();
    runtime.acceptWebSocket(socket);
    socket.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 1, 0));
    const attachmentBefore = JSON.stringify(socket.attachment);
    const writesBefore = storage.writeCount;
    const grant = storage.grants[0];
    if (grant === undefined) throw new Error('Missing ordinary security grant');
    const lastObservedAt = storage.security?.last_observed_at;
    if (lastObservedAt === undefined) throw new Error('Missing ordinary security clock');
    grant.http_window_started_at = lastObservedAt + 1;

    object.webSocketMessage(socket, '{');

    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(socket.attachment)).toBe(attachmentBefore);
    expect(storage.writeCount).toBe(writesBefore);
  });

  it('rejects bearer collisions before lower handling without application mutation', async () => {
    const storage = new TestSqlStorage();
    const state = protocolState();
    const { object, runtime } = objectFor(storage, state);
    expect((await object.fetch(initializeRequest(state))).status).toBe(200);
    const socket = new TestSocket();
    runtime.acceptWebSocket(socket);
    socket.serializeAttachment(createAuthenticatedOnlineCloudflareSocketAttachmentV1(state.room.roomId, PARTICIPANTS[0], 'player', 1, 0, 100_000));
    const command = commandEnvelope(state, `${CAPABILITIES[0]}-embedded`);
    object.webSocketMessage(socket, JSON.stringify(command));
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'CAPABILITY_REJECTED' });
    expect(storage.room?.revision).toBe(0);
    expect(storage.journal).toHaveLength(0);
  });

  it('rate-limits an exhausted message window before protocol loading and records only a safe audit fact', async () => {
    const storage = new TestSqlStorage();
    const state = protocolState();
    const { object, runtime } = objectFor(storage, state);
    expect((await object.fetch(initializeRequest(state))).status).toBe(200);
    const socket = new TestSocket();
    runtime.acceptWebSocket(socket);
    socket.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 1, 0, 32));
    const attachmentBefore = JSON.stringify(socket.attachment);
    const stateJsonBefore = storage.room?.state_json;
    storage.failRoomReads = true;
    runtime.nowValue = 1;
    object.webSocketMessage(socket, '{');
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'RATE_LIMITED' });
    expect(JSON.stringify(socket.attachment)).toBe(attachmentBefore);
    expect(storage.room?.state_json).toBe(stateJsonBefore);
    expect(storage.journal).toHaveLength(0);
    expect(storage.audit.at(-1)).toMatchObject({ event_code: 'RATE_REJECTED', outcome: 'rejected', connection_id: 1 });
  });

  it('rejects attachment symbols, non-enumerable extras, and accessors while retaining no capability data', () => {
    const base = createOnlineCloudflareSocketAttachmentV1('room-02b');
    const nonEnumerableExtra = { ...base } as Record<string, unknown>;
    Object.defineProperty(nonEnumerableExtra, 'extra', { value: 'unexpected', enumerable: false });
    const symbolExtra = { ...base, [Symbol('extra')]: 'unexpected' };
    const accessorExtra = { ...base } as Record<string, unknown>;
    Object.defineProperty(accessorExtra, 'extra', { get: () => 'unexpected', enumerable: true });
    expect(validateOnlineCloudflareSocketAttachmentV1(nonEnumerableExtra, 'room-02b')).toEqual({ ok: false });
    expect(validateOnlineCloudflareSocketAttachmentV1(symbolExtra, 'room-02b')).toEqual({ ok: false });
    expect(validateOnlineCloudflareSocketAttachmentV1(accessorExtra, 'room-02b')).toEqual({ ok: false });
    expect(JSON.stringify(base)).not.toContain(CAPABILITIES[0]);
  });

  it('fails closed on oversized attachments and swallows hostile load/enumeration failures', async () => {
    const storage = new TestSqlStorage();
    const state = protocolState();
    const { object, runtime } = objectFor(storage, state);
    await expect(object.fetch(initializeRequest(state))).resolves.toMatchObject({ status: 200 });
    const authenticatedSocket = new TestSocket();
    authenticatedSocket.serializeAttachment(createAuthenticatedOnlineCloudflareSocketAttachmentV1(state.room.roomId, PARTICIPANTS[0], 'player'));
    runtime.sockets.push(authenticatedSocket);

    const writesBeforeSocketError = storage.writeCount;
    object.webSocketError(authenticatedSocket);
    expect(storage.writeCount).toBe(writesBeforeSocketError);
    expect(storage.room?.state_json).toContain('"presence":"connected"');
    expect(authenticatedSocket.sent).toEqual([]);

    const writesBeforeMessageFailure = storage.writeCount;
    storage.failRoomReads = true;
    object.webSocketMessage(authenticatedSocket, JSON.stringify(projectionRequest(state)));
    expect(authenticatedSocket.sent).toEqual([JSON.stringify({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'INTERNAL_ERROR' })]);
    expect(storage.writeCount).toBe(writesBeforeMessageFailure);

    const writesBeforeEnumerationFailure = storage.writeCount;
    runtime.failSocketEnumeration = true;
    expect(() => object.webSocketClose(authenticatedSocket)).not.toThrow();
    expect(() => object.webSocketError(authenticatedSocket)).not.toThrow();
    expect(authenticatedSocket.sent).toHaveLength(1);
    expect(storage.writeCount).toBe(writesBeforeEnumerationFailure);

    runtime.failSocketEnumeration = false;
    expect(() => object.webSocketClose(authenticatedSocket)).not.toThrow();
    expect(() => object.webSocketError(authenticatedSocket)).not.toThrow();
    expect(authenticatedSocket.sent).toHaveLength(1);
    expect(storage.writeCount).toBe(writesBeforeEnumerationFailure);

    const emptyAttachmentBytes = new TextEncoder().encode(JSON.stringify(createOnlineCloudflareSocketAttachmentV1(''))).length;
    const underLimitRoomId = 'r'.repeat(ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1 - emptyAttachmentBytes - 1);
    const atLimitRoomId = 'r'.repeat(ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1 - emptyAttachmentBytes);
    const overLimitRoomId = 'r'.repeat(ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1 - emptyAttachmentBytes + 1);
    expect(() => createOnlineCloudflareSocketAttachmentV1(underLimitRoomId)).not.toThrow();
    expect(() => createOnlineCloudflareSocketAttachmentV1(atLimitRoomId)).not.toThrow();
    expect(() => createOnlineCloudflareSocketAttachmentV1(overLimitRoomId)).toThrow();
    expect(validateOnlineCloudflareSocketAttachmentV1({
      ...createOnlineCloudflareSocketAttachmentV1('room-02b'),
      roomId: overLimitRoomId,
    }, overLimitRoomId)).toEqual({ ok: false });
  });
});
