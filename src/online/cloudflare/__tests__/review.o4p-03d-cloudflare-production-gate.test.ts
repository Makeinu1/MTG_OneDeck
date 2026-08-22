import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCoreCommandV1 } from '../../../engine/core/index';
import {
  activateOnlineRoomV1,
  disconnectOnlineRoomParticipantV1,
  startOnlineRoomV1,
} from '../../room/index';
import {
  CAPABILITIES,
  CORE_PLAYERS,
  PARTICIPANTS,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import {
  createOnlineProtocolStateV1,
  handleOnlineCommandEnvelopeV1,
  handleOnlineClientHelloV1,
  type OnlineCommandEnvelopeV1,
  type OnlineProtocolStateV1,
} from '../../protocol/index';
import {
  ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2,
  OnlineCloudflareRepository,
  OnlineRoomDurableObject,
  onlineCloudflareWorker,
  serializeOnlineCloudflareProtocolStateV1,
  type OnlineCloudflareDurableObjectState,
  type OnlineCloudflareEnv,
} from '../index';
import {
  emitFailureFactV1,
  emitRecoveryFactV1,
  emitRuntimeStartFactV1,
  emitWebSocketFactV1,
  emitWorkerRequestFactV1,
} from '../facts';
import { OnlineCloudflareSecurityRepository } from '../security';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const openStorages: ReviewSqliteStorage[] = [];
const VERSION_ID = '01234567-89ab-4cde-8fab-0123456789ab';
const ROOM_ID = 'o4p03d-review-room-correlation';
const PHYSICAL_CARDS = ['PC1', 'PC3', 'PC6', 'PC5'] as const;

function storage(): ReviewSqliteStorage {
  const value = new ReviewSqliteStorage();
  openStorages.push(value);
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const value of openStorages.splice(0)) value.close();
});

function state(): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId: 'review-o4p-03d-build',
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function createLegacyProtocolSchema(target: ReviewSqliteStorage, value: OnlineProtocolStateV1): void {
  target.database.exec('CREATE TABLE online_room_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, revision INTEGER NOT NULL, room_lifecycle TEXT NOT NULL, accepted_command_count INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT');
  target.database.exec('CREATE TABLE online_accepted_command (accepted_revision INTEGER NOT NULL PRIMARY KEY, command_id TEXT NOT NULL UNIQUE, participant_id TEXT NOT NULL, base_revision INTEGER NOT NULL, command_json TEXT NOT NULL) STRICT');
  target.run(
    'INSERT INTO online_room_state (singleton, schema_version, room_id, revision, room_lifecycle, accepted_command_count, state_json) VALUES (1, 1, ?, ?, ?, ?, ?)',
    value.room.roomId,
    value.revision,
    value.room.lifecycle,
    value.coreRoot.acceptedCommandCount,
    serializeOnlineCloudflareProtocolStateV1(value),
  );
}

function envelope(value: OnlineProtocolStateV1, seatIndex: number): OnlineCommandEnvelopeV1 {
  const commandId = `review-o4p-03d-${value.revision + 1}`;
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: value.protocolVersion,
    roomId: value.room.roomId,
    participantId: PARTICIPANTS[seatIndex] as never,
    participantCapability: CAPABILITIES[seatIndex] as never,
    commandId: commandId as never,
    baseRevision: value.revision,
    command: createCoreCommandV1({
      schemaVersion: 1,
      sequence: value.revision + 1,
      actorPlayerId: CORE_PLAYERS[seatIndex] as never,
      decisionMakerPlayerId: CORE_PLAYERS[seatIndex] as never,
      decisionContext: { kind: 'decision', decisionKey: commandId },
      payload: {
        kind: 'commander-cast-record',
        physicalCardId: PHYSICAL_CARDS[seatIndex] as never,
        origin: 'command-zone',
        accepted: true,
      },
    }),
  };
}

function securitySnapshot(target: ReviewSqliteStorage): unknown {
  return {
    state: target.all('SELECT * FROM online_security_state ORDER BY singleton'),
    grants: target.all('SELECT * FROM online_capability_grant ORDER BY participant_id'),
    leases: target.all('SELECT * FROM online_controller_lease ORDER BY participant_id'),
    audit: target.all('SELECT * FROM online_security_audit ORDER BY audit_id'),
  };
}

describe('O4P-03D Judge production gate', () => {
  it('uses only the exact workers.dev SQLite Durable Object configuration', () => {
    const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8')) as Record<string, unknown>;
    expect(config).toEqual({
      name: 'mtg-onedeck-online',
      main: 'src/online/cloudflare/worker.ts',
      compatibility_date: '2026-08-13',
      workers_dev: true,
      observability: { enabled: true, head_sampling_rate: 1 },
      version_metadata: { binding: 'CF_VERSION_METADATA' },
      durable_objects: {
        bindings: [{ name: 'ONLINE_ROOMS', class_name: 'OnlineRoomDurableObject' }],
      },
      exports: {
        OnlineRoomDurableObject: { type: 'durable-object', storage: 'sqlite' },
      },
    });
    const serialized = JSON.stringify(config);
    expect(serialized).not.toMatch(/account_id|zone_id|routes|migrations|token|secret/i);
  });

  it('atomically migrates a valid pre-security Room and is byte-idempotent once current', () => {
    const target = storage();
    const initial = state();
    createLegacyProtocolSchema(target, initial);
    const repository = new OnlineCloudflareRepository(target);
    expect(repository.migrateApplicationSchema()).toBe(true);
    expect(target.all('SELECT * FROM online_application_migration')).toEqual([
      { singleton: 1, schema_version: ONLINE_CLOUDFLARE_APPLICATION_SCHEMA_VERSION_V2 },
    ]);
    expect(target.all('SELECT room_id, checkpoint_revision, state_json FROM online_recovery_checkpoint')).toEqual([
      {
        room_id: initial.room.roomId,
        checkpoint_revision: 0,
        state_json: serializeOnlineCloudflareProtocolStateV1(initial),
      },
    ]);
    expect(target.all<{ participant_id: string; authority: string; generation: number }>(
      'SELECT participant_id, authority, generation FROM online_capability_grant ORDER BY rowid',
    )).toEqual([
      { participant_id: PARTICIPANTS[0], authority: 'host', generation: 0 },
      { participant_id: PARTICIPANTS[1], authority: 'seat', generation: 0 },
      { participant_id: PARTICIPANTS[2], authority: 'seat', generation: 0 },
      { participant_id: PARTICIPANTS[3], authority: 'seat', generation: 0 },
    ]);
    expect(repository.load()).toEqual(initial);

    const security = new OnlineCloudflareSecurityRepository(target);
    security.rotate(initial, PARTICIPANTS[0], CAPABILITIES[0], `rotation_${'R'.repeat(40)}`, Date.now() + 1);
    const before = JSON.stringify({
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
      checkpoint: target.all('SELECT * FROM online_recovery_checkpoint'),
      security: securitySnapshot(target),
    });
    expect(repository.migrateApplicationSchema()).toBe(false);
    expect(JSON.stringify({
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
      checkpoint: target.all('SELECT * FROM online_recovery_checkpoint'),
      security: securitySnapshot(target),
    })).toBe(before);
  });

  it('rolls back every additive table and row when legacy grant migration fails', () => {
    const target = storage();
    const initial = state();
    createLegacyProtocolSchema(target, initial);
    const before = JSON.stringify({
      tables: target.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"),
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
    });
    const repository = new OnlineCloudflareRepository(target);
    target.failExecWhen = (query, bindings) =>
      query.startsWith('INSERT INTO online_capability_grant') && bindings[1] === PARTICIPANTS[1];
    expect(() => repository.migrateApplicationSchema()).toThrow('forced review SQL failure');
    target.failExecWhen = null;
    expect(JSON.stringify({
      tables: target.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"),
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
    })).toBe(before);
  });

  it('validates an existing checkpoint inside migration and rolls back every additive change', () => {
    const target = storage();
    const initial = state();
    createLegacyProtocolSchema(target, initial);
    target.database.exec('CREATE TABLE online_recovery_checkpoint (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), room_id TEXT NOT NULL, checkpoint_revision INTEGER NOT NULL, state_json TEXT NOT NULL) STRICT');
    target.run(
      'INSERT INTO online_recovery_checkpoint (singleton, room_id, checkpoint_revision, state_json) VALUES (1, ?, 0, ?)',
      'wrong-room',
      serializeOnlineCloudflareProtocolStateV1(initial),
    );
    const before = JSON.stringify({
      tables: target.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"),
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
      checkpoint: target.all('SELECT * FROM online_recovery_checkpoint'),
    });
    const repository = new OnlineCloudflareRepository(target);
    expect(() => repository.migrateApplicationSchema()).toThrow('Invalid recovery checkpoint');
    expect(JSON.stringify({
      tables: target.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"),
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
      checkpoint: target.all('SELECT * FROM online_recovery_checkpoint'),
    })).toBe(before);
  });

  it('rejects a partial pre-existing security schema without creating or initializing missing tables', () => {
    const target = storage();
    const initial = state();
    createLegacyProtocolSchema(target, initial);
    target.database.exec('CREATE TABLE online_security_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL, room_id TEXT NOT NULL, last_observed_at INTEGER NOT NULL, next_connection_id INTEGER NOT NULL, dropped_audit_count INTEGER NOT NULL, grant_count INTEGER NOT NULL) STRICT');
    const before = JSON.stringify({
      tables: target.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"),
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
    });
    const repository = new OnlineCloudflareRepository(target);
    expect(() => repository.migrateApplicationSchema()).toThrow('Partial security schema');
    expect(JSON.stringify({
      tables: target.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"),
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
    })).toBe(before);
  });

  it('checkpoints at 64, verifies a 32-command suffix, and rejects replay beyond 63 without writes', () => {
    const target = storage();
    const repository = new OnlineCloudflareRepository(target);
    repository.migrateApplicationSchema();
    let current = state();
    const initialJson = serializeOnlineCloudflareProtocolStateV1(current);
    repository.initialize(current.room.roomId, current, 10_000);
    for (let index = 0; index < 96; index += 1) {
      const nextEnvelope = envelope(current, index % 4);
      const transition = handleOnlineCommandEnvelopeV1(current, nextEnvelope);
      expect(transition.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
      repository.commitAccepted(transition.state, nextEnvelope);
      current = transition.state;
    }
    expect(target.all('SELECT checkpoint_revision FROM online_recovery_checkpoint')).toEqual([
      { checkpoint_revision: 64 },
    ]);
    expect(repository.load()).toEqual(current);

    target.run(
      'UPDATE online_recovery_checkpoint SET checkpoint_revision = 0, state_json = ? WHERE singleton = 1',
      initialJson,
    );
    const before = JSON.stringify({
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
      checkpoint: target.all('SELECT * FROM online_recovery_checkpoint'),
      security: securitySnapshot(target),
    });
    expect(() => repository.load()).toThrow();
    expect(JSON.stringify({
      room: target.all('SELECT * FROM online_room_state'),
      journal: target.all('SELECT * FROM online_accepted_command'),
      checkpoint: target.all('SELECT * FROM online_recovery_checkpoint'),
      security: securitySnapshot(target),
    })).toBe(before);
  }, 30_000);

  it('replays accepted commands when unjournaled presence differs or every participant disconnects', () => {
    const target = storage();
    const repository = new OnlineCloudflareRepository(target);
    repository.migrateApplicationSchema();
    let current = state();
    repository.initialize(current.room.roomId, current, 10_000);
    for (let index = 0; index < 63; index += 1) {
      const nextEnvelope = envelope(current, index % 4);
      const transition = handleOnlineCommandEnvelopeV1(current, nextEnvelope);
      repository.commitAccepted(transition.state, nextEnvelope);
      current = transition.state;
    }
    const disconnected = {
      ...current,
      room: disconnectOnlineRoomParticipantV1(current.room, PARTICIPANTS[3]),
    } as OnlineProtocolStateV1;
    repository.persistSameRevision(current, disconnected);
    current = disconnected;
    const revision64 = envelope(current, 0);
    const transition64 = handleOnlineCommandEnvelopeV1(current, revision64);
    expect(transition64.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    repository.commitAccepted(transition64.state, revision64);
    current = transition64.state;
    const reconnected = handleOnlineClientHelloV1(current, {
      kind: 'online-client-hello-v1',
      protocolVersion: current.protocolVersion,
      roomId: current.room.roomId,
      participantId: PARTICIPANTS[3],
      participantCapability: CAPABILITIES[3],
      clientBuildId: 'review-o4p-03d-reconnect',
    });
    expect(reconnected.response).toMatchObject({ status: 'accepted' });
    repository.persistSameRevision(current, reconnected.state);
    current = reconnected.state;
    for (let index = 64; index < 96; index += 1) {
      const seatIndex = index === 64 ? 3 : index % 4;
      const nextEnvelope = envelope(current, seatIndex);
      const transition = handleOnlineCommandEnvelopeV1(current, nextEnvelope);
      expect(transition.response).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
      repository.commitAccepted(transition.state, nextEnvelope);
      current = transition.state;
    }
    for (const participantId of PARTICIPANTS) {
      const disconnected = {
        ...current,
        room: disconnectOnlineRoomParticipantV1(current.room, participantId),
      } as OnlineProtocolStateV1;
      repository.persistSameRevision(current, disconnected);
      current = disconnected;
    }
    expect(repository.load()).toEqual(current);
    expect(repository.migrateApplicationSchema()).toBe(false);
  }, 60_000);

  it('rolls back revision 64 when checkpoint compare-and-set writes no row', () => {
    const target = storage();
    const repository = new OnlineCloudflareRepository(target);
    repository.migrateApplicationSchema();
    let current = state();
    repository.initialize(current.room.roomId, current, 10_000);
    for (let index = 0; index < 63; index += 1) {
      const nextEnvelope = envelope(current, index % 4);
      const transition = handleOnlineCommandEnvelopeV1(current, nextEnvelope);
      repository.commitAccepted(transition.state, nextEnvelope);
      current = transition.state;
    }
    const revision64 = envelope(current, 3);
    const transition64 = handleOnlineCommandEnvelopeV1(current, revision64);
    let sabotaged = false;
    target.failExecWhen = (query) => {
      if (!sabotaged && query.startsWith('UPDATE online_recovery_checkpoint')) {
        sabotaged = true;
        target.database.exec('DELETE FROM online_recovery_checkpoint');
      }
      return false;
    };
    expect(() => repository.commitAccepted(transition64.state, revision64)).toThrow();
    target.failExecWhen = null;
    expect(repository.load()).toEqual(current);
    expect(target.all('SELECT revision FROM online_room_state')).toEqual([{ revision: 63 }]);
    expect(target.all('SELECT COUNT(*) AS count FROM online_accepted_command')).toEqual([{ count: 63 }]);
    expect(target.all('SELECT checkpoint_revision FROM online_recovery_checkpoint')).toEqual([{ checkpoint_revision: 0 }]);
  }, 30_000);

  it('runs every schema mutation in the construction transaction and binds real version metadata to correlated recovery facts', async () => {
    const target = storage();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const DurableObject = OnlineRoomDurableObject as unknown as new (
      durableState: OnlineCloudflareDurableObjectState,
      env: OnlineCloudflareEnv,
    ) => OnlineRoomDurableObject;
    const object = new DurableObject({
      id: { name: ROOM_ID },
      storage: target,
      acceptWebSocket: () => undefined,
      getWebSockets: () => [],
      now: () => 10_000,
    }, { CF_VERSION_METADATA: { id: VERSION_ID } });
    expect(target.queries.filter(({ query }) => /^CREATE TABLE/i.test(query)).every(({ transactionDepth }) => transactionDepth === 1)).toBe(true);

    const initial = state();
    const roomState = {
      ...initial,
      room: { ...initial.room, roomId: ROOM_ID },
    } as OnlineProtocolStateV1;
    const initialized = await object.fetch(new Request(`https://example.test/api/online/rooms/${ROOM_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'online-cloudflare-room-initialize-v1',
        schemaVersion: 1,
        state: roomState,
      }),
    }));
    expect(initialized.status).toBe(200);
    const loaded = await object.fetch(new Request(`https://example.test/api/online/rooms/${ROOM_ID}`));
    expect(loaded.status).toBe(200);
    const facts = log.mock.calls.map(([value]) => JSON.parse(String(value)) as Record<string, unknown>);
    expect(facts).toContainEqual(expect.objectContaining({
      kind: 'durable-object-runtime-start',
      roomId: ROOM_ID,
      versionIdentifier: VERSION_ID,
    }));
    expect(facts).toContainEqual({
      kind: 'recovery-verification',
      roomId: ROOM_ID,
      checkpointRevision: 0,
      currentRevision: 0,
      replayCount: 0,
      outcome: 'ok',
      versionIdentifier: VERSION_ID,
    });
  });

  it('emits exact allowlisted facts and silently omits hostile dynamic fields', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    (emitWorkerRequestFactV1 as unknown as (...args: readonly unknown[]) => void)('room', 'GET', 200, 'ok', VERSION_ID, ROOM_ID);
    (emitRuntimeStartFactV1 as unknown as (...args: readonly unknown[]) => void)(1, false, true, VERSION_ID, ROOM_ID);
    (emitRecoveryFactV1 as unknown as (...args: readonly unknown[]) => void)(64, 96, 32, 'ok', VERSION_ID, ROOM_ID);
    (emitWebSocketFactV1 as unknown as (...args: readonly unknown[]) => void)('reconnect', 'player', 'ok', VERSION_ID, ROOM_ID);
    (emitFailureFactV1 as unknown as (...args: readonly unknown[]) => void)('request-failure', 'REQUEST_FAILED', VERSION_ID, ROOM_ID);
    expect(log.mock.calls.map(([value]) => JSON.parse(String(value)) as unknown)).toEqual([
      { kind: 'worker-request', roomId: ROOM_ID, action: 'room', methodClass: 'GET', status: 200, outcome: 'ok', versionIdentifier: VERSION_ID },
      { kind: 'durable-object-runtime-start', roomId: ROOM_ID, applicationSchemaVersion: 1, migrationChangedStorage: false, roomPresent: true, versionIdentifier: VERSION_ID },
      { kind: 'recovery-verification', roomId: ROOM_ID, checkpointRevision: 64, currentRevision: 96, replayCount: 32, outcome: 'ok', versionIdentifier: VERSION_ID },
      { kind: 'websocket-lifecycle', roomId: ROOM_ID, event: 'reconnect', roleClass: 'player', outcome: 'ok', versionIdentifier: VERSION_ID },
      { kind: 'request-failure', roomId: ROOM_ID, code: 'REQUEST_FAILED', versionIdentifier: VERSION_ID },
    ]);
    log.mockClear();
    const capability = CAPABILITIES[0];
    expect(() => emitWorkerRequestFactV1(capability, capability, 200, 'ok', capability)).not.toThrow();
    expect(() => emitFailureFactV1('request-failure', capability, capability)).not.toThrow();
    expect(() => emitWorkerRequestFactV1('room', 'GET', 200, 'ok', 'A'.repeat(48), ROOM_ID)).not.toThrow();
    expect(log).not.toHaveBeenCalled();
  });

  it('emits every contracted WebSocket lifecycle event through the allowlisted fact module', () => {
    const source = readFileSync('src/online/cloudflare/runtime.ts', 'utf8');
    for (const event of ['accepted', 'authenticated', 'hibernation-message', 'close', 'error', 'reconnect']) {
      expect(source).toContain(`emitWebSocketFactV1('${event}'`);
    }
  });

  it('emits one secret-free completion fact on every Worker return path', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const env: OnlineCloudflareEnv = {
      CF_VERSION_METADATA: { id: VERSION_ID },
      ONLINE_ROOMS: {
        getByName: () => ({ fetch: () => Promise.resolve(new Response('{}', { status: 200 })) }),
      },
    };
    const secret = CAPABILITIES[0];
    const responses = await Promise.all([
      onlineCloudflareWorker.fetch(new Request('https://example.test/not-online'), env),
      onlineCloudflareWorker.fetch(new Request(`https://example.test/api/online/rooms/${ROOM_ID}`, { method: 'DELETE' }), env),
      onlineCloudflareWorker.fetch(new Request(`https://example.test/api/online/rooms/${ROOM_ID}`), { CF_VERSION_METADATA: { id: VERSION_ID } }),
      onlineCloudflareWorker.fetch(new Request(`https://example.test/api/online/rooms/${ROOM_ID}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: `${secret}{`,
      }), env),
      onlineCloudflareWorker.fetch(new Request(`https://example.test/api/online/rooms/${ROOM_ID}`), env),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([404, 405, 500, 400, 200]);
    const output = log.mock.calls.map(([value]) => String(value));
    expect(output).toHaveLength(5);
    expect(output.every((value) => (JSON.parse(value) as { kind?: unknown }).kind === 'worker-request')).toBe(true);
    expect(output.join('\n')).not.toContain(secret);
    expect(output.join('\n')).not.toContain('participantCapability');
  });

  it('ships a real in-memory-only evidence harness, never a status-only placeholder or deploy client', () => {
    const source = readFileSync('scripts/online/o4p-03d-evidence.ts', 'utf8');
    expect(source).toMatch(/randomBytes/);
    expect(source).toMatch(/new (?:WebSocket|Socket)\s*\(/);
    expect(source).toMatch(/online-cloudflare-room-initialize-v1/);
    expect(source).toMatch(/online-client-hello-v1/);
    expect(source).toMatch(/online-projection-request-v1/);
    expect(source).toMatch(/online-command-envelope-v1/);
    expect(source).toMatch(/96/);
    expect(source).toMatch(/70_000|70\s*\*\s*1_000/);
    expect(source.toLowerCase()).toMatch(/ready-for-deploy|deployment[- ]barrier/);
    expect(source).toMatch(/validatePlatformEvidence/);
    expect(source).toMatch(/preDeployRuntimeStartCount/);
    expect(source).toMatch(/preDeployVersionIdentifier\s*===\s*candidate\.postDeployVersionIdentifier/);
    expect(source).toMatch(/projection\.participantId\s*!==\s*PARTICIPANTS\[index\]/);
    expect(source).toMatch(/audience\.corePlayerId\s*!==\s*CORE_PLAYERS\[index\]/);
    expect(source).toMatch(/assertSafe\(JSON\.stringify\(message\)/);
    expect(source).toMatch(/let fatal: Error \| null = null/);
    expect(source).toMatch(/function capabilityFragments/);
    expect(source).toMatch(/capability\.slice\(start, start \+ 8\)/);
    expect(source).toMatch(/for \(const inbox of allInboxes\) inbox\.assertHealthy\(\)/);
    expect(source).toMatch(/withTimeout\(deps\.fetch/);
    expect(source).toMatch(/operatorTimeoutMs/);
    expect(source).toMatch(/stdin/);
    expect(source).not.toMatch(/wrangler\s+(?:deploy|rollback)|gh\s|GITHUB_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/);
    expect(source).not.toContain(CAPABILITIES[0]);
    expect(source).not.toMatch(/void capability/);
    expect(source).toMatch(/candidate\.checkpointRevision\s*!==\s*64/);
    expect(source).toMatch(/candidate\.replaySuffixLength\s*!==\s*32/);
  });
});
