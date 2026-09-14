import { expect, it } from 'vitest';
import {
  createCockpitTable,
  applyTableOperation,
  emptyTableMana,
} from '../../../engine/cockpitTable';
import { makeDeck } from '../../../engine/__tests__/helpers';
import { addCockpitDeck, projectCockpit, type CockpitMultiplayer } from '../cockpitMultiplayer';

function fixture() {
  const deck = makeDeck(20);
  const other = deck.map((row) => ({
    ...row,
    def: {
      ...row.def,
      scryfallId: `other-${row.def.scryfallId}`,
      oracleId: `other-${row.def.oracleId}`,
    },
  }));
  const table = createCockpitTable(deck, 1, [deck, other]);
  const multi: CockpitMultiplayer = {
    invitation: 'fixture-only',
    started: true,
    masterId: 'P2',
    holds: [],
    borrowedFrom: 'P1',
    members: Object.fromEntries(
      ['P1', 'P2'].map((id) => [
        id,
        { token: id, connectionId: id, lastSeen: 100, kicked: false, peek: null },
      ]),
    ),
  };
  return { table, multi };
}

it('masks hidden historical sources through resolution while retaining public effects, targets and paid costs', () => {
  const initial = fixture();
  let table = initial.table;
  const sourceId = table.seats[1].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'face',
    cardId: sourceId,
    faceIndex: 0,
    faceDown: true,
  });
  table = applyTableOperation(table, {
    type: 'activate',
    id: 'public-ability',
    sourceId,
    choice: 'manual',
    text: 'Draw a card.',
    targets: ['P2'],
    manualCosts: {
      manaCost: '',
      life: 0,
      tapIds: [],
      sacrificeIds: [],
      discardIds: [],
      returnIds: [],
      exileIds: [],
      counters: [],
      note: 'Public granted ability',
    },
    paymentPlan: [{ type: 'payMana', payment: emptyTableMana(), playerId: 'P2' }],
  });
  const secret = table.cards[sourceId].defId;
  const original = structuredClone(table);
  const view = projectCockpit(table, initial.multi, 'P1', 100).table;
  expect(view.cards[sourceId].defId).toBe('cockpit-hidden');
  expect(view.stack[0].source.defId).toBe('cockpit-hidden');
  expect(view.stack[0].text).toBe('Draw a card.');
  expect(view.stack[0].targets).toEqual(['P2']);
  expect(view.stack[0].paid).toEqual(table.stack[0].paid);
  expect(view.defs[secret]).toBeUndefined();
  expect(table).toEqual(original);
  const alternate = structuredClone(table);
  alternate.defs[secret].name = 'Different private identity';
  expect(projectCockpit(alternate, initial.multi, 'P1', 100).table).toEqual(view);
  table = applyTableOperation(table, { type: 'resolve.begin' });
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'hand',
    position: 'top',
  });
  const after = projectCockpit(table, initial.multi, 'P1', 100).table;
  expect(after.resolution!.source.defId).toBe('cockpit-hidden');
  expect(after.defs[secret]).toBeUndefined();
  expect(projectCockpit(table, initial.multi, 'P2', 100).table.resolution!.source.defId).toBe(
    secret,
  );
  // Public LKI and public stack target snapshots must not be removed with private caches.
  const publicTable = structuredClone(original);
  publicTable.stack[0].source.faceDown = false;
  publicTable.stack.push({
    ...structuredClone(publicTable.stack[0]),
    id: 'response',
    targets: ['public-ability'],
    targetSnapshots: { 'public-ability': publicTable.stack[0].source },
  });
  const publicView = projectCockpit(publicTable, initial.multi, 'P1', 100).table;
  expect(publicView.defs[secret]).toBeDefined();
  expect(publicView.stack[1].targetSnapshots!['public-ability'].defId).toBe(secret);
});

it('limits an authorized peek to the requested prefix and accepts display-only card variants but rejects rule changes', () => {
  const { table, multi } = fixture();
  multi.members.P2.peek = { seatId: 'P1', zone: 'library', count: 2 };
  const peeked = projectCockpit(table, multi, 'P2', 100);
  expect(peeked.table.seats[0].zones.library).toEqual(table.seats[0].zones.library.slice(0, 2));
  expect(peeked.multiplayer.counts.P1.library).toBe(13);
  expect(peeked.table.cards[table.seats[0].zones.library[2]]).toBeUndefined();
  expect(projectCockpit(table, multi, 'P1', 100).table.seats[0].zones.library).toEqual([]);
  multi.masterId = 'P1';
  expect(projectCockpit(table, multi, 'P2', 100).table.seats[0].zones.library).toEqual([]);
  const deck = makeDeck(20);
  const empty = createCockpitTable(deck, 1, [deck, []]);
  const localized = deck.map((row) => ({
    ...row,
    def: {
      ...(Object.fromEntries(Object.entries(row.def).reverse()) as typeof row.def),
      printedName: '日本語名',
      lang: 'ja' as const,
      faces: row.def.faces.map((face) => ({
        ...face,
        imageUrl: 'https://example.invalid/card.png',
        printedText: '表示のみ',
      })),
    },
  }));
  expect(addCockpitDeck(empty, localized, 'P2', 1).seats[1].zones.hand).toHaveLength(7);
  const conflict = structuredClone(localized);
  conflict[0].def.faces[0].oracleText = 'Draw a card.';
  expect(() => addCockpitDeck(empty, conflict, 'P2', 1)).toThrow('CARD_DEFINITION_CONFLICT');
});
