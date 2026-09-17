// Reviewer-owned adversarial tests for cr-603-triggers-apnap Slice A (batch3-1a):
// event-driven trigger subscription leaf (Draw/LifeChange/Damage/ZoneChange) +
// once-per-turn gate (CR 603.2h). R5a-1 deliberately moves review-only
// restriction consumption from candidate detection to occurrence materialization.
//
// CR grounding:
// - CR 603.1/603.2: trigger condition + automatic trigger on matching event/game state.
// - CR 603.2h: "Do this only once each turn" gates on whether the controller has
//   already taken the indicated action this turn.
// - CR 400.7: a zone change creates a new object with no memory of prior existence —
//   grounds why a blinked source's once-per-turn ledger key resets (new sourceObjectId).
// - CR 603.3b: two-bucket APNAP placement (pre-existing, must stay unmodified).
// 契約の要石 = このスライスは既存§34.18 event envelope(Draw/LifeChange/Damage/
// ZoneChangeEvent)のみ使用。新規GameEvent member・delayed-trigger scheduling field は
// 追加しない(Slice B/C の対象外)。
import { beforeEach, describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function snap(): GameState {
  const state = store().state;
  if (!state) throw new Error('game state is not available');
  return state;
}

function startGameWith(defs: CardDef[]): void {
  store().newGame(
    [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(Math.max(0, 24 - defs.length))],
    1,
  );
  store().keepOpeningHand();
}

function findInstanceId(defId: string): string {
  const card = Object.values(snap().cards).find((instance) => instance.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function pendingFor(sourceId: string) {
  return snap().pendingTriggers.filter((t) => t.sourceId === sourceId);
}

describe('cr-603-triggers-apnap Slice A: event subscription leaf + once-per-turn gate', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      triggerCandidates: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: false,
      mulliganDecisionPending: false,
    });
  });

  it('once-per-turn gate resets after a reviewed occurrence is placed and the next turn begins (CR 603.2h)', () => {
    const source = makeDef({
      scryfallId: 'r-cr603-once-reset',
      faces: [
        {
          name: 'r-cr603-once-reset',
          typeLine: 'Creature',
          power: '2',
          toughness: '1',
          oracleText:
            'Whenever one or more other creatures you control with power 2 or less enter, draw a card. This ability triggers only once each turn.',
        },
      ],
    });
    const filler1 = makeDef({
      scryfallId: 'r-cr603-filler-1',
      faces: [{ name: 'r-cr603-filler-1', typeLine: 'Creature', power: '1', toughness: '1' }],
    });
    const filler2 = makeDef({
      scryfallId: 'r-cr603-filler-2',
      faces: [{ name: 'r-cr603-filler-2', typeLine: 'Creature', power: '1', toughness: '1' }],
    });
    startGameWith([source, filler1, filler2]);
    const sourceId = findInstanceId(source.scryfallId);
    const filler1Id = findInstanceId(filler1.scryfallId);
    const filler2Id = findInstanceId(filler2.scryfallId);
    store().moveCard(sourceId, 'battlefield');

    // Review-only detection is not yet an occurrence and must not consume the gate.
    store().moveCard(filler1Id, 'battlefield');
    expect(pendingFor(sourceId)).toHaveLength(1);
    expect(snap().oncePerTurnTriggerLedger.consumedKeys).toEqual([]);

    // Placement materializes the reviewed occurrence and consumes the restriction.
    const pendingTriggerId = pendingFor(sourceId)[0]?.pendingTriggerId;
    expect(pendingTriggerId).toBeDefined();
    store().placePendingTriggersForPriority([pendingTriggerId]);
    expect(pendingFor(sourceId)).toEqual([]);
    expect(snap().oncePerTurnTriggerLedger.consumedKeys).toHaveLength(1);

    // A later qualifying event in the SAME turn is now suppressed by the occurrence gate.
    store().moveCard(filler2Id, 'battlefield');
    expect(pendingFor(sourceId)).toEqual([]);

    store().resolveTop();
    const turnBefore = snap().turn;
    store().nextTurn();
    if (snap().phase === 'cleanup') {
      const choice = snap().pendingRuleChoices.find((c) => c.kind === 'cleanup-discard');
      if (choice) {
        const hand = snap().zones.hand;
        const discards = hand.slice(0, Math.max(0, hand.length - 7));
        store().resolveRuleChoice(choice.choiceId, { kind: 'cleanup-discard', cardIds: discards });
      }
    }
    expect(snap().turn).toBeGreaterThan(turnBefore);
    expect(snap().oncePerTurnTriggerLedger).toEqual({ turn: snap().turn, consumedKeys: [] });

    // A fresh event in the new turn can become a fresh review candidate again.
    store().moveCard(filler1Id, 'exile');
    store().moveCard(filler1Id, 'battlefield');
    expect(pendingFor(sourceId)).toHaveLength(1);
  });

  it('CR 400.7: blinking the once-per-turn source gives a fresh occurrence restriction key', () => {
    const source = makeDef({
      scryfallId: 'r-cr603-blink-source',
      faces: [
        {
          name: 'r-cr603-blink-source',
          typeLine: 'Creature',
          power: '2',
          toughness: '1',
          oracleText:
            'Whenever one or more other creatures you control with power 2 or less enter, draw a card. This ability triggers only once each turn.',
        },
      ],
    });
    const filler = makeDef({
      scryfallId: 'r-cr603-blink-filler',
      faces: [{ name: 'r-cr603-blink-filler', typeLine: 'Creature', power: '1', toughness: '1' }],
    });
    startGameWith([source, filler]);
    const sourceId = findInstanceId(source.scryfallId);
    const fillerId = findInstanceId(filler.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    store().moveCard(fillerId, 'battlefield');
    expect(pendingFor(sourceId)).toHaveLength(1);
    expect(snap().oncePerTurnTriggerLedger.consumedKeys).toEqual([]);

    // Materialize the old incarnation's occurrence before testing suppression.
    const firstPendingId = pendingFor(sourceId)[0]?.pendingTriggerId;
    expect(firstPendingId).toBeDefined();
    store().placePendingTriggersForPriority([firstPendingId]);
    expect(snap().oncePerTurnTriggerLedger.consumedKeys).toHaveLength(1);

    store().moveCard(fillerId, 'exile');
    store().moveCard(fillerId, 'battlefield');
    expect(pendingFor(sourceId)).toEqual([]);

    // Blink the SOURCE within the same turn: CR 400.7 gives a new sourceObjectId.
    store().moveCard(sourceId, 'exile');
    store().moveCard(sourceId, 'battlefield');
    store().moveCard(fillerId, 'exile');
    store().moveCard(fillerId, 'battlefield');

    // The new incarnation is not suppressed by the old incarnation's consumed key.
    expect(pendingFor(sourceId)).toHaveLength(1);
    expect(pendingFor(sourceId)[0]?.sourceObjectId).toBeDefined();
  });

  it('ETB self-exclusion: a creature does not trigger its own "another creature enters" ability', () => {
    const source = makeDef({
      scryfallId: 'r-cr603-etb-self',
      faces: [
        {
          name: 'r-cr603-etb-self',
          typeLine: 'Creature',
          oracleText: 'Whenever another creature you control enters, draw a card.',
        },
      ],
    });
    startGameWith([source]);
    const sourceId = findInstanceId(source.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    expect(pendingFor(sourceId)).toHaveLength(0);
  });

  it('plain unqualified "whenever a creature enters" still fires on another creature ETB', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr603-etb-plain',
      faces: [
        {
          name: 'r-cr603-etb-plain',
          typeLine: 'Enchantment',
          oracleText: 'Whenever a creature enters, draw a card.',
        },
      ],
    });
    const otherCreature = makeDef({
      scryfallId: 'r-cr603-etb-other-creature',
      faces: [{ name: 'r-cr603-etb-other-creature', typeLine: 'Creature' }],
    });
    startGameWith([watcher, otherCreature]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const otherId = findInstanceId(otherCreature.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(otherId, 'battlefield');
    expect(pendingFor(watcherId)).toHaveLength(1);
  });

  it('damage-marking (source-less markDamage) does not fire a DamageEvent subscription trigger', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr603-damage-watcher',
      faces: [
        {
          name: 'r-cr603-damage-watcher',
          typeLine: 'Enchantment',
          oracleText: 'Whenever a source deals damage, draw a card.',
        },
      ],
    });
    const creature = makeDef({
      scryfallId: 'r-cr603-damage-target',
      faces: [{ name: 'r-cr603-damage-target', typeLine: 'Creature', power: '2', toughness: '2' }],
    });
    startGameWith([watcher, creature]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const creatureId = findInstanceId(creature.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(creatureId, 'battlefield');
    store().dispatch({ type: 'markDamage', cardId: creatureId, amount: 1 });
    expect(pendingFor(watcherId)).toHaveLength(0);
  });
});
