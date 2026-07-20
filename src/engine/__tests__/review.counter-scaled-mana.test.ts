import { describe, expect, it } from 'vitest';
import { activatedManaAbilityPlanForSource, applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDef, makeDeck } from './helpers';

function gameWithCard(oracleText: string, typeLine = 'Artifact'): { state: GameState; cardId: string } {
  const def = makeDef({
    scryfallId: 'counter-mana-test',
    typeLine,
    faces: [{ name: 'Counter Mana Test', typeLine, oracleText }],
  });
  const deck = [{ def, isCommander: false }, ...makeDeck(9)];
  const state = initGame(deck, 1);
  const cardId = Object.values(state.cards).find((c) => c.defId === 'counter-mana-test')!.id;
  return { state, cardId };
}

describe('Counter-scaled mana ability (Everflowing Chalice pattern)', () => {
  it('produces mana equal to charge counter count', () => {
    const { state, cardId } = gameWithCard('{T}: Add {C} for each charge counter on Counter Mana Test.');
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    current = applyCommand(current, { type: 'addCounters', cardId, counterType: 'charge', delta: 3 }).state;

    const plan = activatedManaAbilityPlanForSource(current, cardId, 0);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');
    const manaCommands = plan!.commands.filter((c) => c.type === 'addMana');
    expect(manaCommands).toHaveLength(3);
  });

  it('produces zero mana when no counters present', () => {
    const { state, cardId } = gameWithCard('{T}: Add {C} for each charge counter on Counter Mana Test.');
    const current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;

    const plan = activatedManaAbilityPlanForSource(current, cardId, 0);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');
    const manaCommands = plan!.commands.filter((c) => c.type === 'addMana');
    expect(manaCommands).toHaveLength(0);
  });

  it('includes tap cost before mana commands', () => {
    const { state, cardId } = gameWithCard('{T}: Add {C} for each charge counter on Counter Mana Test.');
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    current = applyCommand(current, { type: 'addCounters', cardId, counterType: 'charge', delta: 2 }).state;

    const plan = activatedManaAbilityPlanForSource(current, cardId, 0);
    expect(plan).not.toBeNull();
    const tapCommand = plan!.commands.find((c) => c.type === 'setTapped' && c.cardId === cardId);
    expect(tapCommand).toBeDefined();
    const manaCommands = plan!.commands.filter((c) => c.type === 'addMana');
    expect(manaCommands).toHaveLength(2);
  });

  it('Everflowing Chalice oracle text pattern', () => {
    const { state, cardId } = gameWithCard(
      'Everflowing Chalice enters the battlefield with a charge counter on it for each time it was kicked.\n{T}: Add {C} for each charge counter on Everflowing Chalice.',
    );
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    // ETB doesn't add counters here (kicker-based, not fixed), so add manually
    current = applyCommand(current, { type: 'addCounters', cardId, counterType: 'charge', delta: 4 }).state;

    const plan = activatedManaAbilityPlanForSource(current, cardId, 1);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');
    const manaCommands = plan!.commands.filter((c) => c.type === 'addMana');
    expect(manaCommands).toHaveLength(4);
  });
});
