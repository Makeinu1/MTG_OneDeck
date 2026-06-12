import { useCallback, useEffect, useRef, useState } from 'react';

export interface HoverPreviewTarget {
  /** Card instance id being previewed. */
  cardId: string;
  /** Anchor rect of the hovered element, used to position the preview. */
  rect: DOMRect;
}

export interface HoverPreviewState {
  target: HoverPreviewTarget | null;
  /** Bind to the hoverable element's onMouseEnter/onMouseLeave. */
  onMouseEnter: (cardId: string, e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  /** Call to immediately suppress the preview (e.g. on drag start, menu open, dblclick). */
  suppress: () => void;
}

const HOVER_DELAY_MS = 250;

/**
 * Tracks a 250ms-delayed hover target for a card preview popup. The preview is
 * suppressed (and any pending timer cancelled) via `suppress()`, intended for
 * drag start, context menu open, and double-click.
 */
export function useHoverPreview(): HoverPreviewState {
  const [target, setTarget] = useState<HoverPreviewTarget | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onMouseEnter = useCallback(
    (cardId: string, e: React.MouseEvent<HTMLElement>) => {
      clearTimer();
      const rect = e.currentTarget.getBoundingClientRect();
      timerRef.current = setTimeout(() => {
        setTarget({ cardId, rect });
      }, HOVER_DELAY_MS);
    },
    [clearTimer],
  );

  const onMouseLeave = useCallback(() => {
    clearTimer();
    setTarget(null);
  }, [clearTimer]);

  const suppress = useCallback(() => {
    clearTimer();
    setTarget(null);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { target, onMouseEnter, onMouseLeave, suppress };
}
