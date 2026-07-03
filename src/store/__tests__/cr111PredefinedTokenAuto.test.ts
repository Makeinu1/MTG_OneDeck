import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

describe('CR 111.10 predefined token stack resolution', () => {
  beforeEach(() => {
    resetStore();
  });

  it('auto-resolves Food token creation through createToken command', () => {
    const spell = makeDef({
      scryfallId: 'cr111-food-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr111-food-spell',
          typeLine: 'Sorcery',
          oracleText: 'Create a Food token.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId('cr111-food-spell');
    store().moveCard(sourceId, 'stack', 'bottom');

    store().resolveTop();

    const state = store().state;
    const foodId = state?.zones.battlefield.find((cardId) => {
      const card = state.cards[cardId];
      return card?.isToken && state.defs[card.defId]?.tokenKind === 'food';
    });
    expect(store().pendingGuided).toBeNull();
    expect(foodId).toBeDefined();
    expect(state?.cards[sourceId].zone).toBe('graveyard');
  });
});
