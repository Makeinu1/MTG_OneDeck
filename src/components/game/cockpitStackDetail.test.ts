import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable, tableActivationPayment } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { cockpitStackDetailEntry } from './cockpitStackDetail';

function withStack() {
  let table = createCockpitTable(makeDeck(20), 1);
  table.seats[0].kept = true;
  const sourceId = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });
  const manualCosts = {
    manaCost: '',
    life: 0,
    tapIds: [],
    sacrificeIds: [],
    discardIds: [],
    returnIds: [],
    exileIds: [],
    counters: [],
    note: '',
  };
  const proposal = tableActivationPayment(table, sourceId, 'manual', manualCosts);
  table = applyTableOperation(table, {
    type: 'activate',
    id: 'detail-stack',
    sourceId,
    choice: 'manual',
    text: 'Draw a card.',
    targets: [],
    manualCosts,
    paymentPlan: proposal.paid,
  });
  return table;
}

it('keeps a visible stack/resolution detail and releases a removed stale id', () => {
  let table = withStack();
  expect(cockpitStackDetailEntry(table, 'detail-stack')?.id).toBe('detail-stack');
  table = applyTableOperation(table, { type: 'resolve.begin' });
  expect(cockpitStackDetailEntry(table, 'detail-stack')?.id).toBe('detail-stack');
  table = { ...table, resolution: null, stack: [] };
  expect(cockpitStackDetailEntry(table, 'detail-stack')).toBeNull();
});
