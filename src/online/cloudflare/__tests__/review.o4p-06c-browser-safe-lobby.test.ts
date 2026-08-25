import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  claimOnlineFormingLobbySeatV1,
  createOnlineFormingLobbyV1,
  projectOnlineFormingLobbyV1,
  setOnlineFormingLobbySeatReadyV1,
  submitOnlineFormingLobbyDeckV1,
} from '../../lobby/index';
import { startOnlineFormingLobbyV1 } from '../../lobby/fixtures/fixedStartV1';
import worker from '../worker';

const ORIGIN = 'https://makeinu1.github.io';
const capabilities = [
  'seat_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'seat_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'seat_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  'seat_DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
] as const;
const invites = [
  'invite_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'invite_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  'invite_DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
] as const;

function createLobby(): ReturnType<typeof createOnlineFormingLobbyV1> {
  return createOnlineFormingLobbyV1({
    roomId: 'room-o4p-06c-review',
    serverBuildId: 'o4p-06c-review-build',
    hostParticipantId: 'participant-host',
    seatCapabilities: capabilities,
    inviteCapabilities: invites,
  });
}

describe('O4P-06C browser-safe lobby and invite boundary', () => {
  it('keeps exact-origin preflight and rejection at the Worker boundary', async () => {
    let lookups = 0;
    const env = {
      ONLINE_ROOMS: {
        getByName: () => {
          lookups += 1;
          return { fetch: () => Promise.resolve(new Response('{}', { status: 200 })) };
        },
      },
    };
    const preflight = await worker.fetch(new Request(
      'https://worker.test/api/online/rooms/room-o4p-06c-review/lobby',
      {
        method: 'OPTIONS',
        headers: {
          origin: ORIGIN,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      },
    ), env);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
    expect(preflight.headers.get('vary')).toContain('Origin');
    expect(lookups).toBe(0);

    for (const headers of [
      {
        origin: ORIGIN,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      },
      {
        origin: ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization',
      },
    ]) {
      const rejectedPreflight = await worker.fetch(new Request(
        'https://worker.test/api/online/rooms',
        { method: 'OPTIONS', headers },
      ), env);
      expect(rejectedPreflight.status).toBe(400);
    }
    expect(lookups).toBe(0);

    for (const origin of [
      'null',
      'https://makeinu1.github.io.evil.test',
      'https://evil.test/?next=https://makeinu1.github.io',
      'http://localhost:5174',
      'https://user:pass@makeinu1.github.io',
    ]) {
      const rejected = await worker.fetch(new Request(
        'https://worker.test/api/online/rooms/room-o4p-06c-review/lobby',
        { headers: { origin } },
      ), env);
      expect(rejected.status, origin).toBe(403);
      expect(rejected.headers.get('access-control-allow-origin'), origin).toBeNull();
    }
    expect(lookups).toBe(0);

    const publicImport = await worker.fetch(new Request(
      'https://worker.test/api/online/rooms/room-o4p-06c-review',
      { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{}' },
    ), env);
    expect(publicImport.status).toBe(405);
    expect(lookups).toBe(0);
  });

  it('claims four seats and projects no invite, bearer, or deck contents', { timeout: 10000 }, () => {
    let lobby = createLobby();
    const participants = ['participant-host', 'participant-two', 'participant-three', 'participant-four'];
    for (let index = 1; index < 4; index += 1) {
      const claimed = claimOnlineFormingLobbySeatV1(lobby, {
        participantId: participants[index],
        inviteCapability: invites[index - 1],
      });
      lobby = claimed.lobby;
      expect(claimed.seatCapability).toBe(capabilities[index]);
    }
    const beforeReplay = JSON.stringify(lobby);
    expect(() => claimOnlineFormingLobbySeatV1(lobby, {
      participantId: 'participant-replay',
      inviteCapability: invites[0],
    })).toThrow();
    expect(JSON.stringify(lobby)).toBe(beforeReplay);

    const decks = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'].map((name) => ({
      deckId: `deck-${name.toLowerCase()}`,
      deckText: readFileSync(`Mydeck/${name}.txt`, 'utf8'),
    }));
    for (let index = 0; index < 4; index += 1) {
      const participantId = participants[index];
      const seatCapability = capabilities[index];
      const deck = decks[index];
      if (participantId === undefined || seatCapability === undefined || deck === undefined) {
        throw new Error('Incomplete four-seat review fixture');
      }
      lobby = submitOnlineFormingLobbyDeckV1(lobby, {
        participantId,
        seatCapability,
        ...deck,
      });
      lobby = setOnlineFormingLobbySeatReadyV1(lobby, {
        participantId,
        seatCapability,
        ready: true,
      });
    }
    expect(lobby.lifecycle).toBe('ready');
    const started = startOnlineFormingLobbyV1(lobby, {
      hostParticipantId: participants[0],
      seatCapability: capabilities[0],
    });
    expect(started.lobby.lifecycle).toBe('started');
    expect(started.genesis.ok).toBe(true);
    if (!started.genesis.ok) throw new Error('Review bootstrap unexpectedly failed');
    expect(started.genesis.protocolState.revision).toBe(0);
    expect(started.genesis.protocolState.room.lifecycle).toBe('active');
    const projected = JSON.stringify(projectOnlineFormingLobbyV1(lobby));
    expect(projected).not.toMatch(/inviteCapability|seatCapability|deckText/);
    for (const secret of [...capabilities, ...invites]) expect(projected).not.toContain(secret);
    for (const deck of decks) expect(projected).not.toContain(deck.deckText.slice(0, 32));
    expect(Object.isFrozen(lobby)).toBe(true);
    expect(Object.isFrozen(lobby.seats)).toBe(true);
  });

  it('emits the exact secret-free request facts for create and lobby routes', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const env = {
      ONLINE_ROOMS: {
        getByName: () => ({
          fetch: () => Promise.resolve(new Response(JSON.stringify({ projection: {} }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })),
        }),
      },
    };
    const created = await worker.fetch(new Request('https://worker.test/api/online/rooms', {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'online-forming-lobby-create-v1',
        schemaVersion: 1,
        participantId: 'participant-fact-host',
      }),
    }), env);
    expect(created.status).toBe(200);
    const lobby = await worker.fetch(new Request(
      'https://worker.test/api/online/rooms/room-fact-review/lobby',
      { headers: { origin: ORIGIN } },
    ), env);
    expect(lobby.status).toBe(200);
    const facts = log.mock.calls.map(([value]) => JSON.parse(String(value)) as Record<string, unknown>);
    expect(facts).toHaveLength(2);
    expect(facts[0]).toMatchObject({ kind: 'worker-request', action: 'create', methodClass: 'POST', status: 200, outcome: 'ok' });
    expect(facts[1]).toEqual({
      kind: 'worker-request',
      roomId: 'room-fact-review',
      action: 'lobby',
      methodClass: 'GET',
      status: 200,
      outcome: 'ok',
      versionIdentifier: null,
    });
    expect(JSON.stringify(facts)).not.toMatch(/seat_|invite_|participant-fact-host/);
  });
});
