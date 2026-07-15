import { describe, expect, it } from 'vitest';
import { isNewAssetAvailable, moduleAssetUrlFromHtml } from './updateAvailability';

describe('update availability', () => {
  it('extracts the module asset regardless of attribute order', () => {
    expect(moduleAssetUrlFromHtml(
      '<script crossorigin src="/MTG_OneDeck/assets/index-new.js" type="module"></script>',
      'https://makeinu1.github.io/MTG_OneDeck/',
    )).toBe('https://makeinu1.github.io/MTG_OneDeck/assets/index-new.js');
  });

  it('reports only a real built-asset change', () => {
    const current = 'https://makeinu1.github.io/MTG_OneDeck/assets/index-old.js';
    expect(isNewAssetAvailable(current, current)).toBe(false);
    expect(isNewAssetAvailable(current, null)).toBe(false);
    expect(isNewAssetAvailable(null, `${current}-new`)).toBe(false);
    expect(isNewAssetAvailable(current, 'https://makeinu1.github.io/MTG_OneDeck/assets/index-new.js')).toBe(true);
  });
});
