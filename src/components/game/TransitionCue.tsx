import { useEffect } from 'react';
import { PHASE_META } from './statusBandModel';
import type { TransitionCueData } from './transitionCueModel';

export function TransitionCue({
  cue,
  onDone,
}: {
  cue: TransitionCueData | null;
  onDone: (id: number) => void;
}) {
  useEffect(() => {
    if (!cue) return;
    const timer = setTimeout(() => onDone(cue.id), cue.kind === 'turn' ? 1100 : 760);
    return () => clearTimeout(timer);
  }, [cue, onDone]);

  const phaseLabel = cue ? PHASE_META[cue.phase].label : '';
  const announcement = !cue
    ? ''
    : cue.kind === 'turn'
      ? `第${cue.turn}ターン、${phaseLabel}`
      : `${phaseLabel}へ移行`;

  return (
    <>
      {cue && (
        <div key={cue.id} className="turn-transition-layer" data-testid="transition-cue" data-kind={cue.kind}>
          <div className="turn-transition-cue" aria-hidden="true">
            {cue.kind === 'turn' && <small>第{cue.turn}ターン</small>}
            <strong>{phaseLabel}</strong>
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}
