import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../../types/card';
import {
  claimOnlineFormingLobbySeatV1,
  createOnlineFormingLobbyV1,
  projectOnlineFormingLobbyV1,
  submitOnlineFormingLobbyDeckV1,
} from '../../lobby/index';
import { OnlineCloudflareRepository, OnlineRoomDurableObject } from '../index';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const ROOM_ID = 'room-o4p07b-dynamic-review';
const SCRYFALL_ID = '11111111-1111-4111-8111-111111111111';
const ORACLE_ID = '22222222-2222-4222-8222-222222222222';
const PARTICIPANTS = ['participant-1', 'participant-2', 'participant-3', 'participant-4'] as const;
const CAPABILITIES = [
  `seat_${'Q'.repeat(40)}`,
  `seat_${'W'.repeat(40)}`,
  `seat_${'X'.repeat(40)}`,
  `seat_${'Y'.repeat(40)}`,
] as const;
const INVITES = [
  `invite_${'A'.repeat(40)}`,
  `invite_${'B'.repeat(40)}`,
  `invite_${'C'.repeat(40)}`,
] as const;

function definition(): CardDef {
  return {
    scryfallId: SCRYFALL_ID,
    oracleId: ORACLE_ID,
    name: 'Arbitrary Dynamic Card',
    lang: 'en',
    layout: 'transform',
    cmc: 2,
    colorIdentity: ['R'],
    typeLine: 'Creature',
    faces: [
      { name: 'Dynamic Front', typeLine: 'Creature', oracleText: 'Front.' },
      { name: 'Dynamic Back', typeLine: 'Creature', oracleText: 'Back.' },
    ],
  };
}

function fullLobby() {
  let lobby = createOnlineFormingLobbyV1({
    roomId: ROOM_ID,
    serverBuildId: 'o4p-07b-server',
    hostParticipantId: PARTICIPANTS[0],
    seatCapabilities: CAPABILITIES,
    inviteCapabilities: INVITES,
  });
  for (let index = 1; index < 4; index += 1) {
    lobby = claimOnlineFormingLobbySeatV1(lobby, {
      participantId: PARTICIPANTS[index] ?? '',
      inviteCapability: INVITES[index - 1] ?? '',
    }).lobby;
  }
  return lobby;
}

async function prepared(quantity = 1): Promise<{
  readonly storage: ReviewSqliteStorage;
  readonly repository: OnlineCloudflareRepository;
}> {
  const storage = new ReviewSqliteStorage();
  const repository = new OnlineCloudflareRepository(storage);
  repository.initializeLobby(fullLobby());
  const resolver = { resolve: () => Promise.resolve(new Map([[SCRYFALL_ID, definition()]])) };
  for (let index = 0; index < 4; index += 1) {
    await repository.submitDeckV2(ROOM_ID, {
      kind: 'online-forming-lobby-deck-submit-v2',
      schemaVersion: 2,
      participantId: PARTICIPANTS[index],
      seatCapability: CAPABILITIES[index],
      deckId: 'same-arbitrary-deck',
      submissionId: `submission-${index + 1}`,
      entries: [{
        section: index === 1 ? 'commander' : 'main',
        quantity,
        scryfallId: SCRYFALL_ID,
        oracleId: ORACLE_ID,
      }],
    }, resolver);
    repository.setReadyV2(
      ROOM_ID,
      PARTICIPANTS[index] ?? '',
      CAPABILITIES[index] ?? '',
      true,
    );
  }
  return { storage, repository };
}

function tableInput() {
  return {
    hostParticipantId: PARTICIPANTS[0],
    seatCapability: CAPABILITIES[0] ?? '',
    tableParticipantId: 'table-o4p07b-review',
    tableCapability: `observer_${'T'.repeat(40)}`,
  };
}

describe('O4P-07B dynamic Room start Judge acceptance', () => {
  it('starts four identical catalog-external snapshots, persists revision zero, and freezes legacy mutations', async () => {
    const { storage, repository } = await prepared();
    expect(repository.projectLobbyV2(ROOM_ID).lifecycle).toBe('ready');

    const started = repository.startWithTableV2(ROOM_ID, tableInput());
    expect(started).toMatchObject({
      kind: 'online-forming-lobby-start-result-v2',
      schemaVersion: 2,
      roomId: ROOM_ID,
      outcome: 'started',
      issue: null,
      status: { revision: 0, roomLifecycle: 'active', acceptedCommandCount: 0 },
    });
    const state = repository.load();
    expect(state).not.toBeNull();
    expect(repository.projectLobbyV2(ROOM_ID).lifecycle).toBe('started');
    expect(storage.all('SELECT * FROM online_accepted_command')).toEqual([]);

    const restored = new OnlineCloudflareRepository(storage).load();
    expect(restored).toEqual(state);
    const legacyLobby = repository.loadLobby(ROOM_ID);
    if (legacyLobby === null) throw new Error('Missing legacy compatibility lobby');
    const legacyProjection = projectOnlineFormingLobbyV1(legacyLobby);
    expect(legacyProjection.lifecycle).toBe('forming');
    expect(legacyProjection.seats.every((seat) => !seat.deckSubmitted && !seat.ready)).toBe(true);

    const legacyReplacement = submitOnlineFormingLobbyDeckV1(legacyLobby, {
      participantId: PARTICIPANTS[0],
      seatCapability: CAPABILITIES[0] ?? '',
      deckId: 'cached-v1-deck',
      deckText: '1 Cached Card',
    });
    expect(() => repository.persistLobby(legacyLobby, legacyReplacement)).toThrow(
      'Active Room lobby is immutable',
    );
    expect(() => repository.setReadyV2(
      ROOM_ID,
      PARTICIPANTS[0],
      CAPABILITIES[0] ?? '',
      false,
    )).toThrow('Started lobby cannot change readiness');

    const object = new OnlineRoomDurableObject(
      {
        id: { name: ROOM_ID },
        storage,
        acceptWebSocket: () => undefined,
        getWebSockets: () => [],
      },
      {},
      { resolve: () => Promise.resolve(new Map([[SCRYFALL_ID, definition()]])) },
    );
    const cachedResponse = await object.fetch(new Request(
      `https://room.test/api/online/rooms/${ROOM_ID}/lobby`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'online-forming-lobby-deck-submit-v1',
          schemaVersion: 1,
          participantId: PARTICIPANTS[0],
          seatCapability: CAPABILITIES[0],
          deckId: 'cached-v1-deck',
          deckText: '1 Cached Card',
        }),
      },
    ));
    expect(cachedResponse.status).toBe(400);
    expect(repository.load()).toEqual(state);
    storage.close();
  });

  it('returns the known size issue without mutating any accepted snapshot or Room state', async () => {
    const { storage, repository } = await prepared(4_097);
    const beforeHeads = repository.loadDeckHeadsV2(ROOM_ID);
    const beforeProjection = repository.projectLobbyV2(ROOM_ID);
    const beforeSnapshots = [0, 1, 2, 3].map((seatIndex) =>
      repository.loadDeckSnapshotV2(ROOM_ID, seatIndex as 0 | 1 | 2 | 3),
    );

    expect(repository.startWithTableV2(ROOM_ID, tableInput())).toEqual({
      kind: 'online-forming-lobby-start-result-v2',
      schemaVersion: 2,
      roomId: ROOM_ID,
      outcome: 'needs-attention',
      issue: 'ROOM_GENESIS_TOO_LARGE',
      status: null,
    });
    expect(repository.load()).toBeNull();
    expect(repository.loadDeckHeadsV2(ROOM_ID)).toEqual(beforeHeads);
    expect(repository.projectLobbyV2(ROOM_ID)).toEqual(beforeProjection);
    expect([0, 1, 2, 3].map((seatIndex) =>
      repository.loadDeckSnapshotV2(ROOM_ID, seatIndex as 0 | 1 | 2 | 3),
    )).toEqual(beforeSnapshots);
    storage.close();
  });

  it('rejects a table capability that collides with an accepted card snapshot', async () => {
    const { storage, repository } = await prepared();
    expect(() => repository.startWithTableV2(ROOM_ID, {
      ...tableInput(),
      tableCapability: SCRYFALL_ID,
    })).toThrow('Command contains capability data');
    const head = repository.loadDeckHeadsV2(ROOM_ID)[0];
    if (head === undefined || head.snapshotDigest === null) throw new Error('Missing accepted head');
    for (const tableCapability of [head.contentDigest, head.snapshotDigest]) {
      expect(() => repository.startWithTableV2(ROOM_ID, {
        ...tableInput(),
        tableCapability,
      })).toThrow('Command contains capability data');
    }
    expect(repository.load()).toBeNull();
    expect(repository.projectLobbyV2(ROOM_ID).lifecycle).toBe('ready');
    storage.close();
  });

  it('CAS-rejects participant and snapshot relation drift before writing ready', async () => {
    const { storage, repository } = await prepared();
    repository.setReadyV2(ROOM_ID, PARTICIPANTS[0], CAPABILITIES[0], false);
    const beforeHead = repository.loadDeckHeadsV2(ROOM_ID)[0];
    const beforeSnapshot = repository.loadDeckSnapshotV2(ROOM_ID, 0);
    const originalTransaction = storage.transactionSync.bind(storage);
    let inject = true;
    storage.transactionSync = <T>(callback: () => T): T => originalTransaction(() => {
      if (inject) {
        inject = false;
        storage.run(
          'UPDATE online_deck_submission_head_v2 SET participant_id = ? WHERE room_id = ? AND seat_index = 0',
          'participant-drift',
          ROOM_ID,
        );
        storage.run(
          'UPDATE online_deck_submission_snapshot_v2 SET snapshot_digest = ? WHERE room_id = ? AND seat_index = 0',
          'f'.repeat(64),
          ROOM_ID,
        );
      }
      return callback();
    });

    expect(() => repository.setReadyV2(
      ROOM_ID,
      PARTICIPANTS[0],
      CAPABILITIES[0],
      true,
    )).toThrow();
    expect(repository.loadDeckHeadsV2(ROOM_ID)[0]).toEqual(beforeHead);
    expect(repository.loadDeckSnapshotV2(ROOM_ID, 0)).toEqual(beforeSnapshot);
    expect(repository.projectLobbyV2(ROOM_ID).seats[0].ready).toBe(false);
    storage.close();
  });

  it('fails closed when valid legacy deck metadata is restored beside a v2 head', async () => {
    const { storage, repository } = await prepared();
    const lobby = repository.loadLobby(ROOM_ID);
    if (lobby === null) throw new Error('Missing lobby');
    const mixed = submitOnlineFormingLobbyDeckV1(lobby, {
      participantId: PARTICIPANTS[0],
      seatCapability: CAPABILITIES[0],
      deckId: 'legacy-mixed-deck',
      deckText: '1 Legacy Mixed Card',
    });
    storage.run(
      'UPDATE online_forming_lobby SET state_json = ? WHERE singleton = 1 AND room_id = ?',
      JSON.stringify(mixed),
      ROOM_ID,
    );

    expect(() => repository.projectLobbyV2(ROOM_ID)).toThrow('Mixed v1/v2 deck relation');
    expect(() => repository.startWithTableV2(ROOM_ID, tableInput())).toThrow(
      'Mixed v1/v2 deck relation',
    );
    expect(repository.load()).toBeNull();
    storage.close();
  });

  it('CAS-rejects a head replacement between preflight and the initialization transaction', async () => {
    const { storage, repository } = await prepared();
    const beforeHead = repository.loadDeckHeadsV2(ROOM_ID)[0];
    const originalTransaction = storage.transactionSync.bind(storage);
    let inject = true;
    storage.transactionSync = <T>(callback: () => T): T => originalTransaction(() => {
      if (inject) {
        inject = false;
        storage.run(
          'UPDATE online_deck_submission_head_v2 SET participant_id = ? WHERE room_id = ? AND seat_index = 0',
          'participant-drift',
          ROOM_ID,
        );
      }
      return callback();
    });

    expect(() => repository.startWithTableV2(ROOM_ID, tableInput())).toThrow();
    expect(repository.load()).toBeNull();
    expect(repository.loadDeckHeadsV2(ROOM_ID)[0]).toEqual(beforeHead);
    expect(repository.projectLobbyV2(ROOM_ID).lifecycle).toBe('ready');
    storage.close();
  });
});
