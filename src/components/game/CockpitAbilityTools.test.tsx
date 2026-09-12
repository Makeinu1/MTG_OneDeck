import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { CockpitAbilityTools } from './CockpitAbilityTools';

it('previews supported costs immediately and commits them only on explicit activation', async () => {
  const def = makeDef({
    scryfallId: 'fetch',
    typeLine: 'Land',
    faces: [
      {
        name: 'Fetch',
        typeLine: 'Land',
        oracleText:
          '{T}, Pay 1 life, Sacrifice this land: Search your library for a Forest card, put it onto the battlefield, then shuffle.',
      },
    ],
  });
  let table = createCockpitTable([...makeDeck(20), { def, isCommander: false }], 42);
  const id = Object.values(table.cards).find((card) => card.defId === 'fetch')!.id;
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
        <CockpitAbilityTools
          table={table}
          sourceId={id}
          selected={[]}
          disabled={false}
          send={send}
          expanded
        />,
      ),
    );
    expect(host.textContent).toContain('ライフ -1');
    expect(send).not.toHaveBeenCalled();
    const activate = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'コストを支払って起動する',
    )!;
    expect(activate.disabled).toBe(false);
    await act(async () => {
      activate.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'activate', sourceId: id, manualCosts: null }),
    );
  } finally {
    act(() => root.unmount());
  }
});
