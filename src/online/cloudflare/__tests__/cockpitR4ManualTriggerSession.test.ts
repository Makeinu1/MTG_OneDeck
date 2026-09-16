// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

import { makeDeck } from '../../../engine/__tests__/helpers';
import type { CockpitTable } from '../../../engine/cockpitTable';
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
    ...(!history && !(value.context === undefined && operation?.type === 'trigger.manualAdd')
      ? { context: value.context ?? { kind: 'unbound' } }
      : {}),
    ...(manualEvent && value.declaredCause === undefined
      ? { declaredCause: { kind: 'manual-event' } }
      : {}),
  };
}

function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/r4-manual-trigger-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(r4bTestRequestBody(body)),
  });
}

type SessionErrorView = CockpitSessionView & { error?: string };
type StoredRecord = { table: CockpitTable };

function loadRecord(storage: OnlineCloudflareSqlStorage): StoredRecord {
  const row = storage.sql
    .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
    .toArray()[0];
  return JSON.parse(row.data) as StoredRecord;
}

function saveRecord(storage: OnlineCloudflareSqlStorage, record: StoredRecord): void {
  storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));
}

describe('R4 manual Trigger server boundary', () => {
  it('requires context, rejects hidden sources, and persists a public Pending candidate before Stack placement', async () => {
    const storage = database();
    const credentials = [
      { token: '7'.repeat(64), connectionId: 'connection-r4-trigger-1' },
      { token: '8'.repeat(64), connectionId: 'connection-r4-trigger-2' },
    ];
    let revision = 0;
    let now = 12000;
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
    const commit = async (
      index: number,
      operation: Record<string, unknown>,
      context?: { kind: 'unbound' },
    ) =>
      call(index, {
        type: 'commit',
        requestId: crypto.randomUUID(),
        revision,
        operation,
        ...(context ? { context } : {}),
      });
    const control = async (index: number, value: Record<string, unknown>) =>
      call(index, {
        type: 'control',
        requestId: crypto.randomUUID(),
        revision,
        control: value,
      });

    const created = await call(0, { type: 'create', seats: 2, seed: 19, deck: makeDeck(30) });
    expect(created.status).toBe(200);
    const invitation = created.value.multiplayer!.invitation!;
    expect((await call(1, { type: 'join', invitation, deck: makeDeck(30) })).status).toBe(200);
    expect((await commit(0, { type: 'keep', seatId: 'P1' })).status).toBe(200);
    expect((await commit(1, { type: 'keep', seatId: 'P2' })).status).toBe(200);
    expect((await control(0, { type: 'start' })).status).toBe(200);

    const record = loadRecord(storage);
    const seat = record.table.seats.find((entry) => entry.id === 'P1')!;
    const hiddenId = seat.zones.hand[0];
    const sourceId = seat.zones.hand[1];
    seat.zones.hand = seat.zones.hand.filter((id) => id !== sourceId);
    const source = record.table.cards[sourceId];
    source.zone = 'battlefield';
    source.zoneChangeCounter += 1;
    source.enteredTurn = record.table.turn;
    seat.zones.battlefield.unshift(sourceId);
    saveRecord(storage, record);

    const operation = {
      type: 'trigger.manualAdd',
      id: 'manual-trigger-server-1',
      sourceId,
      text: 'When this happens, draw a card.',
    };
    const missingContext = await commit(0, operation);
    expect(missingContext.status).toBe(400);
    expect(missingContext.value.error).toBe('INVALID_REQUEST');

    const hidden = await commit(
      0,
      { ...operation, id: 'manual-trigger-hidden', sourceId: hiddenId },
      { kind: 'unbound' },
    );
    expect(hidden.status).toBe(403);
    expect(hidden.value.error).toBe('NOT_AUTHORIZED');

    const added = await commit(0, operation, { kind: 'unbound' });
    expect(added.status).toBe(200);
    expect(added.value.table.stack).toHaveLength(0);
    expect(added.value.table.triggers?.candidates).toContainEqual(
      expect.objectContaining({
        pendingTriggerId: 'manual-trigger-server-1',
        triggerId: 'manual',
        sourceId,
        status: 'pending',
      }),
    );

    const placed = await commit(
      0,
      {
        type: 'trigger.place',
        candidateId: 'manual-trigger-server-1',
        id: 'manual-trigger-stack-1',
        targets: [],
      },
      { kind: 'unbound' },
    );
    expect(placed.status).toBe(200);
    expect(placed.value.table.stack[0]).toMatchObject({
      id: 'manual-trigger-stack-1',
      kind: 'triggered',
      controllerId: 'P1',
    });
  });
});
