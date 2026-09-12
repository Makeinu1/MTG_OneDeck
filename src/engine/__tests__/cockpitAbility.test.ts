import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable, tableActivationPayment } from '../cockpitTable';
import { makeDeck } from './helpers';

function initial() {
  const deck = makeDeck(12).map((entry) => ({
    ...entry,
    def: {
      ...entry.def,
      faces: [{ name: entry.def.name, typeLine: 'Creature', oracleText: 'Cycling {1}' }],
    },
  }));
  return applyTableOperation(createCockpitTable(deck, 12), {
    type: 'mana',
    seatId: 'P1',
    color: 'U',
    delta: 1,
  });
}
it('pays cycling once, retains the discarded source and leaves draw to manual resolution (CR 702.29)', () => {
  let table = initial();
  const id = table.seats[0].zones.hand[0];
  const proposal = tableActivationPayment(table, id, 'cycling', null);
  table = applyTableOperation(table, {
    type: 'activate',
    id: 'ability',
    sourceId: id,
    choice: 'cycling',
    text: '',
    targets: [],
    manualCosts: null,
    paymentPlan: proposal.paid,
  });
  expect(table.cards[id].zone).toBe('graveyard');
  expect(table.seats[0].zones.hand).toHaveLength(6);
  expect(table.stack[0].source.zone).toBe('hand');
  expect(table.seats[0].mana.U).toBe(0);
  table = applyTableOperation(table, { type: 'move', ids: [id], to: 'exile', position: 'top' });
  expect(table.stack).toHaveLength(1);
  table = applyTableOperation(table, { type: 'resolve.begin' });
  table = applyTableOperation(table, { type: 'draw', seatId: 'P1', count: 1 });
  table = applyTableOperation(table, { type: 'resolve.end', to: 'graveyard' });
  expect(table.seats[0].zones.hand).toHaveLength(7);
  expect(table.cards[id].zone).toBe('exile');
  expect(table.stack).toEqual([]);
  const triggered = tableActivationPayment(table, id, 'triggered', null);
  table = applyTableOperation(table, {
    type: 'activate',
    id: 'pending-trigger',
    sourceId: id,
    choice: 'triggered',
    text: 'Pending effect',
    targets: [],
    manualCosts: null,
    paymentPlan: triggered.paid,
  });
  table = applyTableOperation(table, {
    type: 'activate',
    id: 'response',
    sourceId: id,
    choice: 'triggered',
    text: 'Counter target ability',
    targets: ['pending-trigger'],
    manualCosts: null,
    paymentPlan: triggered.paid,
  });
  table = applyTableOperation(table, { type: 'resolve.begin' });
  table = applyTableOperation(table, {
    type: 'stack.remove',
    entryId: 'pending-trigger',
    to: 'graveyard',
  });
  expect(table.resolution?.id).toBe('response');
  expect(table.stack.map((entry) => entry.id)).toEqual(['response']);
  expect(table.stack[0].targetSnapshots?.['pending-trigger'].id).toBe(id);
  expect(table.cards[id].zone).toBe('exile');
});
it('rejects an altered cost proposal without paying or moving the source', () => {
  const table = initial();
  const before = structuredClone(table);
  expect(() =>
    applyTableOperation(table, {
      type: 'activate',
      id: 'P1',
      sourceId: table.seats[0].zones.hand[0],
      choice: 'triggered',
      text: 'Manual trigger',
      targets: [],
      manualCosts: null,
      paymentPlan: [],
    }),
  ).toThrow();
  expect(() =>
    applyTableOperation(table, {
      type: 'activate',
      id: 'ability',
      sourceId: table.seats[0].zones.hand[0],
      choice: 'cycling',
      text: '',
      targets: [],
      manualCosts: null,
      paymentPlan: [],
    }),
  ).toThrow('支払い案');
  expect(table).toEqual(before);
});
