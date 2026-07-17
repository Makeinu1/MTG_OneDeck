import { useEffect, useState } from 'react';
import { PHASE_META } from './statusBandModel';
import {
  TURN_CUE_LEAD_MS,
  TURN_PHASE_STEP_MS,
  type TransitionCueData,
} from './transitionCueModel';

function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ActiveTransitionCue({
  cue,
  onDone,
}: {
  cue: TransitionCueData;
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

  return (
    <div className="turn-transition-layer" data-testid="transition-cue" data-kind={cue.kind}>
      <div className="turn-transition-cue" aria-hidden="true">
        {cue.kind === 'turn' && <small>第{cue.turn}ターン</small>}
        <strong>{phaseLabel}</strong>
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
  onDone,
}: {
  cue: TransitionCueData | null;
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
      {cue && <ActiveTransitionCue key={cue.id} cue={cue} onDone={onDone} />}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}
