import { afterEach, expect, it, vi } from 'vitest';
import { CockpitClient, isCockpitOperationRejection } from '../cockpitClient';

const key = 'mtg-onedeck:cockpit-connection-v1';
const clients: CockpitClient[] = [];

afterEach(() => {
  clients.splice(0).forEach((client) => client.dispose());
  vi.unstubAllGlobals();
  localStorage.removeItem(key);
});

function connectState() {
  localStorage.setItem(
    key,
    JSON.stringify({
      id: crypto.randomUUID(),
      token: 'a'.repeat(64),
      connectionId: crypto.randomUUID(),
      pending: null,
    }),
  );
}

it('sends explicit captured context and declared cause as protocol v2 receipt identity', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  let revision = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      requests.push(body);
      if (body.type === 'commit') revision += 1;
      return Promise.resolve(
        Response.json({
          table: { seats: [] },
          revision,
          receipt: 'committed',
          canUndo: false,
          canRedo: false,
          expiresAt: 0,
          recentActions: [],
        }),
      );
    }),
  );

  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  await client.commitV2(
    { type: 'life', seatIds: ['P1'], delta: -1 },
    { kind: 'unbound' },
    { kind: 'manual-event' },
  );

  const commit = requests.find((body) => body.type === 'commit')!;
  expect(commit).toMatchObject({
    protocolVersion: 2,
    context: { kind: 'unbound' },
    declaredCause: { kind: 'manual-event' },
    operation: { type: 'life', seatIds: ['P1'], delta: -1 },
  });
});

it('keeps context-less legacy commit compatible until its UI journey is migrated', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  let revision = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      requests.push(body);
      if (body.type === 'commit') revision += 1;
      return Promise.resolve(
        Response.json({
          table: { seats: [] },
          revision,
          receipt: 'committed',
          canUndo: false,
          canRedo: false,
          expiresAt: 0,
        }),
      );
    }),
  );

  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  await client.commit({ type: 'draw', seatId: 'P1', count: 1 });

  const commit = requests.find((body) => body.type === 'commit')!;
  expect(commit).not.toHaveProperty('protocolVersion');
  expect(commit).not.toHaveProperty('declaredCause');
});

it('treats v2 gate/update responses as definite unsaved rejections', async () => {
  connectState();
  let reject = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      if (body.type === 'commit' && reject)
        return Promise.resolve(Response.json({ error: 'CLIENT_UPDATE_REQUIRED' }, { status: 409 }));
      return Promise.resolve(
        Response.json({
          table: { seats: [] },
          revision: 0,
          receipt: 'committed',
          canUndo: false,
          canRedo: false,
          expiresAt: 0,
        }),
      );
    }),
  );

  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  reject = true;
  let caught: unknown;
  try {
    await client.commitV2(
      { type: 'life', seatIds: ['P1'], delta: -1 },
      { kind: 'unbound' },
      { kind: 'manual-event' },
    );
  } catch (error) {
    caught = error;
  }
  expect(isCockpitOperationRejection(caught)).toBe(true);
  expect((caught as Error).message).toContain('再読み込み');
  const persisted = JSON.parse(localStorage.getItem(key)!) as { pending: unknown };
  expect(persisted.pending).toBeNull();
});
