/**
 * Reviewer-owned adversarial tests for M4.8 (docs/engine-spec.md §9).
 * Implementation agents must NOT modify this file.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { useGameStore } from '../../store/gameStore';
import type { GameState } from '../types';
import { makeDef } from './helpers';

function libGame(n: number): GameState {
  const deck: InitDeckCard[] = Array.from({ length: n }, (_, i) => ({
    def: makeDef({ scryfallId: `c-${i}` }),
    isCommander: false,
  }));
  return initGame(deck, 1);
}

describe('mill (spec §9.1)', () => {
  it('mills exactly N from the top into the graveyard, preserving top-first order', () => {
    const s = libGame(8);
    const top3 = s.zones.library.slice(0, 3);
    const r = applyCommand(s, { type: 'mill', count: 3 });
    expect(r.state.zones.library.length).toBe(5);
    // milled cards are out of the library
    for (const id of top3) expect(r.state.zones.library).not.toContain(id);
    // all three are in the graveyard, in top-first order at the bottom
    expect(r.state.zones.graveyard.slice(-3)).toEqual(top3);
    for (const id of top3) expect(r.state.cards[id].zone).toBe('graveyard');
    expect(r.warnings).toEqual([]);
  });

  it('clamps to library size and warns when over-milling', () => {
    const s = libGame(2);
    const r = applyCommand(s, { type: 'mill', count: 5 });
    expect(r.state.zones.library.length).toBe(0);
    expect(r.state.zones.graveyard.length).toBe(2);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('is a no-op for count <= 0 (no log, no change)', () => {
    const s = libGame(4);
    const logLen = s.log.length;
    const r = applyCommand(s, { type: 'mill', count: 0 });
    expect(r.state.zones.library.length).toBe(4);
    expect(r.state.log.length).toBe(logLen);
  });
});

describe('untapAll (spec §9.1)', () => {
  function boardOf(n: number): GameState {
    let s = libGame(n);
    s = applyCommand(s, { type: 'draw', count: n }).state;
    for (const id of [...s.zones.hand]) {
      s = applyCommand(s, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
      s = applyCommand(s, { type: 'setTapped', cardId: id, tapped: true }).state;
    }
    return s;
  }

  it('untaps every battlefield permanent and is idempotent', () => {
    const s = boardOf(4);
    expect(s.zones.battlefield.every((id) => s.cards[id].tapped)).toBe(true);
    const r1 = applyCommand(s, { type: 'untapAll' });
    expect(r1.state.zones.battlefield.every((id) => !r1.state.cards[id].tapped)).toBe(true);
    // idempotent: second untapAll changes nothing and logs nothing
    const r2 = applyCommand(r1.state, { type: 'untapAll' });
    expect(r2.state.log.length).toBe(r1.state.log.length);
  });

  it('is harmless on an empty battlefield', () => {
    const s = libGame(3);
    expect(() => applyCommand(s, { type: 'untapAll' })).not.toThrow();
  });
});

describe('discard (spec §9.1)', () => {
  it('moves multiple hand cards to the graveyard and ignores missing ids', () => {
    let s = libGame(6);
    s = applyCommand(s, { type: 'draw', count: 4 }).state;
    const [a, b] = s.zones.hand;
    const r = applyCommand(s, { type: 'discard', cardIds: [a, b, 'ghost'] });
    expect(r.state.zones.hand).not.toContain(a);
    expect(r.state.zones.hand).not.toContain(b);
    expect(r.state.zones.graveyard).toContain(a);
    expect(r.state.zones.graveyard).toContain(b);
    expect(r.state.cards[a].zone).toBe('graveyard');
  });
});

describe('store: discardRandom & undo composition', () => {
  it('discards exactly N hand cards into the graveyard as a single undo step', () => {
    useGameStore.getState().newGame(
      Array.from({ length: 10 }, (_, i) => ({ def: makeDef({ scryfallId: `d-${i}` }), isCommander: false })),
      5,
    );
    const before = useGameStore.getState().state!;
    const handBefore = before.zones.hand.length;
    const graveBefore = before.zones.graveyard.length;

    useGameStore.getState().discardRandom(3);
    let st = useGameStore.getState().state!;
    expect(st.zones.hand.length).toBe(handBefore - 3);
    expect(st.zones.graveyard.length).toBe(graveBefore + 3);

    // single undo reverts the whole random discard
    useGameStore.getState().undo();
    st = useGameStore.getState().state!;
    expect(st.zones.hand.length).toBe(handBefore);
    expect(st.zones.graveyard.length).toBe(graveBefore);
  });

  it('discardRandom clamps to hand size', () => {
    useGameStore.getState().newGame(
      Array.from({ length: 10 }, (_, i) => ({ def: makeDef({ scryfallId: `e-${i}` }), isCommander: false })),
      9,
    );
    const handBefore = useGameStore.getState().state!.zones.hand.length;
    useGameStore.getState().discardRandom(999);
    expect(useGameStore.getState().state!.zones.hand.length).toBe(0);
    expect(useGameStore.getState().state!.zones.graveyard.length).toBe(handBefore);
  });
});
