import { expect, it } from 'vitest';
import {
  applyTableOperation as apply,
  createCockpitTable,
  tableCleanupNeedsReview,
  tableManaResources,
  type CockpitTable,
} from '../cockpitTable';
import { makeDeck } from './helpers';
import { readyTableTriggers } from '../cockpitTriggers';

const complete = (table: CockpitTable) => {
  const seat = table.seats.find((s) => s.id === table.activeSeatId)!;
  const count =
    seat.maximumHandSize === null ? 0 : Math.max(0, seat.zones.hand.length - seat.maximumHandSize);
  return apply(table, {
    type: 'cleanup',
    seatId: seat.id,
    discardIds: seat.zones.hand.slice(0, count),
    damageIds: [],
    grantIds: [],
    modifierIds: [],
    complete: true,
    effectsReviewed: true,
  });
};
it('executes two ordinary rounds in solo, two and four seats, preserving step receipts on reload (CR 103.8a, 502, 504, 514)', () => {
  for (const players of [1, 2, 4]) {
    const deck = makeDeck(40);
    let table = createCockpitTable(
      deck,
      1,
      players === 1 ? undefined : Array.from({ length: players }, () => deck),
    );
    table.seats.forEach((seat) => {
      seat.kept = true;
    });
    const ids = table.seats
      .filter((seat) => seat.controller === 'human')
      .map((seat) => seat.zones.hand[0]);
    table = apply(table, { type: 'move', ids, to: 'battlefield', position: 'top' });
    for (let round = 0; round < players * 2; round++) {
      const id = table.activeSeatId;
      const cardId = ids.find((value) => table.cards[value].ownerId === id)!;
      if (round === 0) table = apply(table, { type: 'tap', ids: [cardId], tapped: true });
      table.seats.forEach((seat) => {
        seat.mana.G = 2;
      });
      const startHand = table.seats.find((seat) => seat.id === id)!.zones.hand.length;
      table = apply(table, { type: 'phase' });
      expect(table.phase).toBe('upkeep');
      expect(table.cards[cardId].tapped).toBe(false);
      expect(table.seats.every((seat) => seat.mana.G === 0)).toBe(true);
      table = apply(table, { type: 'phase' });
      const drawn = players === 2 && round === 0 ? 0 : 1;
      expect(table.seats.find((seat) => seat.id === id)!.zones.hand).toHaveLength(
        startHand + drawn,
      );
      table = JSON.parse(JSON.stringify(table)) as CockpitTable;
      if (table.phase === 'draw') table = apply(table, { type: 'phase' });
      expect(table.phase).toBe('main1');
      expect(table.seats.find((seat) => seat.id === id)!.zones.hand).toHaveLength(
        startHand + drawn,
      );
      table = apply(table, { type: 'tap', ids: [cardId], tapped: true });
      table.cards[cardId].damageMarked = 2;
      table.modifiers.push({
        id: `temporary-${round}`,
        cardId,
        power: 3,
        toughness: 3,
        duration: 'ターン終了まで',
        sourceId: null,
      });
      while (table.phase !== 'cleanup') table = apply(table, { type: 'phase' });
      if (tableCleanupNeedsReview(table)) table = complete(table);
      expect(table.cards[cardId].damageMarked).toBe(0);
      expect(table.modifiers).toHaveLength(0);
      table = apply(table, { type: 'phase' });
      expect(table.turn).toBe(round + 2);
      expect(table.phase).toBe('untap');
    }
  }
});
it('halts and resumes upkeep, enforces cleanup choice/repetition, and never reinterprets old turn history', () => {
  let table = createCockpitTable(makeDeck(40), 2);
  table.seats[0].kept = true;
  const id = table.seats[0].zones.hand[0];
  table.defs[table.cards[id].defId].faces[0].oracleText =
    'At the beginning of your upkeep, draw a card.';
  table = apply(table, { type: 'move', ids: [id], to: 'battlefield', position: 'top' });
  const before = table.seats[0].zones.hand.length;
  table = apply(table, { type: 'shortcut' });
  expect(table.phase).toBe('upkeep');
  expect(table.seats[0].zones.hand).toHaveLength(before);
  expect(() => apply(table, { type: 'phase' })).toThrow();
  table = apply(table, {
    type: 'trigger.place',
    candidateId: readyTableTriggers(table)[0].pendingTriggerId,
    id: 'upkeep-ability',
    targets: [],
  });
  table = apply(table, { type: 'resolve.begin' });
  table = apply(table, { type: 'draw', seatId: 'P1', count: 1 });
  table = apply(table, { type: 'resolve.end', to: 'graveyard' });
  table = apply(JSON.parse(JSON.stringify(table)) as CockpitTable, { type: 'shortcut' });
  expect(table.phase).toBe('main1');
  expect(table.seats[0].zones.hand).toHaveLength(before + 2);
  expect(() => apply(table, { type: 'shortcut' })).toThrow();
  table.modifiers.push({
    id: 'unknown',
    cardId: id,
    power: 1,
    toughness: 1,
    duration: '由来の条件が終了するまで',
    sourceId: null,
  });
  while (table.phase !== 'cleanup') table = apply(table, { type: 'phase' });
  expect(table.cleanupReady).toBe(false);
  const saved = structuredClone(table);
  expect(() => apply(table, { type: 'turn' })).toThrow();
  expect(() =>
    apply(table, {
      type: 'cleanup',
      seatId: 'P1',
      discardIds: [],
      damageIds: [],
      modifierIds: [],
      grantIds: [],
      complete: true,
    }),
  ).toThrow();
  expect(table).toEqual(saved);
  table = complete(table);
  expect(table.cleanupReady).toBe(true);
  expect(table.modifiers[0].id).toBe('unknown');
  table = apply(table, { type: 'draw', seatId: 'P1', count: 1 });
  expect(table.cleanupReady).toBe(false);
  expect(() => apply(table, { type: 'turn' })).toThrow();
  table = complete(table);
  table = apply(table, { type: 'phase' });
  expect(table.phase).toBe('untap');
  const four = createCockpitTable(
    makeDeck(20),
    1,
    Array.from({ length: 4 }, () => makeDeck(20)),
  );
  const manaCreature = four.seats[0].zones.hand[0];
  four.cards[manaCreature].zone = 'battlefield';
  four.seats[0].zones.battlefield.push(manaCreature);
  four.seats[0].zones.hand = four.seats[0].zones.hand.filter((card) => card !== manaCreature);
  four.cards[manaCreature].enteredTurn = 1;
  four.activeSeatId = 'P4';
  four.turn = 4;
  expect(tableManaResources(four, 'P1').unavailableSourceIds).toContain(manaCreature);
  four.seats[1].eliminated = true;
  expect(tableManaResources(four, 'P1').unavailableSourceIds).toContain(manaCreature);
  delete four.seats[0].turnStartedAt;
  expect(tableManaResources(four, 'P1').unavailableSourceIds).toContain(manaCreature);
});
