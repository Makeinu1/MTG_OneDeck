import { expect, it } from 'vitest';
import { initGame } from '../init';
import { collectPendingTriggerUpdate } from '../triggers';
import type { CardDef } from '../../types/card';
import type { CardInstance, DrawEvent } from '../types';

function watcher(text: string) {
  const state = initGame([], 0);
  const def: CardDef = {
    id: 'watcher-def',
    name: 'Watcher',
    typeLine: 'Creature',
    oracleText: text,
    faces: [{ name: 'Watcher', typeLine: 'Creature', oracleText: text }],
  } as CardDef;
  const card: CardInstance = {
    id: 'watcher',
    defId: def.id,
    ownerId: 'P1',
    controllerId: 'P1',
    zone: 'battlefield',
    zoneChangeCounter: 0,
    faceIndex: 0,
    tapped: false,
    counters: {},
    isToken: false,
    isCommander: false,
  } as CardInstance;
  state.defs[def.id] = def;
  state.cards[card.id] = card;
  state.zones.battlefield = [card.id];
  return state;
}

function withDrawEvent<T extends ReturnType<typeof watcher>>(state: T): T {
  const next = structuredClone(state);
  const event: DrawEvent = {
    type: 'draw',
    eventId: 'draw-1',
    sequence: 1,
    cause: { type: 'command', commandType: 'draw' },
    playerId: 'P1',
    result: 'drawn',
  };
  next.eventLog = [event];
  next.drawnThisTurn = state.drawnThisTurn + 1;
  return next;
}

it('does not persist the legacy eager ledger for a review-only trigger candidate', () => {
  const prev = watcher(
    'Whenever you draw one or more cards, this ability triggers only once each turn.',
  );
  const next = withDrawEvent(prev);
  const update = collectPendingTriggerUpdate(prev, next);

  expect(update.pendingTriggers).toHaveLength(1);
  expect(update.state.oncePerTurnTriggerLedger.consumedKeys).toEqual([]);
});

it('materializes a deterministic once-per-turn occurrence and consumes its restriction once', () => {
  const prev = watcher('Whenever you draw a card, this ability triggers only once each turn.');
  const next = withDrawEvent(prev);
  const first = collectPendingTriggerUpdate(prev, next);

  expect(first.pendingTriggers).toHaveLength(1);
  expect(first.state.oncePerTurnTriggerLedger.consumedKeys).toHaveLength(1);

  const retry = collectPendingTriggerUpdate(prev, {
    ...next,
    oncePerTurnTriggerLedger: first.state.oncePerTurnTriggerLedger,
  });
  expect(retry.pendingTriggers).toEqual([]);
  expect(retry.state.oncePerTurnTriggerLedger).toEqual(first.state.oncePerTurnTriggerLedger);
});