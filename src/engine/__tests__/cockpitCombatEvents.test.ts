import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable, tableCastPayment } from '../cockpitTable';
import { makeDeck } from './helpers';

function fixture() {
  const deck = makeDeck(20).map((row) => ({
    ...row,
    def: { ...row.def, faces: [{ name: row.def.name, typeLine: 'Creature', manaCost: '{0}', power: '2', toughness: '2' }] },
  }));
  return createCockpitTable(deck, 1, [deck, deck]);
}

it('removes changed combatants and stale assignments while preserving blocked history (CR 506.4, 509.1h)', () => {
  let table = fixture();
  const [a, b] = table.seats[0].zones.hand;
  const blocker = table.seats[1].zones.hand[0];
  table = applyTableOperation(table, { type: 'move', ids: [a, b, blocker], to: 'battlefield', position: 'top' });
  table = applyTableOperation(table, { type: 'battle.attack', attackers: [{ cardId: a, targetId: 'P2' }, { cardId: b, targetId: 'P2' }], tapIds: [a, b] });
  table = applyTableOperation(table, { type: 'battle.block', blockers: [{ cardId: blocker, attackerIds: [a] }] });
  table = applyTableOperation(table, { type: 'battle.assign', assignments: [{ sourceId: a, targetId: blocker, amount: 2 }, { sourceId: b, targetId: 'P2', amount: 2 }] });
  const original = structuredClone(table);
  const tapped = applyTableOperation(table, { type: 'tap', ids: [a], tapped: false });
  expect(tapped.combat).toEqual(table.combat);
  const sameController = applyTableOperation(table, { type: 'control', ids: [a], seatId: 'P1' });
  expect(sameController.combat).toEqual(table.combat);

  const stolen = applyTableOperation(table, { type: 'control', ids: [a], seatId: 'P2' });
  expect(stolen.combat!.attackers.map((entry) => entry.cardId)).toEqual([b]);
  expect(stolen.combat!.blockers).toMatchObject([{ cardId: blocker, attackerIds: [] }]);
  expect(stolen.combat!.assignments).toEqual([]);
  expect(() => applyTableOperation(stolen, { type: 'battle.apply', assignments: [{ sourceId: a, targetId: 'P2', amount: 2 }] })).toThrow();
  const remaining = applyTableOperation(stolen, { type: 'battle.apply', assignments: [{ sourceId: b, targetId: 'P2', amount: 2 }] });
  expect(remaining.seats[1].life).toBe(38);

  const bounced = applyTableOperation(table, { type: 'move', ids: [blocker], to: 'hand', position: 'top' });
  expect(bounced.combat!.blockers).toEqual([]);
  expect(bounced.combat!.attackers.find((entry) => entry.cardId === a)).toMatchObject({ blocked: true });
  expect(bounced.combat!.assignments).toEqual([]);
  const returned = applyTableOperation(bounced, { type: 'move', ids: [blocker], to: 'battlefield', position: 'top' });
  expect(returned.combat!.blockers).toEqual([]);
  expect(() => applyTableOperation(returned, { type: 'battle.apply', assignments: [{ sourceId: blocker, targetId: a, amount: 2 }] })).toThrow();
  expect(table).toEqual(original);
});

it('records a permanent spell copy as a token at the ETB boundary, not a nontoken entry (CR 608.3f)', () => {
  let table = fixture();
  const [watcher, spell] = table.seats[0].zones.hand;
  table.defs[table.cards[watcher].defId].faces[0].oracleText = 'Whenever another nontoken creature enters the battlefield under your control, draw a card.';
  table = applyTableOperation(table, { type: 'move', ids: [watcher], to: 'battlefield', position: 'top' });
  table = applyTableOperation(table, { type: 'cast', cardId: spell, x: 0, targets: [], paymentPlan: tableCastPayment(table, spell, 0) });
  const originalEntry = table.stack[0].id;
  table = applyTableOperation(table, { type: 'copyStack', entryId: originalEntry, id: 'copy-proof', controllerId: 'P1', targets: [] });
  const before = structuredClone(table);
  table = applyTableOperation(table, { type: 'resolve.finish', entryId: 'copy-proof', to: 'battlefield' });
  expect(table.cards['copy-proof'].isToken).toBe(true);
  const entry = table.triggers!.events.find((event) => event.type === 'zoneChange' && event.physicalCardId === 'copy-proof' && event.toZone === 'battlefield');
  expect(entry).toMatchObject({ before: { isToken: false }, after: { isToken: true } });
  expect(table.triggers!.candidates).toHaveLength(0);
  expect(before.cards['copy-proof'].isToken).toBe(false);
  // Ordinary nontoken resolution must still trigger the same recognized watcher.
  table = applyTableOperation(table, { type: 'resolve.finish', entryId: originalEntry, to: 'battlefield' });
  expect(table.triggers!.candidates).toHaveLength(1);
  expect(table.triggers!.candidates[0].requiresManualRuling).toBe(false);
});

it('does not advance combat damage past an unplaced attack trigger (CR 603.3, 117.5)', () => {
  let table = fixture();
  const a = table.seats[0].zones.hand[0];
  const def = table.defs[table.cards[a].defId];
  def.faces[0].oracleText = `Whenever ${def.name} attacks, draw a card.`;
  table = applyTableOperation(table, { type: 'move', ids: [a], to: 'battlefield', position: 'top' });
  table = applyTableOperation(table, { type: 'battle.attack', attackers: [{ cardId: a, targetId: 'P2' }], tapIds: [a] });
  expect(table.triggers!.candidates.some((candidate) => candidate.status === 'pending' && !candidate.requiresManualRuling)).toBe(true);
  expect(() => applyTableOperation(table, { type: 'battle.apply', assignments: [{ sourceId: a, targetId: 'P2', amount: 2 }] })).toThrow();
  expect(table.seats[1].life).toBe(40);
  const candidate = table.triggers!.candidates[0];
  table = applyTableOperation(table, { type: 'trigger.place', candidateId: candidate.pendingTriggerId, id: 'attack-trigger', targets: [] });
  table = applyTableOperation(table, { type: 'resolve.finish', entryId: 'attack-trigger', to: 'graveyard' });
  table = applyTableOperation(table, { type: 'battle.apply', assignments: [{ sourceId: a, targetId: 'P2', amount: 2 }] });
  expect(table.seats[1].life).toBe(38);
});
