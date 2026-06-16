import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Thrower(): never {
  throw new Error('boom');
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <ErrorBoundary>
          <div data-testid="child">ok</div>
        </ErrorBoundary>,
      );
    });
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="error-boundary"]')).toBeNull();
  });

  it('renders the fallback when a child throws during render', () => {
    // React logs the caught error; silence it for a clean test run.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <ErrorBoundary>
          <Thrower />
        </ErrorBoundary>,
      );
    });
    const fallback = container.querySelector('[data-testid="error-boundary"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain('予期しないエラー');
  });
});
