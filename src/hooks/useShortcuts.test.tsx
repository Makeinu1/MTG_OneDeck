import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeKeybindings } from '../data/keybindings';
import { useShortcuts, type ShortcutHandlers } from './useShortcuts';

function ShortcutHarness(props: ShortcutHandlers) {
  useShortcuts(props);
  return null;
}

function dispatchKeyDown(
  key: string,
  init?: {
    code?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  }
): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key,
        code: init?.code ?? '',
        ctrlKey: init?.ctrlKey,
        metaKey: init?.metaKey,
        shiftKey: init?.shiftKey,
      })
    );
  });
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderHarness(overrides?: Partial<ShortcutHandlers>) {
  const handlers: ShortcutHandlers = {
    onNextPhase: vi.fn(),
    onNextTurn: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onRestart: vi.fn(),
    onDraw: vi.fn(),
    isDialogOpen: false,
    keybindings: normalizeKeybindings({
      nextPhase: 'w',
      nextTurn: 'e',
      draw: 'q',
      restart: 'r',
      undo: 'a',
      redo: 's',
    }),
    ...overrides,
  };

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(<ShortcutHarness {...handlers} />);
  });

  return handlers;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('useShortcuts', () => {
  it('uses the configured single-key bindings', () => {
    const handlers = renderHarness();

    dispatchKeyDown('w');
    dispatchKeyDown('e');
    dispatchKeyDown('q');
    dispatchKeyDown('r');
    dispatchKeyDown('a');
    dispatchKeyDown('s');

    expect(handlers.onNextPhase).toHaveBeenCalledTimes(1);
    expect(handlers.onNextTurn).toHaveBeenCalledTimes(1);
    expect(handlers.onDraw).toHaveBeenCalledTimes(1);
    expect(handlers.onRestart).toHaveBeenCalledTimes(1);
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(handlers.onRedo).toHaveBeenCalledTimes(1);
  });

  it('keeps the standard undo/redo modifier shortcuts alongside remapped keys', () => {
    const handlers = renderHarness();

    dispatchKeyDown('z', { ctrlKey: true });
    dispatchKeyDown('Z', { ctrlKey: true, shiftKey: true });
    dispatchKeyDown('y', { ctrlKey: true });

    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(handlers.onRedo).toHaveBeenCalledTimes(2);
  });

  it('blocks phase-turn-restart-undo-redo shortcuts while a dialog is open but still allows draw', () => {
    const handlers = renderHarness({ isDialogOpen: true });

    dispatchKeyDown('w');
    dispatchKeyDown('e');
    dispatchKeyDown('r');
    dispatchKeyDown('a');
    dispatchKeyDown('s');
    dispatchKeyDown('q');

    expect(handlers.onNextPhase).not.toHaveBeenCalled();
    expect(handlers.onNextTurn).not.toHaveBeenCalled();
    expect(handlers.onRestart).not.toHaveBeenCalled();
    expect(handlers.onUndo).not.toHaveBeenCalled();
    expect(handlers.onRedo).not.toHaveBeenCalled();
    expect(handlers.onDraw).toHaveBeenCalledTimes(1);
  });
});
