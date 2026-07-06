import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type {
  CounterChangeEvent,
  GameEvent,
  GameState,
  PendingTrigger,
  ZoneChangeEvent,
} from '../../engine/types';
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

function startGameWith(defs: CardDef[]): void {
  store().newGame(
    [
      ...defs.map((def) => ({ def, isCommander: false })),
      ...makeDeck(Math.max(0, 24 - defs.length)),
    ],
    1,
  );
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

function zoneChangeEvents(): ZoneChangeEvent[] {
  return snap().eventLog.filter((event): event is ZoneChangeEvent => event.type === 'zoneChange');
}

function counterChangeEvents(events: readonly GameEvent[] = snap().eventLog): CounterChangeEvent[] {
  return events.filter((event): event is CounterChangeEvent => event.type === 'counterChange');
}

describe('CR 603 semantic event trigger subscriptions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('discard golden: guided discard emits reason=discard and creates a pending trigger', () => {
    const watcher = makeDef({
      scryfallId: 'cr603-discard-watcher',
      printedName: '取り残される恐怖',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Fear of Missing Out',
          printedName: '取り残される恐怖',
          typeLine: 'Creature',
          oracleText: 'Whenever you discard a card, draw a card.',
        },
      ],
    });
    const fodder = makeDef({
      scryfallId: 'cr603-discard-fodder',
      faces: [{ name: 'Discard Fodder', typeLine: 'Creature' }],
    });
    startGameWith([watcher, fodder]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const fodderId = findInstanceId(fodder.scryfallId);
    store().moveCard(watcherId, 'battlefield', 'bottom');
    store().moveCard(fodderId, 'hand', 'bottom');

    store().dispatch({ type: 'discard', cardIds: [fodderId] });

    const discardEvent = zoneChangeEvents().find(
      (event) => event.physicalCardId === fodderId && event.reason === 'discard',
    );
    expect(discardEvent).toMatchObject({
      fromZone: 'hand',
      toZone: 'graveyard',
      reason: 'discard',
    });
    expect(pendingFor(watcherId)).toMatchObject([
      {
        eventId: discardEvent?.eventId,
        triggerId: 'trigger.discard',
        label: 'カードを捨てたとき: 《取り残される恐怖》',
      },
    ]);
  });

  it('sacrifice golden: guided sacrifice emits reason=sacrifice and creates a pending trigger', () => {
    const watcher = makeDef({
      scryfallId: 'cr603-sacrifice-watcher',
      printedName: '生け贄の観測者',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Sacrifice Observer',
          printedName: '生け贄の観測者',
          typeLine: 'Enchantment',
          oracleText: 'Whenever you sacrifice a creature, draw a card.',
        },
      ],
    });
    const spell = makeDef({
      scryfallId: 'cr603-sacrifice-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'Accursed Marauder Style',
          typeLine: 'Sorcery',
          oracleText: 'Sacrifice a creature.',
        },
      ],
    });
    const victim = makeDef({
      scryfallId: 'cr603-sacrifice-victim',
      faces: [{ name: 'Sacrifice Victim', typeLine: 'Creature' }],
    });
    startGameWith([watcher, spell, victim]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const spellId = findInstanceId(spell.scryfallId);
    const victimId = findInstanceId(victim.scryfallId);
    store().moveCard(watcherId, 'battlefield', 'bottom');
    store().moveCard(victimId, 'battlefield', 'bottom');
    store().moveCard(spellId, 'stack', 'bottom');

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'sacrifice' });
    store().confirmGuidedSacrifice(victimId);

    const sacrificeEvent = zoneChangeEvents().find(
      (event) => event.physicalCardId === victimId && event.reason === 'sacrifice',
    );
    expect(sacrificeEvent).toMatchObject({
      fromZone: 'battlefield',
      toZone: 'graveyard',
      reason: 'sacrifice',
    });
    expect(pendingFor(watcherId)).toMatchObject([
      {
        eventId: sacrificeEvent?.eventId,
        triggerId: 'trigger.sacrifice',
        label: '生け贄に捧げたとき: 《生け贄の観測者》',
      },
    ]);
  });

  it('counter golden: addCounters emits CounterChangeEvent and creates a pending trigger', () => {
    const alesha = makeDef({
      scryfallId: 'cr603-alesha-counter',
      printedName: '運命に笑う者、アリーシャ',
      typeLine: 'Legendary Creature',
      faces: [
        {
          name: 'Alesha, Who Laughs at Fate',
          printedName: '運命に笑う者、アリーシャ',
          typeLine: 'Legendary Creature',
          oracleText:
            'Whenever you put a +1/+1 counter on Alesha, Who Laughs at Fate, draw a card.',
        },
      ],
    });
    startGameWith([alesha]);
    const aleshaId = findInstanceId(alesha.scryfallId);
    store().moveCard(aleshaId, 'battlefield', 'bottom');

    store().dispatch({
      type: 'addCounters',
      cardId: aleshaId,
      counterType: '+1/+1',
      delta: 1,
    });

    expect(counterChangeEvents()).toMatchObject([
      {
        type: 'counterChange',
        target: { kind: 'object', physicalCardId: aleshaId },
        counterType: '+1/+1',
        delta: 1,
        before: 0,
        after: 1,
      },
    ]);
    expect(pendingFor(aleshaId)).toMatchObject([
      {
        eventId: counterChangeEvents()[0]?.eventId,
        triggerId: 'trigger.counter-put',
        label: 'カウンターが置かれたとき: 《運命に笑う者、アリーシャ》',
      },
    ]);
  });

  it('does not tag generic moveCard to graveyard as discard or sacrifice', () => {
    const watcher = makeDef({
      scryfallId: 'cr603-mistag-watcher',
      printedName: '誤タグ監視者',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'Mistag Watcher',
          printedName: '誤タグ監視者',
          typeLine: 'Enchantment',
          oracleText:
            'Whenever you discard a card, draw a card.\nWhenever you sacrifice a creature, draw a card.',
        },
      ],
    });
    const handCard = makeDef({
      scryfallId: 'cr603-generic-hand-move',
      faces: [{ name: 'Generic Hand Move', typeLine: 'Creature' }],
    });
    const creature = makeDef({
      scryfallId: 'cr603-generic-battlefield-move',
      faces: [{ name: 'Generic Battlefield Move', typeLine: 'Creature' }],
    });
    startGameWith([watcher, handCard, creature]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const handCardId = findInstanceId(handCard.scryfallId);
    const creatureId = findInstanceId(creature.scryfallId);
    store().moveCard(watcherId, 'battlefield', 'bottom');
    store().moveCard(handCardId, 'hand', 'bottom');
    store().moveCard(creatureId, 'battlefield', 'bottom');

    store().moveCard(handCardId, 'graveyard', 'bottom');
    store().moveCard(creatureId, 'graveyard', 'bottom');

    const genericEvents = zoneChangeEvents().filter(
      (event) => event.physicalCardId === handCardId || event.physicalCardId === creatureId,
    );
    expect(genericEvents.map((event) => event.reason)).not.toContain('discard');
    expect(genericEvents.map((event) => event.reason)).not.toContain('sacrifice');
    expect(pendingFor(watcherId)).toEqual([]);
  });
});
