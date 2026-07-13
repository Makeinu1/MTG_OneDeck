import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTheme, loadThemePreference, resolveTheme, saveThemePreference } from './theme';

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('follows the operating-system preference by default', () => {
    expect(loadThemePreference()).toBe('system');
    expect(resolveTheme('system')).toBe('light');
    initializeTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists a manual preference and applies it to the document', () => {
    saveThemePreference('dark');
    expect(loadThemePreference()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
