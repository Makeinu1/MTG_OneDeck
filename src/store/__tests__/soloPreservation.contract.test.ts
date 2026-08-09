import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
  SNAPSHOT_VERSION,
  type GameSnapshot,
} from '../../data/gameSnapshot';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import {
  DEFAULT_OPPONENT_ID,
  LOCAL_PLAYER_ID,
  clonePlayerPrivateZones,
  emptyPlayerPrivateZones,
  syncDerivedViews,
  type GameState,
  type PlayerId,
} from '../../engine/types';
import { disableSnapshotPersistenceForDevelopment, useGameStore } from '../gameStore';

const store = () => useGameStore.getState();
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    resolutionSession: null,
    pendingCommanderResolution: null,
    pendingForceActivation: null,
    canUndo: false,
    canRedo: false,
    canUndoInteraction: false,
    canRedoInteraction: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function commanderDef() {
  return makeDef({
    scryfallId: 'solo-preservation-commander',
    name: 'Solo Preservation Commander',
    typeLine: 'Legendary Creature — Test',
  });
}

function testDeck(mainCount = 10) {
  return makeDeck(mainCount, [commanderDef()]);
}

function currentState(): GameState {
  const state = store().state;
  if (!state) throw new Error('test game was not started');
  return state;
}

function privateZones(state: GameState, playerId: PlayerId) {
  const zones = state.zonesByPlayer[playerId] ?? emptyPlayerPrivateZones();
  return {
    library: zones.library.slice(),
    hand: zones.hand.slice(),
    graveyard: zones.graveyard.slice(),
  };
}

function assignCardsToPrivateLibrary(
  state: GameState,
  playerId: PlayerId,
  cardIds: readonly string[],
): GameState {
  const moved = new Set(cardIds);
  const zonesByPlayer: GameState['zonesByPlayer'] = {};
  for (const participantId of state.turnOrder) {
    zonesByPlayer[participantId] = clonePlayerPrivateZones(
      state.zonesByPlayer[participantId] ?? emptyPlayerPrivateZones(),
    );
  }

  for (const zones of Object.values(zonesByPlayer)) {
    zones.library = zones.library.filter((cardId) => !moved.has(cardId));
    zones.hand = zones.hand.filter((cardId) => !moved.has(cardId));
    zones.graveyard = zones.graveyard.filter((cardId) => !moved.has(cardId));
  }
  zonesByPlayer[playerId] ??= emptyPlayerPrivateZones();
  zonesByPlayer[playerId].library.push(...cardIds);

  const cards = { ...state.cards };
  for (const cardId of cardIds) {
    const card = cards[cardId];
    if (!card) throw new Error(`missing fixture card: ${cardId}`);
    cards[cardId] = { ...card, zone: 'library', ownerId: playerId, controllerId: playerId };
  }

  return syncDerivedViews({ ...state, cards, zonesByPlayer });
}

beforeEach(() => {
  resetStore();
  disableSnapshotPersistenceForDevelopment();
});

afterEach(async () => {
  await clearSnapshot();
  resetStore();
  globalThis.fetch = originalFetch;
  if (originalWebSocket === undefined) {
    Reflect.deleteProperty(globalThis, 'WebSocket');
  } else {
    globalThis.WebSocket = originalWebSocket;
  }
});

describe('Solo preservation contract', () => {
  it('starts a deterministic seven-card Solo game with its commander in command', () => {
    const deck = testDeck(8);

    store().newGame(deck, 0x01a2b3c4);

    const state = currentState();
    expect(state.zones.command).toHaveLength(1);
    expect(state.cards[state.zones.command[0]]?.isCommander).toBe(true);
    expect(state.zones.hand).toHaveLength(7);
    expect(state.zones.library).toHaveLength(1);
    expect(state.life).toBe(40);
    expect(state.localPlayerId).toBe(LOCAL_PLAYER_ID);
    expect(state.players[LOCAL_PLAYER_ID]).toBeDefined();
  });

  it('operates without fetch or WebSocket access', () => {
    let fetchCalls = 0;
    let webSocketCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(new Error('network is forbidden in this contract test'));
    });
    class FailingWebSocket {
      constructor() {
        webSocketCalls += 1;
        throw new Error('WebSocket is forbidden in this contract test');
      }
    }
    globalThis.WebSocket = FailingWebSocket as unknown as typeof WebSocket;

    expect(() => {
      store().newGame(testDeck(10), 17);
      store().draw(1);
      store().dispatch({ type: 'adjustLife', delta: -1 });
      store().undo();
      store().redo();
    }).not.toThrow();

    expect(fetchCalls).toBe(0);
    expect(webSocketCalls).toBe(0);
  });

  it('creates an immutable versioned Solo snapshot without online contract fields', () => {
    store().newGame(testDeck(10), 23);

    const snapshot = store().takeSnapshot();
    const snapshotBeforeMutation = JSON.stringify(snapshot);

    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(Object.keys(snapshot).sort()).toEqual(['autoAdvanceToMain', 'deck', 'state', 'version']);

    store().dispatch({ type: 'adjustLife', delta: -5 });

    expect(JSON.stringify(snapshot)).toBe(snapshotBeforeMutation);
  });

  it('round-trips state, deck, auto-advance, and SNAPSHOT_VERSION through IndexedDB', async () => {
    store().newGame(testDeck(10), 29);
    store().setAutoAdvance(false);
    const expected = store().takeSnapshot();

    await saveSnapshot(expected);
    store().dispatch({ type: 'adjustLife', delta: -7 });

    const loaded = await loadSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(SNAPSHOT_VERSION);
    expect(loaded?.state).toEqual(expected.state);
    expect(loaded?.deck).toEqual(expected.deck);
    expect(loaded?.autoAdvanceToMain).toBe(false);
  });

  it('rejects unsupported snapshot versions instead of guessing the current version', async () => {
    store().newGame(testDeck(10), 31);
    const snapshot = store().takeSnapshot();
    const unsupported: GameSnapshot = { ...snapshot, version: SNAPSHOT_VERSION + 1 };

    await saveSnapshot(unsupported);

    await expect(loadSnapshot()).resolves.toBeNull();
  });

  it('restores a snapshot structurally and clears undo/redo history', () => {
    store().newGame(testDeck(10), 37);
    store().setAutoAdvance(false);
    const snapshot = store().takeSnapshot();
    store().dispatch({ type: 'adjustLife', delta: -9 });
    expect(store().canUndo).toBe(true);

    store().restoreGame(snapshot);

    expect(store().state).toEqual(snapshot.state);
    expect(store().autoAdvanceToMain).toBe(snapshot.autoAdvanceToMain);
    expect(store().canUndo).toBe(false);
    expect(store().canRedo).toBe(false);
  });

  it('keeps undo and redo life projections synchronized with legacy state.life', () => {
    store().newGame(testDeck(10), 41);
    const originalLife = currentState().life;

    store().dispatch({ type: 'adjustLife', delta: -1 });
    expect(currentState().life).toBe(originalLife - 1);
    expect(currentState().players[LOCAL_PLAYER_ID]?.life).toBe(currentState().life);

    store().undo();
    expect(currentState().life).toBe(originalLife);
    expect(currentState().players[LOCAL_PLAYER_ID]?.life).toBe(currentState().life);

    store().redo();
    expect(currentState().life).toBe(originalLife - 1);
    expect(currentState().players[LOCAL_PLAYER_ID]?.life).toBe(currentState().life);
  });

  it('keeps Solo usable with the existing four-player substrate', () => {
    store().newGame(testDeck(10), 43);
    const before = currentState();
    const p1Before = {
      privateZones: privateZones(before, LOCAL_PLAYER_ID),
      life: before.life,
    };

    store().addOpponent('Bob');
    store().addOpponent('Carol');

    const after = currentState();
    expect(after.turnOrder).toHaveLength(4);
    expect(privateZones(after, LOCAL_PLAYER_ID)).toEqual(p1Before.privateZones);
    expect(after.life).toBe(p1Before.life);
    expect(store().state).not.toHaveProperty('roomId');
    expect(store().state).not.toHaveProperty('sessionId');
  });

  it('isolates an opponent draw from the local private zones', () => {
    store().newGame(testDeck(10), 47);
    const initial = currentState();
    const opponentCard = initial.zonesByPlayer[LOCAL_PLAYER_ID].library[0];
    if (!opponentCard) throw new Error('fixture library is empty');
    const prepared = assignCardsToPrivateLibrary(initial, DEFAULT_OPPONENT_ID, [opponentCard]);
    useGameStore.setState({ state: prepared });
    const p1Before = privateZones(prepared, LOCAL_PLAYER_ID);

    store().dispatch({ type: 'draw', count: 1, playerId: DEFAULT_OPPONENT_ID });

    const after = currentState();
    expect(privateZones(after, LOCAL_PLAYER_ID)).toEqual(p1Before);
    expect(after.zonesByPlayer[DEFAULT_OPPONENT_ID].library).toEqual([]);
    expect(after.zonesByPlayer[DEFAULT_OPPONENT_ID].hand).toEqual([opponentCard]);
  });

  it('produces the same rule state for the same deck and seed', () => {
    const deck = testDeck(10);

    store().newGame(deck, 53);
    const first = JSON.stringify(currentState());
    store().newGame(deck, 53);
    const second = JSON.stringify(currentState());

    expect(second).toBe(first);
    expect(first).not.toContain('roomId');
    expect(first).not.toContain('connection');
    expect(first).not.toContain('timestamp');
  });
});
