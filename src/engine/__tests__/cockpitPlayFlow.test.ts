import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable, tableActivationPayment } from '../cockpitTable';
import { tableAbilityChoices } from '../cockpitAbilities';
import { makeDeck } from './helpers';

function fetchTable() {
  const deck = makeDeck(20).map((item) => ({
    ...item,
    def: {
      ...item.def,
      faces: [
        {
          name: item.def.name,
          typeLine: 'Basic Land — Forest',
          oracleText:
            '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
        },
      ],
    },
  }));
  let table = createCockpitTable(deck, 1);
  const sourceId = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });
  const choice = tableAbilityChoices(table, sourceId)[0].key;
  return applyTableOperation(table, {
    type: 'activate',
    id: 'fetch-1',
    sourceId,
    choice,
    text: '',
    targets: [],
    manualCosts: null,
    paymentPlan: tableActivationPayment(table, sourceId, choice, null).paid,
  });
}

it('finishes a fetch in one deterministic operation and prepares only the human turn (CR 701.23–24, 502, 504)', () => {
  const before = fetchTable();
  const cardId = before.seats[0].zones.library[0];
  const operation = {
    type: 'resolve.fetch' as const,
    entryId: 'fetch-1',
    cardId,
    tapped: true,
    seed: 42,
  };
  let after = applyTableOperation(before, operation);
  expect(after).toEqual(applyTableOperation(before, operation));
  expect(after.cards[cardId].zone).toBe('battlefield');
  expect(after.cards[cardId].tapped).toBe(true);
  expect(after.stack).toHaveLength(0);
  expect(before.cards[cardId].zone).toBe('library');
  expect(before.stack).toHaveLength(1);
  expect(after.seats[1].zones.library).toHaveLength(0);
  after = applyTableOperation(after, { type: 'keep', seatId: 'P1', bottom: [] });
  after = applyTableOperation(after, { type: 'turn.ready' });
  expect(after.phase).toBe('main1');
  expect(after.cards[cardId].tapped).toBe(false);
  const count = after.seats[0].zones.hand.length;
  after = applyTableOperation(after, { type: 'turn.ready' });
  expect(after.activeSeatId).toBe('P1');
  expect(after.turn).toBe(2);
  expect(after.seats[0].zones.hand).toHaveLength(count + 1);
  // Old saved solo sessions may still be on the passive seat's turn.
  const legacy = {
    ...before,
    activeSeatId: 'P2',
    stack: [],
    seats: before.seats.map((seat) => ({ ...seat, kept: true })),
  };
  const resumed = applyTableOperation(legacy, { type: 'turn.ready' });
  expect(resumed.activeSeatId).toBe('P1');
  expect(resumed.phase).toBe('main1');
  expect(resumed.seats[1].zones).toEqual(legacy.seats[1].zones);
});

it('rejects a stale fetch target and a blocked turn without partial movement, shuffle or draw', () => {
  const before = fetchTable();
  const saved = structuredClone(before);
  expect(() =>
    applyTableOperation(before, {
      type: 'resolve.fetch',
      entryId: 'other',
      cardId: before.seats[0].zones.library[0],
      tapped: false,
      seed: 1,
    }),
  ).toThrow();
  expect(() =>
    applyTableOperation(before, {
      type: 'resolve.fetch',
      entryId: 'fetch-1',
      cardId: before.seats[0].zones.hand[0],
      tapped: false,
      seed: 1,
    }),
  ).toThrow();
  expect(() => applyTableOperation(before, { type: 'turn.ready' })).toThrow();
  expect(before).toEqual(saved);
});
