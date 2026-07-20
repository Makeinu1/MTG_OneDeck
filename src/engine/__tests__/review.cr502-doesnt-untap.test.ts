import { describe, it, expect } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDef, makeDeck } from './helpers';

function gameWithDoesntUntapCard(): { state: GameState; cardId: string } {
  const doesntUntapDef = makeDef({
    scryfallId: 'basalt-monolith',
    typeLine: 'Artifact',
    faces: [{
      name: 'Basalt Monolith',
      typeLine: 'Artifact',
      oracleText: "Basalt Monolith doesn't untap during your untap step.\n{T}: Add {C}{C}{C}.\n{3}: Untap Basalt Monolith.",
    }],
  });
  const normalDef = makeDef({ scryfallId: 'normal-artifact', typeLine: 'Artifact' });
  const deck = [
    { def: doesntUntapDef, isCommander: false },
    { def: normalDef, isCommander: false },
    ...makeDeck(8),
  ];
  let state = initGame(deck, 1);
  const monolithId = Object.values(state.cards).find((c) => c.defId === 'basalt-monolith')!.id;
  const normalId = Object.values(state.cards).find((c) => c.defId === 'normal-artifact')!.id;

  // Move both to battlefield tapped
  state = applyCommand(state, { type: 'moveCard', cardId: monolithId, to: 'battlefield', position: 'top' }).state;
  state = applyCommand(state, { type: 'setTapped', cardId: monolithId, tapped: true }).state;
  state = applyCommand(state, { type: 'moveCard', cardId: normalId, to: 'battlefield', position: 'top' }).state;
  state = applyCommand(state, { type: 'setTapped', cardId: normalId, tapped: true }).state;

  return { state, cardId: monolithId };
}

function advanceToNextUntap(state: GameState): GameState {
  let current = state;
  for (let i = 0; i < 8; i++) {
    const result = applyCommand(current, { type: 'nextPhase' });
    current = result.state;
    if (current.phase === 'untap' && current.turn > state.turn) {
      return current;
    }
  }
  return current;
}

describe('CR 502.2 exception: doesn\'t untap during your untap step', () => {
  it('Basalt Monolith stays tapped through the untap step', () => {
    const { state, cardId } = gameWithDoesntUntapCard();
    expect(state.cards[cardId].tapped).toBe(true);

    const afterUntap = advanceToNextUntap(state);
    expect(afterUntap.cards[cardId].tapped).toBe(true);
  });

  it('normal artifact untaps normally', () => {
    const { state } = gameWithDoesntUntapCard();
    const normalId = Object.values(state.cards).find((c) => c.defId === 'normal-artifact')!.id;
    expect(state.cards[normalId].tapped).toBe(true);

    const afterUntap = advanceToNextUntap(state);
    expect(afterUntap.cards[normalId].tapped).toBe(false);
  });

  it('explicit untap effect ({3}: Untap) still works', () => {
    const { state, cardId } = gameWithDoesntUntapCard();
    expect(state.cards[cardId].tapped).toBe(true);

    const result = applyCommand(state, { type: 'setTapped', cardId, tapped: false });
    expect(result.state.cards[cardId].tapped).toBe(false);
  });
});
