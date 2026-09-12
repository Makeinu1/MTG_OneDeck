import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import { CockpitTableSurface } from './CockpitTableSurface';

function mount(view: CockpitSessionView) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const select = vi.fn<(ids: string[]) => void>(),
    inspect = vi.fn(),
    send = vi.fn(() => Promise.resolve(true)),
    chooseSeat = vi.fn();
  act(() =>
    root.render(
      <CockpitTableSurface
        view={view}
        disabled={false}
        pending={false}
        selected={[]}
        select={select}
        inspect={inspect}
        cast={vi.fn()}
        send={send}
        openMenu={vi.fn()}
        seatId="P2"
        chooseSeat={chooseSeat}
        peek={vi.fn()}
      >
        <input aria-label="未確定の割当" defaultValue="0" />
      </CockpitTableSurface>,
    ),
  );
  return {
    host,
    select,
    inspect,
    send,
    chooseSeat,
    close() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

it('reads opening cards without selecting or committing them, then explicitly keeps', () => {
  const table = createCockpitTable(makeDeck(30), 42);
  const screen = mount({
    table,
    revision: 1,
    expiresAt: 0,
    canUndo: false,
    canRedo: false,
    receipt: null,
  });
  try {
    const cards = screen.host.querySelectorAll<HTMLElement>('.table-opening [role="button"]');
    expect(cards).toHaveLength(7);
    act(() => cards[0].click());
    expect(screen.inspect).toHaveBeenCalledWith(table.seats[0].zones.hand[0]);
    expect(screen.select).not.toHaveBeenCalled();
    expect(screen.send).not.toHaveBeenCalled();
    const keep = [...screen.host.querySelectorAll('button')].find(
      (button) => button.textContent === '初手をキープ',
    )!;
    act(() => keep.click());
    expect(screen.send).toHaveBeenCalledWith({ type: 'keep', seatId: 'P1', bottom: [] });
  } finally {
    screen.close();
  }
});

it('bounds the rendered cards but reaches and selects all 100 hand cards and permanents', () => {
  let table = createCockpitTable(makeDeck(210), 42);
  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });
  table = applyTableOperation(table, {
    type: 'move',
    ids: table.seats[0].zones.library.slice(0, 100),
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, { type: 'draw', seatId: 'P1', count: 93 });
  const screen = mount({
    table,
    revision: 1,
    expiresAt: 0,
    canUndo: false,
    canRedo: false,
    receipt: null,
  });
  const button = (text: string) =>
    [...screen.host.querySelectorAll('button')].find((node) => node.textContent === text)!;
  try {
    expect(screen.host.querySelectorAll('.table-home [data-card-id]')).toHaveLength(12);
    expect(screen.host.querySelectorAll('.table-hand [data-card-id]')).toHaveLength(0);
    act(() => screen.host.querySelector<HTMLButtonElement>('.table-large-hand')!.click());
    expect(screen.host.querySelectorAll('.table-zone-cards [data-card-id]')).toHaveLength(24);
    for (let index = 0; index < 4; index++)
      act(() => screen.host.querySelector<HTMLButtonElement>('[aria-label="次のページ"]')!.click());
    const visible = screen.host.querySelectorAll<HTMLElement>('.table-zone-cards [data-card-id]');
    expect(visible).toHaveLength(4);
    expect(visible[3].dataset.cardId).toBe(table.seats[0].zones.hand[99]);
    act(() => visible[3].querySelector<HTMLElement>('[role="button"]')!.click());
    expect(screen.select).toHaveBeenLastCalledWith([table.seats[0].zones.hand[99]]);
    act(() => button('検索結果を全選択 (100)').click());
    expect(screen.select).toHaveBeenLastCalledWith(table.seats[0].zones.hand);
    act(() =>
      screen.host.querySelector<HTMLButtonElement>('[aria-label="手札"] .modal__close')!.click(),
    );
    act(() => button('全100枚を見る').click());
    act(() => button('検索結果を全選択 (100)').click());
    const ids = screen.select.mock.lastCall![0];
    expect(ids).toHaveLength(100);
    const tapped = applyTableOperation(table, { type: 'tap', ids, tapped: true });
    expect(ids.every((id: string) => tapped.cards[id].tapped)).toBe(true);
    expect(table.seats[0].zones.hand).toHaveLength(100);
    expect(screen.send).not.toHaveBeenCalled();
  } finally {
    screen.close();
  }
});

it('keeps the local hand anchored while inspecting another opponent or delegating operations', () => {
  const deck = makeDeck(30);
  const table = createCockpitTable(deck, 42, [deck, deck, deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  const screen = mount({
    table,
    revision: 1,
    expiresAt: 0,
    canUndo: false,
    canRedo: false,
    receipt: null,
    multiplayer: {
      ownSeatId: 'P3',
      ownerId: 'P1',
      masterId: 'P3',
      started: true,
      paused: false,
      holds: [],
      borrowedFrom: null,
      canOperate: true,
      invitation: null,
      members: [],
      counts: {},
      peek: null,
    },
  });
  try {
    const hand = () =>
      [...screen.host.querySelectorAll('.table-hand [data-card-id]')].map((node) =>
        node.getAttribute('data-card-id'),
      );
    expect(hand()).toEqual(table.seats[2].zones.hand);
    expect(screen.host.querySelectorAll('.table-opponent')).toHaveLength(3);
    act(() => screen.host.querySelector<HTMLButtonElement>('.table-opponent__identity')!.click());
    expect(hand()).toEqual(table.seats[2].zones.hand);
    expect(screen.chooseSeat).not.toHaveBeenCalled();
    expect(screen.send).not.toHaveBeenCalled();
    const openWork = [...screen.host.querySelectorAll('button')].find(
      (button) => button.textContent === '操作',
    )!;
    act(() => openWork.click());
    const draft = screen.host.querySelector<HTMLInputElement>('[aria-label="未確定の割当"]')!;
    draft.value = '3';
    act(() =>
      screen.host
        .querySelector<HTMLButtonElement>('[aria-label="卓の操作"] .modal__close')!
        .click(),
    );
    act(() => openWork.click());
    expect(screen.host.querySelector<HTMLInputElement>('[aria-label="未確定の割当"]')!.value).toBe(
      '3',
    );
  } finally {
    screen.close();
  }
});
