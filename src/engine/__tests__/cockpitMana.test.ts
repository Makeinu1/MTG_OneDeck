import { expect, it } from 'vitest';
import { manaActivationChoices } from '../autotap';
import { applyTableOperation, createCockpitTable, tableManaResources } from '../cockpitTable';
import { makeDeck, makeDef } from './helpers';

function initial() {
  const watcher = makeDef({
    scryfallId: 'watcher',
    typeLine: 'Enchantment',
    faces: [
      {
        name: 'Mana watcher',
        typeLine: 'Enchantment',
        oracleText:
          'Whenever a player taps a land for mana, that player adds one mana of any type that land produced.',
      },
    ],
  });
  let table = createCockpitTable([...makeDeck(12), { def: watcher, isCommander: false }], 12);
  const watcherId = Object.values(table.cards).find((card) => card.defId === 'watcher')!.id;
  const islands = table.seats[1].zones.hand.slice(0, 2);
  table = applyTableOperation(table, {
    type: 'move',
    ids: [watcherId, ...islands],
    to: 'battlefield',
    position: 'top',
  });
  return { table, islands };
}
it('generates selected sources atomically and credits each land controller for the shared mana trigger (CR 605.1b)', () => {
  const { table, islands } = initial();
  const seatId = table.seats[1].id;
  const entries = islands.map((cardId) => ({
    cardId,
    commands: manaActivationChoices(tableManaResources(table, seatId), seatId, cardId)[0],
  }));
  const after = applyTableOperation(table, { type: 'generateBatch', entries });
  expect(after.seats[1].mana.U).toBe(4);
  expect(after.seats[0].mana.U).toBe(0);
  expect(islands.every((id) => after.cards[id].tapped)).toBe(true);
  expect(after.stack).toEqual([]);
  expect(table.seats[1].mana.U).toBe(0);
  let creatureTable = applyTableOperation(after, {
    type: 'token',
    id: 'mana-elf',
    seatId: 'P1',
    name: 'Mana elf',
    typeLine: 'Creature — Elf',
    power: '1',
    toughness: '1',
    text: '{T}: Add {G}.',
  });
  creatureTable = applyTableOperation(creatureTable, { type: 'turn' });
  expect(manaActivationChoices(tableManaResources(creatureTable, 'P1'), 'P1', 'mana-elf')).toEqual(
    [],
  );
  creatureTable = applyTableOperation(creatureTable, { type: 'turn' });
  expect(
    manaActivationChoices(tableManaResources(creatureTable, 'P1'), 'P1', 'mana-elf').length,
  ).toBeGreaterThan(0);
});
it('rejects a stale second source without partially tapping or adding mana', () => {
  const { table, islands } = initial();
  const seatId = table.seats[1].id;
  const entries = islands.map((cardId) => ({
    cardId,
    commands: manaActivationChoices(tableManaResources(table, seatId), seatId, cardId)[0],
  }));
  const stale = applyTableOperation(table, { type: 'tap', ids: [islands[1]], tapped: true });
  const before = structuredClone(stale);
  expect(() => applyTableOperation(stale, { type: 'generateBatch', entries })).toThrow(
    'マナ生成案',
  );
  expect(stale).toEqual(before);
});
