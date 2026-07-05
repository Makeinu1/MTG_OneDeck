import { beforeEach, describe, expect, it } from 'vitest';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { applyCommand } from '../../engine/commands';
import { initGame } from '../../engine/init';
import {
  PLAYER_IDS,
  PRIVATE_ZONE_IDS,
  type GameState,
  type PlayerId,
  type PrivateZoneId,
} from '../../engine/types';
import { makeDeck } from '../../engine/__tests__/helpers';
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

function withoutZonesByPlayer(state: GameState): GameState {
  const legacyState: Partial<GameState> = { ...state };
  delete legacyState.zonesByPlayer;
  return legacyState as GameState;
}

function expectOwnerPresence(state: GameState): void {
  for (const playerId of PLAYER_IDS) {
    expect(state.zonesByPlayer[playerId]).toBeDefined();
    for (const zone of PRIVATE_ZONE_IDS) {
      expect(Array.isArray(state.zonesByPlayer[playerId][zone])).toBe(true);
    }
  }
}

function expectP1Mirror(state: GameState): void {
  for (const zone of PRIVATE_ZONE_IDS) {
    expect(state.zonesByPlayer.P1[zone]).toEqual(state.zones[zone]);
  }
}

function expectP1OwnerRouting(state: GameState): void {
  for (const zone of PRIVATE_ZONE_IDS) {
    for (const cardId of state.zonesByPlayer.P1[zone]) {
      expect(state.cards[cardId]?.ownerId).toBe('P1');
      expect(state.cards[cardId]?.zone).toBe(zone);
    }
  }
}

function expectPrivateZonesDisjoint(
  state: GameState,
  leftPlayer: PlayerId,
  rightPlayer: PlayerId,
  zone: PrivateZoneId,
): void {
  const right = new Set(state.zonesByPlayer[rightPlayer][zone]);
  for (const cardId of state.zonesByPlayer[leftPlayer][zone]) {
    expect(right.has(cardId)).toBe(false);
  }
}

function expectP1OpponentPrivateZonesDisjoint(state: GameState): void {
  for (const zone of PRIVATE_ZONE_IDS) {
    expectPrivateZonesDisjoint(state, 'P1', 'OPPONENT_A', zone);
    expectPrivateZonesDisjoint(state, 'OPPONENT_A', 'P1', zone);
  }
}

describe('zonesByPlayer private zone state', () => {
  beforeEach(() => {
    resetStore();
  });

  it('initGame creates P1 private-zone mirror and empty opponent zones', () => {
    const state = initGame(makeDeck(6), 1);

    expectOwnerPresence(state);
    expectP1Mirror(state);
    expect(state.zonesByPlayer.OPPONENT_A).toEqual({
      library: [],
      hand: [],
      graveyard: [],
    });
  });

  it('applyCommand keeps zonesByPlayer.P1 in the same order as flat private zones', () => {
    let state = initGame(makeDeck(8), 1);
    state = applyCommand(state, { type: 'draw', count: 2 }).state;
    state = applyCommand(state, { type: 'mill', count: 1 }).state;
    state = applyCommand(state, {
      type: 'shuffle',
      order: state.zones.library.slice().reverse(),
    }).state;

    expectOwnerPresence(state);
    expectP1OwnerRouting(state);
    expectP1OpponentPrivateZonesDisjoint(state);
    expectP1Mirror(state);
  });

  it('restoreGame backfills legacy snapshots from flat zones without losing order', () => {
    const deck = makeDeck(9);
    let state = initGame(deck, 7);
    state = applyCommand(state, { type: 'draw', count: 3 }).state;
    state = applyCommand(state, { type: 'mill', count: 2 }).state;
    const legacyState = withoutZonesByPlayer(state);
    const legacyLibrary = legacyState.zones.library.slice();
    const legacyHand = legacyState.zones.hand.slice();
    const legacyGraveyard = legacyState.zones.graveyard.slice();

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacyState,
      deck,
      autoAdvanceToMain: false,
    };

    expect(() => store().restoreGame(snapshot)).not.toThrow();
    const restored = store().state!;

    expect(restored.zonesByPlayer.P1.library).toEqual(legacyLibrary);
    expect(restored.zonesByPlayer.P1.hand).toEqual(legacyHand);
    expect(restored.zonesByPlayer.P1.graveyard).toEqual(legacyGraveyard);
    expect(restored.zonesByPlayer.OPPONENT_A).toEqual({
      library: [],
      hand: [],
      graveyard: [],
    });
    expectOwnerPresence(restored);
    expectP1Mirror(restored);
  });

  it('restoreGame fills missing player or private-zone arrays with empty arrays', () => {
    const deck = makeDeck(4);
    const base = initGame(deck, 3);
    const partialState = {
      ...base,
      zonesByPlayer: {
        P1: {
          library: base.zones.library.slice(),
        },
      },
    } as unknown as GameState;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: partialState,
      deck,
      autoAdvanceToMain: false,
    };

    expect(() => store().restoreGame(snapshot)).not.toThrow();
    const restored = store().state!;

    expectOwnerPresence(restored);
    expect(restored.zonesByPlayer.P1.hand).toEqual([]);
    expect(restored.zonesByPlayer.P1.graveyard).toEqual([]);
    expect(restored.zonesByPlayer.OPPONENT_A).toEqual({
      library: [],
      hand: [],
      graveyard: [],
    });
    expectP1Mirror(restored);
  });
});
