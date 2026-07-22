import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { CardPreview } from './CardPreview';

afterEach(() => {
  document.body.replaceChildren();
});

describe('CardPreview mobile action', () => {
  it('opens the owning card menu through the explicit action', () => {
    const state = buildVisualFixture('mobile-density').snapshot.state;
    const instance = state.cards[state.zones.hand[0]];
    const onOpenMenu = vi.fn();
    const onOwningCardClick = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(
      <div onClick={onOwningCardClick}>
        <CardPreview
          instance={instance}
          def={state.defs[instance.defId]}
          anchor={{ x: 100, y: 100 }}
          onOpenMenu={onOpenMenu}
        />
      </div>,
    ));

    expect(document.querySelector('.game-card-preview__touch-hint')?.textContent)
      .toBe('もう一度タップでも開けます');
    const action = document.querySelector<HTMLButtonElement>('[data-testid="card-preview-menu-action"]');
    expect(action?.textContent).toContain('カード操作を開く');
    act(() => {
      action?.click();
    });
    expect(onOpenMenu).toHaveBeenCalledOnce();
    expect(onOwningCardClick).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
