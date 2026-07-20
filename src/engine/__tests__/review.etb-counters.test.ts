import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDef, makeDeck } from './helpers';

function gameWithCard(oracleText: string, typeLine = 'Creature', power = '1', toughness = '1'): { state: GameState; cardId: string } {
  const def = makeDef({
    scryfallId: 'etb-counter-test',
    typeLine,
    faces: [{
      name: 'ETB Counter Test',
      typeLine,
      oracleText,
      power,
      toughness,
    }],
  });
  const deck = [
    { def, isCommander: false },
    ...makeDeck(9),
  ];
  const state = initGame(deck, 1);
  const cardId = Object.values(state.cards).find((c) => c.defId === 'etb-counter-test')!.id;
  return { state, cardId };
}

describe('ETB counter placement (CR 614.1c)', () => {
  it('enters with a +1/+1 counter', () => {
    const { state, cardId } = gameWithCard('This creature enters with a +1/+1 counter on it.');
    const result = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' });
    expect(result.state.cards[cardId].counters['+1/+1']).toBe(1);
  });

  it('enters with three -1/-1 counters', () => {
    const { state, cardId } = gameWithCard('This creature enters with three -1/-1 counters on it.', 'Creature', '5', '5');
    const result = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' });
    expect(result.state.cards[cardId].counters['-1/-1']).toBe(3);
  });

  it('enters with a charge counter (artifact)', () => {
    const { state, cardId } = gameWithCard(
      'This land enters with a charge counter on it.\n{T}: Add {C}.',
      'Artifact',
    );
    const result = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' });
    expect(result.state.cards[cardId].counters['charge']).toBe(1);
  });

  it('enters with two oil counters', () => {
    const { state, cardId } = gameWithCard('This creature enters with two oil counters on it.');
    const result = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' });
    expect(result.state.cards[cardId].counters['oil']).toBe(2);
  });

  it('no counters for card without enters-with text', () => {
    const { state, cardId } = gameWithCard('Flying\n{T}: Add {C}.');
    const result = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' });
    expect(Object.keys(result.state.cards[cardId].counters)).toHaveLength(0);
  });

  it('does not parse X counters (requires user choice)', () => {
    const { state, cardId } = gameWithCard('This creature enters with X +1/+1 counters on it.');
    const result = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' });
    expect(result.state.cards[cardId].counters['+1/+1']).toBeUndefined();
  });
});
