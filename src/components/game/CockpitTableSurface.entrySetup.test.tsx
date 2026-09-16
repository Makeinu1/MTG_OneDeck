import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import { CockpitTableSurface } from './CockpitTableSurface';

it('binds PermanentEntrySetup to the exact resolving entry', async () => {
  const table = createCockpitTable(makeDeck(30), 72);
  table.seats[0].kept = true;
  const cardId = table.seats[0].zones.hand[0];
  const def = table.defs[table.cards[cardId].defId];
  def.faces[0].typeLine = 'Creature';
  def.faces[0].oracleText = 'Manual permanent text.';
  const card = table.cards[cardId];
  table.seats[0].zones.hand = table.seats[0].zones.hand.filter((id) => id !== cardId);
  card.zoneChangeCounter += 1;
  card.zone = 'stack';
  card.controllerId = card.ownerId;
  card.enteredTurn = 0;
  table.seats[0].zones.stack.unshift(cardId);
  const entry = {
    id: 'ui-entry-setup',
    kind: 'spell' as const,
    source: structuredClone(table.cards[cardId]),
    controllerId: 'P1',
    targets: [],
    paid: [],
    text: 'Manual permanent text.',
    stackCardId: cardId,
  };
  table.stack = [entry];
  table.resolution = structuredClone(entry);
  const view: CockpitSessionView = {
    table,
    revision: 1,
    expiresAt: 0,
    canUndo: false,
    canRedo: false,
    receipt: null,
  };
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<React.ComponentProps<typeof CockpitTableSurface>['send']>(() => Promise.resolve(true));
  try {
    act(() =>
      root.render(
        <CockpitTableSurface
          view={view}
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
          peek={vi.fn()}
        >
          {null}
        </CockpitTableSurface>,
      ),
    );
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="primary-action"]')!.click());
    const stackButton = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'スタック 1',
    )!;
    act(() => stackButton.click());
    const tapped = host.querySelector<HTMLInputElement>(
      '[data-testid="permanent-entry-setup"] input[type="checkbox"]',
    )!;
    act(() => tapped.click());
    const finish = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '処理完了',
    )!;
    await act(async () => {
      finish.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledWith(
      {
        type: 'resolve.end',
        entryId: 'ui-entry-setup',
        to: 'battlefield',
        entrySetup: { tapped: true },
      },
      { kind: 'resolution', entryId: 'ui-entry-setup' },
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
