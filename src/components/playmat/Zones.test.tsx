import { DndContext } from '@dnd-kit/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Zones } from './Zones';
import type { HoverPreviewState } from '../../hooks/useHoverPreview';
import { useGameStore } from '../../store/gameStore';
import { makeDeck } from '../../engine/__tests__/helpers';

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

function dispatchMouseEvent(element: Element, type: 'click' | 'dblclick'): void {
  act(() => {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  });
}

function prepareStore() {
  useGameStore.getState().newGame(makeDeck(12), 1);
  const stateAfterNewGame = useGameStore.getState().state;
  if (!stateAfterNewGame) {
    throw new Error('game state was not initialized');
  }

  const graveyardCardId = stateAfterNewGame.zones.hand[0];
  const exileCardId = stateAfterNewGame.zones.hand[1];
  if (!graveyardCardId || !exileCardId) {
    throw new Error('test deck did not produce enough cards in hand');
  }

  useGameStore.getState().moveCard(graveyardCardId, 'graveyard');
  useGameStore.getState().moveCard(exileCardId, 'exile');

  return useGameStore.getState();
}

function renderZones(onOpenViewer = vi.fn(), onOpenLibraryMenu = vi.fn()) {
  const { state } = prepareStore();
  if (!state) {
    throw new Error('game state missing during render');
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <DndContext>
        <Zones
          state={state}
          onOpenViewer={onOpenViewer}
          onOpenLibraryMenu={onOpenLibraryMenu}
          onCardContextMenu={vi.fn()}
          onCommanderContextMenu={vi.fn()}
          onCardDoubleClick={vi.fn()}
          hoverPreview={HOVER_PREVIEW}
        />
      </DndContext>,
    );
  });

  return { container, root, onOpenViewer, onOpenLibraryMenu };
}

function cleanupRender(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('Zones', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows explicit view buttons for graveyard and exile', () => {
    const onOpenViewer = vi.fn();
    const { container, root } = renderZones(onOpenViewer);

    const graveyardView = container.querySelector('[data-testid="graveyard-view"]');
    const exileView = container.querySelector('[data-testid="exile-view"]');
    if (!(graveyardView instanceof HTMLButtonElement) || !(exileView instanceof HTMLButtonElement)) {
      throw new Error('zone view buttons were not rendered');
    }

    dispatchMouseEvent(graveyardView, 'click');
    dispatchMouseEvent(exileView, 'click');
    dispatchMouseEvent(graveyardView, 'dblclick');

    expect(onOpenViewer.mock.calls).toEqual([['graveyard'], ['exile']]);

    cleanupRender(root, container);
  });

  it('opens the library menu from the chip without drawing a card', () => {
    const onOpenLibraryMenu = vi.fn();
    const { container, root } = renderZones(vi.fn(), onOpenLibraryMenu);

    const libraryZone = container.querySelector('[data-testid="zone-library"]');
    if (!(libraryZone instanceof HTMLDivElement)) {
      throw new Error('library zone was not rendered');
    }

    const handBefore = useGameStore.getState().state!.zones.hand.length;
    dispatchMouseEvent(libraryZone, 'click');
    act(() => {
      libraryZone.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });

    expect(onOpenLibraryMenu).toHaveBeenCalledTimes(2);
    expect(useGameStore.getState().state!.zones.hand.length).toBe(handBefore);

    cleanupRender(root, container);
  });

  it('does not treat library double-click as a draw action', () => {
    const onOpenLibraryMenu = vi.fn();
    const { container, root } = renderZones(vi.fn(), onOpenLibraryMenu);

    const libraryZone = container.querySelector('[data-testid="zone-library"]');
    if (!(libraryZone instanceof HTMLDivElement)) {
      throw new Error('library zone was not rendered');
    }

    const handBefore = useGameStore.getState().state!.zones.hand.length;
    dispatchMouseEvent(libraryZone, 'dblclick');

    expect(onOpenLibraryMenu).not.toHaveBeenCalled();
    expect(useGameStore.getState().state!.zones.hand.length).toBe(handBefore);

    cleanupRender(root, container);
  });
});
