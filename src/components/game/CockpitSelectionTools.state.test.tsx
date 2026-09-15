import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitSelectionTools } from './CockpitSelectionTools';

it('commits selected battlefield cards through the explicit state.apply journey', async () => {
  let table = createCockpitTable(makeDeck(20), 41);
  const id = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [id],
    to: 'battlefield',
    position: 'top',
  });
  const host = document.createElement('div');
  const root = createRoot(host);
  const send = vi.fn(() => Promise.resolve(true));
  try {
    act(() =>
      root.render(
        <CockpitSelectionTools
          table={table}
          seatId="P1"
          selected={[id]}
          disabled={false}
          send={send}
          browseLibrary={vi.fn()}
        />,
      ),
    );
    const button = [...host.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === '選択したカードを状態起因処理で墓地へ',
    )!;
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledWith(
      { type: 'state.apply', graveyardIds: [id] },
      { kind: 'unbound' },
    );
  } finally {
    act(() => root.unmount());
  }
});
