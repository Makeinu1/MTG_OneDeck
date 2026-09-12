// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  handleCockpitSession,
  COCKPIT_TTL_MS,
  type CockpitSessionView,
  type CockpitCheckpoint,
} from '../cockpitSession';
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
const token = 'a'.repeat(64);
function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('private cockpit SQLite commit boundary', () => {
  it('keeps confirmed game end irreversible across undo and an older checkpoint restore', async () => {
    const storage = database();
    await handleCockpitSession(
      request({ type: 'create', token, deck: makeDeck(20), seed: 1 }),
      storage,
      1000,
    );
    const checkpoint = (await (
      await handleCockpitSession(request({ type: 'checkpoint', token }), storage, 2000)
    ).json()) as CockpitCheckpoint;
    const ended = (await (
      await handleCockpitSession(
        request({
          type: 'commit',
          token,
          requestId: 'confirmed-end-0001',
          revision: 0,
          operation: { type: 'end' },
        }),
        storage,
        3000,
      )
    ).json()) as CockpitSessionView;
    expect(ended.table.ended).toBe(true);
    expect(ended.canUndo).toBe(false);
    expect(
      (
        await handleCockpitSession(
          request({
            type: 'commit',
            token,
            requestId: 'undo-ended-000001',
            revision: 1,
            operation: { type: 'undo' },
          }),
          storage,
          4000,
        )
      ).status,
    ).toBe(409);
    const restored = (await (
      await handleCockpitSession(
        request({ type: 'restore', token: 'c'.repeat(64), checkpoint }),
        storage,
        4000 + COCKPIT_TTL_MS,
      )
    ).json()) as CockpitSessionView;
    expect(restored.table.ended).toBe(true);
    expect(restored.canUndo).toBe(false);
    expect(
      (
        await handleCockpitSession(
          request({
            type: 'commit',
            token: 'c'.repeat(64),
            requestId: 'draw-ended-000001',
            revision: 0,
            operation: { type: 'draw', seatId: 'P1', count: 1 },
          }),
          storage,
          5000 + COCKPIT_TTL_MS,
        )
      ).status,
    ).toBe(422);
  });
  it('persists draw once across response loss, undo/redo and a fresh handler call', async () => {
    const storage = database();
    const created = await handleCockpitSession(
      request({ type: 'create', token, deck: makeDeck(20), seed: 1 }),
      storage,
      1000,
    );
    expect(created.status).toBe(200);
    const initial = (await created.json()) as CockpitSessionView;
    const command = {
      type: 'commit',
      token,
      requestId: 'operation-00000001',
      revision: 0,
      operation: { type: 'draw', seatId: 'P1', count: 1 },
    };
    await handleCockpitSession(request(command), storage, 2000); // committed response deliberately not consumed
    const recovered = (await (
      await handleCockpitSession(
        request({ type: 'read', token, requestId: command.requestId }),
        storage,
        3000,
      )
    ).json()) as CockpitSessionView;
    expect(recovered.receipt).toBe('committed');
    expect(recovered.table.seats[0].zones.hand).toHaveLength(8);
    const repeated = (await (
      await handleCockpitSession(request(command), storage, 4000)
    ).json()) as CockpitSessionView;
    expect(repeated.revision).toBe(1);
    expect(repeated.table).toEqual(recovered.table);
    const undone = (await (
      await handleCockpitSession(
        request({
          ...command,
          requestId: 'operation-00000002',
          revision: 1,
          operation: { type: 'undo' },
        }),
        storage,
        5000,
      )
    ).json()) as CockpitSessionView;
    expect(undone.table).toEqual(initial.table);
    const redone = (await (
      await handleCockpitSession(
        request({
          ...command,
          requestId: 'operation-00000003',
          revision: 2,
          operation: { type: 'redo' },
        }),
        storage,
        6000,
      )
    ).json()) as CockpitSessionView;
    expect(redone.table).toEqual(recovered.table);
    expect(redone.revision).toBe(3);
    // A pre-generation development save has bare receipt keys. Its lost
    // response must still reconcile as committed after upgrading the handler.
    const saved = JSON.parse(
      storage.sql
        .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
        .toArray()[0].data,
    ) as { generation?: string };
    const prefix = `${saved.generation}:`;
    delete saved.generation;
    storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(saved));
    storage.sql.exec('UPDATE cockpit_receipts SET id = substr(id, ?)', prefix.length + 1);
    const legacyRead = (await (
      await handleCockpitSession(
        request({ type: 'read', token, requestId: command.requestId }),
        storage,
        7000,
      )
    ).json()) as CockpitSessionView;
    expect(legacyRead.receipt).toBe('committed');
    expect(legacyRead.table).toEqual(redone.table);
  });

  it('rejects other credentials, partial mutations, stale revisions and expired activity', async () => {
    const storage = database();
    await handleCockpitSession(
      request({ type: 'create', token, deck: makeDeck(20), seed: 1 }),
      storage,
      1000,
    );
    expect(
      (await handleCockpitSession(request({ type: 'read', token: 'b'.repeat(64) }), storage, 2000))
        .status,
    ).toBe(403);
    const command = {
      type: 'commit',
      token,
      requestId: 'operation-00000001',
      revision: 0,
      operation: { type: 'life', seatIds: ['P1', 'missing'], delta: -2 },
    };
    expect((await handleCockpitSession(request(command), storage, 2000)).status).toBe(422);
    const read = (await (
      await handleCockpitSession(
        request({ type: 'read', token, requestId: command.requestId }),
        storage,
        3000,
      )
    ).json()) as CockpitSessionView;
    expect(read.table.seats[0].life).toBe(40);
    expect(read.receipt).toBe('unseen');
    expect(
      (await handleCockpitSession(request({ ...command, revision: 9 }), storage, 4000)).status,
    ).toBe(409);
    const checkpoint = (await (
      await handleCockpitSession(request({ type: 'checkpoint', token }), storage, 4000)
    ).json()) as CockpitCheckpoint;
    expect(checkpoint.signature).toMatch(/^[a-f0-9]{64}$/);
    const restore = { type: 'restore', token: 'c'.repeat(64), checkpoint };
    expect((await handleCockpitSession(request(restore), storage, 5000)).status).toBe(409);
    expect(
      (await handleCockpitSession(request({ type: 'read', token }), storage, 4000 + COCKPIT_TTL_MS))
        .status,
    ).toBe(410);
    const forged = structuredClone(checkpoint);
    forged.table.seats[0].life = 99;
    expect(
      (
        await handleCockpitSession(
          request({ ...restore, checkpoint: forged }),
          storage,
          4000 + COCKPIT_TTL_MS,
        )
      ).status,
    ).toBe(403);
    const restored = (await (
      await handleCockpitSession(request(restore), storage, 4000 + COCKPIT_TTL_MS)
    ).json()) as CockpitSessionView;
    expect(restored.table).toEqual(checkpoint.table);
    expect(restored.canUndo).toBe(false);
    expect(
      (await handleCockpitSession(request({ type: 'read', token }), storage, 4000 + COCKPIT_TTL_MS))
        .status,
    ).toBe(403);
    const repeated = (await (
      await handleCockpitSession(request(restore), storage, 4000 + COCKPIT_TTL_MS)
    ).json()) as CockpitSessionView;
    expect(repeated.revision).toBe(0);
  });
});

function multiplayerHarness(seats: 2 | 4) {
  const storage = database();
  let revision = 0;
  let now = 1000;
  const credentials = Array.from({ length: seats }, (_, i) => ({
    token: String(i + 1).repeat(64),
    connectionId: `connection-player-${i + 1}`,
  }));
  async function call(index: number, body: Record<string, unknown>) {
    const result = await handleCockpitSession(
      request({ ...credentials[index], ...body }),
      storage,
      now,
    );
    const value = (await result.json()) as CockpitSessionView & { error?: string };
    if (result.ok) revision = value.revision;
    return { status: result.status, value };
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
    const created = await call(0, { type: 'create', seats, seed: 1, deck: makeDeck(20) });
    expect(created.status).toBe(200);
    const invitation = created.value.multiplayer!.invitation;
    for (let i = 1; i < seats; i++)
      expect((await call(i, { type: 'join', invitation, deck: makeDeck(20) })).status).toBe(200);
    for (let i = 0; i < seats; i++)
      expect((await change(i, { type: 'keep', seatId: `P${i + 1}` })).status).toBe(200);
    expect((await change(0, { type: 'start' }, true)).status).toBe(200);
  }
  return {
    call,
    change,
    start,
    credentials,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('shared Cockpit multiplayer', () => {
  it('reopens a kicked lobby seat with a new invite and clears a departed lender', async () => {
    const room = multiplayerHarness(4);
    const created = await room.call(0, { type: 'create', seats: 4, seed: 1, deck: makeDeck(20) });
    const invitation = created.value.multiplayer!.invitation;
    await room.call(1, { type: 'join', invitation, deck: makeDeck(20) });
    const kicked = await room.change(0, { type: 'kick', seatId: 'P2' }, true);
    expect(kicked.status).toBe(200);
    expect(kicked.value.table.ended).toBe(false);
    expect(kicked.value.multiplayer!.invitation).not.toBe(invitation);
    expect((await room.call(1, { type: 'read' })).status).toBe(403);
    expect((await room.call(1, { type: 'join', invitation, deck: makeDeck(20) })).status).toBe(403);
    for (let i = 1; i < 4; i++)
      expect(
        (
          await room.call(i, {
            type: 'join',
            invitation: kicked.value.multiplayer!.invitation,
            deck: makeDeck(20),
          })
        ).status,
      ).toBe(200);
    for (let i = 0; i < 4; i++) await room.change(i, { type: 'keep', seatId: `P${i + 1}` });
    await room.change(0, { type: 'start' }, true);
    await room.change(1, { type: 'hold', held: true }, true);
    await room.change(0, { type: 'grant', seatId: 'P2' }, true);
    const departed = await room.change(1, { type: 'eliminate', seatId: 'P1' }, true);
    expect(departed.value.multiplayer!.masterId).toBe('P2');
    expect(departed.value.multiplayer!.borrowedFrom).toBeNull();
    expect((await room.change(1, { type: 'return' }, true)).status).toBe(403);
    expect((await room.change(1, { type: 'turn' })).status).toBe(200);
  });

  it('two seats keep private projections, delegate HOLD, reconcile commits, undo and resume with one active connection', async () => {
    const room = multiplayerHarness(2);
    await room.start();
    let read = await room.call(0, { type: 'read' });
    expect(read.value.table.seats[1].zones.hand).toEqual([]);
    expect(Object.keys(read.value.table.cards).some((id) => id.startsWith('P2c'))).toBe(false);
    expect(read.value.multiplayer!.counts.P2.hand).toBe(7);
    expect((await room.change(1, { type: 'life', seatIds: ['P1'], delta: -1 })).status).toBe(403);
    expect((await room.change(1, { type: 'hold', held: true }, true)).status).toBe(200);
    expect((await room.change(0, { type: 'turn' })).status).toBe(403);
    expect((await room.change(0, { type: 'grant', seatId: 'P2' }, true)).status).toBe(200);
    expect((await room.change(1, { type: 'draw', seatId: 'P2', count: 1 })).status).toBe(200);
    expect(
      (await room.change(1, { type: 'peek', seatId: 'P1', zone: 'hand' }, true)).value.table
        .seats[0].zones.hand,
    ).toHaveLength(7);
    expect((await room.call(0, { type: 'read' })).value.table.seats[1].zones.hand).toHaveLength(0);
    expect(
      (await room.change(1, { type: 'return' }, true)).value.table.seats[0].zones.hand,
    ).toHaveLength(0);
    expect((await room.change(0, { type: 'undo' })).value.multiplayer!.counts.P2.hand).toBe(7);
    room.advance(31_000);
    expect((await room.call(1, { type: 'read' })).value.multiplayer!.paused).toBe(true);
    expect((await room.change(1, { type: 'hold', held: true }, true)).status).toBe(409);
    await room.call(0, { type: 'read' });
    const old = room.credentials[1].connectionId;
    room.credentials[1].connectionId = 'new-connection-player-2';
    expect((await room.call(1, { type: 'connect' })).status).toBe(200);
    expect((await room.call(1, { type: 'read', connectionId: old })).status).toBe(403);
    read = await room.change(0, { type: 'eliminate', seatId: 'P2' }, true);
    expect(read.value.table.ended).toBe(true);
    expect(read.value.canUndo).toBe(false);
  });

  it('four seats preserve separate defenders and continue after elimination without changing seat identity', async () => {
    const room = multiplayerHarness(4);
    await room.start();
    for (const [id, seatId] of [
      ['a1', 'P1'],
      ['a2', 'P1'],
      ['b2', 'P2'],
      ['b3', 'P3'],
    ]) {
      expect(
        (
          await room.change(0, {
            type: 'token',
            id,
            seatId,
            name: 'Unit',
            typeLine: 'Creature',
            power: '2',
            toughness: '2',
            text: '',
          })
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await room.change(0, {
          type: 'battle.attack',
          attackers: [
            { cardId: 'a1', targetId: 'P2' },
            { cardId: 'a2', targetId: 'P3' },
          ],
          tapIds: ['a1', 'a2'],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await room.change(1, {
          type: 'battle.block',
          defendingSeatId: 'P2',
          blockers: [{ cardId: 'b2', attackerIds: ['a2'] }],
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await room.change(1, {
          type: 'battle.block',
          defendingSeatId: 'P2',
          blockers: [{ cardId: 'b2', attackerIds: ['a1'] }],
        })
      ).status,
    ).toBe(200);
    const blocked = await room.change(2, {
      type: 'battle.block',
      defendingSeatId: 'P3',
      blockers: [{ cardId: 'b3', attackerIds: ['a2'] }],
    });
    expect(blocked.value.table.combat!.blockers).toHaveLength(2);
    expect(
      (await room.change(0, { type: 'undo' })).value.table.combat!.blockers.map((b) => b.cardId),
    ).toEqual(['b2']);
    const eliminated = await room.change(0, { type: 'eliminate', seatId: 'P2' }, true);
    expect(eliminated.value.table.combat!.attackers.map((entry) => entry.cardId)).toEqual(['a2']);
    await room.change(0, { type: 'battle.end' });
    const advanced = await room.change(0, { type: 'turn' });
    expect(advanced.value.table.activeSeatId).toBe('P3');
    expect(advanced.value.table.seats.map((s) => s.id)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect((await room.change(1, { type: 'hold', held: true }, true)).status).toBe(403);
    await room.change(0, { type: 'eliminate', seatId: 'P3' }, true);
    const next = await room.change(0, { type: 'turn' });
    expect(next.value.table.activeSeatId).toBe('P4');
    expect(next.value.table.ended).toBe(false);
  });
});
