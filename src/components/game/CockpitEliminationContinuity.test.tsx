import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import { CockpitRoomControls } from './CockpitRoomControls';
import { CockpitTableSurface } from './CockpitTableSurface';

function counts(table: CockpitSessionView['table']) {
  return Object.fromEntries(
    table.seats.map((seat) => [
      seat.id,
      Object.fromEntries(Object.entries(seat.zones).map(([zone, ids]) => [zone, ids.length])),
    ]),
  ) as NonNullable<CockpitSessionView['multiplayer']>['counts'];
}

function multiplayerView(
  table: CockpitSessionView['table'],
  ownSeatId: string,
  masterId: string,
): CockpitSessionView {
  return {
    table,
    revision: 1,
    expiresAt: Date.UTC(2026, 8, 14, 18, 0, 0),
    canUndo: false,
    canRedo: false,
    receipt: null,
    multiplayer: {
      ownSeatId,
      ownerId: 'P1',
      masterId,
      started: true,
      paused: false,
      holds: [],
      borrowedFrom: null,
      canOperate:
        ownSeatId === masterId && !table.seats.find((seat) => seat.id === ownSeatId)?.eliminated,
      invitation: null,
      members: table.seats.map((seat) => ({ seatId: seat.id, connected: true, kicked: false })),
      counts: counts(table),
      peek: null,
    },
  };
}

it('keeps the full table renderable when another seat is eliminated', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 42, [deck, deck, deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  table = applyTableOperation(table, { type: 'eliminate', seatId: 'P4' });
  const view = multiplayerView(table, 'P1', 'P1');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    expect(() =>
      act(() =>
        root.render(
          <CockpitTableSurface
            view={view}
            disabled={false}
            pending={false}
            selected={[]}
            select={vi.fn()}
            inspect={vi.fn()}
            cast={vi.fn()}
            send={vi.fn(() => Promise.resolve(true))}
            openMenu={vi.fn()}
            seatId="P1"
            chooseSeat={vi.fn()}
            peek={vi.fn()}
          >
            <span>操作面</span>
          </CockpitTableSurface>,
        ),
      ),
    ).not.toThrow();
    expect(
      [...host.querySelectorAll('.table-opponent')].some((node) =>
        node.textContent?.includes('プレイヤー4・脱落'),
      ),
    ).toBe(true);
    expect(host.querySelectorAll('.table-opponent')).toHaveLength(3);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('keeps an eliminated participant as a spectator without offering HOLD', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 42, [deck, deck, deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  table = applyTableOperation(table, { type: 'eliminate', seatId: 'P2' });
  const view = multiplayerView(table, 'P2', 'P1');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <CockpitRoomControls view={view} invitation={null} busy={false} send={vi.fn()} />,
      ),
    );
    expect(host.textContent).toContain('脱落・観戦中');
    expect(host.textContent).not.toContain('HOLD・応答を要求');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('retains room-owner management after game elimination without restoring HOLD', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 42, [deck, deck, deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  table = applyTableOperation(table, { type: 'eliminate', seatId: 'P1' });
  const view = multiplayerView(table, 'P1', 'P2');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <CockpitRoomControls view={view} invitation={null} busy={false} send={vi.fn()} />,
      ),
    );
    expect(host.textContent).toContain('部屋主の管理操作は利用できます');
    expect(host.textContent).not.toContain('HOLD・応答を要求');
    expect(
      [...host.querySelectorAll('button')].some((button) =>
        button.textContent?.includes('部屋主が操作権を回収'),
      ),
    ).toBe(true);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
