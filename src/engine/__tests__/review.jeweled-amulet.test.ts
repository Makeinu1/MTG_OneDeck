import { describe, expect, it } from 'vitest';
import { activatedManaAbilityPlanForSource, applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDef, makeDeck } from './helpers';

function gameWithAmulet(): { state: GameState; cardId: string } {
  const def = makeDef({
    scryfallId: 'jeweled-amulet',
    typeLine: 'Artifact',
    faces: [{
      name: 'Jeweled Amulet',
      typeLine: 'Artifact',
      oracleText: "{1}, {T}: Put a charge counter on Jeweled Amulet. Note the type of mana spent to activate this ability. Activate only if there are no charge counters on Jeweled Amulet.\n{T}, Remove a charge counter from Jeweled Amulet: Add one mana of the last noted type.",
    }],
  });
  const deck = [{ def, isCommander: false }, ...makeDeck(9)];
  const state = initGame(deck, 1);
  const cardId = Object.values(state.cards).find((c) => c.defId === 'jeweled-amulet')!.id;
  return { state, cardId };
}

describe('Jeweled Amulet special implementation', () => {
  it('first ability: places charge counter and noted-C default', () => {
    const { state, cardId } = gameWithAmulet();
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;

    // Resolve the first ability (line 0)
    current = applyCommand(current, {
      type: 'addAbilityToStack',
      sourceId: cardId,
      kind: 'activated',
      abilityLineIndex: 0,
    }).state;
    current = applyCommand(current, { type: 'resolveStackTop' }).state;

    expect(current.cards[cardId].counters['charge']).toBe(1);
    expect(current.cards[cardId].counters['noted-C']).toBe(1);
  });

  it('second ability: removes charge counter and adds noted mana', () => {
    const { state, cardId } = gameWithAmulet();
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    current = applyCommand(current, { type: 'addCounters', cardId, counterType: 'charge', delta: 1 }).state;
    current = applyCommand(current, { type: 'addCounters', cardId, counterType: 'noted-W', delta: 1 }).state;

    const plan = activatedManaAbilityPlanForSource(current, cardId, 1);
    expect(plan).not.toBeNull();
    expect(plan!.decision).toBe('auto');

    const counterCmd = plan!.commands.find((c) => c.type === 'addCounters' && c.counterType === 'charge');
    expect(counterCmd).toBeDefined();
    expect((counterCmd as { delta: number }).delta).toBe(-1);

    const manaCmd = plan!.commands.find((c) => c.type === 'addMana');
    expect(manaCmd).toBeDefined();
    expect((manaCmd as { color: string }).color).toBe('W');
  });

  it('second ability defaults to colorless when no noted type', () => {
    const { state, cardId } = gameWithAmulet();
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    current = applyCommand(current, { type: 'addCounters', cardId, counterType: 'charge', delta: 1 }).state;

    const plan = activatedManaAbilityPlanForSource(current, cardId, 1);
    expect(plan).not.toBeNull();
    const manaCmd = plan!.commands.find((c) => c.type === 'addMana');
    expect((manaCmd as { color: string }).color).toBe('C');
  });
});
