// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { makeDeck } from '../../../engine/__tests__/helpers';
import { objectIdOf } from '../../../engine/types';
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
  return new Request('http://localhost/api/cockpit/r4b-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type SessionErrorView = CockpitSessionView & { error?: string };

function persisted(storage: OnlineCloudflareSqlStorage) {
  return JSON.parse(
    storage.sql
      .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
      .toArray()[0].data,
  ) as {
    table: CockpitSessionView['table'];
    revision: number;
    knowledgeEpoch?: number;
    undoKnowledgeEpochs?: number[];
  };
}

describe('R4b protocol v2 solo gate', () => {
  it('rejects cause-free raw mutation and accepts an explicit Manual Event', async () => {
    const storage = database();
    const token = '1'.repeat(64);
    let revision = 0;
    let now = 1000;

    const call = async (body: Record<string, unknown>) => {
      const response = await handleCockpitSession(request({ token, ...body }), storage, now++);
      const value = (await response.json()) as SessionErrorView;
      if (response.ok) revision = value.revision;
      return { status: response.status, value };
    };

    expect((await call({ type: 'create', seed: 1, deck: makeDeck(30) })).status).toBe(200);
    const before = await call({ type: 'read' });
    const life = before.value.table.seats[0].life;

    const rejected = await call({
      type: 'commit',
      protocolVersion: 2,
      requestId: crypto.randomUUID(),
      revision,
      context: { kind: 'unbound' },
      operation: { type: 'life', seatIds: ['P1'], delta: -2 },
    });
    expect(rejected.status).toBe(422);
    expect(rejected.value.error).toBe('R4B_MANUAL_EVENT_REQUIRED');
    expect((await call({ type: 'read' })).value.table.seats[0].life).toBe(life);

    const accepted = await call({
      type: 'commit',
      protocolVersion: 2,
      requestId: crypto.randomUUID(),
      revision,
      context: { kind: 'unbound' },
      declaredCause: { kind: 'manual-event' },
      operation: { type: 'life', seatIds: ['P1'], delta: -2 },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.value.table.seats[0].life).toBe(life - 2);
    expect(
      accepted.value.table.triggers?.events.some(
        (event) => event.type === 'lifeChange' && event.delta === -2,
      ),
    ).toBe(true);
  });

  it('applies Correction as an absolute repair without emitting gameplay events', async () => {
    const storage = database();
    const token = '2'.repeat(64);
    let revision = 0;
    let now = 2000;

    const call = async (body: Record<string, unknown>) => {
      const response = await handleCockpitSession(request({ token, ...body }), storage, now++);
      const value = (await response.json()) as SessionErrorView;
      if (response.ok) revision = value.revision;
      return { status: response.status, value };
    };

    expect((await call({ type: 'create', seed: 2, deck: makeDeck(30) })).status).toBe(200);
    const before = await call({ type: 'read' });
    const eventCount = before.value.table.triggers?.events.length ?? 0;

    const repaired = await call({
      type: 'commit',
      protocolVersion: 2,
      requestId: crypto.randomUUID(),
      revision,
      context: { kind: 'unbound' },
      declaredCause: { kind: 'correction', groupId: crypto.randomUUID() },
      operation: { type: 'repair.lifeTotal', seatId: 'P1', value: 17 },
    });
    expect(repaired.status).toBe(200);
    expect(repaired.value.table.seats[0].life).toBe(17);
    expect(repaired.value.table.triggers?.events.length ?? 0).toBe(eventCount);
  });

  it('includes declared Cause in receipt identity', async () => {
    const storage = database();
    const token = '3'.repeat(64);
    let revision = 0;
    let now = 3000;

    const call = async (body: Record<string, unknown>) => {
      const response = await handleCockpitSession(request({ token, ...body }), storage, now++);
      const value = (await response.json()) as SessionErrorView;
      if (response.ok) revision = value.revision;
      return { status: response.status, value };
    };

    expect((await call({ type: 'create', seed: 3, deck: makeDeck(30) })).status).toBe(200);
    const requestId = crypto.randomUUID();
    const operation = { type: 'life', seatIds: ['P1'], delta: -1 };

    const first = await call({
      type: 'commit',
      protocolVersion: 2,
      requestId,
      revision,
      context: { kind: 'unbound' },
      declaredCause: { kind: 'manual-event' },
      operation,
    });
    expect(first.status).toBe(200);

    const conflict = await call({
      type: 'commit',
      protocolVersion: 2,
      requestId,
      revision,
      context: { kind: 'unbound' },
      declaredCause: { kind: 'correction', groupId: crypto.randomUUID() },
      operation,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.value.error).toBe('REQUEST_ID_CONFLICT');
  });
});

describe('R4b protocol v2 shared Correction', () => {
  it('requires HOLD and advances the knowledge barrier for private publication repair', async () => {
    const storage = database();
    const credentials = [
      { token: '4'.repeat(64), connectionId: 'connection-r4b-player-1' },
      { token: '5'.repeat(64), connectionId: 'connection-r4b-player-2' },
    ];
    let revision = 0;
    let now = 4000;

    const call = async (index: number, body: Record<string, unknown>) => {
      const response = await handleCockpitSession(
        request({ ...credentials[index], ...body }),
        storage,
        now++,
      );
      const value = (await response.json()) as SessionErrorView;
      if (response.ok) revision = value.revision;
      return { status: response.status, value };
    };
    const legacyCommit = async (index: number, operation: Record<string, unknown>) =>
      call(index, {
        type: 'commit',
        requestId: crypto.randomUUID(),
        revision,
        operation,
      });
    const control = async (index: number, value: Record<string, unknown>) =>
      call(index, {
        type: 'control',
        requestId: crypto.randomUUID(),
        revision,
        control: value,
      });

    const created = await call(0, { type: 'create', seats: 2, seed: 4, deck: makeDeck(30) });
    expect(created.status).toBe(200);
    const invitation = created.value.multiplayer!.invitation!;
    expect((await call(1, { type: 'join', invitation, deck: makeDeck(30) })).status).toBe(200);
    expect((await legacyCommit(0, { type: 'keep', seatId: 'P1' })).status).toBe(200);
    expect((await legacyCommit(1, { type: 'keep', seatId: 'P2' })).status).toBe(200);
    expect((await control(0, { type: 'start' })).status).toBe(200);

    const before = await call(0, { type: 'read' });
    const privateId = before.value.table.seats[0].zones.hand[0];
    const objectId = objectIdOf(before.value.table.cards[privateId]);

    const noHold = await call(0, {
      type: 'commit',
      protocolVersion: 2,
      requestId: crypto.randomUUID(),
      revision,
      context: { kind: 'unbound' },
      declaredCause: { kind: 'correction', groupId: crypto.randomUUID() },
      operation: {
        type: 'repair.visibility',
        object: { cardId: privateId, objectId },
        seatIds: ['P2'],
      },
    });
    expect(noHold.status).toBe(409);
    expect(noHold.value.error).toBe('R4B_CORRECTION_REQUIRES_HOLD');

    expect((await control(1, { type: 'hold', held: true })).status).toBe(200);
    const repaired = await call(0, {
      type: 'commit',
      protocolVersion: 2,
      requestId: crypto.randomUUID(),
      revision,
      context: { kind: 'unbound' },
      declaredCause: { kind: 'correction', groupId: crypto.randomUUID() },
      operation: {
        type: 'repair.visibility',
        object: { cardId: privateId, objectId },
        seatIds: ['P2'],
      },
    });
    expect(repaired.status).toBe(200);

    const state = persisted(storage);
    expect(state.knowledgeEpoch).toBe(1);
    expect(state.undoKnowledgeEpochs?.at(-1)).toBe(0);

    const p2 = await call(1, { type: 'read' });
    expect(p2.value.table.cards[privateId]).toBeDefined();

    expect((await control(1, { type: 'hold', held: false })).status).toBe(200);
    const undo = await legacyCommit(0, { type: 'undo' });
    expect(undo.status).toBe(409);
    expect(undo.value.error).toBe('NO_UNDO');
  });
});
