# M0-FREEZE Evidence Audit

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: `m0-freeze-decision-record.md` の D1〜D6 を判断する前に、CRG-1〜8 の証拠が現物ファイル・ローカル固定CR・代表テストから辿れるかを監査する。

## 結論

**contract-update stage へ進める証拠はある。S-* 実装へ進む証拠はまだない。**

監査結果:

- CR 2026-06-19 のローカル固定と、重要条文の存在は確認できる。
- `rule/Magic_The_Gathering_Comprehensive_Rules.txt` の SHA-256 は metadata 記載値と一致した。
- CR-grounded golden cases は JSON として読める。
- 代表的な実行可能ケースは targeted vitest で通過した。
- `CRG-4` / `CRG-4.5` / `CRG-6` は意図通り `PARTIAL` であり、`PASS` にしてはいけない。
- `CRG-7` は `PASS(core)`、`CRG-8` は `PASS(boundary)` として扱うのが妥当。
- Fable が承認する場合でも、承認対象は `contract-update stage` までであり、M0-FREEZE 完了や S-* 実装着手ではない。

## 実行した確認

### JSON parse

対象:

- `research/cr-grounding/m0-freeze-overlay.json`
- `research/cr-grounding/golden-cases.json`
- `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`

結果: OK。

### ローカル固定CRの条文確認

`rule/Magic_The_Gathering_Comprehensive_Rules.txt` から以下の条文を確認した。

- 111.7
- 400.7 / 400.7a〜m
- 603.3b / 603.10a
- 605.1a / 605.1b / 605.3b / 605.4a
- 704.3 / 704.5d / 704.5e / 704.5f / 704.5i / 704.5q / 704.6d
- 903.8 / 903.9a / 903.9b
- 701.69 / 702.193 / 702.194 / 722

SHA-256:

- `rule/Magic_The_Gathering_Comprehensive_Rules.txt`: `e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b`
- `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json` の記載値と一致。

### Targeted test run

実行:

```sh
npx vitest run src/engine/__tests__/m431.test.ts src/store/__tests__/review.m431.test.ts src/engine/__tests__/review.g4-activate.test.ts src/store/__tests__/crGrounding.test.ts src/store/__tests__/crGroundingGoldenCases.test.ts src/engine/__tests__/priority.test.ts --reporter=dot
```

結果:

- Test Files: 6 passed
- Tests: 44 passed

注意: これは代表CR-groundingテストの targeted run であり、機械チェック4点の代替ではない。

## CRG evidence verdict

| Gate | Status claim | Evidence verdict | 根拠 | 残る判断 |
|---|---|---|---|---|
| CRG-1 CR 2026-06-19 fixed | PASS | Strong | CR metadata JSON parse OK。固定CR本文に対象条文あり。CR本文SHA-256がmetadata記載値と一致。 | なし。 |
| CRG-2 CR-grounded golden cases defined | PASS | Strong for definition | `golden-cases.json` parse OK。重要ケースと executable subset が定義済み。 | 既存 golden replay への統合は未完。これは event envelope 対応後。 |
| CRG-3 Commander tax CR 903.8 | PASS | Strong | `m431` / `review.m431` targeted run 通過。CR 903.8 本文確認済み。 | command 以外から唱える将来ケースは別拡張。 |
| CRG-4 Mana abilities CR 605 | PARTIAL | Correctly partial | 605.1a/605.3b の起動型マナ能力 no-stack は `review.g4-activate` targeted run 通過。605.1b/605.4a は `mana-ability-substrate.md` の設計草稿。 | 605.1b triggered mana ability は未実装。`PASS` 禁止。 |
| CRG-4.5 Commander zone choice CR 903.9a/b | PARTIAL | Correctly partial | `crGrounding.test.ts` targeted run 通過。903.9a bridge と 903.9b replacement の代表挙動は確認済み。 | generic `pendingRuleChoices` / deferred choice UI / `stabilizeBeforePriority()` 本体統合は未実装。 |
| CRG-5 Token death CR 111.7/704.5d | PASS | Strong | `cr-token-dies-before-ceases` targeted run 通過。CR 111.7/704.5d 本文確認済み。 | full SBA suite は後続。 |
| CRG-6 Trigger/SBA/priority CR 603/704/117 | PARTIAL | Correctly partial | pending trigger、explicit-order placement、APNAP v1、deterministic SBA subset は targeted run 通過。CR 603.3b/704.3 本文確認済み。 | 603.3b second bucket と full SBA suite は未実装。`PASS` 禁止。 |
| CRG-7 Zone movement/LKI CR 400.7/603.10a | PASS(core) | Strong for core | `cr-zone-change-new-object-lki` targeted run 通過。CR 400.7/603.10a 本文確認済み。 | 400.7例外群と full effective-characteristics snapshot は S-* carry。 |
| CRG-8 2026-06-19 new vocabulary | PASS(boundary) | Strong for boundary only | 固定CR本文に 701.69 Heal / 702.193 Power-up / 702.194 Teamwork / 722 Preparation あり。`scope-partition.md` で境界化済み。 | 実行器は scope-boundary。実装済み扱い禁止。 |

## D1〜D6 audit

| Decision | Codex audit verdict | 理由 |
|---|---|---|
| D1: CR-grounding overlay を旧7条件に追加する | Approve to contract-update | 旧7条件だけでは CR状態遷移 gold / R-FREEZE 設計判断を含まない。overlay 追加が必要。 |
| D2: `PASS(core)` / `PASS(boundary)` / `PARTIAL` を契約語彙にする | Approve to contract-update | CRG-4/4.5/6/7/8 を通常PASSに潰すと silent divergence が起きる。 |
| D3: `pendingRuleChoices` 方針 | Approve to contract-update | 903.9a と 704.5j はどちらもSBA中にプレイヤー選択を要求するため、専用 `pendingSbaChoices` を最終形にしない方針は妥当。 |
| D4: `PendingTrigger.stackPlacementBucket` 方針 | Approve to contract-update | CR 603.3b の two-part process を APNAP v1 の上に追加するには bucket が必要。 |
| D5: triggered mana ability no-stack transaction 方針 | Approve to contract-update | CR 605.1b/605.4a は通常誘発と同じ pending/stack 経路に混ぜると誤る。 |
| D6: scope partition 方針 | Approve to contract-update | CR 400.7例外群、full effective snapshot、full SBA、新語彙実行器を `PASS` に混ぜない分類が必要。 |

## Found issues / contradictions

今回の監査範囲では、contract-update stage へ進める判断を阻害する矛盾は見つからなかった。

ただし、以下は未完了として残す。

1. `m-contract-gate` はまだ `m0-freeze-overlay.json` を読まない。
2. `research/m-contract-gate/scorecard.*` は CR-grounding overlay なしの旧判定であり、単独の凍結根拠にしない。
3. docs契約反映は未完了。
4. `review.m-contract-gate` の期待更新要否は Fable判断待ち。
5. 機械チェック4点は今回未実行。targeted CR-grounding tests のみ実行。

## 次の手順

1. Fable / ユーザーが `m0-freeze-decision-record.md` の D1〜D6 を `Approve` / `Reject` / `Hold` で記録する。
2. Approve の場合、Fable が `m0-freeze-contract-draft.md` を材料に docs契約へ反映する。
3. Fable が `review.m-contract-gate` の扱いを決める。
4. Codex が許可されたら `scorecard-overlay-wiring-spec.md` に従い、`m-contract-gate` に CR-grounding overlay を接続する。
5. scorecard 再生成と機械チェック4点を行う。
