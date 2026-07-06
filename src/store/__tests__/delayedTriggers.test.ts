import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState, PendingTrigger, Phase } from '../../engine/types';
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
    autoAdvanceToMain: false,
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
  store().keepOpeningHand();
}

function findInstanceId(defId: string): string {
  const card = Object.values(snap().cards).find((instance) => instance.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function setTurnPhase(turn: number, phase: Phase): void {
  useGameStore.setState({
    state: {
      ...snap(),
      turn,
      phase,
    },
  });
}

function activateAndResolve(sourceId: string): void {
  store().activateAbility(sourceId);
  expect(snap().zones.stack).toHaveLength(1);
  store().resolveTop();
}

function advancePhase(count: number): void {
  for (let index = 0; index < count; index += 1) {
    store().nextPhase();
  }
}

function scheduledTriggers(): PendingTrigger[] {
  return snap().pendingTriggers.filter((trigger) => trigger.schedule !== undefined);
}

function readyTriggers(): PendingTrigger[] {
  return snap().pendingTriggers.filter((trigger) => trigger.schedule === undefined);
}

describe('delayed trigger scheduling', () => {
  beforeEach(() => {
    resetStore();
  });

  it("schedules a Mishra's Bauble style next-turn upkeep trigger without exposing it early", () => {
    const bauble = makeDef({
      scryfallId: 'delayed-mishras-bauble',
      printedName: 'ミシュラのガラクタ',
      typeLine: 'Artifact',
      faces: [
        {
          name: "Mishra's Bauble",
          printedName: 'ミシュラのガラクタ',
          typeLine: 'Artifact',
          oracleText:
            "{T}, Sacrifice this artifact: Draw a card at the beginning of the next turn's upkeep.",
        },
      ],
    });
    startGameWith([bauble]);
    const sourceId = findInstanceId(bauble.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    setTurnPhase(1, 'main1');
    const drawnBefore = snap().drawnThisTurn;

    activateAndResolve(sourceId);

    expect(scheduledTriggers()).toMatchObject([
      {
        sourceId,
        triggerId: 'trigger.upkeep',
        schedule: {
          kind: 'phase-begin',
          turn: 2,
          phase: 'upkeep',
          consumeOnTrigger: true,
          createdAtTurn: 1,
          createdAtPhase: 'main1',
        },
      },
    ]);
    expect(readyTriggers()).toEqual([]);
    expect(store().triggerCandidates).toEqual([]);
    expect(snap().drawnThisTurn).toBe(drawnBefore);

    store().nextTurn();
    expect(snap().phase).toBe('untap');
    expect(readyTriggers()).toEqual([]);

    store().nextPhase();
    expect(snap().phase).toBe('upkeep');
    expect(readyTriggers()).toMatchObject([
      {
        sourceId,
        triggerId: 'trigger.upkeep',
      },
    ]);
    expect(readyTriggers()[0]?.schedule).toBeUndefined();
    expect(store().triggerCandidates).toHaveLength(1);
  });

  it('waits until the next turn end step when a next-end-step trigger is created during end step', () => {
    const endDelay = makeDef({
      scryfallId: 'delayed-end-created-in-end',
      printedName: '終了中の遅延',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'End Step Delay',
          printedName: '終了中の遅延',
          typeLine: 'Artifact',
          oracleText: '{T}: Draw a card at the beginning of the next end step.',
        },
      ],
    });
    startGameWith([endDelay]);
    const sourceId = findInstanceId(endDelay.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    setTurnPhase(1, 'end');

    activateAndResolve(sourceId);

    expect(scheduledTriggers()[0]?.schedule).toMatchObject({
      turn: 2,
      phase: 'end',
      createdAtTurn: 1,
      createdAtPhase: 'end',
    });
    expect(readyTriggers()).toEqual([]);
    expect(store().triggerCandidates).toEqual([]);

    store().nextPhase();
    advancePhase(5);
    expect(snap().turn).toBe(2);
    expect(snap().phase).toBe('main2');
    expect(readyTriggers()).toEqual([]);

    store().nextPhase();
    expect(snap().phase).toBe('end');
    expect(readyTriggers()).toHaveLength(1);
  });

  it('promotes a next-end-step trigger at the current turn end step when created outside end step', () => {
    const endDelay = makeDef({
      scryfallId: 'delayed-end-created-in-main',
      printedName: '通常遅延',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'Main Step Delay',
          printedName: '通常遅延',
          typeLine: 'Artifact',
          oracleText: '{T}: Draw a card at the beginning of the next end step.',
        },
      ],
    });
    startGameWith([endDelay]);
    const sourceId = findInstanceId(endDelay.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    setTurnPhase(1, 'main1');

    activateAndResolve(sourceId);

    expect(scheduledTriggers()[0]?.schedule).toMatchObject({
      turn: 1,
      phase: 'end',
      createdAtPhase: 'main1',
    });

    advancePhase(3);
    expect(snap().phase).toBe('end');
    expect(readyTriggers()).toHaveLength(1);
    expect(store().triggerCandidates).toHaveLength(1);
  });

  it('promotes a scheduled trigger only once', () => {
    const endDelay = makeDef({
      scryfallId: 'delayed-end-one-shot',
      printedName: '一回遅延',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'One Shot Delay',
          printedName: '一回遅延',
          typeLine: 'Artifact',
          oracleText: '{T}: Draw a card at the beginning of the next end step.',
        },
      ],
    });
    startGameWith([endDelay]);
    const sourceId = findInstanceId(endDelay.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    setTurnPhase(1, 'main1');
    activateAndResolve(sourceId);
    advancePhase(3);
    expect(readyTriggers()).toHaveLength(1);

    store().dismissTriggerCandidates();
    expect(snap().pendingTriggers).toEqual([]);

    store().nextPhase();
    advancePhase(6);
    expect(snap().turn).toBe(2);
    expect(snap().phase).toBe('end');
    expect(snap().pendingTriggers).toEqual([]);
    expect(store().triggerCandidates).toEqual([]);
  });

  it('excludes scheduled triggers from APNAP placement while preserving ready triggers', () => {
    const readyDef = makeDef({
      scryfallId: 'delayed-ready-etb',
      printedName: '即時誘発',
      faces: [
        {
          name: 'Ready Trigger',
          printedName: '即時誘発',
          typeLine: 'Creature',
          oracleText: 'When Ready Trigger enters, draw a card.',
        },
      ],
    });
    const delayedDef = makeDef({
      scryfallId: 'delayed-apnap-hidden',
      printedName: '隠れ遅延',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'Hidden Delay',
          printedName: '隠れ遅延',
          typeLine: 'Artifact',
          oracleText: '{T}: Draw a card at the beginning of the next end step.',
        },
      ],
    });
    startGameWith([readyDef, delayedDef]);
    const readyId = findInstanceId(readyDef.scryfallId);
    const delayedId = findInstanceId(delayedDef.scryfallId);
    store().moveCard(delayedId, 'battlefield');
    setTurnPhase(1, 'main1');
    activateAndResolve(delayedId);
    store().moveCard(readyId, 'battlefield');

    const readyPending = readyTriggers()[0];
    expect(readyPending).toBeDefined();
    expect(scheduledTriggers()).toHaveLength(1);
    expect(store().triggerCandidates).toHaveLength(1);

    store().placePendingTriggersForPriority([readyPending.pendingTriggerId]);

    expect(snap().zones.stack).toHaveLength(1);
    expect(snap().cards[snap().zones.stack[0]]).toMatchObject({
      isAbility: true,
      sourceId: readyId,
    });
    expect(scheduledTriggers()).toHaveLength(1);
    expect(readyTriggers()).toEqual([]);
  });

  it('restores legacy pending triggers without a schedule field', () => {
    const legacyDef = makeDef({
      scryfallId: 'delayed-legacy-pending',
      printedName: '旧誘発',
      faces: [
        {
          name: 'Legacy Pending',
          printedName: '旧誘発',
          typeLine: 'Creature',
          oracleText: 'When Legacy Pending enters, draw a card.',
        },
      ],
    });
    const deck = [{ def: legacyDef, isCommander: false }, ...makeDeck(23)];
    store().newGame(deck, 1);
    store().keepOpeningHand();
    const sourceId = findInstanceId(legacyDef.scryfallId);
    const state = snap();
    const source = state.cards[sourceId];
    const legacyPending: PendingTrigger = {
      pendingTriggerId: 'legacy-delayed-pending',
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
        ownerId: 'P1',
        controllerId: 'P1',
        isToken: false,
        isCommander: false,
        faceIndex: 0,
        tapped: false,
        counters: {},
        typeLine: 'Creature',
      },
      controllerId: 'P1',
      label: '戦場に出たとき: 《旧誘発》',
      stackPlacementBucket: 'ordinary',
    };
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: {
        ...state,
        pendingTriggers: [legacyPending],
      },
      deck,
      autoAdvanceToMain: false,
    };

    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(snap().pendingTriggers[0]).toMatchObject({
      pendingTriggerId: 'legacy-delayed-pending',
      stackPlacementBucket: 'ordinary',
    });
    expect(snap().pendingTriggers[0]?.schedule).toBeUndefined();
  });
});
