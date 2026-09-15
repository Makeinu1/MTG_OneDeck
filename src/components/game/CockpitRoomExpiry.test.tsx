import { act } from 'react';
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
  } as unknown as CockpitSessionView;
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
