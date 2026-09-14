from pathlib import Path


def replace_one(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    p.write_text(text.replace(old, new))


# Server: presence/observation and TTL activity are distinct clocks.
replace_one(
    'src/online/cloudflare/cockpitSession.ts',
    """    return storage.transactionSync(() => {\n      let record = loadRecord(storage);\n      let actor = record?.multiplayer ? cockpitActor(record.multiplayer, body.token) : 'P1';""",
    """    return storage.transactionSync(() => {\n      let record = loadRecord(storage);\n      // Only a newly accepted user mutation extends the six-hour session TTL.\n      // Presence reads/connects still update member.lastSeen, but do not move lastUsed.\n      let extendTtl = false;\n      let actor = record?.multiplayer ? cockpitActor(record.multiplayer, body.token) : 'P1';""",
)
replace_one(
    'src/online/cloudflare/cockpitSession.ts',
    """          multi.members[actor] = {\n            token: body.token,\n            connectionId: body.connectionId ?? '',\n            lastSeen: now,\n            kicked: false,\n            peek: null,\n          };\n          record.revision += 1;""",
    """          multi.members[actor] = {\n            token: body.token,\n            connectionId: body.connectionId ?? '',\n            lastSeen: now,\n            kicked: false,\n            peek: null,\n          };\n          record.revision += 1;\n          extendTtl = true;""",
)
replace_one(
    'src/online/cloudflare/cockpitSession.ts',
    """          storage.sql.exec(\n            'INSERT INTO cockpit_receipts (id, operation) VALUES (?, ?)',\n            receiptKey(record, body.requestId, actor),\n            encodedOperation,\n          );\n          receipt = 'committed';""",
    """          storage.sql.exec(\n            'INSERT INTO cockpit_receipts (id, operation) VALUES (?, ?)',\n            receiptKey(record, body.requestId, actor),\n            encodedOperation,\n          );\n          // A receipt created in this transaction is a newly accepted action.\n          // Replaying an existing receipt above is recovery, not new activity.\n          extendTtl = true;\n          receipt = 'committed';""",
)
replace_one(
    'src/online/cloudflare/cockpitSession.ts',
    """      if (!record.multiplayer || cockpitOwnerPresent(record.multiplayer, now))\n        record.lastUsed = now;""",
    """      if (extendTtl && (!record.multiplayer || cockpitOwnerPresent(record.multiplayer, now)))\n        record.lastUsed = now;""",
)
replace_one(
    'src/online/cloudflare/cockpitSession.ts',
    """      if (now >= record.lastUsed + COCKPIT_TTL_MS)\n        return response({ error: 'SESSION_EXPIRED' }, 410);\n      record.lastUsed = now;\n      storage.transactionSync(() =>""",
    """      if (now >= record.lastUsed + COCKPIT_TTL_MS)\n        return response({ error: 'SESSION_EXPIRED' }, 410);\n      // Explicit solo checkpoint is deliberate user activity. Automatic read/connect is not.\n      record.lastUsed = now;\n      storage.transactionSync(() =>""",
)

# UI: make the server deadline visible and explain what moves it.
replace_one(
    'src/components/game/CockpitRoomControls.tsx',
    """  const label = (id: string) => view.table.seats.find((seat) => seat.id === id)?.label ?? id;\n  return (""",
    """  const label = (id: string) => view.table.seats.find((seat) => seat.id === id)?.label ?? id;\n  const expiry = new Date(view.expiresAt);\n  return (""",
)
replace_one(
    'src/components/game/CockpitRoomControls.tsx',
    """      </span>\n      {invitation && (""",
    """      </span>\n      <span data-testid=\"session-expiry\">\n        有効期限:{' '}\n        <time dateTime={expiry.toISOString()}>{expiry.toLocaleString('ja-JP')}</time>{' '}\n        （確定した操作で更新。閲覧・自動再接続では延長しません）\n      </span>\n      {invitation && (""",
)

# Recovery copy: multiplayer expiration is terminal; local checkpoint restore is solo-only.
replace_one(
    'src/components/game/CockpitSessionScreen.tsx',
    """        <button onClick={() => void checkpoint(true)} disabled={busy}>\n          保存した盤面から再開\n        </button>""",
    """        <p>\n          端末保存から復元できるのは一人回しだけです。2人/4人の対戦卓は失効後に復元できません。\n        </p>\n        <button onClick={() => void checkpoint(true)} disabled={busy}>\n          一人回しの端末保存から再開\n        </button>""",
)
replace_one(
    'src/online/browser/cockpitClient.ts',
    """          throw new CockpitConnectionError(\n            'セッションは最終利用から6時間で失効しました。',\n            error.error,\n          );""",
    """          throw new CockpitConnectionError(\n            'セッションは最終利用から6時間で失効しました。2人/4人の対戦卓は復元できません。新しい卓を作成または参加してください。一人回しは端末checkpointがある場合だけそこから再開できます。',\n            error.error,\n          );""",
)

# Dedicated injected-clock server regressions.
Path('src/online/cloudflare/__tests__/cockpitTtlPolicy.test.ts').write_text(r'''// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import {
  COCKPIT_TTL_MS,
  handleCockpitSession,
  type CockpitSessionView,
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

const soloToken = 'a'.repeat(64);
function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/ttl-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
async function json(response: Response): Promise<CockpitSessionView> {
  expect(response.status).toBe(200);
  return (await response.json()) as CockpitSessionView;
}

it('keeps expiresAt stable across read/recovery/replay and extends only a newly accepted solo action', async () => {
  const storage = database();
  const created = await json(
    await handleCockpitSession(
      request({ type: 'create', token: soloToken, deck: makeDeck(20), seed: 1 }),
      storage,
      1_000,
    ),
  );
  expect(created.expiresAt).toBe(1_000 + COCKPIT_TTL_MS);

  const polled = await json(
    await handleCockpitSession(request({ type: 'read', token: soloToken }), storage, 2_000),
  );
  expect(polled.expiresAt).toBe(created.expiresAt);

  const command = {
    type: 'commit',
    token: soloToken,
    requestId: 'ttl-solo-draw-0001',
    revision: 0,
    operation: { type: 'draw', seatId: 'P1', count: 1 },
  };
  const committed = await json(await handleCockpitSession(request(command), storage, 3_000));
  expect(committed.expiresAt).toBe(3_000 + COCKPIT_TTL_MS);

  const reconciled = await json(
    await handleCockpitSession(
      request({ type: 'read', token: soloToken, requestId: command.requestId }),
      storage,
      4_000,
    ),
  );
  expect(reconciled.receipt).toBe('committed');
  expect(reconciled.expiresAt).toBe(committed.expiresAt);

  const replayed = await json(await handleCockpitSession(request(command), storage, 5_000));
  expect(replayed.revision).toBe(committed.revision);
  expect(replayed.expiresAt).toBe(committed.expiresAt);

  const expired = await handleCockpitSession(
    request({ type: 'read', token: soloToken }),
    storage,
    committed.expiresAt,
  );
  expect(expired.status).toBe(410);
  expect(await expired.json()).toEqual({ error: 'SESSION_EXPIRED' });
});

it('counts an explicit solo checkpoint as activity without making reads activity', async () => {
  const storage = database();
  await json(
    await handleCockpitSession(
      request({ type: 'create', token: soloToken, deck: makeDeck(20), seed: 1 }),
      storage,
      1_000,
    ),
  );
  const saved = await handleCockpitSession(
    request({ type: 'checkpoint', token: soloToken }),
    storage,
    3_000,
  );
  expect(saved.status).toBe(200);
  const after = await json(
    await handleCockpitSession(request({ type: 'read', token: soloToken }), storage, 4_000),
  );
  expect(after.expiresAt).toBe(3_000 + COCKPIT_TTL_MS);
});

it('does not extend multiplayer TTL for owner poll/connect or duplicate receipt, but does for a fresh play action', async () => {
  const storage = database();
  let connectionId = 'ttl-owner-connection-0001';
  const token = '1'.repeat(64);
  const withOwner = (body: Record<string, unknown>) => ({ token, connectionId, ...body });

  const created = await json(
    await handleCockpitSession(
      request(withOwner({ type: 'create', seats: 2, seed: 1, deck: makeDeck(20) })),
      storage,
      1_000,
    ),
  );
  expect(created.expiresAt).toBe(1_000 + COCKPIT_TTL_MS);

  const poll = await json(
    await handleCockpitSession(request(withOwner({ type: 'read' })), storage, 10_000),
  );
  expect(poll.expiresAt).toBe(created.expiresAt);

  connectionId = 'ttl-owner-connection-0002';
  const connected = await json(
    await handleCockpitSession(request(withOwner({ type: 'connect' })), storage, 20_000),
  );
  expect(connected.expiresAt).toBe(created.expiresAt);

  const command = withOwner({
    type: 'commit',
    requestId: 'ttl-owner-keep-0001',
    revision: 0,
    operation: { type: 'keep', seatId: 'P1', bottom: [] },
  });
  const kept = await json(await handleCockpitSession(request(command), storage, 25_000));
  expect(kept.expiresAt).toBe(25_000 + COCKPIT_TTL_MS);

  const duplicate = await json(await handleCockpitSession(request(command), storage, 30_000));
  expect(duplicate.expiresAt).toBe(kept.expiresAt);
  expect(duplicate.revision).toBe(kept.revision);
});

it('lets other-seat presence polling continue while the owner is absent without moving the actual deadline', async () => {
  const storage = database();
  const credentials = [
    { token: '1'.repeat(64), connectionId: 'ttl-room-p1-connection' },
    { token: '2'.repeat(64), connectionId: 'ttl-room-p2-connection' },
  ];
  let revision = 0;
  const call = async (index: number, body: Record<string, unknown>, now: number) => {
    const response = await handleCockpitSession(
      request({ ...credentials[index], ...body }),
      storage,
      now,
    );
    const value = (await response.json()) as CockpitSessionView & { error?: string };
    if (response.ok) revision = value.revision;
    return { response, value };
  };
  const change = (index: number, operation: Record<string, unknown>, now: number, control = false) =>
    call(
      index,
      {
        type: control ? 'control' : 'commit',
        requestId: crypto.randomUUID(),
        revision,
        [control ? 'control' : 'operation']: operation,
      },
      now,
    );

  const created = await call(0, { type: 'create', seats: 2, seed: 1, deck: makeDeck(20) }, 1_000);
  expect(created.response.status).toBe(200);
  const invitation = created.value.multiplayer!.invitation;
  expect((await call(1, { type: 'join', invitation, deck: makeDeck(20) }, 2_000)).response.status).toBe(200);
  expect((await change(0, { type: 'keep', seatId: 'P1', bottom: [] }, 3_000)).response.status).toBe(200);
  expect((await change(1, { type: 'keep', seatId: 'P2', bottom: [] }, 4_000)).response.status).toBe(200);
  const started = await change(0, { type: 'start' }, 5_000, true);
  expect(started.response.status).toBe(200);
  const deadline = started.value.expiresAt;
  expect(deadline).toBe(5_000 + COCKPIT_TTL_MS);

  const absentPoll = await call(1, { type: 'read' }, 36_000);
  expect(absentPoll.response.status).toBe(200);
  expect(absentPoll.value.multiplayer!.paused).toBe(true);
  expect(absentPoll.value.expiresAt).toBe(deadline);

  const latePoll = await call(1, { type: 'read' }, deadline - 1);
  expect(latePoll.response.status).toBe(200);
  expect(latePoll.value.expiresAt).toBe(deadline);

  const expired = await call(1, { type: 'read' }, deadline);
  expect(expired.response.status).toBe(410);
  expect(expired.value.error).toBe('SESSION_EXPIRED');
});
''')

Path('src/components/game/CockpitRoomExpiry.test.tsx').write_text(r'''import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import { CockpitRoomControls } from './CockpitRoomControls';

it('shows the exact server expiry and explains that observation/reconnect do not extend it', () => {
  const table = createCockpitTable(makeDeck(20), 1);
  const expiresAt = Date.UTC(2026, 8, 14, 15, 0, 0);
  const counts = Object.fromEntries(
    table.seats.map((seat) => [
      seat.id,
      Object.fromEntries(Object.entries(seat.zones).map(([zone, ids]) => [zone, ids.length])),
    ]),
  );
  const view = {
    table,
    revision: 0,
    expiresAt,
    canUndo: false,
    canRedo: false,
    receipt: null,
    multiplayer: {
      ownSeatId: 'P1',
      ownerId: 'P1',
      masterId: 'P1',
      started: true,
      paused: false,
      holds: [],
      borrowedFrom: null,
      canOperate: true,
      invitation: null,
      members: table.seats.map((seat) => ({ seatId: seat.id, connected: true, kicked: false })),
      counts,
      peek: null,
    },
  } as CockpitSessionView;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <CockpitRoomControls
          view={view}
          invitation={null}
          busy={false}
          send={vi.fn(() => Promise.resolve(null))}
        />,
      ),
    );
    const expiry = host.querySelector<HTMLElement>('[data-testid="session-expiry"]')!;
    const time = expiry.querySelector<HTMLTimeElement>('time')!;
    expect(time.dateTime).toBe(new Date(expiresAt).toISOString());
    expect(expiry.textContent).toContain('閲覧・自動再接続では延長しません');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
''')

print('stage8 TTL policy transform complete')
