# M0-FREEZE Docs Contract Update Ready Snippets

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が D1〜D6 を `Approve to contract-update stage` と判断した後、`docs/engine-spec.md` / `docs/acceptance.md` に反映する本文候補を、現行行アンカー別に置く。Codex は docs を直接変更しない。

## 使用条件

このファイルは **D1〜D6 承認後** に使う。

承認前にしてはいけないこと:

- `docs/` を Codex が編集する。
- `review.*` を Codex が編集する。
- `npm run m-contract-gate` で旧 scorecard を上書きする。
- S-* 実装へ進む。

## `docs/engine-spec.md` snippets

### E1. §34.0 overlay正本

Current anchor: line 1799, `M0 CR Grounding Gate の status 正本は ...` の直後。

Insert:

```md
M0-FREEZE の CR-grounding overlay 正本は `research/cr-grounding/m0-freeze-overlay.json` とする。`research/cr-grounding/README.md` と `docs/acceptance.md` の CRG 表は人間向け表示であり、scorecard 配線時の機械可読入力は overlay JSON を使う。Fable の承認/差戻し記録は `research/cr-grounding/m0-freeze-decision-record.md`、証拠監査は `research/cr-grounding/m0-freeze-evidence-audit.md`、CR refs / golden / executable / overlay / boundary の追跡表は `research/cr-grounding/m0-freeze-traceability-matrix.md` を参照する。
```

### E2. §34.7.1 現況ブロック

Current anchor: line 1891, `> **次 = M-CR-RECONCILE**...` の直後。

Insert:

```md
> **現況(2026-06-28・M0-FREEZE review)= CONTRACT-UPDATE READY / M0-FREEZE NOT COMPLETE**。
> `research/cr-grounding/` の CR-grounding handoff は contract-update stage へ進める材料が揃った。ただし M0-FREEZE 完了には、docs契約反映、scorecard overlay配線、scorecard再生成、Fable最終承認が必要である。したがって S-* 実装にはまだ進まない。
```

### E3. §34.7.2 scorecard成果物拡張

Current anchor: line 1896, `**成果物**: research/m-contract-gate/scorecard.{md,json}` の段落内または直後。

Insert after the existing scorecard artifact paragraph:

```md
M-CR-RECONCILE 以後の scorecard は、legacy seven-condition reports に加えて `research/cr-grounding/m0-freeze-overlay.json` を入力にする。overlay wiring 後の `scorecard.json` は `legacyFrozen`、`crGroundingOverlay`、`crGroundingOverlayApproved`、`crGroundingOverlayProblems` を含む。Markdown は `CR-grounding Overlay` と `R-FREEZE Designs` を表示し、旧 `Superseded` 注記を overlay included 注記へ置き換える。
```

### E4. §34.7.2 overlay判定ロジック

Current anchor: line 1929, `**ゲート判定ロジック(決定的)**:` の既存3項目の後。

Insert:

```md

M-CR-RECONCILE 以後の追加判定:

4. 総合判定は legacy seven conditions と CR-grounding overlay の合成とする。
   - 入力: legacy seven-condition reports + `research/cr-grounding/m0-freeze-overlay.json`。
   - `required-pass`: `PASS` 必須。
   - `core-pass-only`: `PASS(core)` を許可。ただし `remainingBoundary` 必須。
   - `boundary-pass-only`: `PASS(boundary)` を許可。ただし `remainingBoundary` 必須。
   - `partial-allowed-*`: `PARTIAL` を許可。ただし `remainingBoundary` 必須。
   - `FAIL` は不可。
5. `frozen = legacyFrozen && crGroundingOverlayApproved` とする。
6. `PARTIAL` / `PASS(core)` / `PASS(boundary)` は plain `PASS` に変換しない。Markdown scorecard でも status と remaining boundary を表示する。
7. `frozen` は「未実装ゼロ」を意味しない。S-* carry / scope-boundary を明示したうえで次段階へ進める、という M0-FREEZE 契約上の判定である。
```

## `docs/acceptance.md` snippets

### A1. M0-FREEZE CR-grounding acceptance rule

Current anchor: line 518, CRG-1〜8 表の直後。

Insert:

```md

M0-FREEZE は旧 M-CONTRACT scorecard に加えて CR-grounding overlay を確認する。

| Gate | Required treatment |
|---|---|
| CRG-1 CR 2026-06-19 fixed | required PASS |
| CRG-2 CR-grounded golden cases defined | required PASS |
| CRG-3 Commander tax CR 903.8 | required PASS |
| CRG-4 Mana abilities CR 605 | PARTIAL allowed only if CR 605.1b/605.4a is explicit S-* carry |
| CRG-4.5 Commander zone choice CR 903.9a/b | PARTIAL allowed only if generic rule choice is explicit S-CHOICE carry |
| CRG-5 Token death CR 111.7/704.5d | required PASS |
| CRG-6 Trigger/SBA/priority CR 603/704/117 | PARTIAL allowed only if 603.3b second bucket and full SBA are explicit S-* carry |
| CRG-7 Zone movement/LKI CR 400.7/603.10a | PASS(core); CR 400.7 exceptions and full effective-characteristics snapshot remain S-* carry |
| CRG-8 2026-06-19 new vocabulary | PASS(boundary); Heal / Power-up / Teamwork / Preparation executors remain scope-boundary |

Acceptance rule: 未実装機構を `PASS` に混ぜない。`PARTIAL` / `PASS(core)` / `PASS(boundary)` は残境界を伴ってのみ許可する。
```

### A2. Acceptance evidence links

Current anchor: line 518, A1 の直後。

Insert after A1:

```md

判定材料:

- `research/cr-grounding/m0-freeze-overlay.json`
- `research/cr-grounding/m0-freeze-review-packet.md`
- `research/cr-grounding/m0-freeze-review-sheet.md`
- `research/cr-grounding/m0-freeze-decision-record.md`
- `research/cr-grounding/m0-freeze-evidence-audit.md`
- `research/cr-grounding/m0-freeze-traceability-matrix.md`
- `research/cr-grounding/docs-contract-update-map.md`
```

## Post-apply checks

Fable が docs へ反映した後、Codex が検証だけを担当するなら以下。

```sh
rg -n "m0-freeze-overlay|crGroundingOverlay|legacyFrozen|PASS\\(core\\)|PASS\\(boundary\\)|partial-allowed" docs/engine-spec.md docs/acceptance.md
node research/cr-grounding/verify-q1-docs-contract.mjs
npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot
```

この段階ではまだ `npm run m-contract-gate` を実行しない。scorecard overlay wiring 実装後に実行する。

## Non-goals

- S-* 実装に進まない。
- docs反映だけで M0-FREEZE 完了と扱わない。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` を plain `PASS` に潰さない。
