import { describe, expect, it } from 'vitest';

import { applyCommand, type GameCommand } from '../commands';
import { initGame } from '../init';
import type { DrawEvent, GameEvent, GameState, LifeChangeEvent, ZoneChangeEvent } from '../types';
import { makeDeck, makeDef } from './helpers';

function eventsSince(state: GameState, start: number): GameEvent[] {
  return state.eventLog.slice(start);
}

function lifeChangeEvents(events: readonly GameEvent[]): LifeChangeEvent[] {
  return events.filter((event): event is LifeChangeEvent => event.type === 'lifeChange');
}

function drawEvents(events: readonly GameEvent[]): DrawEvent[] {
  return events.filter((event): event is DrawEvent => event.type === 'draw');
}

function zoneChangeEvents(events: readonly GameEvent[]): ZoneChangeEvent[] {
  return events.filter((event): event is ZoneChangeEvent => event.type === 'zoneChange');
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function instanceId(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) {
    throw new Error(`missing instance for ${defId}`);
  }
  return card.id;
}

describe('S-EVENTS life/draw event envelope', () => {
  it('emits lifeChange for nonzero P1 life deltas and skips zero deltas', () => {
    let state = initGame(makeDeck(3), 1);

    state = applyCommand(state, { type: 'adjustLife', delta: 3 }).state;
    expect(lifeChangeEvents(state.eventLog)).toEqual([
      expect.objectContaining({
        type: 'lifeChange',
        eventId: 'e0',
        sequence: 0,
        playerId: 'P1',
        delta: 3,
        direction: 'gain',
        previousLife: 40,
        nextLife: 43,
        cause: { type: 'command', commandType: 'adjustLife' },
      }),
    ]);

    const beforeZero = state.eventLog.length;
    state = applyCommand(state, { type: 'adjustLife', delta: 0 }).state;
    expect(lifeChangeEvents(eventsSince(state, beforeZero))).toEqual([]);

    state = applyCommand(state, { type: 'adjustLife', delta: -2 }).state;
    expect(lifeChangeEvents(state.eventLog).at(-1)).toMatchObject({
      type: 'lifeChange',
      playerId: 'P1',
      delta: -2,
      direction: 'loss',
      previousLife: 43,
      nextLife: 41,
      cause: { type: 'command', commandType: 'adjustLife' },
    });
  });

  it('emits lifeChange for opponent life labels without creating zero-delta events', () => {
    let state = initGame(makeDeck(3), 1);

    state = applyCommand(state, {
      type: 'adjustOpponentLife',
      label: '対戦相手A',
      delta: -4,
    }).state;
    expect(lifeChangeEvents(state.eventLog)).toEqual([
      expect.objectContaining({
        type: 'lifeChange',
        playerId: 'OPPONENT_A',
        lifeLabel: '対戦相手A',
        delta: -4,
        direction: 'loss',
        previousLife: 40,
        nextLife: 36,
        cause: { type: 'command', commandType: 'adjustOpponentLife' },
      }),
    ]);

    const beforeZero = state.eventLog.length;
    state = applyCommand(state, {
      type: 'adjustOpponentLife',
      label: '対戦相手A',
      delta: 0,
    }).state;
    expect(lifeChangeEvents(eventsSince(state, beforeZero))).toEqual([]);
  });

  it('links successful draw events to the library-to-hand zone-change event', () => {
    const state = initGame(makeDeck(3), 1);
    const topId = state.zones.library[0];
    const next = applyCommand(state, { type: 'draw', count: 1 }).state;
    const zoneEvents = zoneChangeEvents(next.eventLog);
    const draws = drawEvents(next.eventLog);

    expect(zoneEvents).toHaveLength(1);
    expect(draws).toHaveLength(1);
    expect(zoneEvents[0]).toMatchObject({
      type: 'zoneChange',
      eventId: 'e0',
      sequence: 0,
      physicalCardId: topId,
      fromZone: 'library',
      toZone: 'hand',
    });
    expect(draws[0]).toMatchObject({
      type: 'draw',
      eventId: 'e1',
      sequence: 1,
      playerId: 'P1',
      result: 'drawn',
      drawOrdinal: 1,
      physicalCardId: topId,
      oldObjectId: zoneEvents[0].oldObjectId,
      newObjectId: zoneEvents[0].newObjectId,
      zoneChangeEventId: zoneEvents[0].eventId,
      before: zoneEvents[0].before,
      after: zoneEvents[0].after,
      cause: { type: 'command', commandType: 'draw' },
    });
  });

  it('emits one draw event per multi-draw attempt, including empty-library attempts', () => {
    const state = initGame(makeDeck(1), 1);
    const topId = state.zones.library[0];
    const next = applyCommand(state, { type: 'draw', count: 2 }).state;
    const draws = drawEvents(next.eventLog);

    expect(draws).toHaveLength(2);
    expect(draws[0]).toMatchObject({
      type: 'draw',
      result: 'drawn',
      drawOrdinal: 1,
      physicalCardId: topId,
      zoneChangeEventId: 'e0',
    });
    expect(draws[1]).toMatchObject({
      type: 'draw',
      result: 'empty-library-attempt',
      drawOrdinal: 2,
      playerId: 'P1',
      cause: { type: 'command', commandType: 'draw' },
    });
    expect(draws[1]).not.toHaveProperty('physicalCardId');
    expect(draws[1]).not.toHaveProperty('zoneChangeEventId');
    expect(next.drawnThisTurn).toBe(1);
    expect(next.defeat.P1?.reasons).toContain('emptyLibraryDraw');
  });

  it('does not emit draw events for mill and does not emit damage events for source-less markDamage', () => {
    const creature = makeDef({
      scryfallId: 'event-envelope-damage-3-3',
      typeLine: 'Creature',
      faces: [
        {
          name: 'event-envelope-damage-3-3',
          typeLine: 'Creature',
          power: '3',
          toughness: '3',
        },
      ],
    });
    let state = initGame([{ def: creature, isCommander: false }, ...makeDeck(3)], 1);
    const creatureId = instanceId(state, creature.scryfallId);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: creatureId,
      to: 'battlefield',
      position: 'bottom',
    }).state;

    const beforeMill = state.eventLog.length;
    state = applyCommand(state, { type: 'mill', count: 1 }).state;
    expect(drawEvents(eventsSince(state, beforeMill))).toEqual([]);

    const beforeDamage = state.eventLog.length;
    state = applyCommand(state, { type: 'markDamage', cardId: creatureId, amount: 2 }).state;
    expect(eventsSince(state, beforeDamage).filter((event) => event.type === 'damage')).toEqual([]);
  });

  it('emits lifeChange but no damage event for current source-deferred combat player damage', () => {
    const attacker = makeDef({
      scryfallId: 'event-envelope-combat-attacker',
      typeLine: 'Creature',
      faces: [
        {
          name: 'event-envelope-combat-attacker',
          typeLine: 'Creature',
          power: '2',
          toughness: '2',
        },
      ],
    });
    let state = initGame([{ def: attacker, isCommander: false }, ...makeDeck(3)], 1);
    const attackerId = instanceId(state, attacker.scryfallId);
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: attackerId,
      to: 'battlefield',
      position: 'bottom',
    }).state;

    const beforeCombatDamage = state.eventLog.length;
    state = applyCommand(state, { type: 'enterCombat' }).state;
    state = applyCommand(state, {
      type: 'declareAttackers',
      attackers: [{ cardId: attackerId }],
    }).state;
    state = applyCommand(state, { type: 'declareBlockers', blockers: [] }).state;
    state = applyCommand(state, { type: 'resolveCombatDamage' }).state;

    const combatEvents = eventsSince(state, beforeCombatDamage);
    expect(combatEvents.filter((event) => event.type === 'damage')).toEqual([]);
    expect(lifeChangeEvents(combatEvents)).toEqual([
      expect.objectContaining({
        type: 'lifeChange',
        playerId: 'OPPONENT_A',
        lifeLabel: '対戦相手A',
        delta: -2,
        previousLife: 40,
        nextLife: 38,
        cause: { type: 'command', commandType: 'resolveCombatDamage' },
      }),
    ]);
  });

  it('keeps appended event deltas deterministic for identical commands and states', () => {
    const state = initGame(makeDeck(3), 1);
    const command: GameCommand = { type: 'draw', count: 2 };
    const eventCount = state.eventLog.length;

    const left = applyCommand(cloneState(state), command).state.eventLog.slice(eventCount);
    const right = applyCommand(cloneState(state), command).state.eventLog.slice(eventCount);

    expect(left).toEqual(right);
  });
});
