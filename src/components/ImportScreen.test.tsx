import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_KEYBINDINGS,
  loadKeybindings,
  type KeybindingsMap,
} from '../data/keybindings';
import { ImportScreen } from './ImportScreen';

function dispatchClick(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function dispatchKeyDown(key: string, code = ''): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key,
        code,
      })
    );
  });
}

function ImportScreenHarness() {
  const [keybindings, setKeybindings] = useState<KeybindingsMap>({ ...DEFAULT_KEYBINDINGS });

  return (
    <ImportScreen
      initialDeckText=""
      onStart={() => {}}
      keybindings={keybindings}
      onKeybindingsChange={setKeybindings}
    />
  );
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderImportScreen(): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(<ImportScreenHarness />);
  });

  return container;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('ImportScreen keybindings', () => {
  it('captures a new key binding and resets back to defaults', () => {
    const view = renderImportScreen();
    const rebindDraw = view.querySelector('[data-testid="rebind-draw"]');
    const reset = view.querySelector('[data-testid="keybindings-reset"]');
    if (!(rebindDraw instanceof HTMLButtonElement) || !(reset instanceof HTMLButtonElement)) {
      throw new Error('keybinding controls were not rendered');
    }

    dispatchClick(rebindDraw);
    dispatchKeyDown('q', 'KeyQ');

    expect(loadKeybindings().draw).toBe('q');
    expect(rebindDraw.parentElement?.textContent).toContain('Q');

    dispatchClick(reset);

    expect(loadKeybindings()).toEqual(DEFAULT_KEYBINDINGS);
    expect(rebindDraw.parentElement?.textContent).toContain('D');
  });

  it('shows a warning and keeps the old binding when a conflict is entered', () => {
    const view = renderImportScreen();
    const rebindDraw = view.querySelector('[data-testid="rebind-draw"]');
    if (!(rebindDraw instanceof HTMLButtonElement)) {
      throw new Error('draw rebind button was not rendered');
    }

    dispatchClick(rebindDraw);
    dispatchKeyDown('Enter', 'Enter');

    const warning = view.querySelector('[role="alert"]');
    expect(warning?.textContent).toContain('重複');
    expect(loadKeybindings()).toEqual(DEFAULT_KEYBINDINGS);
  });
});
