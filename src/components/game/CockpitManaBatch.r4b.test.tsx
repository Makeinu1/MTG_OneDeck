import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitManaBatch } from './CockpitManaBatch';

it('commits generateBatch with the interaction context captured when the draft opened', async () => {
  let table = createCockpitTable(makeDeck(20), 42);
  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });
  const sourceId = table.seats[0].zones.hand[0];
  const def = table.defs[table.cards[sourceId].defId];
  def.typeLine = 'Basic Land — Forest';
  def.faces[0].typeLine = 'Basic Land — Forest';
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });

  const send = vi.fn(() => Promise.resolve(true));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = (current: typeof table) =>
    root.render(
      <CockpitManaBatch
        table={current}
        selected={[sourceId]}
        disabled={false}
        send={send}
      />,
    );

  act(() => render(table));
  try {
    const open = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'マナの出し方を確認',
    );
    expect(open).toBeTruthy();
    act(() => open!.click());

    const changed = structuredClone(table);
    changed.resolution = {
      id: 'resolution-after-draft-open',
      kind: 'activated',
      source: structuredClone(changed.cards[sourceId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'later resolution',
    };
    act(() => render(changed));

    const confirm = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'この内容でマナを出す',
    );
    expect(confirm).toBeTruthy();
    await act(async () => {
      confirm!.click();
      await Promise.resolve();
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ type: 'generateBatch' });
    expect(send.mock.calls[0][1]).toEqual({ kind: 'unbound' });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
