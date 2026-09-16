import { describe, expect, it } from 'vitest';

import { createCockpitTable, type CockpitTable } from '../cockpitTable';
import {
  applyR4bRepair,
  classifyR4bOperation,
  r4bRepairCreatesKnowledgeBarrier,
  resolveR4bCause,
  type R4bObjectRef,
} from '../cockpitR4b';
import { objectIdOf, type ZoneId } from '../types';
import { makeDeck } from './helpers';

function objectRef(table: CockpitTable, cardId: string): R4bObjectRef {
  return { cardId, objectId: objectIdOf(table.cards[cardId]) };
}

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

function bindResolution(table: CockpitTable, id = 'A'): void {
  const sourceId = table.seats[0].zones.hand[0];
  table.resolution = {
    id,
    kind: 'triggered',
    source: structuredClone(table.cards[sourceId]),
    controllerId: 'P1',
    targets: [],
    paid: [],
    text: 'test',
  };
}

describe('R4b exhaustive gate classification', () => {
  it('separates formal, effect, repair and retired operation families', () => {
    expect(classifyR4bOperation({ type: 'copyStack', entryId: 'A', id: 'B', controllerId: 'P1', targets: [] }))
      .toEqual({ kind: 'formal', family: 'stack-effect' });
    expect(classifyR4bOperation({ type: 'life', seatIds: ['P1'], delta: -1 }))
      .toEqual({ kind: 'effect', manualEventCapable: true });
    expect(classifyR4bOperation({ type: 'shuffle', seatId: 'P1', seed: 1 }))
      .toEqual({ kind: 'effect', manualEventCapable: false });
    expect(classifyR4bOperation({ type: 'visibility', ids: ['c1'], seatIds: ['P1'] }))
      .toEqual({ kind: 'effect', manualEventCapable: false });
    expect(classifyR4bOperation({ type: 'repair.lifeTotal', seatId: 'P1', value: 17 }))
      .toEqual({ kind: 'repair' });
    expect(
      classifyR4bOperation({ type: 'commander.moveToCommand', cardId: 'c1', objectId: 'c1:0' }),
    ).toEqual({ kind: 'formal', family: 'action' });
  });
});

describe('R4b cause resolution', () => {
  it('requires an explicit Manual Event for unbound gameplay mutation', () => {
    const table = createCockpitTable(makeDeck(30), 1);
    const request = {
      context: { kind: 'unbound' as const },
      operation: { type: 'life' as const, seatIds: ['P1'], delta: -1 },
    };
    expect(() => resolveR4bCause(table, request, 'request-00000001')).toThrow(
      'R4B_MANUAL_EVENT_REQUIRED',
    );
    expect(
      resolveR4bCause(
        table,
        { ...request, declaredCause: { kind: 'manual-event' } },
        'request-00000001',
      ),
    ).toEqual({ kind: 'manual-event', processId: 'request-00000001' });
  });

  it('does not let Manual Event unlock a non-allowlisted effect', () => {
    const table = createCockpitTable(makeDeck(30), 2);
    expect(() =>
      resolveR4bCause(
        table,
        {
          context: { kind: 'unbound' },
          operation: { type: 'shuffle', seatId: 'P1', seed: 1 },
          declaredCause: { kind: 'manual-event' },
        },
        'request-00000002',
      ),
    ).toThrow('R4B_MANUAL_EVENT_REQUIRED');
  });

  it('binds effect mutation to the exact active Resolution', () => {
    const table = createCockpitTable(makeDeck(30), 3);
    bindResolution(table, 'A');
    expect(
      resolveR4bCause(
        table,
        {
          context: { kind: 'resolution', entryId: 'A' },
          operation: { type: 'shuffle', seatId: 'P1', seed: 2 },
        },
        'request-00000003',
      ),
    ).toEqual({ kind: 'resolution', entryId: 'A' });
    expect(() =>
      resolveR4bCause(
        table,
        {
          context: { kind: 'resolution', entryId: 'old' },
          operation: { type: 'shuffle', seatId: 'P1', seed: 2 },
        },
        'request-00000004',
      ),
    ).toThrow('STALE_INTERACTION_CONTEXT');
  });

  it('requires a Correction cause for repair primitives', () => {
    const table = createCockpitTable(makeDeck(30), 4);
    const request = {
      context: { kind: 'unbound' as const },
      operation: { type: 'repair.lifeTotal' as const, seatId: 'P1', value: 17 },
    };
    expect(() => resolveR4bCause(table, request, 'request-00000005')).toThrow(
      'R4B_CORRECTION_REQUIRED',
    );
    expect(
      resolveR4bCause(
        table,
        {
          ...request,
          declaredCause: { kind: 'correction', groupId: 'correction-000001' },
        },
        'request-00000005',
      ),
    ).toEqual({ kind: 'correction', groupId: 'correction-000001' });
  });
});

describe('R4b correction-safe repairs', () => {
  it('repairs scalar state without creating gameplay events or trigger candidates', () => {
    const table = createCockpitTable(makeDeck(30), 5);
    const cardId = table.seats[0].zones.hand[0];
    relocate(table, cardId, 'battlefield');
    const triggerBefore = structuredClone(table.triggers);

    let next = applyR4bRepair(table, { type: 'repair.lifeTotal', seatId: 'P1', value: 17 });
    next = applyR4bRepair(next, {
      type: 'repair.counterCount',
      target: { kind: 'card', object: objectRef(next, cardId) },
      name: '+1/+1',
      value: 2,
    });
    next = applyR4bRepair(next, {
      type: 'repair.tapState',
      objects: [{ object: objectRef(next, cardId), value: true }],
    });

    expect(next.seats[0].life).toBe(17);
    expect(next.cards[cardId].counters['+1/+1']).toBe(2);
    expect(next.cards[cardId].tapped).toBe(true);
    expect(next.triggers).toEqual(triggerBefore);
  });

  it('repairs a physical location atomically with finite final battlefield state', () => {
    const table = createCockpitTable(makeDeck(30), 6);
    const cardId = table.seats[0].zones.hand[0];
    const beforeObject = objectRef(table, cardId);
    const beforeCounter = table.cards[cardId].zoneChangeCounter;
    const triggerBefore = structuredClone(table.triggers);

    const next = applyR4bRepair(table, {
      type: 'repair.location',
      objects: [
        {
          ...beforeObject,
          stateAfter: {
            tapped: true,
            counters: { charge: 2 },
            controllerId: 'P1',
          },
        },
      ],
      to: 'battlefield',
      position: 'top',
    });

    expect(next.cards[cardId]).toMatchObject({
      zone: 'battlefield',
      tapped: true,
      counters: { charge: 2 },
      controllerId: 'P1',
      zoneChangeCounter: beforeCounter + 1,
    });
    expect(next.triggers).toEqual(triggerBefore);
    expect(() =>
      applyR4bRepair(next, {
        type: 'repair.location',
        objects: [beforeObject],
        to: 'graveyard',
        position: 'top',
      }),
    ).toThrow('STALE_R4B_OBJECT');
  });

  it('treats disclosure repair as a knowledge barrier even without a gameplay event', () => {
    const table = createCockpitTable(makeDeck(30), 7);
    const cardId = table.seats[0].zones.hand[0];
    const operation = {
      type: 'repair.visibility' as const,
      object: objectRef(table, cardId),
      seatIds: ['P1'],
    };
    expect(r4bRepairCreatesKnowledgeBarrier(table, operation)).toBe(true);
    const next = applyR4bRepair(table, operation);
    expect(next.visibility[cardId]).toEqual(['P1']);
    expect(next.triggers).toEqual(table.triggers);
  });
});
