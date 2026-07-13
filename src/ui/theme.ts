import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

const THEME_STORAGE_KEY = 'mtg-onedeck:theme';
const THEME_EVENT = 'mtg-onedeck:theme-change';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function loadThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  const themeColor = resolved === 'light' ? '#f3efe5' : '#0a0e14';
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  return resolved;
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage may be unavailable; the active document still receives the theme.
  }
  applyTheme(preference);
  window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_EVENT, { detail: preference }));
}

export function initializeTheme(): void {
  applyTheme(loadThemePreference());
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(loadThemePreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(preference));

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    const sync = (): void => setResolved(applyTheme(loadThemePreference()));
    const handleTheme = (event: Event): void => {
      const detail = (event as CustomEvent<ThemePreference>).detail;
      setPreferenceState(detail);
      setResolved(applyTheme(detail));
    };
    media?.addEventListener('change', sync);
    window.addEventListener(THEME_EVENT, handleTheme);
    sync();
    return () => {
      media?.removeEventListener('change', sync);
      window.removeEventListener(THEME_EVENT, handleTheme);
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference): void => {
    setPreferenceState(next);
    setResolved(applyTheme(next));
    saveThemePreference(next);
  }, []);

  return { preference, resolved, setPreference };
}
