import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import { PLAN_CARD_FIXTURES } from '../../test/fixtures/planCardFixtures';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function state(): GameState {
  const current = store().state;
  if (!current) throw new Error('game state unavailable');
  return current;
}

describe("Mishra's Bauble delayed draw golden", () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      triggerCandidates: [],
      pendingGuided: null,
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: false,
      mulliganDecisionPending: false,
    });
  });

  it('activates, schedules only the draw, draws once next upkeep, and supports undo', () => {
    store().newGame([
      { def: PLAN_CARD_FIXTURES.mishrasBauble, isCommander: false },
      ...makeDeck(23),
    ], 8);
    store().keepOpeningHand();
    const sourceId = Object.values(state().cards).find(
      (card) => card.defId === PLAN_CARD_FIXTURES.mishrasBauble.scryfallId,
    )?.id;
    if (!sourceId) throw new Error('bauble fixture not found');
    store().moveCard(sourceId, 'battlefield');
    useGameStore.setState({ state: { ...state(), turn: 1, phase: 'main1' } });

    store().activateAbility(sourceId);
    if (store().pendingGuided?.prompts[0]?.kind === 'target') {
      store().confirmGuidedPlayerTarget('OPPONENT_A');
    }
    expect(state().cards[sourceId].zone).toBe('graveyard');
    expect(state().zones.stack).toHaveLength(1);
    store().resolveTop();

    expect(state().pendingTriggers).toMatchObject([
      {
        sourceId,
        resolutionText: 'Draw a card.',
        schedule: { kind: 'phase-begin', turn: 2, phase: 'upkeep' },
      },
    ]);
    expect(store().warnings.some((warning) => warning.includes('即時部分は手動'))).toBe(true);

    store().nextTurn();
    store().nextPhase();
    const ready = state().pendingTriggers.find((trigger) => trigger.schedule === undefined);
    expect(ready?.resolutionText).toBe('Draw a card.');
    const handBefore = state().zones.hand.length;
    store().putPendingTriggerOnStack(ready?.pendingTriggerId ?? 'missing');
    const delayedAbilityId = state().zones.stack.at(-1);
    expect(delayedAbilityId && state().cards[delayedAbilityId]).toMatchObject({
      abilityResolutionText: 'Draw a card.',
    });

    store().resolveTop();
    expect(state().zones.hand).toHaveLength(handBefore + 1);
    expect(state().drawnThisTurn).toBe(1);
    expect(state().pendingTriggers).toEqual([]);

    store().undo();
    expect(state().zones.hand).toHaveLength(handBefore);
    expect(state().zones.stack).toContain(delayedAbilityId);
    store().redo();
    expect(state().zones.hand).toHaveLength(handBefore + 1);
  });
});
