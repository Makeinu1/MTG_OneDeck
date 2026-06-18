import { useEffect, useState } from 'react';

const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 480px)';

function getMatches(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(PHONE_LANDSCAPE_QUERY).matches;
}

export function useIsPhoneLandscape(): boolean {
  const [matches, setMatches] = useState(() => getMatches());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(PHONE_LANDSCAPE_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return matches;
}
