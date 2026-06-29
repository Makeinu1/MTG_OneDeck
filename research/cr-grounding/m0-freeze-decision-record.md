# M0-FREEZE Decision Record

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable / ユーザーが M0-FREEZE の承認・差戻しを短時間で記録し、その後の Codex 委譲範囲を曖昧にしないための判定記録。

## 現在の状態

**Decision status: Pending Fable decision.**

Codex の推奨は、`m0-freeze-review-sheet.md` と同じく次の通り。

> Approve to contract-update stage, not to S-* implementation yet.

この承認は「M0-FREEZE 完了」ではない。意味は以下に限定する。

- CR-grounding overlay を docs 契約へ昇格する判断に進める。
- 旧7条件だけで FROZEN へ戻さない。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` を通常の `PASS` に潰さない。
- S-* 実装は、契約反映・scorecard overlay 配線・scorecard 再生成・Fable承認の後に始める。

## 判定対象

| Decision | Codex推奨 | Fable decision | 差戻し先 |
|---|---|---|---|
| D1: CR-grounding overlay を旧7条件に追加する | Approve | Pending | `m0-freeze-overlay.json` / `m0-freeze-handoff.md` |
| D2: `PASS(core)` / `PASS(boundary)` / `PARTIAL` を契約語彙にする | Approve | Pending | `m0-freeze-contract-draft.md` |
| D3: `pendingRuleChoices` 方針 | Approve | Pending | `rule-choice-substrate.md` |
| D4: `PendingTrigger.stackPlacementBucket` 方針 | Approve | Pending | `priority-event-loop.md` |
| D5: triggered mana ability no-stack transaction 方針 | Approve | Pending | `mana-ability-substrate.md` |
| D6: scope partition 方針 | Approve | Pending | `scope-partition.md` |

Fable decision には `Approve` / `Reject` / `Hold` のいずれかを書く。

## Approve 条件

Fable が contract-update stage へ承認する場合、最低限以下を満たす。

1. 旧 `research/m-contract-gate/scorecard.*` は CR-grounding overlay 未接続のため、単独の凍結根拠にしない。
2. `research/cr-grounding/m0-freeze-overlay.json` の CRG-1〜8 を M0-FREEZE 判定対象にする。
3. `CRG-4` / `CRG-4.5` / `CRG-6` は `PARTIAL` として残し、S-* carry を明示する。
4. `CRG-7` は `PASS(core)` とし、CR 400.7 例外群と full effective-characteristics snapshot を `S-* carry` に残す。
5. `CRG-8` は `PASS(boundary)` とし、Heal / Power-up / Teamwork / Preparation の実行器を `scope-boundary` に残す。
6. Codex へ実装委譲する最初の対象は S-* ではなく、scorecard overlay wiring とする。

## Reject / Hold 条件

以下のいずれかなら M0-FREEZE へ進めず、対応ファイルへ差し戻す。

- CR 2026-06-19 固定または SHA-256 固定に疑義がある。
- `golden-cases.json` の CR-grounded cases が状態遷移検査として不足している。
- `pendingRuleChoices` が 903.9a と 704.5j の共通 substrate として不適切。
- 603.3b second bucket を `PendingTrigger.stackPlacementBucket` で表す方針に反対。
- 605.1b triggered mana ability を mana transaction 内 no-stack 処理にする方針に反対。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` が多すぎて、凍結後の状態設計手戻りリスクが高い。

## 承認後の順序

Fable が D1〜D6 を承認した場合の順序。

1. Fable が `m0-freeze-contract-draft.md` を材料に `docs/engine-spec.md` / `docs/acceptance.md` を更新する。
2. Fable が `review.m-contract-gate` の期待更新要否を判断する。
3. Codex が許可されたら、`scorecard-overlay-wiring-spec.md` に従って `m-contract-gate` に CR-grounding overlay を接続する。
4. `research/m-contract-gate/scorecard.{md,json}` を再生成する。
5. 機械チェック4点を実行する。
6. Fable が M0-FREEZE を承認する。
7. その後、`post-freeze-codex-brief.md` の Phase 1 以降へ進む。

## Codex の現在の作業境界

Fable decision が Pending の間、Codex は以下を行わない。

- `docs/` 契約ファイルの変更。
- `review.*` テストの変更。
- git 操作。
- `npm run m-contract-gate` による旧 scorecard 上書き。
- `704.5p` などの個別 S-* 実装。

許可される作業は、`research/cr-grounding/` の判定材料補強、矛盾検出、JSON/Markdown整合確認に限る。
