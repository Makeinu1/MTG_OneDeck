import { describe, expect, it } from 'vitest';

import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { applyR4TableOperation } from '../cockpitR4';
import { makeDeck } from './helpers';

function onBattlefield(count = 2) {
  let table = createCockpitTable(makeDeck(30), 31);
  const ids = table.seats[0].zones.hand.slice(0, count);
  table = applyTableOperation(table, {
    type: 'move',
    ids,
    to: 'battlefield',
    position: 'top',
  });
  return { table, ids };
}

describe('R4 human-confirmed state actions', () => {
  it('moves confirmed battlefield objects in one SBA checkpoint with system provenance', () => {
    const { table, ids } = onBattlefield(2);
    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: { type: 'state.apply', graveyardIds: ids },
      },
      'state-confirmed-1',
    );

    for (const id of ids) expect(next.cards[id].zone).toBe('graveyard');
    const events = next.triggers!.events.filter(
      (event) =>
        event.type === 'zoneChange' &&
        event.reason === 'sba' &&
        ids.includes(event.physicalCardId),
    );
    expect(events).toHaveLength(2);
    expect(new Set(events.map((event) => event.simultaneousGroupId))).toHaveLength(1);
    for (const event of events)
      expect(event).toMatchObject({
        type: 'zoneChange',
        reason: 'sba',
        process: { kind: 'system', id: 'state-confirmed-1' },
      });
  });

  it('rejects tokens and active Resolution instead of becoming a generic state batch', () => {
    const { table, ids } = onBattlefield(1);
    table.cards[ids[0]].isToken = true;
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'unbound' },
        operation: { type: 'state.apply', graveyardIds: ids },
      }),
    ).toThrow('INVALID_STATE_ACTION');

    table.cards[ids[0]].isToken = false;
    table.resolution = {
      id: 'A',
      kind: 'triggered',
      source: structuredClone(table.cards[ids[0]]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Resolve A',
    };
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'unbound' },
        operation: { type: 'state.apply', graveyardIds: ids },
      }),
    ).toThrow('STALE_INTERACTION_CONTEXT');
  });
});
