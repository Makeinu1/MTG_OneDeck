import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { ZoneViewerDialog } from './dialogs';

afterEach(() => document.body.replaceChildren());

describe('large zone recovery', () => {
  it.each(['graveyard', 'exile'] as const)('offers search and restores focus for a large %s', (zone) => {
    const state = buildVisualFixture('graveyard-deep').snapshot.state;
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();
    act(() => root.render(
      <ZoneViewerDialog
        zone={zone}
        cardIds={state.zones[zone]}
        state={state}
        onClose={onClose}
      />,
    ));

    const search = document.querySelector<HTMLInputElement>('[data-testid="zone-viewer-search"]');
    expect(search).not.toBeNull();
    expect(document.activeElement).toBe(search);
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(document.activeElement).toBe(opener);
  });
});
