import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDef, makeDeck } from './helpers';

function gameWithOneRing(): { state: GameState; cardId: string } {
  const def = makeDef({
    scryfallId: 'the-one-ring',
    typeLine: 'Artifact',
    faces: [{
      name: 'The One Ring',
      typeLine: 'Legendary Artifact',
      oracleText: 'Indestructible\nWhen The One Ring enters the battlefield, if you cast it, you gain protection from everything until your next turn.\nAt the beginning of your upkeep, you lose 1 life for each burden counter on The One Ring.\n{T}: Put a burden counter on The One Ring. Then draw a card for each burden counter on The One Ring.',
    }],
  });
  const deck = [{ def, isCommander: false }, ...makeDeck(20)];
  const state = initGame(deck, 1);
  const cardId = Object.values(state.cards).find((c) => c.defId === 'the-one-ring')!.id;
  return { state, cardId };
}

function resolveAbility(state: GameState, cardId: string, abilityLineIndex: number): GameState {
  let current = applyCommand(state, {
    type: 'addAbilityToStack',
    sourceId: cardId,
    kind: 'activated',
    abilityLineIndex,
  }).state;
  current = applyCommand(current, { type: 'resolveStackTop' }).state;
  return current;
}

describe('Counter-scaled draw resolution (The One Ring pattern)', () => {
  it('puts a burden counter and draws 1 card (0 → 1 counter)', () => {
    const { state, cardId } = gameWithOneRing();
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    const handBefore = current.zonesByPlayer[current.localPlayerId].hand.length;

    current = resolveAbility(current, cardId, 3);

    expect(current.cards[cardId].counters['burden']).toBe(1);
    expect(current.zonesByPlayer[current.localPlayerId].hand.length).toBe(handBefore + 1);
  });

  it('puts a burden counter and draws 2 cards (1 → 2 counters)', () => {
    const { state, cardId } = gameWithOneRing();
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    current = applyCommand(current, { type: 'addCounters', cardId, counterType: 'burden', delta: 1 }).state;
    const handBefore = current.zonesByPlayer[current.localPlayerId].hand.length;

    current = resolveAbility(current, cardId, 3);

    expect(current.cards[cardId].counters['burden']).toBe(2);
    expect(current.zonesByPlayer[current.localPlayerId].hand.length).toBe(handBefore + 2);
  });

  it('upkeep trigger: lose life equal to burden counter count', () => {
    const { state, cardId } = gameWithOneRing();
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    current = applyCommand(current, { type: 'addCounters', cardId, counterType: 'burden', delta: 3 }).state;
    const lifeBefore = current.life;

    // Simulate the upkeep trigger resolving (ability line 2)
    current = resolveAbility(current, cardId, 2);

    expect(current.life).toBe(lifeBefore - 3);
  });

  it('does not crash when library is empty', () => {
    const { state, cardId } = gameWithOneRing();
    let current = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    // Move all library cards to graveyard to empty the library
    const library = [...current.zonesByPlayer[current.localPlayerId].library];
    for (const libCardId of library) {
      current = applyCommand(current, { type: 'moveCard', cardId: libCardId, to: 'graveyard', position: 'top' }).state;
    }
    expect(current.zonesByPlayer[current.localPlayerId].library.length).toBe(0);

    // Should not throw
    current = resolveAbility(current, cardId, 3);
    expect(current.cards[cardId].counters['burden']).toBe(1);
  });
});
