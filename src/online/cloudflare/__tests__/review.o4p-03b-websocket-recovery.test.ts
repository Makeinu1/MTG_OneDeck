import { describe, expect, it, vi } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import {
  activateOnlineRoomV1,
  disconnectOnlineRoomParticipantV1,
  startOnlineRoomV1,
} from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import {
  createOnlineProtocolStateV1,
  handleOnlineClientHelloV1,
  type OnlineCommandEnvelopeV1,
  type OnlineProtocolStateV1,
} from '../../protocol/index';
import {
  ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1,
  ConflictError,
  OnlineCloudflareRepository,
  OnlineRoomDurableObject,
  createAuthenticatedOnlineCloudflareSocketAttachmentV1,
  createOnlineCloudflareOutboxV1,
  createOnlineCloudflareSocketAttachmentV1,
  enqueueOnlineCloudflareOutboxV1,
  replayOnlineCloudflareOutboxV1,
  settleOnlineCloudflareOutboxV1,
  validateOnlineCloudflareSocketAttachmentV1,
  type OnlineCloudflareSocketAttachmentV1,
  type OnlineCloudflareWebSocket,
} from '../index';
import { SecuritySqlFixture } from './securitySqlFixture';

class ReviewSqlStorage extends SecuritySqlFixture {}

class ReviewSocket implements OnlineCloudflareWebSocket {
  attachment: unknown;
  readonly sent: string[] = [];
  failSend = false;
  send(value: string): void {
    if (this.failSend) throw new Error('peer send failure');
    this.sent.push(value);
  }
  serializeAttachment(value: OnlineCloudflareSocketAttachmentV1): void {
    this.attachment = value;
  }
  deserializeAttachment(): unknown {
    return this.attachment;
  }
}

class ReviewDurableObjectState {
  readonly id: { readonly name: string };
  readonly storage: ReviewSqlStorage;
  readonly sockets: ReviewSocket[] = [];
  acceptCount = 0;
  failEnumeration = false;
  readonly now = (): number => 0;
  constructor(storage: ReviewSqlStorage, roomId: string) {
    this.storage = storage;
    this.id = { name: roomId };
  }
  acceptWebSocket = (socket: OnlineCloudflareWebSocket): void => {
    this.acceptCount += 1;
    this.sockets.push(socket as ReviewSocket);
  };
  getWebSockets = (): readonly ReviewSocket[] => {
    if (this.failEnumeration) throw new Error('hostile socket enumeration');
    return this.sockets;
  };
}

function protocolState(disconnected = false): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  const active = activateOnlineRoomV1(
    startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]),
    { hostParticipantId: PARTICIPANTS[0], coreRoot },
  );
  const room = disconnected
    ? disconnectOnlineRoomParticipantV1(active, PARTICIPANTS[0])
    : active;
  return createOnlineProtocolStateV1({
    serverBuildId: 'review-o4p-03b-build',
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function hello(state: OnlineProtocolStateV1, capability: string = CAPABILITIES[0]): Record<string, unknown> {
  return {
    kind: 'online-client-hello-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0],
    participantCapability: capability,
    clientBuildId: 'review-o4p-03b-client',
  };
}

function projection(state: OnlineProtocolStateV1, capability: string = CAPABILITIES[0]): Record<string, unknown> {
  return {
    kind: 'online-projection-request-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0],
    participantCapability: capability,
    knownRevision: state.revision,
    clientBuildId: 'review-o4p-03b-client',
    decisionContext: { kind: 'decision', decisionKey: 'review-o4p-03b-projection' },
  };
}

function envelope(
  state: OnlineProtocolStateV1,
  commandId = 'review-o4p-03b-command',
): OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0] as never,
    participantCapability: CAPABILITIES[0] as never,
    commandId: commandId as never,
    baseRevision: state.revision,
    command: createCoreCommandV1({
      schemaVersion: 1,
      sequence: state.revision + 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: `review-${commandId}` },
      payload: {
        kind: 'commander-cast-record',
        physicalCardId: 'PC1' as never,
        origin: 'command-zone',
        accepted: true,
      },
    }),
  };
}

function initializeRequest(state: OnlineProtocolStateV1): Request {
  return new Request(`https://room.test/api/online/rooms/${state.room.roomId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'online-cloudflare-room-initialize-v1',
      schemaVersion: 1,
      state,
    }),
  });
}

function objectFor(storage: ReviewSqlStorage, state: OnlineProtocolStateV1) {
  const runtime = new ReviewDurableObjectState(storage, state.room.roomId);
  return { object: new OnlineRoomDurableObject(runtime), runtime };
}

function parsedFrames(socket: ReviewSocket): readonly Record<string, unknown>[] {
  return socket.sent.map((frame) => JSON.parse(frame) as Record<string, unknown>);
}

describe('O4P-03B Judge WebSocket and recovery acceptance', () => {
  it('admits only the Hibernation API, stores a closed attachment, and sends the exact ready frame', async () => {
    const storage = new ReviewSqlStorage();
    const state = protocolState();
    const { object, runtime } = objectFor(storage, state);
    expect((await object.fetch(initializeRequest(state))).status).toBe(200);
    const socket = new ReviewSocket();
    const client = Object.freeze({ side: 'client' });
    class Pair {
      readonly 0 = client;
      readonly 1 = socket;
    }
    const NativeResponse = globalThis.Response;
    class CloudflareResponse {
      readonly status: number;
      readonly webSocket: unknown;
      constructor(_body: BodyInit | null, init: ResponseInit & { webSocket?: unknown } = {}) {
        this.status = init.status ?? 200;
        this.webSocket = init.webSocket;
      }
    }
    vi.stubGlobal('WebSocketPair', Pair);
    vi.stubGlobal('Response', CloudflareResponse);
    try {
      const response = await object.fetch(new Request(
        `https://room.test/api/online/rooms/${state.room.roomId}/websocket`,
        { headers: { upgrade: 'websocket' } },
      ));
      expect(response.status).toBe(101);
      expect(runtime.acceptCount).toBe(1);
      expect((socket as unknown as Record<string, unknown>)['accept']).toBeUndefined();
      expect(socket.attachment).toEqual(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 1, 0));
      expect(socket.sent).toEqual([JSON.stringify({
        kind: 'online-cloudflare-websocket-ready-v1',
        schemaVersion: 1,
        roomId: state.room.roomId,
        revision: 0,
        transport: 'hibernation',
        authenticationRequired: true,
      })]);
    } finally {
      vi.stubGlobal('Response', NativeResponse);
      vi.unstubAllGlobals();
    }
  });

  it('reauthenticates, persists only same-revision presence, reloads a projected snapshot, and recovers after recreation', () => {
    const storage = new ReviewSqlStorage();
    const initial = protocolState(true);
    const repository = new OnlineCloudflareRepository(storage);
    repository.initialize(initial.room.roomId, initial, 0);
    const { object, runtime } = objectFor(storage, initial);
    const socket = new ReviewSocket();
    runtime.acceptWebSocket(socket);
    socket.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(initial.room.roomId));

    const beforeReject = storage.writeCount;
    object.webSocketMessage(socket, JSON.stringify(hello(initial, 'invalid-capability')));
    expect(parsedFrames(socket).at(-1)).toEqual({
      kind: 'online-cloudflare-websocket-error-v1',
      schemaVersion: 1,
      code: 'CAPABILITY_REJECTED',
    });
    expect(storage.writeCount).toBeGreaterThan(beforeReject);

    object.webSocketMessage(socket, JSON.stringify(hello(initial)));
    expect(parsedFrames(socket).at(-1)).toMatchObject({
      kind: 'online-server-hello-v1',
      status: 'accepted',
      participantId: PARTICIPANTS[0],
    });
    expect(repository.load()?.revision).toBe(0);
    expect(repository.load()?.room.participants[0]?.presence).toBe('connected');
    expect(JSON.stringify(socket.attachment)).not.toContain(CAPABILITIES[0]);

    const afterReconnect = storage.writeCount;
    object.webSocketMessage(socket, JSON.stringify(projection(initial, CAPABILITIES[1])));
    expect(parsedFrames(socket).at(-1)).toEqual({
      kind: 'online-cloudflare-websocket-error-v1',
      schemaVersion: 1,
      code: 'CAPABILITY_REJECTED',
    });
    expect(storage.writeCount).toBeGreaterThan(afterReconnect);

    object.webSocketMessage(socket, JSON.stringify(projection(initial)));
    const projected = parsedFrames(socket).at(-1);
    expect(projected).toMatchObject({ kind: 'online-projected-snapshot-v1', status: 'accepted', revision: 0 });
    const publicText = JSON.stringify(projected);
    expect(publicText).not.toMatch(/coreRoot|receiptDigest|participantCapability|projectionLog/);

    const recreated = objectFor(storage, initial);
    recreated.object.webSocketMessage(socket, JSON.stringify(projection(initial)));
    expect(parsedFrames(socket).at(-1)).toMatchObject({ kind: 'online-projected-snapshot-v1', revision: 0 });
  });

  it('commits once, deduplicates write-free, broadcasts once per authenticated socket, and preserves commit on peer failure', () => {
    const storage = new ReviewSqlStorage();
    const state = protocolState();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initialize(state.room.roomId, state, 0);
    const { object, runtime } = objectFor(storage, state);
    const sender = new ReviewSocket();
    const peer = new ReviewSocket();
    const failingPeer = new ReviewSocket();
    for (const socket of [sender, peer, failingPeer]) {
      runtime.acceptWebSocket(socket);
      socket.serializeAttachment(createAuthenticatedOnlineCloudflareSocketAttachmentV1(
        state.room.roomId,
        PARTICIPANTS[0],
        'player',
      ));
    }
    failingPeer.failSend = true;
    const command = envelope(state);
    object.webSocketMessage(sender, JSON.stringify(command));
    expect(repository.load()?.revision).toBe(1);
    expect(storage.journal).toHaveLength(1);
    expect(parsedFrames(sender).filter((frame) => frame.kind === 'online-command-ack-v1')).toHaveLength(1);
    expect(parsedFrames(sender).filter((frame) => frame.kind === 'online-cloudflare-revision-v1')).toHaveLength(1);
    expect(parsedFrames(peer).filter((frame) => frame.kind === 'online-cloudflare-revision-v1')).toHaveLength(1);

    const writes = storage.writeCount;
    object.webSocketMessage(sender, JSON.stringify(command));
    expect(parsedFrames(sender).at(-1)).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true });
    expect(storage.writeCount).toBeGreaterThan(writes);
    expect(parsedFrames(sender).filter((frame) => frame.kind === 'online-cloudflare-revision-v1')).toHaveLength(1);

    const afterDuplicateWrites = storage.writeCount;
    const unauthorized = { ...envelope(repository.load() ?? state, 'review-rejected'), participantCapability: CAPABILITIES[1] };
    object.webSocketMessage(sender, JSON.stringify(unauthorized));
    expect(parsedFrames(sender).at(-1)).toEqual({
      kind: 'online-cloudflare-websocket-error-v1',
      schemaVersion: 1,
      code: 'CAPABILITY_REJECTED',
    });
    expect(storage.writeCount).toBeGreaterThan(afterDuplicateWrites);
  });

  it('enforces exact-state presence CAS, rollback, multi-socket close, and hostile event failure boundaries', () => {
    const initial = protocolState(true);
    const storage = new ReviewSqlStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initialize(initial.room.roomId, initial, 0);
    const reconnect = handleOnlineClientHelloV1(initial, hello(initial));
    expect(reconnect.response.status).toBe('accepted');
    repository.persistSameRevision(initial, reconnect.state);
    expect(repository.load()).toEqual(reconnect.state);
    expect(() => repository.persistSameRevision(initial, reconnect.state)).toThrow(ConflictError);
    expect(() => repository.persistSameRevision(
      reconnect.state,
      { ...reconnect.state, serverBuildId: 'forbidden-build-change' },
    )).toThrow('Presence state changes outside the allowed boundary');

    const rollbackStorage = new ReviewSqlStorage();
    const rollbackRepository = new OnlineCloudflareRepository(rollbackStorage);
    rollbackRepository.initialize(initial.room.roomId, initial, 0);
    rollbackStorage.failNextPresenceUpdate = true;
    expect(() => rollbackRepository.persistSameRevision(initial, reconnect.state)).toThrow('forced presence update failure');
    expect(rollbackRepository.load()).toEqual(initial);

    const { object, runtime } = objectFor(storage, initial);
    const first = new ReviewSocket();
    const second = new ReviewSocket();
    for (const socket of [first, second]) {
      runtime.acceptWebSocket(socket);
      socket.serializeAttachment(createAuthenticatedOnlineCloudflareSocketAttachmentV1(initial.room.roomId, PARTICIPANTS[0], 'player'));
    }
    runtime.sockets.splice(runtime.sockets.indexOf(first), 1);
    object.webSocketClose(first);
    expect(repository.load()?.room.participants[0]?.presence).toBe('connected');
    const writesBeforeSocketError = storage.writeCount;
    object.webSocketError(second);
    expect(repository.load()?.room.participants[0]?.presence).toBe('connected');
    expect(storage.writeCount).toBe(writesBeforeSocketError);
    expect(second.sent).toEqual([]);
    runtime.sockets.splice(runtime.sockets.indexOf(second), 1);
    object.webSocketClose(second);
    expect(repository.load()?.room.participants[0]?.presence).toBe('disconnected');
    expect(repository.load()?.revision).toBe(0);

    const hostile = new ReviewSocket();
    hostile.serializeAttachment(createAuthenticatedOnlineCloudflareSocketAttachmentV1(initial.room.roomId, PARTICIPANTS[0], 'player'));
    storage.failRoomReads = true;
    const writes = storage.writeCount;
    object.webSocketMessage(hostile, JSON.stringify(projection(initial)));
    expect(parsedFrames(hostile)).toEqual([{
      kind: 'online-cloudflare-websocket-error-v1',
      schemaVersion: 1,
      code: 'INTERNAL_ERROR',
    }]);
    runtime.failEnumeration = true;
    expect(() => object.webSocketClose(hostile)).not.toThrow();
    expect(() => object.webSocketError(hostile)).not.toThrow();
    expect(storage.writeCount).toBe(writes);
  });

  it('keeps attachment and outbox records closed, bounded, immutable, ordered, and exact-response settled', () => {
    const baseAttachment = createOnlineCloudflareSocketAttachmentV1('review-room');
    const accessor = { ...baseAttachment } as Record<string, unknown>;
    Object.defineProperty(accessor, 'participantId', { get: () => PARTICIPANTS[0] });
    const symbol = { ...baseAttachment, [Symbol('capability')]: CAPABILITIES[0] };
    const extra = { ...baseAttachment } as Record<string, unknown>;
    Object.defineProperty(extra, 'capability', { value: CAPABILITIES[0], enumerable: false });
    expect(validateOnlineCloudflareSocketAttachmentV1(accessor, 'review-room')).toEqual({ ok: false });
    expect(validateOnlineCloudflareSocketAttachmentV1(symbol, 'review-room')).toEqual({ ok: false });
    expect(validateOnlineCloudflareSocketAttachmentV1(extra, 'review-room')).toEqual({ ok: false });
    expect(JSON.stringify(baseAttachment)).not.toContain(CAPABILITIES[0]);
    expect(ONLINE_CLOUDFLARE_MAX_ATTACHMENT_BYTES_V1).toBe(16_384);
    expect(() => createOnlineCloudflareSocketAttachmentV1('x'.repeat(16_384))).toThrow();

    const first = envelope(protocolState(), 'review-outbox-1');
    const second = { ...envelope(protocolState(), 'review-outbox-2'), baseRevision: 1 } as OnlineCommandEnvelopeV1;
    const empty = createOnlineCloudflareOutboxV1(first.roomId, first.participantId);
    const queued = enqueueOnlineCloudflareOutboxV1(enqueueOnlineCloudflareOutboxV1(empty, first), second);
    expect(Object.isFrozen(queued)).toBe(true);
    expect(Object.isFrozen(queued.entries)).toBe(true);
    expect(replayOnlineCloudflareOutboxV1(queued).map((entry) => entry.commandId)).toEqual([
      first.commandId,
      second.commandId,
    ]);
    expect(enqueueOnlineCloudflareOutboxV1(queued, JSON.parse(JSON.stringify(first)))).toBe(queued);
    expect(() => enqueueOnlineCloudflareOutboxV1(queued, { ...first, command: second.command })).toThrow();

    const ack = {
      kind: 'online-command-ack-v1',
      protocolVersion: first.protocolVersion,
      roomId: first.roomId,
      participantId: first.participantId,
      commandId: first.commandId,
      baseRevision: first.baseRevision,
      acceptedRevision: 1,
      currentRevision: 1,
      status: 'accepted',
      duplicate: false,
    };
    expect(settleOnlineCloudflareOutboxV1(queued, { ...ack, extra: true })).toBe(queued);
    expect(settleOnlineCloudflareOutboxV1(queued, { ...ack, baseRevision: 99 })).toBe(queued);
    const settled = settleOnlineCloudflareOutboxV1(queued, ack);
    expect(settled.entries.map((entry) => entry.commandId)).toEqual([second.commandId]);
    expect(queued.entries).toHaveLength(2);
  });
});
