import type { GameState, PlayerId } from './types';

// CR 205.2a. This finite list excludes supertypes and subtypes so
// delirium-style counts cannot accidentally include "Legendary" or creature types.
const CARD_TYPES = [
  'Artifact',
  'Battle',
  'Creature',
  'Enchantment',
  'Instant',
  'Kindred',
  'Land',
  'Planeswalker',
  'Sorcery',
] as const;

export function distinctCardTypesInGraveyard(
  state: GameState,
  playerId: PlayerId,
): Set<string> {
  const result = new Set<string>();
  for (const cardId of state.zonesByPlayer[playerId]?.graveyard ?? []) {
    const card = state.cards[cardId];
    const def = card ? state.defs[card.defId] : undefined;
    const face = card ? (def?.faces[card.faceIndex] ?? def?.faces[0]) : undefined;
    const typeLine = face?.typeLine ?? def?.typeLine ?? '';
    for (const cardType of CARD_TYPES) {
      if (new RegExp(`\\b${cardType}\\b`, 'i').test(typeLine)) result.add(cardType);
    }
  }
  return result;
}
