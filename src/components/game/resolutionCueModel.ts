import type { GameState } from '../../engine/types';

export interface ResolutionCueResult {
  state: GameState | null;
  resolutionSession: object | null;
}

/**
 * A resolve success cue belongs to a completed state transition, not to a
 * request or a handoff into manual work. The former top object must actually
 * have left the stack and no manual resolution session may remain open.
 */
export function completedAutomaticTopResolution(
  before: GameState | null,
  after: ResolutionCueResult,
): boolean {
  const sourceId = before?.zones.stack.at(-1);
  if (!sourceId || !after.state || after.resolutionSession !== null) return false;
  return !after.state.zones.stack.includes(sourceId);
}
