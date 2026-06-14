/**
 * Reviewer-owned adversarial tests for M4.16: opening-mulligan decision flag.
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { type InitDeckCard } from '../../engine/init';
import { useGameStore } from '../gameStore';
import { makeDef } from '../../engine/__tests__/helpers';

function deck(n: number): InitDeckCard[] {
  return Array.from({ length: n }, (_, i) => ({
    def: makeDef({ scryfallId: `c-${i}`, typeLine: 'Creature' }),
    isCommander: false,
  }));
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('M4.16 opening mulligan decision flag', () => {
  it('newGame sets mulliganDecisionPending = true and leaves history clean', () => {
    useGameStore.getState().newGame(deck(40), 1);
    const s = useGameStore.getState();
    expect(s.mulliganDecisionPending).toBe(true);
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
    expect(s.state!.zones.hand.length).toBe(7);
    expect(s.state!.mulliganCount).toBe(0);
  });

  it('restart re-arms the decision flag', () => {
    useGameStore.getState().newGame(deck(40), 2);
    useGameStore.getState().keepOpeningHand();
    expect(useGameStore.getState().mulliganDecisionPending).toBe(false);
    useGameStore.getState().restart();
    expect(useGameStore.getState().mulliganDecisionPending).toBe(true);
  });

  it('keepOpeningHand clears the flag without polluting undo/redo history', () => {
    useGameStore.getState().newGame(deck(40), 3);
    useGameStore.getState().keepOpeningHand();
    const s = useGameStore.getState();
    expect(s.mulliganDecisionPending).toBe(false);
    // keeping must not create an undoable step
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
  });

  it('mulligan increments count, redraws 7, and keeps the decision pending', () => {
    useGameStore.getState().newGame(deck(40), 4);
    useGameStore.getState().mulligan();
    const s = useGameStore.getState();
    expect(s.state!.mulliganCount).toBe(1);
    expect(s.state!.zones.hand.length).toBe(7);
    expect(s.mulliganDecisionPending).toBe(true); // still deciding
  });
});
