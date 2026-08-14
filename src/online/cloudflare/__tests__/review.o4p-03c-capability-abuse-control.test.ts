import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import { activateOnlineRoomV1, joinOnlineRoomV1, startOnlineRoomV1 } from '../../room/index';
import { CAPABILITIES, PARTICIPANTS, makeCoreRoot, readyAllPlayers } from '../../room/__tests__/testHelpers';
import { createOnlineProtocolStateV1, type OnlineCommandEnvelopeV1, type OnlineProtocolStateV1 } from '../../protocol/index';
import {
  ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1,
  ONLINE_CLOUDFLARE_CONTROLLER_LEASE_LIFETIME_MS_V1,
  ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1,
  ONLINE_CLOUDFLARE_MALFORMED_MESSAGE_WINDOW_MS_V1,
  ONLINE_CLOUDFLARE_MAX_ATTACHED_SOCKETS_V1,
  ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1,
  ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1,
  ONLINE_CLOUDFLARE_MAX_ROTATIONS_PER_WINDOW_V1,
  ONLINE_CLOUDFLARE_MAX_RETIRED_CAPABILITIES_PER_GRANT_V1,
  ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1,
  ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1,
  ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1,
  ONLINE_CLOUDFLARE_ROTATION_WINDOW_MS_V1,
  ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1,
  ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1,
  OnlineCloudflareRepository,
  OnlineRoomDurableObject,
  createAuthenticatedOnlineCloudflareSocketAttachmentV1,
  createOnlineCloudflareSocketAttachmentV1,
  type OnlineCloudflareSocketAttachmentV1,
  type OnlineCloudflareWebSocket,
} from '../index';
import {
  OnlineCloudflareSecurityError,
  OnlineCloudflareSecurityRepository,
} from '../security';
import { parseOnlineCloudflareWebSocketFrameV1 } from '../websocket';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const NOW = 20_000;
const TABLE_ID = 'table-review';
const SPECTATOR_ID = 'spectator-review';
const TABLE_TOKEN = `table_review_${'T'.repeat(40)}`;
const SPECTATOR_TOKEN = `spectator_review_${'S'.repeat(40)}`;
const openStorages: ReviewSqliteStorage[] = [];

function createStorage(): ReviewSqliteStorage {
  const storage = new ReviewSqliteStorage();
  openStorages.push(storage);
  return storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const storage of openStorages.splice(0)) storage.close();
});

function protocolState(observers = false): OnlineProtocolStateV1 {
  let room = readyAllPlayers();
  if (observers) {
    room = joinOnlineRoomV1(room, { participantId: TABLE_ID, role: 'table' });
    room = joinOnlineRoomV1(room, { participantId: SPECTATOR_ID, role: 'spectator' });
  }
  const coreRoot = makeCoreRoot();
  const active = activateOnlineRoomV1(startOnlineRoomV1(room, PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId: 'review-o4p-03c-build',
    room: active,
    coreRoot,
    observerAuthorizations: observers
      ? [
          { participantId: TABLE_ID as never, observerCapability: TABLE_TOKEN as never },
          { participantId: SPECTATOR_ID as never, observerCapability: SPECTATOR_TOKEN as never },
        ]
      : [],
  });
}

function rotatedToken(index: number): string {
  return `rotated_${index}_${String.fromCharCode(75 + index).repeat(40)}`;
}

function commandEnvelope(
  state: OnlineProtocolStateV1,
  participantId: string = PARTICIPANTS[0],
  capability: string = CAPABILITIES[0],
  commandId = `review-o4p-03c-command-${state.revision + 1}`,
): OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: participantId as never,
    participantCapability: capability as never,
    commandId: commandId as never,
    baseRevision: state.revision,
    command: createCoreCommandV1({
      schemaVersion: 1,
      sequence: state.revision + 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: commandId },
      payload: {
        kind: 'commander-cast-record',
        physicalCardId: 'PC1' as never,
        origin: 'command-zone',
        accepted: true,
      },
    }),
  };
}

function hello(state: OnlineProtocolStateV1, participantId: string, capability: string): Record<string, unknown> {
  return {
    kind: 'online-client-hello-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId,
    participantCapability: capability,
    clientBuildId: 'review-o4p-03c-client',
  };
}

function projection(state: OnlineProtocolStateV1, participantId: string, capability: string): Record<string, unknown> {
  return {
    kind: 'online-projection-request-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId,
    participantCapability: capability,
    knownRevision: state.revision,
    clientBuildId: 'review-o4p-03c-client',
    decisionContext: { kind: 'decision', decisionKey: 'review-o4p-03c-projection' },
  };
}

class ReviewSocket implements OnlineCloudflareWebSocket {
  attachment: unknown;
  readonly sent: string[] = [];
  failAttachmentWrite = false;

  send(value: string): void {
    this.sent.push(value);
  }

  serializeAttachment(value: OnlineCloudflareSocketAttachmentV1): void {
    if (this.failAttachmentWrite) throw new Error('forced attachment failure');
    this.attachment = value;
  }

  deserializeAttachment(): unknown {
    return this.attachment;
  }
}

function parsedLast(socket: ReviewSocket): Record<string, unknown> {
  return JSON.parse(socket.sent.at(-1) ?? '{}') as Record<string, unknown>;
}

function makeObject(
  storage: ReviewSqliteStorage,
  state: OnlineProtocolStateV1,
  clock: { value: number },
  sockets: ReviewSocket[] = [],
): OnlineRoomDurableObject {
  return new OnlineRoomDurableObject({
    id: { name: state.room.roomId },
    storage,
    acceptWebSocket: (socket) => sockets.push(socket as ReviewSocket),
    getWebSockets: () => sockets,
    now: () => clock.value,
  });
}

function initialize(storage: ReviewSqliteStorage, state: OnlineProtocolStateV1, now = NOW): void {
  new OnlineCloudflareRepository(storage).initialize(state.room.roomId, state, now);
}

describe('O4P-03C Judge capability and abuse-control acceptance', () => {
  it('uses exact policy constants and atomically classifies canonical real-SQLite grants', () => {
    expect({
      schema: ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1,
      capability: ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1,
      lease: ONLINE_CLOUDFLARE_CONTROLLER_LEASE_LIFETIME_MS_V1,
      sockets: ONLINE_CLOUDFLARE_MAX_ATTACHED_SOCKETS_V1,
      messageWindow: ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1,
      messages: ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1,
      malformedWindow: ONLINE_CLOUDFLARE_MALFORMED_MESSAGE_WINDOW_MS_V1,
      malformed: ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1,
      httpWindow: ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1,
      http: ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1,
      rotationWindow: ONLINE_CLOUDFLARE_ROTATION_WINDOW_MS_V1,
      rotations: ONLINE_CLOUDFLARE_MAX_ROTATIONS_PER_WINDOW_V1,
      frame: ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1,
      audit: ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1,
      retired: ONLINE_CLOUDFLARE_MAX_RETIRED_CAPABILITIES_PER_GRANT_V1,
    }).toEqual({
      schema: 1, capability: 43_200_000, lease: 30_000, sockets: 16,
      messageWindow: 10_000, messages: 32, malformedWindow: 60_000,
      malformed: 8, httpWindow: 10_000, http: 32, rotationWindow: 60_000,
      rotations: 4, frame: 65_536, audit: 256, retired: 256,
    });

    const storage = createStorage();
    const state = protocolState(true);
    initialize(storage, state);
    expect(storage.all<{ participant_id: string; authority: string; current_token: string }>(
      'SELECT participant_id, authority, current_token FROM online_capability_grant ORDER BY rowid',
    )).toEqual([
      { participant_id: 'host', authority: 'host', current_token: CAPABILITIES[0] },
      { participant_id: 'player-2', authority: 'seat', current_token: CAPABILITIES[1] },
      { participant_id: 'player-3', authority: 'seat', current_token: CAPABILITIES[2] },
      { participant_id: 'player-4', authority: 'seat', current_token: CAPABILITIES[3] },
      { participant_id: TABLE_ID, authority: 'table', current_token: TABLE_TOKEN },
      { participant_id: SPECTATOR_ID, authority: 'spectator', current_token: SPECTATOR_TOKEN },
    ]);

    const rollbackStorage = createStorage();
    const repository = new OnlineCloudflareRepository(rollbackStorage);
    rollbackStorage.failExecWhen = (query, bindings) =>
      query.startsWith('INSERT INTO online_capability_grant') && bindings[1] === 'player-2';
    expect(() => repository.initialize(state.room.roomId, state, NOW)).toThrow();
    expect(rollbackStorage.all('SELECT * FROM online_room_state')).toHaveLength(0);
    expect(rollbackStorage.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('online_security_state', 'online_capability_grant', 'online_controller_lease', 'online_security_audit') ORDER BY name",
    )).toEqual([]);
  });

  it('rotates without echo, rejects old/reused/fragment tokens, and expires at the exact boundary', () => {
    const storage = createStorage();
    const state = protocolState();
    initialize(storage, state);
    const security = new OnlineCloudflareSecurityRepository(storage);
    const next = rotatedToken(0);
    const response = security.rotate(state, PARTICIPANTS[0], CAPABILITIES[0], next, NOW + 1);
    expect(response).toEqual({
      kind: 'online-cloudflare-capability-rotated-v1', schemaVersion: 1,
      roomId: state.room.roomId, participantId: PARTICIPANTS[0], authority: 'host',
      generation: 1, expiresAt: NOW + 1 + ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1,
    });
    expect(JSON.stringify(response)).not.toContain(next);
    expect(security.consumeHttpAction(state, PARTICIPANTS[0], CAPABILITIES[0], 'command', NOW + 2)).toMatchObject({ ok: false, reason: 'capability' });
    expect(() => security.rotate(state, PARTICIPANTS[1], CAPABILITIES[1], next, NOW + 3)).toThrowError(OnlineCloudflareSecurityError);
    expect(() => security.rotate(state, PARTICIPANTS[0], next, CAPABILITIES[1], NOW + 4)).toThrowError(OnlineCloudflareSecurityError);
    expect(() => security.rotate(state, PARTICIPANTS[0], next, `safe_${CAPABILITIES[1].slice(8, 16)}_${'Q'.repeat(32)}`, NOW + 5)).toThrowError(OnlineCloudflareSecurityError);
    expect(security.consumeHttpAction(
      state,
      PARTICIPANTS[0],
      next,
      'command',
      response.expiresAt - 1,
    )).toMatchObject({ ok: true });
    expect(security.consumeHttpAction(state, PARTICIPANTS[0], next, 'command', response.expiresAt)).toMatchObject({ ok: false, reason: 'capability' });
    const publicData = JSON.stringify([response, storage.all('SELECT * FROM online_security_audit')]);
    expect(publicData).not.toContain(next);
    expect(publicData).not.toContain(CAPABILITIES[0]);
  });

  it('rejects an exact retired bearer without imposing a shape allowlist on valid lower IDs', async () => {
    const storage = createStorage();
    const state = protocolState();
    initialize(storage, state);
    const clock = { value: NOW + 1 };
    const object = makeObject(storage, state, clock);
    const previous = 'Q'.repeat(32);
    const current = 'R'.repeat(32);
    const rotate = (from: string, to: string) => object.fetch(new Request(
      `https://room.test/api/online/rooms/${state.room.roomId}/capabilities`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'online-cloudflare-capability-rotate-v1',
          schemaVersion: 1,
          participantId: PARTICIPANTS[0],
          currentCapability: from,
          nextCapability: to,
        }),
      },
    ));
    expect((await rotate(CAPABILITIES[0], previous)).status).toBe(200);
    clock.value = NOW + 2;
    expect((await rotate(previous, current)).status).toBe(200);
    expect(storage.all<{ retired_tokens_json: string }>(
      'SELECT retired_tokens_json FROM online_capability_grant WHERE participant_id = ?',
      PARTICIPANTS[0],
    )).toEqual([{ retired_tokens_json: JSON.stringify([{ token: previous, generation: 1, expiresAt: NOW + 1 + ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1 }]) }]);
    expect((await rotate(current, previous)).status).toBe(409);

    const commandRequest = (commandId: string) => new Request(
      `https://room.test/api/online/rooms/${state.room.roomId}/commands`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(commandEnvelope(state, PARTICIPANTS[0], current, commandId)),
      },
    );
    const rejected = await object.fetch(commandRequest(previous));
    expect(rejected.status).toBe(401);
    expect(await rejected.text()).not.toContain(previous);
    expect(new OnlineCloudflareRepository(storage).load()?.revision).toBe(0);
    expect(storage.all('SELECT * FROM online_accepted_command')).toEqual([]);

    const propertyFragment = previous.slice(0, 8);
    const fragmentEnvelope = {
      ...commandEnvelope(state, PARTICIPANTS[0], current, 'safe-fragment-name-check'),
      [propertyFragment]: 'safe-value',
    };
    const fragmentResponse = await object.fetch(new Request(
      `https://room.test/api/online/rooms/${state.room.roomId}/commands`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fragmentEnvelope),
      },
    ));
    expect(fragmentResponse.status).toBe(401);
    expect(await fragmentResponse.text()).not.toContain(propertyFragment);
    expect(new OnlineCloudflareRepository(storage).load()?.revision).toBe(0);

    const validLongId = `ticket_${'Z'.repeat(40)}`;
    const accepted = await object.fetch(commandRequest(validLongId));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ kind: 'online-command-ack-v1', commandId: validLongId });
    expect(new OnlineCloudflareRepository(storage).load()?.revision).toBe(1);

    clock.value = NOW + 1 + ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1;
    const reusedAfterExpiry = await rotate(current, previous);
    expect(reusedAfterExpiry.status).toBe(200);
    expect(await reusedAfterExpiry.text()).not.toContain(previous);
  });

  it('enforces all authority/action rows and exact HTTP and rotation windows', () => {
    const storage = createStorage();
    const state = protocolState(true);
    initialize(storage, state);
    const security = new OnlineCloudflareSecurityRepository(storage);
    const cases = [
      [PARTICIPANTS[0], CAPABILITIES[0], 'host'],
      [PARTICIPANTS[1], CAPABILITIES[1], 'seat'],
      [TABLE_ID, TABLE_TOKEN, 'table'],
      [SPECTATOR_ID, SPECTATOR_TOKEN, 'spectator'],
    ] as const;
    for (const [participantId, token, authority] of cases) {
      expect(security.authorizeSocket(state, participantId, token, 'hello', null, NOW, 1)).toMatchObject({ ok: true, authorization: { authority } });
      expect(security.authorizeSocket(state, participantId, token, 'projected-snapshot', null, NOW, 1)).toMatchObject({ ok: true, authorization: { authority } });
      expect(security.authorizeSocket(state, participantId, token, 'command', null, NOW, 1)).toMatchObject(
        authority === 'host' || authority === 'seat' ? { ok: true } : { ok: false, reason: 'role' },
      );
    }
    for (let index = 0; index < ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1; index += 1) {
      expect(security.consumeHttpAction(state, PARTICIPANTS[0], CAPABILITIES[0], 'command', NOW)).toMatchObject({ ok: true });
    }
    expect(security.consumeHttpAction(state, PARTICIPANTS[0], CAPABILITIES[0], 'command', NOW)).toEqual({ ok: false, reason: 'rate' });
    expect(security.consumeHttpAction(state, PARTICIPANTS[0], CAPABILITIES[0], 'command', NOW + ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1)).toMatchObject({ ok: true });

    const rotationBase = NOW + ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1;
    let current: string = CAPABILITIES[1];
    for (let index = 0; index < ONLINE_CLOUDFLARE_MAX_ROTATIONS_PER_WINDOW_V1; index += 1) {
      const next = rotatedToken(index + 1);
      security.rotate(state, PARTICIPANTS[1], current, next, rotationBase + index);
      current = next;
    }
    expect(() => security.rotate(state, PARTICIPANTS[1], current, rotatedToken(6), rotationBase + 4)).toThrowError(/RATE_LIMITED/);
    expect(security.rotate(
      state,
      PARTICIPANTS[1],
      current,
      rotatedToken(7),
      rotationBase + ONLINE_CLOUDFLARE_ROTATION_WINDOW_MS_V1,
    )).toMatchObject({ generation: 5 });
  });

  it('keeps one controller across HTTP/socket conflict and webSocketError until exact close', async () => {
    const storage = createStorage();
    const state = protocolState();
    initialize(storage, state);
    const security = new OnlineCloudflareSecurityRepository(storage);
    expect(security.acquireControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 7 }, NOW + 1)).toBe(true);
    const clock = { value: NOW + 4 };
    const sockets: ReviewSocket[] = [];
    const object = makeObject(storage, state, clock, sockets);
    const socket = new ReviewSocket();
    socket.serializeAttachment(createAuthenticatedOnlineCloudflareSocketAttachmentV1(
      state.room.roomId, PARTICIPANTS[0], 'player', 7, 0,
      NOW + ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1, NOW, 0, NOW, 0,
    ));
    sockets.push(socket);
    object.webSocketError(socket);
    expect(security.acquireControllerLease(state, PARTICIPANTS[0], 0, { kind: 'http', connectionId: null }, NOW + 3)).toBe(false);
    const conflict = await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}/commands`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(commandEnvelope(state)),
    }));
    expect(conflict.status).toBe(409);
    sockets.splice(0, 1);
    clock.value = NOW + 5;
    object.webSocketClose(socket);
    expect(security.acquireControllerLease(state, PARTICIPANTS[0], 0, { kind: 'http', connectionId: null }, NOW + 6)).toBe(true);
    expect(storage.all('SELECT * FROM online_controller_lease')).toEqual([
      expect.objectContaining({ participant_id: PARTICIPANTS[0], holder_kind: 'http', connection_id: null }),
    ]);
  });

  it('invalidates a live socket on rotation and preserves only closed secret-free attachment data', () => {
    const storage = createStorage();
    const state = protocolState();
    initialize(storage, state);
    const clock = { value: NOW + 1 };
    const object = makeObject(storage, state, clock);
    const socket = new ReviewSocket();
    socket.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 1, NOW));
    object.webSocketMessage(socket, JSON.stringify(hello(state, PARTICIPANTS[0], CAPABILITIES[0])));
    expect(parsedLast(socket)).toMatchObject({ kind: 'online-server-hello-v1', status: 'accepted' });
    expect(socket.attachment).toMatchObject({ authenticated: true, capabilityGeneration: 0 });
    expect(JSON.stringify(socket.attachment)).not.toContain(CAPABILITIES[0]);
    const next = rotatedToken(0);
    new OnlineCloudflareSecurityRepository(storage).rotate(state, PARTICIPANTS[0], CAPABILITIES[0], next, NOW + 2);
    clock.value = NOW + 3;
    object.webSocketMessage(socket, JSON.stringify(projection(state, PARTICIPANTS[0], CAPABILITIES[0])));
    expect(parsedLast(socket)).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'CAPABILITY_REJECTED' });
    object.webSocketMessage(socket, JSON.stringify(projection(state, PARTICIPANTS[0], next)));
    expect(parsedLast(socket)).toEqual({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'CAPABILITY_REJECTED' });
    expect(JSON.stringify([socket.attachment, socket.sent])).not.toContain(next);
  });

  it('enforces exact message, malformed, frame, and socket boundaries before application mutation', async () => {
    const storage = createStorage();
    const state = protocolState();
    initialize(storage, state);
    const clock = { value: NOW };
    const object = makeObject(storage, state, clock);
    const socket = new ReviewSocket();
    socket.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 1, NOW));
    for (let index = 0; index < ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1; index += 1) {
      object.webSocketMessage(socket, JSON.stringify(hello(state, PARTICIPANTS[0], CAPABILITIES[0])));
    }
    object.webSocketMessage(socket, JSON.stringify(hello(state, PARTICIPANTS[0], CAPABILITIES[0])));
    expect(parsedLast(socket)).toMatchObject({ code: 'RATE_LIMITED' });
    clock.value = NOW + ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1;
    object.webSocketMessage(socket, JSON.stringify(hello(state, PARTICIPANTS[0], CAPABILITIES[0])));
    expect(parsedLast(socket)).toMatchObject({ kind: 'online-server-hello-v1' });

    const malformedSocket = new ReviewSocket();
    malformedSocket.serializeAttachment(createOnlineCloudflareSocketAttachmentV1(state.room.roomId, 2, clock.value));
    for (let index = 0; index < ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1; index += 1) object.webSocketMessage(malformedSocket, '{');
    expect(parsedLast(malformedSocket)).toMatchObject({ code: 'INVALID_MESSAGE' });
    object.webSocketMessage(malformedSocket, '{');
    expect(parsedLast(malformedSocket)).toMatchObject({ code: 'RATE_LIMITED' });

    const prefix = JSON.stringify({ kind: 'unknown', pad: '' });
    const exact = JSON.stringify({ kind: 'unknown', pad: 'x'.repeat(ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1 - prefix.length) });
    expect(new TextEncoder().encode(exact)).toHaveLength(ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1);
    expect(parseOnlineCloudflareWebSocketFrameV1(exact).ok).toBe(true);
    expect(parseOnlineCloudflareWebSocketFrameV1(`${exact} `)).toEqual({ ok: false });

    const cappedObject = makeObject(
      storage,
      state,
      clock,
      Array.from({ length: ONLINE_CLOUDFLARE_MAX_ATTACHED_SOCKETS_V1 }, () => new ReviewSocket()),
    );
    const capped = await cappedObject.fetch(new Request(
      `https://room.test/api/online/rooms/${state.room.roomId}/websocket`,
      { headers: { upgrade: 'websocket' } },
    ));
    expect(capped.status).toBe(429);
  });

  it('fails an exhausted window closed when the self-contained grant cardinality is incomplete', () => {
    const storage = createStorage();
    const state = protocolState();
    initialize(storage, state);
    const before = storage.all<{ last_observed_at: number }>('SELECT last_observed_at FROM online_security_state');
    storage.run('DELETE FROM online_capability_grant WHERE participant_id = ?', PARTICIPANTS[1]);
    expect(() => makeObject(storage, state, { value: NOW + 1 })).toThrow('Durable Object migration failed');
    expect(storage.all('SELECT * FROM online_security_audit')).toEqual([]);
    expect(storage.all('SELECT last_observed_at FROM online_security_state')).toEqual(before);
  });

  it('rejects impossible audit outcome and future-generation relationships', () => {
    for (const mutate of [
      (storage: ReviewSqliteStorage) => storage.run(
        "UPDATE online_security_audit SET outcome = 'accepted' WHERE audit_id = 1",
      ),
      (storage: ReviewSqliteStorage) => storage.run(
        'UPDATE online_security_audit SET generation = 99 WHERE audit_id = 1',
      ),
    ]) {
      const storage = createStorage();
      const state = protocolState();
      initialize(storage, state);
      new OnlineCloudflareSecurityRepository(storage).recordAudit(
        state,
        PARTICIPANTS[0],
        null,
        'host',
        0,
        'ROLE_REJECTED',
        'rejected',
        NOW + 1,
      );
      mutate(storage);
      expect(() => new OnlineCloudflareSecurityRepository(storage).read(state)).toThrowError(/INVALID_SECURITY_STATE/);
    }
  });

  it('caps append-only audit rows, validates corrupt rows, clock regression, and recreation', () => {
    const storage = createStorage();
    const state = protocolState();
    initialize(storage, state);
    const security = new OnlineCloudflareSecurityRepository(storage);
    for (let index = 0; index < ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1 + 3; index += 1) {
      security.recordAudit(state, PARTICIPANTS[0], null, 'host', 0, 'ROLE_REJECTED', 'rejected', NOW + index + 1);
    }
    const audit = storage.all<{ audit_id: number; event_code: string }>('SELECT audit_id, event_code FROM online_security_audit ORDER BY audit_id');
    expect(audit).toHaveLength(ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1);
    expect(audit[0]?.audit_id).toBe(1);
    expect(audit.at(-1)?.audit_id).toBe(ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1);
    expect(storage.all<{ dropped_audit_count: number }>('SELECT dropped_audit_count FROM online_security_state')).toEqual([{ dropped_audit_count: 3 }]);
    expect(() => security.consumeHttpAction(state, PARTICIPANTS[0], CAPABILITIES[0], 'command', NOW)).toThrowError(/CLOCK_REJECTED/);
    expect(new OnlineCloudflareSecurityRepository(storage).read(state).grants).toHaveLength(4);

    storage.run('UPDATE online_security_audit SET audit_id = 999 WHERE audit_id = 2');
    expect(() => security.read(state)).toThrowError(/INVALID_SECURITY_STATE/);
    storage.run('UPDATE online_security_audit SET audit_id = 2 WHERE audit_id = 999');
    storage.run('UPDATE online_capability_grant SET expires_at = expires_at + 1 WHERE participant_id = ?', PARTICIPANTS[0]);
    expect(() => security.read(state)).toThrowError(/INVALID_SECURITY_STATE/);
  });

  it('fails malformed events closed when any authoritative security row is corrupt', () => {
    const storage = createStorage();
    const state = protocolState();
    initialize(storage, state);
    storage.run('UPDATE online_capability_grant SET authority = ? WHERE participant_id = ?', 'admin', PARTICIPANTS[0]);
    expect(() => makeObject(storage, state, { value: NOW + 1 })).toThrow('Durable Object migration failed');
  });
});
