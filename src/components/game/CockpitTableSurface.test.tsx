import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import { CockpitTableSurface } from './CockpitTableSurface';

function mount(
  view: CockpitSessionView,
  boardChoice?: (id: string) => void,
  selected: string[] = [],
) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const select = vi.fn<(ids: string[]) => void>(),
    inspect = vi.fn(),
    send = vi.fn<React.ComponentProps<typeof CockpitTableSurface>['send']>(() =>
      Promise.resolve(true),
    ),
    chooseSeat = vi.fn();
  act(() =>
    root.render(
      <CockpitTableSurface
        view={view}
        boardChoice={boardChoice}
        disabled={false}
        pending={false}
        selected={selected}
        boardTarget={boardChoice ? selected[0] : undefined}
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

it('reads opening cards without selecting, then starts only after the keep receipt', async () => {
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
    const cards = screen.host.querySelectorAll<HTMLElement>('.mulligan-stage__card');
    expect(cards).toHaveLength(7);
    act(() => cards[0].click());
    expect(screen.host.querySelector('.mulligan-stage__preview')).not.toBeNull();
    expect(screen.inspect).not.toHaveBeenCalled();
    act(() => screen.host.querySelector<HTMLButtonElement>('.mulligan-stage__preview')!.click());
    expect(screen.select).not.toHaveBeenCalled();
    expect(screen.send).not.toHaveBeenCalled();
    const keep = [...screen.host.querySelectorAll('button')].find(
      (button) => button.dataset.testid === 'mulligan-keep',
    )!;
    await act(async () => {
      keep.click();
      await screen.send.mock.results[0].value;
    });
    expect(screen.send.mock.calls.map(([op]) => op)).toEqual([
      { type: 'keep', seatId: 'P1', bottom: [] },
      { type: 'turn.ready' },
    ]);
  } finally {
    screen.close();
  }
});

it('opens the large-hand workspace and reaches all 100 hand cards and permanents through search', () => {
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
    expect(screen.host.querySelectorAll('.table-home [data-layout-card-id]')).toHaveLength(100);
    expect(screen.host.querySelectorAll('.hand-ribbon [data-layout-card-id]')).toHaveLength(0);
    act(() =>
      screen.host.querySelector<HTMLButtonElement>('[data-testid=large-hand-open]')!.click(),
    );
    expect(screen.host.querySelectorAll('.hand-ribbon [data-layout-card-id]')).toHaveLength(100);
    act(() => button('検索・選択').click());
    expect(screen.host.querySelectorAll('.table-zone-cards [data-card-id]')).toHaveLength(24);
    for (let index = 0; index < 4; index++)
      act(() => screen.host.querySelector<HTMLButtonElement>('[aria-label="次のページ"]')!.click());
    const visible = screen.host.querySelectorAll<HTMLElement>('.table-zone-cards [data-card-id]');
    expect(visible).toHaveLength(4);
    expect(visible[3].dataset.cardId).toBe(table.seats[0].zones.hand[99]);
    act(
      () =>
        void visible[3]
          .querySelector<HTMLElement>('[role="button"]')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    );
    expect(screen.inspect).toHaveBeenLastCalledWith(table.seats[0].zones.hand[99]);
    expect(screen.select).not.toHaveBeenCalled();
    expect(screen.send).not.toHaveBeenCalled();
    act(() => visible[3].querySelector<HTMLElement>('[role="button"]')!.click());
    expect(screen.select).toHaveBeenLastCalledWith([table.seats[0].zones.hand[99]]);
    act(() => button('検索結果を全選択 (100)').click());
    expect(screen.select).toHaveBeenLastCalledWith(table.seats[0].zones.hand);
    act(() =>
      screen.host.querySelector<HTMLButtonElement>('[aria-label="手札"] .modal__close')!.click(),
    );
    act(() => button('戦場一覧').click());
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
      [...screen.host.querySelectorAll('.hand-ribbon [data-layout-card-id]')].map((node) =>
        node.getAttribute('data-layout-card-id'),
      );
    expect(hand()).toEqual(table.seats[2].zones.hand);
    expect(screen.host.querySelectorAll('.table-opponent')).toHaveLength(3);
    act(() => screen.host.querySelector<HTMLButtonElement>('.table-opponent__identity')!.click());
    expect(hand()).toEqual(table.seats[2].zones.hand);
    expect(screen.chooseSeat).not.toHaveBeenCalled();
    expect(screen.send).not.toHaveBeenCalled();
    act(() => screen.host.querySelector<HTMLButtonElement>('.table-mana-toggle')!.click());
    act(() =>
      screen.host.querySelector<HTMLButtonElement>('[aria-label="Gマナを1増やす"]')!.click(),
    );
    expect(screen.send).toHaveBeenLastCalledWith({
      type: 'mana',
      seatId: 'P3',
      color: 'G',
      delta: 1,
    });
    expect(
      screen.host.querySelector<HTMLButtonElement>('[aria-label="Gマナを1減らす"]')!.disabled,
    ).toBe(true);
    act(() =>
      screen.host
        .querySelector<HTMLButtonElement>('[aria-label="マナ・プール"] .modal__close')!
        .click(),
    );
    const openWork = [...screen.host.querySelectorAll('button')].find(
      (button) => button.textContent === '操作',
    )!;
    act(() => openWork.click());
    const draft = screen.host.querySelector<HTMLInputElement>('[aria-label="未確定の割当"]')!;
    draft.value = '3';
    const boardHand = screen.host.querySelector('.hand-ribbon');
    act(() => screen.host.querySelector<HTMLButtonElement>('[title="手札を展開"]')!.click());
    expect(screen.host.querySelector('.hand-ribbon')).toBe(boardHand);
    expect(boardHand!.getAttribute('data-layout')).toBe('workspace');
    expect(screen.host.querySelector('[aria-label="卓の操作"]')!.hasAttribute('hidden')).toBe(true);
    act(() =>
      [...screen.host.querySelectorAll('button')]
        .find((button) => button.textContent === '検索・選択')!
        .click(),
    );
    act(() =>
      screen.host.querySelector<HTMLElement>('.table-zone-cards .table-hand-index button')!.click(),
    );
    expect(screen.select).toHaveBeenLastCalledWith([table.seats[2].zones.hand[0]]);
    act(() => openWork.click());
    expect(draft.value).toBe('3');

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

it('shows physical attachments beside their target and restores them as loose cards when detached', () => {
  let table = createCockpitTable(makeDeck(30), 42);
  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });
  const [target, equipment, other] = table.seats[0].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [target, equipment, other],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, { type: 'attach', cardId: equipment, targetId: target });
  const show = () =>
    mount({ table, revision: 1, expiresAt: 0, canUndo: false, canRedo: false, receipt: null });
  let screen = show();
  try {
    const group = screen.host
      .querySelector(`.table-home [data-layout-card-id="${target}"]`)!
      .closest('.visual-card-bundle__slot')!;
    expect(
      group.querySelector(`.attachment-cluster [data-layout-card-id="${equipment}"]`),
    ).not.toBeNull();
    expect(
      screen.host.querySelectorAll(`.table-home [data-layout-card-id="${equipment}"]`),
    ).toHaveLength(1);
    act(() => group.querySelector<HTMLElement>('.attachment-cluster__toggle')!.click());
    expect(group.querySelector('.attachment-cluster')!.getAttribute('data-open')).toBe('true');
    expect(screen.send).not.toHaveBeenCalled();
    screen.close();
    table = applyTableOperation(table, { type: 'attach', cardId: equipment, targetId: null });
    screen = show();
    expect(screen.host.querySelectorAll('.table-home .attachment-cluster')).toHaveLength(0);
    expect(screen.host.querySelectorAll('.table-home [data-layout-card-id]')).toHaveLength(3);
  } finally {
    screen.close();
  }
});

it('keeps draft inputs and hand identity while peeking, without committing hidden work', () => {
  let table = createCockpitTable(makeDeck(30), 42);
  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });
  const screen = mount({
    table,
    revision: 1,
    expiresAt: 0,
    canUndo: false,
    canRedo: false,
    receipt: null,
  });
  try {
    const button = (text: string) =>
      [...screen.host.querySelectorAll('button')].find((node) => node.textContent === text)!;
    act(() => button('操作').click());
    const panel = screen.host.querySelector('[aria-label="卓の操作"]')!;
    const draft = panel.querySelector('input')!;
    draft.value = '3';
    const hand = screen.host.querySelector('.hand-ribbon');
    act(() =>
      [...panel.querySelectorAll('button')]
        .find((node) => node.textContent === '盤面を見る')!
        .click(),
    );
    expect(panel.querySelector('.modal__body')!.hasAttribute('hidden')).toBe(true);
    expect(screen.host.querySelector('.hand-ribbon')).toBe(hand);
    expect(screen.send).not.toHaveBeenCalled();
    act(() =>
      [...panel.querySelectorAll('button')]
        .find((node) => node.textContent === '作業を表示')!
        .click(),
    );
    expect(panel.querySelector('input')).toBe(draft);
    expect(draft.value).toBe('3');
  } finally {
    screen.close();
  }
});

it('routes board target selection separately from normal selection and quick actions', () => {
  let table = createCockpitTable(makeDeck(30), 42);
  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });
  const target = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [target],
    to: 'battlefield',
    position: 'top',
  });
  const choose = vi.fn();
  const screen = mount(
    { table, revision: 1, expiresAt: 0, canUndo: false, canRedo: false, receipt: null },
    choose,
    [target],
  );
  try {
    const card = screen.host.querySelector<HTMLElement>(
      `.table-home [data-layout-card-id="${target}"]`,
    )!;
    act(
      () =>
        void card
          .querySelector<HTMLElement>('.card-view')!
          .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })),
    );
    act(
      () =>
        void card
          .querySelector<HTMLElement>('.card-view')!
          .dispatchEvent(new MouseEvent('dblclick', { bubbles: true })),
    );
    expect(choose).toHaveBeenCalledWith(target);
    expect(screen.select).not.toHaveBeenCalled();
    expect(screen.inspect).not.toHaveBeenCalled();
    expect(screen.send).not.toHaveBeenCalled();
    expect(card.querySelector('.table-card__quick')).toBeNull();
    choose.mockClear();
    const image = card.querySelector<HTMLElement>('.card-view')!;
    act(
      () => void image.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    );
    expect(choose).toHaveBeenCalledExactlyOnceWith(target);
    expect(screen.inspect).not.toHaveBeenCalled();
    choose.mockClear();
    act(() => void image.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(choose).toHaveBeenCalledExactlyOnceWith(target);
    expect(screen.send).not.toHaveBeenCalled();
  } finally {
    screen.close();
  }
});

it('does not start a turn when keeping the hand fails', async () => {
  const table = createCockpitTable(makeDeck(30), 42);
  const screen = mount({
    table,
    revision: 1,
    expiresAt: 0,
    canUndo: false,
    canRedo: false,
    receipt: null,
  });
  screen.send.mockResolvedValue(false);
  try {
    await act(async () => {
      screen.host.querySelector<HTMLButtonElement>('[data-testid="mulligan-keep"]')!.click();
      await screen.send.mock.results[0].value;
    });
    expect(screen.send).toHaveBeenCalledExactlyOnceWith({ type: 'keep', seatId: 'P1', bottom: [] });
    expect(screen.host.querySelector('.mulligan-stage')).not.toBeNull();
  } finally {
    screen.close();
  }
});
