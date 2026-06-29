# M0-FREEZE Review Packet

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable / ユーザーが M0-FREEZE の次判断を短時間で行うための入口。詳細artifactを読む順番、承認範囲、承認後の委譲順を1枚に固定する。

## 先に結論

Codex 推奨:

> D1〜D6 は **Approve to contract-update stage**。ただし **M0-FREEZE 完了ではない**。S-* 実装にもまだ進まない。

理由:

- CR 2026-06-19 固定、CRG-1〜8 overlay、R-FREEZE-1〜4 設計草稿、証拠監査は揃った。
- 代表テストと CR本文 SHA-256 は確認済み。
- ただし docs契約反映、scorecard overlay配線、scorecard再生成、Fableの最終承認が未完了。

## 読む順番

最短レビューならこの順で読む。

1. `m0-freeze-evidence-audit.md`
   - CRG-1〜8 の証拠がどの程度強いか。
   - targeted vitest と CR本文確認の結果。

2. `m0-freeze-traceability-matrix.md`
   - CR条文、golden case、executable test、overlay treatment、残境界が一列で辿れるか。

3. `m0-freeze-decision-record.md`
   - D1〜D6 を `Approve` / `Reject` / `Hold` で記録する。
   - 承認対象が contract-update stage までであることを確認する。

4. `q1-fable-one-shot-brief.md`
   - Q1 を閉じるための一枚ブリーフ。post-apply commands と Q2 handoff を含む。

5. `docs-contract-update-map.md`
   - 承認後、`docs/engine-spec.md` / `docs/acceptance.md` にどこを追記するか。
   - 実際に貼り込む本文候補は `docs-contract-update-ready-snippets.md`。

6. `m0-freeze-execution-queue.md`
   - 承認後の実行順、所有者、触ってよいファイル、exit criteria、stop condition。

7. `m0-freeze-q1-gap-audit.md`
   - 現物 docs / scorecard が Q1 を満たしていない箇所と、適用すべき snippet。

8. `scorecard-overlay-code-map.md`
   - docs更新後に Codex へ委譲する Gate wiring の具体コードマップ。

時間があれば、以下で背景を確認する。

- `m0-freeze-handoff.md`: 全体ハンドオフ。
- `m0-freeze-overlay.json`: 機械可読 overlay 正本。
- `m0-r-freeze-readiness.md`: なぜ個別SBA実装ではなく設計判断が先か。
- `rule-choice-substrate.md` / `priority-event-loop.md` / `mana-ability-substrate.md` / `scope-partition.md`: R-FREEZE-1〜4 の詳細。

## 判定すること

| Decision | 推奨 | 承認の意味 |
|---|---|---|
| D1: CR-grounding overlay を旧7条件に追加する | Approve | 旧 scorecard 単独 FROZEN へ戻さない |
| D2: `PASS(core)` / `PASS(boundary)` / `PARTIAL` を契約語彙にする | Approve | 未実装を plain PASS に混ぜない |
| D3: `pendingRuleChoices` 方針 | Approve | 903.9a と 704.5j を同じ choice substrate に載せる |
| D4: `PendingTrigger.stackPlacementBucket` 方針 | Approve | CR 603.3b two-part process を APNAP v1 に接続する |
| D5: triggered mana ability no-stack transaction 方針 | Approve | CR 605.1b/605.4a を通常誘発stack経路に混ぜない |
| D6: scope partition 方針 | Approve | 400.7例外群、full SBA、新語彙実行器を境界として残す |

## Approve しても完了しないもの

Approve to contract-update stage は、以下を完了したことを意味しない。

- M0-FREEZE 完了。
- S-* 実装着手。
- `m-contract-gate` が CR-grounding overlay を読んでいること。
- `research/m-contract-gate/scorecard.*` が overlay 込みで再生成済みであること。
- 603.3b second bucket / 605.1b triggered mana ability / generic `pendingRuleChoices` / full SBA suite の実装。

## Approve 後の順番

Approve 後は次の順に進める。

1. Fable が docs契約を更新する。
   - 反映マップ: `docs-contract-update-map.md`
   - 文言ドラフト: `m0-freeze-contract-draft.md`
   - 貼り込み本文候補: `docs-contract-update-ready-snippets.md`

2. Fable が `review.m-contract-gate` の期待更新要否を判断する。
   - Codex は `review.*` を変更しない。

3. Codex が Gate wiring を実装する。
   - 実行順: `m0-freeze-execution-queue.md`
   - 実装仕様: `scorecard-overlay-wiring-spec.md`
   - 現行コード対応: `scorecard-overlay-code-map.md`
   - 対象候補: `scripts/lib/mContractGate.ts` / `scripts/m-contract-gate.ts`
   - S-* 実装はしない。

4. scorecard を再生成する。
   - `npm run m-contract-gate`
   - 旧 superseded 注記を overlay included 注記へ置換。

5. 検証する。
   - overlay 通常テスト
   - `review.m-contract-gate`
   - 機械チェック4点

6. Fable が M0-FREEZE を最終承認する。

7. その後に `post-freeze-codex-brief.md` の Phase 1 以降へ進む。

## Reject / Hold の場合

Reject / Hold の場合は、該当する差戻し先だけを更新する。

| 問題 | 差戻し先 |
|---|---|
| CR固定・SHAに疑義 | `m0-freeze-evidence-audit.md` / CR metadata |
| golden case不足 | `golden-cases.json` |
| choice substrate 方針に反対 | `rule-choice-substrate.md` |
| 603.3b bucket 方針に反対 | `priority-event-loop.md` |
| 605.1b no-stack 方針に反対 | `mana-ability-substrate.md` |
| 未実装境界の分類に反対 | `scope-partition.md` |
| docs反映方針に反対 | `docs-contract-update-map.md` / `m0-freeze-contract-draft.md` |
| scorecard配線方針に反対 | `scorecard-overlay-wiring-spec.md` / `scorecard-overlay-code-map.md` |

## Codex の現在の境界

Fable decision が Pending の間、Codex は以下をしない。

- `docs/` 契約ファイルの変更。
- `review.*` テストの変更。
- `scripts/m-contract-gate.ts` / `scripts/lib/mContractGate.ts` の変更。
- `npm run m-contract-gate` による scorecard 上書き。
- git 操作。
- S-* 実装。

許可されるのは、`research/cr-grounding/` の判定材料補強、矛盾検出、導線整理、JSON/Markdown整合確認。

## 一文判断

この packet を読んだ後の次アクションは、`m0-freeze-decision-record.md` の D1〜D6 を記録すること。Codex視点では全て **Approve to contract-update stage** が妥当。
