import { afterEach, expect, it, vi } from 'vitest';
import { CockpitClient } from '../cockpitClient';

const key = 'mtg-onedeck:cockpit-connection-v1';
afterEach(() => {
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
  const committing = client.commit({ type: 'draw', seatId: 'P1', count: 1 });
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
