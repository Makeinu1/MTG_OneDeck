import type { GameState, ManaPool } from '../../engine/types';
import type { ManaColor } from '../../types/card';

const MANA_COLORS: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export interface ManaReadinessModel {
  pool: ManaPool;
  poolTotal: number;
  untappedSourceCount: number;
}

export function manaReadinessModel(state: GameState): ManaReadinessModel {
  const pool = { ...state.manaPool };
  const poolTotal = MANA_COLORS.reduce((sum, color) => sum + (pool[color] ?? 0), 0);
  const untappedSourceCount = state.zones.battlefield.reduce((count, cardId) => {
    const card = state.cards[cardId];
    if (!card || card.tapped || card.isAbility) return count;
    const def = state.defs[card.defId];
    return (def?.producedMana?.length ?? 0) > 0 ? count + 1 : count;
  }, 0);
  return { pool, poolTotal, untappedSourceCount };
}
