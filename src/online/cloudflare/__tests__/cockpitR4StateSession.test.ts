// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

import { makeDeck } from '../../../engine/__tests__/helpers';
import type { CockpitTable } from '../../../engine/cockpitTable';
import type { ZoneId } from '../../../engine/types';
import { handleCockpitSession, type CockpitSessionView } from '../cockpitSession';
import { r4OperationCreatesKnowledgeBarrier } from '../cockpitR4Authority';
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

function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/r4-state-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type ErrorView = CockpitSessionView & { error?: string };

describe('R4 state.apply server boundary', () => {
  it('requires context and makes face-down state transitions a knowledge barrier', async () => {
    const storage = database();
    const token = '7'.repeat(64);
    let view = (await (
      await handleCockpitSession(
        request({ type: 'create', token, deck: makeDeck(30), seed: 13 }),
        storage,
        1000,
      )
    ).json()) as CockpitSessionView;
    let seq = 0;
    const commit = async (operation: Record<string, unknown>, context?: { kind: 'unbound' }) => {
      const response = await handleCockpitSession(
        request({
          type: 'commit',
          token,
          requestId: `state-operation-${++seq}`,
          revision: view.revision,
          operation,
          ...(context ? { context } : {}),
        }),
        storage,
        2000 + seq,
      );
      const value = (await response.json()) as ErrorView;
      if (response.ok) view = value;
      return { response, value };
    };

    expect((await commit({ type: 'keep', seatId: 'P1' })).response.status).toBe(200);
    expect((await commit({ type: 'turn.ready' })).response.status).toBe(200);

    const row = storage.sql.exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1').toArray()[0];
    const record = JSON.parse(row.data) as { table: CockpitTable; knowledgeEpoch?: number };
    const cardId = record.table.seats[0].zones.hand[0];
    for (const seat of record.table.seats)
      for (const zone of Object.keys(seat.zones) as ZoneId[])
        seat.zones[zone] = seat.zones[zone].filter((id) => id !== cardId);
    const card = record.table.cards[cardId];
    card.zone = 'battlefield';
    card.zoneChangeCounter += 1;
    card.enteredTurn = record.table.turn;
    card.faceDown = true;
    record.table.seats[0].zones.battlefield.unshift(cardId);
    storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));

    expect(
      r4OperationCreatesKnowledgeBarrier(record.table, {
        type: 'state.apply',
        graveyardIds: [cardId],
      }),
    ).toBe(true);

    const missing = await commit({ type: 'state.apply', graveyardIds: [cardId] });
    expect(missing.response.status).toBe(400);
    expect(missing.value.error).toBe('INVALID_REQUEST');

    const applied = await commit(
      { type: 'state.apply', graveyardIds: [cardId] },
      { kind: 'unbound' },
    );
    expect(applied.response.status).toBe(200);
    expect(applied.value.table.cards[cardId]).toMatchObject({ zone: 'graveyard', faceDown: false });
    // Solo Undo remains available; knowledge-epoch blocking is a multiplayer trust boundary.
    expect(applied.value.canUndo).toBe(true);
  });
});
