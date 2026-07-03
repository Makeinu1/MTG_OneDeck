# M0-FREEZE Handoff

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: M0-R(CR grounding) の成果を M0-FREEZE 判定へ渡すためのハンドオフ。Codex は docs 正本・review.*・git を触らないため、ここでは契約反映前の判定材料だけを固定する。

## 判定

**Codex 観点では、M0-FREEZE 判定に必要な CR-grounding ハンドオフ材料は揃った。ただし、M0-FREEZE はまだ完了していない。**

理由:

- 旧 `research/m-contract-gate/scorecard.md` は 2026-06-25 の旧7条件を測る成果物で、すでに M-CR-RECONCILE により superseded。
- 現行 `npm run m-contract-gate` は CR-grounding overlay を直接判定しない。
- CR-grounding の R-FREEZE-1〜4 は研究草稿として揃ったが、docs 契約への反映と scorecard への配線はレビュー担当(Fable)の承認対象。

したがって、次は「実装」ではなく、**Fable が docs 契約・scorecard 方針へ反映するための M0-FREEZE レビュー**である。

## 現行 scorecard の扱い

| Artifact | 現状 | 扱い |
|---|---|---|
| `research/m-contract-gate/scorecard.md` | 旧7条件は全PASSだが、先頭で superseded と明記 | 凍結根拠にしない |
| `scripts/m-contract-gate.ts` | 旧7条件を再生成する | CR-grounding overlay が入るまで M0-FREEZE 判定器としては不十分 |
| `src/engine/__tests__/review.m-contract-gate.test.ts` | 旧7条件の純集計ロジックを固定 | Codex は変更しない |
| `research/cr-grounding/*` | CR-grounded state-transition と凍結前判断を保持 | M0-FREEZE レビューの入力 |
| `research/cr-grounding/m0-freeze-overlay.json` | CRG-1〜8 / R-FREEZE-1〜4 の機械可読 overlay | scorecard 拡張時の入力候補 |
| `research/cr-grounding/m0-freeze-review-packet.md` | Fable / ユーザー向けの最短レビュー入口 | 読む順番とApprove後の進行確認 |
| `research/cr-grounding/m0-freeze-review-sheet.md` | Fable向け承認/差戻し判定票 | レビュー会話の入口 |
| `research/cr-grounding/m0-freeze-decision-record.md` | Fable / ユーザーが D1〜D6 の承認・差戻しを記録する判定記録 | contract-update stage へ進むかの記録 |
| `research/cr-grounding/m0-freeze-evidence-audit.md` | CRG-1〜8 / D1〜D6 の証拠監査 | Fable承認前の裏取り |
| `research/cr-grounding/m0-freeze-traceability-matrix.md` | CRG-1〜8 の CR refs / golden / executable / overlay / boundary 対応表 | CRを検査器にするための追跡表 |
| `research/cr-grounding/post-freeze-codex-brief.md` | 承認後にCodexへ渡す実装ブリーフ | M0-FREEZE後の委譲候補 |
| `research/cr-grounding/m0-freeze-contract-draft.md` | docs契約更新の文言ドラフト | Fableが docs へ反映する素材 |
| `research/cr-grounding/docs-contract-update-map.md` | 現行docsへの具体的な反映マップ | Fableが docs 更新箇所を決める素材 |
| `research/cr-grounding/docs-contract-update-ready-snippets.md` | docs反映用の貼り込み本文候補 | D1〜D6承認後のFable用素材 |
| `research/cr-grounding/scorecard-overlay-wiring-spec.md` | scorecard overlay配線仕様 | 承認後のCodex実装素材 |
| `research/cr-grounding/scorecard-overlay-code-map.md` | 現行コードに即した scorecard overlay 配線マップ | 承認後のCodex実装素材 |

注意:

- 現時点で `npm run m-contract-gate` をそのまま実行して scorecard を上書きすると、CR-grounding overlay が欠けた旧判定を再生成する可能性がある。
- scorecard 拡張は `docs/engine-spec.md §34.7.2` と `review.m-contract-gate` の契約更新を伴うため、Codex単独で行わない。

## CR-grounding overlay

M0-FREEZE 判定時に、旧7条件に追加して確認する overlay。

機械可読版: `m0-freeze-overlay.json`。

| Overlay | Status | Evidence | M0-FREEZE扱い |
|---|---|---|---|
| CRG-1 CR 2026-06-19固定 | PASS | `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json` / `research/cr-grounding/README.md` | 凍結条件に含める |
| CRG-2 CR-golden定義 | PASS | `research/cr-grounding/golden-cases.json` | 凍結条件に含める |
| CRG-3 統率者税 903.8 | PASS | `m431` / `review.m431` / `golden-cases.json` | 凍結条件に含める |
| CRG-4 マナ能力 605 | PARTIAL | 起動型 605.1a は実装済み。605.1b は `mana-ability-substrate.md` に設計草稿 | `PASS` にしない。S-* carry |
| CRG-4.5 統率者 zone 選択 903.9a/b | PARTIAL | bridge 実装 + `rule-choice-substrate.md` | `PASS` にしない。S-CHOICE carry |
| CRG-5 token death 111.7/704.5d | PASS | `cr-token-dies-before-ceases` executable | 凍結条件に含める |
| CRG-6 誘発/SBA/優先権 603/704/117 | PARTIAL | pending/no-direct-stack/APNAP v1/fixed-point v1 + `priority-event-loop.md` / `sba-inventory.md` | `PASS` にしない。S-EVENTS/S-TURN carry |
| CRG-7 領域移動/LKI 400.7/603.10a | PASS(core) | `cr-zone-change-new-object-lki` executable + `scope-partition.md` | coreのみ凍結可。例外群は S-* carry |
| CRG-8 2026-06-19新語彙 | PASS(boundary) | `cr-20260619-new-mechanics-boundary` + `scope-partition.md` | 語彙認識のみ凍結可。実行器は scope-boundary |

## R-FREEZE handoff

| ID | 成果物 | 決定方向 | Fable確認ポイント |
|---|---|---|---|
| R-FREEZE-1 | `rule-choice-substrate.md` | `pendingSbaChoices` を最終形にせず、`pendingRuleChoices` へ一般化 | 903.9a と 704.5j を同じ queue に載せる方針を契約化するか |
| R-FREEZE-2 | `priority-event-loop.md` | `PendingTrigger.stackPlacementBucket` で 603.3b two-bucket を表現 | `bucket -> APNAP -> controller chosen order` を契約化するか |
| R-FREEZE-3 | `mana-ability-substrate.md` | 605.1b は通常 `pendingTriggers` に入れず mana transaction 内で no-stack即時解決 | `pendingManaTriggers` / `ManaAddedEvent` の導入時期 |
| R-FREEZE-4 | `scope-partition.md` | 未実装を `S-* carry` / `scope-boundary` / `PASS(core)` に分ける | full SBA / 400.7例外 / 新語彙を pass に混ぜない文言 |

## Fable が docs 契約へ反映すべき項目

Codex は `docs/` を変更しない。以下はレビュー担当への反映リスト。

最短レビュー入口: `m0-freeze-review-packet.md`。
判定票: `m0-freeze-review-sheet.md`。
判定記録: `m0-freeze-decision-record.md`。
証拠監査: `m0-freeze-evidence-audit.md`。
traceability matrix: `m0-freeze-traceability-matrix.md`。
契約文ドラフト: `m0-freeze-contract-draft.md`。
docs反映マップ: `docs-contract-update-map.md`。
docs貼り込み候補: `docs-contract-update-ready-snippets.md`。
scorecard実装マップ: `scorecard-overlay-code-map.md`。

1. `docs/engine-spec.md §34.0 / §34.7.1 / §34.7.2`
   - 旧7条件に CR-grounding overlay を追加する。
   - `PASS` / `PASS(core)` / `PASS(boundary)` / `PARTIAL` の意味を明文化する。
   - CRG-4/4.5/6/7/8 の残境界を `S-* carry` / `scope-boundary` として明記する。

2. `docs/acceptance.md`
   - CRG表を `research/cr-grounding/README.md` と同期する。
   - R-FREEZE-1〜4 の成果物を M0-FREEZE 前提として参照する。

3. `scripts/m-contract-gate.ts` / `scripts/lib/mContractGate.ts`
   - Fableが契約更新後、Codexへ実装委譲するなら、旧7条件に CR-grounding overlay を加える。
   - `review.m-contract-gate` はレビュー専有なので、期待更新が必要なら Fable側で行う。
   - 実装仕様は `scorecard-overlay-wiring-spec.md` を参照する。

4. `research/m-contract-gate/scorecard.{md,json}`
   - scorecard 拡張後に再生成する。
   - 旧 `superseded` 注記を、CR-grounding overlay込みの新判定へ置き換える。

## S-* 実装へ渡す backlog

M0-FREEZE が承認された後、実装へ進む順序案。

1. **S-CHOICE / S-TURN**
   - `pendingRuleChoices` 導入。
   - 903.9a commander choice を bridge から汎用 choice へ移行。
   - 704.5j legend rule の golden case を追加。

2. **S-EVENTS / PRIORITY**
   - `PendingTrigger.stackPlacementBucket` backfill。
   - 603.3b second bucket golden cases。
   - `AbilityTriggeredEvent` の導入。

3. **S-EVENTS / MANA**
   - `ManaAddedEvent` / `ActivatedManaAbilityEvent`。
   - 605.1b triggered mana ability no-stack transaction。

4. **S-SBA incremental**
   - `sba-inventory.md` の `S-* carry` から高価値順に実装。
   - 704.5p safe subset はここで扱う。M0-FREEZE前には優先しない。

5. **S-ZONES / S-LAYERS**
   - player-specific zones。
   - full effective-characteristics snapshot。
   - CR 400.7 exception consumers。

## Codex 側の現時点の完了条件

完了:

- CR 2026-06-19 固定の成果物がある。
- CR-grounding golden cases がある。
- 実行可能サブセットが存在する。
- R-FREEZE-1〜4 の研究草稿がある。
- 未実装を pass に混ぜない分類がある。
- M0-FREEZE 判定へ渡すハンドオフがある。

未完了:

- docs 契約反映。
- scorecard 生成器への CR-grounding overlay 配線。
- scorecard 再生成。
- Fableによる M0-FREEZE 承認。

結論: **Codex の次の実装作業は、Fable の M0-FREEZE レビュー後に決めるべきである。現時点で個別SBA実装へ進むのは、プロジェクトの「正しい定規」優先に反する。**
