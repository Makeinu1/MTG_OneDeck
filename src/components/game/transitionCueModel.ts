import type { GameState, Phase } from '../../engine/types';

export const AUTO_TURN_PHASES = ['untap', 'upkeep', 'draw', 'main1'] as const satisfies readonly Phase[];
export const PHASE_CUE_MS = 520;
export const TURN_PHASE_STEP_MS = 190;
export const TURN_CUE_LEAD_MS = 220;

export interface TransitionCueData {
  id: number;
  kind: 'turn' | 'phase';
  turn: number;
  phases: Phase[];
  drawAtMs: number | null;
  durationMs: number;
}

export function transitionCueFor(
  previous: Pick<GameState, 'turn' | 'phase'>,
  next: Pick<GameState, 'turn' | 'phase'>,
  options: { forceTurnStart?: boolean } = {},
): Omit<TransitionCueData, 'id'> | null {
  const turnStarted = options.forceTurnStart === true || previous.turn !== next.turn;
  if (turnStarted) {
    const phases = next.phase === 'main1'
      ? [...AUTO_TURN_PHASES]
      : [next.phase];
    const drawIndex = phases.indexOf('draw');
    return {
      kind: 'turn',
      turn: next.turn,
      phases,
      drawAtMs: drawIndex < 0 ? null : TURN_CUE_LEAD_MS + drawIndex * TURN_PHASE_STEP_MS,
      durationMs: TURN_CUE_LEAD_MS + phases.length * TURN_PHASE_STEP_MS + 120,
    };
  }
  if (previous.phase !== next.phase) {
    return {
      kind: 'phase',
      turn: next.turn,
      phases: [next.phase],
      drawAtMs: next.phase === 'draw' ? 0 : null,
      durationMs: PHASE_CUE_MS,
    };
  }
  return null;
}
