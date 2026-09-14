import { expect, it } from 'vitest';
import { createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { liveStackDetail } from './cockpitTransientSelections';

function tableWithEntry() {
  const table = createCockpitTable(makeDeck(30), 42);
  const sourceId = table.seats[0].zones.hand[0];
  table.stack.push({
    id: 'detail-entry',
    kind: 'activated',
    source: structuredClone(table.cards[sourceId]),
    controllerId: 'P1',
    targets: [],
    paid: [],
    text: 'Draw a card.',
  });
  return table;
}

it('releases stale stack-detail ownership after the entry leaves stack and resolution', () => {
  const table = tableWithEntry();
  expect(liveStackDetail(table, 'detail-entry')?.id).toBe('detail-entry');

  table.resolution = table.stack.shift()!;
  expect(liveStackDetail(table, 'detail-entry')?.id).toBe('detail-entry');

  table.resolution = null;
  expect(liveStackDetail(table, 'detail-entry')).toBeNull();
  expect(liveStackDetail(table, null)).toBeNull();
});
