// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

import { makeDeck } from '../../../engine/__tests__/helpers';
import type { CockpitTable } from '../../../engine/cockpitTable';
import type { ZoneId } from '../../../engine/types';
import { handleCockpitSession, type CockpitSessionView } from '../cockpitSession';
import type { OnlineCloudflareSqlStorage } from '../types';

function database(): OnlineCloudflareSqlStorage {
  const db = new DatabaseSync(':memory:');
  return {
    sql: {
      exec(query, ...bindings) {
        const statement = db.prepare(query);
        const args = bindings as (string | number | null)[];
        if (/^SELECT/.test(query)) return { toArray: () => statement.all(...args) as never[] };
        statement.run(...args);
        return { toArray: () => [] };
      },
    },
    transactionSync(callback) {
      db.exec('BEGIN');
      try {
        const result = callback();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}


const R4B_MANUAL_EVENT_TYPES = new Set(['move', 'draw', 'tap', 'life', 'counter']);
function r4bTestRequestBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const value = body as Record<string, unknown>;
  if (value.type !== 'commit') return body;
  const operation = value.operation as { type?: string; sourceId?: string } | undefined;
  const history = operation?.type === 'undo' || operation?.type === 'redo';
  const manualEvent =
    Boolean(operation?.type && R4B_MANUAL_EVENT_TYPES.has(operation.type)) ||
    (operation?.type === 'damage' && typeof operation.sourceId === 'string');
  return {
    ...value,
    protocolVersion: 2,
    ...(!history && !(value.context === undefined && operation?.type === 'resolve.end')
      ? { context: value.context ?? { kind: 'unbound' } }
      : {}),
    ...(manualEvent && value.declaredCause === undefined
      ? { declaredCause: { kind: 'manual-event' } }
      : {}),
  };
}

function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/r4-entry-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(r4bTestRequestBody(body)),
  });
}

type ErrorView = CockpitSessionView & { error?: string };

describe('R4 resolution entry setup server boundary', () => {
  it('requires the exact Resolution context and commits setup atomically', async () => {
    const storage = database();
    const token = '9'.repeat(64);
    let view = (await (
      await handleCockpitSession(
        request({ type: 'create', token, deck: makeDeck(30), seed: 61 }),
        storage,
        1000,
      )
    ).json()) as CockpitSessionView;
    const row = storage.sql.exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1').toArray()[0];
    const record = JSON.parse(row.data) as { table: CockpitTable };
    const cardId = record.table.seats[0].zones.hand[0];
    const card = record.table.cards[cardId];
    record.table.defs[card.defId].faces[0].typeLine = 'Creature';
    for (const seat of record.table.seats)
      for (const zone of Object.keys(seat.zones) as ZoneId[])
        seat.zones[zone] = seat.zones[zone].filter((id) => id !== cardId);
    card.zone = 'stack';
    card.zoneChangeCounter += 1;
    record.table.seats[0].zones.stack.unshift(cardId);
    const entry = {
      id: 'entry-resolution-1',
      kind: 'spell' as const,
      source: structuredClone(card),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Manual permanent resolution.',
      stackCardId: cardId,
    };
    record.table.stack = [entry];
    record.table.resolution = structuredClone(entry);
    storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));

    const operation = {
      type: 'resolve.end',
      entryId: entry.id,
      to: 'battlefield',
      entrySetup: { tapped: true, counters: { charge: 2 } },
    };
    const commit = async (context?: { kind: 'resolution'; entryId: string }) => {
      const response = await handleCockpitSession(
        request({
          type: 'commit',
          token,
          requestId: crypto.randomUUID(),
          revision: view.revision,
          operation,
          ...(context ? { context } : {}),
        }),
        storage,
        2000,
      );
      const value = (await response.json()) as ErrorView;
      if (response.ok) view = value;
      return { response, value };
    };

    const missing = await commit();
    expect(missing.response.status).toBe(400);
    expect(missing.value.error).toBe('INVALID_REQUEST');
    const saved = await commit({ kind: 'resolution', entryId: entry.id });
    expect(saved.response.status).toBe(200);
    expect(saved.value.table.cards[cardId]).toMatchObject({
      zone: 'battlefield',
      tapped: true,
      counters: { charge: 2 },
    });
    expect(saved.value.table.resolution).toBeNull();
  });
});
