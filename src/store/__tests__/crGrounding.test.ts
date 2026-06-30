import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { CardInstance, GameState, PendingTrigger } from '../../engine/types';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function commanderId(): string {
  const id = store().state?.commanders[0]?.cardId;
  if (!id) {
    throw new Error('commander was not initialized');
  }
  return id;
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

function startCommanderGame(oracleText: string): string {
  const commander = makeDef({
    scryfallId: 'cr-grounding-commander',
    printedName: 'CR統率者',
    typeLine: 'Legendary Creature',
    faces: [
      {
        name: 'CR Commander',
        printedName: 'CR統率者',
        typeLine: 'Legendary Creature',
        oracleText,
      },
    ],
  });
  store().newGame(makeDeck(12, [commander]), 1);
  const id = commanderId();
  store().moveCard(id, 'battlefield');
  return id;
}

describe('CR grounding store bridges', () => {
  beforeEach(() => {
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
    localStorage.clear();
  });

  it('CR 903.9a: command choice for graveyard still preserves the death trigger candidate', () => {
    const id = startCommanderGame('When CR Commander dies, draw a card.');

    store().moveCommanderWithZoneChoice(id, 'graveyard', true);

    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('command');
    expect(state?.zones.graveyard).not.toContain(id);
    expect(state?.zones.command).toContain(id);
    expect(state?.pendingSbaChoices).toEqual([]);
    expect(
      state?.eventLog.some(
        (event) =>
          event.physicalCardId === id && event.toZone === 'graveyard' && event.reason === 'move',
      ),
    ).toBe(true);
    expect(
      state?.eventLog.some(
        (event) =>
          event.physicalCardId === id &&
          event.toZone === 'command' &&
          event.reason === 'sba' &&
          event.sbaApplied === '903.9a',
      ),
    ).toBe(true);
    expect(store().triggerCandidates).toEqual([
      {
        sourceId: id,
        triggerId: 'trigger.death',
        label: '死亡したとき: 《CR統率者》',
      },
    ]);
  });

  it('CR 903.9a: command choice for exile still preserves leaves-the-battlefield candidates', () => {
    const id = startCommanderGame('When CR Commander leaves the battlefield, draw a card.');

    store().moveCommanderWithZoneChoice(id, 'exile', true);

    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('command');
    expect(state?.zones.exile).not.toContain(id);
    expect(state?.zones.command).toContain(id);
    expect(state?.pendingSbaChoices).toEqual([]);
    expect(
      state?.eventLog.some(
        (event) =>
          event.physicalCardId === id && event.toZone === 'exile' && event.reason === 'move',
      ),
    ).toBe(true);
    expect(
      state?.eventLog.some(
        (event) =>
          event.physicalCardId === id &&
          event.toZone === 'command' &&
          event.reason === 'sba' &&
          event.sbaApplied === '903.9a',
      ),
    ).toBe(true);
    expect(store().triggerCandidates).toEqual([
      {
        sourceId: id,
        triggerId: 'trigger.leaves',
        label: '戦場を離れたとき: 《CR統率者》',
      },
    ]);
  });

  it('CR 903.9b: command choice for hand/library is a replacement, not an intermediate zone move', () => {
    const id = startCommanderGame('When CR Commander dies, draw a card.');

    store().moveCommanderWithZoneChoice(id, 'hand', true);

    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('command');
    expect(state?.zones.hand).not.toContain(id);
    expect(state?.zones.command).toContain(id);
    expect(store().triggerCandidates).toEqual([]);
  });

  it('CR 400.7/Z1: restoreGame backfills zoneChangeCounter for pre-Z1 snapshots', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const state = store().state as GameState;
    const id = state.zones.library[0];
    const legacyCard = { ...state.cards[id] } as Partial<CardInstance>;
    delete legacyCard.zoneChangeCounter;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: {
        ...state,
        cards: {
          ...state.cards,
          [id]: legacyCard as CardInstance,
        },
      },
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    store().restoreGame(snapshot);

    expect(store().state?.cards[id].zoneChangeCounter).toBe(0);
  });

  it('CR 120.6/704.5g/704.5h: restoreGame backfills missing marked damage state', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const state = store().state as GameState;
    const id = state.zones.library[0];
    const legacyCard = { ...state.cards[id] } as Partial<CardInstance>;
    delete legacyCard.damageMarked;
    delete legacyCard.hasDeathtouchDamage;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: {
        ...state,
        cards: {
          ...state.cards,
          [id]: legacyCard as CardInstance,
        },
      },
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    store().restoreGame(snapshot);

    expect(store().state?.cards[id]).toMatchObject({
      damageMarked: 0,
      hasDeathtouchDamage: false,
    });
  });

  it('CR 506.1: restoreGame backfills missing or stale combat state to null', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const state = store().state as GameState;
    const missingCombat = { ...state } as Partial<GameState>;
    delete missingCombat.combat;

    store().restoreGame({
      version: SNAPSHOT_VERSION,
      state: missingCombat as GameState,
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    });
    expect(store().state?.combat).toBeNull();

    const combat = {
      combatId: 'legacy-combat',
      turn: state.turn,
      step: 'declareAttackers',
      attackingPlayerId: 'P1',
      defendingPlayerId: 'OPPONENT_A',
      attackers: [],
      blockers: [],
    } satisfies NonNullable<GameState['combat']>;

    store().restoreGame({
      version: SNAPSHOT_VERSION,
      state: { ...state, phase: 'main1', combat },
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    });
    expect(store().state?.combat).toBeNull();

    store().restoreGame({
      version: SNAPSHOT_VERSION,
      state: { ...state, phase: 'combat', turn: state.turn + 1, combat },
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    });
    expect(store().state?.combat).toBeNull();
  });

  it('M2 player/controller substrate: new games initialize active player and card ownership to P1', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const state = store().state as GameState;
    const id = state.zones.library[0];

    expect(state.activePlayerId).toBe('P1');
    expect(state.cards[id]).toMatchObject({
      ownerId: 'P1',
      controllerId: 'P1',
    });
  });

  it('M2 player/controller substrate: restoreGame backfills active player and card owner/controller for legacy snapshots', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const state = { ...(store().state as GameState) } as Partial<GameState>;
    const id = (state.zones as GameState['zones']).library[0];
    const legacyCard = { ...(state.cards as GameState['cards'])[id] } as Partial<CardInstance>;
    delete state.activePlayerId;
    delete legacyCard.ownerId;
    delete legacyCard.controllerId;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: {
        ...(state as GameState),
        cards: {
          ...(state.cards as GameState['cards']),
          [id]: legacyCard as CardInstance,
        },
      },
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    store().restoreGame(snapshot);

    expect(store().state?.activePlayerId).toBe('P1');
    expect(store().state?.cards[id]).toMatchObject({
      ownerId: 'P1',
      controllerId: 'P1',
    });
  });

  it('CR 400.7/Z2: restoreGame backfills eventLog for pre-Z2 snapshots', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const state = { ...(store().state as GameState) } as Partial<GameState>;
    delete state.eventLog;
    delete state.pendingTriggers;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: state as GameState,
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    store().restoreGame(snapshot);

    expect(store().state?.eventLog).toEqual([]);
    expect(store().state?.pendingTriggers).toEqual([]);
  });

  it('CR 704.6d/P1: restoreGame backfills pending SBA choices for pre-P1 snapshots', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const state = { ...(store().state as GameState) } as Partial<GameState>;
    delete state.pendingSbaChoices;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: state as GameState,
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    store().restoreGame(snapshot);

    expect(store().state?.pendingSbaChoices).toEqual([]);
  });

  it('CR 603.3b/Z3: restoreGame backfills pending trigger controller and simultaneous group for pre-Z3 snapshots', () => {
    const deck = makeDeck(12);
    store().newGame(deck, 1);
    const state = store().state as GameState;
    const id = state.zones.library[0];
    const legacyPending = {
      pendingTriggerId: 'legacy-pending',
      eventId: 'legacy-event',
      triggerId: 'trigger.etb',
      sourceId: id,
      sourceObjectId: `${id}:0`,
      sourceSnapshot: {
        physicalCardId: id,
        objectId: `${id}:0`,
        defId: state.cards[id].defId,
        zone: 'library',
        ownerId: 'P1',
        isToken: false,
        isCommander: false,
        faceIndex: 0,
        tapped: false,
        counters: {},
        typeLine: state.defs[state.cards[id].defId].typeLine,
      },
      label: '戦場に出たとき: 《旧誘発》',
    } as PendingTrigger;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: {
        ...state,
        pendingTriggers: [legacyPending],
      },
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    store().restoreGame(snapshot);

    expect(store().state?.pendingTriggers[0]).toMatchObject({
      pendingTriggerId: 'legacy-pending',
      eventId: 'legacy-event',
      simultaneousGroupId: 'legacy-event',
      controllerId: 'P1',
      stackPlacementBucket: 'ordinary',
    });
  });

  it('CR 603.10a/Z3: token death pending trigger uses the event sourceSnapshot after the token ceases to exist', () => {
    const death = makeDef({
      scryfallId: 'cr-grounding-token-death',
      printedName: '死亡トークン元',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Token Death Source',
          printedName: '死亡トークン元',
          typeLine: 'Creature',
          oracleText: 'When Token Death Source dies, draw a card.',
        },
      ],
    });
    store().newGame([{ def: death, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId(death.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    store().copyPermanent(sourceId, 1);
    const tokenId = Object.values(store().state?.cards ?? {}).find((card) => card.isToken)?.id;
    expect(tokenId).toBeDefined();

    store().moveCard(tokenId as string, 'graveyard');

    const moveEvent = store().state?.eventLog.find(
      (event) =>
        event.physicalCardId === tokenId &&
        event.fromZone === 'battlefield' &&
        event.toZone === 'graveyard',
    );
    const ceaseEvent = store().state?.eventLog.find(
      (event) =>
        event.physicalCardId === tokenId &&
        event.reason === 'token-cease' &&
        event.sbaApplied === '704.5d',
    );

    expect(store().state?.cards[tokenId as string]).toBeUndefined();
    expect(store().state?.zones.graveyard).not.toContain(tokenId);
    expect(moveEvent).toBeDefined();
    expect(ceaseEvent).toBeDefined();
    expect(store().state?.pendingTriggers).toMatchObject([
      {
        eventId: moveEvent?.eventId,
        simultaneousGroupId: moveEvent?.eventId,
        controllerId: 'P1',
        sourceId: tokenId,
        triggerId: 'trigger.death',
        label: '死亡したとき: 《死亡トークン元》',
        sourceSnapshot: {
          physicalCardId: tokenId,
          isToken: true,
          zone: 'battlefield',
        },
      },
    ]);
    expect(store().triggerCandidates).toEqual([
      {
        sourceId: tokenId,
        triggerId: 'trigger.death',
        label: '死亡したとき: 《死亡トークン元》',
      },
    ]);
  });

  it('M2 player/controller substrate: zone-change snapshots and pending triggers use controller at event time', () => {
    const etb = makeDef({
      scryfallId: 'cr-grounding-controller-etb',
      printedName: '支配者付き入場',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Controller ETB',
          printedName: '支配者付き入場',
          typeLine: 'Creature',
          oracleText: 'When Controller ETB enters, draw a card.',
        },
      ],
    });
    store().newGame([{ def: etb, isCommander: false }, ...makeDeck(12)], 1);
    const id = findInstanceId(etb.scryfallId);
    const current = store().state as GameState;
    useGameStore.setState({
      state: {
        ...current,
        cards: {
          ...current.cards,
          [id]: {
            ...current.cards[id],
            controllerId: 'OPPONENT_A',
          },
        },
      },
    });

    store().moveCard(id, 'battlefield');

    const event = store().state?.eventLog.find(
      (entry) => entry.physicalCardId === id && entry.toZone === 'battlefield',
    );
    const pending = store().state?.pendingTriggers[0];
    expect(event?.after).toMatchObject({
      ownerId: 'P1',
      controllerId: 'OPPONENT_A',
    });
    expect(pending).toMatchObject({
      sourceId: id,
      controllerId: 'OPPONENT_A',
      sourceSnapshot: {
        controllerId: 'OPPONENT_A',
      },
    });
  });

  it('CR 903.9b/Z2: hand/library command replacement does not create a hand event', () => {
    const id = startCommanderGame('When CR Commander dies, draw a card.');

    store().moveCommanderWithZoneChoice(id, 'hand', true);

    const events = store().state?.eventLog ?? [];
    expect(events.some((event) => event.physicalCardId === id && event.toZone === 'hand')).toBe(
      false,
    );
    expect(events[events.length - 1]).toMatchObject({
      physicalCardId: id,
      fromZone: 'battlefield',
      toZone: 'command',
    });
  });
});
