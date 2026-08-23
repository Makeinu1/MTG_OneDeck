import { describe, expect, it } from 'vitest';
import { OnlineRoomDurableObject } from '../runtime';
import worker from '../worker';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const ORIGIN = 'https://makeinu1.github.io';
type Json = Record<string, unknown>;

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function harness() {
  const storage = new ReviewSqliteStorage();
  let object: OnlineRoomDurableObject | null = null;
  const env = {
    ONLINE_ROOMS: {
      getByName: (name: string) => {
        object ??= new OnlineRoomDurableObject({
          id: { name }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [],
        });
        return { fetch: (input: Request) => object!.fetch(input) };
      },
    },
  };
  return { storage, env };
}

function assertPublicError(value: unknown, code: string): void {
  expect(value).toMatchObject({ kind: 'online-public-error-v3', schemaVersion: 3, code });
  expect(Object.keys(value as Json).sort()).toEqual([
    'code', 'correlationId', 'kind', 'retryable', 'schemaVersion',
  ]);
  expect(JSON.stringify(value)).not.toMatch(/(?:seat|invite|admission|observer)_[A-Za-z0-9_-]{8}/);
}

describe('O4P-08C Judge: variable Worker and Durable Object runtime', () => {
  it.each([[2, 20], [2, 40], [4, 40]] as const)(
    'creates and reloads exact %i-player/%i-life configuration',
    async (playerCount, startingLife) => {
      const { storage, env } = harness();
      const hostParticipantId = `participant-o4p08c-${playerCount}-${startingLife}`;
      const response = await worker.fetch(post('https://worker.test/api/online/rooms', {
        kind: 'online-forming-lobby-create-v5', schemaVersion: 5,
        participantId: hostParticipantId, playerCount, startingLife,
      }), env);
      expect(response.status).toBe(200);
      const created = await response.json() as Json;
      expect(Object.keys(created).sort()).toEqual([
        'inviteCode', 'kind', 'participantId', 'playerCount', 'projection', 'roomId',
        'schemaVersion', 'seatCapability', 'startingLife', 'tableCapability',
        'tableParticipantId',
      ]);
      expect(created).toMatchObject({
        kind: 'online-forming-lobby-created-v5', schemaVersion: 5,
        participantId: hostParticipantId, playerCount, startingLife,
        projection: { configuration: { playerCount, startingLife } },
      });
      const roomId = String(created.roomId);
      const projection = created.projection as Json;
      expect((projection.seats as unknown[])).toHaveLength(playerCount);
      expect(JSON.stringify(projection)).not.toMatch(/(?:seat|invite|admission|observer)_[A-Za-z0-9_-]{8}/);

      const recovered = await worker.fetch(post(
        `https://worker.test/api/online/rooms/${roomId}/lobby`,
        {
          kind: 'online-forming-lobby-recover-v5', schemaVersion: 5,
          participantId: hostParticipantId, seatCapability: created.seatCapability,
        },
      ), env);
      expect(recovered.status).toBe(200);
      expect(await recovered.json()).toMatchObject({
        kind: 'online-forming-lobby-recovered-v5', schemaVersion: 5,
        roomId, playerCount, startingLife, admissionOpen: true,
        inviteCode: created.inviteCode,
        tableParticipantId: created.tableParticipantId,
        tableCapability: created.tableCapability,
      });
      expect(storage.all(
        'SELECT schema_version, room_id, state_json FROM online_forming_lobby WHERE singleton = 1',
      )).toHaveLength(1);
      storage.close();
    },
  );

  it('uses one shared invite for the exact two seats and keeps non-host recovery secret-free', async () => {
    const { storage, env } = harness();
    const created = await (await worker.fetch(post('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v5', schemaVersion: 5,
      participantId: 'participant-o4p08c-host', playerCount: 2, startingLife: 20,
    }), env)).json() as Json;
    const roomId = String(created.roomId);
    const admissionCapability = String(created.inviteCode).split('.')[2];
    const wrongVersion = await worker.fetch(post(
      `https://worker.test/api/online/rooms/${roomId}/lobby`,
      {
        kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 999,
        participantId: 'participant-o4p08c-wrong-version', admissionCapability,
      },
    ), env);
    expect(wrongVersion.status).toBe(400);
    const claimedResponse = await worker.fetch(post(
      `https://worker.test/api/online/rooms/${roomId}/lobby`,
      {
        kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4,
        participantId: 'participant-o4p08c-guest', admissionCapability,
      },
    ), env);
    expect(claimedResponse.status).toBe(200);
    const claimed = await claimedResponse.json() as Json;
    expect(claimed).toMatchObject({
      kind: 'online-forming-lobby-shared-claimed-v4', schemaVersion: 4,
      roomId, participantId: 'participant-o4p08c-guest',
    });
    expect(claimed).not.toHaveProperty('inviteCode');
    expect(claimed).not.toHaveProperty('tableCapability');

    const deniedKick = await worker.fetch(post(
      `https://worker.test/api/online/rooms/${roomId}/lobby`,
      {
        kind: 'online-forming-lobby-kick-v3', schemaVersion: 3,
        hostParticipantId: 'participant-o4p08c-fake-host',
        seatCapability: `seat_${'f'.repeat(32)}`,
        targetParticipantId: 'participant-o4p08c-guest',
      },
    ), env);
    expect(deniedKick.status).toBe(403);
    assertPublicError(await deniedKick.json(), 'HOST_REQUIRED');

    const recovered = await (await worker.fetch(post(
      `https://worker.test/api/online/rooms/${roomId}/lobby`,
      {
        kind: 'online-forming-lobby-recover-v5', schemaVersion: 5,
        participantId: 'participant-o4p08c-guest', seatCapability: claimed.seatCapability,
      },
    ), env)).json() as Json;
    expect(Object.keys(recovered).sort()).toEqual([
      'kind', 'participantId', 'playerCount', 'projection', 'roomId',
      'schemaVersion', 'startingLife',
    ]);
    expect(recovered).not.toHaveProperty('inviteCode');
    expect(recovered).not.toHaveProperty('tableParticipantId');
    expect(recovered).not.toHaveProperty('tableCapability');

    const full = await worker.fetch(post(
      `https://worker.test/api/online/rooms/${roomId}/lobby`,
      {
        kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4,
        participantId: 'participant-o4p08c-overflow', admissionCapability,
      },
    ), env);
    expect(full.status).toBe(409);
    assertPublicError(await full.json(), 'ROOM_FULL');
    storage.close();
  });

  it('rejects invalid create configurations and extra fields before allocation', async () => {
    const { storage, env } = harness();
    for (const body of [
      { kind: 'online-forming-lobby-create-v5', schemaVersion: 5, participantId: 'host', playerCount: 4, startingLife: 20 },
      { kind: 'online-forming-lobby-create-v5', schemaVersion: 5, participantId: 'host', playerCount: 3, startingLife: 20 },
      { kind: 'online-forming-lobby-create-v5', schemaVersion: 5, participantId: 'host', playerCount: 2, startingLife: 20, extra: true },
    ]) expect((await worker.fetch(post('https://worker.test/api/online/rooms', body), env)).status).toBe(400);
    expect(storage.all('SELECT name FROM sqlite_master WHERE type = ?', 'table')).toEqual([]);
    storage.close();
  });
});
