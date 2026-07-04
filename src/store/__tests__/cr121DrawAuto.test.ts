import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { DrawEvent, GameEvent } from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

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

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function drawEvents(events: readonly GameEvent[]): DrawEvent[] {
  return events.filter((event): event is DrawEvent => event.type === 'draw');
}

describe('CR 121 draw auto resolution', () => {
  beforeEach(() => {
    resetStore();
  });

  it('resolves a draw spell through draw command with one event per card draw', () => {
    const spell = makeDef({
      scryfallId: 'cr121-draw-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr121-draw-spell',
          typeLine: 'Sorcery',
          oracleText: 'Draw two cards.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId('cr121-draw-spell');
    store().moveCard(sourceId, 'stack', 'bottom');
    const beforeDrawn = store().state!.drawnThisTurn;
    const beforeEvents = store().state!.eventLog.length;

    store().resolveTop();

    const state = store().state!;
    const events = state.eventLog.slice(beforeEvents);
    expect(store().pendingGuided).toBeNull();
    expect(state.drawnThisTurn).toBe(beforeDrawn + 2);
    expect(state.cards[sourceId].zone).toBe('graveyard');
    expect(state.zones.stack).not.toContain(sourceId);
    expect(drawEvents(events)).toEqual([
      expect.objectContaining({ type: 'draw', result: 'drawn', drawOrdinal: 1 }),
      expect.objectContaining({ type: 'draw', result: 'drawn', drawOrdinal: 2 }),
    ]);
  });

  it('records empty-library attempts without pretending a card was drawn', () => {
    const spell = makeDef({
      scryfallId: 'cr121-empty-library-draw-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr121-empty-library-draw-spell',
          typeLine: 'Sorcery',
          oracleText: 'Draw a card.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }], 1);
    const sourceId = findInstanceId('cr121-empty-library-draw-spell');
    store().moveCard(sourceId, 'stack', 'bottom');
    const beforeDrawn = store().state!.drawnThisTurn;
    const beforeEvents = store().state!.eventLog.length;

    store().resolveTop();

    const state = store().state!;
    const draws = drawEvents(state.eventLog.slice(beforeEvents));
    expect(state.drawnThisTurn).toBe(beforeDrawn);
    expect(draws).toEqual([
      expect.objectContaining({
        type: 'draw',
        result: 'empty-library-attempt',
        drawOrdinal: 1,
        playerId: 'P1',
      }),
    ]);
    expect(draws[0]).not.toHaveProperty('physicalCardId');
    expect(state.defeat.P1?.reasons).toContain('emptyLibraryDraw');
  });
});
