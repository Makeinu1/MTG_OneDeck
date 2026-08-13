import { describe, expect, it } from 'vitest';
import { createCoreCommandV1, type CoreCommandV1 } from '../../../engine/core/index';
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
import { ConflictError, OnlineCloudflareRepository } from '../index';

type Row = Record<string, unknown>;

type RoomRow = {
  singleton: number;
  schema_version: number;
  room_id: string;
  revision: number;
  room_lifecycle: string;
  accepted_command_count: number;
  state_json: string;
};

type JournalRow = {
  accepted_revision: number;
  command_id: string;
  participant_id: string;
  base_revision: number;
  command_json: string;
};

function cursor<T extends Row>(rows: readonly T[]): { toArray(): T[] } {
  return { toArray: () => rows.map((row) => ({ ...row })) };
}

class TransactionalSqlStorage {
  room: RoomRow | null = null;
  journal: JournalRow[] = [];
  readonly queries: Array<Readonly<{ query: string; bindings: readonly unknown[] }>> = [];
  writeCount = 0;
  transactionCount = 0;
  failNextRoomUpdate = false;

  readonly sql = {
    exec: <T extends Row>(query: string, ...bindings: readonly unknown[]) =>
      this.execute<T>(query, bindings),
  };

  transactionSync<T>(callback: () => T): T {
    this.transactionCount += 1;
    const beforeRoom = this.room === null ? null : { ...this.room };
    const beforeJournal = this.journal.map((row) => ({ ...row }));
    const beforeWrites = this.writeCount;
    try {
      return callback();
    } catch (error: unknown) {
      this.room = beforeRoom;
      this.journal = beforeJournal;
      this.writeCount = beforeWrites;
      throw error;
    }
  }

  private execute<T extends Row>(query: string, bindings: readonly unknown[]): { toArray(): T[] } {
    this.queries.push(Object.freeze({ query, bindings: Object.freeze([...bindings]) }));
    if (query.startsWith('CREATE TABLE')) return cursor<T>([]);
    if (query.includes('FROM online_room_state')) {
      return cursor<T>(this.room === null ? [] : ([this.room] as unknown as readonly T[]));
    }
    if (query.includes('FROM online_accepted_command')) {
      return cursor<T>(this.journal as unknown as readonly T[]);
    }
    if (query.startsWith('INSERT INTO online_room_state')) {
      if (this.room !== null) throw new Error('duplicate singleton');
      expect(bindings).toHaveLength(7);
      expect(bindings[0]).toBe(1);
      this.room = {
        singleton: Number(bindings[0]),
        schema_version: Number(bindings[1]),
        room_id: String(bindings[2]),
        revision: Number(bindings[3]),
        room_lifecycle: String(bindings[4]),
        accepted_command_count: Number(bindings[5]),
        state_json: String(bindings[6]),
      };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('INSERT INTO online_accepted_command')) {
      this.journal.push({
        accepted_revision: Number(bindings[0]),
        command_id: String(bindings[1]),
        participant_id: String(bindings[2]),
        base_revision: Number(bindings[3]),
        command_json: String(bindings[4]),
      });
      this.writeCount += 1;
      return cursor<T>([]);
    }
    if (query.startsWith('UPDATE online_room_state')) {
      if (this.failNextRoomUpdate) {
        this.failNextRoomUpdate = false;
        throw new Error('forced room update failure');
      }
      if (this.room === null) throw new Error('missing singleton');
      const roomId = String(bindings[4]);
      const baseRevision = Number(bindings[5]);
      if (this.room.room_id !== roomId || this.room.revision !== baseRevision) {
        throw new Error('compare-and-set mismatch');
      }
      this.room = {
        ...this.room,
        revision: Number(bindings[0]),
        room_lifecycle: String(bindings[1]),
        accepted_command_count: Number(bindings[2]),
        state_json: String(bindings[3]),
      };
      this.writeCount += 1;
      return cursor<T>([]);
    }
    throw new Error(`Unexpected SQL in ordinary fake: ${query}`);
  }
}

function protocolState(serverBuildId = 'ordinary-cloudflare-test-build'): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId,
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function command(state: OnlineProtocolStateV1): CoreCommandV1 {
  return createCoreCommandV1({
    schemaVersion: 1,
    sequence: state.revision + 1,
    actorPlayerId: 'P1' as never,
    decisionMakerPlayerId: 'P1' as never,
    decisionContext: { kind: 'decision', decisionKey: 'ordinary-cloudflare-command' },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: 'PC1' as never,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

function envelope(state: OnlineProtocolStateV1): OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0] as never,
    participantCapability: CAPABILITIES[0] as never,
    commandId: 'ordinary-cloudflare-command-1' as never,
    baseRevision: state.revision,
    command: command(state),
  };
}

describe('O4P-03A persistence surface', () => {
  it('uses the Cloudflare SQL namespace and strict singleton/journal schema', () => {
    const storage = new TransactionalSqlStorage();
    new OnlineCloudflareRepository(storage);
    expect(storage.queries).toHaveLength(2);
    expect(storage.queries.every(({ query }) => query.includes('STRICT'))).toBe(true);
    expect(storage.queries[0]?.query).toMatch(/singleton\s+INTEGER\s+PRIMARY\s+KEY/i);
    expect(storage.queries[0]?.query).toMatch(/CHECK\s*\(\s*singleton\s*=\s*1\s*\)/i);
  });

  it('initializes idempotently, rejects reset, and exposes relation-safe status', () => {
    const storage = new TransactionalSqlStorage();
    const target = new OnlineCloudflareRepository(storage);
    const initial = protocolState();
    expect(target.initialize(initial.room.roomId, initial)).toMatchObject({
      roomId: initial.room.roomId,
      revision: 0,
      acceptedCommandCount: 0,
    });
    const writes = storage.writeCount;
    expect(target.initialize(initial.room.roomId, initial)).toEqual(target.status());
    expect(storage.writeCount).toBe(writes);
    expect(() => target.initialize(initial.room.roomId, protocolState('different-ordinary-build'))).toThrow(ConflictError);
    expect(storage.writeCount).toBe(writes);
    expect(target.load()).toEqual(initial);
  });

  it('commits journal and snapshot atomically with CAS and rolls both back', () => {
    const storage = new TransactionalSqlStorage();
    const target = new OnlineCloudflareRepository(storage);
    const initial = protocolState();
    target.initialize(initial.room.roomId, initial);
    const acceptedEnvelope = envelope(initial);
    const transition = handleOnlineCommandEnvelopeV1(initial, acceptedEnvelope);
    expect(transition.response.kind).toBe('online-command-ack-v1');
    target.commitAccepted(transition.state, acceptedEnvelope);
    expect(storage.journal).toHaveLength(1);
    expect(storage.room?.revision).toBe(1);
    expect(target.load()).toEqual(transition.state);

    const rollbackStorage = new TransactionalSqlStorage();
    const rollbackTarget = new OnlineCloudflareRepository(rollbackStorage);
    rollbackTarget.initialize(initial.room.roomId, initial);
    rollbackStorage.failNextRoomUpdate = true;
    expect(() => rollbackTarget.commitAccepted(transition.state, acceptedEnvelope)).toThrow(
      'forced room update failure',
    );
    expect(rollbackStorage.journal).toEqual([]);
    expect(rollbackTarget.load()).toEqual(initial);
  });

  it('serializes no capability and performs no transaction for a leaking command', () => {
    const storage = new TransactionalSqlStorage();
    const target = new OnlineCloudflareRepository(storage);
    const initial = protocolState();
    target.initialize(initial.room.roomId, initial);
    const acceptedEnvelope = envelope(initial);
    const transition = handleOnlineCommandEnvelopeV1(initial, acceptedEnvelope);
    expect(transition.response.kind).toBe('online-command-ack-v1');
    const leakingEnvelope = {
      ...acceptedEnvelope,
      command: {
        ...acceptedEnvelope.command,
        decisionContext: { kind: 'decision' as const, decisionKey: CAPABILITIES[0] },
      },
    } as OnlineCommandEnvelopeV1;
    const beforeTransactions = storage.transactionCount;
    const beforeWrites = storage.writeCount;
    expect(() => target.commitAccepted(transition.state, leakingEnvelope)).toThrow();
    expect(storage.transactionCount).toBe(beforeTransactions);
    expect(storage.writeCount).toBe(beforeWrites);
    expect(storage.journal).toEqual([]);

    const metadataEnvelope = {
      ...acceptedEnvelope,
      commandId: CAPABILITIES[0].slice(0, 8) as never,
    };
    const metadataTransition = handleOnlineCommandEnvelopeV1(initial, metadataEnvelope);
    expect(metadataTransition.response.kind).toBe('online-command-ack-v1');
    expect(() => target.commitAccepted(metadataTransition.state, metadataEnvelope)).toThrow();
    expect(storage.transactionCount).toBe(beforeTransactions);
    expect(storage.writeCount).toBe(beforeWrites);
    expect(storage.journal).toEqual([]);
  });
});
