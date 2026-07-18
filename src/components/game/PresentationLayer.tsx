import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameEvent } from '../../engine/types';
import type { GameController } from './gameController';
import { HISTORY_UI_EVENT } from './historyUiEvents';
import {
  drawPresentationForAppend,
  drawPresentationText,
  type DrawPresentationCue,
} from './presentationCueModel';
import { TransitionCue } from './TransitionCue';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function PresentationLayer({ controller }: { controller: GameController }) {
  const { state } = controller;
  const previousEventsRef = useRef<readonly GameEvent[] | null>(null);
  const suppressNextRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drawCue, setDrawCue] = useState<DrawPresentationCue | null>(null);

  useEffect(() => {
    const suppress = () => { suppressNextRef.current = true; };
    document.addEventListener(HISTORY_UI_EVENT, suppress);
    return () => document.removeEventListener(HISTORY_UI_EVENT, suppress);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!state) {
      previousEventsRef.current = null;
      return;
    }
    const previousEvents = previousEventsRef.current;
    previousEventsRef.current = state.eventLog;
    if (suppressNextRef.current || !controller.motionArmed) {
      suppressNextRef.current = false;
      return;
    }
    const next = drawPresentationForAppend({
      previousEvents,
      state,
      transitionCue: controller.transitionCue,
    });
    if (!next) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setDrawCue(next);
    const visibleMs = prefersReducedMotion() ? 240 : next.delayMs + next.durationMs + 40;
    timerRef.current = setTimeout(() => {
      setDrawCue((current) => current?.id === next.id ? null : current);
      timerRef.current = null;
    }, visibleMs);
  }, [controller.motionArmed, controller.transitionCue, state]);

  const standaloneDraw = drawCue && !drawCue.phaseBound ? drawCue : null;
  return (
    <>
      <TransitionCue
        cue={controller.transitionCue}
        drawCue={drawCue?.phaseBound ? drawCue : null}
        onDone={controller.dismissTransitionCue}
      />
      {standaloneDraw && (
        <div
          className="turn-transition-layer presentation-layer presentation-layer--draw"
          data-testid="draw-presentation-cue"
          style={{ '--presentation-delay': `${standaloneDraw.delayMs}ms` } as CSSProperties}
          aria-hidden="true"
        >
          <div className="turn-transition-cue">
            <small>ドロー</small>
            <strong>{drawPresentationText(standaloneDraw)}</strong>
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {drawCue ? `ドロー、${drawPresentationText(drawCue)}` : ''}
      </span>
    </>
  );
}
