import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';

import { createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitPermanentEntrySetup } from './CockpitPermanentEntrySetup';
import {
  emptyPermanentEntrySetupDraft,
  permanentEntrySetupFromDraft,
} from './cockpitPermanentEntrySetup';

it('builds only the finite entry setup selected by the user', () => {
  const table = createCockpitTable(makeDeck(20), 71);
  const cardId = table.seats[0].zones.hand[0];
  const host = document.createElement('div');
  const root = createRoot(host);
  let value = emptyPermanentEntrySetupDraft();
  const render = () =>
    root.render(
      <CockpitPermanentEntrySetup
        table={table}
        cardId={cardId}
        value={value}
        onChange={(next) => {
          value = next;
          render();
        }}
      />,
    );
  try {
    act(render);
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(permanentEntrySetupFromDraft({ ...value, counterCount: 2 })).toEqual({
      tapped: true,
      counters: { '+1/+1': 2 },
    });
  } finally {
    act(() => root.unmount());
  }
});
