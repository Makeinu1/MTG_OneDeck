import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitCardTools } from './CockpitCardTools';

it('invalidates a detail-panel attachment target after that physical card blinks', async () => {
  let table = createCockpitTable(makeDeck(30), 1);
  const [sourceId, targetId] = table.seats[0].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId, targetId],
    to: 'battlefield',
    position: 'top',
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<ComponentProps<typeof CockpitCardTools>['send']>(() => Promise.resolve(true));
  const render = (next: CockpitTable) =>
    act(() => root.render(<CockpitCardTools table={next} cardId={sourceId} disabled={false} send={send} />));
  try {
    render(table);
    const select = host.querySelector<HTMLSelectElement>('[aria-label="取り付け先"]')!;
    act(() => {
      select.value = targetId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const attach = [...host.querySelectorAll('button')].find((button) => button.textContent === '取り付けする')!;
    expect(attach.disabled).toBe(false);

    table = applyTableOperation(table, { type: 'move', ids: [targetId], to: 'exile', position: 'top' });
    table = applyTableOperation(table, {
      type: 'move',
      ids: [targetId],
      to: 'battlefield',
      position: 'top',
    });
    render(table);
    expect(attach.disabled).toBe(true);
    expect(host.textContent).toContain('選んだ対象が変わりました。選び直してください。');
    act(() => attach.click());
    expect(send).not.toHaveBeenCalled();

    const currentSelect = host.querySelector<HTMLSelectElement>('[aria-label="取り付け先"]')!;
    act(() => {
      currentSelect.value = targetId;
      currentSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(attach.disabled).toBe(false);
    await act(async () => {
      attach.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenLastCalledWith({ type: 'attach', cardId: sourceId, targetId });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
