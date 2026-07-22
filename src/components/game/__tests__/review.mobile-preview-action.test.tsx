import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../../dev/visualFixtures/fixtureBuilder';
import { CardPreview } from '../CardPreview';

afterEach(() => {
  document.body.replaceChildren();
});

describe('review: mobile preview action', () => {
  it('offers an explicit action-menu button from the pinned preview', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const cardId = state.zones.hand[0];
    const instance = { ...state.cards[cardId], faceDown: true };
    const onOpenMenu = vi.fn();
    const onOwningCardClick = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(
      <div onClick={onOwningCardClick}>
        <CardPreview
          instance={instance}
          def={undefined}
          anchor={{ x: 100, y: 100 }}
          onOpenMenu={onOpenMenu}
        />
      </div>,
    ));

    const button = document.querySelector<HTMLButtonElement>('[data-testid="card-preview-menu-action"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('カード操作を開く');
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(onOwningCardClick).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
