import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import { objectIdOf } from '../types';
import { makeDeck } from './helpers';

describe('CR 400.7 zone-change object identity (Z1)', () => {
  it('increments zoneChangeCounter when a physical card changes zones', () => {
    let state = initGame(makeDeck(4), 1);
    const id = state.zones.library[0];

    expect(state.cards[id].zoneChangeCounter).toBe(0);
    expect(objectIdOf(state.cards[id])).toBe(`${id}:0`);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'hand',
      position: 'top',
    }).state;
    expect(state.cards[id].zone).toBe('hand');
    expect(state.cards[id].zoneChangeCounter).toBe(1);
    expect(objectIdOf(state.cards[id])).toBe(`${id}:1`);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    expect(state.cards[id].zone).toBe('battlefield');
    expect(state.cards[id].zoneChangeCounter).toBe(2);
    expect(objectIdOf(state.cards[id])).toBe(`${id}:2`);
  });

  it('does not change object identity for same-zone library reordering', () => {
    let state = initGame(makeDeck(4), 1);
    const id = state.zones.library[0];
    const beforeObjectId = objectIdOf(state.cards[id]);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'library',
      position: 'bottom',
    }).state;

    expect(state.zones.library[state.zones.library.length - 1]).toBe(id);
    expect(state.cards[id].zoneChangeCounter).toBe(0);
    expect(objectIdOf(state.cards[id])).toBe(beforeObjectId);
  });

  it('does not reset counters or tapped status for same-zone battlefield reordering', () => {
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
    const beforeObjectId = objectIdOf(state.cards[id]);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'battlefield',
      position: 'bottom',
    }).state;

    expect(state.cards[id].zoneChangeCounter).toBe(1);
    expect(objectIdOf(state.cards[id])).toBe(beforeObjectId);
    expect(state.cards[id].tapped).toBe(true);
    expect(state.cards[id].counters['+1/+1']).toBe(2);
  });
});
