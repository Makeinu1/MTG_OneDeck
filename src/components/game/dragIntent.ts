import { isCommander } from '../../engine/commander';
import type { GameState, ZoneId } from '../../engine/types';

export type DropTarget =
  | { kind: 'cast' }
  | { kind: 'play-land' }
  | { kind: 'move-zone'; zone: ZoneId };

export type DropIntent =
  | { kind: 'cast'; cardId: string }
  | { kind: 'play-land'; cardId: string }
  | { kind: 'move-zone'; cardId: string; zone: ZoneId }
  | { kind: 'none' };

function typeLineFor(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.typeLine ?? def?.typeLine ?? '';
}

export function isLandCard(state: GameState, cardId: string): boolean {
  return typeLineFor(state, cardId).includes('Land');
}

/** Convert a visible drop target into the same semantic action used by card sheets. */
export function resolveDropIntent(
  state: GameState,
  cardId: string,
  target: DropTarget | null,
): DropIntent {
  const card = state.cards[cardId];
  if (!card || !target) return { kind: 'none' };
  // スタック上のカードは resolveTop/removeStackItem だけが解決時効果(CR608)を適用できる。
  // 汎用 move-zone はそれを迂回して効果を無言で落とすため、D&D では受け付けない。
  if (card.zone === 'stack') return { kind: 'none' };

  if (target.kind === 'cast') {
    if (isLandCard(state, cardId)) return { kind: 'none' };
    if (card.zone !== 'hand' && card.zone !== 'command') return { kind: 'none' };
    return { kind: 'cast', cardId };
  }

  if (target.kind === 'play-land') {
    if (!isLandCard(state, cardId)) return { kind: 'none' };
    if (card.zone !== 'hand' && card.zone !== 'graveyard') return { kind: 'none' };
    return { kind: 'play-land', cardId };
  }

  if (card.zone === target.zone) return { kind: 'none' };
  // 統率者領域は統率者しか描画しない(commanderAltarItems)。非統率者を落とすと
  // 盤上のどこにも現れず undo でしか戻せないため、D&D では fail-closed にする。
  // 意図的に動かしたい時はカードシートの「統率領域へ」が残っている。
  if (target.zone === 'command' && !isCommander(state, cardId)) return { kind: 'none' };
  return { kind: 'move-zone', cardId, zone: target.zone };
}
