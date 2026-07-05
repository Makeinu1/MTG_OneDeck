import { beforeEach, describe, expect, it } from 'vitest';

import {
  SNAPSHOT_VERSION,
  type GameSnapshot,
} from '../../data/gameSnapshot';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState, PendingTrigger } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function snap(): GameState {
  const state = store().state;
  if (!state) {
    throw new Error('game state is not available');
  }
  return state;
}

function startGameWith(defs: CardDef[]): void {
  store().newGame(
    [
      ...defs.map((def) => ({ def, isCommander: false })),
      ...makeDeck(Math.max(0, 24 - defs.length)),
    ],
    1,
  );
  store().keepOpeningHand();
}

function findInstanceId(defId: string): string {
  const card = Object.values(snap().cards).find((instance) => instance.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function pendingFor(sourceId: string): PendingTrigger[] {
  return snap().pendingTriggers.filter((trigger) => trigger.sourceId === sourceId);
}

describe('event-log trigger subscriptions', () => {
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

  it('creates a pending trigger from a DamageEvent subscription', () => {
    const damageWatcher = makeDef({
      scryfallId: 'slice-a-damage-watcher',
      printedName: '損傷の学者',
      faces: [
        {
          name: 'Damage Scholar',
          printedName: '損傷の学者',
          typeLine: 'Creature',
          power: '2',
          toughness: '2',
          oracleText: 'Whenever Damage Scholar deals damage to a player, draw a card.',
        },
      ],
    });
    startGameWith([damageWatcher]);
    const sourceId = findInstanceId(damageWatcher.scryfallId);
    store().moveCard(sourceId, 'battlefield');

    store().dispatch({
      type: 'dealDamage',
      sourceId,
      amount: 1,
      combatDamage: false,
      targetPlayerId: 'OPPONENT_A',
    });

    expect(pendingFor(sourceId)).toMatchObject([
      {
        sourceId,
        triggerId: 'trigger.damage',
        label: 'ダメージを与えたとき: 《損傷の学者》',
        stackPlacementBucket: 'ordinary',
      },
    ]);
    expect(snap().eventLog.some((event) => event.type === 'damage')).toBe(true);
  });

  it('creates a pending trigger from a DrawEvent subscription without implicit duplication', () => {
    const drawWatcher = makeDef({
      scryfallId: 'slice-a-draw-watcher',
      printedName: 'ドローの観測者',
      faces: [
        {
          name: 'Draw Observer',
          printedName: 'ドローの観測者',
          typeLine: 'Creature',
          oracleText: 'Whenever you draw a card, create a Treasure token.',
        },
      ],
    });
    startGameWith([drawWatcher]);
    const sourceId = findInstanceId(drawWatcher.scryfallId);
    store().moveCard(sourceId, 'battlefield');

    store().draw(1);

    expect(pendingFor(sourceId)).toHaveLength(1);
    expect(pendingFor(sourceId)[0]).toMatchObject({
      triggerId: 'trigger.draw',
      label: 'カードを引いたとき: 《ドローの観測者》',
    });
  });

  it('creates a pending trigger from a LifeChangeEvent subscription', () => {
    const lifeWatcher = makeDef({
      scryfallId: 'slice-a-life-watcher',
      printedName: '生命の観測者',
      faces: [
        {
          name: 'Life Observer',
          printedName: '生命の観測者',
          typeLine: 'Creature',
          oracleText: 'Whenever you gain life, draw a card.',
        },
      ],
    });
    startGameWith([lifeWatcher]);
    const sourceId = findInstanceId(lifeWatcher.scryfallId);
    store().moveCard(sourceId, 'battlefield');

    store().dispatch({ type: 'adjustLife', delta: 3 });

    expect(pendingFor(sourceId)).toMatchObject([
      {
        triggerId: 'trigger.life-gain',
        label: 'ライフを得たとき: 《生命の観測者》',
      },
    ]);
  });

  it('creates an ETB pending trigger from a ZoneChangeEvent to battlefield', () => {
    const balefulStrix = makeDef({
      scryfallId: 'slice-a-baleful-strix',
      printedName: '悪意の大梟',
      faces: [
        {
          name: 'Baleful Strix',
          printedName: '悪意の大梟',
          typeLine: 'Artifact Creature',
          power: '1',
          toughness: '1',
          oracleText: 'When Baleful Strix enters, draw a card.',
        },
      ],
    });
    startGameWith([balefulStrix]);
    const sourceId = findInstanceId(balefulStrix.scryfallId);

    store().moveCard(sourceId, 'battlefield');

    expect(pendingFor(sourceId)).toMatchObject([
      {
        triggerId: 'trigger.etb',
        eventId: snap().eventLog.at(-1)?.eventId,
        label: '戦場に出たとき: 《悪意の大梟》',
      },
    ]);
  });

  it('creates a pending trigger when a card leaves your graveyard', () => {
    const skeletonCrew = makeDef({
      scryfallId: 'slice-a-skeleton-crew',
      printedName: '骸骨の乗組員',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Skeleton Crew',
          printedName: '骸骨の乗組員',
          typeLine: 'Enchantment',
          oracleText:
            'Whenever one or more cards leave your graveyard, create a 2/2 black Skeleton creature token.',
        },
      ],
    });
    const graveyardCard = makeDef({
      scryfallId: 'slice-a-graveyard-card',
      printedName: '戻る熊',
      faces: [{ name: 'Returning Bear', printedName: '戻る熊', typeLine: 'Creature' }],
    });
    startGameWith([skeletonCrew, graveyardCard]);
    const sourceId = findInstanceId(skeletonCrew.scryfallId);
    const movedId = findInstanceId(graveyardCard.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    store().moveCard(movedId, 'graveyard');

    store().moveCard(movedId, 'exile');

    expect(pendingFor(sourceId)).toMatchObject([
      {
        triggerId: 'trigger.leaves-graveyard',
        label: '墓地を離れたとき: 《骸骨の乗組員》',
      },
    ]);
  });

  it('gates Enduring Innocence style ETB triggers to once each turn', () => {
    const enduringInnocence = makeDef({
      scryfallId: 'slice-a-enduring-innocence',
      printedName: '永劫の無垢',
      faces: [
        {
          name: 'Enduring Innocence',
          printedName: '永劫の無垢',
          typeLine: 'Creature',
          power: '2',
          toughness: '1',
          oracleText:
            'Whenever one or more other creatures you control with power 2 or less enter, draw a card. This ability triggers only once each turn.',
        },
      ],
    });
    const firstCreature = makeDef({
      scryfallId: 'slice-a-small-creature-1',
      faces: [{ name: 'Small Creature One', typeLine: 'Creature', power: '2', toughness: '2' }],
    });
    const secondCreature = makeDef({
      scryfallId: 'slice-a-small-creature-2',
      faces: [{ name: 'Small Creature Two', typeLine: 'Creature', power: '1', toughness: '1' }],
    });
    startGameWith([enduringInnocence, firstCreature, secondCreature]);
    const sourceId = findInstanceId(enduringInnocence.scryfallId);
    const firstId = findInstanceId(firstCreature.scryfallId);
    const secondId = findInstanceId(secondCreature.scryfallId);
    store().moveCard(sourceId, 'battlefield');

    store().moveCard(firstId, 'battlefield');
    store().moveCard(secondId, 'battlefield');

    expect(pendingFor(sourceId)).toHaveLength(1);
    expect(pendingFor(sourceId)[0]).toMatchObject({
      triggerId: 'trigger.etb-other',
      label: '他が戦場に出たとき: 《永劫の無垢》',
    });
    const sourceObjectId = pendingFor(sourceId)[0]?.sourceObjectId;
    expect(snap().oncePerTurnTriggerLedger).toMatchObject({
      turn: snap().turn,
      consumedKeys: [expect.stringContaining(sourceObjectId)],
    });
  });

  it('gates Defiled Crypt style leaves-graveyard triggers to once each turn', () => {
    const defiledCrypt = makeDef({
      scryfallId: 'slice-a-defiled-crypt',
      printedName: '穢れた地下室',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Defiled Crypt',
          printedName: '穢れた地下室',
          typeLine: 'Enchantment',
          oracleText:
            'Whenever one or more cards leave your graveyard, create a 2/2 black Zombie creature token. This ability triggers only once each turn.',
        },
      ],
    });
    const firstCard = makeDef({
      scryfallId: 'slice-a-crypt-card-1',
      faces: [{ name: 'Crypt Card One', typeLine: 'Creature' }],
    });
    const secondCard = makeDef({
      scryfallId: 'slice-a-crypt-card-2',
      faces: [{ name: 'Crypt Card Two', typeLine: 'Creature' }],
    });
    startGameWith([defiledCrypt, firstCard, secondCard]);
    const sourceId = findInstanceId(defiledCrypt.scryfallId);
    const firstId = findInstanceId(firstCard.scryfallId);
    const secondId = findInstanceId(secondCard.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    store().moveCard(firstId, 'graveyard');
    store().moveCard(secondId, 'graveyard');

    store().moveCard(firstId, 'exile');
    store().moveCard(secondId, 'exile');

    expect(pendingFor(sourceId)).toHaveLength(1);
    expect(pendingFor(sourceId)[0]).toMatchObject({
      triggerId: 'trigger.leaves-graveyard',
      label: '墓地を離れたとき: 《穢れた地下室》',
    });
  });

  it('restoreGame backfills the once-per-turn trigger ledger for legacy snapshots', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const legacyState = { ...snap() } as Partial<GameState>;
    delete legacyState.oncePerTurnTriggerLedger;
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacyState as GameState,
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    store().restoreGame(snapshot);

    expect(snap().oncePerTurnTriggerLedger).toEqual({
      turn: snap().turn,
      consumedKeys: [],
    });
  });
});
