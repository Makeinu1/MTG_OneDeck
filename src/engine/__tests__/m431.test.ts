import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { ManaPool } from '../types';
import { makeDef, makeDeck } from './helpers';

function pool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

describe('M4.31 commander tax timing', () => {
  it('starts with castCount 0 in the command zone', () => {
    const commander = makeDef({ scryfallId: 'm431-cmd', typeLine: 'Legendary Creature' });
    const state = initGame(makeDeck(5, [commander]), 1);

    expect(state.commanders[0].castCount).toBe(0);
  });

  it('does not increment castCount when a commander returns to command from another zone', () => {
    const commander = makeDef({ scryfallId: 'm431-return', typeLine: 'Legendary Creature' });
    let state = initGame(makeDeck(5, [commander]), 1);
    const commanderId = state.commanders[0].cardId;

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    expect(state.commanders[0].castCount).toBe(0);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'command',
      position: 'top',
    }).state;
    expect(state.commanders[0].castCount).toBe(0);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'graveyard',
      position: 'top',
    }).state;
    expect(state.commanders[0].castCount).toBe(0);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'command',
      position: 'top',
    }).state;
    expect(state.commanders[0].castCount).toBe(0);
  });

  it('does not increment while the commander stays on the battlefield or command zone', () => {
    const commander = makeDef({ scryfallId: 'm431-stay', typeLine: 'Legendary Creature' });
    let state = initGame(makeDeck(5, [commander]), 1);
    const commanderId = state.commanders[0].cardId;

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    expect(state.commanders[0].castCount).toBe(0);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'command',
      position: 'top',
    }).state;
    expect(state.commanders[0].castCount).toBe(0);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'command',
      position: 'top',
    }).state;
    expect(state.commanders[0].castCount).toBe(0);
  });

  it('increments on castToStack from the command zone', () => {
    const commander = makeDef({
      scryfallId: 'm431-stack',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'm431-stack', typeLine: 'Legendary Creature', manaCost: '{2}{G}' }],
    });
    let state = initGame(makeDeck(5, [commander]), 1);
    const commanderId = state.commanders[0].cardId;

    state = applyCommand(state, {
      type: 'castToStack',
      cardId: commanderId,
      payment: pool(),
      forced: true,
    }).state;
    expect(state.cards[commanderId].zone).toBe('stack');
    expect(state.commanders[0].castCount).toBe(1);
  });
});
