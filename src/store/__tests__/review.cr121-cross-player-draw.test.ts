import { beforeEach, describe, expect, it } from 'vitest';

import { applyCommand } from '../../engine/commands';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { CardInstance, DrawEvent, GameState } from '../../engine/types';
import { DEFAULT_OPPONENT_ID, DEFAULT_OPPONENT_LIFE_LABEL } from '../../engine/types';
import { useGameStore } from '../gameStore';

/**
 * Review pins (judge-owned) for cr-121-cross-player-draw.
 *
 * Contract under test:
 *   CR 121.1  — draw = top card of library → hand
 *   CR 121.2  — cards drawn one at a time
 *   CR 121.2c — multi-player draw: active player first, then APNAP order
 *   CR 121.4  — empty library draw attempt → SBA loss (CR 704.5b)
 *
 * These assertions are behavioral (public engine API + zone outcomes) so they
 * bind the contract, not an implementation's internal field names.
 */

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

/**
 * Populate the opponent's library with N dummy cards.
 * The solitaire model starts OPPONENT_A with empty zones, so we inject
 * card instances directly into state for cross-player draw testing.
 */
function seedOpponentLibrary(state: GameState, count: number): GameState {
  const cards = { ...state.cards };
  const oppZones = { ...state.zonesByPlayer[DEFAULT_OPPONENT_ID] };
  const lib = [...oppZones.library];
  for (let i = 0; i < count; i++) {
    const id = `opp-lib-${i}`;
    const defId = `opp-card-${i}`;
    cards[id] = {
      id,
      defId,
      zone: 'library',
      ownerId: DEFAULT_OPPONENT_ID,
      controllerId: DEFAULT_OPPONENT_ID,
      zoneChangeCounter: 0,
      tapped: false,
      faceIndex: 0,
      faceDown: false,
      counters: {},
      damageMarked: 0,
      hasDeathtouchDamage: false,
      isToken: false,
      isCommander: false,
      enteredTurn: 0,
    } satisfies CardInstance;
    lib.push(id);
  }
  oppZones.library = lib;
  return {
    ...state,
    cards,
    defs: {
      ...state.defs,
      ...Object.fromEntries(
        Array.from({ length: count }, (_, i) => [
          `opp-card-${i}`,
          makeDef({ scryfallId: `opp-card-${i}`, typeLine: 'Creature' }),
        ]),
      ),
    },
    zonesByPlayer: {
      ...state.zonesByPlayer,
      [DEFAULT_OPPONENT_ID]: oppZones,
    },
  };
}

/** Set up a game with opponent library seeded. Returns the state. */
function gameWithOpponentLibrary(oppCount: number): GameState {
  store().newGame(makeDeck(30), 42);
  const state = store().state!;
  return seedOpponentLibrary(state, oppCount);
}

function isDrawEvent(e: { type: string }): e is DrawEvent {
  return e.type === 'draw';
}

describe('review.cr121-cross-player-draw: APNAP ordering (CR 121.2c)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('each-player draw executes active player first, then APNAP', () => {
    const state = gameWithOpponentLibrary(10);

    const p1LibBefore = state.zonesByPlayer.P1.library.length;
    const oppLibBefore = state.zonesByPlayer[DEFAULT_OPPONENT_ID].library.length;
    const p1HandBefore = state.zonesByPlayer.P1.hand.length;
    const oppHandBefore = state.zonesByPlayer[DEFAULT_OPPONENT_ID].hand.length;
    const eventLogBefore = state.eventLog.length;

    // Apply "each player draws 2" via applyPlayerEffect
    const result = applyCommand(state, {
      type: 'applyPlayerEffect',
      controllerId: 'P1',
      recipients: 'eachPlayer',
      effect: 'draw',
      amount: 2,
    });

    const next = result.state;
    // Both players drew 2
    expect(next.zonesByPlayer.P1.library.length).toBe(p1LibBefore - 2);
    expect(next.zonesByPlayer.P1.hand.length).toBe(p1HandBefore + 2);
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].library.length).toBe(oppLibBefore - 2);
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].hand.length).toBe(oppHandBefore + 2);

    // CR 121.2c: active player (P1) draws first — verify via event log ordering
    const newEvents = next.eventLog.slice(eventLogBefore);
    const drawEvents = newEvents.filter(isDrawEvent);
    expect(drawEvents.length).toBe(4); // 2 per player
    // First 2 events should be P1's draws (active player first)
    expect(drawEvents[0].playerId).toBe('P1');
    expect(drawEvents[1].playerId).toBe('P1');
    // Next 2 should be opponent's draws
    expect(drawEvents[2].playerId).toBe(DEFAULT_OPPONENT_ID);
    expect(drawEvents[3].playerId).toBe(DEFAULT_OPPONENT_ID);
  });

  it('each-opponent draw skips the controller', () => {
    const state = gameWithOpponentLibrary(10);

    const p1HandBefore = state.zonesByPlayer.P1.hand.length;
    const oppLibBefore = state.zonesByPlayer[DEFAULT_OPPONENT_ID].library.length;

    const result = applyCommand(state, {
      type: 'applyPlayerEffect',
      controllerId: 'P1',
      recipients: 'eachOpponent',
      effect: 'draw',
      amount: 1,
    });

    const next = result.state;
    // Controller (P1) did NOT draw
    expect(next.zonesByPlayer.P1.hand.length).toBe(p1HandBefore);
    // Opponent drew 1
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].library.length).toBe(oppLibBefore - 1);
  });

  it('draw events record per-player ordinals independently (CR 121.2)', () => {
    const state = gameWithOpponentLibrary(10);
    const eventLogBefore = state.eventLog.length;

    const result = applyCommand(state, {
      type: 'applyPlayerEffect',
      controllerId: 'P1',
      recipients: 'eachPlayer',
      effect: 'draw',
      amount: 3,
    });

    const next = result.state;
    const newEvents = next.eventLog.slice(eventLogBefore);
    const drawEvents = newEvents.filter(isDrawEvent);
    expect(drawEvents.length).toBe(6); // 3 per player

    // Each player's ordinals restart at 1
    const p1Draws = drawEvents.filter((e) => e.playerId === 'P1');
    const oppDraws = drawEvents.filter((e) => e.playerId === DEFAULT_OPPONENT_ID);
    expect(p1Draws.map((e) => e.drawOrdinal)).toEqual([1, 2, 3]);
    expect(oppDraws.map((e) => e.drawOrdinal)).toEqual([1, 2, 3]);
  });
});

describe('review.cr121-cross-player-draw: empty library per player (CR 121.4 / 704.5b)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('empty-library opponent gets defeat advisory via SBA, not a draw', () => {
    // Start with opponent having 0 cards (default solitaire state)
    store().newGame(makeDeck(30), 42);
    const state = store().state!;
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].library.length).toBe(0);
    const eventLogBefore = state.eventLog.length;

    // "Each player draws 1" — P1 draws, opponent attempts from empty
    const p1HandBefore = state.zonesByPlayer.P1.hand.length;
    const result = applyCommand(state, {
      type: 'applyPlayerEffect',
      controllerId: 'P1',
      recipients: 'eachPlayer',
      effect: 'draw',
      amount: 1,
    });

    const next = result.state;
    // P1 drew successfully
    expect(next.zonesByPlayer.P1.hand.length).toBe(p1HandBefore + 1);
    // Opponent did NOT draw (empty library)
    const newEvents = next.eventLog.slice(eventLogBefore);
    const oppDrawEvents = newEvents.filter(
      (e): e is DrawEvent => e.type === 'draw' && e.playerId === DEFAULT_OPPONENT_ID,
    );
    // The opponent's draw event should be 'empty-library-attempt'
    expect(oppDrawEvents.length).toBe(1);
    expect(oppDrawEvents[0].result).toBe('empty-library-attempt');

    // CR 121.4 / CR 704.5b: applyCommand runs stabilizeBeforePriority, which
    // consumes the emptyLibraryDrawAttemptedSinceLastSba flag and produces a
    // defeat advisory. The flag is cleared after SBA processing.
    const oppRef = `opponent:${DEFAULT_OPPONENT_LIFE_LABEL}` as const;
    const oppDefeat = next.defeat[oppRef];
    expect(oppDefeat).toBeDefined();
    expect(oppDefeat!.reasons).toContain('emptyLibraryDraw');
    expect(oppDefeat!.ruleRefs.emptyLibraryDraw).toBe('704.5b');
    // P1 should NOT have a defeat advisory
    expect(next.defeat['P1']).toBeUndefined();
  });

  it('partial library: draws what is available, then defeat for remainder', () => {
    // Seed opponent with exactly 1 card
    const state = gameWithOpponentLibrary(1);
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].library.length).toBe(1);
    const eventLogBefore = state.eventLog.length;

    // "Each player draws 3" — opponent draws 1, then 2 empty attempts
    const result = applyCommand(state, {
      type: 'applyPlayerEffect',
      controllerId: 'P1',
      recipients: 'eachPlayer',
      effect: 'draw',
      amount: 3,
    });

    const next = result.state;
    const newEvents = next.eventLog.slice(eventLogBefore);
    const oppDrawEvents = newEvents.filter(
      (e): e is DrawEvent => e.type === 'draw' && e.playerId === DEFAULT_OPPONENT_ID,
    );
    // 1 successful draw + 2 empty attempts = 3 events
    expect(oppDrawEvents.length).toBe(3);
    expect(oppDrawEvents[0].result).toBe('drawn');
    expect(oppDrawEvents[1].result).toBe('empty-library-attempt');
    expect(oppDrawEvents[2].result).toBe('empty-library-attempt');
    // SBA consumed the flag → defeat advisory for opponent
    const oppRef = `opponent:${DEFAULT_OPPONENT_LIFE_LABEL}` as const;
    const oppDefeat = next.defeat[oppRef];
    expect(oppDefeat).toBeDefined();
    expect(oppDefeat!.reasons).toContain('emptyLibraryDraw');
  });
});

describe('review.cr121-cross-player-draw: old draw command playerId (CR 121.1)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('draw command with explicit playerId draws from that player library', () => {
    const state = gameWithOpponentLibrary(10);

    const oppLibBefore = state.zonesByPlayer[DEFAULT_OPPONENT_ID].library.length;
    const oppHandBefore = state.zonesByPlayer[DEFAULT_OPPONENT_ID].hand.length;

    const result = applyCommand(state, {
      type: 'draw',
      count: 1,
      playerId: DEFAULT_OPPONENT_ID,
    });

    const next = result.state;
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].library.length).toBe(oppLibBefore - 1);
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].hand.length).toBe(oppHandBefore + 1);
    // P1 library untouched
    expect(next.zonesByPlayer.P1.library.length).toBe(state.zonesByPlayer.P1.library.length);
  });

  it('draw command without playerId defaults to localPlayerId', () => {
    store().newGame(makeDeck(30), 42);
    const state = store().state!;

    const p1LibBefore = state.zonesByPlayer.P1.library.length;

    const result = applyCommand(state, {
      type: 'draw',
      count: 1,
    });

    const next = result.state;
    expect(next.zonesByPlayer.P1.library.length).toBe(p1LibBefore - 1);
  });
});

describe('review.cr121-cross-player-draw: undo/redo atomicity', () => {
  beforeEach(() => {
    resetStore();
  });

  it('cross-player draw is a single undo snapshot', () => {
    const state = gameWithOpponentLibrary(10);
    const baselineJson = JSON.stringify(state);

    const result = applyCommand(state, {
      type: 'applyPlayerEffect',
      controllerId: 'P1',
      recipients: 'eachPlayer',
      effect: 'draw',
      amount: 2,
    });

    const next = result.state;
    // State changed
    expect(JSON.stringify(next)).not.toBe(baselineJson);

    // Both players' zones changed
    expect(next.zonesByPlayer.P1.hand.length).toBe(state.zonesByPlayer.P1.hand.length + 2);
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].hand.length).toBe(
      state.zonesByPlayer[DEFAULT_OPPONENT_ID].hand.length + 2,
    );

    // applyCommand is pure: original state is unchanged
    expect(JSON.stringify(state)).toBe(baselineJson);
  });
});
