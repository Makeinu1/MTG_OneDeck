import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { cockpitPowerToughness } from '../cockpitPowerToughness';
import { makeDeck } from './helpers';

function setup() {
  const table = createCockpitTable(makeDeck(12), 1);
  const id = table.seats[0].zones.hand[0];
  const card = table.cards[id];
  table.defs[card.defId].faces[0].power = '2';
  table.defs[card.defId].faces[0].toughness = '2';
  return {
    table: applyTableOperation(table, {
      type: 'move',
      ids: [id],
      to: 'battlefield',
      position: 'top',
    }),
    id,
  };
}
it('uses one recorded total through modifier application, saved-state reload and removal without double counters', () => {
  const s = setup();
  s.table.cards[s.id].counters = { '+1/+1': 2, '-1/-1': 1, charge: 9 };
  const modifier = {
    id: 'pt',
    cardId: s.id,
    power: 3,
    toughness: 4,
    duration: 'ターン終了まで',
    sourceId: null,
  };
  const original = structuredClone(s.table);
  const changed = applyTableOperation(s.table, { type: 'modifier', modifier, remove: false });
  expect(cockpitPowerToughness(changed, s.id)).toEqual({ power: 6, toughness: 7 });
  expect(
    cockpitPowerToughness(JSON.parse(JSON.stringify(changed)) as typeof changed, s.id),
  ).toEqual({ power: 6, toughness: 7 });
  expect(
    cockpitPowerToughness(
      applyTableOperation(changed, { type: 'modifier', modifier, remove: true }),
      s.id,
    ),
  ).toEqual({ power: 3, toughness: 3 });
  expect(cockpitPowerToughness(original, s.id)).toEqual({ power: 3, toughness: 3 });
  expect(s.table).toEqual(original);
  expect(changed.defs).toEqual(original.defs);
});
it('does not invent numeric power for unknown, blank or face-down characteristics', () => {
  const s = setup();
  const face = s.table.defs[s.table.cards[s.id].defId].faces[0];
  face.power = '*';
  face.toughness = '1';
  expect(cockpitPowerToughness(s.table, s.id)).toEqual({ power: null, toughness: 1 });
  face.power = '';
  expect(cockpitPowerToughness(s.table, s.id)?.power).toBeNull();
  face.power = '-2';
  expect(cockpitPowerToughness(s.table, s.id)?.power).toBe(-2);
  s.table.cards[s.id].faceDown = true;
  expect(cockpitPowerToughness(s.table, s.id)).toBeUndefined();
  expect(cockpitPowerToughness(s.table, 'missing')).toBeUndefined();
});
