import { describe, expect, it, vi } from 'vitest';
import { coreCanonicalDigestFromValueV1, createCoreCommandV1 } from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import { createOnlineVariableLobbyV4, claimOnlineVariableLobbySeatV4, parseOnlineSharedInviteCodeV3 } from '../../lobby/index';
import { OnlineCloudflareRepository, OnlineRoomDurableObject } from '../index';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const SID = '5da14d86-0780-4821-a799-96f64b377df4';
const OID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';
const card = (): CardDef => ({ scryfallId: SID, oracleId: OID, name: 'Runtime Variable Card', lang: 'en', layout: 'normal', cmc: 1, colorIdentity: [], typeLine: 'Creature', faces: [{ name: 'Runtime Variable Card', typeLine: 'Creature' }] });

function lobby(playerCount: 2 | 4, startingLife: 20 | 40) {
  return createOnlineVariableLobbyV4({ roomId: `runtime-${playerCount}-${startingLife}`, serverBuildId: 'runtime-variable-build', hostParticipantId: 'host', configuration: { playerCount, startingLife }, seatCapabilities: Array.from({ length: playerCount }, (_, index) => `seat_${String(index).repeat(32)}`), admissionCapability: `admission_${'a'.repeat(32)}`, tableParticipantId: 'table-runtime', tableCapability: `observer_${'o'.repeat(32)}` });
}

describe('O4P-08C variable runtime persistence', () => {
  it.each([[2, 20], [2, 40], [4, 40]] as const)('accepts exactly configured seats and starts %ip/%i', async (playerCount, startingLife) => {
    const storage = new ReviewSqliteStorage(); const repository = new OnlineCloudflareRepository(storage); repository.migrateApplicationSchema(); let current = lobby(playerCount, startingLife); const participants = ['host']; const caps = current.seats.map((seat) => seat.seatCapability);
    for (let index = 1; index < playerCount; index += 1) { const claimed = claimOnlineVariableLobbySeatV4(current, `player-${index + 1}`, current.admissionCapability); current = claimed.lobby; participants.push(`player-${index + 1}`); }
    repository.initializeVariableLobbyV4(current);
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    for (let index = 0; index < playerCount; index += 1) { await repository.submitVariableDeckV2(current.roomId, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: participants[index], seatCapability: caps[index], deckId: `deck-${index}`, submissionId: `submission-${index}`, entries: [{ section: 'main', quantity: 40, scryfallId: SID, oracleId: OID }] }, resolver); if (index === 0) { const replacement = await repository.submitVariableDeckV2(current.roomId, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: participants[index], seatCapability: caps[index], deckId: `deck-${index}-replacement`, submissionId: `submission-${index}-replacement`, entries: [{ section: 'main', quantity: 60, scryfallId: SID, oracleId: OID }] }, resolver); expect(replacement).toMatchObject({ state: 'accepted' }); expect(repository.loadDeckHeadsV2(current.roomId)[0]?.revision).toBe(2); } repository.setVariableReadyV4(current.roomId, participants[index] ?? '', caps[index] ?? '', true); }
    const started = repository.startVariableV4(current.roomId, 'host', caps[0] ?? ''); expect(started).toMatchObject({ schemaVersion: 2, playerCount, startingLife });
    const reloaded = new OnlineCloudflareRepository(storage, false); expect(reloaded.loadVariableProtocolV2(current.roomId)?.room.seats).toHaveLength(playerCount); expect(reloaded.loadVariableProtocolV2(current.roomId)?.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.turnOrder).toEqual(Array.from({ length: playerCount }, (_, index) => `P${index + 1}`));
  });

  it('persists shared admission through the Durable Object boundary and reports full at configured count', async () => {
    const storage = new ReviewSqliteStorage(); const initial = lobby(2, 20); const object = new OnlineRoomDurableObject({ id: { name: initial.roomId }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
    const post = (value: unknown) => object.fetch(new Request(`https://room.test/api/online/rooms/${initial.roomId}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }));
    expect((await post({ kind: 'online-forming-lobby-initialize-v4', schemaVersion: 4, lobby: initial })).status).toBe(200);
    const claimed = await post({ kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4, participantId: 'player-2', admissionCapability: initial.admissionCapability }); expect(claimed.status).toBe(200);
    const full = await post({ kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4, participantId: 'player-3', admissionCapability: initial.admissionCapability }); expect(full.status).toBe(409);
    const reloaded = await object.fetch(new Request(`https://room.test/api/online/rooms/${initial.roomId}/lobby`)); expect(reloaded.status).toBe(200); expect((await reloaded.json() as { readonly seats: readonly unknown[] }).seats).toHaveLength(2);
  });

  it('rotates/closes admission, preserves host-only recovery, and rekeys kicked/left seats', async () => {
    const storage = new ReviewSqliteStorage(); const initial = lobby(2, 20); const object = new OnlineRoomDurableObject({ id: { name: initial.roomId }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
    const post = (value: unknown) => object.fetch(new Request(`https://room.test/api/online/rooms/${initial.roomId}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }));
    await post({ kind: 'online-forming-lobby-initialize-v4', schemaVersion: 4, lobby: initial });
    const closed = await post({ kind: 'online-forming-lobby-admission-close-v3', schemaVersion: 3, hostParticipantId: 'host', seatCapability: initial.seats[0]?.seatCapability }); expect(closed.status).toBe(200);
    const closedClaim = await post({ kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4, participantId: 'player-2', admissionCapability: initial.admissionCapability }); expect(closedClaim.status).toBe(403); expect(await closedClaim.json()).toMatchObject({ kind: 'online-public-error-v3', code: 'ADMISSION_CLOSED' });
    const rotated = await post({ kind: 'online-forming-lobby-admission-rotate-v3', schemaVersion: 3, hostParticipantId: 'host', seatCapability: initial.seats[0]?.seatCapability }); expect(rotated.status).toBe(200); const rotatedBody = await rotated.json() as { readonly inviteCode: string }; const parsed = parseOnlineSharedInviteCodeV3(rotatedBody.inviteCode); expect(parsed?.roomId).toBe(initial.roomId);
    const claimed = await post({ kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4, participantId: 'player-2', admissionCapability: parsed?.admissionCapability }); expect(claimed.status).toBe(200);
    const recovery = await post({ kind: 'online-forming-lobby-recover-v5', schemaVersion: 5, participantId: 'host', seatCapability: initial.seats[0]?.seatCapability }); expect(recovery.status).toBe(200); expect(await recovery.json()).toMatchObject({ admissionOpen: true, tableParticipantId: 'table-runtime' });
    const kicked = await post({ kind: 'online-forming-lobby-kick-v3', schemaVersion: 3, hostParticipantId: 'host', seatCapability: initial.seats[0]?.seatCapability, targetParticipantId: 'player-2' }); expect(kicked.status).toBe(200);
    const oldRecovery = await post({ kind: 'online-forming-lobby-recover-v5', schemaVersion: 5, participantId: 'player-2', seatCapability: initial.seats[1]?.seatCapability }); expect(oldRecovery.status).toBe(410); expect(await oldRecovery.json()).toMatchObject({ kind: 'online-public-error-v3', code: 'CREDENTIAL_KICKED' });
    const resetStart = await post({ kind: 'online-forming-lobby-start-v4', schemaVersion: 4, hostParticipantId: 'host', seatCapability: initial.seats[0]?.seatCapability }); expect(resetStart.status).toBe(409); expect(await resetStart.json()).toMatchObject({ kind: 'online-public-error-v3', code: 'PLAYERS_NOT_READY' });
    const leave = await post({ kind: 'online-forming-lobby-leave-v3', schemaVersion: 3, participantId: 'host', seatCapability: initial.seats[0]?.seatCapability }); expect(leave.status).toBe(200); expect(await leave.json()).toMatchObject({ closed: true });
  });

  it('persists an accepted command through the variable HTTP gameplay transport', async () => {
    const storage = new ReviewSqliteStorage(); const repository = new OnlineCloudflareRepository(storage); repository.migrateApplicationSchema(); let current = lobby(2, 20); const claimed = claimOnlineVariableLobbySeatV4(current, 'player-2', current.admissionCapability); current = claimed.lobby; repository.initializeVariableLobbyV4(current);
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    for (const [index, participantId] of ['host', 'player-2'].entries()) {
      const capability = current.seats[index]?.seatCapability ?? '';
      await repository.submitVariableDeckV2(current.roomId, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId, seatCapability: capability, deckId: `transport-deck-${index}`, submissionId: `transport-submission-${index}`, entries: [{ section: 'main', quantity: 40, scryfallId: SID, oracleId: OID }] }, resolver);
      repository.setVariableReadyV4(current.roomId, participantId, capability, true);
    }
    repository.startVariableV4(current.roomId, 'host', current.seats[0]?.seatCapability ?? '');
    const beforeCommand = repository.loadVariableProtocolV2(current.roomId); if (beforeCommand === null) throw new Error('Missing variable protocol');
    let attachment: unknown; const sent: string[] = []; const socket = { send: (data: string) => { sent.push(data); }, serializeAttachment: (value: unknown) => { attachment = value; }, deserializeAttachment: () => attachment };
    const sockets = [socket]; const object = new OnlineRoomDurableObject({ id: { name: current.roomId }, storage, acceptWebSocket: () => undefined, getWebSockets: () => sockets });
    const client = Object.freeze({ side: 'client' }); class FakePair { readonly 0 = client; readonly 1 = socket; } class CloudflareResponse { readonly status: number; readonly webSocket: unknown; constructor(_body: BodyInit | null, init: ResponseInit & { readonly webSocket?: unknown } = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket; } }
    vi.stubGlobal('WebSocketPair', FakePair); vi.stubGlobal('Response', CloudflareResponse);
    try { const upgraded = await object.fetch(new Request(`https://room.test/api/online/rooms/${current.roomId}/websocket`, { headers: { upgrade: 'websocket' } })); expect(upgraded.status).toBe(101); const ready: unknown = JSON.parse(sent[0] ?? '{}'); expect(ready).toMatchObject({ kind: 'online-cloudflare-websocket-ready-v1', revision: 0 }); } finally { vi.unstubAllGlobals(); }
    object.webSocketMessage(socket, JSON.stringify({ kind: 'online-client-hello-v1', protocolVersion: 1, roomId: current.roomId, participantId: 'host', participantCapability: current.seats[0]?.seatCapability, clientBuildId: beforeCommand.serverBuildId }));
    expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-server-hello-v1', status: 'accepted', revision: 0 });
    object.webSocketMessage(socket, JSON.stringify({ kind: 'online-projection-request-v1', protocolVersion: 1, roomId: current.roomId, participantId: 'host', participantCapability: current.seats[0]?.seatCapability, knownRevision: 0, clientBuildId: beforeCommand.serverBuildId }));
    expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-projected-snapshot-v1', status: 'accepted', revision: 0, projection: { kind: 'online-participant-projection-v2', configuration: { playerCount: 2, startingLife: 20 } } });
    const command = createCoreCommandV1({ schemaVersion: 1, sequence: 1, actorPlayerId: 'P1' as never, decisionMakerPlayerId: 'P1' as never, decisionContext: { kind: 'decision', decisionKey: 'variable-http-transport' }, payload: { kind: 'correct-player-life', playerId: 'P1' as never, replacementLifeTotal: 19, expectedBeforeStateDigest: coreCanonicalDigestFromValueV1(beforeCommand.coreRoot), reason: 'variable transport test' } });
    const body = { kind: 'online-command-envelope-v1', protocolVersion: 1, roomId: current.roomId, participantId: 'host', participantCapability: current.seats[0]?.seatCapability, commandId: 'variable-http-command', baseRevision: 0, command };
    const request = () => new Request(`https://room.test/api/online/rooms/${current.roomId}/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const accepted = await (await object.fetch(request())).json() as Record<string, unknown>;
    expect(accepted.issues).toBeUndefined();
    expect(accepted).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: 1 });
    expect(await (await object.fetch(request())).json()).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true, acceptedRevision: 1 });
    const reloaded = new OnlineCloudflareRepository(storage, false).loadVariableProtocolV2(current.roomId);
    expect(reloaded).toMatchObject({ revision: 1, room: { lifecycle: 'active', seats: [{ outcome: 'pending' }, { outcome: 'pending' }] } });
    expect(reloaded?.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players['P1' as never]?.life).toBe(19);
    storage.sql.exec("UPDATE online_variable_room_state SET room_lifecycle = 'finished' WHERE singleton = 1");
    expect(() => new OnlineCloudflareRepository(storage, false).loadVariableProtocolV2(current.roomId)).toThrow('Invalid variable protocol state');
    storage.sql.exec("UPDATE online_variable_room_state SET room_lifecycle = 'active' WHERE singleton = 1");
    storage.sql.exec('DELETE FROM online_accepted_command WHERE accepted_revision = 1');
    expect(() => new OnlineCloudflareRepository(storage, false).loadVariableProtocolV2(current.roomId)).toThrow('Invalid variable recovery relation');
  });

  it('keeps configuration immutable and fails closed on redundant persisted metadata', () => {
    const storage = new ReviewSqliteStorage(); const repository = new OnlineCloudflareRepository(storage); repository.migrateApplicationSchema(); const initial = lobby(2, 20); repository.initializeVariableLobbyV4(initial);
    expect(() => repository.persistVariableLobbyV4(initial, { ...initial, configuration: { playerCount: 2, startingLife: 40 } })).toThrow('Invalid variable lobby transition');
  });

  it('commits resolved deck and the latest concurrently changed lobby atomically', async () => {
    const storage = new ReviewSqliteStorage(); const repository = new OnlineCloudflareRepository(storage); repository.migrateApplicationSchema(); const initial = lobby(2, 20); repository.initializeVariableLobbyV4(initial);
    let settle: (definitions: ReadonlyMap<string, CardDef>) => void = () => undefined;
    const resolution = new Promise<ReadonlyMap<string, CardDef>>((resolve) => { settle = resolve; });
    const pending = repository.submitVariableDeckV2(initial.roomId, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: 'host', seatCapability: initial.seats[0]?.seatCapability, deckId: 'concurrent-deck', submissionId: 'concurrent-submission', entries: [{ section: 'main', quantity: 40, scryfallId: SID, oracleId: OID }] }, { resolve: () => resolution });
    const claimed = claimOnlineVariableLobbySeatV4(initial, 'player-2', initial.admissionCapability); repository.persistVariableLobbyV4(initial, claimed.lobby); settle(new Map([[SID, card()]]));
    expect(await pending).toMatchObject({ state: 'accepted' });
    expect(repository.loadVariableLobbyV4(initial.roomId)).toMatchObject({ seats: [{ participantId: 'host', acceptedDeck: true }, { participantId: 'player-2', acceptedDeck: false }] });
  });
});
