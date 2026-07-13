import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardActionSheet } from './CardActionSheet';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('CardActionSheet', () => {
  it('clamps a popover into the viewport and owns focus until it closes', () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      if (this.classList.contains('card-sheet')) {
        return { x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400, toJSON: () => ({}) };
      }
      return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
    });
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onClose = vi.fn();

    act(() => root.render(
      <CardActionSheet
        title="検証カード"
        rankedItems={[{ key: 'move', label: '戦場へ', onSelect: vi.fn() }]}
        otherItems={[]}
        variant="popover"
        anchor={{ x: 750, y: 550 }}
        onClose={onClose}
      />,
    ));

    const sheet = host.querySelector<HTMLElement>('[data-testid="card-sheet"]');
    const firstAction = host.querySelector<HTMLElement>('[data-testid="card-sheet-action-move"]');
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.style.left).toBe('492px');
    expect(sheet?.style.top).toBe('150px');
    expect(document.activeElement).toBe(firstAction);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(document.activeElement).toBe(opener);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
  });
});
