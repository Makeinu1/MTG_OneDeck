import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitTableSurface } from './CockpitTableSurface';

function stackTable() {
  const table = createCockpitTable(makeDeck(30), 42);
  table.seats[0].kept = true;
  const sourceId = table.seats[0].zones.hand[0];
  table.stack.push({
    id: 'primary-stack-entry',
    kind: 'activated',
    source: structuredClone(table.cards[sourceId]),
    controllerId: 'P1',
    targets: [],
    paid: [],
    text: 'Draw a card.',
  });
  return table;
}

function mount(modalOpen = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const table = stackTable();
  const send = vi.fn(async () => true);
  act(() =>
    root.render(
      <CockpitTableSurface
        view={{
          table,
          canUndo: false,
          canRedo: false,
        }}
        modalOpen={modalOpen}
        disabled={false}
        pending={false}
        selected={[]}
        select={vi.fn()}
        inspect={vi.fn()}
        cast={vi.fn()}
        send={send}
        openMenu={vi.fn()}
        seatId="P1"
        chooseSeat={vi.fn()}
        peek={vi.fn(async () => undefined)}
      >
        {null}
      </CockpitTableSurface>,
    ),
  );
  return {
    host,
    send,
    close() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

it('routes Enter through the same contextual primary action as the visible button', () => {
  const screen = mount();
  try {
    const primary = screen.host.querySelector<HTMLButtonElement>('[data-testid="primary-action"]')!;
    expect(primary.textContent).toContain('解決');
    expect(primary.textContent).toContain('↵');

    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
      ),
    );
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });

    screen.send.mockClear();
    act(() => primary.click());
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });
  } finally {
    screen.close();
  }
});

it('does not fire the primary Enter shortcut while a child/modal decision owns input', () => {
  const screen = mount(true);
  try {
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
      ),
    );
    expect(screen.send).not.toHaveBeenCalled();
  } finally {
    screen.close();
  }
});
