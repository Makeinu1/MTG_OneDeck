import { describe, expect, it } from 'vitest';
import { createOnlineFormingLobbyV1, validateOnlineFormingLobbyV1 } from '../../lobby/index';
import { OnlineRoomDurableObject } from '../runtime';
import worker from '../worker';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

describe('forming lobby runtime persistence', () => {
  it('persists a forming lobby and applies a seat claim', async () => {
    const storage = new ReviewSqliteStorage();
    const roomId = 'room-lobby-runtime';
    const seatCapabilities = [
      'seat_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      'seat_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      'seat_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      'seat_DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ] as const;
    const inviteCapabilities = [
      'invite_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      'invite_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      'invite_DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ] as const;
    const lobby = createOnlineFormingLobbyV1({ roomId, serverBuildId: 'build-lobby-runtime', hostParticipantId: 'host-lobby', seatCapabilities, inviteCapabilities });
    const object = new OnlineRoomDurableObject({ id: { name: roomId }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
    const post = (value: unknown): Request => new Request(`https://room.test/api/online/rooms/${roomId}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    expect((await object.fetch(post({ kind: 'online-forming-lobby-initialize-v1', schemaVersion: 1, lobby }))).status).toBe(200);
    const claim = await object.fetch(post({ kind: 'online-forming-lobby-seat-claim-v1', schemaVersion: 1, participantId: 'player-lobby-two', inviteCapability: inviteCapabilities[0] }));
    expect(claim.status).toBe(200);
    expect((await claim.json() as Record<string, unknown>).seatCapability).toBe(seatCapabilities[1]);
    expect((await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}/lobby`))).status).toBe(200);
    storage.close();
  });

  it('creates a lobby through the exact-origin Worker route', async () => {
    const storage = new ReviewSqliteStorage();
    let object: OnlineRoomDurableObject | null = null;
    const env = {
      ONLINE_ROOMS: {
        getByName: (name: string) => {
          object ??= new OnlineRoomDurableObject({ id: { name }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
          return { fetch: (request: Request) => object!.fetch(request) };
        },
      },
    };
    const response = await worker.fetch(new Request('https://worker.test/api/online/rooms', { method: 'POST', headers: { origin: 'https://makeinu1.github.io', 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-create-v1', schemaVersion: 1, participantId: 'host-worker' }) }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.roomId).toBe('string');
    expect(typeof body.seatCapability).toBe('string');
    expect(Array.isArray(body.inviteCapabilities)).toBe(true);
    storage.close();
  });

  it('rejects inconsistent persisted seat relations and validates route-specific preflight', async () => {
    const lobby = createOnlineFormingLobbyV1({
      roomId: 'room-lobby-relations',
      serverBuildId: 'build-lobby-relations',
      hostParticipantId: 'host-relations',
      seatCapabilities: ['seat_IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII', 'seat_JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ', 'seat_KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK', 'seat_LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL'],
      inviteCapabilities: ['invite_JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ', 'invite_KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK', 'invite_LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL'],
    });
    const inconsistent = structuredClone(lobby) as unknown as { seats: Array<Record<string, unknown>> };
    inconsistent.seats[1].participantId = 'claimed-relations';
    expect(validateOnlineFormingLobbyV1(inconsistent).ok).toBe(false);
    const partialDeck = structuredClone(lobby) as unknown as { seats: Array<Record<string, unknown>> };
    partialDeck.seats[0].deckId = 'deck-relations';
    expect(validateOnlineFormingLobbyV1(partialDeck).ok).toBe(false);

    let lookups = 0;
    const env = { ONLINE_ROOMS: { getByName: () => { lookups += 1; return { fetch: () => Promise.resolve(new Response('{}')) }; } } };
    const routeCases = [
      ['https://worker.test/api/online/rooms', 'GET', 400],
      ['https://worker.test/api/online/rooms', 'POST', 204],
      ['https://worker.test/api/online/rooms/room-lobby-relations', 'POST', 400],
      ['https://worker.test/api/online/rooms/room-lobby-relations', 'GET', 204],
      ['https://worker.test/api/online/rooms/room-lobby-relations/lobby', 'GET', 204],
      ['https://worker.test/api/online/rooms/room-lobby-relations/websocket', 'GET', 400],
    ] as const;
    for (const [url, method, expectedStatus] of routeCases) {
      const response = await worker.fetch(new Request(url, { method: 'OPTIONS', headers: { origin: 'https://makeinu1.github.io', 'access-control-request-method': method, 'access-control-request-headers': 'content-type' } }), env);
      expect(response.status).toBe(expectedStatus);
    }
    expect(lookups).toBe(0);
    const malformedCreate = await worker.fetch(new Request('https://worker.test/api/online/rooms', { method: 'POST', headers: { origin: 'https://makeinu1.github.io', 'content-type': 'application/json' }, body: '{}' }), {});
    expect(malformedCreate.status).toBe(400);
    const missingBindingCreate = await worker.fetch(new Request('https://worker.test/api/online/rooms', { method: 'POST', headers: { origin: 'https://makeinu1.github.io', 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-create-v1', schemaVersion: 1, participantId: 'host-relations' }) }), {});
    expect(missingBindingCreate.status).toBe(500);
  });

  it('rejects legacy deck, ready, and start requests with a secret-free upgrade response', async () => {
    const storage = new ReviewSqliteStorage();
    const roomId = 'room-lobby-start';
    const seatCapabilities = [
      'seat_EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
      'seat_FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      'seat_GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      'seat_HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
    ] as const;
    const inviteCapabilities = [
      'invite_FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      'invite_GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      'invite_HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
    ] as const;
    const lobby = createOnlineFormingLobbyV1({ roomId, serverBuildId: 'build-lobby-start', hostParticipantId: 'host-start', seatCapabilities, inviteCapabilities });
    const object = new OnlineRoomDurableObject({ id: { name: roomId }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
    const post = (value: unknown): Request => new Request(`https://room.test/api/online/rooms/${roomId}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    expect((await object.fetch(post({ kind: 'online-forming-lobby-initialize-v1', schemaVersion: 1, lobby }))).status).toBe(200);
    const participants = ['host-start', 'player-start-two', 'player-start-three', 'player-start-four'];
    for (let index = 1; index < 4; index += 1) {
      expect((await object.fetch(post({ kind: 'online-forming-lobby-seat-claim-v1', schemaVersion: 1, participantId: participants[index], inviteCapability: inviteCapabilities[index - 1] }))).status).toBe(200);
    }
    const beforeV1 = await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}/lobby`));
    const beforeV2 = await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}/lobby?schemaVersion=2`));
    expect(beforeV1.status).toBe(200);
    expect(beforeV2.status).toBe(200);
    const beforeV1Body = await beforeV1.json() as Record<string, unknown>;
    const beforeV2Body = await beforeV2.json() as Record<string, unknown>;
    const oversized = await object.fetch(post({ kind: 'online-forming-lobby-deck-submit-v1', schemaVersion: 1, participantId: participants[0], seatCapability: seatCapabilities[0], deckId: 'deck-start-oversized', deckText: 'x'.repeat(262_145) }));
    expect(oversized.status).toBe(400);
    const capabilityFragment = await object.fetch(post({ kind: 'online-forming-lobby-deck-submit-v1', schemaVersion: 1, participantId: participants[0], seatCapability: seatCapabilities[0], deckId: `deck-${seatCapabilities[0].slice(0, 8)}`, deckText: '1 Plains' }));
    expect(capabilityFragment.status).toBe(400);
    const tableParticipantCollision = await object.fetch(post({ kind: 'online-forming-lobby-start-with-table-v1', schemaVersion: 1, hostParticipantId: participants[0], seatCapability: seatCapabilities[0], tableParticipantId: participants[1], tableCapability: 'table_' + 'T'.repeat(40) }));
    expect(tableParticipantCollision.status).toBe(400);
    const tableCapabilityCollision = await object.fetch(post({ kind: 'online-forming-lobby-start-with-table-v1', schemaVersion: 1, hostParticipantId: participants[0], seatCapability: seatCapabilities[0], tableParticipantId: 'table-start-collision', tableCapability: seatCapabilities[0] }));
    expect(tableCapabilityCollision.status).toBe(400);
    const tableCapabilityFragment = await object.fetch(post({ kind: 'online-forming-lobby-start-with-table-v1', schemaVersion: 1, hostParticipantId: participants[0], seatCapability: seatCapabilities[0], tableParticipantId: 'table-start-fragment', tableCapability: `table_${seatCapabilities[0].slice(5, 13)}${'T'.repeat(40)}` }));
    expect(tableCapabilityFragment.status).toBe(400);
    expect((await object.fetch(post({ kind: 'online-forming-lobby-deck-submit-v1', schemaVersion: 1, participantId: '', seatCapability: seatCapabilities[0], deckId: 'deck-start-0', deckText: '1 Plains' })))).toEqual(expect.objectContaining({ status: 400 }));
    expect((await object.fetch(post({ kind: 'online-forming-lobby-deck-submit-v1', schemaVersion: 1, participantId: participants[0], seatCapability: 'invalid-seat', deckId: '!', deckText: '1 Plains' })))).toEqual(expect.objectContaining({ status: 400 }));
    expect((await object.fetch(post({ kind: 'online-forming-lobby-start-v1', schemaVersion: 1, hostParticipantId: '', seatCapability: seatCapabilities[0] })))).toEqual(expect.objectContaining({ status: 400 }));
    expect((await object.fetch(post({ kind: 'online-forming-lobby-start-with-table-v1', schemaVersion: 1, hostParticipantId: participants[0], seatCapability: seatCapabilities[0], tableParticipantId: '', tableCapability: 'bad' })))).toEqual(expect.objectContaining({ status: 400 }));
    for (let index = 0; index < 4; index += 1) {
      const deck = await object.fetch(post({ kind: 'online-forming-lobby-deck-submit-v1', schemaVersion: 1, participantId: participants[index], seatCapability: seatCapabilities[index], deckId: `deck-start-${index}`, deckText: '1 Plains' }));
      expect(deck.status).toBe(426);
      expect(await deck.json()).toEqual({ kind: 'online-forming-lobby-upgrade-required-v1', schemaVersion: 1, requiredSchemaVersion: 2 });
      const ready = await object.fetch(post({ kind: 'online-forming-lobby-ready-v1', schemaVersion: 1, participantId: participants[index], seatCapability: seatCapabilities[index], ready: true }));
      expect(ready.status).toBe(426);
      expect(await ready.json()).toEqual({ kind: 'online-forming-lobby-upgrade-required-v1', schemaVersion: 1, requiredSchemaVersion: 2 });
    }
    const started = await object.fetch(post({ kind: 'online-forming-lobby-start-v1', schemaVersion: 1, hostParticipantId: participants[0], seatCapability: seatCapabilities[0] }));
    expect(started.status).toBe(426);
    expect(await started.json()).toEqual({ kind: 'online-forming-lobby-upgrade-required-v1', schemaVersion: 1, requiredSchemaVersion: 2 });
    const tableStarted = await object.fetch(post({ kind: 'online-forming-lobby-start-with-table-v1', schemaVersion: 1, hostParticipantId: participants[0], seatCapability: seatCapabilities[0], tableParticipantId: 'table-start', tableCapability: 'table_' + 'T'.repeat(40) }));
    expect(tableStarted.status).toBe(426);
    expect(await tableStarted.json()).toEqual({ kind: 'online-forming-lobby-upgrade-required-v1', schemaVersion: 1, requiredSchemaVersion: 2 });
    expect((await object.fetch(post({ kind: 'online-forming-lobby-ready-v1', schemaVersion: 1, participantId: participants[0], seatCapability: seatCapabilities[0], ready: 'true' }))).status).toBe(400);
    const afterV1 = await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}/lobby`));
    const afterV2 = await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}/lobby?schemaVersion=2`));
    expect(await afterV1.json()).toEqual(beforeV1Body);
    expect(await afterV2.json()).toEqual(beforeV2Body);
    expect((await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}`))).status).toBe(404);
    storage.close();
  }, 15000);

  it.each(['started', 'finished'] as const)('rejects valid legacy cutoff requests after a %s protocol Room', async (lifecycle) => {
    const storage = new ReviewSqliteStorage();
    const roomId = `room-lobby-${lifecycle}`;
    const seatCapabilities = ['seat_' + 'Q'.repeat(40), 'seat_' + 'R'.repeat(40), 'seat_' + 'S'.repeat(40), 'seat_' + 'T'.repeat(40)] as [string, string, string, string];
    const inviteCapabilities = ['invite_' + 'E'.repeat(40), 'invite_' + 'F'.repeat(40), 'invite_' + 'G'.repeat(40)] as [string, string, string];
    const lobby = createOnlineFormingLobbyV1({ roomId, serverBuildId: 'ordinary-cloudflare-finished-build', hostParticipantId: 'host-finished', seatCapabilities, inviteCapabilities });
    const object = new OnlineRoomDurableObject({ id: { name: roomId }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
    const postLobby = (value: unknown): Request => new Request(`https://room.test/api/online/rooms/${roomId}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    expect((await object.fetch(postLobby({ kind: 'online-forming-lobby-initialize-v1', schemaVersion: 1, lobby }))).status).toBe(200);
    const runtime = object as unknown as { repository: { load: () => { room: { lifecycle: typeof lifecycle } }; loadLobby: () => typeof lobby } };
    runtime.repository = { load: () => ({ room: { lifecycle } }), loadLobby: () => lobby };
    const before = await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}/lobby`));
    const request = await object.fetch(postLobby({ kind: 'online-forming-lobby-deck-submit-v1', schemaVersion: 1, participantId: 'host-finished', seatCapability: seatCapabilities[0], deckId: 'deck-finished', deckText: '1 Plains' }));
    expect(request.status).toBe(400);
    const after = await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}/lobby`));
    expect(await after.json()).toEqual(await before.json());
    storage.close();
  });
});
