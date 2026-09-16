// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { makeDeck } from '../../../engine/__tests__/helpers';
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
      try { const result = callback(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/r4b-sunset-test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}
type View = CockpitSessionView & { error?: string };
describe('R4b strict protocol sunset', () => {
  it('rejects new missing/old protocol commits but accepts protocol v2', async () => {
    const storage = database();
    const token = '7'.repeat(64);
    let now = 1;
    const call = async (body: Record<string, unknown>) => {
      const response = await handleCockpitSession(request({ token, ...body }), storage, now++);
      return { status: response.status, value: (await response.json()) as View };
    };
    const created = await call({ type: 'create', seed: 7, deck: makeDeck(20) });
    const base = {
      type: 'commit', requestId: crypto.randomUUID(), revision: created.value.revision,
      context: { kind: 'unbound' }, operation: { type: 'keep', seatId: 'P1' },
    };
    const missing = await call(base);
    expect(missing.status).toBe(409);
    expect(missing.value.error).toBe('CLIENT_UPDATE_REQUIRED');
    const old = await call({ ...base, requestId: crypto.randomUUID(), protocolVersion: 1 });
    expect(old.status).toBe(409);
    expect(old.value.error).toBe('CLIENT_UPDATE_REQUIRED');
    const current = await call({ ...base, requestId: crypto.randomUUID(), protocolVersion: 2 });
    expect(current.status).toBe(200);
  });
  it('reconciles an already-committed legacy receipt before applying the sunset gate', async () => {
    const storage = database();
    const token = '8'.repeat(64);
    let now = 100;
    const call = async (body: Record<string, unknown>) => {
      const response = await handleCockpitSession(request({ token, ...body }), storage, now++);
      return { status: response.status, value: (await response.json()) as View };
    };
    const created = await call({ type: 'create', seed: 8, deck: makeDeck(20) });
    const row = storage.sql.exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1').toArray()[0];
    const persisted = JSON.parse(row.data) as { generation: string };
    const requestId = crypto.randomUUID();
    const operation = { type: 'life', seatIds: ['P1'], delta: -1 };
    const context = { kind: 'unbound' };
    storage.sql.exec(
      'INSERT INTO cockpit_receipts (id, operation) VALUES (?, ?)',
      `${persisted.generation}:${requestId}`,
      JSON.stringify({ operation, context }),
    );
    const beforeLife = created.value.table.seats[0].life;
    const replay = await call({ type: 'commit', requestId, revision: 999, operation, context });
    expect(replay.status).toBe(200);
    expect(replay.value.receipt).toBe('committed');
    expect(replay.value.table.seats[0].life).toBe(beforeLife);
    expect(replay.value.revision).toBe(created.value.revision);
  });
});
