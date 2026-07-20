# V1 Playability Assessment — Top-10 Gaps (2026-07-20 再走)

Author: qwen判定者(replenishment checkpoint)。Measurement: `npx tsx scripts/mydeck-scoring/census.ts` + `playthrough.ts`。
旧版(2026-07-07 J2 Opus) = `top-10-v1-gaps-2026-07-07.md`。

## Headline

census 4デッキ(363 resolved cards, 664 ability lines):

| bucket | cards | lines |
|---|---:|---:|
| auto | 39 (11%) | 102/664 (15%) |
| guided | 32 (9%) | 66/664 (10%) |
| manual | 292 (80%) | 496/664 (75%) |

playthrough: **4デッキすべて10/10ターン・クラッシュ0・エンジンエラー0**。

## 旧版(2026-07-07)からの変化

カード単位の auto/guided/manual 分布は不変(39/32/292)。ACT-1〜3・MP基盤・UX群の出荷は
**信頼性・UI到達性・起動コスト経路**の改善であり、新規カードの auto 化ではない。
真の自動化フロンティア≈156枚の推定は維持。

## Manual 理由カテゴリ(card-level count)

| reason | cards | 意味 |
|---|---:|---|
| needs-target | 202 | 対象選択が必要(コンパイラは対象を決定できない) |
| needs-parse | 168 | 構文が未解析(compiler が IR を生成できない) |
| no-effect | 109 | 効果タイプが未実装(GameCommand がない) |
| optional | 66 | "you may" 系(意図的サンドボックス・manual が正) |
| needs-choice | 55 | プレイヤー選択が必要 |
| ambiguous-mana | 39 | マナコスト曖昧(多色/汎用) |
| variable-count | 37 | 可変数(up to X / any number) |
| no-command | 29 | 対応 GameCommand が存在しない |

## Top-10 品質ギャップ(実プレイ摩擦順・2026-07-20 裁定)

| # | gap | cards | 対応予定 |
|---|---|---:|---|
| 1 | cross-player 効果(each player/opponent 系) | 54 | **plannedSequence[14] pending** |
| 2 | mass 効果(each creature/all creatures 系) | 12 | plannedSequence[15] pending |
| 3 | needs-choice 色ダイアログ(ACT-1 carry) | ~4 | plannedSequence[16] carry群 |
| 4 | 誘発型 DFC 面フィルタ(CR712.8d) | 43 | plannedSequence[16] carry群 |
| 5 | ACT-4 コスト語彙(tap-other/counter/X) | ~23 | plannedSequence[29] pending |
| 6 | Fabled Passage 型条件付きアンタップ | 4 | cross-player と関連(2+ opponents 条件) |
| 7 | variable-count(up-to/any-number) | 37 | cr-121 出荷済み loot 型。残は needs-parse 依存 |
| 8 | ambiguous-mana(多色/汎用コスト) | 39 | autotap solver 改善(ACT-4 と関連) |
| 9 | needs-parse 構文拡張(最大カテゴリ) | 168 | 摩擦順で逐次(A6 フロンティア消化) |
| 10 | no-effect 新 GameCommand 需要 | 109 | 抽象昇格テスト(judge-protocol §5.1)で個別裁定 |

## 注記

- `optional`(66枚)は意図的サンドボックス(manual が正しい挙動)。ギャップではない。
- cross-player 54枚には "enters tapped unless 2+ opponents" 土地(4種×2デッキ)を含む。
- PW は4枚のみ(Liliana/Teferi/Tezzeret/Ugin)。ACT-5 忠誠度は需要薄で据置。
- 計器の数値は playthrough+judge 照合+census 実測で叩くまで裁定に使わない(戦略レビュー §2 教訓)。
