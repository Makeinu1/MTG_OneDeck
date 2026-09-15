import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { emptyR4CastAdditionalCosts } from '../../engine/cockpitR4';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitCastAdditionalCosts } from './CockpitCastAdditionalCosts';

it('offers only finite atomic cast-cost primitives for selected cards', () => {
  let table = createCockpitTable(makeDeck(30), 42);
  table = applyTableOperation(table, { type: 'keep', seatId: 'P1', bottom: [] });
  const [castCardId, handId, battlefieldId] = table.seats[0].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [battlefieldId],
    to: 'battlefield',
    position: 'top',
  });
  table.cards[battlefieldId].counters.charge = 2;

  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onChange = vi.fn();
  act(() =>
    root.render(
      <CockpitCastAdditionalCosts
        table={table}
        castCardId={castCardId}
        selected={[handId, battlefieldId]}
        costs={emptyR4CastAdditionalCosts()}
        disabled={false}
        label={(id) => id}
        onChange={onChange}
      />,
    ),
  );

  try {
    expect(host.textContent).toContain('捨てる');
    expect(host.textContent).toContain('生け贄に捧げる');
    expect(host.textContent).toContain('手札へ戻す');
    expect(host.textContent).toContain('追放する');
    expect(host.textContent).toContain('chargeカウンターを取り除く');
    expect(host.textContent).not.toContain('任意の操作');

    const life = host.querySelector<HTMLInputElement>('input[type="number"][max="100000"]')!;
    act(() => {
      life.value = '3';
      life.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ life: 3 }),
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
