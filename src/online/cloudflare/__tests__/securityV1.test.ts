import { describe, expect, it } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import { activateOnlineRoomV1, joinOnlineRoomV1, startOnlineRoomV1 } from '../../room/index';
import { CAPABILITIES, PARTICIPANTS, makeCoreRoot, readyAllPlayers } from '../../room/__tests__/testHelpers';
import { createOnlineProtocolStateV1, type OnlineCommandEnvelopeV1, type OnlineProtocolStateV1 } from '../../protocol/index';
import {
  ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1,
  ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1,
  OnlineCloudflareRepository,
  OnlineRoomDurableObject,
} from '../index';
import { OnlineCloudflareSecurityRepository } from '../security';
import { SecuritySqlFixture } from './securitySqlFixture';

const NOW = 1_000;
const ROTATED = `rotated_token_${'Z'.repeat(32)}`;
const TABLE_CAPABILITY = `observer_token_${'T'.repeat(32)}`;
const SPECTATOR_CAPABILITY = `observer_token_${'S'.repeat(32)}`;

function protocolState(): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId: 'ordinary-cloudflare-security-build',
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function commandEnvelope(state: OnlineProtocolStateV1, capability: string = CAPABILITIES[0], commandId = `security-command-${state.revision + 1}`): OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0] as never,
    participantCapability: capability as never,
    commandId: commandId as never,
    baseRevision: state.revision,
    command: createCoreCommandV1({
      schemaVersion: 1,
      sequence: state.revision + 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: 'security-command' },
      payload: { kind: 'commander-cast-record', physicalCardId: 'PC1' as never, origin: 'command-zone', accepted: true },
    }),
  };
}

function observerProtocolState(): OnlineProtocolStateV1 {
  let room = readyAllPlayers();
  room = joinOnlineRoomV1(room, { participantId: 'table-observer', role: 'table' });
  room = joinOnlineRoomV1(room, { participantId: 'spectator-observer', role: 'spectator' });
  const coreRoot = makeCoreRoot();
  const active = activateOnlineRoomV1(startOnlineRoomV1(room, PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId: 'ordinary-cloudflare-security-observers-build',
    room: active,
    coreRoot,
    observerAuthorizations: [
      { participantId: 'table-observer' as never, observerCapability: TABLE_CAPABILITY as never },
      { participantId: 'spectator-observer' as never, observerCapability: SPECTATOR_CAPABILITY as never },
    ],
  });
}

describe('O4P-03C Cloudflare security envelope', () => {
  it('classifies table and spectator observers exactly once', () => {
    const storage = new SecuritySqlFixture();
    const repository = new OnlineCloudflareRepository(storage);
    const state = observerProtocolState();
    repository.initialize(state.room.roomId, state, NOW);
    expect(storage.grants.map((grant) => [grant.participant_id, grant.authority, grant.current_token])).toEqual([
      ['host', 'host', CAPABILITIES[0]],
      ['player-2', 'seat', CAPABILITIES[1]],
      ['player-3', 'seat', CAPABILITIES[2]],
      ['player-4', 'seat', CAPABILITIES[3]],
      ['table-observer', 'table', TABLE_CAPABILITY],
      ['spectator-observer', 'spectator', SPECTATOR_CAPABILITY],
    ]);
  });

  it('keeps constructor access to pre-03C storage write-free and fails closed without security schema', () => {
    const storage = new SecuritySqlFixture();
    const writes = storage.writeCount;
    const security = new OnlineCloudflareSecurityRepository(storage);
    expect(storage.writeCount).toBe(writes);
    expect(storage.securityTables.size).toBe(0);
    expect(() => security.read(protocolState())).toThrowError('INVALID_SECURITY_STATE');
    expect(storage.writeCount).toBe(writes);
    expect(storage.securityTables.size).toBe(0);
  });

  it('classifies grants, maps rotated network tokens to the lower protocol capability, and rejects exact expiry', () => {
    const storage = new SecuritySqlFixture();
    const repository = new OnlineCloudflareRepository(storage);
    const security = new OnlineCloudflareSecurityRepository(storage);
    const state = protocolState();
    repository.initialize(state.room.roomId, state, NOW);
    expect(storage.grants.map((grant) => ({ participantId: grant.participant_id, authority: grant.authority, currentToken: grant.current_token }))).toEqual([
      { participantId: 'host', authority: 'host', currentToken: CAPABILITIES[0] },
      { participantId: 'player-2', authority: 'seat', currentToken: CAPABILITIES[1] },
      { participantId: 'player-3', authority: 'seat', currentToken: CAPABILITIES[2] },
      { participantId: 'player-4', authority: 'seat', currentToken: CAPABILITIES[3] },
    ]);

    const admission = security.consumeHttpAction(state, PARTICIPANTS[0], CAPABILITIES[0], 'command', NOW + 1);
    expect(admission).toMatchObject({ ok: true, authorization: { protocolCapability: CAPABILITIES[0], authority: 'host', generation: 0 } });
    const rotated = security.rotate(state, PARTICIPANTS[0], CAPABILITIES[0], ROTATED, NOW + 2);
    expect(rotated).toMatchObject({ kind: 'online-cloudflare-capability-rotated-v1', participantId: PARTICIPANTS[0], generation: 1, expiresAt: NOW + 2 + ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1 });
    expect(JSON.stringify(rotated)).not.toContain(ROTATED);
    expect(security.consumeHttpAction(state, PARTICIPANTS[0], CAPABILITIES[0], 'command', NOW + 3)).toMatchObject({ ok: false, reason: 'capability' });
    const mapped = security.consumeHttpAction(state, PARTICIPANTS[0], ROTATED, 'command', NOW + 4);
    expect(mapped).toMatchObject({ ok: true, authorization: { protocolCapability: CAPABILITIES[0], generation: 1 } });
    expect(security.consumeHttpAction(state, PARTICIPANTS[0], ROTATED, 'command', NOW + 2 + ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1)).toMatchObject({ ok: false, reason: 'capability' });
  });

  it('fails closed on unsafe and non-canonical security rows', () => {
    const mutations: Array<(storage: SecuritySqlFixture, security: OnlineCloudflareSecurityRepository, state: OnlineProtocolStateV1) => void> = [
      (storage) => { if (storage.security !== null) storage.security.room_id = '__proto__'; },
      (storage) => { const grant = storage.grants[0]; if (grant !== undefined) grant.expires_at = Number(grant.issued_at) + 1; },
      (storage) => { const grant = storage.grants[0]; if (grant !== undefined) grant.http_window_started_at = NOW + 1; },
      (storage) => { const grant = storage.grants[0]; if (grant !== undefined) grant.authority = 'seat'; },
      (storage, security, state) => {
        security.recordAudit(state, PARTICIPANTS[0], null, 'host', 0, 'ROLE_REJECTED', 'rejected', NOW + 1);
        const fact = storage.audit[0];
        if (fact !== undefined) fact.audit_id = 2;
      },
      (storage, security, state) => {
        security.recordAudit(state, PARTICIPANTS[0], null, 'host', 0, 'ROLE_REJECTED', 'rejected', NOW + 1);
        security.recordAudit(state, PARTICIPANTS[0], null, 'host', 0, 'ROLE_REJECTED', 'rejected', NOW + 2);
        const fact = storage.audit[1];
        if (fact !== undefined) fact.observed_at = NOW;
      },
      (storage, security, state) => {
        security.recordAudit(state, PARTICIPANTS[0], null, 'host', 0, 'ROLE_REJECTED', 'rejected', NOW + 1);
        const fact = storage.audit[0];
        if (fact !== undefined) fact.authority = 'seat';
      },
      (storage) => { const grant = storage.grants[0]; if (grant !== undefined) grant.generation = 7; },
      (storage) => { const grant = storage.grants[0]; if (grant !== undefined) { grant.generation = 7; grant.current_token = CAPABILITIES[0]; } },
      (storage) => { if (storage.security !== null) storage.security.dropped_audit_count = 1; },
    ];

    for (const mutate of mutations) {
      const storage = new SecuritySqlFixture();
      const repository = new OnlineCloudflareRepository(storage);
      const security = new OnlineCloudflareSecurityRepository(storage);
      const state = protocolState();
      repository.initialize(state.room.roomId, state, NOW);
      mutate(storage, security, state);
      expect(() => security.read(state)).toThrowError('INVALID_SECURITY_STATE');
    }
  });

  it('enforces one controller lease, exact holder release, and durable recreation state', () => {
    const storage = new SecuritySqlFixture();
    const repository = new OnlineCloudflareRepository(storage);
    const security = new OnlineCloudflareSecurityRepository(storage);
    const state = protocolState();
    repository.initialize(state.room.roomId, state, NOW);
    expect(security.acquireControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 1 }, NOW + 1)).toBe(true);
    expect(security.acquireControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 2 }, NOW + 2)).toBe(false);
    expect(security.acquireControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 1 }, NOW + 3)).toBe(true);
    security.releaseControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 2 }, NOW + 4);
    expect(storage.leases).toHaveLength(1);
    security.releaseControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 1 }, NOW + 5);
    expect(storage.leases).toHaveLength(0);
    expect(new OnlineCloudflareSecurityRepository(storage).read(state).grants).toHaveLength(4);
    expect(security.allocateConnectionId(state, NOW + 6)).toBe(1);
    expect(new OnlineCloudflareSecurityRepository(storage).allocateConnectionId(state, NOW + 7)).toBe(2);
  });

  it('rolls back rotation and exact-holder release when DELETE RETURNING mismatches the validated lease', () => {
    const storage = new SecuritySqlFixture();
    const repository = new OnlineCloudflareRepository(storage);
    const security = new OnlineCloudflareSecurityRepository(storage);
    const state = protocolState();
    repository.initialize(state.room.roomId, state, NOW);
    expect(security.acquireControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 1 }, NOW + 1)).toBe(true);

    storage.leaseDeleteReturningOverride = [];
    expect(() => security.rotate(state, PARTICIPANTS[0], CAPABILITIES[0], ROTATED, NOW + 2)).toThrowError('CAS_CONFLICT');
    expect(storage.grants[0]?.current_token).toBe(CAPABILITIES[0]);
    expect(storage.leases).toHaveLength(1);

    storage.leaseDeleteReturningOverride = [{ participant_id: PARTICIPANTS[0] }, { participant_id: PARTICIPANTS[0] }];
    expect(() => security.rotate(state, PARTICIPANTS[0], CAPABILITIES[0], ROTATED, NOW + 2)).toThrowError('CAS_CONFLICT');
    expect(storage.grants[0]?.current_token).toBe(CAPABILITIES[0]);
    expect(storage.leases).toHaveLength(1);

    storage.leaseDeleteReturningOverride = [];
    expect(() => security.releaseControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 1 }, NOW + 3)).toThrowError('CAS_CONFLICT');
    expect(storage.leases).toHaveLength(1);

    storage.leaseDeleteReturningOverride = [{ participant_id: PARTICIPANTS[0] }, { participant_id: PARTICIPANTS[0] }];
    expect(() => security.releaseControllerLease(state, PARTICIPANTS[0], 0, { kind: 'socket', connectionId: 1 }, NOW + 3)).toThrowError('CAS_CONFLICT');
    expect(storage.leases).toHaveLength(1);
  });

  it('caps append-only audit facts and counts drops without replacing facts', () => {
    const storage = new SecuritySqlFixture();
    const repository = new OnlineCloudflareRepository(storage);
    const security = new OnlineCloudflareSecurityRepository(storage);
    const state = protocolState();
    repository.initialize(state.room.roomId, state, NOW);
    for (let index = 0; index < ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1 + 4; index += 1) {
      security.recordAudit(state, PARTICIPANTS[0], null, 'host', 0, 'ROLE_REJECTED', 'rejected', NOW + index + 1);
    }
    expect(storage.audit).toHaveLength(ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1);
    expect(storage.security?.dropped_audit_count).toBe(4);
    expect(storage.audit[0]?.audit_id).toBe(1);
    expect(storage.audit.at(-1)?.audit_id).toBe(ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1);
    expect(security.read(state).audit).toHaveLength(ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1);
  });

  it('keeps the HTTP lower operation behind capability admission and preserves secret-free responses', async () => {
    const storage = new SecuritySqlFixture();
    const state = protocolState();
    const object = new OnlineRoomDurableObject({
      id: { name: state.room.roomId },
      storage,
      acceptWebSocket: () => undefined,
      getWebSockets: () => [],
      now: () => NOW,
    });
    const init = await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'online-cloudflare-room-initialize-v1', schemaVersion: 1, state }),
    }));
    expect(init.status).toBe(200);
    const rotated = await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}/capabilities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'online-cloudflare-capability-rotate-v1', schemaVersion: 1, participantId: PARTICIPANTS[0], currentCapability: CAPABILITIES[0], nextCapability: ROTATED }),
    }));
    expect(rotated.status).toBe(200);
    const response = await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(commandEnvelope(state, ROTATED)),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
    const body = JSON.stringify(await (await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}/capabilities`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'online-cloudflare-capability-rotate-v1', schemaVersion: 1, participantId: PARTICIPANTS[0], currentCapability: ROTATED, nextCapability: CAPABILITIES[1] }),
    }))).json());
    expect(body).not.toContain(ROTATED);
  });

  it('rejects bearer collisions in non-capability command fields before lower persistence', async () => {
    const storage = new SecuritySqlFixture();
    const state = protocolState();
    const object = new OnlineRoomDurableObject({
      id: { name: state.room.roomId },
      storage,
      acceptWebSocket: () => undefined,
      getWebSockets: () => [],
      now: () => NOW,
    });
    expect((await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'online-cloudflare-room-initialize-v1', schemaVersion: 1, state }),
    }))).status).toBe(200);
    const response = await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(commandEnvelope(state, CAPABILITIES[0], `${CAPABILITIES[0]}-embedded`)),
    }));
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toContain(CAPABILITIES[0]);
    expect(storage.room?.revision).toBe(0);
    expect(storage.journal).toHaveLength(0);
  });

  it('uses one HTTP action clock through admission and lease acquisition at expiry edge and on hostile regression', async () => {
    const run = async (clockValues: number[], expectedStatus: number): Promise<SecuritySqlFixture> => {
      const storage = new SecuritySqlFixture();
      const state = protocolState();
      const object = new OnlineRoomDurableObject({
        id: { name: state.room.roomId },
        storage,
        acceptWebSocket: () => undefined,
        getWebSockets: () => [],
        now: () => clockValues.shift() ?? NOW,
      });
      expect((await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'online-cloudflare-room-initialize-v1', schemaVersion: 1, state }),
      }))).status).toBe(200);
      const response = await object.fetch(new Request(`https://room.test/api/online/rooms/${state.room.roomId}/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(commandEnvelope(state)),
      }));
      expect(response.status).toBe(expectedStatus);
      return storage;
    };
    const expiry = NOW + ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1;
    const expiryEdge = await run([NOW, expiry - 1, expiry], 200);
    expect(expiryEdge.room?.revision).toBe(1);
    const regressing = await run([NOW, NOW + 1, NOW], 200);
    expect(regressing.room?.revision).toBe(1);
  });
});
