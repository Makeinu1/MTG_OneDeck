/**
 * Reviewer-owned adversarial tests for M4.17: mulligan/auto-advance separation
 * and the EDH free-mulligan bottom count. Implementation agents must NOT modify.
 */
import { describe, expect, it } from 'vitest';
import { type InitDeckCard } from '../../engine/init';
import { useGameStore, freeMulliganBottomCount } from '../gameStore';
import { makeDef } from '../../engine/__tests__/helpers';

function deck(n: number): InitDeckCard[] {
  return Array.from({ length: n }, (_, i) => ({
    def: makeDef({ scryfallId: `c-${i}`, typeLine: 'Creature' }),
    isCommander: false,
  }));
}

describe('M4.17 freeMulliganBottomCount (EDH first mulligan is free)', () => {
  it('returns max(0, n - 1)', () => {
    expect(freeMulliganBottomCount(0)).toBe(0);
    expect(freeMulliganBottomCount(1)).toBe(0); // first mulligan free
    expect(freeMulliganBottomCount(2)).toBe(1);
    expect(freeMulliganBottomCount(3)).toBe(2);
  });
});

describe('M4.17 newGame does NOT auto-advance (mulligan decides on 7)', () => {
  it('keeps phase=untap, turn=1, hand=7 even when autoAdvanceToMain is true', () => {
    useGameStore.setState({ autoAdvanceToMain: true });
    useGameStore.getState().newGame(deck(40), 1);
    const s = useGameStore.getState();
    expect(s.mulliganDecisionPending).toBe(true);
    expect(s.state!.phase).toBe('untap');
    expect(s.state!.turn).toBe(1);
    expect(s.state!.zones.hand.length).toBe(7);
    expect(s.canUndo).toBe(false);
  });
});

describe('M4.17 beginFirstTurn runs the auto-advance after the mulligan decision', () => {
  it('autoAdvance ON: advances to main1 and draws one (hand 7 -> 8) on a clean baseline', () => {
    useGameStore.setState({ autoAdvanceToMain: true });
    useGameStore.getState().newGame(deck(40), 2);
    useGameStore.getState().keepOpeningHand();
    useGameStore.getState().beginFirstTurn();
    const s = useGameStore.getState();
    expect(s.state!.phase).toBe('main1');
    expect(s.state!.zones.hand.length).toBe(8); // 7 kept + turn-1 draw
    expect(s.canUndo).toBe(false); // setup baseline, not an undoable step
    expect(s.mulliganDecisionPending).toBe(false);
  });

  it('autoAdvance OFF: stays at untap with 7 cards', () => {
    useGameStore.setState({ autoAdvanceToMain: false });
    useGameStore.getState().newGame(deck(40), 3);
    useGameStore.getState().keepOpeningHand();
    useGameStore.getState().beginFirstTurn();
    const s = useGameStore.getState();
    expect(s.state!.phase).toBe('untap');
    expect(s.state!.zones.hand.length).toBe(7);
  });
});
