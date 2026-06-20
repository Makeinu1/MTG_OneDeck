import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';

const STACK_WARNING = 'スタックに未解決の効果があります。先に解決してください。';

function store() {
  return useGameStore.getState();
}

function snap(): GameState {
  const state = store().state;
  if (!state) {
    throw new Error('game state is not available');
  }
  return state;
}

function putFirstHandCardOnStack(): string {
  const current = snap();
  const cardId = current.zones.hand[0];
  if (!cardId) {
    throw new Error('hand card is not available');
  }
  const card = current.cards[cardId];
  if (!card) {
    throw new Error(`card instance not found for ${cardId}`);
  }

  useGameStore.setState({
    state: {
      ...current,
      cards: {
        ...current.cards,
        [cardId]: { ...card, zone: 'stack' },
      },
      zones: {
        ...current.zones,
        hand: current.zones.hand.filter((id) => id !== cardId),
        stack: [...current.zones.stack, cardId],
      },
    },
    warnings: [],
    canUndo: false,
    canRedo: false,
  });

  return cardId;
}

describe('M6.2a stack blocks turn transitions', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: false,
      mulliganDecisionPending: false,
    });
    store().newGame(makeDeck(20), 1);
  });

  it('keeps phase and turn unchanged for nextPhase and nextTurn while the stack is non-empty', () => {
    putFirstHandCardOnStack();
    const before = snap();

    store().nextPhase();

    expect(snap()).toBe(before);
    expect(snap().phase).toBe(before.phase);
    expect(snap().turn).toBe(before.turn);
    expect(store().warnings).toEqual([STACK_WARNING]);
    expect(store().canUndo).toBe(false);

    store().nextTurn();

    expect(snap()).toBe(before);
    expect(snap().phase).toBe(before.phase);
    expect(snap().turn).toBe(before.turn);
    expect(store().warnings).toEqual([STACK_WARNING]);
    expect(store().canUndo).toBe(false);
  });

  it('does not auto-advance to main while the stack is non-empty', () => {
    putFirstHandCardOnStack();
    useGameStore.setState({
      state: { ...snap(), phase: 'end' },
      autoAdvanceToMain: true,
    });
    const before = snap();

    store().nextPhase();

    expect(snap()).toBe(before);
    expect(snap().phase).toBe('end');
    expect(snap().turn).toBe(before.turn);
    expect(store().warnings).toEqual([STACK_WARNING]);
  });

  it('advances after resolveTop empties the stack', () => {
    putFirstHandCardOnStack();
    const blockedPhase = snap().phase;

    store().nextPhase();
    expect(snap().phase).toBe(blockedPhase);

    store().resolveTop();
    expect(snap().zones.stack).toHaveLength(0);

    store().nextPhase();
    expect(snap().phase).not.toBe(blockedPhase);
  });

  it('advances after resolveAll empties the stack', () => {
    putFirstHandCardOnStack();
    store().resolveAll();
    expect(snap().zones.stack).toHaveLength(0);

    const turn = snap().turn;
    store().nextTurn();
    expect(snap().turn).toBe(turn + 1);
  });

  it('advances normally when the stack is empty', () => {
    expect(snap().zones.stack).toHaveLength(0);

    const phase = snap().phase;
    store().nextPhase();
    expect(snap().phase).not.toBe(phase);

    const turn = snap().turn;
    store().nextTurn();
    expect(snap().turn).toBe(turn + 1);
  });
});
