import { describe, expect, it } from 'vitest';
import { OnlineRoomDurableObject } from '../runtime';
import worker from '../worker';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const ORIGIN = 'https://makeinu1.github.io';

type Json = Record<string, unknown>;

function request(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function secretFreeError(value: unknown, expectedCode: string): void {
  expect(value).toMatchObject({
    kind: 'online-public-error-v3', schemaVersion: 3, code: expectedCode,
  });
  const record = value as Json;
  expect(typeof record.retryable).toBe('boolean');
  expect(typeof record.correlationId).toBe('string');
  expect(Object.keys(record).sort()).toEqual(['code', 'correlationId', 'kind', 'retryable', 'schemaVersion']);
  expect(JSON.stringify(value)).not.toMatch(/(?:seat|invite|admission|observer)_[A-Za-z0-9_-]{8}/);
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
  return { storage, env, object: () => object };
}

describe('O4P-08A Judge: Worker and Durable Object membership', () => {
  it('creates one shared invite, claims P2-P4 with it, then reports full', async () => {
    const { storage, env } = harness();
    const createdResponse = await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-host-runtime',
    }), env);
    expect(createdResponse.status).toBe(200);
    const created = await createdResponse.json() as Json;
    expect(created).toMatchObject({
      kind: 'online-forming-lobby-created-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-host-runtime',
      projection: { kind: 'online-forming-lobby-projection-v2' },
    });
    for (const field of ['roomId', 'seatCapability', 'inviteCode', 'tableParticipantId', 'tableCapability']) expect(typeof created[field]).toBe('string');
    expect(String(created.inviteCode)).toMatch(/^v3\./);
    expect(created).not.toHaveProperty('inviteCapabilities');
    const roomId = String(created.roomId);
    const inviteCode = String(created.inviteCode);
    const admissionCapability = inviteCode.split('.')[2];
    expect(admissionCapability).toBeTruthy();
    const seatCapabilities = [String(created.seatCapability)];
    for (let index = 2; index <= 4; index += 1) {
      const participantId = `participant-o4p08a-runtime-${index}`;
      const response = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
        kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3,
        participantId, admissionCapability,
      }), env);
      expect(response.status).toBe(200);
      const claimed = await response.json() as Json;
      expect(claimed).toMatchObject({
        kind: 'online-forming-lobby-shared-claimed-v3', schemaVersion: 3,
        roomId, participantId,
        projection: { kind: 'online-forming-lobby-projection-v2' },
      });
      expect(typeof claimed.seatCapability).toBe('string');
      expect(claimed).not.toHaveProperty('inviteCode');
      expect(claimed).not.toHaveProperty('tableCapability');
      seatCapabilities.push(String(claimed.seatCapability));
    }
    expect(new Set(seatCapabilities).size).toBe(4);
    const full = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-runtime-full', admissionCapability,
    }), env);
    expect(full.status).toBe(409);
    secretFreeError(await full.json(), 'ROOM_FULL');
    storage.close();
  });

  it('rotates/closes admission and recovers host private authority only for the host', async () => {
    const { storage, env } = harness();
    const created = await (await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-host-control',
    }), env)).json() as Json;
    const roomId = String(created.roomId);
    const hostCapability = String(created.seatCapability);
    const oldAdmission = String(created.inviteCode).split('.')[2];

    const rotatedResponse = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-admission-rotate-v3', schemaVersion: 3,
      hostParticipantId: 'participant-o4p08a-host-control', seatCapability: hostCapability,
    }), env);
    expect(rotatedResponse.status).toBe(200);
    const rotated = await rotatedResponse.json() as Json;
    expect(rotated).toMatchObject({ kind: 'online-forming-lobby-admission-rotated-v3', schemaVersion: 3, roomId });
    expect(String(rotated.inviteCode)).toMatch(/^v3\./);
    const nextAdmission = String(rotated.inviteCode).split('.')[2];
    expect(nextAdmission).not.toBe(oldAdmission);

    const oldClaim = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-old', admissionCapability: oldAdmission,
    }), env);
    expect(oldClaim.status).toBe(410);
    secretFreeError(await oldClaim.json(), 'INVITE_ROTATED');

    const recovered = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-recover-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-host-control', seatCapability: hostCapability,
    }), env);
    expect(recovered.status).toBe(200);
    const recoveredV3 = await recovered.json() as Json;
    expect(recoveredV3).toMatchObject({
      kind: 'online-forming-lobby-recovered-v3', schemaVersion: 3, roomId,
      participantId: 'participant-o4p08a-host-control', seatCapability: hostCapability,
      inviteCode: rotated.inviteCode,
      tableParticipantId: created.tableParticipantId,
      tableCapability: created.tableCapability,
    });
    expect(recoveredV3).not.toHaveProperty('admissionOpen');

    const closed = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-admission-close-v3', schemaVersion: 3,
      hostParticipantId: 'participant-o4p08a-host-control', seatCapability: hostCapability,
    }), env);
    expect(closed.status).toBe(200);
    const closedClaim = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-closed', admissionCapability: nextAdmission,
    }), env);
    expect(closedClaim.status).toBe(403);
    secretFreeError(await closedClaim.json(), 'ADMISSION_CLOSED');
    const recoveredClosed = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-recover-v4', schemaVersion: 4,
      participantId: 'participant-o4p08a-host-control', seatCapability: hostCapability,
    }), env);
    expect(await recoveredClosed.json()).toMatchObject({
      kind: 'online-forming-lobby-recovered-v4', schemaVersion: 4, admissionOpen: false,
    });
    storage.close();
  });

  it('kicks only as host, rekeys the seat, clears deck state, and revokes recovery', async () => {
    const { storage, env } = harness();
    const created = await (await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-host-kick',
    }), env)).json() as Json;
    const roomId = String(created.roomId);
    const admissionCapability = String(created.inviteCode).split('.')[2];
    const targetParticipantId = 'participant-o4p08a-kick-target';
    const claim = await (await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3,
      participantId: targetParticipantId, admissionCapability,
    }), env)).json() as Json;
    const targetCapability = String(claim.seatCapability);

    const denied = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-kick-v3', schemaVersion: 3,
      hostParticipantId: targetParticipantId, seatCapability: targetCapability,
      targetParticipantId: 'participant-nobody',
    }), env);
    expect(denied.status).toBe(403);
    secretFreeError(await denied.json(), 'HOST_REQUIRED');

    const kicked = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-kick-v3', schemaVersion: 3,
      hostParticipantId: 'participant-o4p08a-host-kick', seatCapability: created.seatCapability,
      targetParticipantId,
    }), env);
    expect(kicked.status).toBe(200);
    const kickedBody = await kicked.json() as Json;
    expect(kickedBody).toMatchObject({ kind: 'online-forming-lobby-kicked-v3', schemaVersion: 3, roomId });
    const kickedProjection = kickedBody.projection as Json;
    const kickedSeats = kickedProjection.seats as unknown[];
    expect(kickedSeats.some((seat) => {
      const value = seat as Json;
      return value.seatIndex === 1 && value.participantId === null && value.deckState === 'none' && value.ready === false;
    })).toBe(true);
    expect(storage.all('SELECT * FROM online_deck_submission_head_v2 WHERE room_id = ? AND seat_index = 1', roomId)).toEqual([]);
    expect(storage.all('SELECT * FROM online_deck_submission_history_v2 WHERE room_id = ? AND seat_index = 1', roomId)).toEqual([]);
    expect(storage.all('SELECT * FROM online_deck_submission_snapshot_v2 WHERE room_id = ? AND seat_index = 1', roomId)).toEqual([]);
    expect(storage.all('SELECT * FROM online_deck_submission_ready_v2 WHERE room_id = ? AND seat_index = 1', roomId)).toEqual([]);

    const recovery = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-recover-v3', schemaVersion: 3,
      participantId: targetParticipantId, seatCapability: targetCapability,
    }), env);
    expect(recovery.status).toBe(410);
    secretFreeError(await recovery.json(), 'CREDENTIAL_KICKED');

    const replacement = await (await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-replacement', admissionCapability,
    }), env)).json() as Json;
    expect(replacement).toMatchObject({ participantId: 'participant-o4p08a-replacement' });
    expect(replacement.seatCapability).not.toBe(targetCapability);
    storage.close();
  });

  it('keeps malformed v3 and unknown requests on the generic fail-closed boundary', async () => {
    const { storage, env } = harness();
    const created = await (await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-host-malformed',
    }), env)).json() as Json;
    const roomId = String(created.roomId);
    for (const body of [
      { kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3 },
      { kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3, participantId: 'participant-malformed', admissionCapability: 'bad', extra: true },
      { kind: 'online-forming-lobby-unknown-v3', schemaVersion: 3 },
    ]) {
      const response = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, body), env);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ kind: 'online-cloudflare-error-v1' });
    }
    storage.close();
  });

  it('never forwards either internal lobby initializer from a browser origin', async () => {
    let lookups = 0;
    const env = { ONLINE_ROOMS: { getByName: () => { lookups += 1; return { fetch: () => Promise.resolve(new Response('{}')) }; } } };
    for (const kind of ['online-forming-lobby-initialize-v1', 'online-forming-lobby-initialize-v3']) {
      const response = await worker.fetch(request('https://worker.test/api/online/rooms/room-o4p08a-internal/lobby', {
        kind, schemaVersion: kind.endsWith('-v3') ? 3 : 1, lobby: {}, admission: {},
        tableParticipantId: 'table-internal', tableCapability: `observer_${'x'.repeat(40)}`,
      }), env);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ kind: 'online-cloudflare-error-v1' });
    }
    expect(lookups).toBe(0);
  });

  it('returns structured service failure for a valid v3 create that cannot reach storage', async () => {
    const response = await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-service-failure',
    }), {});
    expect(response.status).toBe(503);
    const first = await response.json() as Json;
    secretFreeError(first, 'SERVICE_UNAVAILABLE');
    const second = await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-service-failure-two',
    }), {});
    expect(second.status).toBe(503);
    const secondBody = await second.json() as Json;
    secretFreeError(secondBody, 'SERVICE_UNAVAILABLE');
    expect(secondBody.correlationId).not.toBe(first.correlationId);
    const rejectedBinding = await worker.fetch(request('https://worker.test/api/online/rooms/room-o4p08a-rejected-binding/lobby', {
      kind: 'online-forming-lobby-recover-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-rejected-binding', seatCapability: `seat_${'r'.repeat(40)}`,
    }), { ONLINE_ROOMS: { getByName: () => ({ fetch: () => Promise.reject(new Error('binding failed')) }) } });
    expect(rejectedBinding.status).toBe(503);
    secretFreeError(await rejectedBinding.json(), 'SERVICE_UNAVAILABLE');
  });

  it('allows recovery but rejects every other membership mutation after Room start', async () => {
    const { storage, env, object } = harness();
    const created = await (await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-started-host',
    }), env)).json() as Json;
    const roomId = String(created.roomId);
    const admissionCapability = String(created.inviteCode).split('.')[2];
    const durable = object();
    if (durable === null) throw new Error('missing Durable Object');
    const repository = (durable as unknown as { repository: { load: () => unknown } }).repository;
    repository.load = () => ({ room: { lifecycle: 'active' } });

    const recovered = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-recover-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-started-host', seatCapability: created.seatCapability,
    }), env);
    expect(recovered.status).toBe(200);

    const mutations = [
      { kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3, participantId: 'participant-o4p08a-started-claim', admissionCapability },
      { kind: 'online-forming-lobby-admission-rotate-v3', schemaVersion: 3, hostParticipantId: 'participant-o4p08a-started-host', seatCapability: created.seatCapability },
      { kind: 'online-forming-lobby-admission-close-v3', schemaVersion: 3, hostParticipantId: 'participant-o4p08a-started-host', seatCapability: created.seatCapability },
      { kind: 'online-forming-lobby-kick-v3', schemaVersion: 3, hostParticipantId: 'participant-o4p08a-started-host', seatCapability: created.seatCapability, targetParticipantId: 'participant-o4p08a-started-target' },
      { kind: 'online-forming-lobby-leave-v3', schemaVersion: 3, participantId: 'participant-o4p08a-started-host', seatCapability: created.seatCapability },
    ];
    for (const body of mutations) {
      const response = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, body), env);
      expect(response.status, body.kind).toBe(409);
      secretFreeError(await response.json(), 'INVALID_LIFECYCLE');
    }
    repository.load = () => ({ room: { lifecycle: 'finished' } });
    const finished = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-recover-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-started-host', seatCapability: created.seatCapability,
    }), env);
    expect(finished.status).toBe(410);
    secretFreeError(await finished.json(), 'ROOM_EXPIRED');
    storage.close();
  });

  it('emits RATE_LIMITED/429 from the real v3 mutation guard', async () => {
    const { storage, env, object } = harness();
    const created = await (await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-rate-host',
    }), env)).json() as Json;
    const durable = object();
    if (durable === null) throw new Error('missing Durable Object');
    const mutable = durable as unknown as { lobbyV3WindowStartedAt: number; lobbyV3MutationCount: number };
    mutable.lobbyV3WindowStartedAt = Date.now();
    mutable.lobbyV3MutationCount = 256;
    const limited = await worker.fetch(request(`https://worker.test/api/online/rooms/${String(created.roomId)}/lobby`, {
      kind: 'online-forming-lobby-recover-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-rate-host', seatCapability: created.seatCapability,
    }), env);
    expect(limited.status).toBe(429);
    secretFreeError(await limited.json(), 'RATE_LIMITED');
    storage.close();
  });

  it('emits deck and start blockers as structured v3 failures', async () => {
    const { storage, env, object } = harness();
    const created = await (await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-blocker-host',
    }), env)).json() as Json;
    const roomId = String(created.roomId);
    const ready = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-ready-v2', schemaVersion: 2,
      participantId: 'participant-o4p08a-blocker-host', seatCapability: created.seatCapability, ready: true,
    }), env);
    expect(ready.status).toBe(409);
    secretFreeError(await ready.json(), 'DECK_REQUIRED');
    const start = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-start-with-table-v2', schemaVersion: 2,
      hostParticipantId: 'participant-o4p08a-blocker-host', seatCapability: created.seatCapability,
      tableParticipantId: created.tableParticipantId, tableCapability: created.tableCapability,
    }), env);
    expect(start.status).toBe(409);
    secretFreeError(await start.json(), 'DECK_REQUIRED');
    const durable = object();
    if (durable === null) throw new Error('missing Durable Object');
    const repository = (durable as unknown as { repository: { load: () => unknown } }).repository;
    repository.load = () => ({ room: { lifecycle: 'active' } });
    const readyAfterStart = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-ready-v2', schemaVersion: 2,
      participantId: 'participant-o4p08a-blocker-host', seatCapability: created.seatCapability, ready: true,
    }), env);
    expect(readyAfterStart.status).toBe(409);
    secretFreeError(await readyAfterStart.json(), 'INVALID_LIFECYCLE');
    repository.load = () => ({ room: { lifecycle: 'finished' } });
    const startAfterFinish = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-start-with-table-v2', schemaVersion: 2,
      hostParticipantId: 'participant-o4p08a-blocker-host', seatCapability: created.seatCapability,
      tableParticipantId: created.tableParticipantId, tableCapability: created.tableCapability,
    }), env);
    expect(startAfterFinish.status).toBe(410);
    secretFreeError(await startAfterFinish.json(), 'ROOM_EXPIRED');
    storage.close();
  });

  it('fails host recovery closed when its private Table credentials are missing', async () => {
    const { storage, env } = harness();
    const created = await (await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-table-missing',
    }), env)).json() as Json;
    const roomId = String(created.roomId);
    storage.run('DELETE FROM online_lobby_table_credentials WHERE room_id = ?', roomId);
    const response = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
      kind: 'online-forming-lobby-recover-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-table-missing', seatCapability: created.seatCapability,
    }), env);
    expect(response.status).toBe(503);
    secretFreeError(await response.json(), 'SERVICE_UNAVAILABLE');
    storage.close();
  });

  it('bounds kicked credential history to the newest 64 rows', async () => {
    const { storage, env } = harness();
    const created = await (await worker.fetch(request('https://worker.test/api/online/rooms', {
      kind: 'online-forming-lobby-create-v3', schemaVersion: 3,
      participantId: 'participant-o4p08a-bounded-host',
    }), env)).json() as Json;
    const roomId = String(created.roomId);
    const admissionCapability = String(created.inviteCode).split('.')[2];
    for (let index = 0; index < 70; index += 1) {
      const participantId = `participant-o4p08a-bounded-${index}`;
      const claim = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
        kind: 'online-forming-lobby-shared-claim-v3', schemaVersion: 3,
        participantId, admissionCapability,
      }), env);
      expect(claim.status).toBe(200);
      const kicked = await worker.fetch(request(`https://worker.test/api/online/rooms/${roomId}/lobby`, {
        kind: 'online-forming-lobby-kick-v3', schemaVersion: 3,
        hostParticipantId: 'participant-o4p08a-bounded-host', seatCapability: created.seatCapability,
        targetParticipantId: participantId,
      }), env);
      expect(kicked.status).toBe(200);
    }
    expect(storage.all('SELECT * FROM online_lobby_revoked_credential WHERE room_id = ?', roomId)).toHaveLength(64);
    storage.close();
  });
});
