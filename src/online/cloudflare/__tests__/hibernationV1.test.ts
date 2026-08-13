import { describe, expect, it, vi } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import { activateOnlineRoomV1, disconnectOnlineRoomParticipantV1, startOnlineRoomV1 } from '../../room/index';
import { CAPABILITIES, makeCoreRoot, PARTICIPANTS, readyAllPlayers } from '../../room/__tests__/testHelpers';
import { createOnlineProtocolStateV1, type OnlineCommandEnvelopeV1, type OnlineProtocolStateV1 } from '../../protocol/index';
import { createAuthenticatedOnlineCloudflareSocketAttachmentV1, createOnlineCloudflareSocketAttachmentV1, OnlineRoomDurableObject, ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1, type OnlineCloudflareSocketAttachmentV1, type OnlineCloudflareWebSocket, validateOnlineCloudflareSocketAttachmentV1 } from '../index';

type Row = Record<string, unknown>;
type RoomRow = { singleton: number; schema_version: number; room_id: string; revision: number; room_lifecycle: string; accepted_command_count: number; state_json: string };
type JournalRow = { accepted_revision: number; command_id: string; participant_id: string; base_revision: number; command_json: string };

function cursor<T extends Row>(rows: readonly T[]): { toArray(): T[] } { return { toArray: () => rows.map((row) => ({ ...row })) }; }

class TestSqlStorage {
  room: RoomRow | null = null;
  journal: JournalRow[] = [];
  writeCount = 0;
  failRoomReads = false;
  readonly sql = { exec: <T extends Row>(query: string, ...bindings: readonly unknown[]) => this.execute<T>(query, bindings) };
  transactionSync<T>(callback: () => T): T {
    const beforeRoom = this.room === null ? null : { ...this.room };
    const beforeJournal = this.journal.map((row) => ({ ...row }));
    const beforeWrites = this.writeCount;
    try { return callback(); } catch (error: unknown) { this.room = beforeRoom; this.journal = beforeJournal; this.writeCount = beforeWrites; throw error; }
  }
  private execute<T extends Row>(query: string, bindings: readonly unknown[]): { toArray(): T[] } {
    if (query.startsWith('CREATE TABLE')) return cursor<T>([]);
    if (query.includes('FROM online_room_state')) {
      if (this.failRoomReads) throw new Error('hostile room row read failure');
      return cursor<T>(this.room === null ? [] : [this.room] as unknown as readonly T[]);
    }
    if (query.includes('FROM online_accepted_command')) return cursor<T>(this.journal as unknown as readonly T[]);
    if (query.startsWith('INSERT INTO online_room_state')) {
      if (this.room !== null) throw new Error('duplicate singleton');
      this.room = { singleton: Number(bindings[0]), schema_version: Number(bindings[1]), room_id: String(bindings[2]), revision: Number(bindings[3]), room_lifecycle: String(bindings[4]), accepted_command_count: Number(bindings[5]), state_json: String(bindings[6]) };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('INSERT INTO online_accepted_command')) {
      this.journal.push({ accepted_revision: Number(bindings[0]), command_id: String(bindings[1]), participant_id: String(bindings[2]), base_revision: Number(bindings[3]), command_json: String(bindings[4]) });
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('UPDATE online_room_state SET revision')) {
      if (this.room === null || this.room.room_id !== String(bindings[4]) || this.room.revision !== Number(bindings[5])) throw new Error('compare-and-set mismatch');
      this.room = { ...this.room, revision: Number(bindings[0]), room_lifecycle: String(bindings[1]), accepted_command_count: Number(bindings[2]), state_json: String(bindings[3]) };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('UPDATE online_room_state SET room_lifecycle')) {
      if (this.room === null || this.room.room_id !== String(bindings[2]) || this.room.revision !== Number(bindings[3]) || this.room.state_json !== String(bindings[4])) return cursor<T>([]);
      this.room = { ...this.room, room_lifecycle: String(bindings[0]), state_json: String(bindings[1]) };
      this.writeCount += 1;
      return cursor<T>([{ singleton: 1 } as unknown as T]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  }
}

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
  constructor(storage: TestSqlStorage, roomId: string) { this.storage = storage; this.id = { name: roomId }; }
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
      expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-server-hello-v1', status: 'rejected' });
      expect(storage.writeCount).toBe(rejectedWrites);
      first.object.webSocketMessage(socket, JSON.stringify(hello(state)));
      expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-server-hello-v1', status: 'accepted', participantId: 'host', role: 'player' });
      expect(JSON.stringify(socket.attachment)).not.toContain(CAPABILITIES[0]);
      const attachmentAfterAuth = JSON.stringify(socket.attachment);
      first.object.webSocketMessage(socket, JSON.stringify(hello(state, CAPABILITIES[1], PARTICIPANTS[1])));
      expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'IDENTITY_MISMATCH' });
      expect(JSON.stringify(socket.attachment)).toBe(attachmentAfterAuth);
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
    socketA.serializeAttachment({ kind: 'online-cloudflare-socket-attachment-v1', schemaVersion: 1, roomId: state.room.roomId, participantId: null, role: null, authenticated: false });
    socketB.serializeAttachment({ kind: 'online-cloudflare-socket-attachment-v1', schemaVersion: 1, roomId: state.room.roomId, participantId: null, role: null, authenticated: false });
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
    expect(storage.writeCount).toBe(afterAcceptedWrites);
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
    socket.serializeAttachment({ kind: 'online-cloudflare-socket-attachment-v1', schemaVersion: 1, roomId: state.room.roomId, participantId: null, role: null, authenticated: false });
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
    expect(JSON.stringify(base)).not.toContain('capability');
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
