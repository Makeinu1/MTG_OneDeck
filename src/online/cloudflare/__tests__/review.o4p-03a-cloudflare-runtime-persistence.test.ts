import { describe, expect, it, vi } from 'vitest';
import {
  createCoreCommandV1,
  type CoreCommandV1,
  type ModeNeutralCoreRootV1,
} from '../../../engine/core/index';
import {
  activateOnlineRoomV1,
  startOnlineRoomV1,
  type OnlineRoomV1,
} from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import {
  createOnlineProtocolStateV1,
  handleOnlineCommandEnvelopeV1,
  type OnlineCommandEnvelopeV1,
  type OnlineProtocolStateV1,
} from '../../protocol/index';
import {
  ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1,
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
  ConflictError,
  OnlineCloudflareRepository,
  OnlineRoomDurableObject,
  deserializeOnlineCloudflareProtocolStateV1,
  serializeOnlineCloudflareProtocolStateV1,
} from '../index';
import worker from '../worker';

type Row = Record<string, unknown>;

type RoomRow = {
  singleton: number;
  schema_version: number;
  room_id: string;
  revision: number;
  room_lifecycle: string;
  accepted_command_count: number;
  state_json: string;
};

type JournalRow = {
  accepted_revision: number;
  command_id: string;
  participant_id: string;
  base_revision: number;
  command_json: string;
};

function cursor<T extends Row>(rows: readonly T[]): Readonly<{ toArray(): T[] }> {
  return { toArray: () => rows.map((row) => ({ ...row })) };
}

class TransactionalSqliteStorage {
  room: RoomRow | null = null;
  journal: JournalRow[] = [];
  readonly queries: Array<Readonly<{ query: string; bindings: readonly unknown[] }>> = [];
  writeCount = 0;
  transactionCount = 0;
  failNextRoomUpdate = false;

  readonly sql = {
    exec: <T extends Row>(query: string, ...bindings: readonly unknown[]) =>
      this.execute<T>(query, bindings),
  };

  transactionSync<T>(callback: () => T): T {
    this.transactionCount += 1;
    const beforeRoom = this.room === null ? null : { ...this.room };
    const beforeJournal = this.journal.map((row) => ({ ...row }));
    const beforeWrites = this.writeCount;
    try {
      return callback();
    } catch (error) {
      this.room = beforeRoom;
      this.journal = beforeJournal;
      this.writeCount = beforeWrites;
      throw error;
    }
  }

  private execute<T extends Row>(query: string, bindings: readonly unknown[]): ReturnType<typeof cursor<T>> {
    this.queries.push(Object.freeze({ query, bindings: Object.freeze([...bindings]) }));
    if (query.startsWith('CREATE TABLE')) return cursor<T>([]);
    if (query.includes('FROM online_room_state')) {
      return cursor<T>(this.room === null ? [] : ([this.room] as unknown as readonly T[]));
    }
    if (query.includes('FROM online_accepted_command')) {
      return cursor<T>(this.journal as unknown as readonly T[]);
    }
    if (query.startsWith('INSERT INTO online_room_state')) {
      if (this.room !== null) throw new Error('duplicate singleton');
      expect(bindings).toHaveLength(7);
      expect(bindings[0]).toBe(1);
      this.room = {
        singleton: Number(bindings[0]),
        schema_version: Number(bindings[1]),
        room_id: String(bindings[2]),
        revision: Number(bindings[3]),
        room_lifecycle: String(bindings[4]),
        accepted_command_count: Number(bindings[5]),
        state_json: String(bindings[6]),
      };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('INSERT INTO online_accepted_command')) {
      this.journal.push({
        accepted_revision: Number(bindings[0]),
        command_id: String(bindings[1]),
        participant_id: String(bindings[2]),
        base_revision: Number(bindings[3]),
        command_json: String(bindings[4]),
      });
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('UPDATE online_room_state')) {
      if (this.failNextRoomUpdate) {
        this.failNextRoomUpdate = false;
        throw new Error('forced room update failure');
      }
      if (this.room === null) throw new Error('missing singleton');
      const expectedRoomId = String(bindings.at(-2));
      const expectedBaseRevision = Number(bindings.at(-1));
      if (this.room.room_id !== expectedRoomId || this.room.revision !== expectedBaseRevision) {
        throw new Error('compare-and-set mismatch');
      }
      this.room = {
        ...this.room,
        revision: Number(bindings[0]),
        room_lifecycle: String(bindings[1]),
        accepted_command_count: Number(bindings[2]),
        state_json: String(bindings[3]),
      };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    throw new Error(`Unexpected SQL in review fake: ${query}`);
  }
}

function activeRoom(coreRoot: ModeNeutralCoreRootV1): OnlineRoomV1 {
  return activateOnlineRoomV1(startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
}

function protocolState(serverBuildId = 'server-build-o4p-03a'): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  return createOnlineProtocolStateV1({
    serverBuildId,
    room: activeRoom(coreRoot),
    coreRoot,
    observerAuthorizations: [],
  });
}

function coreCommand(
  state: OnlineProtocolStateV1,
  decisionKey = 'review-o4p-03a-command',
): CoreCommandV1 {
  return createCoreCommandV1({
    schemaVersion: 1,
    sequence: state.revision + 1,
    actorPlayerId: 'P1' as never,
    decisionMakerPlayerId: 'P1' as never,
    decisionContext: { kind: 'decision', decisionKey },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: 'PC1' as never,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

function envelope(
  state: OnlineProtocolStateV1,
  commandId = 'review-o4p-03a-command-1',
  baseRevision = state.revision,
  command = coreCommand(state),
): OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0] as never,
    participantCapability: CAPABILITIES[0] as never,
    commandId: commandId as never,
    baseRevision,
    command,
  };
}

function repository(storage: TransactionalSqliteStorage): OnlineCloudflareRepository {
  return new OnlineCloudflareRepository(storage);
}

function durableObject(storage: TransactionalSqliteStorage): OnlineRoomDurableObject {
  return new OnlineRoomDurableObject({
    id: { name: protocolState().room.roomId },
    storage,
  });
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

describe('O4P-03A Judge acceptance', () => {
  it('uses the fixed schema/body limits and canonical byte-identical frozen round trip', () => {
    expect(ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1).toBe(1);
    expect(ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1).toBe(1_048_576);
    const state = protocolState();
    const serialized = serializeOnlineCloudflareProtocolStateV1(state);
    const restored = deserializeOnlineCloudflareProtocolStateV1(serialized);
    expect(serializeOnlineCloudflareProtocolStateV1(restored)).toBe(serialized);
    expect(restored).not.toBe(state);
    expect(Object.isFrozen(restored)).toBe(true);
    expect(Object.isFrozen(restored.room)).toBe(true);
    expect(Object.isFrozen(restored.coreRoot)).toBe(true);
    expect(() => deserializeOnlineCloudflareProtocolStateV1(`${serialized} `)).toThrow();
  });

  it('initializes one SQLite singleton, permits only identical init, and exposes safe status', () => {
    const storage = new TransactionalSqliteStorage();
    const target = repository(storage);
    const initial = protocolState();
    expect(target.initialize(initial.room.roomId, initial)).toEqual({
      kind: 'online-cloudflare-room-status-v1',
      schemaVersion: 1,
      roomId: initial.room.roomId,
      revision: 0,
      roomLifecycle: 'active',
      acceptedCommandCount: 0,
    });
    const writes = storage.writeCount;
    expect(target.initialize(initial.room.roomId, initial)).toEqual(target.status());
    expect(storage.writeCount).toBe(writes);
    expect(() =>
      target.initialize(initial.room.roomId, protocolState('different-server-build')),
    ).toThrow(ConflictError);
    expect(storage.writeCount).toBe(writes);
    const publicText = JSON.stringify(target.status());
    for (const capability of CAPABILITIES) expect(publicText).not.toContain(capability);
    expect(publicText).not.toContain('coreRoot');
    expect(publicText).not.toContain('command');
    expect(Object.isFrozen(target.status())).toBe(true);
  });

  it('persists accepted journal+snapshot atomically and rolls both back on the second write', () => {
    const storage = new TransactionalSqliteStorage();
    const target = repository(storage);
    const initial = protocolState();
    target.initialize(initial.room.roomId, initial);
    const acceptedEnvelope = envelope(initial);
    const transition = handleOnlineCommandEnvelopeV1(initial, acceptedEnvelope);
    expect(transition.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    target.commitAccepted(transition.state, acceptedEnvelope);
    expect(storage.journal).toHaveLength(1);
    expect(target.load()).toEqual(transition.state);
    expect(storage.room?.revision).toBe(1);
    expect(storage.journal[0]).toMatchObject({
      accepted_revision: 1,
      base_revision: 0,
      command_id: acceptedEnvelope.commandId,
      participant_id: acceptedEnvelope.participantId,
    });
    const stored = storage.journal[0];
    if (stored === undefined) throw new Error('expected accepted journal row');
    const journalParameters = JSON.stringify(storage.journal[0]);
    for (const capability of CAPABILITIES) {
      expect(journalParameters).not.toContain(capability);
      expect(journalParameters).not.toContain(capability.slice(8, 16));
    }

    stored.command_id = 'review-o4p-03a-substituted-command';
    expect(() => target.load()).toThrow('Journal receipt relation mismatch');
    stored.command_id = acceptedEnvelope.commandId;
    expect(target.load()).toEqual(transition.state);

    stored.command_id = CAPABILITIES[0].slice(0, 8);
    expect(() => target.load()).toThrow();
    stored.command_id = acceptedEnvelope.commandId;
    expect(target.load()).toEqual(transition.state);

    const rollbackStorage = new TransactionalSqliteStorage();
    const rollbackTarget = repository(rollbackStorage);
    rollbackTarget.initialize(initial.room.roomId, initial);
    rollbackStorage.failNextRoomUpdate = true;
    expect(() => rollbackTarget.commitAccepted(transition.state, acceptedEnvelope)).toThrow(
      'forced room update failure',
    );
    expect(rollbackStorage.journal).toEqual([]);
    expect(rollbackTarget.load()).toEqual(initial);
  });

  it('rejects capability fragments before any accepted-command transaction write', () => {
    const storage = new TransactionalSqliteStorage();
    const target = repository(storage);
    const initial = protocolState();
    target.initialize(initial.room.roomId, initial);
    const acceptedEnvelope = envelope(initial);
    const transition = handleOnlineCommandEnvelopeV1(initial, acceptedEnvelope);
    expect(transition.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const leakingEnvelope = {
      ...acceptedEnvelope,
      command: {
        ...acceptedEnvelope.command,
        decisionContext: { kind: 'decision' as const, decisionKey: CAPABILITIES[0] },
      },
    } as OnlineCommandEnvelopeV1;
    const beforeTransactions = storage.transactionCount;
    const beforeWrites = storage.writeCount;
    expect(() => target.commitAccepted(transition.state, leakingEnvelope)).toThrow();
    expect(storage.transactionCount).toBe(beforeTransactions);
    expect(storage.writeCount).toBe(beforeWrites);
    expect(storage.journal).toEqual([]);

    const metadataEnvelope = envelope(initial, CAPABILITIES[0].slice(0, 8));
    const metadataTransition = handleOnlineCommandEnvelopeV1(initial, metadataEnvelope);
    expect(metadataTransition.response).toMatchObject({
      kind: 'online-command-ack-v1',
      duplicate: false,
    });
    expect(() => target.commitAccepted(metadataTransition.state, metadataEnvelope)).toThrow();
    expect(storage.transactionCount).toBe(beforeTransactions);
    expect(storage.writeCount).toBe(beforeWrites);
    expect(storage.journal).toEqual([]);
  });

  it('turns capability-fragment journal metadata into a generic write-free failure', async () => {
    const storage = new TransactionalSqliteStorage();
    const object = durableObject(storage);
    const initial = protocolState();
    expect((await object.fetch(initializeRequest(initial))).status).toBe(200);
    const afterInitializeTransactions = storage.transactionCount;
    const afterInitializeWrites = storage.writeCount;
    const fragment = CAPABILITIES[0].slice(0, 8);
    const unsafeEnvelope = envelope(initial, fragment);
    const response = await object.fetch(
      new Request(`https://room.test/api/online/rooms/${initial.room.roomId}/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(unsafeEnvelope),
      }),
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toBe(JSON.stringify({ kind: 'online-cloudflare-error-v1' }));
    expect(storage.transactionCount).toBe(afterInitializeTransactions);
    expect(storage.writeCount).toBe(afterInitializeWrites);
    expect(storage.journal).toEqual([]);
  });

  it('keeps duplicate and authorization-rejected commands write-free', async () => {
    const storage = new TransactionalSqliteStorage();
    const object = durableObject(storage);
    const initial = protocolState();
    expect((await object.fetch(initializeRequest(initial))).status).toBe(200);
    const acceptedEnvelope = envelope(initial);
    const requestFor = (body: unknown) =>
      new Request(`https://room.test/api/online/rooms/${initial.room.roomId}/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    const accepted = await object.fetch(requestFor(acceptedEnvelope));
    expect(await accepted.json()).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const afterAcceptedTransactions = storage.transactionCount;
    const afterAcceptedWrites = storage.writeCount;

    const duplicate = await object.fetch(requestFor(acceptedEnvelope));
    expect(await duplicate.json()).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true });
    expect(storage.transactionCount).toBe(afterAcceptedTransactions);
    expect(storage.writeCount).toBe(afterAcceptedWrites);

    const rejectedEnvelope = {
      ...envelope(initial, 'review-rejected-command'),
      participantCapability: CAPABILITIES[1],
    };
    const rejected = await object.fetch(requestFor(rejectedEnvelope));
    expect(await rejected.json()).toMatchObject({ kind: 'online-command-reject-v1' });
    expect(storage.transactionCount).toBe(afterAcceptedTransactions);
    expect(storage.writeCount).toBe(afterAcceptedWrites);
    expect(storage.room?.revision).toBe(1);
    expect(storage.journal).toHaveLength(1);
  });

  it('rejects non-closed initialization and preserves generic secret-safe failures', async () => {
    const storage = new TransactionalSqliteStorage();
    const object = durableObject(storage);
    const initial = protocolState();
    const response = await object.fetch(initializeRequest(initial, { unexpected: true }));
    expect(response.status).toBe(400);
    expect(storage.writeCount).toBe(0);
    const body = await response.text();
    expect(body).toBe(JSON.stringify({ kind: 'online-cloudflare-error-v1' }));
    for (const capability of CAPABILITIES) expect(body).not.toContain(capability);
    expect(body).not.toMatch(/coreRoot|command_json|SELECT|INSERT|stack/i);
  });

  it('does not resolve invalid/aliased paths and permits a grammar-valid double-dot ID', async () => {
    const invalidRoomPaths = [
      '/api/online/rooms/',
      '/api/online/rooms/%2Fescape',
      '/api/online/rooms/__proto__',
      '/api/online/rooms/%E0%A4%A',
      '/api/online/rooms/room%00control',
    ];
    for (const path of invalidRoomPaths) {
      let lookups = 0;
      const response = await worker.fetch(new Request(`https://worker.test${path}`), {
        ONLINE_ROOMS: {
          getByName: () => {
            lookups += 1;
            throw new Error('binding must not be reached');
          },
        },
      });
      expect(response.status, path).toBe(400);
      expect(lookups, path).toBe(0);
    }

    const unknownPaths = [
      '/api/online/rooms/room/unknown',
      '/api/online/rooms/room/extra/path',
    ];
    for (const path of unknownPaths) {
      let lookups = 0;
      const response = await worker.fetch(new Request(`https://worker.test${path}`), {
        ONLINE_ROOMS: {
          getByName: () => {
            lookups += 1;
            throw new Error('binding must not be reached');
          },
        },
      });
      expect(response.status, path).toBe(404);
      expect(lookups, path).toBe(0);
    }

    let selected = '';
    const accepted = await worker.fetch(
      new Request('https://worker.test/api/online/rooms/room..legal'),
      {
        ONLINE_ROOMS: {
          getByName: (name: string) => {
            selected = name;
            return { fetch: () => Promise.resolve(new Response(null, { status: 204 })) };
          },
        },
      },
    );
    expect(accepted.status).toBe(204);
    expect(selected).toBe('room..legal');
  });

  it('accepts exactly one standard WebSocket pair and sends only the deferred bootstrap', async () => {
    const storage = new TransactionalSqliteStorage();
    const object = durableObject(storage);
    const initial = protocolState();
    expect((await object.fetch(initializeRequest(initial))).status).toBe(200);

    const accepted = vi.fn();
    const sent: string[] = [];
    const client = Object.freeze({ side: 'client' });
    class FakePair {
      readonly 0 = client;
      readonly 1 = { accept: accepted, send: (value: string) => sent.push(value) };
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
      const response = await object.fetch(
        new Request(`https://room.test/api/online/rooms/${initial.room.roomId}/websocket`, {
          headers: { upgrade: 'websocket' },
        }),
      );
      expect(response.status).toBe(101);
      expect((response as unknown as { webSocket: unknown }).webSocket).toBe(client);
      expect(accepted).toHaveBeenCalledTimes(1);
      expect(sent).toEqual([
        JSON.stringify({
          kind: 'online-cloudflare-websocket-bootstrap-v1',
          schemaVersion: 1,
          roomId: initial.room.roomId,
          revision: 0,
          deferred: ['messages', 'hibernation', 'reconnect', 'outbox'],
        }),
      ]);
      for (const capability of CAPABILITIES) expect(sent[0]).not.toContain(capability);
    } finally {
      vi.stubGlobal('Response', NativeResponse);
      vi.unstubAllGlobals();
    }
  });
});
