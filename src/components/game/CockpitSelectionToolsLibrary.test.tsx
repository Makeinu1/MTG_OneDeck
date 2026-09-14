import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { projectCockpit, type CockpitMultiplayer } from '../../online/cloudflare/cockpitMultiplayer';
import { CockpitSelectionTools } from './CockpitSelectionTools';
import type { CockpitLibraryAccess } from './cockpitLibraryAccess';

function projections(count = 2) {
  const table = createCockpitTable(makeDeck(24), 42);
  table.seats[0].kept = true;
  const multi: CockpitMultiplayer = {
    invitation: 'selection-private-library', started: true, masterId: 'P1', holds: [], borrowedFrom: null,
    members: { P1: { token: 'P1', connectionId: 'P1', lastSeen: 100, kicked: false, peek: null } },
  };
  const hidden = projectCockpit(table, multi, 'P1', 100);
  multi.members.P1.peek = { seatId: 'P1', zone: 'library', count };
  const bounded = projectCockpit(table, multi, 'P1', 100);
  return { hidden: hidden.table, bounded: bounded.table, total: hidden.multiplayer.counts.P1.library, peek: bounded.multiplayer.peek! };
}

function mount(table: CockpitTable, access: CockpitLibraryAccess) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<React.ComponentProps<typeof CockpitSelectionTools>['send']>(() => Promise.resolve(true));
  const render = (nextTable: CockpitTable, nextAccess: CockpitLibraryAccess) =>
    act(() => root.render(<CockpitSelectionTools table={nextTable} seatId="P1" selected={[]} disabled={false} send={send} browseLibrary={vi.fn()} libraryAccess={nextAccess} />));
  render(table, access);
  return { host, render, send, close() { act(() => root.unmount()); host.remove(); } };
}
function button(host: HTMLElement, text: string): HTMLButtonElement {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent === text)!;
}

it('acquires only requested top cards before milling and commits those confirmed ids', async () => {
  const { hidden, bounded, total } = projections(2);
  const request = vi.fn((count?: number) => { expect(count).toBe(2); return Promise.resolve(bounded); });
  const release = vi.fn(() => Promise.resolve(hidden));
  const access: CockpitLibraryAccess = { seatId: 'P1', totalCount: total, peek: null, request, release };
  const screen = mount(hidden, access);
  try {
    expect(button(screen.host, '切削').disabled).toBe(false);
    await act(async () => { button(screen.host, '切削').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(request).toHaveBeenCalledWith(2);
    expect(screen.send).toHaveBeenCalledWith({ type: 'move', ids: bounded.seats[0].zones.library.slice(0, 2), to: 'graveyard', position: 'top' });
    expect(release).toHaveBeenCalledTimes(1);
  } finally { screen.close(); }
});

it('invalidates an arranged private draft on same-length reorder and hides it after access loss', () => {
  const { hidden, bounded, total, peek } = projections(2);
  const access: CockpitLibraryAccess = {
    seatId: 'P1',
    totalCount: total,
    peek,
    request: () => Promise.resolve(bounded),
    release: () => Promise.resolve(hidden),
  };
  const screen = mount(bounded, access);
  try {
    act(() => button(screen.host, '占術').click());
    expect(screen.host.textContent).toContain('占術・上から2枚');
    expect(button(screen.host, '整理を確定').disabled).toBe(false);
    const reordered = structuredClone(bounded);
    [reordered.seats[0].zones.library[0], reordered.seats[0].zones.library[1]] = [reordered.seats[0].zones.library[1], reordered.seats[0].zones.library[0]];
    screen.render(reordered, access);
    expect(screen.host.textContent).toContain('山札の順序・カード・閲覧権限が変わりました');
    expect(button(screen.host, '整理を確定').disabled).toBe(true);
    screen.render(hidden, { ...access, peek: null });
    expect(screen.host.querySelector('.table-arrange-cards')).toBeNull();
    expect(button(screen.host, '整理を確定').disabled).toBe(true);
  } finally { screen.close(); }
});
