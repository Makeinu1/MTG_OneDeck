import { describe, expect, it } from 'vitest';
import { computeGameInfo } from '../gameInfo';
import { applyCommand } from '../../engine/commands';
import { initGame } from '../../engine/init';
import type { GameState } from '../../engine/types';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';

function instanceId(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)!.id;
}

describe('computeGameInfo', () => {
  it('reports storm, lands, draws, and devotion from current battlefield faces', () => {
    const green = makeDef({
      scryfallId: 'game-info-green',
      typeLine: 'Creature — Elf',
      faces: [{ name: 'game-info-green', typeLine: 'Creature — Elf', manaCost: '{G}{G}' }],
    });
    const hybrid = makeDef({
      scryfallId: 'game-info-hybrid',
      typeLine: 'Creature — Spirit',
      faces: [{ name: 'game-info-hybrid', typeLine: 'Creature — Spirit', manaCost: '{G/U}' }],
    });
    const monoHybrid = makeDef({
      scryfallId: 'game-info-mono-hybrid',
      typeLine: 'Creature — Knight',
      faces: [{ name: 'game-info-mono-hybrid', typeLine: 'Creature — Knight', manaCost: '{2/W}' }],
    });
    const phyrexian = makeDef({
      scryfallId: 'game-info-phyrexian',
      typeLine: 'Creature — Horror',
      faces: [{ name: 'game-info-phyrexian', typeLine: 'Creature — Horror', manaCost: '{B/P}' }],
    });

    let state = initGame(
      [
        { def: green, isCommander: false },
        { def: hybrid, isCommander: false },
        { def: monoHybrid, isCommander: false },
        { def: phyrexian, isCommander: false },
        ...makeDeck(10),
      ],
      5
    );

    for (const defId of [
      'game-info-green',
      'game-info-hybrid',
      'game-info-mono-hybrid',
      'game-info-phyrexian',
    ]) {
      state = applyCommand(state, {
        type: 'moveCard',
        cardId: instanceId(state, defId),
        to: 'battlefield',
        position: 'bottom',
      }).state;
    }

    state = {
      ...state,
      spellsCastThisTurn: 3,
      landsPlayedThisTurn: 1,
      drawnThisTurn: 4,
    };

    const info = computeGameInfo(state);

    expect(info.storm).toBe(3);
    expect(info.landsThisTurn).toBe(1);
    expect(info.drawsThisTurn).toBe(4);
    expect(info.devotion).toEqual({
      W: 1,
      U: 1,
      B: 1,
      R: 0,
      G: 3,
    });
  });

  it('ignores face-down cards and uses the active face for double-faced cards', () => {
    const transform = makeDef({
      scryfallId: 'game-info-transform',
      typeLine: 'Creature — Wizard',
      faces: [
        { name: 'front', typeLine: 'Creature — Wizard', manaCost: '{W}' },
        { name: 'back', typeLine: 'Creature — Wizard', manaCost: '{U}{U}' },
      ],
    });
    const hidden = makeDef({
      scryfallId: 'game-info-hidden',
      typeLine: 'Creature — Rogue',
      faces: [{ name: 'game-info-hidden', typeLine: 'Creature — Rogue', manaCost: '{R}' }],
    });

    let state = initGame(
      [
        { def: transform, isCommander: false },
        { def: hidden, isCommander: false },
        ...makeDeck(6),
      ],
      6
    );

    const transformId = instanceId(state, 'game-info-transform');
    const hiddenId = instanceId(state, 'game-info-hidden');

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: transformId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: hiddenId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'setFace',
      cardId: transformId,
      faceIndex: 1,
    }).state;
    state = applyCommand(state, {
      type: 'setFaceDown',
      cardId: hiddenId,
      faceDown: true,
    }).state;

    const info = computeGameInfo(state);
    expect(info.devotion.W).toBe(0);
    expect(info.devotion.U).toBe(2);
    expect(info.devotion.R).toBe(0);
  });
});
