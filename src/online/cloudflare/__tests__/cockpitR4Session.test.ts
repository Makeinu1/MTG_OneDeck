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
  return new Request('http://localhost/api/cockpit/r4-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function landDeck(count: number) {
  return makeDeck(count).map((entry) => ({
    ...entry,
    def: {
      ...entry.def,
      typeLine: 'Basic Land — Forest',
      faces: entry.def.faces.map((face) => ({
        ...face,
        typeLine: 'Basic Land — Forest',
      })),
    },
  }));
}

type SessionErrorView = CockpitSessionView & { error?: string };

describe('R4 playLand server commit boundary', () => {
  it('requires context and semantic authority, rejects HOLD, and crosses the knowledge barrier', async () => {
    const storage = database();
    const credentials = [
      { token: '1'.repeat(64), connectionId: 'connection-r4-player-1' },
      { token: '2'.repeat(64), connectionId: 'connection-r4-player-2' },
    ];
    let revision = 0;
    let now = 1000;

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

    const created = await call(0, { type: 'create', seats: 2, seed: 1, deck: landDeck(20) });
    expect(created.status).toBe(200);
    const invitation = created.value.multiplayer!.invitation!;
    expect((await call(1, { type: 'join', invitation, deck: landDeck(20) })).status).toBe(200);
    expect((await commit(0, { type: 'keep', seatId: 'P1' })).status).toBe(200);
    expect((await commit(1, { type: 'keep', seatId: 'P2' })).status).toBe(200);
    expect((await control(0, { type: 'start' })).status).toBe(200);

    // This test isolates the R4 commit gate; phase progression is covered elsewhere.
    const stored = storage.sql
      .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
      .toArray()[0];
    const record = JSON.parse(stored.data) as {
      table: { phase: string };
      knowledgeEpoch?: number;
      undoKnowledgeEpochs?: number[];
    };
    record.table.phase = 'main1';
    storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));

    const before = await call(0, { type: 'read' });
    const landId = before.value.table.seats[0].zones.hand[0];

    const missingContext = await commit(0, { type: 'playLand', cardId: landId });
    expect(missingContext.status).toBe(400);
    expect(missingContext.value.error).toBe('INVALID_REQUEST');
    expect((await call(0, { type: 'read' })).value.table.seats[0].zones.hand).toContain(landId);

    // Being the borrowed operator is not permission to write a hidden hand object.
    expect((await control(1, { type: 'hold', held: true })).status).toBe(200);
    expect((await control(0, { type: 'grant', seatId: 'P2' })).status).toBe(200);
    const guessedHiddenLand = await commit(
      1,
      { type: 'playLand', cardId: landId },
      { kind: 'unbound' },
    );
    expect(guessedHiddenLand.status).toBe(403);
    expect(guessedHiddenLand.value.error).toBe('NOT_AUTHORIZED');
    expect((await control(1, { type: 'return' })).status).toBe(200);
    expect((await call(0, { type: 'read' })).value.table.seats[0].zones.hand).toContain(landId);

    expect((await control(1, { type: 'hold', held: true })).status).toBe(200);
    const held = await commit(
      0,
      { type: 'playLand', cardId: landId },
      { kind: 'unbound' },
    );
    expect(held.status).toBe(403);
    expect(held.value.error).toBe('NOT_AUTHORIZED');
    expect((await call(0, { type: 'read' })).value.table.seats[0].zones.hand).toContain(landId);

    expect((await control(1, { type: 'hold', held: false })).status).toBe(200);
    const played = await commit(
      0,
      {
        type: 'playLand',
        cardId: landId,
        entrySetup: { tapped: true, counters: { charge: 2 } },
      },
      { kind: 'unbound' },
    );
    expect(played.status).toBe(200);
    expect(played.value.table.cards[landId]).toMatchObject({
      zone: 'battlefield',
      tapped: true,
      counters: { charge: 2 },
    });
    expect(played.value.canUndo).toBe(false);

    const persisted = JSON.parse(
      storage.sql
        .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
        .toArray()[0].data,
    ) as { knowledgeEpoch?: number; undoKnowledgeEpochs?: number[] };
    expect(persisted.knowledgeEpoch).toBe(1);
    expect(persisted.undoKnowledgeEpochs?.at(-1)).toBe(0);

    const unsafeUndo = await commit(0, { type: 'undo' });
    expect(unsafeUndo.status).toBe(409);
    expect(unsafeUndo.value.error).toBe('NO_UNDO');
  });
});
