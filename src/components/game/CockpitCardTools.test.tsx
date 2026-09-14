import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitCardTools } from './CockpitCardTools';

function fixture() {
  let table = createCockpitTable(makeDeck(30), 42);
  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });
  const [sourceId, targetId] = table.seats[0].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId, targetId],
    to: 'battlefield',
    position: 'top',
  });
  return { table, sourceId, targetId };
}

function mount(initialTable: CockpitTable, cardId: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<React.ComponentProps<typeof CockpitCardTools>['send']>(() =>
    Promise.resolve(true),
  );
  const render = (table: CockpitTable) =>
    act(() =>
      root.render(<CockpitCardTools table={table} cardId={cardId} disabled={false} send={send} />),
    );
  render(initialTable);
  return {
    host,
    send,
    render,
    close() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

it('invalidates a detail attachment target when the physical card becomes a new object', () => {
  const { table, sourceId, targetId } = fixture();
  const screen = mount(table, sourceId);
  try {
    const target = screen.host.querySelector<HTMLSelectElement>('[aria-label="取り付けする対象"]')!;
    act(() => {
      target.value = targetId;
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(target.value).toBe(targetId);

    const oldVersion = table.cards[targetId].zoneChangeCounter;
    let blinked = applyTableOperation(table, {
      type: 'move',
      ids: [targetId],
      to: 'hand',
      position: 'top',
    });
    blinked = applyTableOperation(blinked, {
      type: 'move',
      ids: [targetId],
      to: 'battlefield',
      position: 'top',
    });
    expect(blinked.cards[targetId].zoneChangeCounter).toBeGreaterThan(oldVersion);

    screen.render(blinked);
    const currentTarget = screen.host.querySelector<HTMLSelectElement>(
      '[aria-label="取り付けする対象"]',
    )!;
    const attach = [...screen.host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === '取り付けする',
    )!;
    expect(currentTarget.value).toBe('');
    expect(attach.disabled).toBe(true);

    act(() => attach.click());
    expect(screen.send).not.toHaveBeenCalled();
  } finally {
    screen.close();
  }
});
