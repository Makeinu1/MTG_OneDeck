import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { effectiveKeywords, hasVigilance, isSummoningSick, keywords } from '../status';
import type { GameState } from '../types';
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

function moveToBattlefield(state: GameState, defId: string): GameState {
  return applyCommand(state, {
    type: 'moveCard',
    cardId: cardIdByDef(state, defId),
    to: 'battlefield',
    position: 'bottom',
  }).state;
}

describe('M6.5 manual keyword overrides', () => {
  it('setManualKeywords replaces the instance field with normalized keyword ids', () => {
    const creature = makeDef({
      scryfallId: 'manual-bear',
      typeLine: 'Creature — Bear',
    });
    const state = setup([{ def: creature, isCommander: false }]);
    const cardId = cardIdByDef(state, 'manual-bear');
    const input = ['haste', 'bogus', 'haste', 'vigilance'];

    const result = applyCommand(state, {
      type: 'setManualKeywords',
      cardId,
      keywords: input,
    });

    expect(input).toEqual(['haste', 'bogus', 'haste', 'vigilance']);
    expect(state.cards[cardId].manualKeywords).toBeUndefined();
    expect(result.state.cards[cardId].manualKeywords).toEqual(['haste', 'vigilance']);
    expect(result.state.log.at(-1)?.message).toBe(
      '《manual-bear》の手動キーワードを更新した。',
    );

    const cleared = applyCommand(result.state, {
      type: 'setManualKeywords',
      cardId,
      keywords: ['bogus'],
    }).state;
    expect(cleared.cards[cardId].manualKeywords).toBeUndefined();
  });

  it('effectiveKeywords returns printed and manual keywords without changing keywords(def)', () => {
    const creature = makeDef({
      scryfallId: 'printed-flyer',
      typeLine: 'Creature — Bird',
      faces: [
        {
          name: 'printed-flyer',
          typeLine: 'Creature — Bird',
          oracleText: 'Flying, vigilance',
        },
      ],
    });
    const state = setup([{ def: creature, isCommander: false }]);
    const cardId = cardIdByDef(state, 'printed-flyer');

    const updated = applyCommand(state, {
      type: 'setManualKeywords',
      cardId,
      keywords: ['haste', 'vigilance', 'haste'],
    }).state;

    expect(keywords(creature)).toEqual(['flying', 'vigilance']);
    expect(effectiveKeywords(updated, cardId)).toEqual(['flying', 'vigilance', 'haste']);
  });

  it('manual haste clears summoning sickness and manual vigilance is visible to attack tap logic', () => {
    const creature = makeDef({
      scryfallId: 'manual-keyword-creature',
      typeLine: 'Creature — Warrior',
    });
    let state = setup([{ def: creature, isCommander: false }]);
    state = moveToBattlefield(state, 'manual-keyword-creature');
    const cardId = cardIdByDef(state, 'manual-keyword-creature');

    expect(isSummoningSick(state, cardId)).toBe(true);
    expect(hasVigilance(state, cardId)).toBe(false);

    state = applyCommand(state, {
      type: 'setManualKeywords',
      cardId,
      keywords: ['haste', 'vigilance'],
    }).state;

    expect(isSummoningSick(state, cardId)).toBe(false);
    expect(hasVigilance(state, cardId)).toBe(true);
  });
});
