# M0-FREEZE Review Sheet

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が短時間で M0-FREEZE の承認/差戻しを判断するための判定票。

判定を記録する場合は `m0-freeze-decision-record.md` を使う。このファイルは判断材料、decision record は承認・差戻しの記録に分ける。

## 推奨判定

**Approve to contract-update stage, not to S-* implementation yet.**

意味:

- CR-grounding の研究・設計材料は、docs契約へ反映する段階へ進めてよい。
- ただし、M0-FREEZE 完了や S-* 実装着手を承認する段階ではない。
- 先に `docs/engine-spec.md` / `docs/acceptance.md` / scorecard 方針を更新し、CR-grounding overlay を正式ゲートへ接続する。

## Fable が決めること

| Decision | 推奨 | 根拠 | Rejectする条件 |
|---|---|---|---|
| D1: CR-grounding overlay を旧7条件に追加するか | Yes | 旧 scorecard は CR状態遷移 gold を含まない | 旧7条件だけでFROZEN扱いするなら reject |
| D2: `PASS(core)` / `PASS(boundary)` / `PARTIAL` を契約語彙にするか | Yes | 400.7 core、新語彙 boundary、CR605/903.9a/603 partial を緑に混ぜないため | 全てを単純 PASS/FAIL へ潰すなら reject |
| D3: R-FREEZE-1 `pendingRuleChoices` 方針 | Yes | 903.9a と 704.5j の choice substrate を共有できる | commander 専用 `pendingSbaChoices` を最終形にするなら reject |
| D4: R-FREEZE-2 `PendingTrigger.stackPlacementBucket` 方針 | Yes | CR 603.3b second bucket を現 APNAP v1 に拡張できる | 603.3b second bucket を scope-boundary にするなら reject |
| D5: R-FREEZE-3 triggered mana ability no-stack transaction | Yes | CR 605.1b/605.4a を通常誘発と分けられる | 605.1b を通常 pending trigger に混ぜるなら reject |
| D6: R-FREEZE-4 scope partition | Yes | 未実装を S-* carry / scope-boundary / PASS(core) に分離済み | full SBA / 400.7例外 / 新語彙実行器を pass 扱いするなら reject |

## 承認条件

Fable が承認するなら、最低限以下を満たす。

1. `m0-freeze-overlay.json` の `freezeDecision.codexRecommendation` を尊重する。
   - `do-not-freeze-without-fable-review` は妥当。

2. `m0-freeze-handoff.md` の「未完了」をそのまま残す。
   - docs契約反映
   - scorecard overlay配線
   - scorecard再生成
   - Fable承認

3. `CRG-4` / `CRG-4.5` / `CRG-6` は `PARTIAL` のまま扱う。
   - 605.1b
   - 903.9a generic choice
   - 603.3b second bucket
   - remaining full SBA suite

4. `CRG-7` は `PASS(core)`。
   - 400.7例外群と full effective snapshot は `S-* carry`。

5. `CRG-8` は `PASS(boundary)`。
   - Heal / Power-up / Teamwork / Preparation 実行器は scope-boundary。

## 差戻し条件

以下のいずれかなら、M0-FREEZE へ進めず差戻し。

- CR 2026-06-19 固定に疑義がある。
- `golden-cases.json` の case と executable tests の対応に不足がある。
- R-FREEZE-1〜4 の設計方向が Fable 判断と合わない。
- scorecard overlay を旧7条件と別管理する方針が危険だと判断する。
- `PARTIAL` を多く残しすぎて、S-*実装後に状態設計の手戻りが大きいと判断する。

## Fable 承認後の最初の委譲

Fable が承認した場合、Codexへの次の委譲は S-* 実装ではなく、まず以下。

1. `docs/engine-spec.md` / `docs/acceptance.md` に CR-grounding overlay を契約反映する。
   - 文言ドラフト: `m0-freeze-contract-draft.md`。
2. `review.m-contract-gate` の期待更新が必要か Fable が判断する。
3. Codex が許可されたら、`m-contract-gate` に `m0-freeze-overlay.json` を読む overlay 条件を追加する。
   - 配線仕様: `scorecard-overlay-wiring-spec.md`。
4. scorecard を再生成し、旧 `superseded` 注記を新判定へ置き換える。
5. その後に S-* 実装順を確定する。

## 一文結論

M0-R は「定規として使える草稿」まで来ている。次は S-* 実装ではなく、Fable がこの定規を契約へ昇格させるかを判定する段階である。
