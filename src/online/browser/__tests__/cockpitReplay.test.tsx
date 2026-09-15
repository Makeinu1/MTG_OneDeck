import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CockpitClient } from '../cockpitClient';
import { makeDeck, makeDef } from '../../../engine/__tests__/helpers';
import {
  entriesFromExpandedDeck,
  expandSavedDeck,
  saveResolvedDeck,
  listSavedDecks,
  deleteSavedDeck,
  updateSavedDeckEntries,
} from '../../../data/savedDecks';
import { CockpitReplayButton } from '../../../components/game/CockpitReplayButton';

const key = 'mtg-onedeck:cockpit-connection-v1';
const clients: CockpitClient[] = [];
const roots: Root[] = [];
const client = () => {
  const value = new CockpitClient(() => {});
  clients.push(value);
  return value;
};
afterEach(async () => {
  clients.splice(0).forEach((c) => c.dispose());
  roots.splice(0).forEach((root) => act(() => root.unmount()));
  document.body.replaceChildren();
  localStorage.removeItem(key);
  vi.unstubAllGlobals();
  for (const saved of await listSavedDecks()) await deleteSavedDeck(saved.id);
});
const reply = () =>
  Response.json({
    table: { cards: {}, seats: [], ended: true },
    multiplayer: { ownSeatId: 'P1' },
    revision: 0,
    receipt: 'committed',
  });
function button(c: CockpitClient, replay = vi.fn()) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const load = vi.fn(() => c.loadReplayDeck());
  act(() =>
    root.render(
      <CockpitReplayButton disabled={false} seats={4} loadDeck={load} onReplay={replay} />,
    ),
  );
  return {
    host,
    replay,
    click: async () => {
      act(() => {
        host.querySelector('button')!.click();
      });
      await act(async () => {
        await load.mock.results.at(-1)!.value;
      });
    },
  };
}
it('replays the complete original local deck after a new client reconnects, not the projected board or another selected deck', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(reply())),
  );
  const input = makeDeck(12, [makeDef({ scryfallId: 'commander' })]);
  input.splice(1, 0, structuredClone(input[0]));
  const { deck: saved } = await saveResolvedDeck({
    deckText: 'original',
    entries: entriesFromExpandedDeck(input),
  });
  const original = expandSavedDeck(saved);
  const c = client();
  const incoming = structuredClone(original);
  await c.start(incoming, 4);
  incoming[0].def.name = 'caller changed';
  incoming.pop();
  expect(await c.loadReplayDeck()).toEqual(original);
  const copy = (await c.loadReplayDeck())!;
  copy.pop();
  expect(await c.loadReplayDeck()).toEqual(original);
  c.dispose();
  await saveResolvedDeck({ deckText: 'other', entries: entriesFromExpandedDeck(makeDeck(3)) });
  const resumed = client();
  await resumed.reconnect();
  const ui = button(resumed);
  await ui.click();
  expect(ui.replay).toHaveBeenCalledExactlyOnceWith(original, 4);
  expect(await listSavedDecks()).toContainEqual(saved);
  // An edited asset is not silently substituted for the original after another reload.
  await updateSavedDeckEntries(saved.id, entriesFromExpandedDeck(makeDeck(4)));
  expect(await resumed.loadReplayDeck()).toBeNull();
});
it('retains the old deck binding after a rejected join, and asks for selection if the source is missing or legacy', async () => {
  let reject = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      await Promise.resolve();
      const request = JSON.parse(init.body as string) as { type: string };
      return reject && request.type === 'join'
        ? Response.json({ error: 'ADMISSION_CLOSED' }, { status: 403 })
        : reply();
    }),
  );
  const { deck: saved } = await saveResolvedDeck({
    deckText: 'original',
    entries: entriesFromExpandedDeck(makeDeck(12)),
  });
  const original = expandSavedDeck(saved);
  const c = client();
  await c.start(original, 4);
  c.dispose();
  const joiner = client();
  reject = true;
  await expect(
    joiner.join(makeDeck(6), `${crypto.randomUUID()}.${'b'.repeat(72)}`),
  ).rejects.toThrow();
  joiner.dispose();
  const resumed = client();
  await resumed.reconnect();
  expect(await resumed.loadReplayDeck()).toEqual(original);
  await deleteSavedDeck(saved.id);
  const ui = button(resumed);
  await ui.click();
  expect(ui.replay).not.toHaveBeenCalled();
  expect(ui.host.textContent).toContain('デッキ選択へ戻る');
  expect(ui.host.querySelector('button')).toBeNull();
  resumed.dispose();
  const legacy = JSON.parse(localStorage.getItem(key)!) as { replayDeckDigest?: string };
  delete legacy.replayDeckDigest;
  localStorage.setItem(key, JSON.stringify(legacy));
  const old = client();
  await old.reconnect();
  expect(await old.loadReplayDeck()).toBeNull();
});
