/**
 * Reviewer-owned adversarial tests for M4.11.
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { makeDef } from '../../engine/__tests__/helpers';
import type { InitDeckCard } from '../../engine/init';

function deck(n: number): InitDeckCard[] {
  return Array.from({ length: n }, (_, i) => ({
    def: makeDef({ scryfallId: `c-${i}` }),
    isCommander: false,
  }));
}

beforeEach(() => {
  // reset autoAdvance to the default before each test
  useGameStore.setState({ autoAdvanceToMain: true });
});

describe('newGame defers first-turn auto-advance to the mulligan keep (M4.11 #3, updated by M4.17)', () => {
  it('newGame draws 7 and waits on the mulligan decision (no auto-advance)', () => {
    useGameStore.setState({ autoAdvanceToMain: true });
    useGameStore.getState().newGame(deck(40), 1);
    const s = useGameStore.getState().state!;
    expect(s.phase).toBe('untap');
    expect(s.turn).toBe(1);
    expect(s.zones.hand.length).toBe(7);
    expect(useGameStore.getState().mulliganDecisionPending).toBe(true);
    expect(useGameStore.getState().canUndo).toBe(false);
  });

  it('after keep, beginFirstTurn reaches main1 with hand 8 when autoAdvance is on', () => {
    useGameStore.setState({ autoAdvanceToMain: true });
    useGameStore.getState().newGame(deck(40), 1);
    useGameStore.getState().keepOpeningHand();
    useGameStore.getState().beginFirstTurn();
    const s = useGameStore.getState().state!;
    expect(s.phase).toBe('main1');
    expect(s.zones.hand.length).toBe(8);
  });

  it('stays at untap with hand 7 when autoAdvance is off', () => {
    useGameStore.setState({ autoAdvanceToMain: false });
    useGameStore.getState().newGame(deck(40), 1);
    useGameStore.getState().keepOpeningHand();
    useGameStore.getState().beginFirstTurn();
    const s = useGameStore.getState().state!;
    expect(s.phase).toBe('untap');
    expect(s.zones.hand.length).toBe(7);
  });

  it('restart re-arms the mulligan decision', () => {
    useGameStore.setState({ autoAdvanceToMain: true });
    useGameStore.getState().newGame(deck(40), 1);
    useGameStore.getState().keepOpeningHand();
    useGameStore.getState().beginFirstTurn();
    useGameStore.getState().restart();
    expect(useGameStore.getState().mulliganDecisionPending).toBe(true);
    expect(useGameStore.getState().state!.phase).toBe('untap');
  });
});

describe('draw is exactly one card per call (M4.11 #1 — no hidden doubling)', () => {
  it('each store.draw(1) draws exactly one; N calls draw N', () => {
    useGameStore.setState({ autoAdvanceToMain: false });
    useGameStore.getState().newGame(deck(40), 1);
    const before = useGameStore.getState().state!.zones.hand.length;
    for (let i = 0; i < 5; i++) useGameStore.getState().draw(1);
    expect(useGameStore.getState().state!.zones.hand.length).toBe(before + 5);
    // each draw is its own undo step
    for (let i = 0; i < 5; i++) useGameStore.getState().undo();
    expect(useGameStore.getState().state!.zones.hand.length).toBe(before);
  });
});
