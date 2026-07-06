// Reviewer-owned adversarial tests for cr-603-triggers-apnap Slice C (batch3-1c):
// discard/sacrifice/counter semantic events. 実装エージェント(Codex)は本ファイルを
// 変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 701.9: discard = hand→graveyard(自発的)。
// - CR 701.21a: sacrifice = controller自身がbattlefield→owner's graveyardへ移動。
//   destroyではない(regeneration等は無効)。
// - CR 122.1: counterはobject/playerに置かれるマーカー。zone移動ではない。
// - CR 704.5q: +1/+1と-1/-1が同一permanentに同時に存在する時、両者からN個ずつ除去
//   (Nは少ない方の数)。
// 契約の要石 = ZoneChangeReason拡張(discard/sacrifice追加。既存reasonは無変更)+
// 新規CounterChangeEvent(additive)。**counterの実質変化は必ずeventとして観測可能**
// (704.5q annihilation経由の変化も含む。Tier-1監査でHIGH発見=判定者が外科修正)。
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { CounterChangeEvent, GameEvent, GameState, ZoneChangeEvent } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function snap(): GameState {
  const state = store().state;
  if (!state) throw new Error('game state is not available');
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
    [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(Math.max(0, 24 - defs.length))],
    1,
  );
}

function findInstanceId(defId: string): string {
  const card = Object.values(snap().cards).find((instance) => instance.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function pendingFor(sourceId: string) {
  return snap().pendingTriggers.filter((t) => t.sourceId === sourceId);
}

function zoneChangeEvents(): ZoneChangeEvent[] {
  return snap().eventLog.filter((e): e is ZoneChangeEvent => e.type === 'zoneChange');
}

function counterChangeEvents(events: readonly GameEvent[] = snap().eventLog): CounterChangeEvent[] {
  return events.filter((e): e is CounterChangeEvent => e.type === 'counterChange');
}

describe('cr-603-triggers-apnap Slice C: discard/sacrifice/counter semantic events', () => {
  beforeEach(() => resetStore());

  it('HIGH fix pin: CR 704.5q annihilation emits accurate CounterChangeEvents reflecting the true final count (no stale/uncorrected event)', () => {
    const creature = makeDef({
      scryfallId: 'r-cr603c-annihilation',
      faces: [{ name: 'r-cr603c-annihilation', typeLine: 'Creature', power: '2', toughness: '2' }],
    });
    startGameWith([creature]);
    const id = findInstanceId(creature.scryfallId);
    store().moveCard(id, 'battlefield');
    const before = snap().eventLog.length;

    store().dispatch({ type: 'addCounters', cardId: id, counterType: '+1/+1', delta: 2 });
    store().dispatch({ type: 'addCounters', cardId: id, counterType: '-1/-1', delta: 1 });

    // True final state: 2 +1/+1 minus 1 pair annihilated = 1 remaining.
    expect(snap().cards[id].counters).toEqual({ '+1/+1': 1 });

    const events = counterChangeEvents(snap().eventLog.slice(before));
    // Every counter-count change must be observable, including the annihilation-driven one.
    const finalPlusOneEvent = events.find((e) => e.counterType === '+1/+1' && e.after === 1);
    expect(finalPlusOneEvent).toBeDefined();
    // No event may claim a stale/incorrect current count (after:2 would be the pre-fix bug).
    const staleEvent = events.find((e) => e.counterType === '+1/+1' && e.delta > 0 && e.after !== 1 && e === events.at(-1));
    expect(staleEvent).toBeUndefined();
    expect(events.some((e) => e.counterType === '-1/-1')).toBe(true);
  });

  it('discard golden: guided discard emits reason=discard and fires a subscribed trigger', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr603c-discard-watcher',
      faces: [{ name: 'r-cr603c-discard-watcher', typeLine: 'Creature', oracleText: 'Whenever you discard a card, draw a card.' }],
    });
    const fodder = makeDef({ scryfallId: 'r-cr603c-discard-fodder', faces: [{ name: 'r-cr603c-discard-fodder', typeLine: 'Creature' }] });
    startGameWith([watcher, fodder]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const fodderId = findInstanceId(fodder.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(fodderId, 'hand');

    store().dispatch({ type: 'discard', cardIds: [fodderId] });

    const discardEvent = zoneChangeEvents().find((e) => e.physicalCardId === fodderId && e.reason === 'discard');
    expect(discardEvent).toBeDefined();
    expect(pendingFor(watcherId)).toHaveLength(1);
  });

  it('sacrifice golden: guided sacrifice emits reason=sacrifice; SBA lethal death stays reason=sba (non-regression)', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr603c-sac-watcher',
      faces: [{ name: 'r-cr603c-sac-watcher', typeLine: 'Enchantment', oracleText: 'Whenever you sacrifice a creature, draw a card.' }],
    });
    const spell = makeDef({
      scryfallId: 'r-cr603c-sac-spell',
      typeLine: 'Sorcery',
      faces: [{ name: 'r-cr603c-sac-spell', typeLine: 'Sorcery', oracleText: 'Sacrifice a creature.' }],
    });
    const victim = makeDef({ scryfallId: 'r-cr603c-sac-victim', faces: [{ name: 'r-cr603c-sac-victim', typeLine: 'Creature' }] });
    const lethalVictim = makeDef({
      scryfallId: 'r-cr603c-lethal-victim',
      faces: [{ name: 'r-cr603c-lethal-victim', typeLine: 'Creature', power: '1', toughness: '1' }],
    });
    startGameWith([watcher, spell, victim, lethalVictim]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const spellId = findInstanceId(spell.scryfallId);
    const victimId = findInstanceId(victim.scryfallId);
    const lethalId = findInstanceId(lethalVictim.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(victimId, 'battlefield');
    store().moveCard(lethalId, 'battlefield');
    store().moveCard(spellId, 'stack');

    store().resolveTop();
    store().confirmGuidedSacrifice(victimId);

    const sacrificeEvent = zoneChangeEvents().find((e) => e.physicalCardId === victimId && e.reason === 'sacrifice');
    expect(sacrificeEvent).toBeDefined();
    expect(pendingFor(watcherId)).toHaveLength(1);

    // Non-regression: an SBA-driven lethal death must NOT be relabeled discard/sacrifice.
    store().dispatch({ type: 'markDamage', cardId: lethalId, amount: 1 });
    const deathEvent = zoneChangeEvents().find((e) => e.physicalCardId === lethalId && e.toZone === 'graveyard');
    expect(deathEvent?.reason).toBe('sba');
  });

  it('counter golden: addCounters emits CounterChangeEvent and fires a subscribed "counter put" trigger', () => {
    const source = makeDef({
      scryfallId: 'r-cr603c-counter-put',
      faces: [{ name: 'r-cr603c-counter-put', typeLine: 'Creature', oracleText: 'Whenever you put a +1/+1 counter on r-cr603c-counter-put, draw a card.' }],
    });
    startGameWith([source]);
    const id = findInstanceId(source.scryfallId);
    store().moveCard(id, 'battlefield');

    store().dispatch({ type: 'addCounters', cardId: id, counterType: '+1/+1', delta: 1 });

    expect(counterChangeEvents()).toMatchObject([{ counterType: '+1/+1', delta: 1, before: 0, after: 1 }]);
    expect(pendingFor(id)).toHaveLength(1);
  });

  it('does not tag a generic hand/battlefield->graveyard move as discard or sacrifice (no false positive)', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr603c-mistag-watcher',
      faces: [
        {
          name: 'r-cr603c-mistag-watcher',
          typeLine: 'Enchantment',
          oracleText: 'Whenever you discard a card, draw a card.\nWhenever you sacrifice a creature, draw a card.',
        },
      ],
    });
    const handCard = makeDef({ scryfallId: 'r-cr603c-generic-hand', faces: [{ name: 'r-cr603c-generic-hand', typeLine: 'Creature' }] });
    const bfCard = makeDef({ scryfallId: 'r-cr603c-generic-bf', faces: [{ name: 'r-cr603c-generic-bf', typeLine: 'Creature' }] });
    startGameWith([watcher, handCard, bfCard]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const handId = findInstanceId(handCard.scryfallId);
    const bfId = findInstanceId(bfCard.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(handId, 'hand');
    store().moveCard(bfId, 'battlefield');

    store().moveCard(handId, 'graveyard');
    store().moveCard(bfId, 'graveyard');

    const reasons = zoneChangeEvents()
      .filter((e) => e.physicalCardId === handId || e.physicalCardId === bfId)
      .map((e) => e.reason);
    expect(reasons).not.toContain('discard');
    expect(reasons).not.toContain('sacrifice');
    expect(pendingFor(watcherId)).toEqual([]);
  });

  it('LOW fix pin: cross-player sacrifice does not fire "whenever you sacrifice" for the other player (CR 603.2/controller check)', () => {
    const watcher = makeDef({
      scryfallId: 'r-cr603c-cross-player-watcher',
      faces: [{ name: 'r-cr603c-cross-player-watcher', typeLine: 'Enchantment', oracleText: 'Whenever you sacrifice a creature, draw a card.' }],
    });
    const opponentSpell = makeDef({
      scryfallId: 'r-cr603c-cross-player-spell',
      typeLine: 'Sorcery',
      faces: [{ name: 'r-cr603c-cross-player-spell', typeLine: 'Sorcery', oracleText: 'Sacrifice a creature.' }],
    });
    const opponentVictim = makeDef({
      scryfallId: 'r-cr603c-cross-player-victim',
      faces: [{ name: 'r-cr603c-cross-player-victim', typeLine: 'Creature' }],
    });
    startGameWith([watcher, opponentSpell, opponentVictim]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const spellId = findInstanceId(opponentSpell.scryfallId);
    const victimId = findInstanceId(opponentVictim.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(victimId, 'battlefield');
    useGameStore.setState({
      state: {
        ...snap(),
        cards: { ...snap().cards, [victimId]: { ...snap().cards[victimId], controllerId: 'OPPONENT_A' } },
      },
    });
    store().moveCard(spellId, 'stack');

    store().resolveTop();
    store().confirmGuidedSacrifice(victimId);

    // The P1-controlled watcher's "whenever you sacrifice" must not fire for an
    // opponent-controlled creature's sacrifice.
    expect(pendingFor(watcherId)).toEqual([]);
  });
});
