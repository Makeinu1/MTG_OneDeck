import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitCorrectionTools } from './CockpitCorrectionTools';

it('sends explicit repair operations with the Context captured when Correction starts', async () => {
  let table = createCockpitTable(makeDeck(20), 45);
  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });
  const cardId = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [cardId],
    to: 'battlefield',
    position: 'top',
  });
  const send = vi.fn(() => Promise.resolve(true));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);

  act(() =>
    root.render(
      <CockpitCorrectionTools
        table={table}
        seatId="P1"
        selected={[cardId]}
        disabled={false}
        shared={false}
        holdActive={false}
        send={send}
      />,
    ),
  );
  try {
    const begin = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '盤面訂正を始める',
    );
    expect(begin).toBeTruthy();
    act(() => begin!.click());
    const repair = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'ライフ値を訂正',
    );
    expect(repair).toBeTruthy();
    await act(async () => {
      repair!.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledWith(
      { type: 'repair.lifeTotal', seatId: 'P1', value: 40 },
      { kind: 'unbound' },
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('requires HOLD before shared Correction can start', () => {
  const table = createCockpitTable(makeDeck(20), 46);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <CockpitCorrectionTools
        table={table}
        seatId="P1"
        selected={[]}
        disabled={false}
        shared
        holdActive={false}
        send={vi.fn(() => Promise.resolve(true))}
      />,
    ),
  );
  try {
    const begin = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '盤面訂正を始める',
    ) as HTMLButtonElement | undefined;
    expect(begin?.disabled).toBe(true);
    expect(host.textContent).toContain('HOLD中だけ開始');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
