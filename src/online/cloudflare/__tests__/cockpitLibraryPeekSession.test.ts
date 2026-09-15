// @vitest-environment node
import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { handleCockpitSession, type CockpitSessionView } from '../cockpitSession';
import type { OnlineCloudflareSqlStorage } from '../types';
import { makeDeck } from '../../../engine/__tests__/helpers';

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
  return new Request('http://localhost/api/cockpit/private-library', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function room() {
  const storage = database();
  let revision = 0;
  let now = 1000;
  const credentials = [
    { token: 'a'.repeat(64), connectionId: 'private-library-p1' },
    { token: 'b'.repeat(64), connectionId: 'private-library-p2' },
  ];
  async function call(index: number, body: Record<string, unknown>) {
    const response = await handleCockpitSession(
      request({ ...credentials[index], ...body }),
      storage,
      now++,
    );
    const value = (await response.json()) as CockpitSessionView & { error?: string };
    if (response.ok) revision = value.revision;
    return { response, value };
  }
  async function change(index: number, operation: Record<string, unknown>, control = false) {
    return call(index, {
      type: control ? 'control' : 'commit',
      requestId: crypto.randomUUID(),
      revision,
      [control ? 'control' : 'operation']: operation,
    });
  }
  async function start() {
    const created = await call(0, { type: 'create', seats: 2, seed: 1, deck: makeDeck(20) });
    const invitation = created.value.multiplayer!.invitation;
    expect((await call(1, { type: 'join', invitation, deck: makeDeck(20) })).response.status).toBe(
      200,
    );
    expect((await change(0, { type: 'keep', seatId: 'P1' })).response.status).toBe(200);
    expect((await change(1, { type: 'keep', seatId: 'P2' })).response.status).toBe(200);
    expect((await change(0, { type: 'start' }, true)).response.status).toBe(200);
  }
  return {
    call,
    change,
    start,
    advance(ms: number) {
      now += ms;
    },
  };
}

it('projects only requested top-N cards, never to another seat, and full browse remains distinct', async () => {
  const shared = room();
  await shared.start();
  const hidden = await shared.call(0, { type: 'read' });
  const total = hidden.value.multiplayer!.counts.P1.library;
  expect(total).toBeGreaterThan(2);
  expect(hidden.value.table.seats[0].zones.library).toEqual([]);
  const bounded = await shared.change(
    0,
    { type: 'peek', seatId: 'P1', zone: 'library', count: 2 },
    true,
  );
  expect(bounded.response.status).toBe(200);
  expect(bounded.value.multiplayer!.peek).toEqual({ seatId: 'P1', zone: 'library', count: 2 });
  expect(bounded.value.table.seats[0].zones.library).toHaveLength(2);
  const other = await shared.call(1, { type: 'read' });
  expect(other.value.table.seats[0].zones.library).toEqual([]);
  expect(other.value.multiplayer!.peek).toBeNull();
  const full = await shared.change(0, { type: 'peek', seatId: 'P1', zone: 'library' }, true);
  expect(full.value.multiplayer!.peek).toEqual({ seatId: 'P1', zone: 'library' });
  expect(full.value.table.seats[0].zones.library).toHaveLength(total);
  const invalid = await shared.change(
    0,
    { type: 'peek', seatId: 'P1', zone: 'hand', count: 2 },
    true,
  );
  expect(invalid.response.status).toBe(400);
  expect(invalid.value.error).toBe('INVALID_REQUEST');
});

it('revokes private library projection when control changes and suppresses it while owner is absent', async () => {
  const shared = room();
  await shared.start();
  await shared.change(0, { type: 'peek', seatId: 'P1', zone: 'library' }, true);
  expect((await shared.change(1, { type: 'hold', held: true }, true)).response.status).toBe(200);
  const granted = await shared.change(0, { type: 'grant', seatId: 'P2' }, true);
  expect(granted.value.multiplayer!.masterId).toBe('P2');
  expect(granted.value.multiplayer!.peek).toBeNull();
  expect(granted.value.table.seats[0].zones.library).toEqual([]);
  const p2Peek = await shared.change(
    1,
    { type: 'peek', seatId: 'P2', zone: 'library', count: 2 },
    true,
  );
  expect(p2Peek.value.table.seats[1].zones.library).toHaveLength(2);
  expect(p2Peek.value.multiplayer!.peek?.count).toBe(2);
  shared.advance(31_000);
  const paused = await shared.call(1, { type: 'read' });
  expect(paused.value.multiplayer!.paused).toBe(true);
  expect(paused.value.multiplayer!.peek).toBeNull();
  expect(paused.value.table.seats[1].zones.library).toEqual([]);
});
