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
  /** Bind to pointer events to support touch long-press previews. */
  onPointerDown: (cardId: string, e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  /** Call to immediately suppress the preview (e.g. on drag start, menu open, dblclick). */
  suppress: () => void;
}

const HOVER_DELAY_MS = 250;
const TOUCH_HOLD_DELAY_MS = 400;
const TOUCH_MOVE_TOLERANCE_PX = 8;

interface TouchPreviewState {
  cardId: string;
  pointerId: number;
  startX: number;
  startY: number;
  rect: DOMRect;
}

/**
 * Tracks a 250ms-delayed hover target for a card preview popup. The preview is
 * suppressed (and any pending timer cancelled) via `suppress()`, intended for
 * drag start, context menu open, and double-click.
 */
export function useHoverPreview(): HoverPreviewState {
  const [target, setTarget] = useState<HoverPreviewTarget | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef<TouchPreviewState | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelTouchPreview = useCallback(() => {
    clearTimer();
    touchRef.current = null;
    setTarget(null);
  }, [clearTimer]);

  const onMouseEnter = useCallback(
    (cardId: string, e: React.MouseEvent<HTMLElement>) => {
      touchRef.current = null;
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
    touchRef.current = null;
    setTarget(null);
  }, [clearTimer]);

  const onPointerDown = useCallback(
    (cardId: string, e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'touch') {
        return;
      }

      clearTimer();
      setTarget(null);
      const rect = e.currentTarget.getBoundingClientRect();
      touchRef.current = {
        cardId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        rect,
      };
      timerRef.current = setTimeout(() => {
        const activeTouch = touchRef.current;
        if (!activeTouch || activeTouch.pointerId !== e.pointerId) {
          return;
        }
        setTarget({ cardId: activeTouch.cardId, rect: activeTouch.rect });
      }, TOUCH_HOLD_DELAY_MS);
    },
    [clearTimer],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'touch') {
        return;
      }

      const activeTouch = touchRef.current;
      if (!activeTouch || activeTouch.pointerId !== e.pointerId) {
        return;
      }

      const distance = Math.hypot(e.clientX - activeTouch.startX, e.clientY - activeTouch.startY);
      if (distance >= TOUCH_MOVE_TOLERANCE_PX) {
        cancelTouchPreview();
      }
    },
    [cancelTouchPreview],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'touch') {
        return;
      }

      if (touchRef.current?.pointerId === e.pointerId) {
        cancelTouchPreview();
      }
    },
    [cancelTouchPreview],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'touch') {
        return;
      }

      if (touchRef.current?.pointerId === e.pointerId) {
        cancelTouchPreview();
      }
    },
    [cancelTouchPreview],
  );

  const suppress = useCallback(() => {
    cancelTouchPreview();
  }, [cancelTouchPreview]);

  useEffect(() => cancelTouchPreview, [cancelTouchPreview]);

  return {
    target,
    onMouseEnter,
    onMouseLeave,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    suppress,
  };
}
