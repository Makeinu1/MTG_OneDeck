// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createCockpitTable } from '../../../engine/cockpitTable';
import { objectIdOf } from '../../../engine/types';
import { makeDeck } from '../../../engine/__tests__/helpers';
import {
  applyPreparedR4bCommit,
  prepareR4bCommit,
  R4B_PROTOCOL_VERSION,
} from '../cockpitR4bSession';
import {
  appendR4bSemanticAction,
  projectR4bSemanticActions,
  semanticActionForR4bCommit,
} from '../cockpitR4bAudit';

describe('R4b Manual Event provenance', () => {
  it('carries a durable manual-event process into semantic events and pending Trigger origin', () => {
    const table = createCockpitTable(makeDeck(30), 41);
    const cardId = table.seats[0].zones.hand[0];
    const card = table.cards[cardId];
    const def = table.defs[card.defId];
    def.faces[card.faceIndex].typeLine = 'Creature';
    def.faces[card.faceIndex].oracleText = `When ${def.name} enters the battlefield, draw a card.`;
    const requestId = crypto.randomUUID();

    const prepared = prepareR4bCommit(
      table,
      undefined,
      'P1',
      {
        protocolVersion: R4B_PROTOCOL_VERSION,
        context: { kind: 'unbound' },
        declaredCause: { kind: 'manual-event' },
        operation: {
          type: 'move',
          ids: [cardId],
          to: 'battlefield',
          position: 'top',
        },
      },
      requestId,
      1,
    );
    const next = applyPreparedR4bCommit(table, prepared, requestId);

    const event = next.triggers?.events.find(
      (item) => item.type === 'zoneChange' && item.physicalCardId === cardId,
    );
    expect(event?.process).toEqual({ kind: 'manual-event', id: requestId });
    const candidate = next.triggers?.candidates.find((item) => item.status === 'pending');
    expect(candidate?.originProcess).toEqual({ kind: 'manual-event', id: requestId });
  });
});

describe('R4b semantic audit projection', () => {
  it('publishes safe cause metadata without raw operation identity', () => {
    const table = createCockpitTable(makeDeck(30), 42);
    const prepared = prepareR4bCommit(
      table,
      undefined,
      'P1',
      {
        protocolVersion: R4B_PROTOCOL_VERSION,
        context: { kind: 'unbound' },
        declaredCause: { kind: 'manual-event' },
        operation: { type: 'life', seatIds: ['P1'], delta: -1 },
      },
      crypto.randomUUID(),
      1,
    );
    const internal = semanticActionForR4bCommit(table, prepared, 'P1', 7);
    const publicView = projectR4bSemanticActions([internal], 'P2');

    expect(internal).toMatchObject({ kind: 'manual-event', actorId: 'P1', revision: 7 });
    expect(publicView).toEqual([{ kind: 'manual-event', actorId: 'P1', revision: 7 }]);
    expect(publicView[0]).not.toHaveProperty('processId');
  });

  it('keeps private Correction audit actor-scoped and bounded', () => {
    const table = createCockpitTable(makeDeck(30), 43);
    const cardId = table.seats[0].zones.hand[0];
    const prepared = prepareR4bCommit(
      table,
      undefined,
      'P1',
      {
        protocolVersion: R4B_PROTOCOL_VERSION,
        context: { kind: 'unbound' },
        declaredCause: { kind: 'correction', groupId: crypto.randomUUID() },
        operation: {
          type: 'repair.visibility',
          object: { cardId, objectId: objectIdOf(table.cards[cardId]) },
          seatIds: ['P1'],
        },
      },
      crypto.randomUUID(),
      1,
    );
    const internal = semanticActionForR4bCommit(table, prepared, 'P1', 8);

    expect(projectR4bSemanticActions([internal], 'P2')).toEqual([]);
    expect(projectR4bSemanticActions([internal], 'P1')).toEqual([
      { kind: 'correction', actorId: 'P1', revision: 8 },
    ]);

    let records = [] as typeof internal[];
    for (let revision = 1; revision <= 40; revision++)
      records = appendR4bSemanticAction(records, { ...internal, revision });
    expect(records).toHaveLength(32);
    expect(records[0].revision).toBe(9);
  });
});
