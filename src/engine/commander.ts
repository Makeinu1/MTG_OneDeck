import type { GameState } from './types';

/**
 * Whether the given card instance is a commander in this game.
 */
export function isCommander(state: GameState, cardId: string): boolean {
  return state.commanders.some((c) => c.cardId === cardId);
}

/**
 * Commander tax for the given card: 2 * castCount. Returns 0 if not a commander.
 */
export function commanderTax(state: GameState, cardId: string): number {
  const info = state.commanders.find((c) => c.cardId === cardId);
  return info ? 2 * info.castCount : 0;
}
