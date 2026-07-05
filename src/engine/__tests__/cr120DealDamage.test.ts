import { describe, expect, it } from 'vitest';

import { applyCommand } from '../commands';
import { initGame } from '../init';
import {
  objectIdOf,
  type DamageEvent,
  type GameEvent,
  type GameState,
  type LifeChangeEvent,
} from '../types';
import { makeDeck, makeDef } from './helpers';

function cr120Creature(id: string, power = '3', toughness = '3') {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', power, toughness }],
  });
}

function instanceId(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) {
    throw new Error(`missing instance for ${defId}`);
  }
  return card.id;
}

function eventsSince(state: GameState, start: number): GameEvent[] {
  return state.eventLog.slice(start);
}

function damageEvents(events: readonly GameEvent[]): DamageEvent[] {
  return events.filter((event): event is DamageEvent => event.type === 'damage');
}

function lifeChangeEvents(events: readonly GameEvent[]): LifeChangeEvent[] {
  return events.filter((event): event is LifeChangeEvent => event.type === 'lifeChange');
}

function battlefieldState(defs: ReturnType<typeof cr120Creature>[]): GameState {
  let state = initGame([...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(6)], 1);
  for (const def of defs) {
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: instanceId(state, def.scryfallId),
      to: 'battlefield',
      position: 'bottom',
    }).state;
  }
  return state;
}

describe('CR 120 source-backed noncombat damage', () => {
  it('emits a DamageEvent linked to the LifeChangeEvent for player damage', () => {
    const source = cr120Creature('cr120-player-damage-source', '1', '1');
    let state = battlefieldState([source]);
    const sourceId = instanceId(state, source.scryfallId);
    const sourceObjectId = objectIdOf(state.cards[sourceId]);
    const beforeEvents = state.eventLog.length;

    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      targetPlayerId: 'OPPONENT_A',
      amount: 3,
      combatDamage: false,
    }).state;

    const events = eventsSince(state, beforeEvents);
    const damage = damageEvents(events);
    const lifeChanges = lifeChangeEvents(events);
    expect(state.opponentLife['対戦相手A']).toBe(37);
    expect(damage).toHaveLength(1);
    expect(lifeChanges).toHaveLength(1);
    expect(damage[0]).toMatchObject({
      type: 'damage',
      source: {
        kind: 'object',
        physicalCardId: sourceId,
        objectId: sourceObjectId,
      },
      target: { kind: 'player', playerId: 'OPPONENT_A', lifeLabel: '対戦相手A' },
      amount: 3,
      combatDamage: false,
      damageResultEventIds: [lifeChanges[0].eventId],
      cause: { type: 'command', commandType: 'dealDamage' },
    });
    expect(lifeChanges[0]).toMatchObject({
      type: 'lifeChange',
      playerId: 'OPPONENT_A',
      lifeLabel: '対戦相手A',
      delta: -3,
      previousLife: 40,
      nextLife: 37,
      cause: { type: 'event', eventId: damage[0].eventId, eventType: 'damage' },
      causeEventId: damage[0].eventId,
      source: damage[0].source,
    });
  });

  it('emits a DamageEvent and marks creature damage through the existing marked-damage state', () => {
    const source = cr120Creature('cr120-creature-damage-source', '1', '1');
    const target = cr120Creature('cr120-creature-damage-target', '3', '3');
    let state = battlefieldState([source, target]);
    const sourceId = instanceId(state, source.scryfallId);
    const targetId = instanceId(state, target.scryfallId);
    const sourceObjectId = objectIdOf(state.cards[sourceId]);
    const targetObjectId = objectIdOf(state.cards[targetId]);
    const beforeEvents = state.eventLog.length;

    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      targetCardId: targetId,
      amount: 2,
      combatDamage: false,
    }).state;

    const damage = damageEvents(eventsSince(state, beforeEvents));
    expect(state.cards[targetId].zone).toBe('battlefield');
    expect(state.cards[targetId].damageMarked).toBe(2);
    expect(state.cards[targetId].hasDeathtouchDamage).toBe(false);
    expect(damage).toHaveLength(1);
    expect(damage[0]).toMatchObject({
      type: 'damage',
      source: { kind: 'object', physicalCardId: sourceId, objectId: sourceObjectId },
      target: { kind: 'object', physicalCardId: targetId, objectId: targetObjectId },
      amount: 2,
      combatDamage: false,
      cause: { type: 'command', commandType: 'dealDamage' },
    });
    expect(damage[0]).not.toHaveProperty('damageResultEventIds');
  });

  it('records deathtouch marked damage and lets existing SBA consume it for numeric toughness', () => {
    const source = cr120Creature('cr120-deathtouch-source', '1', '1');
    const variableTarget = cr120Creature('cr120-deathtouch-variable-target', '*', '*');
    let state = battlefieldState([source, variableTarget]);
    const sourceId = instanceId(state, source.scryfallId);
    const variableTargetId = instanceId(state, variableTarget.scryfallId);

    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      targetCardId: variableTargetId,
      amount: 1,
      combatDamage: false,
      deathtouch: true,
    }).state;

    expect(state.cards[variableTargetId].zone).toBe('battlefield');
    expect(state.cards[variableTargetId].damageMarked).toBe(1);
    expect(state.cards[variableTargetId].hasDeathtouchDamage).toBe(true);

    const numericTarget = cr120Creature('cr120-deathtouch-numeric-target', '4', '4');
    state = battlefieldState([source, numericTarget]);
    const nextSourceId = instanceId(state, source.scryfallId);
    const numericTargetId = instanceId(state, numericTarget.scryfallId);
    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId: nextSourceId,
      targetCardId: numericTargetId,
      amount: 1,
      combatDamage: false,
      deathtouch: true,
    }).state;

    expect(state.cards[numericTargetId].zone).toBe('graveyard');
    expect(state.eventLog).toContainEqual(
      expect.objectContaining({
        physicalCardId: numericTargetId,
        fromZone: 'battlefield',
        toZone: 'graveyard',
        reason: 'sba',
        sbaApplied: '704.5h',
      }),
    );
  });

  it('treats zero damage as no damage and emits no DamageEvent', () => {
    const source = cr120Creature('cr120-zero-source', '1', '1');
    const target = cr120Creature('cr120-zero-target', '3', '3');
    const state = battlefieldState([source, target]);
    const sourceId = instanceId(state, source.scryfallId);
    const targetId = instanceId(state, target.scryfallId);

    const result = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      targetCardId: targetId,
      amount: 0,
      combatDamage: false,
      deathtouch: true,
    });

    expect(result.state).toEqual(state);
    expect(damageEvents(result.state.eventLog.slice(state.eventLog.length))).toEqual([]);
  });

  it('keeps legacy source-less markDamage source-less and unaffected', () => {
    const target = cr120Creature('cr120-legacy-mark-target', '3', '3');
    let state = battlefieldState([target]);
    const targetId = instanceId(state, target.scryfallId);
    const beforeEvents = state.eventLog.length;

    state = applyCommand(state, {
      type: 'markDamage',
      cardId: targetId,
      amount: 2,
      deathtouch: false,
    }).state;

    expect(state.cards[targetId].damageMarked).toBe(2);
    expect(state.cards[targetId].hasDeathtouchDamage).toBe(false);
    expect(damageEvents(eventsSince(state, beforeEvents))).toEqual([]);
  });
});
