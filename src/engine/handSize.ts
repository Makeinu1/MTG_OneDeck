import type { GameState, PlayerId } from './types';

export function effectiveMaximumHandSize(state: GameState, playerId: PlayerId): number | null {
  const override = state.players[playerId]?.maximumHandSizeOverride;
  if (override === 'none') return null;
  if (typeof override === 'number' && Number.isFinite(override)) {
    return Math.max(0, Math.floor(override));
  }

  for (const cardId of state.zones.battlefield) {
    const card = state.cards[cardId];
    if (!card || card.controllerId !== playerId) continue;
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    if (/\byou have no maximum hand size\b/i.test(face?.oracleText ?? '')) return null;
  }
  return 7;
}
