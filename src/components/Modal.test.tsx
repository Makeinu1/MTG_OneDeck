import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Modal } from './Modal';

it('keeps input focus on parent updates and invokes the current close callback', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const previousClose = vi.fn();
  const currentClose = vi.fn();
  try {
    act(() =>
      root.render(
        <Modal title="検索" onClose={previousClose}>
          <input aria-label="検索語" />
        </Modal>,
      ),
    );
    const input = host.querySelector('input')!;
    input.focus();
    act(() =>
      root.render(
        <Modal title="検索" onClose={currentClose}>
          <input aria-label="検索語" />
        </Modal>,
      ),
    );
    expect(document.activeElement).toBe(input);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(currentClose).toHaveBeenCalledOnce();
    expect(previousClose).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
