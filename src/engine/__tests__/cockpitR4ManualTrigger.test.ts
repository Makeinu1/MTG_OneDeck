import { describe, expect, it } from 'vitest';

import { createCockpitTable } from '../cockpitTable';
import { applyR4TableOperation } from '../cockpitR4';
import { makeDeck } from './helpers';

function resolvingTable() {
  const table = createCockpitTable(makeDeck(30), 7);
  const resolutionSourceId = table.seats[0].zones.hand[0];
  const manualSourceId = table.seats[0].zones.hand[1];
  const manualSource = table.cards[manualSourceId];
  table.seats[0].zones.hand = table.seats[0].zones.hand.filter((id) => id !== manualSourceId);
  manualSource.zone = 'battlefield';
  manualSource.zoneChangeCounter += 1;
  manualSource.enteredTurn = table.turn;
  table.seats[0].zones.battlefield.unshift(manualSourceId);
  table.stack = [
    {
      id: 'A',
      kind: 'triggered',
      source: structuredClone(table.cards[resolutionSourceId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Resolve A',
    },
  ];
  return { table, manualSourceId };
}

describe('R4 manual Trigger lifecycle', () => {
  it('adds a public manual trigger as Pending without stealing the current Resolution', () => {
    const { table, manualSourceId } = resolvingTable();
    const resolving = applyR4TableOperation(table, {
      context: { kind: 'unbound' },
      operation: { type: 'resolve.begin', entryId: 'A' },
    });
    const pending = applyR4TableOperation(resolving, {
      context: { kind: 'resolution', entryId: 'A' },
      operation: {
        type: 'trigger.manualAdd',
        id: 'manual-trigger-1',
        sourceId: manualSourceId,
        text: 'When this event occurs, draw a card.',
      },
    });

    expect(pending.resolution?.id).toBe('A');
    expect(pending.stack.map((entry) => entry.id)).toEqual(['A']);
    expect(pending.triggers?.candidates).toContainEqual(
      expect.objectContaining({
        pendingTriggerId: 'manual-trigger-1',
        triggerId: 'manual',
        sourceId: manualSourceId,
        controllerId: 'P1',
        status: 'pending',
        requiresManualRuling: true,
        originProcess: { kind: 'resolution', id: 'A' },
      }),
    );

    const finished = applyR4TableOperation(pending, {
      context: { kind: 'resolution', entryId: 'A' },
      operation: { type: 'resolve.end', entryId: 'A', to: 'graveyard' },
    });
    const placed = applyR4TableOperation(finished, {
      context: { kind: 'unbound' },
      operation: {
        type: 'trigger.place',
        candidateId: 'manual-trigger-1',
        id: 'manual-stack-1',
        targets: [],
      },
    });
    expect(placed.stack[0]).toMatchObject({
      id: 'manual-stack-1',
      kind: 'triggered',
      controllerId: 'P1',
    });
  });

  it('rejects hidden-source manual trigger creation', () => {
    const table = createCockpitTable(makeDeck(30), 8);
    const hiddenId = table.seats[0].zones.hand[0];
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'unbound' },
        operation: {
          type: 'trigger.manualAdd',
          id: 'manual-hidden',
          sourceId: hiddenId,
          text: 'Hidden trigger',
        },
      }),
    ).toThrow('INVALID_MANUAL_TRIGGER_SOURCE');
  });
});
