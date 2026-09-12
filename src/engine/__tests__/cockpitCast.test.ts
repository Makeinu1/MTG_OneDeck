import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable, tableCastPayment } from '../cockpitTable';
import { makeDeck, makeDef } from './helpers';

function initial() {
  const spell = makeDef({
    scryfallId: 'x-spell',
    typeLine: 'Sorcery',
    faces: [{ name: 'X spell', typeLine: 'Sorcery', manaCost: '{X}{U}' }],
  });
  let table = createCockpitTable([...makeDeck(12), { def: spell, isCommander: false }], 4);
  const cardId = Object.values(table.cards).find((card) => card.defId === 'x-spell')!.id;
  table = applyTableOperation(table, { type: 'move', ids: [cardId], to: 'hand', position: 'top' });
  table = applyTableOperation(table, { type: 'mana', seatId: 'P1', color: 'U', delta: 4 });
  return { table, cardId };
}
it('retains announced X, selected targets and the exact paid proposal with manual effect resolution (CR 601.2)', () => {
  const { table, cardId } = initial();
  const paymentPlan = tableCastPayment(table, cardId, 2);
  const after = applyTableOperation(table, {
    type: 'cast',
    cardId,
    x: 2,
    targets: [table.seats[1].id],
    paymentPlan,
  });
  expect(after.seats[0].mana.U).toBe(1);
  expect(after.stack[0]).toMatchObject({
    source: { announcedX: 2 },
    targets: [table.seats[1].id],
    paid: paymentPlan,
  });
  expect(after.cards[cardId].zone).toBe('stack');
  const manualPayment = tableCastPayment(table, cardId, 2, [], '{U}', '軽減を本文で確認');
  const manual = applyTableOperation(table, { type: 'cast', cardId, x: 2, targets: [], manualManaCost: '{U}', costNote: '軽減を本文で確認', paymentPlan: manualPayment });
  expect(manual.seats[0].mana.U).toBe(3);
  expect(manual.stack[0].costNote).toContain('軽減を本文で確認');

});
it('rejects a stale X proposal without paying or moving the spell', () => {
  const { table, cardId } = initial();
  const before = structuredClone(table);
  const paymentPlan = tableCastPayment(table, cardId, 1);
  expect(() =>
    applyTableOperation(table, { type: 'cast', cardId, x: 2, targets: [], paymentPlan }),
  ).toThrow('支払い案');
  expect(() => tableCastPayment(table, cardId, 0, [], '', '')).toThrow('確認記録');
  expect(table).toEqual(before);
});
