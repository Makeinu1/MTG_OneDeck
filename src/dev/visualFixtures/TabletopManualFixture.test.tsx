// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TabletopManualFixture } from './TabletopManualFixture';

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.tabletopManualLastMode;
  delete document.documentElement.dataset.tabletopManualLastPrimitive;
  delete document.documentElement.dataset.tabletopManualLastVisibilityOperation;
});

describe('tabletop-manual visual fixture', () => {
  it('mounts the production panel through GameScreen with own/public choices', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<TabletopManualFixture />));

    expect(container.querySelector('[data-testid="game-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-tabletop-manual"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-visibility-decisions"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-tabletop-move-object"]')?.textContent).toContain('卓上の斥候');
    expect(container.querySelector('[data-testid="online-tabletop-attach-target"]')?.textContent).toContain('対戦相手の守護者');
    expect(container.querySelector('[data-testid="online-tabletop-clear-note-id"]')?.textContent).toContain('次の優先権で公開メモを確認');
    expect(container.querySelector('[data-testid="online-tabletop-clear-note-id"]')?.textContent).not.toContain('相手が共有した公開メモ');
    expect(container.querySelector('[data-testid="online-tabletop-submit-manual-resolve"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="online-tabletop-disabled-look"]')).toHaveProperty('disabled', true);
    expect(container.querySelector('[data-testid="online-tabletop-disabled-reveal"]')).toHaveProperty('disabled', true);
    expect(container.querySelector('[data-testid="online-tabletop-disabled-choose"]')).toHaveProperty('disabled', true);
    expect(container.querySelector('[data-testid="online-tabletop-manual-successor"]')?.textContent ?? container.textContent).toContain('「見る・公開する・選ぶ」パネル');

    const visibility = container.querySelector('[data-testid="online-visibility-decisions"]');
    expect(visibility?.textContent).toContain('《卓上の斥候》');
    expect(visibility?.textContent).toContain('候補を選択（1〜1枚）');
    expect(visibility?.textContent).toContain('《ライブラリー候補》');

    const lookSubject = container.querySelector<HTMLSelectElement>('[data-testid="visibility-look-subject"]');
    if (lookSubject === null) throw new Error('Missing look subject');
    act(() => {
      lookSubject.value = 'top:1';
      lookSubject.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector<HTMLButtonElement>('[data-testid="visibility-look"]')?.disabled).toBe(false);
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="visibility-look"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="visibility-confirm"]')?.click());
    expect(document.documentElement.dataset.tabletopManualLastVisibilityOperation).toBe('look');

    const revealSubject = container.querySelector<HTMLSelectElement>('[data-testid="visibility-look-subject"]');
    if (revealSubject === null) throw new Error('Missing reveal subject');
    act(() => {
      revealSubject.value = 'P1-hand-scout:0';
      revealSubject.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="visibility-reveal"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="visibility-confirm"]')?.click());
    expect(document.documentElement.dataset.tabletopManualLastVisibilityOperation).toBe('reveal');

    const choice = container.querySelector<HTMLInputElement>('[data-testid="visibility-choice-fixture-choice"] input[type="checkbox"]');
    if (choice === null) throw new Error('Missing projected choice candidate');
    act(() => choice.click());
    expect(container.querySelector<HTMLButtonElement>('[data-testid="visibility-choose-fixture-choice"]')?.disabled).toBe(false);
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="visibility-choose-fixture-choice"]')?.click());
    expect(document.documentElement.dataset.tabletopManualLastVisibilityOperation).toBe('choose');
    expect(document.documentElement.dataset.tabletopManualLastVisibilityCommand).toBeUndefined();

    const freeform = container.querySelector<HTMLInputElement>('[data-testid="online-tabletop-mode-freeform"]');
    act(() => freeform?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-shuffle"]')?.click());
    expect(document.documentElement.dataset.tabletopManualLastMode).toBe('freeform');
    expect(document.documentElement.dataset.tabletopManualLastPrimitive).toBe('shuffle');

    act(() => root.unmount());
  });
});
