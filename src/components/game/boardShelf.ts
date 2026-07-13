/**
 * boardShelf — 盤面カード棚の密度計算(純関数)。docs/design-system.md §8 BoardShelf。
 *
 * 盤面(クリーチャー行/その他行)は統一サイズの棚。枚数で基準カード幅を自動縮小し、
 * 14枚以上で重ね(overlap)に切り替える。CSS は本モジュールが返す値をトークン変数へ流す。
 *
 * 密度段階(§8): 〜5枚=96px / 6〜9枚=84px / 10枚〜=72px / 14枚〜は重ね。
 * 純粋性: 同一 count → 同一出力。副作用なし。
 */

/** 盤面カード基準幅(px)。BoardShelf 密度段階。 */
export type BoardCardWidth = 96 | 84 | 72;

/** 密度閾値(§8。上端は「その枚数まで」)。 */
export const BOARD_DENSITY_THRESHOLDS = {
  /** 〜5枚 = 96px。 */
  base: 5,
  /** 6〜9枚 = 84px。 */
  mid: 9,
  /** 14枚〜は重ね。 */
  overlap: 14,
} as const;

/** 枚数 → 盤面カード基準幅(px)。§8 密度段階。 */
export function boardCardWidth(count: number): BoardCardWidth {
  if (count <= BOARD_DENSITY_THRESHOLDS.base) return 96;
  if (count <= BOARD_DENSITY_THRESHOLDS.mid) return 84;
  return 72;
}

/** 14枚以上で重ね表示に切り替えるか。§8。 */
export function isBoardOverlap(count: number): boolean {
  return count >= BOARD_DENSITY_THRESHOLDS.overlap;
}

/** カード自身の幅を基準にした重なり量。棚幅基準の% marginを使わない。 */
export function boardOverlapMargin(width: BoardCardWidth): number {
  return -Math.round(width * 0.36);
}

/** 密度段階の識別子(CSS class / data 属性用)。 */
export type BoardDensity = 'base' | 'mid' | 'high' | 'overlap';

export function boardDensity(count: number): BoardDensity {
  if (isBoardOverlap(count)) return 'overlap';
  if (count <= BOARD_DENSITY_THRESHOLDS.base) return 'base';
  if (count <= BOARD_DENSITY_THRESHOLDS.mid) return 'mid';
  return 'high';
}
