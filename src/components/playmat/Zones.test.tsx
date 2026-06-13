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

function renderZones(onOpenViewer = vi.fn()) {
  const store = prepareStore();
  const state = store.state;
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
          store={store}
          onOpenViewer={onOpenViewer}
          onArrangeTop={vi.fn()}
          onMill={vi.fn()}
          onPeek={vi.fn()}
          onCardContextMenu={vi.fn()}
          onCommanderContextMenu={vi.fn()}
          onCardDoubleClick={vi.fn()}
          hoverPreview={HOVER_PREVIEW}
        />
      </DndContext>,
    );
  });

  return { container, root, onOpenViewer };
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

  it('does not add an extra draw during library double-click interactions', () => {
    const { container, root } = renderZones();

    const libraryZone = container.querySelector('[data-testid="zone-library"]');
    const drawButton = container.querySelector('[data-testid="library-draw"]');
    if (!(libraryZone instanceof HTMLDivElement) || !(drawButton instanceof HTMLButtonElement)) {
      throw new Error('library controls were not rendered');
    }

    const handBeforeZoneDoubleClick = useGameStore.getState().state!.zones.hand.length;
    dispatchMouseEvent(libraryZone, 'dblclick');
    expect(useGameStore.getState().state!.zones.hand.length).toBe(handBeforeZoneDoubleClick);

    dispatchMouseEvent(drawButton, 'click');
    dispatchMouseEvent(drawButton, 'click');
    dispatchMouseEvent(drawButton, 'dblclick');

    expect(useGameStore.getState().state!.zones.hand.length).toBe(handBeforeZoneDoubleClick + 2);

    cleanupRender(root, container);
  });
});
