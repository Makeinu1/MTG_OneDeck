import { describe, expect, it } from 'vitest';

import { createCockpitTable } from '../cockpitTable';
import { applyR4TableOperation, validatePermanentEntrySetup } from '../cockpitR4';
import { makeDeck } from './helpers';

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
