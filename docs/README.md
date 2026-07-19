# ドキュメント案内 — 何を正本として読むか

> **役割**: このファイルは入口と状態一覧であり、個別契約を上書きしない。
> **最終棚卸し**: 2026-07-16 判定者(統治リストラ時)。

## まず読む順序

**読込順の正本 = `docs/judge-protocol.md` §0**(ここでは重複させない)。
設計・実装の詳細は、判断の種類に応じて以下の状態一覧から該当文書だけを読む。複数文書を最初から全文読んで最新状態を推測してはならない。

## 文書の状態

| 文書 | 役割 | 現在の扱い |
|---|---|---|
| `docs/engine-spec.md` | エンジンAPI契約 | **active contract**。意味変更は判定者承認が必要 |
| `docs/acceptance.md` | E2E受け入れ契約 | **active contract**。ただし新旧UIが混在するためPC回復時に再照合 |
| `docs/design-vision.md` | WHY・北極星②・設計原則 | **principles active / 2026-07-08診断はhistorical baseline** |
| `docs/design-system.md` | 視覚トークンと部品言語 | **tokens active / desktop部品配置はreconciliation中** |
| `docs/ui-architecture-v2.md` | UI移行の目標構造 | **partially implemented**。D4未完、現行コードの説明書ではない |
| `docs/design-playbook.md` | D0〜D7実行カード | **historical execution contract**。D4回復契約の再承認まで新規実行に使わない |
| `research/design/mockups/index.html` | 2026-07-09時点の視覚案v4 | **reference, not current truth**。現行PC問題を反映していない |
| `research/design/pc-ui-regression-diagnosis.draft.md` | PC退行の実測診断 | **未監査draft**(判定者不在期に作成) |
| `research/design/design-recovery-plan.draft.md` | 文書・デザイン・進行の回復案 | **未監査draft** |
| `research/design/r1-pc-ui-baseline.draft.md` | 新旧UIの実測比較 | **未監査draft / 基礎比較完了** |
| `research/design/d4a-pc-affordance-recovery.draft.md` | PC回復の受け入れ契約案 | **未監査draft / 契約未承認** |
| `research/design/d4a-review-plan.draft.md` | D4a独立reviewのアサーション計画 | **未監査draft** |
| `src/dev/visualFixtures/` | 6場面の決定論的visual state builder | **dev-only / 製品entry未接続** |
| `research/archive/` | M-CONTRACT期の退蔵計測レーン15本+旧監査 | **historical**。索引 = `research/archive/README.md` |

### エンジン関連の補助文書

| 文書 | 現在の扱い |
|---|---|
| `docs/engine-design-method.md` | **active method**。設計サイクルと抽象昇格規律 |
| `docs/architecture-substrate-compiler.md` | アーキテクチャの背景。実装状態はledgerとengine-specを優先 |
| `docs/engine-state-ontology.md` / `docs/oracle-grammar-catalog.md` | M0研究成果。runtimeの実装済み主張には使わない |
| `docs/oracle-harness.md` | LLM-oracle計測契約。決定論的CR判断の代替ではない |
| `docs/mtg-rule-terms.md` | 用語参照。CR 2026-06-19を上位権威とする |
| `docs/rule-automation-plan.md` / `docs/m5-rule-implementation-proposal.md` / `docs/engine-refactoring-plan.md` | **historical proposals**。現行スライスの正本にしない |

## 現在の製品状態(2026-07-16)

- D0/D1/D2/D3/D5 は出荷済み。多人数基盤(MP-STATE〜MP-BOARD・対戦相手セットアップ)は 2026-07-16 出荷。
- **D4 デスクトップ再構成は未完了**。現行PC版はD2の単一カラムを1100pxに制限した暫定版。
- D5をD4より先に出荷したため、ロードマップの番号順と実製品の完成順は一致しない。
- 現行 `GameScreen` はhover previewとDnDを失い、8枚手札・フェーズ可読性・ゾーン視認性・
  土地表示・盤面幅でユーザー確認済みの退行がある。
- 旧 `Playmat` とその周辺12ファイル(Battlefield/GameLog/Hand/InfoPanel/MobileControlsDrawer/
  MobileZoneSwap/PlaymatHud/Stack/TargetPickerDialog/Toasts/TriggerCandidatePanel/Zones)は
  **2026-07-19 に削除済み**(ユーザー授権・D4前倒し)。既定経路は本番デフォルトでは到達不能
  (dev fixture `?ui=legacy` のみ)だった=生きた同等性参照ではなくなっていたための撤去。
  ロールバックは `git revert`。現役だった `dialogs.tsx`/`ruleActionCandidates.ts` は
  `src/components/game/` へ移設(旧UI専用ではなく新UIが常時 import する現役コード)。
- **PC版退行の回復は旧 `Playmat` 復活ではなく D4(デスクトップ grid-area)で行う**
  (作業計画 = `research/design/d4a-*`)。旧実装は同等性参照として残さない。

## 腐敗を増やさない規則

1. 文書冒頭に `active contract / historical / draft / superseded` のどれかを明記する。
2. 「予定」と「実装結果」を同じ段落へ追記し続けない。実装証跡は台帳またはarchiveへ置く。
3. 期限付き運用には日付だけでなく終了条件を持たせ、終了時に現役本文から除く。
4. デザイン文書は **WHY(vision) / WHAT(system) / HOW(architecture) / NOW(ledger・loop-state)**
   を混ぜない。
5. モックは仮説であり、実機でユーザー価値を損ねた場合は実測を優先して再設計する。
6. 1スライスの終了時に、コードだけでなく文書の状態・リンク・未完了DEFERを照合する。
7. 同じルールを2文書に書かない(**二重管理は必ずドリフトする**)。正本の地図 = `CLAUDE.md`「統治の読み方」。

## 未処理の再オーナー化事項(2026-07-16 棚卸し)

- `research/design/*recovery*.draft.md` をユーザー指摘・実測スクリーンショットへ照合し、採用または撤回する(未監査draftの独立監査)。
- D4を「PC回復」「デスクトップ再構成」「旧実装削除」に分割する契約変更を判定者が裁定する(§7 格上げ事項)。
- ~~judge-protocol §2 の終了済み score.ts 暫定則の退役~~(2026-07-16 完了)。
