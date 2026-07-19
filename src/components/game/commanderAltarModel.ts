import { commanderTax } from '../../engine/commander';
import type { GameState, ZoneId } from '../../engine/types';

import { ZONE_LABELS_JA } from '../../data/zoneLabels';

export const COMMANDER_ZONE_LABELS: Record<ZoneId, string> = ZONE_LABELS_JA;

export function commanderAltarItems(state: GameState) {
  return state.commanders.flatMap((info) => {
    const card = state.cards[info.cardId];
    if (!card) return [];
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    return [{
      cardId: info.cardId,
      name: face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? info.cardId,
      zone: card.zone,
      zoneLabel: ZONE_LABELS_JA[card.zone],
      tax: commanderTax(state, info.cardId),
      inCommandZone: card.zone === 'command',
    }];
  });
}

/** Desktop keeps the full altar only while at least one commander is available there. */
export function commanderAltarCollapsed(state: GameState): boolean {
  const items = commanderAltarItems(state);
  return items.length > 0 && items.every((item) => !item.inCommandZone);
}
