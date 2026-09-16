import { afterEach, expect, it, vi } from 'vitest';
import type { TableOperation } from '../../../engine/cockpitTable';
import { CockpitClient } from '../cockpitClient';

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

it('routes Normal move/life/tap/counter/draw through protocol v2 Manual Event instead of legacy commit', async () => {
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
  const operations: TableOperation[] = [
    { type: 'move', ids: ['c1'], to: 'graveyard', position: 'top' },
    { type: 'life', seatIds: ['P1'], delta: -1 },
    { type: 'tap', ids: ['c1'], tapped: true },
    { type: 'counter', ids: ['c1'], seatIds: [], name: '+1/+1', delta: 1 },
    { type: 'draw', seatId: 'P1', count: 1 },
  ];
  for (const operation of operations) await client.commit(operation, { kind: 'unbound' });

  const commits = requests.filter((body) => body.type === 'commit');
  expect(commits).toHaveLength(operations.length);
  for (const commit of commits) {
    expect(commit).toMatchObject({
      protocolVersion: 2,
      context: { kind: 'unbound' },
      declaredCause: { kind: 'manual-event' },
    });
  }
});
