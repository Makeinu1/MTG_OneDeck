/**
 * landRowModel — 土地行の束ね規則(純関数)。docs/design-system.md §8 LandRow。
 *
 * §8 の規則:
 *  - **同名の基本地形はずらし重ね**で束ねる(Forest ×n)。
 *  - **Snow-Covered も別束**(名前が異なるため name グループ分けで自動的に分かれる)。
 *  - **特殊地形(非基本)は個別カード**(束ねない=各1枚の束)。
 *  - 束内にタップ済みが混じる場合は tappedCount>0 を返し、UI が傾き+「n⤵」を出す。
 *  - 統率者は行左端に常駐(束ね対象外=呼び出し側で分離)。
 *
 * 純粋性: 同一入力 → 同一出力。入力配列も出力も変異しない。入力順(=盤面 zone 順)を保つ。
 */

/** 束ね判定に必要な最小のカード情報(GameState 非依存=純粋・テスト容易)。 */
export interface LandRowCard {
  id: string;
  /** グルーピングキーになる oracle 名(英語正本。Forest / Snow-Covered Forest 等)。 */
  name: string;
  /** 基本地形か(typeLine に "Basic" を含む)。false=特殊地形は束ねない。 */
  isBasic: boolean;
  tapped: boolean;
}

/** 束ね結果。isBundle=false は特殊地形/単体、true は同名基本地形の束。 */
export interface LandBundle {
  /** 安定キー(基本地形=`basic:<name>`、非基本=カード id)。 */
  key: string;
  name: string;
  /** 束に含まれるカード id(盤面順)。先頭が最前面。 */
  cardIds: string[];
  /** タップ済み枚数(0=全アンタップ)。 */
  tappedCount: number;
  /** 2枚以上の同名基本地形束か(false=特殊地形 or 基本1枚)。 */
  isBundle: boolean;
}

/**
 * 土地カード列を LandRow の束へ畳む。同名基本地形のみ束ね、特殊地形は個別。
 * 束の出現順は「その名前が最初に現れた位置」を保つ(盤面の視覚的安定性)。
 */
export function bundleLands(cards: readonly LandRowCard[]): LandBundle[] {
  const bundles: LandBundle[] = [];
  const basicBundleIndex = new Map<string, number>();

  for (const card of cards) {
    if (!card.isBasic) {
      // 特殊地形: 常に個別束(束ねない)。
      bundles.push({
        key: card.id,
        name: card.name,
        cardIds: [card.id],
        tappedCount: card.tapped ? 1 : 0,
        isBundle: false,
      });
      continue;
    }

    const existing = basicBundleIndex.get(card.name);
    if (existing === undefined) {
      basicBundleIndex.set(card.name, bundles.length);
      bundles.push({
        key: `basic:${card.name}`,
        name: card.name,
        cardIds: [card.id],
        tappedCount: card.tapped ? 1 : 0,
        isBundle: false, // 1枚のうちは束でない(2枚目で true 化)。
      });
    } else {
      const bundle = bundles[existing];
      bundles[existing] = {
        ...bundle,
        cardIds: [...bundle.cardIds, card.id],
        tappedCount: bundle.tappedCount + (card.tapped ? 1 : 0),
        isBundle: true,
      };
    }
  }

  return bundles;
}
