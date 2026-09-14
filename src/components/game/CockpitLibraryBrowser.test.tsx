import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { projectCockpit, type CockpitMultiplayer } from '../../online/cloudflare/cockpitMultiplayer';
import { CockpitTableSurface } from './CockpitTableSurface';

function fixture() {
  const table = createCockpitTable(makeDeck(24), 42);
  table.seats[0].kept = true;
  const multi: CockpitMultiplayer = {
    invitation: 'browser-private-library', started: true, masterId: 'P1', holds: [], borrowedFrom: null,
    members: { P1: { token: 'P1', connectionId: 'P1', lastSeen: 100, kicked: false, peek: null } },
  };
  const hidden = projectCockpit(table, multi, 'P1', 100);
  multi.members.P1.peek = { seatId: 'P1', zone: 'library' };
  const revealed = projectCockpit(table, multi, 'P1', 100);
  return { hidden, revealed };
}

it('general library entry distinguishes unrequested from empty and can start a private full browse', async () => {
  const { hidden, revealed } = fixture();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const peek = vi.fn(() => Promise.resolve(revealed.table));
  const render = (projection: typeof hidden) => act(() => root.render(
    <CockpitTableSurface
      view={{ table: projection.table, multiplayer: projection.multiplayer, canUndo: false, canRedo: false }}
      disabled={false} pending={false} selected={[]} select={vi.fn()} inspect={vi.fn()} cast={vi.fn()}
      send={vi.fn(() => Promise.resolve(true))} openMenu={vi.fn()} seatId="P1" chooseSeat={vi.fn()} peek={peek}
    >{null}</CockpitTableSurface>,
  ));
  render(hidden);
  try {
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="library-tile"]')!.click());
    expect(host.textContent).toContain(`未取得です。山札は${hidden.multiplayer.counts.P1.library}枚あります。`);
    expect(host.textContent).toContain('取得前の0件表示は候補0件を意味しません');
    const open = [...host.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent?.includes('この山札を自分だけ閲覧'))!;
    await act(async () => { open.click(); await Promise.resolve(); });
    expect(peek).toHaveBeenCalledWith('P1', 'library', undefined);
    render(revealed);
    expect(host.textContent).toContain('閲覧を終了');
    expect(host.textContent).not.toContain('取得前の0件表示は候補0件を意味しません');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
