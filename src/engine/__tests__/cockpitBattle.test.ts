import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { makeDeck } from './helpers';
function battle() {
  let table = createCockpitTable(makeDeck(20), 1);
  const attacker = table.seats[0].zones.hand[0];
  const blocker = table.seats[1].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [attacker, blocker],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'battle.attack',
    attackers: [{ cardId: attacker, targetId: 'P2' }],
    tapIds: [attacker],
  });
  table = applyTableOperation(table, {
    type: 'battle.block',
    blockers: [{ cardId: blocker, attackerIds: [attacker] }],
  });
  table = applyTableOperation(table, {
    type: 'battle.assign',
    assignments: [
      { sourceId: attacker, targetId: blocker, amount: 3 },
      { sourceId: blocker, targetId: attacker, amount: 2 },
    ],
  });
  return { table, attacker, blocker };
}
it('applies declared damage once and only clears explicitly reviewed cleanup targets', () => {
  const prepared = battle();
  let table = applyTableOperation(prepared.table, { type: 'battle.apply' });
  expect(table.cards[prepared.attacker].damageMarked).toBe(2);
  expect(table.cards[prepared.blocker].damageMarked).toBe(3);
  expect(table.cards[prepared.blocker].zone).toBe('battlefield');
  expect(table.ended).toBe(false);
  expect(() => applyTableOperation(table, { type: 'battle.apply' })).toThrow();
  table = applyTableOperation(table, { type: 'battle.nextDamage' });
  expect(table.combat?.assignments).toEqual([]);
  table = applyTableOperation(table, {
    type: 'battle.assign',
    assignments: [{ sourceId: prepared.attacker, targetId: 'P2', amount: 1 }],
  });
  table = applyTableOperation(table, { type: 'battle.apply' });
  expect(table.seats[1].life).toBe(39);
  expect(() => applyTableOperation(table, { type: 'battle.nextDamage' })).toThrow();

  table = applyTableOperation(table, { type: 'battle.end' });
  for (let step = 0; step < 3; step++) table = applyTableOperation(table, { type: 'phase' });
  table = applyTableOperation(table, {
    type: 'cleanup',
    seatId: 'P1',
    damageIds: [prepared.attacker],
    grantIds: [],
    modifierIds: [],
    discardIds: [],
  });
  expect(table.cards[prepared.attacker].damageMarked).toBe(0);
  expect(table.cards[prepared.blocker].damageMarked).toBe(3);
});
it('does not apply an old assignment to a card that left and returned, or advance through HOLD', () => {
  const prepared = battle();
  let table = applyTableOperation(prepared.table, {
    type: 'move',
    ids: [prepared.blocker],
    to: 'exile',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'move',
    ids: [prepared.blocker],
    to: 'battlefield',
    position: 'top',
  });
  const before = structuredClone(table);
  expect(() => applyTableOperation(table, { type: 'battle.apply' })).toThrow();
  expect(table).toEqual(before);
  table = applyTableOperation(table, { type: 'battle.end' });
  table = applyTableOperation(table, { type: 'hold', held: true });
  expect(() => applyTableOperation(table, { type: 'turn' })).toThrow();
});
