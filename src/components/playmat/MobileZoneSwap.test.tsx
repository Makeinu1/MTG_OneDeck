import { DndContext } from '@dnd-kit/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileZoneSwap } from './MobileZoneSwap';
import type { HoverPreviewState } from '../../hooks/useHoverPreview';
import { useGameStore } from '../../store/gameStore';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';

const HOVER_PREVIEW: HoverPreviewState = {
  target: null,
  onMouseEnter: () => {},
  onMouseLeave: () => {},
  onPointerDown: () => {},
  onPointerMove: () => {},
  onPointerUp: () => {},
  onPointerCancel: () => {},
  suppress: () => {},
};

function renderMobileZoneSwap(state = useGameStore.getState().state) {
  if (!state) {
    throw new Error('game state missing during render');
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <DndContext>
        <MobileZoneSwap
          state={state}
          onOpenViewer={vi.fn()}
          onOpenLibraryMenu={vi.fn()}
          onCardContextMenu={vi.fn()}
          onCommanderContextMenu={vi.fn()}
          onCardDoubleClick={vi.fn()}
          hoverPreview={HOVER_PREVIEW}
        />
      </DndContext>,
    );
  });

  return { container, root };
}

function cleanupRender(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function dispatchClick(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

describe('MobileZoneSwap', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: true,
      mulliganDecisionPending: false,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('toggles between the commander and library views on a single tap', () => {
    const commander = makeDef({
      scryfallId: 'mobile-zone-commander',
      typeLine: 'Legendary Creature',
    });
    useGameStore.getState().newGame(makeDeck(12, [commander]), 1);

    const { container, root } = renderMobileZoneSwap();
    const toggle = container.querySelector('[data-testid="mobile-zone-swap-toggle"]');
    if (!(toggle instanceof HTMLButtonElement)) {
      throw new Error('mobile zone swap toggle was not rendered');
    }

    expect(container.querySelector('[data-testid="zone-command"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="zone-library"]')).toBeNull();

    dispatchClick(toggle); // single tap switches to library

    expect(container.querySelector('[data-testid="zone-command"]')).toBeNull();
    expect(container.querySelector('[data-testid="zone-library"]')).not.toBeNull();

    dispatchClick(toggle); // and back to command

    expect(container.querySelector('[data-testid="zone-command"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="zone-library"]')).toBeNull();

    cleanupRender(root, container);
  });

  it('defaults to the library view when the commander is absent, but the toggle is NOT locked', () => {
    const commander = makeDef({
      scryfallId: 'mobile-zone-commander-missing',
      typeLine: 'Legendary Creature',
    });
    useGameStore.getState().newGame(makeDeck(12, [commander]), 1);

    const state = useGameStore.getState().state;
    const commanderId = state?.zones.command[0];
    if (!state || !commanderId) {
      throw new Error('commander card was not initialized');
    }

    useGameStore.getState().moveCard(commanderId, 'battlefield');

    const { container, root } = renderMobileZoneSwap(useGameStore.getState().state);

    // defaults to library when the commander is not in the command zone
    expect(container.querySelector('[data-testid="zone-command"]')).toBeNull();
    expect(container.querySelector('[data-testid="zone-library"]')).not.toBeNull();

    // but the user can still toggle to the command view (no lock)
    const toggle = container.querySelector('[data-testid="mobile-zone-swap-toggle"]');
    if (!(toggle instanceof HTMLButtonElement)) {
      throw new Error('mobile zone swap toggle was not rendered');
    }
    dispatchClick(toggle);
    expect(container.querySelector('[data-testid="zone-command"]')).not.toBeNull();

    cleanupRender(root, container);
  });
});
