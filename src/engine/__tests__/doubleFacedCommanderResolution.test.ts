import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { ManaPool } from '../types';
import { makeDef, makeDeck } from './helpers';

const EMPTY_POOL: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

function doubleFacedCommander(backType = 'Legendary Planeswalker') {
  return makeDef({
    scryfallId: 'dfc-commander',
    layout: 'modal_dfc',
    typeLine: 'Legendary Creature',
    faces: [
      { name: 'Front Commander', typeLine: 'Legendary Creature', manaCost: '{1}{G}' },
      { name: 'Back Ascendant', typeLine: backType, manaCost: '{4}{U}', loyalty: '5' },
    ],
  });
}

describe('double-faced commander casting (CR 712.8f, 712.11b)', () => {
  it('keeps the explicitly chosen back face from stack through battlefield resolution', () => {
    let state = initGame(makeDeck(4, [doubleFacedCommander()]), 1);
    const commanderId = state.commanders[0].cardId;

    state = applyCommand(state, {
      type: 'castToStack',
      cardId: commanderId,
      payment: EMPTY_POOL,
      forced: true,
      faceIndex: 1,
    }).state;
    expect(state.cards[commanderId]).toMatchObject({ zone: 'stack', faceIndex: 1 });
    expect(state.commanders[0].castCount).toBe(1);

    state = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(state.cards[commanderId]).toMatchObject({ zone: 'battlefield', faceIndex: 1 });

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: commanderId,
      to: 'graveyard',
      position: 'bottom',
    }).state;
    expect(state.cards[commanderId]).toMatchObject({ zone: 'graveyard', faceIndex: 0 });
  });

  it('defaults legacy cast commands without faceIndex to the front face', () => {
    let state = initGame(makeDeck(4, [doubleFacedCommander()]), 1);
    const commanderId = state.commanders[0].cardId;
    state = applyCommand(state, { type: 'setFace', cardId: commanderId, faceIndex: 1 }).state;
    state = applyCommand(state, {
      type: 'castToStack',
      cardId: commanderId,
      payment: EMPTY_POOL,
      forced: true,
    }).state;
    expect(state.cards[commanderId].faceIndex).toBe(0);
  });

  it('uses a nonpermanent back face as the resolve destination discriminator', () => {
    let state = initGame(makeDeck(4, [doubleFacedCommander('Sorcery')]), 1);
    const commanderId = state.commanders[0].cardId;
    state = applyCommand(state, {
      type: 'castToStack', cardId: commanderId, payment: EMPTY_POOL, forced: true, faceIndex: 1,
    }).state;
    state = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(state.cards[commanderId]).toMatchObject({ zone: 'graveyard', faceIndex: 0 });
  });
});
