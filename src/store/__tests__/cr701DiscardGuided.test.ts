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

describe('CR 701.9 guided discard resolution', () => {
  beforeEach(() => {
    resetStore();
  });

  it('prompts for a hand card and resolves the stack item through discard command', () => {
    const spell = makeDef({
      scryfallId: 'cr701-discard-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr701-discard-spell',
          typeLine: 'Sorcery',
          oracleText: 'Discard a card.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId('cr701-discard-spell');
    store().moveCard(sourceId, 'stack', 'bottom');
    const discardId = store().state?.zones.hand.find((cardId) => cardId !== sourceId);
    if (!discardId) {
      throw new Error('discard fixture did not leave a spare hand card');
    }

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.discard',
      kind: 'discard',
      count: 1,
    });

    store().confirmGuidedDiscard(discardId);

    const state = store().state;
    expect(store().pendingGuided).toBeNull();
    expect(state?.cards[discardId].zone).toBe('graveyard');
    expect(state?.cards[sourceId].zone).toBe('graveyard');
    expect(state?.zones.stack).not.toContain(sourceId);
  });
});
