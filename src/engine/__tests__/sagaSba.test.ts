import { describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from './helpers';
import { applyCommand, performStateBasedActions } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';

function sagaDef(id: string, oracleText: string) {
  return makeDef({
    scryfallId: id,
    typeLine: 'Enchantment — Saga',
    faces: [{ name: id, typeLine: 'Enchantment — Saga', oracleText }],
  });
}

function instanceId(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) throw new Error(`missing instance for ${defId}`);
  return card.id;
}


function setupWithSaga(def: ReturnType<typeof makeDef>): { state: GameState; sagaId: string } {
  let state = initGame([{ def, isCommander: false }, ...makeDeck(8)], 1);
  const sagaId = instanceId(state, def.scryfallId);
  state = applyCommand(state, {
    type: 'moveCard',
    cardId: sagaId,
    to: 'battlefield',
    position: 'bottom',
  }).state;
  return { state, sagaId };
}

describe('CR 714.4 Saga final-chapter sacrifice SBA', () => {
  it('Saga with lore >= final chapter and no pending trigger → sacrificed', () => {
    // Single-chapter Saga: final chapter = 1
    const def = sagaDef('sacrifice-saga', 'I — Draw a card.');
    const { state, sagaId } = setupWithSaga(def);

    // ETB sets lore=1 and triggers chapter I
    expect(state.cards[sagaId].counters.lore).toBe(1);
    expect(state.cards[sagaId].zone).toBe('battlefield');

    // Clear the pending chapter trigger (simulating it resolved and left the stack)
    const noTriggers: GameState = { ...state, pendingTriggers: [] };

    // Run SBA: lore=1 >= finalChapter=1, no pending trigger → sacrifice
    const result = performStateBasedActions(noTriggers);

    expect(result.state.cards[sagaId].zone).toBe('graveyard');

    // Check the log message
    const logEntry = result.state.log.find((entry) =>
      entry.message.includes('最終章に達したため生贄に捧げられた'),
    );
    expect(logEntry).toBeDefined();
    expect(logEntry?.message).toContain('714.4');
  });

  it('Saga with lore >= final chapter but pending chapter trigger → NOT sacrificed', () => {
    const def = sagaDef('pending-saga', 'I — Draw a card.');
    const { state, sagaId } = setupWithSaga(def);

    // ETB sets lore=1 and triggers chapter I
    expect(state.cards[sagaId].counters.lore).toBe(1);

    // Pending trigger exists
    const chapterTriggers = state.pendingTriggers.filter(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(chapterTriggers).toHaveLength(1);

    // Run SBA: lore=1 >= finalChapter=1, but pending trigger exists → NOT sacrificed
    const result = performStateBasedActions(state);

    expect(result.state.cards[sagaId].zone).toBe('battlefield');
  });

  it('Saga with lore < final chapter → NOT sacrificed', () => {
    // Two-chapter Saga: final chapter = 2
    const def = sagaDef('early-saga', 'I — Draw a card.\nII — Destroy target creature.');
    const { state, sagaId } = setupWithSaga(def);

    // ETB sets lore=1, final chapter = 2
    expect(state.cards[sagaId].counters.lore).toBe(1);

    // Clear triggers
    const noTriggers: GameState = { ...state, pendingTriggers: [] };

    // Run SBA: lore=1 < finalChapter=2 → NOT sacrificed
    const result = performStateBasedActions(noTriggers);

    expect(result.state.cards[sagaId].zone).toBe('battlefield');
  });

  it('Saga with no chapter abilities (finalChapter=0) → NOT sacrificed', () => {
    // Saga with non-chapter text only
    const def = sagaDef('no-chapter-saga', 'This Saga enters the battlefield tapped.');
    const { state, sagaId } = setupWithSaga(def);

    // ETB sets lore=1, but parseSagaChapters returns [], finalChapter=0
    expect(state.cards[sagaId].counters.lore).toBe(1);

    // Run SBA: finalChapter=0 → NOT sacrificed (CR 714.2d exception)
    const result = performStateBasedActions(state);

    expect(result.state.cards[sagaId].zone).toBe('battlefield');
  });

  it('multi-chapter Saga at final chapter with resolved triggers → sacrificed', () => {
    // Three-chapter Saga: final chapter = 3
    const def = sagaDef('multi-sacrifice-saga', 'I — A.\nII — B.\nIII — C.');
    const { state, sagaId } = setupWithSaga(def);

    // Manually set lore to 3 (simulating three turns of increments)
    const atFinalChapter: GameState = {
      ...state,
      cards: {
        ...state.cards,
        [sagaId]: {
          ...state.cards[sagaId],
          counters: { ...state.cards[sagaId].counters, lore: 3 },
        },
      },
      pendingTriggers: [], // All triggers resolved
    };

    // Run SBA: lore=3 >= finalChapter=3, no pending trigger → sacrifice
    const result = performStateBasedActions(atFinalChapter);

    expect(result.state.cards[sagaId].zone).toBe('graveyard');
  });

  it('Saga sacrifice uses sbaApplied 714.4 in zone change event', () => {
    const def = sagaDef('event-saga', 'I — Draw a card.');
    const { state, sagaId } = setupWithSaga(def);

    const noTriggers: GameState = { ...state, pendingTriggers: [] };
    const result = performStateBasedActions(noTriggers);

    // Find the zone change event for the Saga
    const zoneChangeEvent = result.state.eventLog.find(
      (event) =>
        event.type === 'zoneChange' &&
        event.physicalCardId === sagaId &&
        event.toZone === 'graveyard',
    );

    expect(zoneChangeEvent).toBeDefined();
    if (zoneChangeEvent?.type === 'zoneChange') {
      expect(zoneChangeEvent.sbaApplied).toBe('714.4');
      expect(zoneChangeEvent.reason).toBe('sba');
    }
  });
});
