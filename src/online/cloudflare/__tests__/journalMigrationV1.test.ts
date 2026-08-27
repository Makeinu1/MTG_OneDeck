import { describe, expect, it } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import {
  activateOnlineRoomV1,
  startOnlineRoomV1,
} from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import {
  createOnlineProtocolStateV1,
  handleOnlineCommandEnvelopeV1,
  type OnlineCommandEnvelopeV1,
  type OnlineProtocolStateV1,
} from '../../protocol/index';
import {
  OnlineCloudflareRepository,
  serializeAcceptedCoreCommandV1,
  serializeOnlineCloudflareProtocolStateV1,
} from '../index';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

function protocolState(): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId: 'ordinary-journal-migration-build',
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function envelope(
  state: OnlineProtocolStateV1,
  seatIndex: 0 | 1,
  commandId: string,
): OnlineCommandEnvelopeV1 {
  const playerId = `P${seatIndex + 1}` as 'P1' | 'P2';
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[seatIndex] as never,
    ['participantCapability']: CAPABILITIES[seatIndex] as never,
    commandId: commandId as never,
    baseRevision: state.revision,
    command: createCoreCommandV1({
      schemaVersion: 1,
      sequence: state.revision + 1,
      actorPlayerId: playerId as never,
      decisionMakerPlayerId: playerId as never,
      decisionContext: { kind: 'decision', decisionKey: `ordinary-journal-${state.revision}` },
      payload: {
        kind: 'commander-cast-record',
        physicalCardId: (seatIndex === 0 ? 'PC1' : 'PC3') as never,
        origin: 'command-zone',
        accepted: true,
      },
    }),
  };
}

function acceptedPair(secondCommandId = 'shared-command-id'): Readonly<{
  readonly initial: OnlineProtocolStateV1;
  readonly first: OnlineCommandEnvelopeV1;
  readonly firstState: OnlineProtocolStateV1;
  readonly second: OnlineCommandEnvelopeV1;
  readonly final: OnlineProtocolStateV1;
}> {
  const initial = protocolState();
  const first = envelope(initial, 0, 'shared-command-id');
  const firstTransition = handleOnlineCommandEnvelopeV1(initial, first);
  if (firstTransition.response.kind !== 'online-command-ack-v1' || firstTransition.response.duplicate) throw new Error('First command was not accepted');
  const second = envelope(firstTransition.state, 1, secondCommandId);
  const secondTransition = handleOnlineCommandEnvelopeV1(firstTransition.state, second);
  if (secondTransition.response.kind !== 'online-command-ack-v1' || secondTransition.response.duplicate) throw new Error('Second command was not accepted');
  return Object.freeze({ initial, first, firstState: firstTransition.state, second, final: secondTransition.state });
}

function populateLegacyJournal(
  storage: ReviewSqliteStorage,
  pair: Readonly<{ readonly first: OnlineCommandEnvelopeV1; readonly second: OnlineCommandEnvelopeV1; readonly final: OnlineProtocolStateV1 }>,
): void {
  storage.database.exec('CREATE TABLE online_room_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, revision INTEGER NOT NULL, room_lifecycle TEXT NOT NULL, accepted_command_count INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT');
  storage.database.exec('CREATE TABLE online_accepted_command (accepted_revision INTEGER NOT NULL PRIMARY KEY, command_id TEXT NOT NULL UNIQUE, participant_id TEXT NOT NULL, base_revision INTEGER NOT NULL, command_json TEXT NOT NULL) STRICT');
  storage.run(
    'INSERT INTO online_room_state (singleton, schema_version, room_id, revision, room_lifecycle, accepted_command_count, state_json) VALUES (1, 1, ?, ?, ?, ?, ?)',
    pair.final.room.roomId,
    pair.final.revision,
    pair.final.room.lifecycle,
    pair.final.coreRoot.acceptedCommandCount,
    serializeOnlineCloudflareProtocolStateV1(pair.final),
  );
  const capabilities = [...pair.final.room.seats.map((seat) => seat.seatCapability)];
  for (const [index, command] of [[1, pair.first], [2, pair.second]] as const) {
    storage.run(
      'INSERT INTO online_accepted_command (accepted_revision, command_id, participant_id, base_revision, command_json) VALUES (?, ?, ?, ?, ?)',
      index,
      command.commandId,
      command.participantId,
      command.baseRevision,
      serializeAcceptedCoreCommandV1(command.command, capabilities),
    );
  }
}

describe('accepted-command journal identity and migration', () => {
  it('accepts one command ID per participant and reloads both revisions', () => {
    const storage = new ReviewSqliteStorage();
    try {
      const repository = new OnlineCloudflareRepository(storage);
      const pair = acceptedPair();
      repository.initialize(pair.initial.room.roomId, pair.initial);
      repository.commitAccepted(pair.firstState, pair.first);
      repository.commitAccepted(pair.final, pair.second);
      expect(storage.all<{ accepted_revision: number; command_id: string; participant_id: string }>(
        'SELECT accepted_revision, command_id, participant_id FROM online_accepted_command ORDER BY accepted_revision',
      )).toEqual([
        { accepted_revision: 1, command_id: 'shared-command-id', participant_id: PARTICIPANTS[0] },
        { accepted_revision: 2, command_id: 'shared-command-id', participant_id: PARTICIPANTS[1] },
      ]);
      expect(new OnlineCloudflareRepository(storage, false).load()).toEqual(pair.final);
    } finally {
      storage.close();
    }
  });

  it('migrates an old populated global-command-id table losslessly and idempotently', () => {
    const storage = new ReviewSqliteStorage();
    try {
      const pair = acceptedPair('legacy-second-command-id');
      populateLegacyJournal(storage, pair);
      const repository = new OnlineCloudflareRepository(storage, false);
      expect(repository.migrateApplicationSchema()).toBe(true);
      expect(repository.load()).toEqual(pair.final);
      expect(storage.all<{ accepted_revision: number; command_id: string; participant_id: string }>(
        'SELECT accepted_revision, command_id, participant_id FROM online_accepted_command ORDER BY accepted_revision',
      )).toEqual([
        { accepted_revision: 1, command_id: 'shared-command-id', participant_id: PARTICIPANTS[0] },
        { accepted_revision: 2, command_id: 'legacy-second-command-id', participant_id: PARTICIPANTS[1] },
      ]);
      const schema = storage.all<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'online_accepted_command'")[0]?.sql ?? '';
      expect(schema).toMatch(/UNIQUE\s*\(\s*participant_id\s*,\s*command_id\s*\)/iu);
      expect(schema).not.toMatch(/command_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/iu);
      expect(repository.migrateApplicationSchema()).toBe(false);
      expect(new OnlineCloudflareRepository(storage, false).load()).toEqual(pair.final);
    } finally {
      storage.close();
    }
  });

  it('rolls back the old table when copy verification cannot prove preservation', () => {
    const storage = new ReviewSqliteStorage();
    try {
      const pair = acceptedPair('legacy-second-command-id');
      populateLegacyJournal(storage, pair);
      const beforeRows = storage.all('SELECT * FROM online_accepted_command ORDER BY accepted_revision');
      storage.failExecWhen = (query) => query.includes('FROM online_accepted_command_migration');
      expect(() => new OnlineCloudflareRepository(storage, false).migrateApplicationSchema()).toThrow('forced review SQL failure');
      storage.failExecWhen = null;
      expect(storage.all('SELECT * FROM online_accepted_command ORDER BY accepted_revision')).toEqual(beforeRows);
      const schema = storage.all<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'online_accepted_command'")[0]?.sql ?? '';
      expect(schema).toMatch(/command_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/iu);
    } finally {
      storage.close();
    }
  });

  it('does not permit a same-participant command ID to be reused after migration', () => {
    const storage = new ReviewSqliteStorage();
    try {
      const pair = acceptedPair();
      const repository = new OnlineCloudflareRepository(storage);
      repository.initialize(pair.initial.room.roomId, pair.initial);
      repository.commitAccepted(pair.firstState, pair.first);
      expect(() => storage.run(
        'INSERT INTO online_accepted_command (accepted_revision, command_id, participant_id, base_revision, command_json) VALUES (?, ?, ?, ?, ?)',
        2,
        pair.first.commandId,
        pair.first.participantId,
        pair.first.baseRevision,
        serializeAcceptedCoreCommandV1(pair.first.command, pair.initial.room.seats.map((seat) => seat.seatCapability)),
      )).toThrow();
    } finally {
      storage.close();
    }
  });
});
