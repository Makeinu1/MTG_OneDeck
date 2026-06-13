import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHoverPreview } from './useHoverPreview';

function dispatchPointerEvent(
  element: Element,
  type: string,
  init: { clientX: number; clientY: number; pointerType: string; pointerId?: number },
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType });
  act(() => {
    element.dispatchEvent(event);
  });
}

function renderHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function Harness() {
    const preview = useHoverPreview();

    return (
      <>
        <div
          data-testid="card"
          onMouseEnter={(e) => preview.onMouseEnter('c1', e)}
          onMouseLeave={preview.onMouseLeave}
          onPointerDown={(e) => preview.onPointerDown('c1', e)}
          onPointerMove={preview.onPointerMove}
          onPointerUp={preview.onPointerUp}
          onPointerCancel={preview.onPointerCancel}
        >
          card
        </div>
        <output data-testid="preview">{preview.target?.cardId ?? 'none'}</output>
      </>
    );
  }

  act(() => {
    root.render(<Harness />);
  });

  const card = container.querySelector('[data-testid="card"]');
  const preview = container.querySelector('[data-testid="preview"]');
  if (!(card instanceof HTMLDivElement) || !(preview instanceof HTMLOutputElement)) {
    throw new Error('preview harness not rendered');
  }

  Object.defineProperty(card, 'getBoundingClientRect', {
    value: () => new DOMRect(10, 20, 80, 120),
  });

  return { container, root, card, preview };
}

function cleanupRender(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('useHoverPreview touch hold', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows a preview after a 400ms touch hold and clears it on release', () => {
    const { card, container, preview, root } = renderHarness();

    dispatchPointerEvent(card, 'pointerdown', {
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    });

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(preview.textContent).toBe('none');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(preview.textContent).toBe('c1');

    dispatchPointerEvent(card, 'pointerup', {
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    });
    expect(preview.textContent).toBe('none');

    cleanupRender(root, container);
  });

  it('cancels the preview when the touch moves too far', () => {
    const { card, container, preview, root } = renderHarness();

    dispatchPointerEvent(card, 'pointerdown', {
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    dispatchPointerEvent(card, 'pointermove', {
      pointerType: 'touch',
      clientX: 36,
      clientY: 20,
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(preview.textContent).toBe('none');

    cleanupRender(root, container);
  });
});
