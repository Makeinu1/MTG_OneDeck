import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
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

function cardId(defId: string): string {
  const card = Object.values(state().cards).find((candidate) => candidate.defId === defId);
  if (!card) throw new Error(`missing fixture ${defId}`);
  return card.id;
}

function reset(): void {
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

describe('plan trigger reliability fixtures', () => {
  beforeEach(reset);

  it('keeps Fear ETB and first-attack lines separate and requires four graveyard card types', () => {
    const graveDefs = [
      makeDef({ scryfallId: 'fear-grave-creature', typeLine: 'Creature' }),
      makeDef({ scryfallId: 'fear-grave-land', typeLine: 'Land' }),
      makeDef({ scryfallId: 'fear-grave-instant', typeLine: 'Instant' }),
      makeDef({ scryfallId: 'fear-grave-artifact-sorcery', typeLine: 'Artifact Sorcery' }),
    ];
    store().newGame([
      { def: PLAN_CARD_FIXTURES.fearOfMissingOut, isCommander: false },
      ...graveDefs.map((def) => ({ def, isCommander: false })),
      ...makeDeck(16),
    ], 1);
    const fearId = cardId(PLAN_CARD_FIXTURES.fearOfMissingOut.scryfallId);
    store().moveCard(fearId, 'battlefield');
    expect(state().pendingTriggers.filter((trigger) => trigger.sourceId === fearId)).toMatchObject([
      { triggerId: 'trigger.etb', abilityLineIndex: 0 },
    ]);
    store().dismissTriggerCandidates();

    for (const def of graveDefs.slice(0, 3)) store().moveCard(cardId(def.scryfallId), 'graveyard');
    store().declareAttack([fearId], '対戦相手A');
    expect(state().pendingTriggers.filter((trigger) => trigger.sourceId === fearId)).toEqual([]);

    store().moveCard(cardId(graveDefs[3].scryfallId), 'graveyard');
    store().declareAttack([fearId], '対戦相手A');
    // This is still the same object and already attacked this turn; adding the
    // fourth type later must not turn its second attack into a first attack.
    expect(state().pendingTriggers.filter((trigger) => trigger.sourceId === fearId)).toEqual([]);
  });

  it('triggers Fear only on the first attack and rechecks delirium on resolution', () => {
    const graveDefs = [
      makeDef({ scryfallId: 'fear-four-creature', typeLine: 'Creature' }),
      makeDef({ scryfallId: 'fear-four-land', typeLine: 'Land' }),
      makeDef({ scryfallId: 'fear-four-instant', typeLine: 'Instant' }),
      makeDef({ scryfallId: 'fear-four-artifact', typeLine: 'Artifact' }),
    ];
    store().newGame([
      { def: PLAN_CARD_FIXTURES.fearOfMissingOut, isCommander: false },
      ...graveDefs.map((def) => ({ def, isCommander: false })),
      ...makeDeck(16),
    ], 2);
    const fearId = cardId(PLAN_CARD_FIXTURES.fearOfMissingOut.scryfallId);
    for (const def of graveDefs) store().moveCard(cardId(def.scryfallId), 'graveyard');
    store().moveCard(fearId, 'battlefield');
    store().dismissTriggerCandidates();

    store().declareAttack([fearId], '対戦相手A');
    const pending = state().pendingTriggers.find((trigger) => trigger.sourceId === fearId);
    expect(pending).toMatchObject({
      triggerId: 'trigger.attack',
      abilityLineIndex: 1,
      condition: { kind: 'graveyard-card-types-at-least', minimum: 4 },
    });
    store().putPendingTriggerOnStack(pending?.pendingTriggerId ?? 'missing');
    const stackId = state().zones.stack.at(-1);
    expect(stackId && state().cards[stackId]).toMatchObject({
      abilityLineIndex: 1,
      triggerCondition: { kind: 'graveyard-card-types-at-least', minimum: 4 },
    });

    store().moveCard(cardId(graveDefs[3].scryfallId), 'exile');
    store().dispatch({ type: 'resolveStackTop' });
    expect(state().zones.stack).not.toContain(stackId);
    expect(state().log.at(-1)?.message).toContain('解決時の条件を満たさず');

    store().undo();
    store().moveCard(cardId(graveDefs[3].scryfallId), 'graveyard');
    store().resolveTop();
    expect(store().resolutionSession).toMatchObject({
      sourceId: stackId,
      stage: 'manual-required',
      reason: 'unsupported',
    });
    expect(state().zones.stack).toContain(stackId);

    store().declareAttack([fearId], '対戦相手A');
    expect(state().pendingTriggers.filter((trigger) => trigger.sourceId === fearId)).toEqual([]);
  });

  it('triggers Mystic Sanctuary only when its post-entry snapshot is untapped', () => {
    store().newGame([
      { def: PLAN_CARD_FIXTURES.mysticSanctuary, isCommander: false },
      { def: { ...PLAN_CARD_FIXTURES.mysticSanctuary, scryfallId: 'fixture-sanctuary-tapped', oracleId: 'fixture-sanctuary-tapped' }, isCommander: false },
      ...makeDeck(18),
    ], 3);
    const untappedId = cardId(PLAN_CARD_FIXTURES.mysticSanctuary.scryfallId);
    const tappedId = cardId('fixture-sanctuary-tapped');
    store().moveCard(untappedId, 'hand');
    store().playLand(untappedId, { force: true, entersTapped: false });
    expect(state().pendingTriggers.filter((trigger) => trigger.sourceId === untappedId)).toMatchObject([
      { triggerId: 'trigger.etb', abilityLineIndex: 1 },
    ]);
    store().dismissTriggerCandidates();

    store().moveCard(tappedId, 'hand');
    store().playLand(tappedId, { force: true, entersTapped: true });
    expect(state().pendingTriggers.filter((trigger) => trigger.sourceId === tappedId)).toEqual([]);
  });
});
