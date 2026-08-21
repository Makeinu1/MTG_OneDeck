import { describe, expect, it, vi } from 'vitest';
import { coreSha256HexV1, createCoreCommandV1, type CoreCommandV1 } from '../../../engine/core/index';
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
import { SecuritySqlFixture } from './securitySqlFixture';

class TransactionalSqlStorage extends SecuritySqlFixture {}

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

function envelope(state: OnlineProtocolStateV1, commandId = 'ordinary-cloudflare-command-1'): OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0] as never,
    participantCapability: CAPABILITIES[0] as never,
    commandId: commandId as never,
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

  it('uses a same-version marker across Durable Object construction without replay or a duplicate fact', () => {
    const storage = new TransactionalSqlStorage();
    const version = '11111111-1111-4111-8111-111111111111';
    const target = new OnlineCloudflareRepository(storage, true, version);
    let current = protocolState();
    target.initialize(current.room.roomId, current);
    for (let index = 0; index < 5; index += 1) {
      const acceptedEnvelope = envelope(current, `ordinary-cloudflare-command-${index + 1}`);
      const transition = handleOnlineCommandEnvelopeV1(current, acceptedEnvelope);
      expect(transition.response.kind).toBe('online-command-ack-v1');
      target.commitAccepted(transition.state, acceptedEnvelope);
      current = transition.state;
    }
    storage.queries.splice(0);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const recreated = new OnlineCloudflareRepository(storage, false, version);
      expect(recreated.migrateApplicationSchema()).toBe(false);
      expect(recreated.load()).toEqual(current);
      expect(storage.queries.filter(({ query }) => query.includes('FROM online_accepted_command')).length).toBe(2);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('replays and records one fact for a distinct version, then repairs stale, malformed, and missing markers', () => {
    const storage = new TransactionalSqlStorage();
    const firstVersion = '11111111-1111-4111-8111-111111111111';
    const secondVersion = '22222222-2222-4222-8222-222222222222';
    const first = new OnlineCloudflareRepository(storage, true, firstVersion);
    let current = protocolState();
    first.initialize(current.room.roomId, current);
    for (let index = 0; index < 5; index += 1) {
      const acceptedEnvelope = envelope(current, `ordinary-cloudflare-distinct-${index + 1}`);
      const transition = handleOnlineCommandEnvelopeV1(current, acceptedEnvelope);
      first.commitAccepted(transition.state, acceptedEnvelope);
      current = transition.state;
    }
    storage.recoveryVerification[0].version_identifier = 'malformed-version';
    storage.queries.splice(0);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const second = new OnlineCloudflareRepository(storage, false, secondVersion);
      expect(second.migrateApplicationSchema()).toBe(false);
      expect(second.load()).toEqual(current);
      expect(storage.queries.filter(({ query }) => query.includes('FROM online_accepted_command')).length).toBe(4);
      const facts = log.mock.calls.map(([value]) => JSON.parse(String(value)) as Record<string, unknown>);
      expect(facts.filter((fact) => fact.kind === 'recovery-verification')).toEqual([
        expect.objectContaining({ checkpointRevision: 0, currentRevision: 5, replayCount: 5, outcome: 'ok', versionIdentifier: secondVersion }),
      ]);
      expect(storage.recoveryVerification).toEqual([
        { singleton: 1, room_id: current.room.roomId, version_identifier: secondVersion, verified_revision: 5, checkpoint_revision: 0, journal_count: 5, checkpoint_digest: coreSha256HexV1(storage.checkpoint[0].state_json) },
      ]);
      storage.recoveryVerification = [];
      log.mockClear();
      expect(second.load()).toEqual(current);
      expect(log.mock.calls.filter(([value]) => (JSON.parse(String(value)) as Record<string, unknown>).kind === 'recovery-verification')).toHaveLength(1);
    } finally {
      log.mockRestore();
    }
  });

  it('does not advance the marker when an accepted commit rolls back and still replays revision five', () => {
    const storage = new TransactionalSqlStorage();
    const version = '33333333-3333-4333-8333-333333333333';
    const target = new OnlineCloudflareRepository(storage, true, version);
    let current = protocolState();
    target.initialize(current.room.roomId, current);
    const firstEnvelope = envelope(current, 'ordinary-cloudflare-rollback-1');
    const firstTransition = handleOnlineCommandEnvelopeV1(current, firstEnvelope);
    target.commitAccepted(firstTransition.state, firstEnvelope);
    current = firstTransition.state;
    const markerBefore = storage.recoveryVerification.map((row) => ({ ...row }));
    const rejectedEnvelope = envelope(current, 'ordinary-cloudflare-rollback-2');
    const rejectedTransition = handleOnlineCommandEnvelopeV1(current, rejectedEnvelope);
    storage.failNextRoomUpdate = true;
    expect(() => target.commitAccepted(rejectedTransition.state, rejectedEnvelope)).toThrow('forced room update failure');
    expect(storage.recoveryVerification).toEqual(markerBefore);
    const acceptedEnvelope = envelope(current, 'ordinary-cloudflare-rollback-3');
    const acceptedTransition = handleOnlineCommandEnvelopeV1(current, acceptedEnvelope);
    target.commitAccepted(acceptedTransition.state, acceptedEnvelope);
    current = acceptedTransition.state;
    storage.recoveryVerification[0].verified_revision = 4;
    expect(target.load()).toEqual(current);
    expect(storage.recoveryVerification[0]?.verified_revision).toBe(2);
  });

  it('rolls back initialization and suppresses its success fact when checkpoint verification fails', () => {
    const storage = new TransactionalSqlStorage();
    const version = '44444444-4444-4444-8444-444444444444';
    const target = new OnlineCloudflareRepository(storage, true, version);
    const initial = protocolState();
    storage.failNextCheckpointRead = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      expect(() => target.initialize(initial.room.roomId, initial)).toThrow('forced checkpoint read failure');
      expect(storage.room).toBeNull();
      expect(storage.checkpoint).toEqual([]);
      expect(storage.recoveryVerification).toEqual([]);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('rejects malformed or mismatched checkpoint JSON instead of trusting a matching marker', () => {
    const storage = new TransactionalSqlStorage();
    const version = '55555555-5555-4555-8555-555555555555';
    const target = new OnlineCloudflareRepository(storage, true, version);
    const initial = protocolState();
    target.initialize(initial.room.roomId, initial);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      storage.checkpoint[0].state_json = '{';
      expect(() => target.load()).toThrow();
      expect(log.mock.calls.filter(([value]) => (JSON.parse(String(value)) as Record<string, unknown>).kind === 'recovery-verification')).toHaveLength(0);
      log.mockClear();
      storage.checkpoint[0].state_json = JSON.stringify({ ...initial, room: { ...initial.room, roomId: 'wrong-room' } });
      expect(() => target.load()).toThrow();
      expect(log.mock.calls.filter(([value]) => (JSON.parse(String(value)) as Record<string, unknown>).kind === 'recovery-verification')).toHaveLength(0);
      log.mockClear();
      storage.checkpoint[0].state_json = JSON.stringify({ ...initial, serverBuildId: 'different-valid-build' });
      expect(() => target.load()).toThrow('Recovery state mismatch');
      expect(log.mock.calls.filter(([value]) => (JSON.parse(String(value)) as Record<string, unknown>).kind === 'recovery-verification')).toHaveLength(0);
    } finally {
      log.mockRestore();
    }
  });

  it('suppresses a stale migration fact when another accepted commit changes state before load', () => {
    const storage = new TransactionalSqlStorage();
    const firstVersion = '11111111-1111-4111-8111-111111111111';
    const secondVersion = '22222222-2222-4222-8222-222222222222';
    const first = new OnlineCloudflareRepository(storage, true, firstVersion);
    let current = protocolState();
    first.initialize(current.room.roomId, current);
    for (let index = 0; index < 5; index += 1) {
      const acceptedEnvelope = envelope(current, `ordinary-cloudflare-handoff-${index + 1}`);
      const transition = handleOnlineCommandEnvelopeV1(current, acceptedEnvelope);
      first.commitAccepted(transition.state, acceptedEnvelope);
      current = transition.state;
    }
    const second = new OnlineCloudflareRepository(storage, false, secondVersion);
    expect(second.migrateApplicationSchema()).toBe(false);
    const writer = new OnlineCloudflareRepository(storage, true, secondVersion);
    const nextEnvelope = envelope(current, 'ordinary-cloudflare-handoff-6');
    const nextTransition = handleOnlineCommandEnvelopeV1(current, nextEnvelope);
    writer.commitAccepted(nextTransition.state, nextEnvelope);
    current = nextTransition.state;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      expect(second.load()).toEqual(current);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
