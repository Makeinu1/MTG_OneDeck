import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import { objectIdOf } from '../types';
import type { ZoneChangeEvent } from '../types';
import { makeDeck, makeDef } from './helpers';

describe('CR 400.7 zone-change events (Z2)', () => {
  it('records before/after ObjectSnapshot for battlefield to graveyard', () => {
    let state = initGame(makeDeck(4), 1);
    const id = state.zones.library[0];

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    state = applyCommand(state, { type: 'setTapped', cardId: id, tapped: true }).state;
    state = applyCommand(state, {
      type: 'addCounters',
      cardId: id,
      counterType: '+1/+1',
      delta: 2,
    }).state;
    const beforeCard = state.cards[id];
    const beforeObjectId = objectIdOf(beforeCard);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'graveyard',
      position: 'top',
    }).state;

    const event = state.eventLog[state.eventLog.length - 1];
    expect(event.type).toBe('zoneChange');
    expect(event.reason).toBe('move');
    expect(event.physicalCardId).toBe(id);
    expect(event.fromZone).toBe('battlefield');
    expect(event.toZone).toBe('graveyard');
    expect(event.oldObjectId).toBe(beforeObjectId);
    expect(event.newObjectId).toBe(objectIdOf(state.cards[id]));
    expect(event.before).toMatchObject({
      physicalCardId: id,
      objectId: beforeObjectId,
      zone: 'battlefield',
      tapped: true,
      typeLine: 'Creature',
      counters: { '+1/+1': 2 },
    });
    expect(event.after).toMatchObject({
      physicalCardId: id,
      objectId: objectIdOf(state.cards[id]),
      zone: 'graveyard',
      tapped: false,
      typeLine: 'Creature',
      counters: {},
    });
  });

  it('does not record an event for same-zone reordering', () => {
    let state = initGame(makeDeck(4), 1);
    const id = state.zones.library[0];

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'library',
      position: 'bottom',
    }).state;

    expect(state.eventLog).toEqual([]);
  });

  it('records the zone-change event before an exiting token ceases to exist', () => {
    let state = initGame(makeDeck(4), 1);
    state = applyCommand(state, {
      type: 'createToken',
      name: 'Goblin',
      typeLine: 'Token Creature — Goblin',
      power: '1',
      toughness: '1',
      quantity: 1,
    }).state;
    const tokenId = state.zones.battlefield.find((id) => state.cards[id].isToken);
    expect(tokenId).toBeDefined();

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: tokenId as string,
      to: 'graveyard',
      position: 'top',
    }).state;

    expect(state.cards[tokenId as string]).toBeUndefined();
    const moveEvent = state.eventLog.find(
      (event): event is ZoneChangeEvent =>
        event.type === 'zoneChange' &&
        event.physicalCardId === tokenId &&
        event.fromZone === 'battlefield' &&
        event.toZone === 'graveyard'
    );
    expect(moveEvent).toBeDefined();
    expect(moveEvent?.before.zone).toBe('battlefield');
    expect(moveEvent?.before.isToken).toBe(true);
    expect(moveEvent?.after).toMatchObject({
      physicalCardId: tokenId,
      zone: 'graveyard',
      isToken: true,
    });

    const ceaseEvent = state.eventLog.find(
      (event): event is ZoneChangeEvent =>
        event.type === 'zoneChange' &&
        event.physicalCardId === tokenId &&
        event.reason === 'token-cease'
    );
    expect(ceaseEvent).toMatchObject({
      fromZone: 'graveyard',
      toZone: undefined,
      sbaApplied: '704.5d',
    });
  });

  it('records CR 704.5f toughness-zero SBA as a battlefield to graveyard zone-change', () => {
    const fragile = makeDef({
      scryfallId: 'fragile-7045f',
      faces: [
        {
          name: 'Fragile 704.5f',
          typeLine: 'Creature',
          power: '1',
          toughness: '1',
        },
      ],
    });
    let state = initGame([{ def: fragile, isCommander: false }, ...makeDeck(3)], 1);
    const id = Object.values(state.cards).find((card) => card.defId === fragile.scryfallId)?.id;
    expect(id).toBeDefined();

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id as string,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    const beforeObjectId = objectIdOf(state.cards[id as string]);

    state = applyCommand(state, {
      type: 'addCounters',
      cardId: id as string,
      counterType: '-1/-1',
      delta: 1,
    }).state;

    expect(state.cards[id as string]?.zone).toBe('graveyard');
    expect(state.zones.battlefield).not.toContain(id);
    expect(state.zones.graveyard).toContain(id);
    const event = state.eventLog.find(
      (entry) =>
        entry.physicalCardId === id &&
        entry.fromZone === 'battlefield' &&
        entry.toZone === 'graveyard' &&
        entry.sbaApplied === '704.5f'
    );
    expect(event).toMatchObject({
      reason: 'sba',
      oldObjectId: beforeObjectId,
      before: {
        zone: 'battlefield',
        counters: { '-1/-1': 1 },
        toughness: '1',
      },
      after: {
        zone: 'graveyard',
        counters: {},
      },
    });
  });

  it('marks cast and resolve zone changes with distinct reasons', () => {
    let state = initGame(makeDeck(4), 1);
    const id = state.zones.library[0];
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'hand',
      position: 'top',
    }).state;

    state = applyCommand(state, {
      type: 'castToStack',
      cardId: id,
      payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      forced: true,
    }).state;
    expect(state.eventLog[state.eventLog.length - 1].reason).toBe('cast');
    expect(state.eventLog[state.eventLog.length - 1].toZone).toBe('stack');

    state = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(state.eventLog[state.eventLog.length - 1].reason).toBe('resolve');
    expect(state.eventLog[state.eventLog.length - 1].fromZone).toBe('stack');
  });
});
