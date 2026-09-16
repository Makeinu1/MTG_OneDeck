import { afterEach, expect, it, vi } from 'vitest';
import { CockpitClient } from '../cockpitClient';
const key = 'mtg-onedeck:cockpit-connection-v1';
const clients: CockpitClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.dispose());
  vi.unstubAllGlobals();
  localStorage.removeItem(key);
});
function connectState() {
  localStorage.setItem(key, JSON.stringify({
    id: crypto.randomUUID(), token: 'a'.repeat(64), connectionId: crypto.randomUUID(), pending: null,
  }));
}
function stubRequests(requests: Record<string, unknown>[]) {
  let revision = 0;
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    requests.push(body);
    if (body.type === 'commit') revision += 1;
    return Promise.resolve(Response.json({
      table: { seats: [] }, revision, receipt: 'committed', canUndo: true, canRedo: true,
      expiresAt: 0, recentActions: [],
    }));
  }));
}
it('routes every representative Formal family through protocol v2', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  stubRequests(requests);
  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  const operations = [
    { type: 'phase' as const },
    { type: 'resolve.begin' as const },
    { type: 'trigger.dismiss' as const, candidateId: 'candidate-1', reason: 'test' },
    { type: 'battle.end' as const },
    { type: 'cleanup' as const, damageIds: [], grantIds: [], modifierIds: [], discardIds: [], seatId: 'P1' },
    { type: 'state.apply' as const, graveyardIds: [] },
    { type: 'end' as const },
    { type: 'commander.moveToCommand' as const, cardId: 'c1', objectId: 'c1:0' },
  ];
  for (const operation of operations) await client.commit(operation, { kind: 'unbound' });
  const commits = requests.filter((body) => body.type === 'commit');
  expect(commits).toHaveLength(operations.length);
  for (const commit of commits)
    expect(commit).toMatchObject({ protocolVersion: 2, context: { kind: 'unbound' } });
});
it('sends undo and redo through protocol v2 without inventing a gameplay Context', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  stubRequests(requests);
  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  await client.commit({ type: 'undo' });
  await client.commit({ type: 'redo' });
  const commits = requests.filter((body) => body.type === 'commit');
  expect(commits).toHaveLength(2);
  for (const commit of commits) {
    expect(commit).toMatchObject({ protocolVersion: 2 });
    expect(commit).not.toHaveProperty('context');
  }
});
it('fails a stack-effect Formal operation closed outside Resolution', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  stubRequests(requests);
  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  await expect(client.commit(
    { type: 'stack.remove', entryId: 'A', to: 'graveyard' }, { kind: 'unbound' },
  )).rejects.toThrow('Resolution');
  expect(requests.filter((body) => body.type === 'commit')).toHaveLength(0);
});
