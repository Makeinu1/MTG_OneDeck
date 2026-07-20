import { beforeEach, describe, expect, it } from 'vitest';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { CardDef } from '../../types/card';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function instanceId(defId: string): string {
  const id = Object.values(store().state?.cards ?? {}).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing ${defId}`);
  return id;
}

function setup(defs: readonly CardDef[]): Record<string, string> {
  store().newGame([
    ...defs.map((def) => ({ def, isCommander: false })),
    ...makeDeck(20),
  ], 8201);
  store().keepOpeningHand();
  const ids = Object.fromEntries(defs.map((def) => [def.scryfallId, instanceId(def.scryfallId)]));
  for (const id of Object.values(ids)) store().moveCard(id, 'battlefield');
  const state = store().state;
  if (!state) throw new Error('state unavailable');
  useGameStore.setState({ state: { ...state, pendingTriggers: [] }, triggerCandidates: [] });
  return ids;
}

function pendingFor(sourceId: string) {
  return store().state?.pendingTriggers.filter((trigger) => trigger.sourceId === sourceId) ?? [];
}

beforeEach(() => {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    resolutionSession: null,
    pendingCommanderResolution: null,
    pendingForceActivation: null,
    canUndo: false,
    canRedo: false,
    canUndoInteraction: false,
    canRedoInteraction: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
});

describe('CR 603 runtime condition/effect boundary', () => {
  it('keeps The One Ring upkeep timing out of arbitrary life subscriptions', () => {
    const ring = makeDef({
      scryfallId: 'ordinary-boundary-ring',
      typeLine: 'Legendary Artifact',
      faces: [{
        name: 'The One Ring',
        typeLine: 'Legendary Artifact',
        oracleText:
          'At the beginning of your upkeep, you lose 1 life for each burden counter on The One Ring.',
      }],
    });
    const ids = setup([ring]);
    const ringId = ids[ring.scryfallId];

    store().dispatch({ type: 'adjustLife', delta: -1 });
    expect(pendingFor(ringId)).toEqual([]);
    store().nextTurn();
    store().nextPhase();
    expect(pendingFor(ringId)).toMatchObject([
      { triggerId: 'trigger.upkeep', abilityLineIndex: 0 },
    ]);
  });

  it('does not subscribe MyDeck-style At effects to their draw/damage/discard/counter verbs', () => {
    const scheduled = makeDef({
      scryfallId: 'ordinary-boundary-mydeck',
      typeLine: 'Enchantment',
      faces: [{
        name: 'Scheduled Host',
        typeLine: 'Enchantment',
        oracleText:
          'At the beginning of your end step, draw a card, discard a card, deal 1 damage to an opponent, and put a charge counter on Scheduled Host.',
      }],
    });
    const ids = setup([scheduled]);
    const sourceId = ids[scheduled.scryfallId];

    store().draw(1);
    store().dispatch({
      type: 'dealDamage',
      sourceId,
      amount: 1,
      combatDamage: false,
      targetPlayerId: 'OPPONENT_A',
    });
    store().dispatch({
      type: 'addCounters',
      cardId: sourceId,
      counterType: 'charge',
      delta: 1,
    });
    expect(pendingFor(sourceId)).toEqual([]);
  });

  it('preserves genuine leading When and Whenever subscriptions and line mapping', () => {
    const life = makeDef({
      scryfallId: 'ordinary-boundary-life',
      typeLine: 'Enchantment',
      faces: [{
        name: 'Life Host',
        typeLine: 'Enchantment',
        oracleText: 'Whenever you lose life, draw a card.',
      }],
    });
    const etb = makeDef({
      scryfallId: 'ordinary-boundary-etb',
      typeLine: 'Enchantment',
      faces: [{
        name: 'Entry Host',
        typeLine: 'Enchantment',
        oracleText: 'When another creature enters the battlefield, you gain 1 life.',
      }],
    });
    const entering = makeDef({ scryfallId: 'ordinary-boundary-entering', typeLine: 'Creature' });
    const ids = setup([life, etb, entering]);

    store().dispatch({ type: 'adjustLife', delta: -1 });
    expect(pendingFor(ids[life.scryfallId])).toMatchObject([
      { triggerId: 'trigger.life-loss', abilityLineIndex: 0 },
    ]);
    store().moveCard(ids[entering.scryfallId], 'hand');
    store().moveCard(ids[entering.scryfallId], 'battlefield');
    expect(pendingFor(ids[etb.scryfallId])).toMatchObject([
      { triggerId: 'trigger.etb-other', abilityLineIndex: 0 },
    ]);
  });

  it('keeps a leading ETB when only its effect mentions the next end step', () => {
    const oath = makeDef({
      scryfallId: 'ordinary-boundary-oath',
      typeLine: 'Legendary Enchantment',
      faces: [{
        name: 'Oath of Boundary',
        typeLine: 'Legendary Enchantment',
        oracleText:
          'When Oath of Boundary enters, exile another target permanent you control. '
          + 'Return that card to the battlefield under its owner\'s control at the beginning of the next end step.',
      }],
    });
    const ids = setup([oath]);
    const oathId = ids[oath.scryfallId];
    store().moveCard(oathId, 'hand');
    const state = store().state;
    if (!state) throw new Error('state unavailable');
    useGameStore.setState({ state: { ...state, pendingTriggers: [] }, triggerCandidates: [] });

    store().moveCard(oathId, 'battlefield');
    expect(pendingFor(oathId)).toMatchObject([
      { triggerId: 'trigger.etb', abilityLineIndex: 0 },
    ]);
  });
});
