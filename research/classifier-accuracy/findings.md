# 分類精度ハーネス A0 — Fable 裁定メモ(初回)

`report.md` はハーネス再実行で上書きされるため、人手裁定はここに残す。日付: 2026-06-21。

## ハーネス自己キャリブレーション(計測品自身の検証)

スナップショット側(Scryfall `keywords`)を直接突き合わせ、不一致が**本物の分類器差異**でハーネスのバグでないことを確認した:
- Bureau Headmaster: Scryfall `keywords=[]`(正)。分類器は equip を主張 → 本物の FP。
- Belt of Giant Strength: Scryfall `keywords=['Equip']`、本文に `Equip {10}.` 有り。分類器は取りこぼし → 本物の FN。
- Goddric: Scryfall `keywords=['Flying',...]` だが本文は「is a Dragon **with** flying」(条件付与)。分類器は飛行を**正しく除外** → 既知差分(grant≠has、P1の成果)。

結論: **ハーネスの照合ロジックは妥当**。出力は裁定に使える。

## 全体所見

- `possessedKeywords` の精度は高い。常磐木17種で **FP はほぼ0**(equip の 8 のみ)、**FN は計85**。文法アプローチ(P1)の健全性を裏付け。
- 数値は「Scryfall keywords を候補集合」とした未調整値。下記の既知差分を除けば実FP/FNはさらに小さい。

## 裁定: 既知差分(分類器が意図的に正しく Scryfall と異なる)

- **条件付与の常磐木**: 「~ is a [type] with flying」「target creature gains flying」等。Scryfall は keywords に載せるが、静的保有ではないので分類器は除外して正しい(例 Goddric)。→ known-divergences へ。
- **Un-set/Acorn 等の非正規表記**: 「{TK}{TK}{TK} — Flying」(Ancestral Hot Dog Minotaur)等のレベルアップ式・ジョーク表記。優先度外。
- **変身カードの裏面キーワード**: 表面に無いキーワードが裏面 face に出るケース(Elbrus // Withengar)。表示面の選択依存。

## Phase B の修正ターゲット(本物のバグ)

1. **equip 過検出(FP×8)**: 「Equip abilities you activate cost ...」「creature is equipped」「Equipment card」等の**言及**で `equip` 保有が発火。→ `Equip {cost}` / `Equip—{cost}` / `Equip [quality] {cost}` の**キーワード行**のみに厳格化。
2. **equip 取りこぼし(FN×15)**: `Equip {10}`(2桁)や FF「Job select」同居の `Equip {N}` を拾えていない。→ equip パターンを点検し2桁コスト・複数キーワード行に対応。
3. **`;` 区切りキーワード行(flying FN 等)**: 「Flying; banding」(Nalathni Dragon)をセミコロンで分割できていない。→ キーワード行のセパレータに `;` を追加。

これらは Phase B(Scryfall keywords 活用)と同時に着手し、ハーネス再実行で before/after を提示する。
