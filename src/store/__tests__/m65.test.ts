import { beforeEach, describe, expect, it } from 'vitest';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { effectiveKeywords } from '../../engine/status';
import type { GameState } from '../../engine/types';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const state = store().state;
  if (!state) {
    throw new Error('game state is not available');
  }

  const card = Object.values(state.cards).find((instance) => instance.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }

  return card.id;
}

describe('M6.5 store manual keyword overrides', () => {
  beforeEach(() => {
    resetStore();
  });

  it('dispatches setManualKeywords as a single undoable store action', () => {
    const creature = makeDef({
      scryfallId: 'store-manual-creature',
      typeLine: 'Creature — Druid',
    });

    store().newGame([{ def: creature, isCommander: false }, ...makeDeck(12)], 1);
    const cardId = findInstanceId('store-manual-creature');

    store().setManualKeywords(cardId, ['haste', 'invalid', 'vigilance', 'haste']);

    expect(store().state?.cards[cardId]?.manualKeywords).toEqual(['haste', 'vigilance']);
    expect(store().canUndo).toBe(true);

    store().undo();
    expect(store().state?.cards[cardId]?.manualKeywords).toBeUndefined();
  });

  it('restoreGame preserves manualKeywords and accepts snapshots that omit them', () => {
    const creature = makeDef({
      scryfallId: 'snapshot-manual-creature',
      typeLine: 'Creature — Soldier',
    });

    store().newGame([{ def: creature, isCommander: false }, ...makeDeck(12)], 1);
    const cardId = findInstanceId('snapshot-manual-creature');
    store().setManualKeywords(cardId, ['haste', 'vigilance']);

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: store().state as GameState,
      deck: [],
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    resetStore();
    store().restoreGame(snapshot);
    expect(store().state?.cards[cardId]?.manualKeywords).toEqual(['haste', 'vigilance']);
    expect(effectiveKeywords(store().state as GameState, cardId)).toEqual([
      'haste',
      'vigilance',
    ]);

    const cardWithoutManual = { ...snapshot.state.cards[cardId] };
    delete cardWithoutManual.manualKeywords;
    const missingSnapshot: GameSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        cards: {
          ...snapshot.state.cards,
          [cardId]: cardWithoutManual,
        },
      },
    };

    resetStore();
    expect(() => store().restoreGame(missingSnapshot)).not.toThrow();
    expect(store().state?.cards[cardId]?.manualKeywords).toBeUndefined();
    expect(effectiveKeywords(store().state as GameState, cardId)).toEqual([]);
  });
});
