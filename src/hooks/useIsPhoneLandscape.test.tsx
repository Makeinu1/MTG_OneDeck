import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useIsPhoneLandscape } from './useIsPhoneLandscape';

interface MockMediaQueryList extends MediaQueryList {
  dispatchChange: (matches: boolean) => void;
}

function installMatchMedia(initialMatches: boolean): MockMediaQueryList {
  const listeners = new Set<EventListenerOrEventListenerObject>();

  const mediaQuery = {
    matches: initialMatches,
    media: '(orientation: landscape) and (max-height: 480px)',
    onchange: null as ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener as EventListener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener as EventListener);
    },
    dispatchEvent: () => true,
    dispatchChange: (matches: boolean) => {
      mediaQuery.matches = matches;
      const event = { matches, media: mediaQuery.media } as MediaQueryListEvent;
      listeners.forEach((listener) => {
        if (typeof listener === 'function') {
          listener.call(mediaQuery, event);
          return;
        }
        listener.handleEvent(event);
      });
      mediaQuery.onchange?.call(mediaQuery, event);
    },
  } satisfies MockMediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => mediaQuery,
  });

  return mediaQuery;
}

function renderHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function Harness() {
    const isPhoneLandscape = useIsPhoneLandscape();
    return <output data-testid="value">{String(isPhoneLandscape)}</output>;
  }

  act(() => {
    root.render(<Harness />);
  });

  const output = container.querySelector('[data-testid="value"]');
  if (!(output instanceof HTMLOutputElement)) {
    throw new Error('harness did not render');
  }

  return { container, root, output };
}

function cleanupRender(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useIsPhoneLandscape', () => {
  it('reads the current media query match on mount', () => {
    installMatchMedia(true);
    const { container, output, root } = renderHarness();

    expect(output.textContent).toBe('true');

    cleanupRender(root, container);
  });

  it('updates when the media query changes', () => {
    const mediaQuery = installMatchMedia(false);
    const { container, output, root } = renderHarness();

    expect(output.textContent).toBe('false');

    act(() => {
      mediaQuery.dispatchChange(true);
    });
    expect(output.textContent).toBe('true');

    act(() => {
      mediaQuery.dispatchChange(false);
    });
    expect(output.textContent).toBe('false');

    cleanupRender(root, container);
  });
});
