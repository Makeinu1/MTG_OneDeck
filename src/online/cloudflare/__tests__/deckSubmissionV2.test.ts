import { describe, expect, it } from 'vitest';
import { createOnlineFormingLobbyV1, submitOnlineFormingLobbyDeckV1 } from '../../lobby/index';
import { OnlineCloudflareRepository, OnlineRoomDurableObject } from '../index';
import { ReviewSqliteStorage } from './reviewSqliteStorage';
import type { CardDef } from '../../../types/card';

const ROOM = 'room-v2';
const PARTICIPANT = 'participant-v2';
const CAP = 'seat_' + 'v'.repeat(32);
const SID = '5da14d86-0780-4821-a799-96f64b377df4';
const OID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';

function lobby() {
  return createOnlineFormingLobbyV1({ roomId: ROOM, serverBuildId: 'build-v2', hostParticipantId: PARTICIPANT, seatCapabilities: [CAP, 'seat_' + '1'.repeat(32), 'seat_' + '2'.repeat(32), 'seat_' + '3'.repeat(32)], inviteCapabilities: ['invite_' + '1'.repeat(32), 'invite_' + '2'.repeat(32), 'invite_' + '3'.repeat(32)] });
}

function card(): CardDef {
  return { scryfallId: SID, oracleId: OID, name: 'V2 Card', lang: 'en', layout: 'normal', cmc: 1, colorIdentity: [], typeLine: 'Creature', faces: [{ name: 'V2 Card', typeLine: 'Creature' }] };
}

describe('Cloudflare v2 deck persistence', () => {
  it('stores an accepted seat-scoped head/snapshot and replays identical submission', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.migrateApplicationSchema();
    repository.initializeLobby(lobby());
    const request = { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-v2', submissionId: 'submission-v2', entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID }] };
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    const accepted = await repository.submitDeckV2(ROOM, request, resolver);
    expect(accepted.state).toBe('accepted');
    expect(repository.loadDeckHeadsV2(ROOM)[0]?.snapshotDigest).toMatch(/^[0-9a-f]{64}$/);
    const replay = await repository.submitDeckV2(ROOM, request, resolver);
    expect(replay).toEqual(accepted);
    expect(JSON.stringify(replay)).not.toContain(CAP);
  });

  it('serves the v2 safe projection and private result over the Durable Object route', async () => {
    const storage = new ReviewSqliteStorage();
    const object = new OnlineRoomDurableObject({ id: { name: ROOM }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [] }, {}, { resolve: () => Promise.resolve(new Map([[SID, card()]])) });
    const initialLobby = lobby();
    const initialize = await object.fetch(new Request(`https://room.test/api/online/rooms/${ROOM}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-initialize-v1', schemaVersion: 1, lobby: initialLobby }) }));
    expect(initialize.status).toBe(200);
    const submit = await object.fetch(new Request(`https://room.test/api/online/rooms/${ROOM}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-http', submissionId: 'submission-http', entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID }] }) }));
    expect(submit.status).toBe(200);
    const result = await submit.json() as { state?: unknown; projection?: Record<string, unknown> };
    expect(result.state).toBe('accepted');
    expect(JSON.stringify(result)).not.toContain(CAP);
    const projection = await object.fetch(new Request(`https://room.test/api/online/rooms/${ROOM}/lobby?schemaVersion=2`));
    expect(projection.status).toBe(200);
    expect(JSON.stringify(await projection.json())).not.toContain(SID);
  });

  it('upgrades a legacy application marker only after v2 tables exist', () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.migrateApplicationSchema();
    repository.initializeLobby(lobby());
    storage.run('UPDATE online_application_migration SET schema_version = 1 WHERE singleton = 1');
    expect(repository.migrateApplicationSchema()).toBe(true);
    expect(storage.all<{ schema_version: number }>('SELECT schema_version FROM online_application_migration')).toEqual([{ schema_version: 2 }]);
  });

  it('authenticates before structured validation and reports the current none state without mutation', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initializeLobby(lobby());
    const resolver = { resolve: () => Promise.reject(new Error('must not resolve')) };
    const empty = { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-empty', submissionId: 'submission-empty', entries: [] };
    const before = storage.transactionCount;
    const result = await repository.submitDeckV2(ROOM, empty, resolver);
    expect(result.state).toBe('none');
    expect(result.issues[0]?.code).toBe('EMPTY_LIST');
    expect(storage.transactionCount).toBe(before);
    await expect(repository.submitDeckV2(ROOM, { ...empty, participantId: 'other', entries: [] }, resolver)).rejects.toThrow('Seat authorization');
    await expect(repository.submitDeckV2(ROOM, { ...empty, entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID, extra: true }] }, resolver)).rejects.toThrow('shape');
    const beforeSecret = storage.transactionCount;
    await expect(repository.submitDeckV2(ROOM, { ...empty, deckId: CAP }, resolver)).rejects.toThrow('Unsafe deck metadata');
    expect(storage.transactionCount).toBe(beforeSecret);
    expect(JSON.stringify(repository.loadDeckHeadsV2(ROOM))).not.toContain(CAP);
  });

  it('mutually invalidates a v2 snapshot when the same seat submits v1 metadata', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    const initial = lobby();
    repository.initializeLobby(initial);
    const request = { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-mutual', submissionId: 'submission-mutual', entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID }] };
    await repository.submitDeckV2(ROOM, request, { resolve: () => Promise.resolve(new Map([[SID, card()]])) });
    const current = repository.loadLobby(ROOM);
    if (current === null) throw new Error('missing lobby');
    const next = submitOnlineFormingLobbyDeckV1(current, { participantId: PARTICIPANT, seatCapability: CAP, deckId: 'legacy-deck', deckText: '1 Test' });
    repository.persistLobby(current, next);
    expect(repository.loadDeckSnapshotV2(ROOM, 0)).toBeNull();
    expect(repository.loadDeckHeadsV2(ROOM)[0]?.state).toBe('needs-attention');
    const replay = await repository.submitDeckV2(ROOM, request, { resolve: () => Promise.reject(new Error('must not resolve')) });
    expect(replay.issues[0]?.code).toBe('STALE_RESOLUTION');
  });

  it('deduplicates concurrent same-submission resolution and reuses the persisted result', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initializeLobby(lobby());
    let calls = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const resolver = { resolve: async () => { calls += 1; await gate; return new Map([[SID, card()]]); } };
    const request = { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-concurrent', submissionId: 'submission-concurrent', entries: [{ section: 'commander', quantity: 3, scryfallId: SID, oracleId: OID }, { section: 'main', quantity: 7, scryfallId: SID, oracleId: OID }] };
    const first = repository.submitDeckV2(ROOM, request, resolver);
    const second = repository.submitDeckV2(ROOM, request, resolver);
    if (release === undefined) throw new Error('resolver did not start');
    release();
    const results = await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]?.state).toBe('accepted');
  });

  it('rolls back begin CAS when the lobby write fails', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    const initial = lobby();
    repository.initializeLobby(initial);
    storage.failExecWhen = (query) => query.startsWith('UPDATE online_forming_lobby');
    const request = { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-rollback', submissionId: 'submission-rollback', entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID }] };
    await expect(repository.submitDeckV2(ROOM, request, { resolve: () => Promise.resolve(new Map([[SID, card()]])) })).rejects.toThrow();
    storage.failExecWhen = null;
    expect(repository.loadDeckHeadsV2(ROOM)).toEqual([]);
    expect(repository.loadLobby(ROOM)).toEqual(initial);
  });
});
