import { useEffect, useState } from 'react';
import { isNewAssetAvailable, moduleAssetUrlFromHtml } from './updateAvailability';

const UPDATE_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

function currentModuleAssetUrl(): string | null {
  const source = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
  return source || null;
}

function freshnessUrl(): string {
  const url = new URL(window.location.pathname, window.location.href);
  url.searchParams.set('__onedeck_update', String(Date.now()));
  return url.href;
}

export function UpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let lastCheckedAt = 0;

    async function checkForUpdate(force = false): Promise<void> {
      const now = Date.now();
      if (!force && now - lastCheckedAt < UPDATE_CHECK_COOLDOWN_MS) return;
      lastCheckedAt = now;
      try {
        const response = await fetch(freshnessUrl(), { cache: 'no-store' });
        if (!response.ok) return;
        const latestAsset = moduleAssetUrlFromHtml(await response.text(), response.url);
        if (!cancelled && isNewAssetAvailable(currentModuleAssetUrl(), latestAsset)) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline play and temporary Pages/CDN failures must remain uninterrupted.
      }
    }

    const handleFocus = () => { void checkForUpdate(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };

    void checkForUpdate(true);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!updateAvailable) return null;
  return (
    <aside className="game-update-notice" data-testid="game-update-notice" role="status">
      <span>新しいUIがあります</span>
      <button type="button" onClick={() => window.location.reload()}>再読み込み</button>
    </aside>
  );
}
