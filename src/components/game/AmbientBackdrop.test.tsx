import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AmbientBackdrop } from './AmbientBackdrop';
import {
  AMBIENT_CHANGE_EVENT,
  setAmbientEnabled,
} from './ambientMotion';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  localStorage.clear();
  delete document.documentElement.dataset.ambient;
});

describe('AmbientBackdrop', () => {
  it('renders an aria-hidden backdrop with the full 156-star field when enabled (default ON)', () => {
    act(() => { root.render(<AmbientBackdrop />); });
    const backdrop = container.querySelector('[data-testid="ambient-backdrop"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.ambient-star')).toHaveLength(156);
    // Both skins are present in the DOM; CSS theme-scoping shows one.
    expect(container.querySelector('.ambient-backdrop__dark')).not.toBeNull();
    expect(container.querySelector('.ambient-backdrop__light')).not.toBeNull();
  });

  it('renders nothing when the toggle is OFF at mount', () => {
    setAmbientEnabled(false);
    act(() => { root.render(<AmbientBackdrop />); });
    expect(container.querySelector('[data-testid="ambient-backdrop"]')).toBeNull();
  });

  it('syncs document[data-ambient] to the enabled state', () => {
    act(() => { root.render(<AmbientBackdrop />); });
    expect(document.documentElement.dataset.ambient).toBe('on');
  });

  it('toggles off at runtime via the change event and clears the document gate', () => {
    act(() => { root.render(<AmbientBackdrop />); });
    expect(container.querySelector('[data-testid="ambient-backdrop"]')).not.toBeNull();
    expect(document.documentElement.dataset.ambient).toBe('on');
    act(() => {
      setAmbientEnabled(false);
      document.dispatchEvent(new Event(AMBIENT_CHANGE_EVENT));
    });
    expect(container.querySelector('[data-testid="ambient-backdrop"]')).toBeNull();
    expect(document.documentElement.dataset.ambient).toBe('off');
  });

  it('exposes the ink layers (blooms/drips/flecks) for the light skin', () => {
    act(() => { root.render(<AmbientBackdrop />); });
    expect(container.querySelectorAll('.ambient-bloom')).toHaveLength(6);
    expect(container.querySelectorAll('.ambient-drip')).toHaveLength(5);
    expect(container.querySelectorAll('.ambient-fleck')).toHaveLength(10);
    expect(container.querySelectorAll('.ambient-current')).toHaveLength(3);
  });
});
