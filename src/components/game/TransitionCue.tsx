import { useEffect, useState } from 'react';
import { PHASE_META } from './statusBandModel';
import {
  TURN_CUE_LEAD_MS,
  TURN_PHASE_STEP_MS,
  type TransitionCueData,
} from './transitionCueModel';
import { drawPresentationText, type DrawPresentationCue } from './presentationCueModel';

function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ActiveTransitionCue({
  cue,
  drawCue,
  onDone,
}: {
  cue: TransitionCueData;
  drawCue: DrawPresentationCue | null;
  onDone: (id: number) => void;
}) {
  const reduce = reducedMotion();
  const [activeIndex, setActiveIndex] = useState(() => (
    reduce ? Math.max(0, cue.phases.length - 1) : 0
  ));
  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    if (!reduce && cue.kind === 'turn') {
      cue.phases.forEach((_, index) => {
        if (index === 0) return;
        timers.push(setTimeout(
          () => setActiveIndex(index),
          TURN_CUE_LEAD_MS + index * TURN_PHASE_STEP_MS,
        ));
      });
    }
    timers.push(setTimeout(() => onDone(cue.id), reduce ? 240 : cue.durationMs));
    return () => timers.forEach(clearTimeout);
  }, [cue, onDone, reduce]);

  const activePhase = cue.phases[activeIndex] ?? cue.phases[0];
  const phaseLabel = activePhase ? PHASE_META[activePhase].label : '';
  const activeDrawCue = activePhase === 'draw' ? drawCue : null;

  useEffect(() => {
    if (!activePhase) return;
    document.documentElement.dataset.presentationPhase = activePhase;
    return () => {
      if (document.documentElement.dataset.presentationPhase === activePhase) {
        delete document.documentElement.dataset.presentationPhase;
      }
    };
  }, [activePhase]);

  return (
    <div
      className="turn-transition-layer presentation-layer"
      data-testid="transition-cue"
      data-kind={cue.kind}
      data-active-draw={activeDrawCue ? true : undefined}
    >
      {cue.kind === 'turn' && (
        <>
          <div className="turn-sweep turn-sweep--cold" aria-hidden="true" />
          <div className="turn-sweep turn-sweep--gold" aria-hidden="true" />
        </>
      )}
      <div className="turn-transition-cue" aria-hidden="true">
        {cue.kind === 'turn' ? (
          <>
            <small className="turn-stamp__label">TURN</small>
            <span className="turn-stamp__num">第{cue.turn}ターン</span>
            <span className="turn-stamp__rule" aria-hidden="true" />
          </>
        ) : null}
        <strong>{phaseLabel}</strong>
        {activeDrawCue && (
          <span className="turn-transition-cue__draw" data-testid="transition-draw-detail">
            {drawPresentationText(activeDrawCue)}
          </span>
        )}
        <div className="turn-transition-cue__track">
          {cue.phases.map((phase, index) => (
            <span
              key={`${phase}-${index}`}
              className={index === activeIndex ? 'is-active' : index < activeIndex ? 'is-done' : ''}
              title={PHASE_META[phase].label}
            >
              {PHASE_META[phase].short}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TransitionCue({
  cue,
  drawCue = null,
  onDone,
}: {
  cue: TransitionCueData | null;
  drawCue?: DrawPresentationCue | null;
  onDone: (id: number) => void;
}) {
  const firstPhase = cue?.phases[0];
  const announcement = !cue
    ? ''
    : cue.kind === 'turn'
      ? `第${cue.turn}ターン、${cue.phases.map((phase) => PHASE_META[phase].label).join('、')}`
      : firstPhase ? `${PHASE_META[firstPhase].label}へ移行` : '';
  return (
    <>
      {cue && <ActiveTransitionCue key={cue.id} cue={cue} drawCue={drawCue} onDone={onDone} />}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}
