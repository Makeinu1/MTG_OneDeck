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
  return new Request('http://localhost/api/cockpit/r4-formal-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type SessionErrorView = CockpitSessionView & { error?: string };
type TestCard = {
  id: string;
  defId: string;
  faceIndex: number;
  zone: string;
  ownerId: string;
  controllerId: string;
  faceDown: boolean;
};
type TestRecord = {
  table: {
    cards: Record<string, TestCard>;
    defs: Record<
      string,
      {
        faces: { typeLine?: string; manaCost?: string; oracleText?: string }[];
      }
    >;
    seats: { id: string; zones: Record<string, string[]> }[];
    visibility: Record<string, string[]>;
  };
};

function loadRecord(storage: OnlineCloudflareSqlStorage): TestRecord {
  const row = storage.sql
    .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
    .toArray()[0];
  return JSON.parse(row.data) as TestRecord;
}

function saveRecord(storage: OnlineCloudflareSqlStorage, record: TestRecord): void {
  storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));
}

function relocate(record: TestRecord, cardId: string, to: string): void {
  const card = record.table.cards[cardId];
  for (const seat of record.table.seats)
    for (const zone of Object.keys(seat.zones))
      seat.zones[zone] = seat.zones[zone].filter((id) => id !== cardId);
  card.zone = to;
  card.controllerId = card.ownerId;
  const owner = record.table.seats.find((seat) => seat.id === card.ownerId);
  if (!owner) throw new Error('missing test owner');
  owner.zones[to].unshift(cardId);
}

function makeSpell(record: TestRecord, cardId: string): void {
  const card = record.table.cards[cardId];
  const face = record.table.defs[card.defId].faces[card.faceIndex];
  face.typeLine = 'Instant';
  face.manaCost = '{0}';
  face.oracleText = 'Test spell.';
}

async function startedSession() {
  const storage = database();
  const credentials = [
    { token: '3'.repeat(64), connectionId: 'connection-r4-formal-1' },
    { token: '4'.repeat(64), connectionId: 'connection-r4-formal-2' },
  ];
  let revision = 0;
  let now = 5000;

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
    context: { kind: 'unbound' } | { kind: 'resolution'; entryId: string } = {
      kind: 'unbound',
    },
  ) =>
    call(index, {
      type: 'commit',
      requestId: crypto.randomUUID(),
      revision,
      operation,
      context,
    });
  const control = async (index: number, value: Record<string, unknown>) =>
    call(index, {
      type: 'control',
      requestId: crypto.randomUUID(),
      revision,
      control: value,
    });

  const created = await call(0, { type: 'create', seats: 2, seed: 9, deck: makeDeck(30) });
  expect(created.status).toBe(200);
  const invitation = created.value.multiplayer!.invitation!;
  expect((await call(1, { type: 'join', invitation, deck: makeDeck(30) })).status).toBe(200);
  expect((await commit(0, { type: 'keep', seatId: 'P1' })).status).toBe(200);
  expect((await commit(1, { type: 'keep', seatId: 'P2' })).status).toBe(200);
  expect((await control(0, { type: 'start' })).status).toBe(200);

  return { storage, call, commit, control };
}

function zeroCostCast(cardId: string, sourceZone: string, extra: Record<string, unknown> = {}) {
  return {
    type: 'cast',
    cardId,
    sourceZone,
    targets: [],
    x: 0,
    paymentPlan: [],
    ...extra,
  };
}

function emptyAdditionalCosts() {
  return {
    tapIds: [],
    sacrificeIds: [],
    discardIds: [],
    returnIds: [],
    exileIds: [],
    life: 0,
    counters: [],
    note: '',
  };
}

describe('R4 formal-operation server authority', () => {
  it('allows a public unusual-zone cast but rejects a guessed library object until explicitly peeked', async () => {
    const { storage, commit, control } = await startedSession();
    const record = loadRecord(storage);
    const p1 = record.table.seats.find((seat) => seat.id === 'P1')!;
    const graveyardSpellId = p1.zones.hand[0];
    const hiddenLibrarySpellId = p1.zones.library[0];
    makeSpell(record, graveyardSpellId);
    makeSpell(record, hiddenLibrarySpellId);
    relocate(record, graveyardSpellId, 'graveyard');
    saveRecord(storage, record);

    const publicCast = await commit(0, zeroCostCast(graveyardSpellId, 'graveyard'));
    expect(publicCast.status).toBe(200);
    expect(publicCast.value.table.cards[graveyardSpellId]).toMatchObject({ zone: 'stack' });
    expect(publicCast.value.table.stack[0].source).toMatchObject({
      id: graveyardSpellId,
      zone: 'graveyard',
    });

    const guessedLibraryCast = await commit(0, zeroCostCast(hiddenLibrarySpellId, 'library'));
    expect(guessedLibraryCast.status).toBe(403);
    expect(guessedLibraryCast.value.error).toBe('NOT_AUTHORIZED');

    expect((await control(0, { type: 'peek', seatId: 'P1', zone: 'library', count: 1 })).status).toBe(
      200,
    );
    const peekedLibraryCast = await commit(0, zeroCostCast(hiddenLibrarySpellId, 'library'));
    expect(peekedLibraryCast.status).toBe(200);
    expect(peekedLibraryCast.value.table.cards[hiddenLibrarySpellId]).toMatchObject({ zone: 'stack' });
    expect(peekedLibraryCast.value.canUndo).toBe(false);
  });

  it('keeps additional-cost private-object authority separate from the public spell source', async () => {
    const { storage, commit, control } = await startedSession();
    const record = loadRecord(storage);
    const p1 = record.table.seats.find((seat) => seat.id === 'P1')!;
    const sourceId = p1.zones.hand[0];
    const hiddenCostId = p1.zones.library[0];
    makeSpell(record, sourceId);
    relocate(record, sourceId, 'graveyard');
    saveRecord(storage, record);

    const additionalCosts = {
      ...emptyAdditionalCosts(),
      exileIds: [hiddenCostId],
      note: 'Exile a privately known card as an additional cost.',
    };
    const hiddenCostCast = await commit(
      0,
      zeroCostCast(sourceId, 'graveyard', { additionalCosts }),
    );
    expect(hiddenCostCast.status).toBe(403);
    expect(hiddenCostCast.value.error).toBe('NOT_AUTHORIZED');

    expect((await control(0, { type: 'peek', seatId: 'P1', zone: 'library', count: 1 })).status).toBe(
      200,
    );
    const authorizedCostCast = await commit(
      0,
      zeroCostCast(sourceId, 'graveyard', { additionalCosts }),
    );
    expect(authorizedCostCast.status).toBe(200);
    expect(authorizedCostCast.value.table.cards[sourceId]).toMatchObject({ zone: 'stack' });
    expect(authorizedCostCast.value.table.cards[hiddenCostId]).toMatchObject({ zone: 'exile' });
    expect(authorizedCostCast.value.canUndo).toBe(false);
  });

  it('does not let borrowed operator authority reveal a face-down object identity', async () => {
    const { storage, commit, control } = await startedSession();
    const record = loadRecord(storage);
    const p1 = record.table.seats.find((seat) => seat.id === 'P1')!;
    const faceDownId = p1.zones.hand[0];
    relocate(record, faceDownId, 'battlefield');
    record.table.cards[faceDownId].faceDown = true;
    saveRecord(storage, record);

    expect((await control(1, { type: 'hold', held: true })).status).toBe(200);
    expect((await control(0, { type: 'grant', seatId: 'P2' })).status).toBe(200);
    const hiddenFace = await commit(1, {
      type: 'special.turnFaceUp',
      cardId: faceDownId,
      faceIndex: 0,
    });
    expect(hiddenFace.status).toBe(403);
    expect(hiddenFace.value.error).toBe('NOT_AUTHORIZED');

    const visibleRecord = loadRecord(storage);
    visibleRecord.table.visibility[faceDownId] = ['P2'];
    saveRecord(storage, visibleRecord);
    const visibleFace = await commit(1, {
      type: 'special.turnFaceUp',
      cardId: faceDownId,
      faceIndex: 0,
    });
    expect(visibleFace.status).toBe(200);
    expect(visibleFace.value.table.cards[faceDownId]).toMatchObject({ faceDown: false });
    expect(visibleFace.value.table.stack).toHaveLength(0);
    expect(visibleFace.value.canUndo).toBe(false);
  });
});
