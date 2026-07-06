import { describe, expect, it } from 'vitest';

import { applyCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { effectiveTypeLine, isSummoningSick } from '../status';
import type { GameState, ZoneId } from '../types';
import { makeDef } from './helpers';

function setup(deck: InitDeckCard[]): GameState {
  const nonCommanderCount = deck.filter((card) => !card.isCommander).length;
  const base = initGame(deck, 1);
  return applyCommand(base, { type: 'draw', count: nonCommanderCount }).state;
}

function cardIdByDef(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) {
    throw new Error(`missing card for ${defId}`);
  }
  return card.id;
}

function move(state: GameState, defId: string, to: ZoneId = 'battlefield'): GameState {
  return applyCommand(state, {
    type: 'moveCard',
    cardId: cardIdByDef(state, defId),
    to,
    position: 'bottom',
  }).state;
}

describe('CR604/611/613 additive Layer 4 effectiveTypeLine', () => {
  it('adds a self static type word while the source is on the battlefield', () => {
    const skyclave = makeDef({
      scryfallId: 'awakened-skyclave',
      typeLine: 'Creature — Elemental',
      faces: [
        {
          name: 'Awakened Skyclave',
          typeLine: 'Creature — Elemental',
          oracleText:
            "As long as this creature is on the battlefield, it's a land in addition to its other types.",
        },
      ],
    });
    const state = move(setup([{ def: skyclave, isCommander: false }]), 'awakened-skyclave');
    const cardId = cardIdByDef(state, 'awakened-skyclave');

    expect(effectiveTypeLine(state, cardId)).toBe('Creature — Elemental Land');
  });

  it('adds every basic land type to the attached object from an Aura source', () => {
    const presence = makeDef({
      scryfallId: 'nyleas-presence',
      typeLine: 'Enchantment — Aura',
      faces: [
        {
          name: "Nylea's Presence",
          typeLine: 'Enchantment — Aura',
          oracleText: 'Enchanted land is every basic land type in addition to its other types.',
        },
      ],
    });
    const land = makeDef({
      scryfallId: 'target-land',
      typeLine: 'Land',
    });
    let state = setup([
      { def: presence, isCommander: false },
      { def: land, isCommander: false },
    ]);
    state = move(move(state, 'nyleas-presence'), 'target-land');
    const auraId = cardIdByDef(state, 'nyleas-presence');
    const landId = cardIdByDef(state, 'target-land');
    state = applyCommand(state, { type: 'attach', cardId: auraId, to: landId }).state;

    expect(effectiveTypeLine(state, landId)).toBe(
      'Land Plains Island Swamp Mountain Forest',
    );
  });

  it('returns the printed type line when no matching static ability is present', () => {
    const bear = makeDef({
      scryfallId: 'plain-bear',
      typeLine: 'Creature — Bear',
    });
    const state = move(setup([{ def: bear, isCommander: false }]), 'plain-bear');
    const cardId = cardIdByDef(state, 'plain-bear');

    expect(effectiveTypeLine(state, cardId)).toBe('Creature — Bear');
  });

  it('uses the effective type line for summoning sickness creature checks', () => {
    const idol = makeDef({
      scryfallId: 'animated-idol',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'Animated Idol',
          typeLine: 'Artifact',
          oracleText: 'This artifact is a creature in addition to its other types.',
        },
      ],
    });
    const state = move(setup([{ def: idol, isCommander: false }]), 'animated-idol');
    const cardId = cardIdByDef(state, 'animated-idol');

    expect(effectiveTypeLine(state, cardId)).toBe('Artifact Creature');
    expect(isSummoningSick(state, cardId)).toBe(true);
  });
});
