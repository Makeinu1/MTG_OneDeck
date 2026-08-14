import { describe, expect, it, vi } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import { activateOnlineRoomV1, startOnlineRoomV1 } from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import {
  createOnlineProtocolStateV1,
  type OnlineCommandEnvelopeV1,
  type OnlineProtocolStateV1,
} from '../../protocol/index';
import { OnlineRoomDurableObject, type OnlineCloudflareSocketAttachmentV1, type OnlineCloudflareWebSocket } from '../index';
import worker from '../worker';
import { SecuritySqlFixture } from './securitySqlFixture';

type Row = Record<string, unknown>;

class RuntimeSqlStorage extends SecuritySqlFixture {}

function protocolState(serverBuildId = 'ordinary-cloudflare-runtime-build'): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId,
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function commandEnvelope(state: OnlineProtocolStateV1): OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0] as never,
    participantCapability: CAPABILITIES[0] as never,
    commandId: 'ordinary-cloudflare-runtime-command' as never,
    baseRevision: state.revision,
    command: createCoreCommandV1({
      schemaVersion: 1,
      sequence: state.revision + 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: 'ordinary-runtime-command' },
      payload: {
        kind: 'commander-cast-record',
        physicalCardId: 'PC1' as never,
        origin: 'command-zone',
        accepted: true,
      },
    }),
  };
}

function initializeRequest(state: OnlineProtocolStateV1, extra: Row = {}): Request {
  return new Request(`https://room.test/api/online/rooms/${state.room.roomId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'online-cloudflare-room-initialize-v1',
      schemaVersion: 1,
      state,
      ...extra,
    }),
  });
}

function durableObject(storage: RuntimeSqlStorage, roomId = protocolState().room.roomId): OnlineRoomDurableObject {
  const sockets: OnlineCloudflareWebSocket[] = [];
  return new OnlineRoomDurableObject({
    id: { name: roomId },
    storage,
    acceptWebSocket: (socket) => sockets.push(socket),
    getWebSockets: () => sockets,
  });
}

class HibernationSocket implements OnlineCloudflareWebSocket {
  attachment: unknown;
  readonly sent: string[] = [];
  send(value: string): void { this.sent.push(value); }
  serializeAttachment(value: OnlineCloudflareSocketAttachmentV1): void { this.attachment = value; }
  deserializeAttachment(): unknown { return this.attachment; }
}

describe('O4P-03A Worker and Durable Object boundary', () => {
  it('rejects path/method/body failures before namespace lookup and forwards valid requests once', async () => {
    let lookups = 0;
    let selected = '';
    let forwardedBody = '';
    const binding = {
      getByName: (name: string) => {
        lookups += 1;
        selected = name;
        return {
          fetch: async (request: Request) => {
            forwardedBody = await request.text();
            return new Response(null, { status: 204 });
          },
        };
      },
    };
    const invalidPaths = [
      '/api/online/rooms/',
      '/api/online/rooms/%2Fescape',
      '/api/online/rooms/__proto__',
      '/api/online/rooms/%E0%A4%A',
      '/api/online/rooms/room%00control',
    ];
    for (const path of invalidPaths) {
      const response = await worker.fetch(new Request(`https://worker.test${path}`), { ONLINE_ROOMS: binding });
      expect(response.status, path).toBe(400);
    }
    expect((await worker.fetch(new Request('https://worker.test/nope'), { ONLINE_ROOMS: binding })).status).toBe(404);
    for (const path of ['/api/online/rooms/room/unknown', '/api/online/rooms/room/extra/path']) {
      const response = await worker.fetch(new Request(`https://worker.test${path}`), { ONLINE_ROOMS: binding });
      expect(response.status, path).toBe(404);
    }
    const wrongMethod = await worker.fetch(new Request('https://worker.test/api/online/rooms/room-02b', { method: 'POST' }), { ONLINE_ROOMS: binding });
    expect(wrongMethod.status).toBe(405);
    const missingContentType = await worker.fetch(new Request('https://worker.test/api/online/rooms/room-02b', { method: 'PUT', body: '{}' }), { ONLINE_ROOMS: binding });
    expect(missingContentType.status).toBe(400);
    expect(lookups).toBe(0);

    const body = JSON.stringify({ kind: 'opaque-test-body', value: 'forward unchanged' });
    const accepted = await worker.fetch(new Request('https://worker.test/api/online/rooms/room..legal?ignored=1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
    }), { ONLINE_ROOMS: binding });
    expect(accepted.status).toBe(204);
    expect(lookups).toBe(1);
    expect(selected).toBe('room..legal');
    expect(forwardedBody).toBe(body);

    const missingBinding = await worker.fetch(new Request('https://worker.test/api/online/rooms/room-02b'), {});
    expect(missingBinding.status).toBe(500);
  });

  it('enforces closed initialization and exposes only safe status', async () => {
    const storage = new RuntimeSqlStorage();
    const state = protocolState();
    const object = durableObject(storage, state.room.roomId);
    const invalid = await object.fetch(initializeRequest(state, { unexpected: true }));
    expect(invalid.status).toBe(400);
    expect(storage.writeCount).toBeGreaterThan(0);
    expect((await object.fetch(initializeRequest(state))).status).toBe(200);
    const status = await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}`));
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({
      kind: 'online-cloudflare-room-status-v1',
      schemaVersion: 1,
      roomId: state.room.roomId,
      revision: 0,
      roomLifecycle: 'active',
      acceptedCommandCount: 0,
    });
    expect(JSON.stringify(await (await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}`))).json())).not.toMatch(/coreRoot|command|seat_capability/);
  });

  it('composes accepted command persistence and leaves duplicate ACK write-free', async () => {
    const storage = new RuntimeSqlStorage();
    const initial = protocolState();
    const object = durableObject(storage, initial.room.roomId);
    expect((await object.fetch(initializeRequest(initial))).status).toBe(200);
    const requestBody = JSON.stringify(commandEnvelope(initial));
    const request = () => new Request(`https://room.test/api/online/rooms/${initial.room.roomId}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: requestBody,
    });
    const accepted = await object.fetch(request());
    expect((await accepted.json()) as Record<string, unknown>).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const writes = storage.writeCount;
    const duplicate = await object.fetch(request());
    expect((await duplicate.json()) as Record<string, unknown>).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true });
    expect(storage.writeCount).toBeGreaterThan(writes);
    expect(storage.room?.revision).toBe(1);
    expect(storage.journal).toHaveLength(1);
    expect(JSON.stringify(storage.journal[0])).not.toContain(CAPABILITIES[0]);
  });

  it('uses one hibernation accept and sends a capability-free ready frame after the attachment', async () => {
    const storage = new RuntimeSqlStorage();
    const initial = protocolState();
    const accepted = vi.fn();
    const sockets: OnlineCloudflareWebSocket[] = [];
    const object = new OnlineRoomDurableObject({
      id: { name: initial.room.roomId },
      storage,
      acceptWebSocket: (socket) => { accepted(socket); sockets.push(socket); },
      getWebSockets: () => sockets,
    });
    expect((await object.fetch(initializeRequest(initial))).status).toBe(200);
    const client = Object.freeze({ side: 'client' });
    const socket = new HibernationSocket();
    class FakePair {
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
    vi.stubGlobal('WebSocketPair', FakePair);
    vi.stubGlobal('Response', CloudflareResponse);
    try {
      const response = await object.fetch(new Request(`https://room.test/api/online/rooms/${initial.room.roomId}/websocket`, { headers: { upgrade: 'websocket' } }));
      expect(response.status).toBe(101);
      expect((response as unknown as { webSocket: unknown }).webSocket).toBe(client);
      expect(accepted).toHaveBeenCalledTimes(1);
      expect(socket.sent).toEqual([JSON.stringify({
        kind: 'online-cloudflare-websocket-ready-v1',
        schemaVersion: 1,
        roomId: initial.room.roomId,
        revision: 0,
        transport: 'hibernation',
        authenticationRequired: true,
      })]);
      expect(JSON.stringify(socket.attachment)).not.toContain(CAPABILITIES[0]);
      expect(socket.attachment).toMatchObject({
        kind: 'online-cloudflare-socket-attachment-v1',
        schemaVersion: 1,
        roomId: initial.room.roomId,
        participantId: null,
        role: null,
        authenticated: false,
        connectionId: 1,
        capabilityGeneration: null,
        capabilityExpiresAt: null,
        messageCount: 0,
        malformedCount: 0,
      });
      expect(socket.attachment).toHaveProperty('messageWindowStartedAt');
      expect(socket.attachment).toHaveProperty('malformedWindowStartedAt');
    } finally {
      vi.stubGlobal('Response', NativeResponse);
      vi.unstubAllGlobals();
    }
  });
});
