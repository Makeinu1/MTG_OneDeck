import { readFileSync } from 'node:fs';
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

  it('starts from the four persisted deck submissions and initializes revision zero', async () => {
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
    for (let index = 0; index < 4; index += 1) {
      const deckName = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'][index];
      const projection = JSON.stringify({ kind: 'online-forming-lobby-deck-submit-v1', schemaVersion: 1, participantId: participants[index], seatCapability: seatCapabilities[index], deckId: `deck-start-${index}`, deckText: readFileSync(`Mydeck/${deckName}.txt`, 'utf8') });
      expect((await object.fetch(post(JSON.parse(projection)))).status).toBe(200);
      expect((await object.fetch(post({ kind: 'online-forming-lobby-ready-v1', schemaVersion: 1, participantId: participants[index], seatCapability: seatCapabilities[index], ready: true }))).status).toBe(200);
    }
    storage.failExecWhen = (query) => query.startsWith('UPDATE online_forming_lobby');
    const started = await object.fetch(post({ kind: 'online-forming-lobby-start-v1', schemaVersion: 1, hostParticipantId: participants[0], seatCapability: seatCapabilities[0] }));
    expect(started.status).toBe(400);
    storage.failExecWhen = null;
    const recovered = await object.fetch(post({ kind: 'online-forming-lobby-start-v1', schemaVersion: 1, hostParticipantId: participants[0], seatCapability: seatCapabilities[0] }));
    expect(recovered.status).toBe(200);
    expect((await recovered.json() as Record<string, unknown>).kind).toBe('online-forming-lobby-started-v1');
    expect((await object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}`))).status).toBe(200);
    storage.close();
  }, 15000);
});
