import type { GameState, Phase } from '../../engine/types';

export interface TransitionCueData {
  id: number;
  kind: 'turn' | 'phase';
  turn: number;
  phase: Phase;
}

export function transitionCueFor(
  previous: Pick<GameState, 'turn' | 'phase'>,
  next: Pick<GameState, 'turn' | 'phase'>,
): Omit<TransitionCueData, 'id'> | null {
  if (previous.turn !== next.turn) {
    return { kind: 'turn', turn: next.turn, phase: next.phase };
  }
  if (previous.phase !== next.phase) {
    return { kind: 'phase', turn: next.turn, phase: next.phase };
  }
  return null;
}

