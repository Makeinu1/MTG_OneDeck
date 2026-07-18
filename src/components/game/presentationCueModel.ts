import type { GameEvent, GameState } from '../../engine/types';
import type { TransitionCueData } from './transitionCueModel';
import { appendedLocalDraws, drawStaggerMs } from './drawAnimationModel';

export const DRAW_PRESENTATION_MS = 650;

export interface DrawPresentationCue {
  id: string;
  cardIds: string[];
  primaryName: string;
  extraCount: number;
  delayMs: number;
  durationMs: number;
  phaseBound: boolean;
}

function cardName(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  const def = card ? state.defs[card.defId] : undefined;
  const face = card ? (def?.faces[card.faceIndex] ?? def?.faces[0]) : undefined;
  return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? 'カード';
}

export function drawPresentationForAppend(input: {
  previousEvents: readonly GameEvent[] | null;
  state: GameState;
  transitionCue: TransitionCueData | null;
}): DrawPresentationCue | null {
  const arrivals = appendedLocalDraws(
    input.previousEvents,
    input.state.eventLog,
    input.state.localPlayerId,
  ).filter(({ cardId }) => input.state.cards[cardId]?.zone === 'hand');
  if (arrivals.length === 0) return null;

  const phaseBound = arrivals.some(({ causeCommandType }) => causeCommandType === 'nextPhase')
    && input.transitionCue?.phases.includes('draw') === true;
  const delayMs = phaseBound ? (input.transitionCue?.drawAtMs ?? 0) : 0;
  const lastStagger = drawStaggerMs(arrivals.length - 1);
  return {
    id: arrivals.map(({ eventId }) => eventId).join(':'),
    cardIds: arrivals.map(({ cardId }) => cardId),
    primaryName: cardName(input.state, arrivals[0].cardId),
    extraCount: arrivals.length - 1,
    delayMs,
    durationMs: DRAW_PRESENTATION_MS + lastStagger,
    phaseBound,
  };
}

export function drawPresentationText(cue: DrawPresentationCue): string {
  return `《${cue.primaryName}》を引きました${cue.extraCount > 0 ? `、ほか${cue.extraCount}枚` : ''}`;
}
