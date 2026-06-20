/**
 * Reviewer-owned adversarial tests for M6.2a: phase/turn advancement is hard-
 * blocked while the stack is non-empty (docs/engine-spec.md §17). MTG-rule-
 * correct exception to the sandbox "always force" principle.
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';

function store() {
  return useGameStore.getState();
}
function snap(): GameState {
  return store().state!;
}
function instanceByDef(defId: string): string {
  return Object.values(snap().cards).find((c) => c.defId === defId)!.id;
}

/** A deck with a sorcery we can put on the stack. */
function deckWithSpell(): string {
  const deck = [
    { def: makeDef({ scryfallId: 'sorc', typeLine: 'Sorcery' }), isCommander: false },
    ...makeDeck(12),
  ];
  store().newGame(deck, 7);
  const sorc = instanceByDef('sorc');
  store().moveCard(sorc, 'hand');
  return sorc;
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('phase/turn advancement is blocked while the stack is non-empty (M6.2a)', () => {
  it('nextPhase and nextTurn do nothing while a spell is on the stack', () => {
    const sorc = deckWithSpell();
    store().castToStack(sorc);
    expect(snap().zones.stack.length).toBe(1);

    const phase = snap().phase;
    const turn = snap().turn;

    store().nextPhase();
    expect(snap().phase).toBe(phase); // unchanged
    expect(snap().turn).toBe(turn);

    store().nextTurn();
    expect(snap().phase).toBe(phase); // unchanged
    expect(snap().turn).toBe(turn);

    // the block does not push undo history (no state change committed)
    expect(snap().zones.stack.length).toBe(1);
  });

  it('auto-advance also stops while the stack is non-empty', () => {
    const sorc = deckWithSpell();
    useGameStore.setState({ autoAdvanceToMain: true });
    store().castToStack(sorc);
    const phase = snap().phase;
    const turn = snap().turn;

    store().nextTurn();
    expect(snap().phase).toBe(phase); // did not auto-skip to main1
    expect(snap().turn).toBe(turn);
  });

  it('advances normally once the stack is emptied via resolveTop', () => {
    const sorc = deckWithSpell();
    store().castToStack(sorc);
    const phase = snap().phase;

    store().nextPhase();
    expect(snap().phase).toBe(phase); // blocked

    store().resolveTop(); // sorcery -> graveyard, stack empty
    expect(snap().zones.stack.length).toBe(0);

    store().nextPhase();
    expect(snap().phase).not.toBe(phase); // now advances
  });

  it('advances normally when the stack is empty (no regression)', () => {
    deckWithSpell();
    expect(snap().zones.stack.length).toBe(0);
    const phase = snap().phase;
    store().nextPhase();
    expect(snap().phase).not.toBe(phase);
  });

  it('resolveAll then advance works', () => {
    const sorc = deckWithSpell();
    store().castToStack(sorc);
    store().resolveAll();
    expect(snap().zones.stack.length).toBe(0);
    const turn = snap().turn;
    store().nextTurn();
    expect(snap().turn).toBe(turn + 1);
  });
});
