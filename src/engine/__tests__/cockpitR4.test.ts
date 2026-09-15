import { describe, expect, it } from 'vitest';

import { createCockpitTable, type CockpitTable } from '../cockpitTable';
import {
  applyR4TableOperation,
  emptyR4CastAdditionalCosts,
  r4CastAdditionalCostPlan,
  validatePermanentEntrySetup,
} from '../cockpitR4';
import type { ZoneId } from '../types';
import { makeDeck } from './helpers';

function relocate(table: CockpitTable, cardId: string, to: ZoneId): void {
  const card = table.cards[cardId];
  for (const seat of table.seats)
    for (const zone of Object.keys(seat.zones) as ZoneId[])
      seat.zones[zone] = seat.zones[zone].filter((id) => id !== cardId);
  card.zoneChangeCounter += 1;
  card.zone = to;
  card.controllerId = card.ownerId;
  table.seats.find((seat) => seat.id === card.ownerId)!.zones[to].unshift(cardId);
}

function makeSpell(table: CockpitTable, cardId: string, typeLine = 'Instant'): void {
  const card = table.cards[cardId];
  const face = table.defs[card.defId].faces[card.faceIndex];
  face.typeLine = typeLine;
  face.manaCost = '{0}';
  face.oracleText = 'Test spell.';
}

function landTable() {
  const table = createCockpitTable(makeDeck(30), 1);
  table.phase = 'main1';
  const landId = table.seats[0].zones.hand[0];
  const card = table.cards[landId];
  const def = table.defs[card.defId];
  def.faces[card.faceIndex].typeLine = 'Basic Land — Forest';
  def.faces[card.faceIndex].oracleText = `When ${def.name} enters the battlefield, draw a card.`;
  return { table, landId };
}

describe('R4 formal playLand and permanent entry setup', () => {
  it('plays a hand land as one formal action and checkpoints ETB after finite entry setup', () => {
    const { table, landId } = landTable();
    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: {
          type: 'playLand',
          cardId: landId,
          entrySetup: {
            tapped: true,
            counters: { charge: 2 },
          },
        },
      },
      'play-land-1',
    );

    expect(next.cards[landId]).toMatchObject({
      zone: 'battlefield',
      tapped: true,
      counters: { charge: 2 },
      controllerId: 'P1',
      enteredTurn: next.turn,
    });
    expect(next.seats[0].zones.hand).not.toContain(landId);
    expect(next.seats[0].zones.battlefield).toContain(landId);

    const event = next.triggers?.events.find(
      (item) => item.type === 'zoneChange' && item.physicalCardId === landId,
    );
    expect(event).toMatchObject({
      type: 'zoneChange',
      reason: 'move',
      process: {
        kind: 'action',
        id: 'play-land-1',
        actionType: 'other-formal',
        role: 'action',
      },
      after: {
        zone: 'battlefield',
        tapped: true,
        counters: { charge: 2 },
      },
    });
    expect(next.triggers?.candidates.some((candidate) => candidate.status === 'pending')).toBe(true);
  });

  it('enforces the finite formal land-play gate without adjudicating land-play count', () => {
    const { table, landId } = landTable();

    const wrongPhase = structuredClone(table);
    wrongPhase.phase = 'upkeep';
    expect(() =>
      applyR4TableOperation(wrongPhase, {
        context: { kind: 'unbound' },
        operation: { type: 'playLand', cardId: landId },
      }),
    ).toThrow('自分のメイン・フェイズ');

    const occupiedStack = structuredClone(table);
    occupiedStack.stack = [
      {
        id: 'A',
        kind: 'triggered',
        source: structuredClone(occupiedStack.cards[landId]),
        controllerId: 'P1',
        targets: [],
        paid: [],
        text: 'test',
      },
    ];
    expect(() =>
      applyR4TableOperation(occupiedStack, {
        context: { kind: 'unbound' },
        operation: { type: 'playLand', cardId: landId },
      }),
    ).toThrow('Stackが空');

    const nonLand = structuredClone(table);
    nonLand.defs[nonLand.cards[landId].defId].faces[0].typeLine = 'Creature';
    expect(() =>
      applyR4TableOperation(nonLand, {
        context: { kind: 'unbound' },
        operation: { type: 'playLand', cardId: landId },
      }),
    ).toThrow('土地カード');
  });

  it('keeps entry setup finite and validates references before the zone change', () => {
    const { table, landId } = landTable();
    const otherHandId = table.seats[0].zones.hand[1];

    expect(() =>
      validatePermanentEntrySetup(table, landId, { counters: { charge: -1 } }),
    ).toThrow('INVALID_ENTRY_SETUP');
    expect(() =>
      validatePermanentEntrySetup(table, landId, { attachmentTargetId: otherHandId }),
    ).toThrow('INVALID_ENTRY_SETUP');
    expect(() =>
      validatePermanentEntrySetup(table, landId, { controllerId: 'missing-seat' }),
    ).toThrow('INVALID_ENTRY_SETUP');
  });

  it('rejects stale resolution context rather than rebinding the gesture', () => {
    const { table, landId } = landTable();
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'resolution', entryId: 'old-resolution' },
        operation: { type: 'playLand', cardId: landId },
      }),
    ).toThrow('STALE_INTERACTION_CONTEXT');
  });
});

describe('R4 formal unusual-zone cast and atomic additional costs', () => {
  it('casts directly from a finite unusual source zone and preserves the true origin', () => {
    const table = createCockpitTable(makeDeck(30), 2);
    const cardId = table.seats[0].zones.hand[0];
    makeSpell(table, cardId);
    relocate(table, cardId, 'graveyard');

    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: {
          type: 'cast',
          cardId,
          sourceZone: 'graveyard',
          targets: [],
          x: 0,
          paymentPlan: [],
        },
      },
      'cast-from-graveyard',
    );

    expect(next.cards[cardId].zone).toBe('stack');
    expect(next.stack[0]).toMatchObject({
      kind: 'spell',
      controllerId: 'P1',
      source: { id: cardId, zone: 'graveyard' },
    });
    const castEvent = next.triggers?.events.find(
      (event) => event.type === 'zoneChange' && event.physicalCardId === cardId,
    );
    expect(castEvent).toMatchObject({
      type: 'zoneChange',
      fromZone: 'graveyard',
      toZone: 'stack',
      reason: 'cast',
      process: {
        kind: 'action',
        id: 'cast-from-graveyard',
        actionType: 'cast',
        role: 'action',
      },
    });
  });

  it('pays discard and sacrifice additional costs in the same cast boundary with cost provenance', () => {
    const table = createCockpitTable(makeDeck(30), 3);
    const [castId, discardId, sacrificeId] = table.seats[0].zones.hand.slice(0, 3);
    makeSpell(table, castId);
    relocate(table, sacrificeId, 'battlefield');
    const additionalCosts = {
      ...emptyR4CastAdditionalCosts(),
      discardIds: [discardId],
      sacrificeIds: [sacrificeId],
      note: 'Discard one card and sacrifice one permanent.',
    };
    const plan = r4CastAdditionalCostPlan(table, castId, additionalCosts);
    expect(plan.map((command) => command.type)).toEqual(['moveCard', 'moveCard']);

    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: {
          type: 'cast',
          cardId: castId,
          sourceZone: 'hand',
          targets: [],
          x: 0,
          paymentPlan: [],
          additionalCosts,
        },
      },
      'cast-with-costs',
    );

    expect(next.cards[castId].zone).toBe('stack');
    expect(next.cards[discardId].zone).toBe('graveyard');
    expect(next.cards[sacrificeId].zone).toBe('graveyard');
    expect(next.stack[0].paid).toHaveLength(2);
    expect(next.stack[0].costNote).toContain('追加コスト');

    const discard = next.triggers?.events.find(
      (event) => event.type === 'zoneChange' && event.physicalCardId === discardId,
    );
    const sacrifice = next.triggers?.events.find(
      (event) => event.type === 'zoneChange' && event.physicalCardId === sacrificeId,
    );
    const cast = next.triggers?.events.find(
      (event) => event.type === 'zoneChange' && event.physicalCardId === castId,
    );
    expect(discard).toMatchObject({
      reason: 'discard',
      process: { kind: 'action', id: 'cast-with-costs', actionType: 'cast', role: 'cost' },
    });
    expect(sacrifice).toMatchObject({
      reason: 'sacrifice',
      process: { kind: 'action', id: 'cast-with-costs', actionType: 'cast', role: 'cost' },
    });
    expect(cast).toMatchObject({
      reason: 'cast',
      process: { kind: 'action', id: 'cast-with-costs', actionType: 'cast', role: 'action' },
    });
  });

  it('keeps a nested unusual-zone cast attached to the active resolution', () => {
    const table = createCockpitTable(makeDeck(30), 4);
    const resolvingId = table.seats[0].zones.hand[0];
    const castId = table.seats[0].zones.hand[1];
    makeSpell(table, castId);
    relocate(table, castId, 'exile');
    table.resolution = {
      id: 'resolution-A',
      kind: 'triggered',
      source: structuredClone(table.cards[resolvingId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'You may cast the exiled card.',
    };

    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'resolution', entryId: 'resolution-A' },
        operation: {
          type: 'cast',
          cardId: castId,
          sourceZone: 'exile',
          targets: [],
          x: 0,
          paymentPlan: [],
        },
      },
      'nested-cast',
    );

    expect(next.resolution?.id).toBe('resolution-A');
    const event = next.triggers?.events.find(
      (item) => item.type === 'zoneChange' && item.physicalCardId === castId,
    );
    expect(event).toMatchObject({
      process: {
        kind: 'action',
        id: 'nested-cast',
        actionType: 'cast',
        role: 'action',
        parentResolutionId: 'resolution-A',
      },
    });
  });

  it('rejects stale source assertions and using the spell itself as an additional cost', () => {
    const table = createCockpitTable(makeDeck(30), 5);
    const cardId = table.seats[0].zones.hand[0];
    makeSpell(table, cardId);
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'unbound' },
        operation: {
          type: 'cast',
          cardId,
          sourceZone: 'graveyard',
          targets: [],
          x: 0,
          paymentPlan: [],
        },
      }),
    ).toThrow('INVALID_CAST_SOURCE');

    expect(() =>
      r4CastAdditionalCostPlan(table, cardId, {
        ...emptyR4CastAdditionalCosts(),
        discardIds: [cardId],
      }),
    ).toThrow('INVALID_ADDITIONAL_COST');
  });
});

describe('R4 finite special actions', () => {
  it('turns a face-down battlefield object face up without creating a Stack item', () => {
    const table = createCockpitTable(makeDeck(30), 6);
    const cardId = table.seats[0].zones.hand[0];
    relocate(table, cardId, 'battlefield');
    table.cards[cardId].faceDown = true;

    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: { type: 'special.turnFaceUp', cardId, faceIndex: 0 },
      },
      'turn-face-up',
    );

    expect(next.cards[cardId].faceDown).toBe(false);
    expect(next.stack).toHaveLength(0);
  });
});
