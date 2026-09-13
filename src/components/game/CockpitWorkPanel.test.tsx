import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CockpitWorkPanel } from './CockpitWorkPanel';

it('folds a draft without cancelling or losing its input, then resumes it', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host),
    close = vi.fn();
  try {
    act(() =>
      root.render(
        <CockpitWorkPanel title="支払い" preserveDraft onClose={close}>
          <input defaultValue="対象とX=3" />
        </CockpitWorkPanel>,
      ),
    );
    const input = host.querySelector('input')!;
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="作業面をたたむ"]')!.click());
    expect(close).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLElement>('.modal__body')!.hidden).toBe(true);
    act(() =>
      [...host.querySelectorAll('button')]
        .find((button) => button.textContent === '作業を表示')!
        .click(),
    );
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('対象とX=3');
    expect(host.querySelector<HTMLElement>('.modal__body')!.hidden).toBe(false);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('still closes a reading panel normally', () => {
  const host = document.createElement('div'),
    root = createRoot(host),
    close = vi.fn();
  try {
    act(() =>
      root.render(
        <CockpitWorkPanel title="カード" onClose={close}>
          本文
        </CockpitWorkPanel>,
      ),
    );
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="作業面を閉じる"]')!.click());
    expect(close).toHaveBeenCalledExactlyOnceWith();
  } finally {
    act(() => root.unmount());
  }
});
