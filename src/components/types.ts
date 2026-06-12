import type { ZoneId } from '../engine/types';

/** A context-menu request: which card, anchored at which screen position. */
export interface MenuTarget {
  cardId: string;
  x: number;
  y: number;
}

/** Zones that a card can be moved to via the context menu. */
export const MOVE_TARGETS: { zone: ZoneId; label: string }[] = [
  { zone: 'battlefield', label: '戦場へ' },
  { zone: 'hand', label: '手札へ' },
  { zone: 'graveyard', label: '墓地へ' },
  { zone: 'exile', label: '追放へ' },
  { zone: 'library', label: 'ライブラリへ(一番上)' },
  { zone: 'command', label: '統率領域へ' },
];
