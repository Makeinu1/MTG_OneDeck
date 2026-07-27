/**
 * twoPhaseBeat — AV6 phase derivation helpers (pure, no React/DOM/audio).
 * docs/audio-visual-contract.md §11「2フェーズリズム + ダンスフロア照明」.
 */
import type { GameState } from '../../../engine/types';

/** Whether any commander is currently on the battlefield. */
export function commanderOnBattlefield(state: GameState): boolean {
  return state.commanders.some((c) => state.cards[c.cardId]?.zone === 'battlefield');
}

const WUBRG_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;

/**
 * Compute light pool colors from all commanders' colorIdentity.
 * Returns WUBRG-ordered deduped array, capped at 5.
 * Returns ['gold'] if colorless or defs missing.
 */
export function lightPoolColors(state: GameState): string[] {
  const colors = new Set<string>();
  for (const cmd of state.commanders) {
    const card = state.cards[cmd.cardId];
    if (!card) continue;
    const def = state.defs[card.defId];
    if (!def) continue;
    for (const c of def.colorIdentity) {
      if (WUBRG_ORDER.includes(c as typeof WUBRG_ORDER[number])) colors.add(c);
    }
  }
  if (colors.size === 0) return ['gold'];
  return WUBRG_ORDER.filter((c) => colors.has(c)).slice(0, 5);
}
