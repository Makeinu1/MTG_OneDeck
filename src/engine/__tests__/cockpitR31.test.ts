import { describe, expect, it } from 'vitest';

import { createCockpitTable } from '../cockpitTable';
import {
  applyR31TableOperation,
  captureExpectedInteractionContext,
  validateManualZoneMeaning,
} from '../cockpitR31';
import { makeDeck } from './helpers';

function withStackEntry(id = 'A') {
  const table = createCockpitTable(makeDeck(30), 1);
  const sourceId = table.seats[0].zones.hand[0];
  table.stack = [
    {
      id,
      kind: 'triggered',
      source: structuredClone(table.cards[sourceId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Test ability',
    },
  ];
  return table;
}

describe('R3.1 interaction identity substrate', () => {
  it('binds resolve begin/end to the exact stack entry and rejects stale context', () => {
    const table = withStackEntry('A');
    const resolving = applyR31TableOperation(table, {
      context: captureExpectedInteractionContext(table),
      operation: { type: 'resolve.begin', entryId: 'A' },
    });

    expect(resolving.resolution?.id).toBe('A');
    expect(captureExpectedInteractionContext(resolving)).toEqual({
      kind: 'resolution',
      entryId: 'A',
    });

    expect(() =>
      applyR31TableOperation(resolving, {
        context: { kind: 'resolution', entryId: 'B' },
        operation: { type: 'resolve.end', entryId: 'B', to: 'graveyard' },
      }),
    ).toThrow('STALE_INTERACTION_CONTEXT');

    const done = applyR31TableOperation(resolving, {
      context: { kind: 'resolution', entryId: 'A' },
      operation: { type: 'resolve.end', entryId: 'A', to: 'graveyard' },
    });
    expect(done.resolution).toBeNull();
    expect(done.stack).toHaveLength(0);
  });

  it('does not bind an old unbound gesture to a resolution that started later', () => {
    const table = withStackEntry('A');
    const oldContext = captureExpectedInteractionContext(table);
    const resolving = applyR31TableOperation(table, {
      context: oldContext,
      operation: { type: 'resolve.begin', entryId: 'A' },
    });

    expect(() =>
      applyR31TableOperation(resolving, {
        context: oldContext,
        operation: { type: 'life', seatIds: ['P1'], delta: 1 },
      }),
    ).toThrow('STALE_INTERACTION_CONTEXT');
  });

  it('keeps manual zone meaning finite and structurally compatible with the source zone', () => {
    const table = createCockpitTable(makeDeck(30), 1);
    const handId = table.seats[0].zones.hand[0];

    expect(validateManualZoneMeaning(table, [handId], 'discard')).toBe('discard');
    expect(() => validateManualZoneMeaning(table, [handId], 'sacrifice')).toThrow(
      'INVALID_ZONE_MEANING',
    );
    expect(validateManualZoneMeaning(table, [handId], 'move')).toBe('move');
  });

  it('persists resolution process provenance on events and explicit zone meaning', () => {
    const table = withStackEntry('A');
    const resolving = applyR31TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: { type: 'resolve.begin', entryId: 'A' },
      },
      'begin-A',
    );
    const handId = resolving.seats[0].zones.hand[1];
    const next = applyR31TableOperation(
      resolving,
      {
        context: { kind: 'resolution', entryId: 'A' },
        operation: {
          type: 'move',
          ids: [handId],
          to: 'graveyard',
          position: 'top',
          reason: 'discard',
        },
      },
      'discard-A',
    );
    const event = next.triggers?.events.find(
      (item) => item.type === 'zoneChange' && item.physicalCardId === handId,
    );
    expect(event).toMatchObject({
      type: 'zoneChange',
      reason: 'discard',
      process: { kind: 'resolution', id: 'A', role: 'effect' },
    });
  });

  it('snapshots the originating resolution on pending trigger candidates', () => {
    const table = withStackEntry('A');
    const enteringId = table.seats[0].zones.hand[1];
    const enteringDef = table.defs[table.cards[enteringId].defId];
    enteringDef.faces[0].oracleText = 'When ' + enteringDef.name + ' enters the battlefield, draw a card.';
    const resolving = applyR31TableOperation(table, {
      context: { kind: 'unbound' },
      operation: { type: 'resolve.begin', entryId: 'A' },
    });
    const next = applyR31TableOperation(resolving, {
      context: { kind: 'resolution', entryId: 'A' },
      operation: { type: 'move', ids: [enteringId], to: 'battlefield', position: 'top' },
    });
    const candidate = next.triggers?.candidates.find((item) => item.status === 'pending');
    expect(candidate?.originProcess).toMatchObject({
      kind: 'resolution',
      id: 'A',
    });
  });
});
