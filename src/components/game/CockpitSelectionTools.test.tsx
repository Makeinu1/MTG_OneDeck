import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import {
  projectCockpit,
  type CockpitMultiplayer,
} from '../../online/cloudflare/cockpitMultiplayer';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import { useShortcuts } from '../../hooks/useShortcuts';
import { CockpitSelectionTools } from './CockpitSelectionTools';

function mount(table: CockpitTable) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn(() => Promise.resolve(true));
  const shortcut = vi.fn();
  function Scene({ current }: { current: CockpitTable }) {
    useShortcuts({
      keybindings: DEFAULT_KEYBINDINGS,
      isDialogOpen: false,
      onNextPhase: shortcut,
      onNextTurn: shortcut,
      onDraw: shortcut,
      onUndo: shortcut,
      onRedo: shortcut,
      onRestart: shortcut,
    });
    return (
      <CockpitSelectionTools
        table={current}
        seatId="P1"
        selected={[]}
        disabled={false}
        send={send}
        browseLibrary={vi.fn()}
      />
    );
  }
  const render = (current: CockpitTable) => act(() => root.render(<Scene current={current} />));
  const button = (text: string) =>
    [...host.querySelectorAll('button')].find((b) => b.textContent === text)!;
  const closeDialog = () =>
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="閉じる"]')!.click());
  render(table);
  return {
    host,
    send,
    shortcut,
    render,
    button,
    closeDialog,
    close() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

it('invalidates changed or hidden library choices without rendering private candidates or reviving stale ones', async () => {
  const deck = makeDeck(20);
  const table = createCockpitTable(deck, 1, [deck, deck]);
  const multi: CockpitMultiplayer = {
    invitation: 'synthetic',
    started: true,
    masterId: 'P1',
    holds: [],
    borrowedFrom: null,
    members: Object.fromEntries(
      ['P1', 'P2'].map((id) => [
        id,
        {
          token: id,
          connectionId: id,
          lastSeen: 100,
          kicked: false,
          peek: id === 'P1' ? { seatId: 'P1', zone: 'library' as const } : null,
        },
      ]),
    ),
  };
  const visible = projectCockpit(table, multi, 'P1', 100).table;
  const screen = mount(visible);
  try {
    act(() => screen.button('占術').click());
    expect(screen.host.querySelectorAll('.table-arrange-cards li')).toHaveLength(2);
    expect(screen.button('整理を確定').disabled).toBe(false);
    await act(async () => {
      screen.button('整理を確定').click();
      await screen.send.mock.results[0].value;
    });
    expect(screen.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'arrange' }));
    screen.send.mockClear();
    act(() => screen.button('諜報').click());
    multi.members.P1.peek = null;
    const hidden = projectCockpit(table, multi, 'P1', 100).table;
    screen.render(hidden);
    expect(screen.host.querySelector('[role="status"]')?.textContent).toContain('選び直して');
    expect(screen.host.querySelectorAll('.table-arrange-cards li')).toHaveLength(0);
    expect(screen.button('整理を確定').disabled).toBe(true);
    screen.render(visible);
    expect(screen.button('整理を確定').disabled).toBe(true);
    screen.closeDialog();
    act(() => screen.button('占術').click());
    const changed = structuredClone(visible);
    changed.seats[0].zones.library.reverse();
    screen.render(changed);
    expect(screen.button('整理を確定').disabled).toBe(true);
    screen.closeDialog();
    screen.render(visible);
    act(() => screen.button('占術').click());
    const returned = structuredClone(visible);
    returned.cards[returned.seats[0].zones.library[0]].zoneChangeCounter += 2;
    screen.render(returned);
    expect(screen.button('整理を確定').disabled).toBe(true);
    expect(screen.send).not.toHaveBeenCalled();
  } finally {
    screen.close();
  }
});

it('lets child choices own all game shortcuts until closed, including during board peek', () => {
  const screen = mount(createCockpitTable(makeDeck(20), 1));
  const key = (value: string, ctrlKey = false) => {
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: value, ctrlKey, bubbles: true, cancelable: true }),
      );
    });
  };
  try {
    key('ArrowUp');
    expect(screen.shortcut).toHaveBeenCalledTimes(1);
    screen.shortcut.mockClear();
    for (const label of ['占術', '諜報', '増殖の候補を選ぶ']) {
      act(() => screen.button(label).click());
      for (const value of ['ArrowUp', 'Enter', 'd', 'ArrowLeft', 'ArrowRight', ' ']) key(value);
      key('z', true);
      expect(screen.shortcut).not.toHaveBeenCalled();
      act(() => screen.button('盤面を見る').click());
      key('ArrowUp');
      expect(screen.shortcut).not.toHaveBeenCalled();
      screen.closeDialog();
    }
    key('ArrowUp');
    expect(screen.shortcut).toHaveBeenCalledTimes(1);
  } finally {
    screen.close();
  }
});
