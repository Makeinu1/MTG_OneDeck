import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { projectCockpit, type CockpitMultiplayer } from '../../online/cloudflare/cockpitMultiplayer';
import { CockpitFetchSearch } from './CockpitFetchSearch';
import type { CockpitLibraryAccess } from './cockpitLibraryAccess';

function fixture() {
  const table = createCockpitTable(makeDeck(24), 42);
  table.seats[0].kept = true;
  const sourceId = table.seats[0].zones.hand[0];
  const landId = table.seats[0].zones.library[0];
  const landDef = table.defs[table.cards[landId].defId];
  landDef.typeLine = 'Basic Land — Forest';
  landDef.faces[0].typeLine = 'Basic Land — Forest';
  const text =
    'Search your library for a basic land card, put it onto the battlefield, then shuffle.';
  table.stack.unshift({
    id: 'fetch-entry',
    kind: 'activated',
    source: structuredClone(table.cards[sourceId]),
    controllerId: 'P1',
    targets: [],
    paid: [],
    text,
  });
  const multi: CockpitMultiplayer = {
    invitation: 'fetch-private-library',
    started: true,
    masterId: 'P1',
    holds: [],
    borrowedFrom: null,
    members: {
      P1: { token: 'P1', connectionId: 'P1', lastSeen: 100, kicked: false, peek: null },
    },
  };
  const hidden = projectCockpit(table, multi, 'P1', 100);
  multi.members.P1.peek = { seatId: 'P1', zone: 'library' };
  const revealed = projectCockpit(table, multi, 'P1', 100);
  return {
    hidden: hidden.table,
    revealed: revealed.table,
    total: hidden.multiplayer.counts.P1.library,
    landId,
  };
}

function mount(table: CockpitTable, access: CockpitLibraryAccess) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<React.ComponentProps<typeof CockpitFetchSearch>['send']>(() =>
    Promise.resolve(true),
  );
  const render = (nextTable: CockpitTable, nextAccess: CockpitLibraryAccess) =>
    act(() =>
      root.render(
        <CockpitFetchSearch
          table={nextTable}
          entry={nextTable.stack[0]}
          disabled={false}
          send={send}
          onClose={vi.fn()}
          libraryAccess={nextAccess}
        />,
      ),
    );
  render(table, access);
  return {
    host,
    render,
    send,
    close() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

it('does not call an unprojected multiplayer library empty and starts a full private lookup', async () => {
  const { hidden, revealed, total, landId } = fixture();
  const request = vi.fn(() => Promise.resolve(revealed));
  const release = vi.fn(() => Promise.resolve(hidden));
  const hiddenAccess: CockpitLibraryAccess = {
    seatId: 'P1',
    totalCount: total,
    peek: null,
    request,
    release,
  };
  const screen = mount(hidden, hiddenAccess);
  try {
    expect(screen.host.textContent).toContain('山札は未取得です');
    expect(screen.host.textContent).not.toContain('該当する土地はありません');

    const start = [...screen.host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('山札を閲覧して検索を開始'),
    )!;
    await act(async () => {
      start.click();
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledWith();

    const revealedAccess: CockpitLibraryAccess = {
      ...hiddenAccess,
      peek: { seatId: 'P1', zone: 'library' },
    };
    screen.render(revealed, revealedAccess);
    const expectedName =
      revealed.defs[revealed.cards[landId].defId].printedName ??
      revealed.defs[revealed.cards[landId].defId].name;
    expect(screen.host.querySelector(`[aria-label="《${expectedName}》を選ぶ"]`)).not.toBeNull();
  } finally {
    screen.close();
  }
});
