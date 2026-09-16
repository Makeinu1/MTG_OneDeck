// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

import { makeDeck } from '../../../engine/__tests__/helpers';
import {
  handleCockpitSession,
  type CockpitSessionView,
} from '../cockpitSession';
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
  return new Request('http://localhost/api/cockpit/r4b-audit-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type View = CockpitSessionView & { error?: string };

describe('R4b persisted semantic audit', () => {
  it('appends once per accepted commit, survives read, and appends undo instead of rewriting history', async () => {
    const storage = database();
    const token = '1'.repeat(64);
    let now = 1;
    const call = async (body: Record<string, unknown>) => {
      const response = await handleCockpitSession(request({ token, ...body }), storage, now++);
      return { status: response.status, value: (await response.json()) as View };
    };

    const created = await call({ type: 'create', seed: 1, deck: makeDeck(20) });
    expect(created.status).toBe(200);
    const requestId = crypto.randomUUID();
    const manual = {
      type: 'commit',
      protocolVersion: 2,
      requestId,
      revision: created.value.revision,
      context: { kind: 'unbound' },
      declaredCause: { kind: 'manual-event' },
      operation: { type: 'life', seatIds: ['P1'], delta: -1 },
    };
    const committed = await call(manual);
    expect(committed.status).toBe(200);
    expect(committed.value.recentActions).toEqual([
      { revision: 1, actorId: 'P1', kind: 'manual-event' },
    ]);

    const replay = await call(manual);
    expect(replay.status).toBe(200);
    expect(replay.value.receipt).toBe('committed');
    expect(replay.value.recentActions).toEqual(committed.value.recentActions);

    const read = await call({ type: 'read' });
    expect(read.value.recentActions).toEqual(committed.value.recentActions);

    const undo = await call({
      type: 'commit',
      protocolVersion: 2,
      requestId: crypto.randomUUID(),
      revision: committed.value.revision,
      operation: { type: 'undo' },
    });
    expect(undo.status).toBe(200);
    expect(undo.value.recentActions).toEqual([
      { revision: 1, actorId: 'P1', kind: 'manual-event' },
      { revision: 2, actorId: 'P1', kind: 'undo' },
    ]);
  });
});
