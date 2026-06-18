import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Playmat } from './Playmat';
import { useGameStore } from '../../store/gameStore';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';

const shortcutCapture = vi.hoisted(() => ({
  handlers: null as { onNextPhase: () => void } | null,
}));

vi.mock('../../hooks/useShortcuts', () => ({
  useShortcuts: (handlers: { onNextPhase: () => void }) => {
    shortcutCapture.handlers = handlers;
  },
}));

let activeRender: { container: HTMLDivElement; root: Root } | null = null;

function renderPlaymat() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Playmat keybindings={DEFAULT_KEYBINDINGS} />);
  });

  activeRender = { container, root };
  return activeRender;
}

function cleanupRender(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount();
  });
  container.remove();
  if (activeRender?.root === root) {
    activeRender = null;
  }
}

function dispatchDoubleClick(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  });
}

function dispatchClick(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const state = useGameStore.getState().state;
  if (!state) {
    throw new Error('game state is not available');
  }

  const card = Object.values(state.cards).find((instance) => instance.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }

  return card.id;
}

describe('Playmat', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
    vi.restoreAllMocks();
    shortcutCapture.handlers = null;
  });

  afterEach(() => {
    if (activeRender) {
      cleanupRender(activeRender.root, activeRender.container);
    }
    document.body.innerHTML = '';
  });

  it('renders the mulligan decision as a panel without a blocking modal backdrop', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
    });

    const handCardId = useGameStore.getState().state?.zones.hand[0];
    if (!handCardId) {
      throw new Error('opening hand card was not created');
    }

    const { container, root } = renderPlaymat();

    expect(container.querySelector('[data-testid="mulligan-decision-dialog"]')).not.toBeNull();
    expect(container.querySelector('.modal-backdrop')).toBeNull();
    expect(container.querySelector(`[data-testid="card-${handCardId}"]`)).not.toBeNull();

    cleanupRender(root, container);
  });

  it('double-clicking a hand spell routes through castToStack', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
    });
    const store = useGameStore.getState();
    const handCardId = store.state?.zones.hand[0];
    if (!handCardId) {
      throw new Error('hand card was not created');
    }

    const castToStack = vi.spyOn(store, 'castToStack').mockReturnValue('ok');
    const castFromHand = vi.spyOn(store, 'castFromHand').mockReturnValue('ok');
    const { container, root } = renderPlaymat();

    const card = container.querySelector(`[data-testid="card-${handCardId}"]`);
    if (!card) {
      throw new Error('hand card element was not rendered');
    }

    dispatchDoubleClick(card);

    expect(castToStack).toHaveBeenCalledWith(handCardId, { xValue: 0 });
    expect(castFromHand).not.toHaveBeenCalled();

    cleanupRender(root, container);
  });

  it('double-clicking the commander routes through castToStack', () => {
    const commander = makeDef({
      scryfallId: 'playmat-commander',
      typeLine: 'Legendary Creature',
    });
    act(() => {
      useGameStore.getState().newGame(makeDeck(12, [commander]), 1);
    });
    const store = useGameStore.getState();
    const commanderId = store.state?.zones.command[0];
    if (!commanderId) {
      throw new Error('commander card was not created');
    }

    const castToStack = vi.spyOn(store, 'castToStack').mockReturnValue('ok');
    const castCommander = vi.spyOn(store, 'castCommander').mockReturnValue('ok');
    const { container, root } = renderPlaymat();

    const card = container.querySelector(`[data-testid="card-${commanderId}"]`);
    if (!card) {
      throw new Error('commander card element was not rendered');
    }

    dispatchDoubleClick(card);

    expect(castToStack).toHaveBeenCalledWith(commanderId, { xValue: 0 });
    expect(castCommander).not.toHaveBeenCalled();

    cleanupRender(root, container);
  });

  it('uses ArrowUp to resolve the top of the stack before advancing the phase', () => {
    const stackCreature = makeDef({
      scryfallId: 'playmat-stack-creature',
      typeLine: 'Creature — Bear',
    });

    act(() => {
      useGameStore.getState().newGame([{ def: stackCreature, isCommander: false }, ...makeDeck(12)], 1);
      useGameStore.getState().keepOpeningHand();
      useGameStore.getState().beginFirstTurn();
    });

    const handCardId = findInstanceId('playmat-stack-creature');

    act(() => {
      useGameStore.getState().moveCard(handCardId, 'hand');
      useGameStore.getState().moveCard(handCardId, 'stack');
    });
    const { container, root } = renderPlaymat();
    const before = useGameStore.getState().state;
    if (!before) {
      throw new Error('game state was not available before resolving the stack');
    }
    expect(before.phase).toBe('main1');
    expect(before.zones.stack).toEqual([handCardId]);

    if (!shortcutCapture.handlers) {
      throw new Error('shortcut handlers were not registered');
    }

    act(() => {
      shortcutCapture.handlers?.onNextPhase();
    });

    const after = useGameStore.getState().state;
    if (!after) {
      throw new Error('game state was not available after resolving the stack');
    }

    expect(after.phase).toBe('main1');
    expect(after.zones.stack).toHaveLength(0);
    expect(after.zones.battlefield).toContain(handCardId);

    cleanupRender(root, container);
  });

  it('uses ArrowUp to advance the phase when the stack is empty', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
      useGameStore.getState().keepOpeningHand();
      useGameStore.getState().beginFirstTurn();
    });

    const { container, root } = renderPlaymat();
    const before = useGameStore.getState().state;
    if (!before) {
      throw new Error('game state was not available before advancing the phase');
    }
    expect(before.phase).toBe('main1');
    expect(before.zones.stack).toHaveLength(0);

    if (!shortcutCapture.handlers) {
      throw new Error('shortcut handlers were not registered');
    }

    act(() => {
      shortcutCapture.handlers?.onNextPhase();
    });

    const after = useGameStore.getState().state;
    if (!after) {
      throw new Error('game state was not available after advancing the phase');
    }

    expect(after.phase).toBe('combat');
    expect(after.zones.stack).toHaveLength(0);

    cleanupRender(root, container);
  });

  it('opens the info panel from other actions', () => {
    act(() => {
      useGameStore.getState().newGame(makeDeck(12), 1);
      useGameStore.getState().keepOpeningHand();
    });

    const { container, root } = renderPlaymat();
    const otherActions = container.querySelector('[data-testid="other-actions"]');
    if (!otherActions) {
      throw new Error('other actions button was not rendered');
    }

    dispatchClick(otherActions);

    const infoButton = container.querySelector('[data-testid="game-info-open"]');
    if (!infoButton) {
      throw new Error('game info button was not rendered');
    }

    dispatchClick(infoButton);

    expect(container.querySelector('[data-testid="game-info"]')).not.toBeNull();

    cleanupRender(root, container);
  });
});
