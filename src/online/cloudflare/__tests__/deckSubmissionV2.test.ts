import { describe, expect, it } from 'vitest';
import { claimOnlineFormingLobbySeatV1, createOnlineFormingLobbyV1, submitOnlineFormingLobbyDeckV1 } from '../../lobby/index';
import { ConflictError, OnlineCloudflareRepository, OnlineRoomDurableObject } from '../index';
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

  it('clears readiness in a complete ready lobby before fresh host resubmission', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    let current = lobby();
    const participants = [PARTICIPANT, 'participant-1', 'participant-2', 'participant-3'];
    const capabilities = [CAP, 'seat_' + '1'.repeat(32), 'seat_' + '2'.repeat(32), 'seat_' + '3'.repeat(32)];
    for (let index = 1; index < 4; index += 1) {
      current = claimOnlineFormingLobbySeatV1(current, { participantId: participants[index], inviteCapability: `invite_${String(index).repeat(32)}` }).lobby;
    }
    repository.initializeLobby(current);
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    for (let index = 0; index < 4; index += 1) {
      await repository.submitDeckV2(ROOM, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: participants[index], seatCapability: capabilities[index], deckId: `deck-${index}`, submissionId: `submission-${index}`, entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID }] }, resolver);
      repository.setReadyV2(ROOM, participants[index], capabilities[index], true);
    }
    expect(repository.projectLobbyV2(ROOM).lifecycle).toBe('ready');
    const fresh = await repository.submitDeckV2(ROOM, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-0', submissionId: 'submission-host-fresh', entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID }] }, resolver);
    expect(fresh.state).toBe('accepted');
    expect(fresh.projection.lifecycle).toBe('forming');
    expect(fresh.projection.seats[0]?.ready).toBe(false);
    repository.setReadyV2(ROOM, PARTICIPANT, CAP, true);
    const replay = await repository.submitDeckV2(ROOM, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-0', submissionId: 'submission-host-fresh', entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID }] }, resolver);
    expect(replay.state).toBe('accepted');
    expect(replay.projection.seats[0]?.ready).toBe(true);
  });

  it('fails closed on a malformed ready cursor without accepting a stale-ready submission', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initializeLobby(lobby());
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    const initial = { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-cursor', submissionId: 'submission-cursor-initial', entries: [{ section: 'main' as const, quantity: 1, scryfallId: SID, oracleId: OID }] };
    await repository.submitDeckV2(ROOM, initial, resolver);
    repository.setReadyV2(ROOM, PARTICIPANT, CAP, true);
    const originalExec = storage.sql.exec;
    storage.sql.exec = <T extends Record<string, unknown>>(query: string, ...bindings: readonly unknown[]) => {
      if (query.startsWith('UPDATE online_deck_submission_ready_v2')) return { toArray: () => ({ length: 0 } as unknown as T[]) };
      return originalExec<T>(query, ...bindings);
    };
    const fresh = { ...initial, submissionId: 'submission-cursor-fresh' };
    await expect(repository.submitDeckV2(ROOM, fresh, resolver)).rejects.toBeInstanceOf(ConflictError);
    expect(repository.projectLobbyV2(ROOM).seats[0]?.ready).toBe(true);
    expect(repository.loadDeckHeadsV2(ROOM)[0]?.submissionId).toBe(initial.submissionId);
    storage.sql.exec = <T extends Record<string, unknown>>(query: string, ...bindings: readonly unknown[]) => {
      if (query.startsWith('UPDATE online_deck_submission_ready_v2')) {
        const row = { seat_index: 0 };
        Object.setPrototypeOf(row, { evil: true });
        return { toArray: () => [row] as unknown as T[] };
      }
      return originalExec<T>(query, ...bindings);
    };
    await expect(repository.submitDeckV2(ROOM, { ...initial, submissionId: 'submission-cursor-custom-row' }, resolver)).rejects.toBeInstanceOf(ConflictError);
    expect(repository.projectLobbyV2(ROOM).seats[0]?.ready).toBe(true);
    expect(repository.loadDeckHeadsV2(ROOM)[0]?.submissionId).toBe(initial.submissionId);
  });

  it('invalidates accepted readiness when a fresh parse-invalid submission arrives', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initializeLobby(lobby());
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    const initial = { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, deckId: 'deck-invalid', submissionId: 'submission-invalid-initial', entries: [{ section: 'main' as const, quantity: 1, scryfallId: SID, oracleId: OID }] };
    await repository.submitDeckV2(ROOM, initial, resolver);
    repository.setReadyV2(ROOM, PARTICIPANT, CAP, true);
    const conflict = await repository.submitDeckV2(ROOM, { ...initial, entries: [{ section: 'main' as const, quantity: 0, scryfallId: SID, oracleId: OID }] }, resolver);
    expect(conflict.issues[0]?.code).toBe('SUBMISSION_CONFLICT');
    expect(conflict.projection.seats[0]?.ready).toBe(true);
    const invalid = { ...initial, deckId: 'deck-invalid-fresh', submissionId: 'submission-invalid-fresh', entries: [{ section: 'main' as const, quantity: 0, scryfallId: SID, oracleId: OID }] };
    const result = await repository.submitDeckV2(ROOM, invalid, resolver);
    expect(result.state).toBe('needs-attention');
    expect(result.issues[0]?.code).toBe('INVALID_QUANTITY');
    expect(result.projection.seats[0]?.deckState).toBe('needs-attention');
    expect(result.projection.seats[0]?.ready).toBe(false);
    expect(repository.loadDeckSnapshotV2(ROOM, 0)).toBeNull();
    const replay = await repository.submitDeckV2(ROOM, invalid, resolver);
    expect(replay).toEqual(result);
    const changed = await repository.submitDeckV2(ROOM, { ...invalid, entries: [{ section: 'main' as const, quantity: -1, scryfallId: SID, oracleId: OID }] }, resolver);
    expect(changed.issues[0]?.code).toBe('SUBMISSION_CONFLICT');
    expect(repository.loadDeckHeadsV2(ROOM)[0]?.revision).toBe(2);
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
    const ready = await object.fetch(new Request(`https://room.test/api/online/rooms/${ROOM}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-forming-lobby-ready-v2', schemaVersion: 2, participantId: PARTICIPANT, seatCapability: CAP, ready: true }) }));
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ kind: 'online-forming-lobby-ready-v2', schemaVersion: 2, roomId: ROOM });
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

  it('accepts v2-only readiness and starts deterministic dynamic genesis with a table', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    let current = lobby();
    const participants = [PARTICIPANT, 'participant-1', 'participant-2', 'participant-3'];
    const capabilities = [CAP, 'seat_' + '1'.repeat(32), 'seat_' + '2'.repeat(32), 'seat_' + '3'.repeat(32)];
    for (let index = 1; index < 4; index += 1) {
      const claimed = claimOnlineFormingLobbySeatV1(current, { participantId: participants[index], inviteCapability: `invite_${String(index).repeat(32)}` });
      current = claimed.lobby;
    }
    repository.initializeLobby(current);
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    for (let index = 0; index < 4; index += 1) {
      await repository.submitDeckV2(ROOM, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: participants[index], seatCapability: capabilities[index], deckId: `deck-${index}`, submissionId: `submission-${index}`, entries: [{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID }] }, resolver);
      repository.setReadyV2(ROOM, participants[index], capabilities[index], true);
    }
    expect(repository.projectLobbyV2(ROOM).lifecycle).toBe('ready');
    const started = repository.startWithTableV2(ROOM, { hostParticipantId: PARTICIPANT, seatCapability: CAP, tableParticipantId: 'table-v2', tableCapability: 'observer_' + 't'.repeat(32) });
    expect(started).toMatchObject({ outcome: 'started', issue: null, status: { revision: 0, roomLifecycle: 'active' } });
  });
});
