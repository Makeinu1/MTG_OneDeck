import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVariableRoomGenesisV3 } from '../genesis/index';
import { createOnlinePregameLifecycleV1, handleOnlinePregameCommandEnvelopeV1, projectOnlinePregameV1, type OnlinePregameProjectionV1, type OnlinePregameStateV1 } from '../pregame/index';
import type { CardDef } from '../../types/card';
import { createPublicOnlineControllerV3, encodeOnlineSharedInviteCodeV3, validatePublicOnlineProjectionV3, type PublicOnlineDeckOptionV2 } from './index';

const SNAPSHOT_DIGEST = 'acf12dbcbe10060ab376f1e092e331b2a9d51d6deae9c1a92d43a92757119121';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function projection(playerCount: 2 | 4, startingLife: 20 | 40): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v4',
    schemaVersion: 4,
    lifecycle: 'forming',
    roomId: 'room-v3-ordinary-test',
    serverBuildId: 'o4p-08d-test-build',
    hostParticipantId: 'participant-v3-host',
    configuration: { playerCount, startingLife },
    seats: Array.from({ length: playerCount }, (_, index) => ({
      seatIndex: index,
      corePlayerId: `P${index + 1}`,
      participantId: index === 0 ? 'participant-v3-host' : null,
      acceptedDeck: false,
      ready: false,
    })),
  };
}

function readyProjection(hostId: string): Record<string, unknown> {
  const base = projection(2, 40);
  const seats = (base.seats as readonly Record<string, unknown>[]).map((seat, index) => ({
    ...seat,
    participantId: index === 0 ? hostId : 'participant-v3-ready-guest',
    acceptedDeck: true,
    ready: true,
  }));
  return { ...base, lifecycle: 'ready', hostParticipantId: hostId, seats };
}

function card(scryfallId: string, oracleId: string, name: string, typeLine: string): CardDef {
  return Object.freeze({ scryfallId, oracleId, name, lang: 'en', layout: 'normal', cmc: 2, colorIdentity: [], typeLine, faces: [{ name, typeLine, oracleText: '' }] });
}

function pregameFixture(participantId: string): Readonly<{ readonly state: OnlinePregameStateV1; readonly projection: OnlinePregameProjectionV1 }> {
  const entries = Object.freeze([
    Object.freeze({ index: 0, section: 'commander' as const, quantity: 1, scryfallId: '00000000-0000-4000-8000-000000000011', oracleId: '00000000-0000-4000-8000-000000000111', definition: card('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000111', 'Pregame Commander', 'Legendary Creature') }),
    Object.freeze({ index: 1, section: 'main' as const, quantity: 40, scryfallId: '00000000-0000-4000-8000-000000000012', oracleId: '00000000-0000-4000-8000-000000000112', definition: card('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000112', 'Pregame Main', 'Artifact') }),
  ]);
  const snapshotFor = (entriesForSeat: typeof entries) => {
    const serialized = JSON.stringify({ entries: entriesForSeat });
    return Object.freeze({ entries: entriesForSeat, serialized, digest: SNAPSHOT_DIGEST });
  };
  const genesis = buildVariableRoomGenesisV3({
    roomId: 'room-v3-pregame-test', serverBuildId: 'o4p-08c-review-build', configuration: { playerCount: 2, startingLife: 40 },
    seats: [
      { seatIndex: 0, corePlayerId: 'P1', participantId, ['seatCapability']: `seat_${'p'.repeat(40)}`, snapshot: snapshotFor(entries) },
      { seatIndex: 1, corePlayerId: 'P2', participantId: 'participant-v3-pregame-guest', ['seatCapability']: `seat_${'q'.repeat(40)}`, snapshot: snapshotFor(entries) },
    ],
    tableParticipantId: 'table-v3-pregame-test', ['tableCapability']: `observer_${'r'.repeat(40)}`,
  });
  if (!genesis.ok) throw new Error(`Unable to construct public Pregame fixture: ${JSON.stringify(genesis.issues)}`);
  const registry = genesis.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const libraryPlans = registry.turnOrder.map((playerId) => {
    const zones = registry.zones.byPlayer[playerId];
    if (zones === undefined) throw new Error('Missing public Pregame fixture zones');
    const physicalIds = zones.library.flatMap((objectId) => {
      const object = registry.objects[objectId];
      return object?.kind === 'card' ? [object.physicalCardId] : [];
    });
    return { playerId, orders: Array.from({ length: 8 }, () => physicalIds) };
  });
  const created = createOnlinePregameLifecycleV1({
    initialState: genesis.protocolState,
    randomPlan: { kind: 'online-pregame-random-plan-v1', schemaVersion: 1, decisionId: 'public-pregame-decision', startingPlayerId: 'P1', turnOrder: ['P1', 'P2'], libraryPlans },
  });
  if (!created.ok) throw new Error('Unable to construct public Pregame state');
  return Object.freeze({ state: created.value, projection: projectOnlinePregameV1(created.value, participantId) });
}

describe('public variable-room client v3', () => {
  it('accepts exact 2/20, 2/40, and 4/40 configurations', () => {
    expect(validatePublicOnlineProjectionV3(projection(2, 20))).toMatchObject({ ok: true });
    expect(validatePublicOnlineProjectionV3(projection(2, 40))).toMatchObject({ ok: true });
    expect(validatePublicOnlineProjectionV3(projection(4, 40))).toMatchObject({ ok: true });
  });

  it('rejects a four-player 20-life or surplus-seat projection', () => {
    expect(validatePublicOnlineProjectionV3(projection(4, 20))).toMatchObject({ ok: false });
    expect(validatePublicOnlineProjectionV3({ ...projection(2, 20), seats: projection(4, 40).seats })).toMatchObject({ ok: false });
  });

  it('projects deck issues into ownerIssue and verifies the v2 result envelope', async () => {
    const roomId = 'room-v3-deck-test';
    const inviteCode = encodeOnlineSharedInviteCodeV3(roomId, `admission_${'a'.repeat(40)}`);
    let participantId = '';
    const lobby = projection(2, 40);
    const lobbySeats = lobby.seats as readonly Record<string, unknown>[];
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('missing request body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body.kind === 'online-forming-lobby-create-v5') {
        participantId = String(body.participantId);
        return Promise.resolve(new Response(JSON.stringify({
          kind: 'online-forming-lobby-created-v5', schemaVersion: 5, roomId, participantId,
          playerCount: 2, startingLife: 40, seatCapability: `seat_${'s'.repeat(40)}`, inviteCode,
          tableParticipantId: 'table-v3-deck-test', tableCapability: `observer_${'t'.repeat(40)}`,
          projection: { ...lobby, roomId, hostParticipantId: participantId,
            seats: [{ ...lobbySeats[0], participantId }, lobbySeats[1]] },
        }), { status: 200 }));
      }
      const submissionId = String(body.submissionId);
      return Promise.resolve(new Response(JSON.stringify({
        kind: 'online-forming-lobby-deck-result-v2', schemaVersion: 2, roomId, submissionId,
        state: 'needs-attention', issues: [{ code: 'CARD_NOT_FOUND', entryIndex: 0, retryable: true }],
        projection: { ...lobby, roomId, hostParticipantId: participantId,
          seats: [{ ...lobbySeats[0], participantId }, lobbySeats[1]] },
      }), { status: 200 }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.createShared({ playerCount: 2, startingLife: 40 });
    const deck = {
      id: 'deck-v3-test', name: 'Test', entries: [{ section: 'main', quantity: 40,
        card: { scryfallId: 'sid-v3-test', oracleId: 'oid-v3-test' } }],
    } as unknown as PublicOnlineDeckOptionV2;
    await controller.submitDeck(deck);
    expect(controller.getSnapshot().ownerIssue).toMatchObject({ code: 'CARD_NOT_FOUND', entryIndex: 0, retryable: true });
    controller.disconnect();
  });

  it('accepts the server Pregame projection, submits the command envelope, and recovers the same public phase', async () => {
    let participantId = '';
    let pregame: Readonly<{ readonly state: OnlinePregameStateV1; readonly projection: OnlinePregameProjectionV1 }> | null = null;
    let commandAttempts = 0;
    const commandBodies: Record<string, unknown>[] = [];
    const roomId = 'room-v3-pregame-test';
    const inviteCode = encodeOnlineSharedInviteCodeV3(roomId, `admission_${'a'.repeat(40)}`);
    const baseLobby = projection(2, 40);
    const baseSeats = baseLobby.seats as readonly Record<string, unknown>[];
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('missing request body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body.kind === 'online-forming-lobby-create-v5') {
        participantId = String(body.participantId);
        pregame = pregameFixture(participantId);
        return Promise.resolve(new Response(JSON.stringify({
          kind: 'online-forming-lobby-created-v5', schemaVersion: 5, roomId, participantId,
          playerCount: 2, startingLife: 40, ['seatCapability']: `seat_${'p'.repeat(40)}`, inviteCode,
          tableParticipantId: 'table-v3-pregame-test', ['tableCapability']: `observer_${'t'.repeat(40)}`,
          projection: { ...baseLobby, roomId, hostParticipantId: participantId, seats: [{ ...baseSeats[0], participantId }, baseSeats[1]] },
        }), { status: 200 }));
      }
      if (body.kind === 'online-forming-lobby-start-v4') {
        if (pregame === null) throw new Error('missing Pregame fixture');
        return Promise.resolve(new Response(JSON.stringify({ kind: 'online-cloudflare-room-status-v2', schemaVersion: 2, roomId, playerCount: 2, startingLife: 40, revision: 0, roomLifecycle: 'active', pregame: pregame.projection }), { status: 200 }));
      }
      if (body.kind === 'online-forming-lobby-recover-v5') {
        if (pregame === null) throw new Error('missing Pregame fixture');
        return Promise.resolve(new Response(JSON.stringify({ kind: 'online-forming-lobby-recovered-v5', schemaVersion: 5, roomId, participantId, playerCount: 2, startingLife: 40, admissionOpen: false, inviteCode, tableParticipantId: 'table-v3-pregame-test', ['tableCapability']: `observer_${'t'.repeat(40)}`, projection: { ...baseLobby, lifecycle: 'started', roomId, hostParticipantId: participantId, seats: [{ ...baseSeats[0], participantId, acceptedDeck: true, ready: true }, { ...baseSeats[1], participantId: 'participant-v3-pregame-guest', acceptedDeck: true, ready: true }] }, pregame: pregame.projection }), { status: 200 }));
      }
      if (body.kind === 'online-pregame-command-envelope-v1') {
        if (pregame === null) throw new Error('missing Pregame fixture');
        commandBodies.push(body);
        if (commandAttempts === 0) {
          commandAttempts += 1;
          return Promise.resolve(new Response(JSON.stringify({ kind: 'online-public-error-v3', schemaVersion: 3, code: 'SERVICE_UNAVAILABLE', retryable: true, correlationId: 'correlation-pregame-retry' }), { status: 503 }));
        }
        commandAttempts += 1;
        const transition = handleOnlinePregameCommandEnvelopeV1(pregame.state, body);
        pregame = Object.freeze({ state: transition.state, projection: projectOnlinePregameV1(transition.state, participantId) });
        return Promise.resolve(new Response(JSON.stringify({ response: transition.response, projection: pregame.projection }), { status: 200 }));
      }
      throw new Error('unexpected request');
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.createShared({ playerCount: 2, startingLife: 40 });
    expect(pregame).not.toBeNull();
    await controller.start();
    expect(controller.getSnapshot().pregame).toMatchObject({ phase: 'commander-reveal', revision: 0 });
    await controller.submitPregame({ kind: 'confirm-commanders' });
    expect(controller.getSnapshot().pregame).toMatchObject({ phase: 'commander-reveal', revision: 0 });
    expect(controller.getSnapshot().errorIssue).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
    await controller.retry();
    expect(controller.getSnapshot().pregame).toMatchObject({ phase: 'commander-reveal', currentPlayerId: 'P2', revision: 1 });
    expect(commandBodies).toHaveLength(2);
    expect(commandBodies[0]?.commandId).toBe(commandBodies[1]?.commandId);
    expect(commandBodies[0]?.command).toEqual(commandBodies[1]?.command);
    expect(JSON.stringify(controller.getSnapshot().pregame)).not.toMatch(/(?:randomPlan|libraryPlans|journal|seat_[A-Za-z0-9_-]{8}|observer_[A-Za-z0-9_-]{8})/);
    await controller.refresh();
    expect(controller.getSnapshot().pregame).toMatchObject({ phase: 'commander-reveal', currentPlayerId: 'P2', revision: 1 });
    controller.disconnect();
  });

  it('fails closed when a started response omits Pregame before opening gameplay', async () => {
    const roomId = 'room-v3-start-without-pregame';
    const inviteCode = encodeOnlineSharedInviteCodeV3(roomId, `admission_${'a'.repeat(40)}`);
    let hostId = '';
    const socketFactory = vi.fn(() => ({ send: vi.fn(), close: vi.fn() }));
    vi.stubGlobal('WebSocket', socketFactory);
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('missing request body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body.kind === 'online-forming-lobby-create-v5') {
        hostId = String(body.participantId);
        return Promise.resolve(new Response(JSON.stringify({ kind: 'online-forming-lobby-created-v5', schemaVersion: 5, roomId, participantId: hostId, playerCount: 2, startingLife: 40, ['seatCapability']: `seat_${'p'.repeat(40)}`, inviteCode, tableParticipantId: 'table-v3-start-test', ['tableCapability']: `observer_${'t'.repeat(40)}`, projection: { ...readyProjection(hostId), roomId } }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ kind: 'online-cloudflare-room-status-v2', schemaVersion: 2, roomId, playerCount: 2, startingLife: 40, revision: 0, roomLifecycle: 'active' }), { status: 200 }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.createShared({ playerCount: 2, startingLife: 40 });
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({ lifecycle: 'ready', pregame: null });
    expect(socketFactory).not.toHaveBeenCalled();
    controller.disconnect();
  });

  it('fails closed when recovery omits Pregame before opening gameplay', async () => {
    const roomId = 'room-v3-recover-without-pregame';
    const inviteCode = encodeOnlineSharedInviteCodeV3(roomId, `admission_${'b'.repeat(40)}`);
    let hostId = '';
    const socketFactory = vi.fn(() => ({ send: vi.fn(), close: vi.fn() }));
    vi.stubGlobal('WebSocket', socketFactory);
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('missing request body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body.kind === 'online-forming-lobby-create-v5') {
        hostId = String(body.participantId);
        return Promise.resolve(new Response(JSON.stringify({ kind: 'online-forming-lobby-created-v5', schemaVersion: 5, roomId, participantId: hostId, playerCount: 2, startingLife: 40, ['seatCapability']: `seat_${'q'.repeat(40)}`, inviteCode, tableParticipantId: 'table-v3-recover-test', ['tableCapability']: `observer_${'u'.repeat(40)}`, projection: { ...readyProjection(hostId), roomId } }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ kind: 'online-forming-lobby-recovered-v5', schemaVersion: 5, roomId, participantId: hostId, playerCount: 2, startingLife: 40, admissionOpen: false, inviteCode, tableParticipantId: 'table-v3-recover-test', ['tableCapability']: `observer_${'u'.repeat(40)}`, projection: { ...readyProjection(hostId), roomId, lifecycle: 'started' } }), { status: 200 }));
    }));
    const controller = createPublicOnlineControllerV3();
    await controller.createShared({ playerCount: 2, startingLife: 40 });
    await controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({ lifecycle: 'ready', pregame: null });
    expect(socketFactory).not.toHaveBeenCalled();
    controller.disconnect();
  });
});
