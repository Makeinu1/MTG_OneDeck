/**
 * Reviewer-owned acceptance for M-STACK-CONTROL shortcut focus semantics.
 * Implementers must not edit this file; fix useShortcuts when it fails.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeKeybindings } from '../data/keybindings';
import { useShortcuts, type ShortcutHandlers } from './useShortcuts';

function Harness(props: ShortcutHandlers) {
  useShortcuts(props);
  return <button type="button">マナ源</button>;
}

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  document.body.replaceChildren();
});

function setup(overrides: Partial<ShortcutHandlers> = {}) {
  const handlers: ShortcutHandlers = {
    onNextPhase: vi.fn(),
    onNextTurn: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onRestart: vi.fn(),
    onDraw: vi.fn(),
    isDialogOpen: false,
    keybindings: normalizeKeybindings({
      nextPhase: 'ArrowUp', nextTurn: 'Enter', undo: 'ArrowLeft', redo: 'ArrowRight',
      restart: 'Space', draw: 'd',
    }),
    ...overrides,
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(<Harness {...handlers} />);
  });
  return { handlers, button: container.querySelector('button')! };
}

function press(target: Element, key: string, code = ''): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key, code, bubbles: true, cancelable: true,
    }));
  });
}

describe('M-STACK-CONTROL shortcut focus contract', () => {
  it('keeps mapped arrow shortcuts active after a mana/card button retains focus', () => {
    const { handlers, button } = setup();
    act(() => button.focus());

    press(button, 'ArrowUp');
    press(button, 'ArrowLeft');
    press(button, 'ArrowRight');

    expect(handlers.onNextPhase).toHaveBeenCalledOnce();
    expect(handlers.onUndo).toHaveBeenCalledOnce();
    expect(handlers.onRedo).toHaveBeenCalledOnce();
  });

  it('leaves Enter/Space to the focused control and all unmodified shortcuts to editable fields', () => {
    const { handlers, button } = setup();
    press(button, 'Enter');
    press(button, ' ', 'Space');

    const input = document.createElement('input');
    document.body.appendChild(input);
    press(input, 'ArrowUp');
    press(input, 'ArrowLeft');

    expect(handlers.onNextTurn).not.toHaveBeenCalled();
    expect(handlers.onRestart).not.toHaveBeenCalled();
    expect(handlers.onNextPhase).not.toHaveBeenCalled();
    expect(handlers.onUndo).not.toHaveBeenCalled();
  });
});
