import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { makeDeck } from './helpers';
import {
  projectCockpit,
  type CockpitMultiplayer,
} from '../../online/cloudflare/cockpitMultiplayer';

it('detects created permanents and sourced damage without treating a damage correction as an event', () => {
  let table = createCockpitTable(makeDeck(30), 1);
  table = applyTableOperation(table, {
    type: 'token',
    id: 'source',
    seatId: 'P1',
    name: 'Witness',
    typeLine: 'Creature',
    power: '1',
    toughness: '1',
    text: 'When Witness enters the battlefield, draw a card.\nWhenever Witness deals damage to a player, draw a card.',
  });
  expect(table.triggers!.candidates).toHaveLength(1);
  const before = table.triggers!.candidates.length;
  table = applyTableOperation(table, { type: 'damage', ids: ['source'], delta: 1 });
  expect(table.triggers!.candidates).toHaveLength(before);
  const untouched = structuredClone(table);
  expect(() =>
    applyTableOperation(table, {
      type: 'damage',
      ids: [],
      seatIds: ['P2'],
      delta: 2,
      sourceId: 'source',
      sourceObjectId: 'source:99',
    }),
  ).toThrow();
  expect(table).toEqual(untouched);
  table = applyTableOperation(table, {
    type: 'damage',
    ids: [],
    seatIds: ['P2'],
    delta: 2,
    sourceId: 'source',
    sourceObjectId: 'source:0',
  });
  expect(table.triggers!.candidates).toHaveLength(before + 1);
  expect(table.seats[1].life).toBe(38);
});
it('keeps private-to-private movement out of another seat’s Feed and enforces APNAP with the master as operator', () => {
  let table = createCockpitTable(makeDeck(30), 1, [makeDeck(30), makeDeck(30)]);
  const multi: CockpitMultiplayer = {
    invitation: 'test',
    members: Object.fromEntries(
      ['P1', 'P2'].map((id) => [
        id,
        { token: id, connectionId: id, lastSeen: 1, kicked: false, peek: null },
      ]),
    ),
    started: true,
    masterId: 'P1',
    holds: [],
    borrowedFrom: null,
  };
  const hiddenId = table.seats[1].zones.hand[0];
  const projected = projectCockpit(table, multi, 'P1', 1).table.triggers;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [hiddenId],
    to: 'library',
    position: 'top',
  });
  expect(projectCockpit(table, multi, 'P1', 1).table.triggers).toEqual(projected);
  for (const seatId of ['P1', 'P2'])
    table = applyTableOperation(table, {
      type: 'token',
      id: `token-${seatId}`,
      seatId,
      name: 'Witness',
      typeLine: 'Creature',
      power: '1',
      toughness: '1',
      text: 'At the beginning of each upkeep, draw a card.',
    });
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  table = applyTableOperation(table, { type: 'phase' });
  const p1 = table.triggers!.candidates.find((c) => c.controllerId === 'P1')!;
  const p2 = table.triggers!.candidates.find((c) => c.controllerId === 'P2')!;
  expect(() =>
    applyTableOperation(table, {
      type: 'trigger.place',
      candidateId: p2.pendingTriggerId,
      id: 'p2-ability',
      targets: [],
    }),
  ).toThrow();
  table = applyTableOperation(table, {
    type: 'trigger.place',
    candidateId: p1.pendingTriggerId,
    id: 'p1-ability',
    targets: [],
  });
  table = applyTableOperation(table, {
    type: 'trigger.place',
    candidateId: p2.pendingTriggerId,
    id: 'p2-ability',
    targets: [],
  });
  expect(table.stack.map((e) => e.controllerId)).toEqual(['P2', 'P1']);
});
