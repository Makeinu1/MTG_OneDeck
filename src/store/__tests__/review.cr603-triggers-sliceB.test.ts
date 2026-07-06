// Reviewer-owned adversarial tests for cr-603-triggers-apnap Slice B (batch3-1b):
// delayed-trigger scheduling primitive. 実装エージェント(Codex)は本ファイルを変更
// しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 603.7/603.7a: delayed triggered ability is created at resolution time, triggers later.
// - CR 603.7b: fires only once (next occurrence) unless a stated duration exists.
// - CR 513.2: "the step doesn't back up" — a delayed trigger for "next end step" created
//   DURING the end step waits for the NEXT turn's end step, not the current one.
// - CR 603.3b: two-bucket APNAP placement (pre-existing, Slice A/earlier) must remain
//   completely unaffected by scheduled (not-yet-due) triggers.
// 契約の要石 = 新規 `PendingTrigger.schedule` は additive。既存 stackPlacementBucket/APNAP
// は無変更。scheduled triggerはAPNAP順序・candidate表示から完全に不可視(除外されるだけで
// なくbucket/controllerカウントにも影響しない)。昇格は1回のみ。
import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState, Phase } from '../../engine/types';
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
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
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

function setTurnPhase(turn: number, phase: Phase): void {
  useGameStore.setState({ state: { ...snap(), turn, phase } });
}

function activateAndResolve(sourceId: string): void {
  store().activateAbility(sourceId);
  expect(snap().zones.stack).toHaveLength(1);
  store().resolveTop();
}

function advancePhase(count: number): void {
  for (let i = 0; i < count; i += 1) store().nextPhase();
}

function scheduled() {
  return snap().pendingTriggers.filter((t) => t.schedule !== undefined);
}

function ready() {
  return snap().pendingTriggers.filter((t) => t.schedule === undefined);
}

describe('cr-603-triggers-apnap Slice B: delayed-trigger scheduling (CR 603.7/603.7b/513.2)', () => {
  beforeEach(() => resetStore());

  it('CR 513.2: "next end step" created DURING the end step waits for the NEXT turn end step', () => {
    const source = makeDef({
      scryfallId: 'r-cr603b-created-in-end',
      faces: [
        { name: 'r-cr603b-created-in-end', typeLine: 'Artifact', oracleText: '{T}: Draw a card at the beginning of the next end step.' },
      ],
    });
    startGameWith([source]);
    const sourceId = findInstanceId(source.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    setTurnPhase(1, 'end');

    activateAndResolve(sourceId);

    expect(scheduled()[0]?.schedule).toMatchObject({ turn: 2, phase: 'end' });
    expect(ready()).toEqual([]);

    // Same-turn end step must NOT fire it (the step doesn't back up).
    store().nextPhase();
    advancePhase(5);
    expect(snap().turn).toBe(2);
    expect(snap().phase).toBe('main2');
    expect(ready()).toEqual([]);

    store().nextPhase();
    expect(snap().phase).toBe('end');
    expect(ready()).toHaveLength(1);
  });

  it('CR 513.2: "next end step" created OUTSIDE the end step resolves later the SAME turn', () => {
    const source = makeDef({
      scryfallId: 'r-cr603b-created-in-main',
      faces: [
        { name: 'r-cr603b-created-in-main', typeLine: 'Artifact', oracleText: '{T}: Draw a card at the beginning of the next end step.' },
      ],
    });
    startGameWith([source]);
    const sourceId = findInstanceId(source.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    setTurnPhase(1, 'main1');

    activateAndResolve(sourceId);

    expect(scheduled()[0]?.schedule).toMatchObject({ turn: 1, phase: 'end' });
    advancePhase(3);
    expect(snap().phase).toBe('end');
    expect(ready()).toHaveLength(1);
  });

  it('CR 603.7b: a promoted scheduled trigger fires only once, not again on a later end step', () => {
    const source = makeDef({
      scryfallId: 'r-cr603b-one-shot',
      faces: [
        { name: 'r-cr603b-one-shot', typeLine: 'Artifact', oracleText: '{T}: Draw a card at the beginning of the next end step.' },
      ],
    });
    startGameWith([source]);
    const sourceId = findInstanceId(source.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    setTurnPhase(1, 'main1');
    activateAndResolve(sourceId);
    advancePhase(3);
    expect(ready()).toHaveLength(1);

    store().dismissTriggerCandidates();
    expect(snap().pendingTriggers).toEqual([]);

    store().nextPhase();
    advancePhase(6);
    expect(snap().turn).toBe(2);
    expect(snap().phase).toBe('end');
    expect(snap().pendingTriggers).toEqual([]);
  });

  it('scheduled triggers are invisible to APNAP placement/counting; ready triggers place normally', () => {
    const readyDef = makeDef({
      scryfallId: 'r-cr603b-ready-etb',
      faces: [{ name: 'r-cr603b-ready-etb', typeLine: 'Creature', oracleText: 'When r-cr603b-ready-etb enters, draw a card.' }],
    });
    const delayedDef = makeDef({
      scryfallId: 'r-cr603b-hidden-delay',
      faces: [
        { name: 'r-cr603b-hidden-delay', typeLine: 'Artifact', oracleText: '{T}: Draw a card at the beginning of the next end step.' },
      ],
    });
    startGameWith([readyDef, delayedDef]);
    const readyId = findInstanceId(readyDef.scryfallId);
    const delayedId = findInstanceId(delayedDef.scryfallId);
    store().moveCard(delayedId, 'battlefield');
    setTurnPhase(1, 'main1');
    activateAndResolve(delayedId);
    store().moveCard(readyId, 'battlefield');

    expect(scheduled()).toHaveLength(1);
    const readyPending = ready()[0];
    expect(readyPending).toBeDefined();

    store().placePendingTriggersForPriority([readyPending.pendingTriggerId]);

    expect(snap().zones.stack).toHaveLength(1);
    // The scheduled trigger is untouched by placement; still invisible to APNAP.
    expect(scheduled()).toHaveLength(1);
    expect(ready()).toEqual([]);
  });

  it('restoreGame accepts legacy pending triggers with no schedule field (forward-compat)', () => {
    const legacyDef = makeDef({
      scryfallId: 'r-cr603b-legacy',
      faces: [{ name: 'r-cr603b-legacy', typeLine: 'Creature', oracleText: 'When r-cr603b-legacy enters, draw a card.' }],
    });
    const deck = [{ def: legacyDef, isCommander: false }, ...makeDeck(23)];
    store().newGame(deck, 1);
    store().keepOpeningHand();
    const sourceId = findInstanceId(legacyDef.scryfallId);
    const state = snap();
    const source = state.cards[sourceId];
    const legacyPending = {
      pendingTriggerId: 'r-cr603b-legacy-pending',
      eventId: 'legacy-event',
      simultaneousGroupId: 'legacy-event',
      triggerId: 'trigger.etb',
      sourceId,
      sourceObjectId: `${sourceId}:${source.zoneChangeCounter}`,
      sourceSnapshot: {
        physicalCardId: sourceId,
        objectId: `${sourceId}:${source.zoneChangeCounter}`,
        defId: legacyDef.scryfallId,
        zone: source.zone,
        ownerId: 'P1' as const,
        controllerId: 'P1' as const,
        isToken: false,
        isCommander: false,
        faceIndex: 0,
        tapped: false,
        counters: {},
        typeLine: 'Creature',
      },
      controllerId: 'P1' as const,
      label: 'legacy',
      stackPlacementBucket: 'ordinary' as const,
    };
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: { ...state, pendingTriggers: [legacyPending] },
      deck,
      autoAdvanceToMain: false,
    };

    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(snap().pendingTriggers[0]?.schedule).toBeUndefined();
  });

  it('non-regression: two-bucket APNAP placement order is unaffected by a co-present scheduled trigger', () => {
    const orderedFirst = makeDef({
      scryfallId: 'r-cr603b-order-first',
      faces: [{ name: 'r-cr603b-order-first', typeLine: 'Creature', oracleText: 'When r-cr603b-order-first enters, draw a card.' }],
    });
    const orderedSecond = makeDef({
      scryfallId: 'r-cr603b-order-second',
      faces: [{ name: 'r-cr603b-order-second', typeLine: 'Creature', oracleText: 'When r-cr603b-order-second enters, draw a card.' }],
    });
    const delayedDef = makeDef({
      scryfallId: 'r-cr603b-order-delay',
      faces: [
        { name: 'r-cr603b-order-delay', typeLine: 'Artifact', oracleText: '{T}: Draw a card at the beginning of the next end step.' },
      ],
    });
    startGameWith([orderedFirst, orderedSecond, delayedDef]);
    const delayedId = findInstanceId(delayedDef.scryfallId);
    store().moveCard(delayedId, 'battlefield');
    setTurnPhase(1, 'main1');
    activateAndResolve(delayedId);

    const firstId = findInstanceId(orderedFirst.scryfallId);
    const secondId = findInstanceId(orderedSecond.scryfallId);
    store().moveCard(firstId, 'battlefield');
    store().moveCard(secondId, 'battlefield');

    // Two ordinary ready triggers plus one scheduled (invisible) trigger present.
    expect(ready()).toHaveLength(2);
    expect(scheduled()).toHaveLength(1);
  });
});
