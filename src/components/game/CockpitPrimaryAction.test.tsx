import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
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

function fetchStackTable() {
  const table = stackTable();
  const source = table.stack[0].source;
  const text =
    'Search your library for a basic land card, put it onto the battlefield, then shuffle.';
  table.stack[0].text = text;
  table.defs[source.defId].faces[source.faceIndex].oracleText = text;
  return table;
}

function mount(initialTable: CockpitTable = stackTable(), initialModalOpen = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<React.ComponentProps<typeof CockpitTableSurface>['send']>(() =>
    Promise.resolve(true),
  );
  const render = (table: CockpitTable, modalOpen = initialModalOpen) => {
    void act(() =>
      root.render(
        <CockpitTableSurface
          view={{ table, canUndo: false, canRedo: false }}
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
          peek={vi.fn(() => Promise.resolve())}
        >
          {null}
        </CockpitTableSurface>,
      ),
    );
  };
  render(initialTable);
  return {
    host,
    send,
    render,
    close() {
      void act(() => root.unmount());
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

    void act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
      ),
    );
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });

    screen.send.mockClear();
    void act(() => primary.click());
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });
  } finally {
    screen.close();
  }
});

it('does not fire the primary Enter shortcut while a child/modal decision owns input', () => {
  const screen = mount(stackTable(), true);
  try {
    void act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
      ),
    );
    expect(screen.send).not.toHaveBeenCalled();
  } finally {
    screen.close();
  }
});

it('releases a vanished fetch entry and does not revive its stale selection', () => {
  const table = fetchStackTable();
  const screen = mount(table);
  try {
    void act(() =>
      screen.host.querySelector<HTMLButtonElement>('[data-testid="primary-action"]')!.click(),
    );
    expect(screen.host.querySelector('[aria-label="土地の名前で検索"]')).not.toBeNull();
    expect(screen.send).not.toHaveBeenCalled();

    const withoutEntry = structuredClone(table);
    withoutEntry.stack = [];
    screen.render(withoutEntry);
    expect(screen.host.querySelector('[aria-label="土地の名前で検索"]')).toBeNull();

    screen.send.mockClear();
    void act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
      ),
    );
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'phase' });

    screen.send.mockClear();
    screen.render(table);
    expect(screen.host.querySelector('[aria-label="土地の名前で検索"]')).toBeNull();
  } finally {
    screen.close();
  }
});
