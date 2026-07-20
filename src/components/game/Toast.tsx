import { useEffect, useRef } from 'react';
import { useViewStore } from '../../store/viewStore';

const TOAST_VISIBLE_MS = 4000;

export function Toast() {
  const toast = useViewStore((s) => s.toast);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      useViewStore.getState().dismissToast();
      timerRef.current = null;
    }, TOAST_VISIBLE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  if (!toast) return null;

  return (
    <button
      type="button"
      className={`game-toast game-toast--${toast.kind}`}
      data-testid="game-toast"
      onClick={() => useViewStore.getState().dismissToast()}
      aria-live="polite"
    >
      <span className="game-toast__icon">{toast.kind === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span className="game-toast__message">{toast.message}</span>
    </button>
  );
}
