// Reviewer-owned adversarial tests for engine-spec §34.43 (I29-I32).
// 実装エージェントは本ファイルを変更しないこと。落ちたら実装側を直す。
// (J0起草 2026-07-15 → 判定者がCR 400.1/400.3照合+冷Tier-1監査の上で再オーナー化 2026-07-16。)
//
// CR grounding: 102.1, 121.1-5, 400.1, 400.3, 701.9a, 701.24a, 704.5b-c.
import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { applyCommand } from '../../engine/commands';
import { makeDeck } from '../../engine/__tests__/helpers';
import { initGame } from '../../engine/init';
import {
  DEFAULT_OPPONENT_ID,
  DEFAULT_OPPONENT_LIFE_LABEL,
  LOCAL_PLAYER_ID,
  PRIVATE_ZONE_IDS,
  defeatPlayerRefForLifeLabel,
  emptyPlayerPrivateZones,
  playerIdForLifeLabel,
  requirePlayer,
  syncDerivedViews,
  type GameState,
  type PlayerId,
  type PrivateZoneId,
} from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function clonePrivateZones(state: GameState): GameState['zonesByPlayer'] {
  const cloned: GameState['zonesByPlayer'] = {};
  for (const playerId of state.turnOrder) {
    const zones = state.zonesByPlayer[playerId] ?? emptyPlayerPrivateZones();
    cloned[playerId] = {
      library: zones.library.slice(),
      hand: zones.hand.slice(),
      graveyard: zones.graveyard.slice(),
    };
  }
  return cloned;
}

function assignCardsToPrivateZone(
  state: GameState,
  playerId: PlayerId,
  zone: PrivateZoneId,
  cardIds: string[],
): GameState {
  const zonesByPlayer = clonePrivateZones(state);
  zonesByPlayer[playerId] ??= emptyPlayerPrivateZones();
  const moved = new Set(cardIds);
  for (const zones of Object.values(zonesByPlayer)) {
    for (const privateZone of PRIVATE_ZONE_IDS) {
      zones[privateZone] = zones[privateZone].filter((cardId) => !moved.has(cardId));
    }
  }
  zonesByPlayer[playerId][zone].push(...cardIds);

  const cards = { ...state.cards };
  for (const cardId of cardIds) {
    const card = cards[cardId];
    if (!card) throw new Error(`fixture card missing: ${cardId}`);
    cards[cardId] = {
      ...card,
      zone,
      ownerId: playerId,
      controllerId: playerId,
    };
  }
  return syncDerivedViews({ ...state, cards, zonesByPlayer });
}

function expectI29(state: GameState): void {
  const seen = new Map<string, { playerId: PlayerId; zone: PrivateZoneId }>();
  for (const playerId of state.turnOrder) {
    const zones = state.zonesByPlayer[playerId];
    expect(zones).toBeDefined();
    for (const zone of PRIVATE_ZONE_IDS) {
      for (const cardId of zones[zone]) {
        expect(seen.has(cardId), `${cardId} duplicated in private zones`).toBe(false);
        seen.set(cardId, { playerId, zone });
        expect(state.cards[cardId]?.ownerId).toBe(playerId);
        expect(state.cards[cardId]?.zone).toBe(zone);
      }
    }
  }
  for (const zone of PRIVATE_ZONE_IDS) {
    expect(state.zones[zone]).toEqual(state.zonesByPlayer[state.localPlayerId][zone]);
  }
}

function privateSnapshot(state: GameState, playerId: PlayerId) {
  const zones = state.zonesByPlayer[playerId];
  return {
    library: zones.library.slice(),
    hand: zones.hand.slice(),
    graveyard: zones.graveyard.slice(),
  };
}

describe('MP-ZONES/COMMANDS Slice A (I29-I32)', () => {
  beforeEach(() => resetStore());

  it('I29 / CR 400.3: an opponent-owned card moved to graveyard routes to the owner, not P1', () => {
    let state = initGame(makeDeck(8), 1);
    const cardId = state.zones.library[0];
    state = {
      ...state,
      cards: {
        ...state.cards,
        [cardId]: {
          ...state.cards[cardId],
          ownerId: DEFAULT_OPPONENT_ID,
          controllerId: DEFAULT_OPPONENT_ID,
        },
      },
    };

    state = applyCommand(state, {
      type: 'moveCard', cardId, to: 'graveyard', position: 'bottom',
    }).state;

    expect(state.zones.graveyard).not.toContain(cardId);
    expect(state.zonesByPlayer.P1.graveyard).not.toContain(cardId);
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].graveyard).toContain(cardId);
    expectI29(state);
  });

  it('I30/I31: opponent draw changes only that library/hand and emits the exact playerId', () => {
    let state = initGame(makeDeck(10), 2);
    const opponentCards = state.zones.library.slice(0, 2);
    state = assignCardsToPrivateZone(state, DEFAULT_OPPONENT_ID, 'library', opponentCards);
    const p1Before = privateSnapshot(state, LOCAL_PLAYER_ID);

    state = applyCommand(state, {
      type: 'draw', count: 2, playerId: DEFAULT_OPPONENT_ID,
    }).state;

    expect(privateSnapshot(state, LOCAL_PLAYER_ID)).toEqual(p1Before);
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].library).toEqual([]);
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].hand).toEqual(opponentCards);
    expect(requirePlayer(state, DEFAULT_OPPONENT_ID).drawnThisTurn).toBe(2);
    const draws = state.eventLog.filter((event) => event.type === 'draw');
    expect(draws).toHaveLength(2);
    expect(draws.every((event) => event.playerId === DEFAULT_OPPONENT_ID)).toBe(true);
    expect(draws.every((event) => event.after?.ownerId === DEFAULT_OPPONENT_ID)).toBe(true);
    expectI29(state);
  });

  it('CR 121.4 / 704.5b: empty-library draw advisory belongs to the affected opponent', () => {
    let state = initGame(makeDeck(6), 1);
    state = applyCommand(state, {
      type: 'draw', count: 1, playerId: DEFAULT_OPPONENT_ID,
    }).state;
    const ref = defeatPlayerRefForLifeLabel(DEFAULT_OPPONENT_LIFE_LABEL);
    expect(state.defeat[ref]?.reasons).toContain('emptyLibraryDraw');
    expect(state.defeat.P1?.reasons ?? []).not.toContain('emptyLibraryDraw');
    const event = state.eventLog.findLast((entry) => entry.type === 'draw');
    expect(event).toMatchObject({
      type: 'draw', playerId: DEFAULT_OPPONENT_ID, result: 'empty-library-attempt',
    });
  });

  it('CR 121.5: opponent mill is isolated and never creates empty-library-draw defeat', () => {
    let state = initGame(makeDeck(10), 3);
    const opponentCards = state.zones.library.slice(0, 3);
    state = assignCardsToPrivateZone(state, DEFAULT_OPPONENT_ID, 'library', opponentCards);
    const p1Before = privateSnapshot(state, LOCAL_PLAYER_ID);
    state = applyCommand(state, {
      type: 'mill', count: 5, playerId: DEFAULT_OPPONENT_ID,
    }).state;

    expect(privateSnapshot(state, LOCAL_PLAYER_ID)).toEqual(p1Before);
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].library).toEqual([]);
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].graveyard).toEqual(opponentCards);
    const ref = defeatPlayerRefForLifeLabel(DEFAULT_OPPONENT_LIFE_LABEL);
    expect(state.defeat[ref]?.reasons ?? []).not.toContain('emptyLibraryDraw');
    expectI29(state);
  });

  it('CR 701.24a: shuffle uses only the specified player library and validates a full permutation', () => {
    let state = initGame(makeDeck(10), 4);
    const opponentCards = state.zones.library.slice(0, 3);
    state = assignCardsToPrivateZone(state, DEFAULT_OPPONENT_ID, 'library', opponentCards);
    const p1Before = privateSnapshot(state, LOCAL_PLAYER_ID);
    const order = opponentCards.slice().reverse();
    state = applyCommand(state, {
      type: 'shuffle', order, playerId: DEFAULT_OPPONENT_ID,
    }).state;
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].library).toEqual(order);
    expect(privateSnapshot(state, LOCAL_PLAYER_ID)).toEqual(p1Before);

    const snapshot = JSON.stringify(state);
    expect(() => applyCommand(state, {
      type: 'shuffle', order: order.slice(1), playerId: DEFAULT_OPPONENT_ID,
    })).toThrow();
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('CR 701.9a: explicit opponent discard accepts only cards in that player hand', () => {
    let state = initGame(makeDeck(10), 5);
    const [opponentCard, p1Card] = state.zones.library.slice(0, 2);
    state = assignCardsToPrivateZone(state, DEFAULT_OPPONENT_ID, 'hand', [opponentCard]);
    state = applyCommand(state, { type: 'draw', count: 1 }).state;
    const localHandCard = state.zones.hand[0] ?? p1Card;

    state = applyCommand(state, {
      type: 'discard', cardIds: [opponentCard, localHandCard], playerId: DEFAULT_OPPONENT_ID,
    }).state;
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].graveyard).toContain(opponentCard);
    expect(state.zones.hand).toContain(localHandCard);
    expectI29(state);
  });

  it('player-aware life and poison update only the subject and emit/advice for that player', () => {
    let state = initGame(makeDeck(6), 6);
    state = applyCommand(state, {
      type: 'adjustLife', delta: -7, playerId: DEFAULT_OPPONENT_ID,
    }).state;
    state = applyCommand(state, {
      type: 'adjustPlayerCounter', kind: 'poison', delta: 10, playerId: DEFAULT_OPPONENT_ID,
    }).state;

    expect(state.life).toBe(40);
    expect(state.poison).toBe(0);
    expect(requirePlayer(state, DEFAULT_OPPONENT_ID).life).toBe(33);
    expect(requirePlayer(state, DEFAULT_OPPONENT_ID).poison).toBe(10);
    expect(state.opponentLife[DEFAULT_OPPONENT_LIFE_LABEL]).toBe(33);
    const ref = defeatPlayerRefForLifeLabel(DEFAULT_OPPONENT_LIFE_LABEL);
    expect(state.defeat[ref]?.reasons).toContain('poison');
    expect(state.eventLog).toContainEqual(expect.objectContaining({
      type: 'lifeChange', playerId: DEFAULT_OPPONENT_ID, delta: -7,
    }));
  });

  it('I32: third/fourth player state and private zones survive commands and snapshot restore', () => {
    const deck = makeDeck(12);
    let state = initGame(deck, 7);
    state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Amy', delta: 0 }).state;
    state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Bob', delta: 0 }).state;
    const amy = playerIdForLifeLabel('Amy');
    const bob = playerIdForLifeLabel('Bob');
    const [amyCard, bobCard] = state.zones.library.slice(0, 2);
    state = assignCardsToPrivateZone(state, amy, 'library', [amyCard]);
    state = assignCardsToPrivateZone(state, bob, 'hand', [bobCard]);
    state = applyCommand(state, { type: 'draw', count: 1, playerId: amy }).state;
    state = applyCommand(state, { type: 'adjustLife', delta: -3 }).state;

    expect(state.zonesByPlayer[amy].hand).toContain(amyCard);
    expect(state.zonesByPlayer[bob].hand).toContain(bobCard);
    expect(requirePlayer(state, amy).drawnThisTurn).toBe(1);
    expectI29(state);

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION, state, deck, autoAdvanceToMain: false,
    };
    store().restoreGame(snapshot);
    const restored = store().state!;
    expect(restored.zonesByPlayer[amy].hand).toContain(amyCard);
    expect(restored.zonesByPlayer[bob].hand).toContain(bobCard);
    expect(requirePlayer(restored, amy).drawnThisTurn).toBe(1);
    expectI29(restored);
  });

  it('unknown player subjects are rejected atomically', () => {
    const state = initGame(makeDeck(6), 1);
    const before = JSON.stringify(state);
    expect(() => applyCommand(state, {
      type: 'draw', count: 1, playerId: 'GHOST',
    })).toThrow('プレイヤーが存在しません');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects snapshots whose shared objects retain a nonparticipant PlayerId', () => {
    const deck = makeDeck(8);
    let state = initGame(deck, 71);
    const cardId = state.zones.library[0];
    state = applyCommand(state, {
      type: 'moveCard', cardId, to: 'battlefield', position: 'bottom',
    }).state;
    state = {
      ...state,
      cards: {
        ...state.cards,
        [cardId]: { ...state.cards[cardId], controllerId: 'GHOST' },
      },
    };
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state,
      deck,
      autoAdvanceToMain: false,
    };

    expect(() => store().restoreGame(snapshot)).toThrow(/PlayerId参照が不整合/);
  });
});
