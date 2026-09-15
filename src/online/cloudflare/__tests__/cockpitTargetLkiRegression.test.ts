import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../../engine/cockpitTable';
import { makeDeck } from '../../../engine/__tests__/helpers';
import { projectCockpit, type CockpitMultiplayer } from '../cockpitMultiplayer';

function fixture() {
  const deck = makeDeck(20);
  const other = deck.map((row) => ({
    ...row,
    def: {
      ...row.def,
      scryfallId: `lki-other-${row.def.scryfallId}`,
      oracleId: `lki-other-${row.def.oracleId}`,
    },
  }));
  const table = createCockpitTable(deck, 1, [deck, other]);
  const multi: CockpitMultiplayer = {
    invitation: 'lki-regression',
    started: true,
    masterId: 'P1',
    holds: [],
    borrowedFrom: null,
    members: Object.fromEntries(
      ['P1', 'P2'].map((id) => [
        id,
        { token: id, connectionId: id, lastSeen: 100, kicked: false, peek: null },
      ]),
    ),
  };
  return { table, multi };
}

function putTargetedEntry(faceDown: boolean) {
  const { table: initial, multi } = fixture();
  let table = initial;
  const sourceId = table.seats[0].zones.hand[0];
  const targetId = table.seats[1].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [targetId],
    to: 'battlefield',
    position: 'top',
  });
  if (faceDown)
    table = applyTableOperation(table, {
      type: 'face',
      cardId: targetId,
      faceIndex: 0,
      faceDown: true,
    });
  const targetSnapshot = structuredClone(table.cards[targetId]);
  table.stack.push({
    id: faceDown ? 'masked-lki-entry' : 'public-lki-entry',
    kind: 'activated',
    source: structuredClone(table.cards[sourceId]),
    controllerId: 'P1',
    targets: [targetId],
    targetSnapshots: { [targetId]: targetSnapshot },
    paid: [],
    text: 'Target creature gets +1/+1 until end of turn.',
  });
  table = applyTableOperation(table, {
    type: 'move',
    ids: [targetId],
    to: 'hand',
    position: 'top',
  });
  return { table, multi, targetId, targetSnapshot };
}

it('keeps face-up public target LKI after the physical card moves into a hidden zone', () => {
  const { table, multi, targetId, targetSnapshot } = putTargetedEntry(false);
  const view = projectCockpit(table, multi, 'P1', 100).table;
  const snapshot = view.stack[0].targetSnapshots?.[targetId];

  expect(view.cards[targetId]).toBeUndefined();
  expect(view.seats[1].zones.hand).not.toContain(targetId);
  expect(snapshot).toMatchObject({
    id: targetId,
    defId: targetSnapshot.defId,
    zone: 'battlefield',
    zoneChangeCounter: targetSnapshot.zoneChangeCounter,
  });
  expect(view.defs[targetSnapshot.defId]).toBeDefined();
});

it('retains a formerly public face-down target only as a masked LKI snapshot', () => {
  const { table, multi, targetId, targetSnapshot } = putTargetedEntry(true);
  const view = projectCockpit(table, multi, 'P1', 100).table;
  const snapshot = view.stack[0].targetSnapshots?.[targetId];

  expect(view.cards[targetId]).toBeUndefined();
  expect(snapshot?.defId).toBe('cockpit-hidden');
  expect(snapshot?.faceDown).toBe(true);
  expect(view.defs['cockpit-hidden']).toBeDefined();
  expect(view.defs[targetSnapshot.defId]).toBeUndefined();
});
