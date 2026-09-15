/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitAbilityTools } from './CockpitAbilityTools';

it('creates a Pending manual trigger instead of placing a synthetic activate entry directly on Stack', async () => {
  let table = createCockpitTable(makeDeck(20), 77);
  const sourceId = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });
  const host = document.createElement('div');
  const root = createRoot(host);
  const send = vi.fn(() => Promise.resolve(true));
  try {
    act(() =>
      root.render(
        <CockpitAbilityTools
          table={table}
          sourceId={sourceId}
          selected={[]}
          disabled={false}
          send={send}
          expanded
        />,
      ),
    );
    const abilitySelect = host.querySelector('select')!;
    await act(async () => {
      abilitySelect.value = 'triggered';
      abilitySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const textarea = host.querySelector('textarea')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    await act(async () => {
      setValue.call(textarea, 'When this happens, draw a card.');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const confirmation = [...host.querySelectorAll('label')].find((label) =>
      label.textContent?.includes('誘発内容を確認した'),
    )?.querySelector('input') as HTMLInputElement;
    expect(confirmation).toBeTruthy();
    await act(async () => confirmation.click());
    const review = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '登録内容を確認',
    )!;
    await act(async () => review.click());
    const add = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '誘発候補として追加',
    )!;
    await act(async () => {
      add.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'trigger.manualAdd',
        sourceId,
        text: 'When this happens, draw a card.',
      }),
    );
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'activate', choice: 'triggered' }),
    );
  } finally {
    act(() => root.unmount());
  }
});
