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

function putUnderOpponentControl(cardId: string): void {
  const current = store().state;
  const card = current?.cards[cardId];
  if (!current || !card) {
    throw new Error(`card instance not found: ${cardId}`);
  }
  useGameStore.setState({
    state: {
      ...current,
      cards: {
        ...current.cards,
        [cardId]: {
          ...card,
          controllerId: 'OPPONENT_A',
        },
      },
    },
  });
}

describe('CR 701.21 guided sacrifice resolution', () => {
  beforeEach(() => {
    resetStore();
  });

  it('prompts for a controlled creature and moves it from battlefield to graveyard', () => {
    const spell = makeDef({
      scryfallId: 'cr701-sacrifice-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr701-sacrifice-spell',
          typeLine: 'Sorcery',
          oracleText: 'Sacrifice a creature.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId('cr701-sacrifice-spell');
    const victimId = findInstanceId('card-1');
    store().moveCard(sourceId, 'stack', 'bottom');
    store().moveCard(victimId, 'battlefield', 'bottom');

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.sacrifice',
      kind: 'sacrifice',
      count: 1,
    });

    store().confirmGuidedSacrifice(victimId);

    const state = store().state;
    expect(store().pendingGuided).toBeNull();
    expect(state?.cards[victimId].zone).toBe('graveyard');
    expect(state?.cards[sourceId].zone).toBe('graveyard');
    expect(state?.zones.stack).not.toContain(sourceId);
  });

  it('auto-resolves deterministic self sacrifice from a triggered ability', () => {
    const creature = makeDef({
      scryfallId: 'cr701-sacrifice-self',
      typeLine: 'Creature',
      faces: [
        {
          name: 'cr701-sacrifice-self',
          typeLine: 'Creature',
          oracleText: 'When this creature enters, sacrifice this creature.',
        },
      ],
    });

    store().newGame([{ def: creature, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId('cr701-sacrifice-self');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().addAbilityToStack(sourceId, 'triggered');

    store().resolveTop();

    const state = store().state;
    expect(store().pendingGuided).toBeNull();
    expect(state?.cards[sourceId].zone).toBe('graveyard');
    expect(state?.zones.stack).toHaveLength(0);
  });

  it("does not let P1 sacrifice a permanent they don't control", () => {
    const spell = makeDef({
      scryfallId: 'cr701-sacrifice-permanent',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr701-sacrifice-permanent',
          typeLine: 'Sorcery',
          oracleText: 'Sacrifice a permanent.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId('cr701-sacrifice-permanent');
    const victimId = findInstanceId('card-1');
    store().moveCard(sourceId, 'stack', 'bottom');
    store().moveCard(victimId, 'battlefield', 'bottom');
    putUnderOpponentControl(victimId);

    store().resolveTop();
    store().confirmGuidedSacrifice(victimId);

    const state = store().state;
    expect(store().pendingGuided?.prompts[0].kind).toBe('sacrifice');
    expect(state?.cards[victimId].zone).toBe('battlefield');
    expect(state?.cards[sourceId].zone).toBe('stack');
    expect(store().warnings.at(-1)).toContain('生け贄の候補にありません');
  });
});
