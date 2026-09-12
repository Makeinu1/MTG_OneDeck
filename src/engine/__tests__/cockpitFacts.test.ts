import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { makeDeck } from './helpers';

it('preserves explicit relationships and creates a clean permanent copy, including JSON restoration', () => {
  let table = createCockpitTable(makeDeck(20), 12);
  const [source, target] = table.seats[0].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [source, target],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, { type: 'attach', cardId: source, targetId: target });
  table = applyTableOperation(table, {
    type: 'counter',
    ids: [target],
    seatIds: [],
    name: 'charge',
    delta: 2,
  });
  table = applyTableOperation(table, {
    type: 'modifier',
    modifier: {
      id: 'effect',
      cardId: target,
      power: 2,
      toughness: 1,
      duration: 'turn end',
      sourceId: source,
    },
    remove: false,
  });
  table = applyTableOperation(table, { type: 'control', ids: [target], seatId: 'P2' });
  table = applyTableOperation(table, {
    type: 'copyPermanent',
    id: 'copy',
    seatId: 'P2',
    sourceId: target,
  });
  expect(table.cards.copy.counters).toEqual({});
  table = applyTableOperation(table, {
    type: 'token.edit',
    cardId: 'copy',
    definitionId: 'copy-edit',
    value: {
      name: 'Flying copy',
      typeLine: 'Creature — Bird',
      power: '2',
      toughness: '2',
      text: 'Flying',
      colors: ['U'],
    },
  });
  const copiedDef = table.defs[table.cards.copy.defId];
  expect(copiedDef.faces[0]).toMatchObject({ name: 'Flying copy', power: '2', colors: ['U'] });
  expect(table.cards.copy.sourceId).toBe(target);
  expect(table.defs[table.cards[target].defId].name).not.toBe('Flying copy');

  expect(table.cards.copy.attachedTo).toBeUndefined();
  expect(table.modifiers.some((item) => item.cardId === 'copy')).toBe(false);
  expect(table.cards[target].ownerId).toBe('P1');
  expect(table.cards[target].controllerId).toBe('P2');
  table = applyTableOperation(table, { type: 'move', ids: [target], to: 'exile', position: 'top' });
  table = applyTableOperation(table, {
    type: 'link',
    sourceId: source,
    ids: [target],
    duration: 'source leaves',
    remove: false,
  });
  const loaded = JSON.parse(JSON.stringify(table)) as typeof table;
  expect(loaded.linkedExiles[0].exiledPhysicalIds).toEqual([target]);
  expect(loaded.cards[source].attachedTo).toBeUndefined();
  expect(loaded.modifiers).toEqual([]);
  const unlinked = applyTableOperation(loaded, {
    type: 'link',
    sourceId: source,
    ids: [target],
    duration: '',
    remove: true,
  });
  expect(unlinked.linkedExiles).toEqual([]);
});

it('rejects attachment cycles and partial cross-seat changes without mutating the board', () => {
  let table = createCockpitTable(makeDeck(20), 12);
  const [a, b] = table.seats[0].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [a, b],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, { type: 'attach', cardId: a, targetId: b });
  const before = structuredClone(table);
  expect(() => applyTableOperation(table, { type: 'attach', cardId: b, targetId: a })).toThrow(
    '循環',
  );
  expect(() =>
    applyTableOperation(table, { type: 'control', ids: [a, 'missing'], seatId: 'P2' }),
  ).toThrow();
  expect(table).toEqual(before);
});
