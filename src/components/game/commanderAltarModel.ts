import { commanderTax } from '../../engine/commander';
import type { GameState, ZoneId } from '../../engine/types';

export const COMMANDER_ZONE_LABELS: Record<ZoneId, string> = {
  library: 'ライブラリー',
  hand: '手札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
  stack: 'スタック',
};

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
      zoneLabel: COMMANDER_ZONE_LABELS[card.zone],
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
