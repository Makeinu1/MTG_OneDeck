import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitBattleTools } from './CockpitBattleTools';

function setup() {
  let table = createCockpitTable(
    makeDeck(20).map((item) => ({
      ...item,
      def: {
        ...item.def,
        faces: [{ name: item.def.name, typeLine: 'Creature', power: '3', toughness: '3' }],
      },
    })),
    1,
  );
  const id = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [id],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'battle.attack',
    attackers: [{ cardId: id, targetId: 'P2' }],
    tapIds: [id],
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host),
    send = vi.fn(() => Promise.resolve(true));
  const render = (next = table) =>
    act(() =>
      root.render(
        <CockpitBattleTools
          table={next}
          selected={[]}
          disabled={false}
          visible={false}
          send={send}
        />,
      ),
    );
  const button = (text: string) =>
    [...host.querySelectorAll('button')].find((item) => item.textContent === text)!;
  render();
  return {
    table,
    id,
    host,
    render,
    button,
    send,
    close: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}
it('prepares an editable unblocked assignment and commits damage in one operation', async () => {
  const s = setup();
  try {
    act(() => s.button('ブロックなしの割当を作る').click());
    expect(s.send).not.toHaveBeenCalled();
    expect(s.host.textContent).toContain('40 → 37');
    await act(async () => {
      s.button('このダメージを反映').click();
      await Promise.resolve();
    });
    expect(s.send).toHaveBeenCalledExactlyOnceWith({
      type: 'battle.apply',
      assignments: [{ sourceId: s.id, targetId: 'P2', amount: 3 }],
    });
  } finally {
    s.close();
  }
});
it('keeps a draft from committing after the attacking object changes', () => {
  const s = setup();
  try {
    act(() => s.button('ブロックなしの割当を作る').click());
    const next = applyTableOperation(s.table, {
      type: 'move',
      ids: [s.id],
      to: 'exile',
      position: 'top',
    });
    s.render(next);
    expect(s.button('このダメージを反映').disabled).toBe(true);
    expect(s.host.querySelector('[role="alert"]')?.textContent).toContain('変わりました');
    expect(s.send).not.toHaveBeenCalled();
  } finally {
    s.close();
  }
});

it('does not suggest unblocked damage after a blocker leaves and tolerates missing old visible cards', () => {
  const s = setup();
  try {
    const next = structuredClone(s.table);
    next.combat!.attackers[0].blocked = true;
    s.render(next);
    expect(s.host.textContent).toContain('ブロック済み（ブロッカーなし）');
    expect(s.button('ブロックなしの割当を作る').disabled).toBe(true);
    // Older persisted combat references can outlive cards in another seat's projection.
    delete next.cards[s.id];
    expect(() => s.render(next)).not.toThrow();
    expect(s.button('ブロックなしの割当を作る').disabled).toBe(true);
    expect(s.send).not.toHaveBeenCalled();
  } finally {
    s.close();
  }
});
