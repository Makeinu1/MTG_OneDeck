import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { makeDeck } from './helpers';

it('keeps ordered library arrangements and only proliferates selected existing counters (CR 701.22, 701.25, 701.34)', () => {
  let table = createCockpitTable(makeDeck(20), 12);
  const seat = table.seats[0];
  const examined = seat.zones.library.slice(0, 3);
  table = applyTableOperation(table, {
    type: 'arrange',
    seatId: seat.id,
    examined,
    top: [examined[1]],
    bottom: [examined[0]],
    graveyard: [examined[2]],
  });
  expect(table.seats[0].zones.library[0]).toBe(examined[1]);
  expect(table.seats[0].zones.library.at(-1)).toBe(examined[0]);
  expect(table.cards[examined[2]].zone).toBe('graveyard');
  const targets = table.seats[0].zones.hand.slice(0, 2);
  table = applyTableOperation(table, {
    type: 'move',
    ids: targets,
    to: 'battlefield',
    position: 'bottom',
  });
  table = applyTableOperation(table, {
    type: 'counter',
    ids: targets,
    seatIds: [seat.id],
    name: 'charge',
    delta: 2,
  });
  table = applyTableOperation(table, { type: 'proliferate', ids: [targets[0]], seatIds: [] });
  expect(table.cards[targets[0]].counters.charge).toBe(3);
  expect(table.cards[targets[1]].counters.charge).toBe(2);
  expect(table.seats[0].counters.charge).toBe(2);
});

it('rejects a stale arrangement and an invalid bulk counter target without changing any input', () => {
  const table = createCockpitTable(makeDeck(20), 12);
  const before = structuredClone(table);
  expect(() =>
    applyTableOperation(table, {
      type: 'arrange',
      seatId: table.seats[0].id,
      examined: table.seats[0].zones.hand.slice(0, 1),
      top: table.seats[0].zones.hand.slice(0, 1),
      bottom: [],
      graveyard: [],
    }),
  ).toThrow();
  expect(() =>
    applyTableOperation(table, {
      type: 'counter',
      ids: [table.seats[0].zones.hand[0], 'missing'],
      seatIds: [],
      name: 'charge',
      delta: 1,
    }),
  ).toThrow();
  expect(table).toEqual(before);
});
