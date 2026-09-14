import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable, tableActivationPayment, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitTableSurface } from './CockpitTableSurface';

function withStack(text: string): CockpitTable {
  let table = createCockpitTable(makeDeck(30), 42);
  table.seats[0].kept = true;
  const sourceId = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });
  const manualCosts = {
    manaCost: '',
    life: 0,
    tapIds: [],
    sacrificeIds: [],
    discardIds: [],
    returnIds: [],
    exileIds: [],
    counters: [],
    note: '',
  };
  const proposal = tableActivationPayment(table, sourceId, 'manual', manualCosts);
  return applyTableOperation(table, {
    type: 'activate',
    id: 'primary-stack',
    sourceId,
    choice: 'manual',
    text,
    targets: [],
    manualCosts,
    paymentPlan: proposal.paid,
  });
}

function mount(initial: CockpitTable) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<ComponentProps<typeof CockpitTableSurface>['send']>(() => Promise.resolve(true));
  const render = (table: CockpitTable) =>
    act(() =>
      root.render(
        <CockpitTableSurface
          view={{ table, canUndo: false, canRedo: false }}
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
          peek={vi.fn(async () => {})}
        >
          <span />
        </CockpitTableSurface>,
      ),
    );
  render(initial);
  return {
    host,
    send,
    rerender: render,
    close() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

it('routes Enter and the visible primary button through the same contextual stack action', async () => {
  const screen = mount(withStack('Draw a card.'));
  try {
    const primary = screen.host.querySelector<HTMLButtonElement>('[data-testid="primary-action"]')!;
    expect(primary.title).toContain('↵');
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      await Promise.resolve();
    });
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });
    screen.send.mockClear();
    await act(async () => {
      primary.click();
      await Promise.resolve();
    });
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'resolve.begin' });
  } finally {
    screen.close();
  }
});

it('releases a vanished fetch workspace so the next-phase key works again', async () => {
  const screen = mount(
    withStack('Search your library for a basic land card, put it onto the battlefield, then shuffle your library.'),
  );
  try {
    act(() => screen.host.querySelector<HTMLButtonElement>('[data-testid="primary-action"]')!.click());
    expect(screen.send).not.toHaveBeenCalled();
    const cleared = structuredClone(withStack('Draw a card.'));
    cleared.stack = [];
    screen.rerender(cleared);
    screen.send.mockClear();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true }));
      await Promise.resolve();
    });
    expect(screen.send).toHaveBeenLastCalledWith({ type: 'phase' });
  } finally {
    screen.close();
  }
});
