import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';

afterEach(() => {
  document.body.replaceChildren();
});

describe('ContextMenu keyboard contract', () => {
  it('focuses the first enabled item, roves with arrows, and restores the explicit trigger on Escape', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'ライブラリー';
    document.body.append(trigger);
    trigger.focus();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    act(() => root.render(
      <ContextMenu
        x={10}
        y={10}
        title="ライブラリー"
        items={[
          { key: 'disabled', label: '利用不可', disabled: true, onSelect: vi.fn() },
          { key: 'draw', label: '引く', onSelect: vi.fn() },
          { key: 'shuffle', label: 'シャッフル', onSelect: vi.fn() },
        ]}
        onClose={onClose}
        restoreFocusTo={trigger}
      />,
    ));

    const enabled = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    expect(document.activeElement).toBe(enabled[0]);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(document.activeElement).toBe(enabled[1]);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Tab so focus and board shortcuts cannot escape behind an open menu', () => {
    const trigger = document.createElement('button');
    const unrelated = document.createElement('button');
    document.body.append(trigger, unrelated);
    unrelated.focus();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    act(() => root.render(
      <ContextMenu
        x={10}
        y={10}
        items={[{ key: 'draw', label: '引く', onSelect: vi.fn() }]}
        onClose={onClose}
        restoreFocusTo={trigger}
      />,
    ));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(document.activeElement).toBe(trigger);
  });
});
// verifies: UI-DESIGN-003
