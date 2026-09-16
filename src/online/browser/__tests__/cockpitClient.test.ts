import { afterEach, expect, it, vi } from 'vitest';
import { CockpitClient, isCockpitTerminalFailure } from '../cockpitClient';
import { makeDeck } from '../../../engine/__tests__/helpers';

const key = 'mtg-onedeck:cockpit-connection-v1';
const clients: CockpitClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.dispose());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.removeItem(key);
});

it('serializes polling with commits and discards late replies after disposal without replaying', async () => {
  vi.useFakeTimers();
  localStorage.setItem(
    key,
    JSON.stringify({
      id: crypto.randomUUID(),
      token: 'a'.repeat(64),
      connectionId: crypto.randomUUID(),
      pending: null,
    }),
  );
  const receive = vi.fn();
  const issue = vi.fn();
  const requests: Record<string, unknown>[] = [];
  let late: ((response: Response) => void) | undefined;
  let delayRead = false;
  let revision = 0;
  const reply = () =>
    Response.json({ table: { seats: [] }, multiplayer: {}, revision, receipt: 'committed' });
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      if (typeof init.body !== 'string') throw new Error('Expected JSON request');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      requests.push(body);
      if (body.type === 'commit') revision++;
      if (body.type === 'read' && delayRead)
        return new Promise<Response>((resolve) => {
          late = resolve;
        });
      return Promise.resolve(reply());
    }),
  );
  const client = new CockpitClient(receive, issue);
  await client.reconnect();
  delayRead = true;
  await vi.advanceTimersByTimeAsync(1500);
  const committing = client.commit({ type: 'draw', seatId: 'P1', count: 1 }, { kind: 'unbound' });
  await Promise.resolve();
  expect(requests.filter((body) => body.type === 'commit')).toHaveLength(0);
  delayRead = false;
  late!(reply());
  await committing;
  expect(requests.filter((body) => body.type === 'commit')).toHaveLength(1);
  expect((JSON.parse(localStorage.getItem(key)!) as { pending: unknown }).pending).toBeNull();
  delayRead = true;
  await vi.advanceTimersByTimeAsync(1500);
  client.dispose();
  const received = receive.mock.calls.length;
  const stored = localStorage.getItem(key);
  const count = requests.length;
  late!(reply());
  await vi.advanceTimersByTimeAsync(30000);
  expect(receive).toHaveBeenCalledTimes(received);
  expect(issue).not.toHaveBeenCalled();
  expect(requests).toHaveLength(count);
  expect(localStorage.getItem(key)).toBe(stored);
});

function storedConnection() {
  return JSON.parse(localStorage.getItem(key)!) as {
    id: string;
    token: string;
    pending: { type: string } | null;
    previous?: { id: string; token: string };
  };
}
function existingConnection() {
  const connection = {
    id: crypto.randomUUID(),
    token: 'b'.repeat(64),
    connectionId: crypto.randomUUID(),
    pending: null,
  };
  localStorage.setItem(key, JSON.stringify(connection));
  return connection;
}
function testClient(recovered = vi.fn()) {
  const client = new CockpitClient(vi.fn(), vi.fn(), recovered);
  clients.push(client);
  return client;
}
const emptyView = () =>
  Response.json({
    table: { seats: [] },
    multiplayer: {},
    revision: 0,
    receipt: 'committed',
  });

it('clears definite rejections but retains an unknown commit until receipt reconciliation', async () => {
  vi.useFakeTimers();
  existingConnection();
  let code: string | null = null;
  let loseResponse = false;
  let commits = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      await Promise.resolve();
      const body = JSON.parse(init.body as string) as { type: string };
      if (body.type === 'commit') {
        commits++;
        if (loseResponse) throw new TypeError('synthetic response loss');
        if (code) return Response.json({ error: code }, { status: 422 });
      }
      return emptyView();
    }),
  );
  const client = testClient();
  await client.reconnect();
  for (const refusal of [
    'OPERATION_NOT_SAVED',
    'SESSION_SIZE_LIMIT',
    'TURN_HISTORY_LIMIT',
    'REQUEST_TOO_LARGE',
    'NO_UNDO',
    'NO_REDO',
    'REVISION_CONFLICT',
    'NOT_AUTHORIZED',
    'PREGAME_INCOMPLETE',
    'OWNER_ABSENT',
    'ELIMINATION_REQUIRES_CONTROL_REVIEW',
  ]) {
    code = refusal;
    await expect(client.commit({ type: 'draw', seatId: 'P1', count: 1 }, { kind: 'unbound' })).rejects.toMatchObject({
      code,
    });
    expect(storedConnection().pending).toBeNull();
    code = null;
    await expect(client.commit({ type: 'draw', seatId: 'P1', count: 1 }, { kind: 'unbound' })).resolves.toBeUndefined();
  }
  loseResponse = true;
  await expect(client.commit({ type: 'draw', seatId: 'P1', count: 1 }, { kind: 'unbound' })).rejects.toThrow();
  expect(storedConnection().pending?.type).toBe('commit');
  const sent = commits;
  await vi.advanceTimersByTimeAsync(30000);
  expect(commits).toBe(sent);
  loseResponse = false;
  await client.reconnect();
  expect(storedConnection().pending).toBeNull();
  expect(commits).toBe(sent);
});

it('automatically recovers read-only polling with bounded retries and does not seize a replaced connection', async () => {
  vi.useFakeTimers();
  existingConnection();
  let failure: 'network' | 'replaced' | null = null;
  let reads = 0;
  let connects = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      await Promise.resolve();
      const body = JSON.parse(init.body as string) as { type: string };
      if (body.type === 'connect') connects++;
      if (body.type === 'read') {
        reads++;
        if (failure === 'network') throw new TypeError('synthetic interruption');
        if (failure === 'replaced')
          return Response.json({ error: 'CONNECTION_REPLACED' }, { status: 403 });
      }
      return emptyView();
    }),
  );
  const recovered = vi.fn();
  const client = testClient(recovered);
  await client.reconnect();
  failure = 'network';
  await vi.advanceTimersByTimeAsync(1500);
  failure = null;
  await vi.advanceTimersByTimeAsync(12000);
  expect(reads).toBeGreaterThan(2);
  expect(recovered).toHaveBeenCalledTimes(1);
  expect(connects).toBe(1);
  failure = 'network';
  await vi.advanceTimersByTimeAsync(120000);
  const stopped = reads;
  await vi.advanceTimersByTimeAsync(120000);
  expect(reads).toBe(stopped);
  failure = null;
  await client.reconnect();
  failure = 'replaced';
  await vi.advanceTimersByTimeAsync(1500);
  const replaced = reads;
  await vi.advanceTimersByTimeAsync(30000);
  expect(reads).toBe(replaced);
  expect(connects).toBe(2);
});

it('keeps the previous connection on rejected join, including disposal and reload', async () => {
  vi.useFakeTimers();
  const previous = existingConnection();
  const destination = crypto.randomUUID();
  const invite = destination + '.' + crypto.randomUUID() + crypto.randomUUID();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith(destination)
          ? Response.json({ error: 'ADMISSION_CLOSED' }, { status: 403 })
          : emptyView(),
      ),
    ),
  );
  const client = testClient();
  await expect(client.join(makeDeck(8), invite)).rejects.toMatchObject({
    code: 'ADMISSION_CLOSED',
  });
  expect(storedConnection()).toMatchObject({
    id: previous.id,
    token: previous.token,
    pending: null,
  });
  client.dispose();
  await expect(testClient().reconnect()).resolves.toBe('recovered');
  expect(storedConnection().id).toBe(previous.id);
});

it('reconciles a lost join response once, preserving the previous connection until confirmed', async () => {
  vi.useFakeTimers();
  const previous = existingConnection();
  const destination = crypto.randomUUID();
  const invite = destination + '.' + crypto.randomUUID() + crypto.randomUUID();
  let joins = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      await Promise.resolve();
      const body = JSON.parse(init.body as string) as { type: string };
      if (body.type === 'join') {
        joins++;
        throw new TypeError('synthetic lost accepted response');
      }
      return emptyView();
    }),
  );
  const client = testClient();
  await expect(client.join(makeDeck(8), invite)).rejects.toThrow();
  expect(storedConnection().previous).toMatchObject({ id: previous.id, token: previous.token });
  expect(storedConnection().pending?.type).toBe('join');
  client.dispose();
  await testClient().reconnect();
  expect(joins).toBe(1);
  expect(storedConnection().id).toBe(destination);
  expect(storedConnection().pending).toBeNull();
  expect(storedConnection().previous).toBeUndefined();
});

it('distinguishes terminal refusal from unknown HTTP outcomes and preserves the stopped board', async () => {
  vi.useFakeTimers();
  existingConnection();
  let status = 500;
  let refusal = 'OPERATION_NOT_SAVED';
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { type: string };
      return Promise.resolve(
        body.type === 'commit' ? Response.json({ error: refusal }, { status }) : emptyView(),
      );
    }),
  );
  const client = testClient();
  await client.reconnect();
  await expect(client.commit({ type: 'draw', seatId: 'P1', count: 1 }, { kind: 'unbound' })).rejects.toMatchObject({
    retryable: true,
  });
  expect(storedConnection().pending?.type).toBe('commit');
  await client.reconnect();
  status = 410;
  refusal = 'SESSION_EXPIRED';
  const error = await client
    .commit({ type: 'draw', seatId: 'P1', count: 1 }, { kind: 'unbound' })
    .catch((value: unknown) => value);
  expect(error).toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(isCockpitTerminalFailure(error)).toBe(true);
  expect(storedConnection().pending).toBeNull();
  const count = vi.mocked(fetch).mock.calls.length;
  await vi.advanceTimersByTimeAsync(60000);
  await expect(client.commit({ type: 'draw', seatId: 'P1', count: 1 }, { kind: 'unbound' })).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(count);
});

it('keeps an uncertain destination until checked, then offers the retained old connection when admission never happened', async () => {
  vi.useFakeTimers();
  const previous = existingConnection();
  const destination = crypto.randomUUID();
  const invite = destination + '.' + crypto.randomUUID() + crypto.randomUUID();
  let joins = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { type: string };
      if (body.type === 'join') {
        joins++;
        return Promise.reject(new TypeError('Synthetic lost request'));
      }
      return Promise.resolve(
        url.endsWith(destination)
          ? Response.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 403 })
          : emptyView(),
      );
    }),
  );
  const first = testClient();
  await expect(first.join(makeDeck(8), invite)).rejects.toThrow();
  first.dispose();
  const reloaded = testClient();
  const rejected = await reloaded.reconnect().catch((error: unknown) => error);
  expect(rejected).toMatchObject({ code: 'AUTHENTICATION_REQUIRED', previousRestored: true });
  expect(isCockpitTerminalFailure(rejected)).toBe(false);
  expect(storedConnection()).toMatchObject({ id: previous.id, token: previous.token });
  await expect(reloaded.reconnect()).resolves.toBe('recovered');
  expect(joins).toBe(1);
});


it.each([
  ['expired', 'SESSION_EXPIRED', 410],
  ['kicked', 'AUTHENTICATION_REQUIRED', 403],
] as const)(
  'retained previous connection is revalidated before it is described as usable: %s',
  async (_label, previousFailure, status) => {
    vi.useFakeTimers();
    const previous = existingConnection();
    const destination = crypto.randomUUID();
    const invite = destination + '.' + crypto.randomUUID() + crypto.randomUUID();
    let previousUnavailable = false;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { type: string };
        if (url.endsWith(destination) && body.type === 'join')
          return Promise.resolve(Response.json({ error: 'ADMISSION_CLOSED' }, { status: 403 }));
        if (url.endsWith(previous.id) && previousUnavailable)
          return Promise.resolve(Response.json({ error: previousFailure }, { status }));
        return Promise.resolve(emptyView());
      }),
    );
    const client = testClient();
    const rejected = await client.join(makeDeck(8), invite).catch((error: unknown) => error);
    expect(rejected).toMatchObject({ code: 'ADMISSION_CLOSED', previousRestored: true });
    expect(rejected).toBeInstanceOf(Error);
    expect((rejected as Error).message).toContain(
      '元の卓の接続情報を保持しています。再接続して有効性を確認してください。',
    );
    expect((rejected as Error).message).not.toContain('元の卓へ戻れます');
    expect(storedConnection()).toMatchObject({
      id: previous.id,
      token: previous.token,
      pending: null,
    });

    previousUnavailable = true;
    const unavailable = await client.reconnect().catch((error: unknown) => error);
    expect(unavailable).toMatchObject({ code: previousFailure });
    expect(isCockpitTerminalFailure(unavailable)).toBe(true);
    expect(storedConnection()).toMatchObject({ id: previous.id, token: previous.token });
  },
);
