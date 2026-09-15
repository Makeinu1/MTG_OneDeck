import { describe, expect, it } from 'vitest';

import { createCockpitTable } from '../cockpitTable';
import { applyR31TableOperation } from '../cockpitR31';
import { applyR4TableOperation } from '../cockpitR4';
import { makeDeck } from './helpers';

function resolvingPermanent() {
  const table = createCockpitTable(makeDeck(30), 51);
  const cardId = table.seats[0].zones.hand[0];
  const def = table.defs[table.cards[cardId].defId];
  def.faces[0].typeLine = 'Creature';
  def.faces[0].oracleText = `When ${def.name} enters the battlefield, draw a card.`;
  const card = table.cards[cardId];
  table.seats[0].zones.hand = table.seats[0].zones.hand.filter((id) => id !== cardId);
  card.zoneChangeCounter += 1;
  card.zone = 'stack';
  card.controllerId = card.ownerId;
  card.enteredTurn = 0;
  table.seats[0].zones.stack.unshift(cardId);
  const entry = {
    id: 'permanent-entry',
    kind: 'spell' as const,
    source: structuredClone(table.cards[cardId]),
    controllerId: 'P1',
    targets: [],
    paid: [],
    text: def.faces[0].oracleText,
    stackCardId: cardId,
  };
  table.stack = [entry];
  table.resolution = structuredClone(entry);
  return { table, cardId };
}

describe('R4 resolution PermanentEntrySetup', () => {
  it('applies finite entry state before ETB is checkpointed', () => {
    const { table, cardId } = resolvingPermanent();
    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'resolution', entryId: 'permanent-entry' },
        operation: {
          type: 'resolve.end',
          entryId: 'permanent-entry',
          to: 'battlefield',
          entrySetup: { tapped: true, counters: { charge: 2 } },
        },
      },
      'resolve-permanent-entry',
    );

    expect(next.cards[cardId]).toMatchObject({
      zone: 'battlefield',
      tapped: true,
      counters: { charge: 2 },
    });
    expect(next.resolution).toBeNull();
    expect(next.stack).toHaveLength(0);
    const event = next.triggers?.events.find(
      (candidate) =>
        candidate.type === 'zoneChange' &&
        candidate.physicalCardId === cardId &&
        candidate.toZone === 'battlefield',
    );
    expect(event).toMatchObject({
      reason: 'resolve',
      after: { tapped: true, counters: { charge: 2 } },
      process: { kind: 'resolution', id: 'permanent-entry', role: 'lifecycle' },
    });
    const pending = next.triggers?.candidates.find((candidate) => candidate.sourceId === cardId);
    expect(pending?.status).toBe('pending');
    expect(pending?.source).toMatchObject({ tapped: true, counters: { charge: 2 } });
  });

  it('rejects entry setup when the resolution destination is not the battlefield', () => {
    const { table } = resolvingPermanent();
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'resolution', entryId: 'permanent-entry' },
        operation: {
          type: 'resolve.end',
          entryId: 'permanent-entry',
          to: 'graveyard',
          entrySetup: { tapped: true },
        },
      }),
    ).toThrow('INVALID_ENTRY_SETUP');
  });

  it('makes resolve.fetch ETB observe the requested tapped state atomically', () => {
    const table = createCockpitTable(makeDeck(30), 52);
    const sourceId = table.seats[0].zones.hand[0];
    const targetId = table.seats[0].zones.library[0];
    const targetDef = table.defs[table.cards[targetId].defId];
    targetDef.faces[0].typeLine = 'Basic Land — Forest';
    const sourceDef = table.defs[table.cards[sourceId].defId];
    sourceDef.faces[0].typeLine = 'Land';
    const text = 'Search your library for a land card, put it onto the battlefield tapped, then shuffle.';
    const entry = {
      id: 'fetch-entry',
      kind: 'activated' as const,
      source: structuredClone(table.cards[sourceId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text,
    };
    table.stack = [entry];

    const next = applyR31TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: {
          type: 'resolve.fetch',
          entryId: 'fetch-entry',
          cardId: targetId,
          tapped: true,
          seed: 1,
        },
      },
      'fetch-entry-resolution',
    );
    expect(next.cards[targetId]).toMatchObject({ zone: 'battlefield', tapped: true });
    const event = next.triggers?.events.find(
      (candidate) =>
        candidate.type === 'zoneChange' &&
        candidate.physicalCardId === targetId &&
        candidate.toZone === 'battlefield',
    );
    expect(event).toMatchObject({ after: { tapped: true } });
  });
});
