// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardDef } from '../../../types/card';
import { buildVariableRoomGenesisV3 } from '../../../online/genesis/index';
import {
  createOnlinePregameLifecycleV1,
  handleOnlinePregameCommandEnvelopeV1,
  projectOnlinePregameV1,
  type OnlinePregameProjectionV1,
  type OnlinePregameStateV1,
} from '../../../online/pregame/index';
import { encodeOnlineSharedInviteCodeV3 } from '../../../online/publicApp/index';
import { PublicOnlineApp } from '../PublicOnlineApp';

type PlayerCount = 2 | 4;
type Fixture = Readonly<{ readonly state: OnlinePregameStateV1; readonly projection: OnlinePregameProjectionV1 }>;
const SNAPSHOT_DIGEST = 'ad1af0e7f2febd2dadc6356d5e743b65b2a70c80a680f8b2846edffc6d5f2f02';

function card(scryfallId: string, oracleId: string, name: string, typeLine: string): CardDef {
  return Object.freeze({ scryfallId, oracleId, name, lang: 'en', layout: 'normal', cmc: 2, colorIdentity: [], typeLine, faces: [{ name, typeLine, oracleText: '' }] });
}

function makeFixture(participantId: string, playerCount: PlayerCount): Fixture {
  const entries = Object.freeze([
    Object.freeze({ index: 0, section: 'commander' as const, quantity: 1, scryfallId: '00000000-0000-4000-8000-000000000021', oracleId: '00000000-0000-4000-8000-000000000121', definition: card('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000121', 'Journey Commander', 'Legendary Creature') }),
    Object.freeze({ index: 1, section: 'main' as const, quantity: 40, scryfallId: '00000000-0000-4000-8000-000000000022', oracleId: '00000000-0000-4000-8000-000000000122', definition: card('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000122', 'Journey Main', 'Artifact') }),
  ]);
  const snapshotFor = () => {
    const serialized = JSON.stringify({ entries });
    return Object.freeze({ entries, serialized, digest: SNAPSHOT_DIGEST });
  };
  const seats = Array.from({ length: playerCount }, (_, index) => Object.freeze({
    seatIndex: index as 0 | 1 | 2 | 3,
    corePlayerId: `P${index + 1}` as 'P1' | 'P2' | 'P3' | 'P4',
    participantId: index === 0 ? participantId : `journey-player-${index + 1}`,
    ['seatCapability']: `seat_${String.fromCharCode(112 + index).repeat(40)}`,
    snapshot: snapshotFor(),
  }));
  const genesis = buildVariableRoomGenesisV3({
    roomId: `public-app-journey-${playerCount}`,
    serverBuildId: 'o4p-08c-review-build',
    configuration: { playerCount, startingLife: 40 },
    seats,
    tableParticipantId: `public-app-table-${playerCount}`,
    ['tableCapability']: `observer_${'t'.repeat(40)}`,
  });
  if (!genesis.ok) throw new Error('Journey genesis failed');
  const registry = genesis.protocolState.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const count = playerCount === 2 ? 8 : 9;
  const libraryPlans = registry.turnOrder.map((playerId, playerIndex) => {
    const zones = registry.zones.byPlayer[playerId];
    if (zones === undefined) throw new Error('Journey zones missing');
    const physicalIds = zones.library.flatMap((objectId) => {
      const object = registry.objects[objectId];
      return object?.kind === 'card' ? [object.physicalCardId] : [];
    });
    return { playerId, orders: Array.from({ length: count }, (_, round) => { const offset = (round + playerIndex) % physicalIds.length; return [...physicalIds.slice(offset), ...physicalIds.slice(0, offset)]; }) };
  });
  const created = createOnlinePregameLifecycleV1({
    initialState: genesis.protocolState,
    randomPlan: { kind: 'online-pregame-random-plan-v1', schemaVersion: 1, decisionId: `journey-plan-${playerCount}`, startingPlayerId: 'P1', turnOrder: registry.turnOrder, libraryPlans },
  });
  if (!created.ok) throw new Error('Journey Pregame creation failed');
  return Object.freeze({ state: created.value, projection: projectOnlinePregameV1(created.value, participantId) });
}

function lobbyProjection(hostId: string, playerCount: PlayerCount): Record<string, unknown> {
  return {
    kind: 'online-forming-lobby-projection-v4', schemaVersion: 4, lifecycle: 'ready',
    roomId: `public-app-journey-${playerCount}`, serverBuildId: 'o4p-08c-review-build', hostParticipantId: hostId,
    configuration: { playerCount, startingLife: 40 },
    seats: Array.from({ length: playerCount }, (_, index) => ({ seatIndex: index, corePlayerId: `P${index + 1}`, participantId: index === 0 ? hostId : `journey-player-${index + 1}`, acceptedDeck: true, ready: true })),
  };
}

function deck(): Readonly<Record<string, unknown>> {
  return {
    id: 'journey-deck', name: 'Journey Deck', entries: [{ section: 'main', quantity: 40, card: { scryfallId: '00000000-0000-4000-8000-000000000022', oracleId: '00000000-0000-4000-8000-000000000122', name: 'Journey Main', lang: 'en', layout: 'normal', cmc: 2, colorIdentity: [], typeLine: 'Artifact', faces: [{ name: 'Journey Main', typeLine: 'Artifact', oracleText: '' }] } }],
  };
}

function mount(): Readonly<{ readonly root: Root; readonly container: HTMLDivElement }> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<PublicOnlineApp decks={[deck() as never]} initialDeckId="journey-deck" onBackToSolo={vi.fn()} />));
  return { root, container };
}

async function click(container: HTMLElement, testId: string): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (button === null) throw new Error(`Missing journey control ${testId}`);
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('PublicOnlineApp Pregame journey', () => {
  it.each([2, 4] as const)('automates the complete %ip Pregame journey with focus and responsive hooks', async (playerCount) => {
    let hostId = '';
    let fixture: Fixture | null = null;
    let autoIndex = 0;
    const roomId = `public-app-journey-${playerCount}`;
    const admissionValue = `admission_${'a'.repeat(40)}`;
    const inviteCode = encodeOnlineSharedInviteCodeV3(roomId, admissionValue);
    vi.stubGlobal('WebSocket', class {
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;
      send(): void {}
      close(): void {}
    });
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Journey request body missing');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body.kind === 'online-forming-lobby-create-v5') {
        hostId = String(body.participantId);
        fixture = makeFixture(hostId, playerCount);
        return Promise.resolve(new Response(JSON.stringify({ kind: 'online-forming-lobby-created-v5', schemaVersion: 5, roomId, participantId: hostId, playerCount, startingLife: 40, ['seatCapability']: `seat_${'p'.repeat(40)}`, inviteCode, tableParticipantId: `public-app-table-${playerCount}`, ['tableCapability']: `observer_${'t'.repeat(40)}`, projection: lobbyProjection(hostId, playerCount) }), { status: 200 }));
      }
      if (body.kind === 'online-forming-lobby-start-v4') {
        if (fixture === null) throw new Error('Journey Pregame fixture missing');
        return Promise.resolve(new Response(JSON.stringify({ kind: 'online-cloudflare-room-status-v2', schemaVersion: 2, roomId, playerCount, startingLife: 40, revision: 0, roomLifecycle: 'active', pregame: fixture.projection }), { status: 200 }));
      }
      if (body.kind === 'online-pregame-command-envelope-v1') {
        if (fixture === null) throw new Error('Journey Pregame fixture missing');
        const hostTransition = handleOnlinePregameCommandEnvelopeV1(fixture.state, body);
        let state = hostTransition.state;
        while (state.phase !== 'complete') {
          const actorId = state.currentPlayerId ?? (state.phase === 'ready' ? state.players.find((player) => player.playerId !== 'P1' && !player.ready)?.playerId ?? null : null);
          if (actorId === null || actorId === 'P1') break;
          const seat = state.protocolState.room.seats.find((candidate) => candidate.corePlayerId === actorId);
          if (seat?.participantId === null || seat === undefined) throw new Error('Journey actor missing');
          const command = state.phase === 'commander-reveal'
            ? { kind: 'confirm-commanders' as const }
            : state.phase === 'mulligan-declaration'
              ? { kind: 'declare-mulligan' as const, decision: 'keep' as const }
              : state.phase === 'pregame-actions'
                ? { kind: 'complete-pregame-actions' as const }
                : { kind: 'set-ready' as const, ready: true };
          const transition = handleOnlinePregameCommandEnvelopeV1(state, { kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId: `journey-auto-${autoIndex}`, baseRevision: state.revision, command });
          if (transition.response.kind !== 'online-pregame-command-ack-v1') throw new Error('Journey auto command rejected');
          autoIndex += 1;
          state = transition.state;
        }
        fixture = Object.freeze({ state, projection: projectOnlinePregameV1(state, hostId) });
        return Promise.resolve(new Response(JSON.stringify({ response: hostTransition.response, projection: fixture.projection }), { status: 200 }));
      }
      throw new Error('Unexpected journey request');
    }));
    const mounted = mount();
    if (playerCount === 4) await click(mounted.container, 'online-player-count-4');
    await click(mounted.container, 'online-create-shared');
    await click(mounted.container, 'online-start-game');
    const root = mounted.container.querySelector<HTMLElement>('[data-pregame-layer="true"]');
    if (root === null) throw new Error('Pregame layer missing');
    expect(root.dataset.pregameLayout).toBe('adaptive');
    expect(root.dataset.pregamePhase).toBe('commander-reveal');
    const confirm = mounted.container.querySelector<HTMLButtonElement>('[data-testid="pregame-confirm-commanders"]');
    if (confirm === null) throw new Error('Commander control missing');
    confirm.focus();
    expect(document.activeElement).toBe(confirm);
    await click(mounted.container, 'pregame-confirm-commanders');
    await click(mounted.container, 'pregame-keep');
    await click(mounted.container, 'pregame-complete-actions');
    await click(mounted.container, 'pregame-ready');
    expect(mounted.container.querySelector('[data-pregame-layer="true"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="online-authoritative-configuration"]')?.textContent).toContain(`${playerCount}人・開始ライフ40`);
    act(() => mounted.root.unmount());
  }, 30000);

  it('disables Pregame actions with bounded guidance during background recovery', async () => {
    let hostId = '';
    let fixture: Fixture | null = null;
    const roomId = 'public-app-journey-2';
    const inviteCode = encodeOnlineSharedInviteCodeV3(roomId, `admission_${'b'.repeat(40)}`);
    vi.stubGlobal('WebSocket', class {
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;
      send(): void {}
      close(): void {}
    });
    vi.stubGlobal('fetch', vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Recovery request body missing');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (body.kind === 'online-forming-lobby-create-v5') {
        hostId = String(body.participantId);
        fixture = makeFixture(hostId, 2);
        return Promise.resolve(new Response(JSON.stringify({ kind: 'online-forming-lobby-created-v5', schemaVersion: 5, roomId, participantId: hostId, playerCount: 2, startingLife: 40, ['seatCapability']: `seat_${'p'.repeat(40)}`, inviteCode, tableParticipantId: 'public-app-background-table', ['tableCapability']: `observer_${'t'.repeat(40)}`, projection: { ...lobbyProjection(hostId, 2), roomId } }), { status: 200 }));
      }
      if (body.kind === 'online-forming-lobby-start-v4') {
        if (fixture === null) throw new Error('Recovery Pregame fixture missing');
        return Promise.resolve(new Response(JSON.stringify({ kind: 'online-cloudflare-room-status-v2', schemaVersion: 2, roomId, playerCount: 2, startingLife: 40, revision: 0, roomLifecycle: 'active', pregame: fixture.projection }), { status: 200 }));
      }
      return new Promise<Response>(() => {});
    }));
    const mounted = mount();
    await click(mounted.container, 'online-create-shared');
    await click(mounted.container, 'online-start-game');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 2_100)); });
    const action = mounted.container.querySelector<HTMLButtonElement>('[data-testid="pregame-confirm-commanders"]');
    if (action === null) throw new Error('Background recovery Pregame action missing');
    expect(action.disabled).toBe(true);
    expect(mounted.container.querySelector('[data-testid="game-screen"]')?.textContent).toContain('サーバーで対戦準備を更新しています。');
    act(() => mounted.root.unmount());
  }, 30000);
});
