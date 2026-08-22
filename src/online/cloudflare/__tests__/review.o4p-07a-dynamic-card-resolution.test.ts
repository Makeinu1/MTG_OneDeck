import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../../types/card';
import { coreSha256HexV1 } from '../../../engine/core/index';
import { createOnlineFormingLobbyV1 } from '../../lobby/index';
import {
  OnlineCloudflareRepository,
  OnlineDeckScryfallResolverV2,
  parseOnlineDeckSubmitV2,
  resolveOnlineDeckSubmissionV2,
} from '../index';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const ROOM = 'room-o4p07a-review';
const PARTICIPANT = 'participant-o4p07a-review';
const CAPABILITY = `seat_${'a'.repeat(32)}`;
const PRINT_ID = '5da14d86-0780-4821-a799-96f64b377df4';
const ORACLE_ID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';

function lobby() {
  return createOnlineFormingLobbyV1({
    roomId: ROOM,
    serverBuildId: 'build-o4p07a-review',
    hostParticipantId: PARTICIPANT,
    seatCapabilities: [
      CAPABILITY,
      `seat_${'b'.repeat(32)}`,
      `seat_${'c'.repeat(32)}`,
      `seat_${'d'.repeat(32)}`,
    ],
    inviteCapabilities: [
      `invite_${'e'.repeat(32)}`,
      `invite_${'f'.repeat(32)}`,
      `invite_${'0'.repeat(32)}`,
    ],
  });
}

function card(name = 'Review Card'): CardDef {
  return {
    scryfallId: PRINT_ID,
    oracleId: ORACLE_ID,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Creature',
    faces: [{ name, typeLine: 'Creature' }],
  };
}

function request(deckId = 'deck-zeta', submissionId = 'submission-omega') {
  return {
    kind: 'online-forming-lobby-deck-submit-v2',
    schemaVersion: 2,
    participantId: PARTICIPANT,
    seatCapability: CAPABILITY,
    deckId,
    submissionId,
    entries: [{ section: 'main' as const, quantity: 1, scryfallId: PRINT_ID, oracleId: ORACLE_ID }],
  };
}

function generatedUuid(index: number): string {
  return `00000000-0000-0000-0000-${index.toString(16).padStart(12, '0')}`;
}

describe('O4P-07A Judge acceptance', () => {
  it('fails closed on accessors, sparse arrays, and prototype-bearing input', () => {
    let getterReads = 0;
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessor, 'kind', {
      enumerable: true,
      get: () => { getterReads += 1; return 'online-forming-lobby-deck-submit-v2'; },
    });
    for (const [key, value] of Object.entries(request())) {
      if (key !== 'kind') Object.defineProperty(accessor, key, { enumerable: true, value });
    }
    expect(parseOnlineDeckSubmitV2(accessor)).toMatchObject({ ok: false });
    expect(getterReads).toBe(0);

    const sparse = request();
    sparse.entries.length = 2;
    expect(parseOnlineDeckSubmitV2(sparse)).toMatchObject({
      ok: false,
      issues: [{ code: 'EMPTY_LIST', entryIndex: 1 }],
    });

    const inheritedEntry = Object.create({ section: 'main' }) as Record<string, unknown>;
    Object.assign(inheritedEntry, { quantity: 1, scryfallId: PRINT_ID, oracleId: ORACLE_ID });
    expect(parseOnlineDeckSubmitV2({ ...request(), entries: [inheritedEntry] })).toMatchObject({ ok: false });
  });

  it('uses exact sequential 75-card Scryfall batches and preserves 76 identities', async () => {
    const calls: string[][] = [];
    const fetcher: typeof fetch = (_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('missing request body');
      const parsed = JSON.parse(init.body) as { identifiers?: Array<{ id?: unknown }> };
      const ids = parsed.identifiers?.map((entry) => String(entry.id)) ?? [];
      calls.push(ids);
      return Promise.resolve(new Response(JSON.stringify({
        object: 'list',
        data: ids.map((id) => ({
          id,
          oracle_id: id,
          name: `Card ${id}`,
          lang: 'en',
          layout: 'normal',
          cmc: 0,
          color_identity: [],
          type_line: 'Artifact',
        })),
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    };
    const entries = Array.from({ length: 76 }, (_, index) => {
      const id = generatedUuid(index + 1);
      return { section: 'main' as const, quantity: index + 1, scryfallId: id, oracleId: id };
    });
    const resolver = new OnlineDeckScryfallResolverV2(fetcher, undefined, () => Promise.resolve());
    const detailed = await resolver.resolveDetailed(entries);
    expect(calls.map((ids) => ids.length)).toEqual([75, 1]);
    expect([...detailed.definitions.keys()]).toEqual(entries.map((entry) => entry.scryfallId));
    expect(detailed.identityMismatches.size).toBe(0);
  });

  it('keeps Cloudflare native fetch unbound and accepts the verified collection shape', async () => {
    const fetcher: typeof fetch = function (this: unknown) {
      if (this !== undefined) throw new Error('fetcher receiver must be undefined');
      return Promise.resolve(new Response(JSON.stringify({
        object: 'list',
        data: [{
          id: PRINT_ID,
          oracle_id: ORACLE_ID,
          name: 'Verified artifact shape',
          lang: 'en',
          layout: 'normal',
          cmc: 0,
          color_identity: [],
          keywords: [],
          produced_mana: ['W', 'U', 'B', 'R', 'G'],
          type_line: 'Artifact',
          mana_cost: '{0}',
          oracle_text: '{T}, Sacrifice this artifact: Add three mana of any one color.',
          image_uris: { normal: 'https://img.test/normal.jpg', small: 'https://img.test/small.jpg' },
        }],
        not_found: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    };
    const result = await resolveOnlineDeckSubmissionV2(request().entries, new OnlineDeckScryfallResolverV2(fetcher, undefined, () => Promise.resolve()));
    expect(result.issues).toEqual([]);
    expect(result.snapshot?.entries[0]?.definition).toMatchObject({
      scryfallId: PRINT_ID,
      oracleId: ORACLE_ID,
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      faces: [{ typeLine: 'Artifact', manaCost: '{0}' }],
    });
  });

  it('treats malformed optional Scryfall fields as an unavailable authority response', async () => {
    const fetcher: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({
      object: 'list',
      data: [{
        id: PRINT_ID,
        oracle_id: ORACLE_ID,
        name: 'Malformed Card',
        lang: 17,
        layout: 'normal',
        cmc: 1,
        color_identity: [1, 'U'],
        keywords: 'wrong',
        produced_mana: [99],
        type_line: 'Creature',
        power: 123,
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const resolver = new OnlineDeckScryfallResolverV2(fetcher, undefined, () => Promise.resolve());
    await expect(resolveOnlineDeckSubmissionV2(request().entries, resolver)).resolves.toEqual({
      snapshot: null,
      issues: [{ code: 'SCRYFALL_UNAVAILABLE', entryIndex: null, retryable: true }],
    });

    const nullOracleFetcher: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({
      object: 'list',
      data: [{
        id: PRINT_ID,
        oracle_id: null,
        name: 'Null Oracle Card',
        lang: 'en',
        layout: 'normal',
        cmc: 1,
        color_identity: [],
        type_line: 'Creature',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const nullOracleResolver = new OnlineDeckScryfallResolverV2(nullOracleFetcher, undefined, () => Promise.resolve());
    const nullOracleEntry = [{ ...request().entries[0], oracleId: PRINT_ID }];
    await expect(resolveOnlineDeckSubmissionV2(nullOracleEntry, nullOracleResolver)).resolves.toMatchObject({
      issues: [],
      snapshot: { entries: [{ oracleId: PRINT_ID, definition: { oracleId: PRINT_ID } }] },
    });
  });

  it('rejects bearer fragments before mutation and refuses secret-bearing resolved definitions', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initializeLobby(lobby());
    const beforeTransactions = storage.transactionCount;
    const secretDeckId = `deck-${CAPABILITY.slice(8, 16)}`;
    let resolverCalls = 0;
    await expect(repository.submitDeckV2(ROOM, request(secretDeckId), {
      resolve: () => { resolverCalls += 1; return Promise.resolve(new Map([[PRINT_ID, card()]])); },
    })).rejects.toThrow(/Unsafe deck metadata/);
    expect(resolverCalls).toBe(0);
    expect(storage.transactionCount).toBe(beforeTransactions);
    expect(storage.all('SELECT * FROM online_deck_submission_head_v2')).toEqual([]);

    const leakedName = `Card ${CAPABILITY.slice(0, 8)}`;
    await expect(repository.submitDeckV2(ROOM, request('safe-deck', 'secret-definition'), {
      resolve: () => Promise.resolve(new Map([[PRINT_ID, card(leakedName)]])),
    })).rejects.toThrow(/capability data/i);
    expect(repository.loadDeckSnapshotV2(ROOM, 0)).toBeNull();
    expect(JSON.stringify(repository.projectLobbyV2(ROOM))).not.toContain(CAPABILITY);
  });

  it('detects a digest-consistent but structurally corrupt persisted snapshot', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initializeLobby(lobby());
    expect((await repository.submitDeckV2(ROOM, request(), {
      resolve: () => Promise.resolve(new Map([[PRINT_ID, card()]])),
    })).state).toBe('accepted');

    const acceptedSnapshot = repository.loadDeckSnapshotV2(ROOM, 0);
    if (acceptedSnapshot === null) throw new Error('missing accepted snapshot');
    const optionalCorruption = JSON.parse(acceptedSnapshot.serialized) as { entries: Array<{ definition: { keywords?: unknown; faces: Array<{ power?: unknown }> } }> };
    const definition = optionalCorruption.entries[0]?.definition;
    if (definition === undefined || definition.faces[0] === undefined) throw new Error('missing accepted definition');
    definition.keywords = 'wrong-type';
    definition.faces[0].power = 123;
    const optionalSerialized = JSON.stringify(optionalCorruption);
    const optionalDigest = coreSha256HexV1(optionalSerialized);
    storage.run('UPDATE online_deck_submission_snapshot_v2 SET snapshot_digest = ?, snapshot_json = ? WHERE room_id = ? AND seat_index = 0', optionalDigest, optionalSerialized, ROOM);
    storage.run('UPDATE online_deck_submission_head_v2 SET snapshot_digest = ? WHERE room_id = ? AND seat_index = 0', optionalDigest, ROOM);
    expect(() => repository.projectLobbyV2(ROOM)).toThrow(/Invalid v2 snapshot/);

    const corrupt = JSON.stringify({ entries: [] });
    const digest = coreSha256HexV1(corrupt);
    storage.run(
      'UPDATE online_deck_submission_snapshot_v2 SET snapshot_digest = ?, snapshot_json = ? WHERE room_id = ? AND seat_index = 0',
      digest,
      corrupt,
      ROOM,
    );
    storage.run(
      'UPDATE online_deck_submission_head_v2 SET snapshot_digest = ? WHERE room_id = ? AND seat_index = 0',
      digest,
      ROOM,
    );
    expect(() => repository.projectLobbyV2(ROOM)).toThrow(/Invalid v2 snapshot/);
  });

  it('invalidates the CAS token so an in-flight v2 completion cannot overwrite v1', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.initializeLobby(lobby());
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const pending = repository.submitDeckV2(ROOM, request('deck-pending', 'submission-pending'), {
      resolve: async () => { await gate; return new Map([[PRINT_ID, card()]]); },
    });
    const current = repository.loadLobby(ROOM);
    if (current === null) throw new Error('missing resolving lobby');
    const legacy = (await import('../../lobby/index')).submitOnlineFormingLobbyDeckV1(current, {
      participantId: PARTICIPANT,
      seatCapability: CAPABILITY,
      deckId: 'legacy-zeta',
      deckText: '1 Test',
    });
    repository.persistLobby(current, legacy);
    if (release === undefined) throw new Error('resolver did not start');
    release();
    await expect(pending).resolves.toMatchObject({
      state: 'needs-attention',
      issues: [{ code: 'STALE_RESOLUTION' }],
    });
    expect(repository.loadDeckHeadsV2(ROOM)[0]).toMatchObject({ revision: 2, state: 'needs-attention', snapshotDigest: null });
    expect(repository.loadDeckSnapshotV2(ROOM, 0)).toBeNull();
    expect(repository.loadLobby(ROOM)?.seats[0]).toMatchObject({ deckId: 'legacy-zeta', deckText: '1 Test' });
  });

  it('rejects v2 submission after started without mutating the persisted lobby', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    const started = JSON.parse(JSON.stringify(lobby())) as {
      lifecycle: string;
      seats: Array<{ participantId: string | null; inviteCapability: string | null; deckId: string | null; deckText: string | null; ready: boolean }>;
    };
    started.lifecycle = 'started';
    started.seats.forEach((seat, index) => {
      seat.participantId = index === 0 ? PARTICIPANT : `participant-started-${index}`;
      seat.inviteCapability = null;
      seat.deckId = `legacy-started-${index}`;
      seat.deckText = '1 Test';
      seat.ready = true;
    });
    repository.initializeLobby(started as unknown as ReturnType<typeof lobby>);
    const before = repository.loadLobby(ROOM);
    await expect(repository.submitDeckV2(ROOM, request('deck-after-start', 'submission-after-start'), {
      resolve: () => Promise.resolve(new Map([[PRINT_ID, card()]])),
    })).rejects.toThrow(/Started lobby/);
    expect(repository.loadLobby(ROOM)).toEqual(before);
    expect(repository.loadDeckHeadsV2(ROOM)).toEqual([]);
  });

  it('rejects noncanonical history, out-of-range private indices, and missing completion history', async () => {
    const canonicalStorage = new ReviewSqliteStorage();
    const canonicalRepository = new OnlineCloudflareRepository(canonicalStorage);
    canonicalRepository.initializeLobby(lobby());
    await canonicalRepository.submitDeckV2(ROOM, request('deck-canonical', 'submission-canonical'), { resolve: () => Promise.resolve(new Map([[PRINT_ID, card()]])) });
    const history = canonicalStorage.all<{ canonical_input: string }>('SELECT canonical_input FROM online_deck_submission_history_v2')[0];
    if (history === undefined) throw new Error('missing accepted history');
    const parsed = JSON.parse(history.canonical_input) as { deckId: string; entries: unknown };
    const reordered = JSON.stringify({ entries: parsed.entries, deckId: parsed.deckId });
    expect(reordered).not.toBe(history.canonical_input);
    const reorderedDigest = coreSha256HexV1(reordered);
    canonicalStorage.run('UPDATE online_deck_submission_history_v2 SET canonical_input = ?, content_digest = ? WHERE room_id = ? AND seat_index = 0', reordered, reorderedDigest, ROOM);
    canonicalStorage.run('UPDATE online_deck_submission_head_v2 SET content_digest = ? WHERE room_id = ? AND seat_index = 0', reorderedDigest, ROOM);
    const corruptedHistory = canonicalStorage.all<Record<string, unknown>>('SELECT * FROM online_deck_submission_history_v2');
    expect(corruptedHistory).toHaveLength(1);
    expect(corruptedHistory[0]?.canonical_input).toBe(reordered);
    expect(() => canonicalRepository.projectLobbyV2(ROOM)).toThrow(/canonical input/);

    const issueStorage = new ReviewSqliteStorage();
    const issueRepository = new OnlineCloudflareRepository(issueStorage);
    issueRepository.initializeLobby(lobby());
    await issueRepository.submitDeckV2(ROOM, request('deck-issue', 'submission-issue'), { resolve: () => Promise.resolve(new Map()) });
    issueStorage.run("UPDATE online_deck_submission_history_v2 SET issues_json = ? WHERE room_id = ? AND seat_index = 0", JSON.stringify([{ code: 'CARD_NOT_FOUND', entryIndex: 99, retryable: false }]), ROOM);
    expect(() => issueRepository.projectLobbyV2(ROOM)).toThrow(/issue value/);

    const missingStorage = new ReviewSqliteStorage();
    const missingRepository = new OnlineCloudflareRepository(missingStorage);
    missingRepository.initializeLobby(lobby());
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const completing = missingRepository.submitDeckV2(ROOM, request('deck-missing', 'submission-missing'), {
      resolve: async () => { await gate; return new Map([[PRINT_ID, card()]]); },
    });
    missingStorage.run('DELETE FROM online_deck_submission_history_v2 WHERE room_id = ? AND seat_index = 0', ROOM);
    if (release === undefined) throw new Error('resolver did not start');
    release();
    await expect(completing).rejects.toThrow();
    expect(missingRepository.loadDeckHeadsV2(ROOM)[0]).toMatchObject({ state: 'resolving', snapshotDigest: null });
    expect(missingRepository.loadDeckSnapshotV2(ROOM, 0)).toBeNull();
  });
});
