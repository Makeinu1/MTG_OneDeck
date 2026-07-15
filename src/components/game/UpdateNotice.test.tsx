import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateNotice } from './UpdateNotice';

function installCurrentAsset(source: string): HTMLScriptElement {
  const script = document.createElement('script');
  script.type = 'module';
  script.src = source;
  script.dataset.testUpdateAsset = 'true';
  document.head.appendChild(script);
  return script;
}

async function renderNotice(): Promise<{
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<UpdateNotice />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { container, root };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelectorAll('script[data-test-update-asset]').forEach((script) => script.remove());
  document.body.replaceChildren();
});

describe('UpdateNotice', () => {
  it('offers a manual reload when Pages serves a different entry asset', async () => {
    installCurrentAsset('https://example.test/assets/index-old.js');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.test/MTG_OneDeck/',
      text: () => Promise.resolve('<script type="module" src="/assets/index-new.js"></script>'),
    }));

    const { container, root } = await renderNotice();
    expect(container.querySelector('[data-testid="game-update-notice"]')?.textContent)
      .toContain('新しいUIがあります');
    expect(container.querySelector('button')?.textContent).toBe('再読み込み');
    act(() => root.unmount());
  });

  it('stays silent when the current asset is already latest', async () => {
    installCurrentAsset('https://example.test/assets/index-current.js');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://example.test/MTG_OneDeck/',
      text: () => Promise.resolve('<script src="/assets/index-current.js" type="module"></script>'),
    }));

    const { container, root } = await renderNotice();
    expect(container.querySelector('[data-testid="game-update-notice"]')).toBeNull();
    act(() => root.unmount());
  });

  it('keeps offline play silent and uninterrupted', async () => {
    installCurrentAsset('https://example.test/assets/index-current.js');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const { container, root } = await renderNotice();
    expect(container.querySelector('[data-testid="game-update-notice"]')).toBeNull();
    act(() => root.unmount());
  });
});
