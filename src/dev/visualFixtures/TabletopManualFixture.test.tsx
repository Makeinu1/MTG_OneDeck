// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TabletopManualFixture } from './TabletopManualFixture';

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.tabletopManualLastMode;
  delete document.documentElement.dataset.tabletopManualLastPrimitive;
});

describe('tabletop-manual visual fixture', () => {
  it('mounts the production panel through GameScreen with own/public choices', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<TabletopManualFixture />));

    expect(container.querySelector('[data-testid="game-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-tabletop-manual"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-tabletop-move-object"]')?.textContent).toContain('卓上の斥候');
    expect(container.querySelector('[data-testid="online-tabletop-attach-target"]')?.textContent).toContain('対戦相手の守護者');
    expect(container.querySelector('[data-testid="online-tabletop-clear-note-id"]')?.textContent).toContain('次の優先権で公開メモを確認');
    expect(container.querySelector('[data-testid="online-tabletop-clear-note-id"]')?.textContent).not.toContain('相手が共有した公開メモ');
    expect(container.querySelector('[data-testid="online-tabletop-submit-manual-resolve"]')).not.toBeNull();

    const freeform = container.querySelector<HTMLInputElement>('[data-testid="online-tabletop-mode-freeform"]');
    act(() => freeform?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-shuffle"]')?.click());
    expect(document.documentElement.dataset.tabletopManualLastMode).toBe('freeform');
    expect(document.documentElement.dataset.tabletopManualLastPrimitive).toBe('shuffle');

    act(() => root.unmount());
  });
});
