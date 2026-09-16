// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

import { makeDeck } from '../../../engine/__tests__/helpers';
import {
  tableActivationPayment,
  type CockpitTable,
} from '../../../engine/cockpitTable';
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
    ...(!history && !(value.context === undefined && operation?.type === 'activate')
      ? { context: value.context ?? { kind: 'unbound' } }
      : {}),
    ...(manualEvent && value.declaredCause === undefined
      ? { declaredCause: { kind: 'manual-event' } }
      : {}),
  };
}

function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/r4-activate-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(r4bTestRequestBody(body)),
  });
}

type SessionErrorView = CockpitSessionView & { error?: string };
type StoredRecord = {
  table: CockpitTable;
  knowledgeEpoch?: number;
  undoKnowledgeEpochs?: number[];
};

function loadRecord(storage: OnlineCloudflareSqlStorage): StoredRecord {
  const row = storage.sql
    .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
    .toArray()[0];
  return JSON.parse(row.data) as StoredRecord;
}

function saveRecord(storage: OnlineCloudflareSqlStorage, record: StoredRecord): void {
  storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));
}

function cyclingOperation(table: CockpitTable, sourceId: string) {
  const paymentPlan = tableActivationPayment(table, sourceId, 'cycling', null).paid;
  return {
    type: 'activate',
    id: 'cycling-private-activation',
    sourceId,
    choice: 'cycling',
    text: 'Draw a card.',
    targets: [],
    manualCosts: null,
    paymentPlan,
  };
}

describe('R4 unusual-zone activate server authority', () => {
  it('requires context, binds private activation to the semantic actor, and creates a knowledge barrier', async () => {
    const storage = database();
    const credentials = [
      { token: '5'.repeat(64), connectionId: 'connection-r4-activate-1' },
      { token: '6'.repeat(64), connectionId: 'connection-r4-activate-2' },
    ];
    let revision = 0;
    let now = 9000;

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
      context?: { kind: 'unbound' } | { kind: 'resolution'; entryId: string },
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

    const created = await call(0, { type: 'create', seats: 2, seed: 13, deck: makeDeck(30) });
    expect(created.status).toBe(200);
    const invitation = created.value.multiplayer!.invitation!;
    expect((await call(1, { type: 'join', invitation, deck: makeDeck(30) })).status).toBe(200);
    expect((await commit(0, { type: 'keep', seatId: 'P1' })).status).toBe(200);
    expect((await commit(1, { type: 'keep', seatId: 'P2' })).status).toBe(200);
    expect((await control(0, { type: 'start' })).status).toBe(200);

    const record = loadRecord(storage);
    const p1 = record.table.seats.find((seat) => seat.id === 'P1')!;
    const sourceId = p1.zones.hand[0];
    const source = record.table.cards[sourceId];
    const def = record.table.defs[source.defId];
    def.faces[source.faceIndex].oracleText = 'Cycling {0}';
    saveRecord(storage, record);

    const operation = cyclingOperation(record.table, sourceId);
    const missingContext = await commit(0, operation);
    expect(missingContext.status).toBe(400);
    expect(missingContext.value.error).toBe('INVALID_REQUEST');
    expect((await call(0, { type: 'read' })).value.table.seats[0].zones.hand).toContain(sourceId);

    // Borrowed operator status is separate from the private decision authority
    // attached to P1's hand object. Even explicit visibility does not transfer it.
    expect((await control(1, { type: 'hold', held: true })).status).toBe(200);
    expect((await control(0, { type: 'grant', seatId: 'P2' })).status).toBe(200);
    const visible = loadRecord(storage);
    visible.table.visibility[sourceId] = ['P2'];
    saveRecord(storage, visible);
    const borrowed = await commit(1, operation, { kind: 'unbound' });
    expect(borrowed.status).toBe(403);
    expect(borrowed.value.error).toBe('NOT_AUTHORIZED');
    expect((await control(1, { type: 'return' })).status).toBe(200);

    const beforeOwnActivation = loadRecord(storage);
    const ownOperation = cyclingOperation(beforeOwnActivation.table, sourceId);
    const activated = await commit(0, ownOperation, { kind: 'unbound' });
    expect(activated.status).toBe(200);
    expect(activated.value.table.cards[sourceId]).toMatchObject({ zone: 'graveyard' });
    expect(activated.value.table.stack[0]).toMatchObject({
      kind: 'activated',
      controllerId: 'P1',
      source: { id: sourceId, zone: 'hand' },
    });
    expect(activated.value.canUndo).toBe(false);

    const persisted = loadRecord(storage);
    expect(persisted.knowledgeEpoch).toBe(1);
    expect(persisted.undoKnowledgeEpochs?.at(-1)).toBe(0);
  });
});
