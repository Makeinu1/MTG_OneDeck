import { describe, expect, it, vi } from 'vitest';
import { coreCanonicalDigestFromValueV1, createCoreCommandV1 } from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import { createOnlineVariableLobbyV4, claimOnlineVariableLobbySeatV4, parseOnlineSharedInviteCodeV3 } from '../../lobby/index';
import {
  createOnlinePregameLifecycleV1,
  handleOnlinePregameCommandEnvelopeV1,
  projectOnlinePregameV1,
  validateOnlinePregameProjectionV1,
  type OnlinePregameStateV1,
} from '../../pregame/index';
import { ConflictError, OnlineCloudflareRepository, OnlineRoomDurableObject } from '../index';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const SID = '5da14d86-0780-4821-a799-96f64b377df4';
const OID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';
const card = (): CardDef => ({ scryfallId: SID, oracleId: OID, name: 'Runtime Variable Card', lang: 'en', layout: 'normal', cmc: 1, colorIdentity: [], typeLine: 'Creature', faces: [{ name: 'Runtime Variable Card', typeLine: 'Creature' }] });

function lobby(playerCount: 2 | 4, startingLife: 20 | 40) {
  return createOnlineVariableLobbyV4({ roomId: `runtime-${playerCount}-${startingLife}`, serverBuildId: 'runtime-variable-build', hostParticipantId: 'host', configuration: { playerCount, startingLife }, seatCapabilities: Array.from({ length: playerCount }, (_, index) => `seat_${String(index).repeat(32)}`), admissionCapability: `admission_${'a'.repeat(32)}`, tableParticipantId: 'table-runtime', tableCapability: `observer_${'o'.repeat(32)}` });
}

function completePregame(repository: OnlineCloudflareRepository, roomId: string): OnlinePregameStateV1 {
  let state = repository.loadPregameV1(roomId);
  if (state === null) throw new Error('Missing Pregame fixture');
  let commandIndex = 0;
  while (state.phase !== 'complete') {
    const playerId = state.currentPlayerId ?? state.players.find((player) => !player.ready)?.playerId;
    if (playerId === undefined) throw new Error('Pregame fixture has no actor');
    const seat = state.protocolState.room.seats.find((candidate) => candidate.corePlayerId === playerId);
    if (seat === undefined || seat.participantId === null) throw new Error('Pregame fixture seat missing');
    const command = state.phase === 'commander-reveal'
      ? { kind: 'confirm-commanders' as const }
      : state.phase === 'mulligan-declaration'
        ? { kind: 'declare-mulligan' as const, decision: 'keep' as const }
        : state.phase === 'pregame-actions'
          ? { kind: 'complete-pregame-actions' as const }
          : { kind: 'set-ready' as const, ready: true };
    const result = repository.applyPregameCommandV1(roomId, {
      kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId,
      participantId: seat.participantId, ['participantCapability']: seat.seatCapability,
      commandId: `pregame-fixture-${String(commandIndex)}`, baseRevision: state.revision, command,
    });
    if (result?.response.kind !== 'online-pregame-command-ack-v1') throw new Error('Pregame fixture command rejected');
    commandIndex += 1;
    state = repository.loadPregameV1(roomId) ?? state;
  }
  return state;
}

async function startedRepository(playerCount: 2 | 4): Promise<Readonly<{
  readonly storage: ReviewSqliteStorage;
  readonly repository: OnlineCloudflareRepository;
  readonly roomId: string;
}>> {
  const storage = new ReviewSqliteStorage();
  const repository = new OnlineCloudflareRepository(storage);
  repository.migrateApplicationSchema();
  let current = lobby(playerCount, 40);
  const participants = ['host'];
  for (let index = 1; index < playerCount; index += 1) {
    const claimed = claimOnlineVariableLobbySeatV4(current, `player-${index + 1}`, current.admissionCapability);
    current = claimed.lobby;
    participants.push(`player-${index + 1}`);
  }
  repository.initializeVariableLobbyV4(current);
  const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
  for (let index = 0; index < playerCount; index += 1) {
    const participantId = participants[index] ?? '';
    const seatValue = current.seats[index]?.seatCapability ?? '';
    await repository.submitVariableDeckV2(current.roomId, {
      kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId,
      ['seatCapability']: seatValue, deckId: `started-deck-${index}`, submissionId: `started-submission-${index}`,
      entries: [{ section: 'main', quantity: 40, scryfallId: SID, oracleId: OID }],
    }, resolver);
    repository.setVariableReadyV4(current.roomId, participantId, seatValue, true);
  }
  repository.startVariableV4(current.roomId, 'host', current.seats[0]?.seatCapability ?? '');
  return Object.freeze({ storage, repository, roomId: current.roomId });
}

describe('O4P-08C variable runtime persistence', () => {
  it.each([[2, 40], [4, 40]] as const)('accepts exactly configured seats and starts %ip/%i', async (playerCount, startingLife) => {
    const storage = new ReviewSqliteStorage(); const repository = new OnlineCloudflareRepository(storage); repository.migrateApplicationSchema(); let current = lobby(playerCount, startingLife); const participants = ['host']; const caps = current.seats.map((seat) => seat.seatCapability);
    for (let index = 1; index < playerCount; index += 1) { const claimed = claimOnlineVariableLobbySeatV4(current, `player-${index + 1}`, current.admissionCapability); current = claimed.lobby; participants.push(`player-${index + 1}`); }
    repository.initializeVariableLobbyV4(current);
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    for (let index = 0; index < playerCount; index += 1) { await repository.submitVariableDeckV2(current.roomId, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: participants[index], seatCapability: caps[index], deckId: `deck-${index}`, submissionId: `submission-${index}`, entries: [{ section: 'main', quantity: 40, scryfallId: SID, oracleId: OID }] }, resolver); if (index === 0) { const replacement = await repository.submitVariableDeckV2(current.roomId, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId: participants[index], seatCapability: caps[index], deckId: `deck-${index}-replacement`, submissionId: `submission-${index}-replacement`, entries: [{ section: 'main', quantity: 60, scryfallId: SID, oracleId: OID }] }, resolver); expect(replacement).toMatchObject({ state: 'accepted' }); expect(repository.loadDeckHeadsV2(current.roomId)[0]?.revision).toBe(2); } repository.setVariableReadyV4(current.roomId, participants[index] ?? '', caps[index] ?? '', true); }
    const started = repository.startVariableV4(current.roomId, 'host', caps[0] ?? ''); expect(started).toMatchObject({ schemaVersion: 2, playerCount, startingLife });
    const reloaded = new OnlineCloudflareRepository(storage, false); expect(reloaded.loadVariableProtocolV2(current.roomId)?.room.seats).toHaveLength(playerCount); expect(reloaded.loadVariableProtocolV2(current.roomId)?.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.turnOrder).toEqual(Array.from({ length: playerCount }, (_, index) => `P${index + 1}`));
  }, 30000);

  it('rejects a ready 2-player/20-life start before creating protocol or Pregame state', async () => {
    const storage = new ReviewSqliteStorage();
    const repository = new OnlineCloudflareRepository(storage);
    repository.migrateApplicationSchema();
    let current = lobby(2, 20);
    const claimed = claimOnlineVariableLobbySeatV4(current, 'player-2', current.admissionCapability);
    current = claimed.lobby;
    repository.initializeVariableLobbyV4(current);
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    for (const [index, participantId] of ['host', 'player-2'].entries()) {
      const seatValue = current.seats[index]?.seatCapability ?? '';
      await repository.submitVariableDeckV2(current.roomId, {
        kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId,
        ['seatCapability']: seatValue, deckId: `twenty-deck-${index}`, submissionId: `twenty-submission-${index}`,
        entries: [{ section: 'main', quantity: 40, scryfallId: SID, oracleId: OID }],
      }, resolver);
      repository.setVariableReadyV4(current.roomId, participantId, seatValue, true);
    }
    const beforeLobby = repository.loadVariableLobbyV4(current.roomId);
    expect(() => repository.startVariableV4(current.roomId, 'host', current.seats[0]?.seatCapability ?? '')).toThrow('PREGAME_REQUIRES_40_LIFE');
    expect(repository.loadVariableProtocolV2(current.roomId)).toBeNull();
    expect(repository.loadPregameV1(current.roomId)).toBeNull();
    expect(repository.loadVariableLobbyV4(current.roomId)).toEqual(beforeLobby);
    storage.close();
  }, 30000);

  it.each([2, 4] as const)('completes the persisted Pregame handoff to turn one for %ip', async (playerCount) => {
    const fixture = await startedRepository(playerCount);
    const initial = fixture.repository.loadPregameV1(fixture.roomId);
    expect(initial).toMatchObject({ phase: 'commander-reveal', revision: 0 });
    const complete = completePregame(fixture.repository, fixture.roomId);
    expect(complete.phase).toBe('complete');
    expect(complete.protocolState.room.lifecycle).toBe('active');
    expect(complete.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.lifecycle).toMatchObject({
      turnNumber: 1,
      position: { phase: 'beginning', step: 'untap' },
    });
    const reconstructed = new OnlineCloudflareRepository(fixture.storage, false).loadPregameV1(fixture.roomId);
    expect(reconstructed).toEqual(complete);
    expect(JSON.stringify(fixture.repository.projectPregameV1(fixture.roomId, 'host'))).not.toMatch(/(?:randomPlan|libraryPlans|journal|seat_[A-Za-z0-9_-]{8})/);
    fixture.storage.close();
  }, 90000);

  it('rejects unauthorized, stale, reused, and conflicting Pregame commands without mutation', async () => {
    const fixture = await startedRepository(2);
    const state = fixture.repository.loadPregameV1(fixture.roomId);
    if (state === null || state.currentPlayerId === null) throw new Error('Missing Pregame actor');
    const seat = state.protocolState.room.seats.find((candidate) => candidate.corePlayerId === state.currentPlayerId);
    if (seat?.participantId === null || seat === undefined) throw new Error('Missing Pregame seat');
    const command = { kind: 'confirm-commanders' as const };
    const envelope = {
      kind: 'online-pregame-command-envelope-v1' as const, schemaVersion: 1 as const,
      roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability,
      commandId: 'pregame-command-test', baseRevision: state.revision, command,
    };
    expect(fixture.repository.applyPregameCommandV1(fixture.roomId, { ...envelope, participantId: 'participant-unauthorized', ['participantCapability']: `seat_${'z'.repeat(40)}` })).toBeNull();
    expect(fixture.repository.loadPregameV1(fixture.roomId)).toEqual(state);
    const stale = fixture.repository.applyPregameCommandV1(fixture.roomId, { ...envelope, commandId: 'pregame-stale-test', baseRevision: state.revision + 1 });
    expect(stale?.response).toMatchObject({ kind: 'online-pregame-command-reject-v1', issues: [{ code: 'STALE_REVISION' }], resyncRequired: true });
    expect(fixture.repository.loadPregameV1(fixture.roomId)).toEqual(state);
    const accepted = fixture.repository.applyPregameCommandV1(fixture.roomId, envelope);
    expect(accepted?.response).toMatchObject({ kind: 'online-pregame-command-ack-v1', duplicate: false, acceptedRevision: 1 });
    const duplicate = fixture.repository.applyPregameCommandV1(fixture.roomId, envelope);
    expect(duplicate?.response).toMatchObject({ kind: 'online-pregame-command-ack-v1', duplicate: true, acceptedRevision: 1 });
    const reused = fixture.repository.applyPregameCommandV1(fixture.roomId, { ...envelope, command: { kind: 'declare-mulligan', decision: 'keep' as const }, baseRevision: 0 });
    expect(reused?.response).toMatchObject({ kind: 'online-pregame-command-reject-v1', issues: [{ code: 'COMMAND_ID_REUSE_MISMATCH' }] });
    const afterAccepted = fixture.repository.loadPregameV1(fixture.roomId);
    if (afterAccepted === null) throw new Error('Missing accepted Pregame state');
    const originalExec = fixture.storage.sql.exec;
    fixture.storage.sql.exec = <T extends Record<string, unknown>>(query: string, ...bindings: readonly unknown[]) => {
      if (query.startsWith('UPDATE online_pregame_state SET')) return { toArray: () => [] as T[] };
      return originalExec<T>(query, ...bindings);
    };
    const nextSeat = afterAccepted.protocolState.room.seats.find((candidate) => candidate.corePlayerId === afterAccepted.currentPlayerId);
    if (nextSeat?.participantId === null || nextSeat === undefined || afterAccepted.currentPlayerId === null) throw new Error('Missing next Pregame seat');
    expect(() => fixture.repository.applyPregameCommandV1(fixture.roomId, {
      ...envelope, commandId: 'pregame-cas-test', baseRevision: afterAccepted.revision,
      participantId: nextSeat.participantId, ['participantCapability']: nextSeat.seatCapability,
      command: { kind: 'confirm-commanders' },
    })).toThrow(ConflictError);
    expect(fixture.repository.loadPregameV1(fixture.roomId)).toEqual(afterAccepted);
    fixture.storage.close();
  }, 30000);

  it('accepts an E visibility intent through HTTP and returns an exact duplicate without a second mutation', async () => {
    const fixture = await startedRepository(2);
    completePregame(fixture.repository, fixture.roomId);
    const state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (state === null) throw new Error('Missing active variable state');
    const initialGrantCount = state.coreRoot.ruleAuthority.visibility.grantOrder.length;
    const initialReceiptCount = state.receipts.length;
    const seat = state.room.seats[0];
    if (seat?.participantId === null || seat === undefined) throw new Error('Missing host seat');
    const clock = Date.now();
    const object = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [], now: () => clock });
    const body = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, protocolVersion: state.protocolVersion,
      roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability,
      commandId: 'runtime-visibility-http-1', baseRevision: state.revision,
      look: { subject: { kind: 'top-of-library', count: 1 }, viewerPlayerIds: [seat.corePlayerId], duration: { kind: 'next-command' } },
    };
    const post = () => object.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    const accepted = await post();
    expect(accepted.status).toBe(200);
    const acceptedBody = await accepted.json() as Record<string, unknown>;
    expect(acceptedBody).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: state.revision + 1 });
    const afterFirst = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (afterFirst === null) throw new Error('Missing post-visibility state');
    expect(afterFirst.revision).toBe(state.revision + 1);
    expect(afterFirst.coreRoot.ruleAuthority.visibility.grantOrder).toHaveLength(initialGrantCount + 1);
    expect(afterFirst.receipts).toHaveLength(initialReceiptCount + 1);
    const acceptedReceipt = afterFirst.receipts.at(-1);
    if (acceptedReceipt === undefined) throw new Error('Missing accepted visibility receipt');
    expect(acceptedReceipt.commandId).toBe(body.commandId);
    expect(acceptedReceipt.acceptedRevision).toBe(state.revision + 1);
    expect(acceptedReceipt.status).toBe('accepted');
    const duplicate = await post();
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true, acceptedRevision: afterFirst.revision });
    const changedIntent = await object.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, look: { ...body.look, viewerPlayerIds: ['P2'] } }) }));
    expect(changedIntent.status).toBe(400);
    expect(fixture.repository.loadVariableProtocolV2(fixture.roomId)).toEqual(afterFirst);
    fixture.storage.close();
  }, 30000);

  it('leaves protocol state, journal, revision, grants, and sessions unchanged when E persistence fails', async () => {
    const fixture = await startedRepository(2);
    completePregame(fixture.repository, fixture.roomId);
    const before = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (before === null) throw new Error('Missing active variable state');
    const seat = before.room.seats[0];
    if (seat?.participantId === null || seat === undefined) throw new Error('Missing host seat');
    const object = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [], now: () => Date.now() });
    const body = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1, protocolVersion: before.protocolVersion,
      roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability,
      commandId: 'runtime-visibility-persist-failure', baseRevision: before.revision,
      look: { subject: { kind: 'top-of-library', count: 1 }, viewerPlayerIds: [seat.corePlayerId], duration: { kind: 'next-command' } },
    };
    const originalExec = fixture.storage.sql.exec;
    fixture.storage.sql.exec = <T extends Record<string, unknown>>(query: string, ...bindings: readonly unknown[]) => {
      if (query.startsWith('UPDATE online_variable_room_state SET')) return { toArray: () => [] as T[] };
      return originalExec<T>(query, ...bindings);
    };
    try {
      const response = await object.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      expect(response.status).toBe(500);
    } finally {
      fixture.storage.sql.exec = originalExec;
    }
    const after = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    expect(after).toEqual(before);
    expect(after?.revision).toBe(before.revision);
    expect(after?.receipts).toEqual(before.receipts);
    expect(after?.coreRoot.ruleAuthority.visibility).toEqual(before.coreRoot.ruleAuthority.visibility);
    expect(after?.coreRoot.ruleAuthority.searchSessions).toEqual(before.coreRoot.ruleAuthority.searchSessions);
    fixture.storage.close();
  }, 30000);

  it('rejects raw visibility mutations and delegated search over ordinary HTTP and WebSocket envelopes without mutation', async () => {
    const fixture = await startedRepository(2);
    completePregame(fixture.repository, fixture.roomId);
    const state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (state === null) throw new Error('Missing active variable state');
    const seat = state.room.seats[0];
    const otherSeat = state.room.seats[1];
    if (seat?.participantId === null || seat === undefined || otherSeat === undefined) throw new Error('Missing runtime seats');
    const before = state;
    const object = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [], now: () => Date.now() });
    const commandBase = {
      schemaVersion: 1 as const,
      sequence: state.revision + 1,
      actorPlayerId: seat.corePlayerId,
      decisionMakerPlayerId: seat.corePlayerId,
      decisionContext: { kind: 'decision' as const, decisionKey: 'raw-visibility-bypass' },
    };
    const rawOpen = createCoreCommandV1({
      ...commandBase,
      payload: {
        kind: 'visibility-open', grantKey: 'raw-visibility-open',
        grant: { subject: { kind: 'top-of-library', playerId: seat.corePlayerId, count: 1 }, audience: { kind: 'players', playerIds: [seat.corePlayerId] }, mode: 'look', sourceObjectId: null, duration: { kind: 'until-next-command', openingSequence: state.revision + 1 }, networkBound: true },
      },
    });
    const rawClose = createCoreCommandV1({ ...commandBase, payload: { kind: 'visibility-close', grantKey: 'raw-visibility-open' } });
    const rawDelegatedSearch = createCoreCommandV1({ ...commandBase, decisionMakerPlayerId: otherSeat.corePlayerId, payload: { kind: 'search-complete', sessionKey: 'raw-search', selectedObjectIds: [] } });
    const post = (commandId: string, command: unknown) => object.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId, baseRevision: state.revision, command }) }));
    expect((await post('raw-open-http', rawOpen)).status).toBe(400);
    expect((await post('raw-close-http', rawClose)).status).toBe(400);
    expect((await post('raw-search-http', rawDelegatedSearch)).status).toBe(400);
    expect(fixture.repository.loadVariableProtocolV2(fixture.roomId)).toEqual(before);

    const sent: string[] = [];
    let attachment: unknown;
    const socket = { send: (data: string) => { sent.push(data); }, serializeAttachment: (value: unknown) => { attachment = value; }, deserializeAttachment: () => attachment };
    const sockets = [socket];
    const wsObject = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => sockets, now: () => Date.now() });
    const client = Object.freeze({ side: 'client' });
    class FakePair { readonly 0 = client; readonly 1 = socket; }
    class CloudflareResponse { readonly status: number; readonly webSocket: unknown; constructor(_body: BodyInit | null, init: ResponseInit & { readonly webSocket?: unknown } = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket; } }
    vi.stubGlobal('WebSocketPair', FakePair); vi.stubGlobal('Response', CloudflareResponse);
    try {
      const upgraded = await wsObject.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/websocket`, { headers: { upgrade: 'websocket' } }));
      expect(upgraded.status).toBe(101);
      wsObject.webSocketMessage(socket, JSON.stringify({ kind: 'online-client-hello-v1', protocolVersion: state.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, clientBuildId: state.serverBuildId }));
      const rawFrame = (commandId: string, command: unknown) => ({ kind: 'online-command-envelope-v1', protocolVersion: state.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId, baseRevision: state.revision, command });
      wsObject.webSocketMessage(socket, JSON.stringify(rawFrame('raw-open-ws', rawOpen)));
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-cloudflare-websocket-error-v1', code: 'INVALID_MESSAGE' });
      wsObject.webSocketMessage(socket, JSON.stringify(rawFrame('raw-close-ws', rawClose)));
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-cloudflare-websocket-error-v1', code: 'INVALID_MESSAGE' });
      wsObject.webSocketMessage(socket, JSON.stringify(rawFrame('raw-search-ws', rawDelegatedSearch)));
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-cloudflare-websocket-error-v1', code: 'INVALID_MESSAGE' });
      expect(fixture.repository.loadVariableProtocolV2(fixture.roomId)).toEqual(before);
    } finally {
      vi.unstubAllGlobals();
      fixture.storage.close();
    }
  }, 60000);

  it('admits Pregame commands through security and rejects a retired credential', async () => {
    const fixture = await startedRepository(2);
    const initial = fixture.repository.loadPregameV1(fixture.roomId);
    if (initial === null || initial.currentPlayerId === null) throw new Error('Missing Pregame actor');
    const firstSeat = initial.protocolState.room.seats.find((candidate) => candidate.corePlayerId === initial.currentPlayerId);
    if (firstSeat?.participantId === null || firstSeat === undefined) throw new Error('Missing Pregame seat');
    const clock = Date.now();
    const object = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [], now: () => clock });
    const post = (path: string, value: Record<string, unknown>) => object.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }));
    const invalidAdmission = await post('pregame', {
      kind: 'not-a-pregame-envelope', schemaVersion: 1, roomId: fixture.roomId,
      participantId: firstSeat.participantId, ['participantCapability']: `seat_${'z'.repeat(40)}`,
    });
    expect(invalidAdmission.status).toBe(401);
    const firstBody = {
      kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId: fixture.roomId,
      participantId: firstSeat.participantId, ['participantCapability']: firstSeat.seatCapability,
      commandId: 'runtime-pregame-first', baseRevision: 0, command: { kind: 'confirm-commanders' },
    };
    expect((await post('pregame', firstBody)).status).toBe(200);
    const next = fixture.repository.loadPregameV1(fixture.roomId);
    if (next === null || next.currentPlayerId === null) throw new Error('Missing next Pregame actor');
    const secondSeat = next.protocolState.room.seats.find((candidate) => candidate.corePlayerId === next.currentPlayerId);
    if (secondSeat?.participantId === null || secondSeat === undefined) throw new Error('Missing next Pregame seat');
    const rotatedValue = `rotated_${'x'.repeat(40)}`;
    const rotated = await post('capabilities', {
      kind: 'online-cloudflare-capability-rotate-v1', schemaVersion: 1, participantId: secondSeat.participantId,
      ['currentCapability']: secondSeat.seatCapability, ['nextCapability']: rotatedValue,
    });
    expect(rotated.status).toBe(200);
    const retired = await post('pregame', {
      kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId: fixture.roomId,
      participantId: secondSeat.participantId, ['participantCapability']: secondSeat.seatCapability,
      commandId: 'runtime-pregame-retired', baseRevision: next.revision, command: { kind: 'confirm-commanders' },
    });
    expect(retired.status).toBe(401);
    expect(fixture.repository.loadPregameV1(fixture.roomId)?.revision).toBe(next.revision);
    const current = await post('pregame', {
      kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId: fixture.roomId,
      participantId: secondSeat.participantId, ['participantCapability']: rotatedValue,
      commandId: 'runtime-pregame-current', baseRevision: next.revision, command: { kind: 'confirm-commanders' },
    });
    expect(current.status).toBe(200);
    expect(fixture.repository.loadPregameV1(fixture.roomId)?.revision).toBe(next.revision + 1);
    fixture.storage.close();
  }, 30000);

  it.each([2, 4] as const)('keeps local and production Pregame transitions identical for %ip', async (playerCount) => {
    const fixture = await startedRepository(playerCount);
    const remoteInitial = fixture.repository.loadPregameV1(fixture.roomId);
    if (remoteInitial === null) throw new Error('Missing remote Pregame state');
    const initialRows = fixture.storage.sql.exec<{ readonly initial_state_json: unknown }>('SELECT initial_state_json FROM online_pregame_state WHERE singleton = 1').toArray();
    const initialJson = initialRows[0]?.initial_state_json;
    if (typeof initialJson !== 'string') throw new Error('Missing persisted Pregame initial state');
    const localInput: unknown = JSON.parse(initialJson);
    const localCreated = createOnlinePregameLifecycleV1({ initialState: localInput, randomPlan: remoteInitial.randomPlan });
    if (!localCreated.ok) throw new Error('Local Pregame lifecycle rejected persisted initial state');
    let localState = localCreated.value;
    let remoteState = remoteInitial;
    let commandIndex = 0;
    const clock = Date.now();
    const object = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [], now: () => clock });
    const post = (value: Record<string, unknown>) => object.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/pregame`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }));
    while (localState.phase !== 'complete') {
      const actor = localState.currentPlayerId ?? localState.players.find((player) => !player.ready)?.playerId;
      if (actor === undefined) throw new Error('Local Pregame actor missing');
      const seat = localState.protocolState.room.seats.find((candidate) => candidate.corePlayerId === actor);
      if (seat?.participantId === null || seat === undefined) throw new Error('Local Pregame seat missing');
      const command = localState.phase === 'commander-reveal'
        ? { kind: 'confirm-commanders' as const }
        : localState.phase === 'mulligan-declaration'
          ? { kind: 'declare-mulligan' as const, decision: 'keep' as const }
          : localState.phase === 'pregame-actions'
            ? { kind: 'complete-pregame-actions' as const }
            : { kind: 'set-ready' as const, ready: true };
      const envelope = {
        kind: 'online-pregame-command-envelope-v1' as const,
        schemaVersion: 1 as const,
        roomId: fixture.roomId,
        participantId: seat.participantId,
        ['participantCapability']: seat.seatCapability,
        commandId: `parity-${String(commandIndex)}`,
        baseRevision: localState.revision,
        command,
      };
      const localTransition = handleOnlinePregameCommandEnvelopeV1(localState, envelope);
      expect(localTransition.response.kind).toBe('online-pregame-command-ack-v1');
      localState = localTransition.state;
      const remoteResponse = await post(envelope);
      expect(remoteResponse.status).toBe(200);
      const remoteBody = await remoteResponse.json() as { readonly response?: { readonly kind?: unknown } };
      expect(remoteBody.response?.kind).toBe('online-pregame-command-ack-v1');
      const loaded = fixture.repository.loadPregameV1(fixture.roomId);
      if (loaded === null) throw new Error('Production Pregame state disappeared');
      remoteState = loaded;
      const localProjection = projectOnlinePregameV1(localState, 'host');
      const remoteProjection = fixture.repository.projectPregameV1(fixture.roomId, 'host');
      if (remoteProjection === null) throw new Error('Production Pregame projection disappeared');
      const checkedLocal = validateOnlinePregameProjectionV1(localProjection);
      const checkedRemote = validateOnlinePregameProjectionV1(remoteProjection);
      expect(checkedLocal.ok).toBe(true);
      expect(checkedRemote.ok).toBe(true);
      expect(JSON.stringify(localProjection)).toBe(JSON.stringify(remoteProjection));
      expect(JSON.stringify(localState.journal)).toBe(JSON.stringify(remoteState.journal));
      commandIndex += 1;
    }
    const productionProtocol = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (productionProtocol === null) throw new Error('Production Protocol handoff missing');
    expect(remoteState.phase).toBe('complete');
    expect(localState.protocolState.coreRoot).toEqual(productionProtocol.coreRoot);
    expect(remoteState.protocolState.coreRoot).toEqual(productionProtocol.coreRoot);
    expect(productionProtocol.room.lifecycle).toBe('active');
    expect(productionProtocol.coreRoot.ruleAuthority.turnPriorityBundle.lifecycle).toMatchObject({ turnNumber: 1, position: { phase: 'beginning', step: 'untap' } });
    fixture.storage.close();
  }, 90000);

  it('persists shared admission through the Durable Object boundary and reports full at configured count', async () => {
    const storage = new ReviewSqliteStorage(); const initial = lobby(2, 20); const object = new OnlineRoomDurableObject({ id: { name: initial.roomId }, storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
    const post = (value: unknown) => object.fetch(new Request(`https://room.test/api/online/rooms/${initial.roomId}/lobby`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }));
    expect((await post({ kind: 'online-forming-lobby-initialize-v4', schemaVersion: 4, lobby: initial })).status).toBe(200);
    const claimed = await post({ kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4, participantId: 'player-2', admissionCapability: initial.admissionCapability }); expect(claimed.status).toBe(200);
    const full = await post({ kind: 'online-forming-lobby-shared-claim-v4', schemaVersion: 4, participantId: 'player-3', admissionCapability: initial.admissionCapability }); expect(full.status).toBe(409);
    const reloaded = await object.fetch(new Request(`https://room.test/api/online/rooms/${initial.roomId}/lobby`)); expect(reloaded.status).toBe(200); expect((await reloaded.json() as { readonly seats: readonly unknown[] }).seats).toHaveLength(2);
  }, 30000);

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
  }, 30000);

  it('persists an accepted command through the variable HTTP gameplay transport', async () => {
    const storage = new ReviewSqliteStorage(); const repository = new OnlineCloudflareRepository(storage); repository.migrateApplicationSchema(); let current = lobby(2, 40); const claimed = claimOnlineVariableLobbySeatV4(current, 'player-2', current.admissionCapability); current = claimed.lobby; repository.initializeVariableLobbyV4(current);
    const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
    for (const [index, participantId] of ['host', 'player-2'].entries()) {
      const capability = current.seats[index]?.seatCapability ?? '';
      await repository.submitVariableDeckV2(current.roomId, { kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId, seatCapability: capability, deckId: `transport-deck-${index}`, submissionId: `transport-submission-${index}`, entries: [{ section: 'main', quantity: 40, scryfallId: SID, oracleId: OID }] }, resolver);
      repository.setVariableReadyV4(current.roomId, participantId, capability, true);
    }
    repository.startVariableV4(current.roomId, 'host', current.seats[0]?.seatCapability ?? '');
    completePregame(repository, current.roomId);
    const beforeCommand = repository.loadVariableProtocolV2(current.roomId); if (beforeCommand === null) throw new Error('Missing variable protocol');
    const activePlayerId = beforeCommand.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId;
    const activeSeat = beforeCommand.room.seats.find((seat) => seat.corePlayerId === activePlayerId);
    if (activeSeat?.participantId === null || activeSeat === undefined) throw new Error('Missing active seat');
    const participantId = activeSeat.participantId;
    const networkValue = activeSeat.seatCapability;
    let attachment: unknown; const sent: string[] = []; const socket = { send: (data: string) => { sent.push(data); }, serializeAttachment: (value: unknown) => { attachment = value; }, deserializeAttachment: () => attachment };
    const sockets = [socket]; const object = new OnlineRoomDurableObject({ id: { name: current.roomId }, storage, acceptWebSocket: () => undefined, getWebSockets: () => sockets });
    const client = Object.freeze({ side: 'client' }); class FakePair { readonly 0 = client; readonly 1 = socket; } class CloudflareResponse { readonly status: number; readonly webSocket: unknown; constructor(_body: BodyInit | null, init: ResponseInit & { readonly webSocket?: unknown } = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket; } }
    vi.stubGlobal('WebSocketPair', FakePair); vi.stubGlobal('Response', CloudflareResponse);
    try { const upgraded = await object.fetch(new Request(`https://room.test/api/online/rooms/${current.roomId}/websocket`, { headers: { upgrade: 'websocket' } })); expect(upgraded.status).toBe(101); const ready: unknown = JSON.parse(sent[0] ?? '{}'); expect(ready).toMatchObject({ kind: 'online-cloudflare-websocket-ready-v1', revision: 0 }); } finally { vi.unstubAllGlobals(); }
    object.webSocketMessage(socket, JSON.stringify({ kind: 'online-client-hello-v1', protocolVersion: 1, roomId: current.roomId, participantId, ['participantCapability']: networkValue, clientBuildId: beforeCommand.serverBuildId }));
    expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-server-hello-v1', status: 'accepted', revision: 0 });
    object.webSocketMessage(socket, JSON.stringify({ kind: 'online-projection-request-v1', protocolVersion: 1, roomId: current.roomId, participantId, ['participantCapability']: networkValue, knownRevision: 0, clientBuildId: beforeCommand.serverBuildId }));
    expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-projected-snapshot-v1', status: 'accepted', revision: 0, projection: { kind: 'online-participant-projection-v2', configuration: { playerCount: 2, startingLife: 40 } } });
    const command = createCoreCommandV1({ schemaVersion: 1, sequence: 1, actorPlayerId: activePlayerId, decisionMakerPlayerId: activePlayerId, decisionContext: { kind: 'decision', decisionKey: 'variable-http-transport' }, payload: { kind: 'correct-player-life', playerId: activePlayerId, replacementLifeTotal: 19, expectedBeforeStateDigest: coreCanonicalDigestFromValueV1(beforeCommand.coreRoot), reason: 'variable transport test' } });
    const body = { kind: 'online-command-envelope-v1', protocolVersion: 1, roomId: current.roomId, participantId, ['participantCapability']: networkValue, commandId: 'variable-http-command', baseRevision: 0, command };
    const request = () => new Request(`https://room.test/api/online/rooms/${current.roomId}/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const accepted = await (await object.fetch(request())).json() as Record<string, unknown>;
    expect(accepted.issues).toBeUndefined();
    expect(accepted).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: 1 });
    expect(await (await object.fetch(request())).json()).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true, acceptedRevision: 1 });
    const reloaded = new OnlineCloudflareRepository(storage, false).loadVariableProtocolV2(current.roomId);
    expect(reloaded).toMatchObject({ revision: 1, room: { lifecycle: 'active', seats: [{ outcome: 'pending' }, { outcome: 'pending' }] } });
    expect(reloaded?.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players[activePlayerId]?.life).toBe(19);
    storage.sql.exec("UPDATE online_variable_room_state SET room_lifecycle = 'finished' WHERE singleton = 1");
    expect(() => new OnlineCloudflareRepository(storage, false).loadVariableProtocolV2(current.roomId)).toThrow('Invalid variable protocol state');
    storage.sql.exec("UPDATE online_variable_room_state SET room_lifecycle = 'active' WHERE singleton = 1");
    storage.sql.exec('DELETE FROM online_accepted_command WHERE accepted_revision = 1');
    expect(() => new OnlineCloudflareRepository(storage, false).loadVariableProtocolV2(current.roomId)).toThrow('Invalid variable recovery relation');
  }, 30000);

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
  }, 30000);
});
