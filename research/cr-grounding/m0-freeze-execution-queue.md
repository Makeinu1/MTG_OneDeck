# M0-FREEZE Execution Queue

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: 「CRを検査器にする」ため、M0-FREEZE を判断資料から実行工程へ落とす。ここでは、次に誰が何を触り、何を証拠に完了扱いするかを固定する。

## ゴール

M0-FREEZE のゴールは、S-* 実装を増やすことではない。

ゴールは次の状態にすること。

> CR 2026-06-19 grounded overlay が docs 契約と `m-contract-gate` scorecard の両方に接続され、未実装境界を `PASS` に混ぜずに freeze 判定できる。

この状態になるまでは、個別SBA、triggered mana ability、603.3b second bucket、400.7例外群、新語彙実行器へ進まない。

## 現在地

| Item | Status | Evidence |
|---|---|---|
| CR 2026-06-19 fixed | Done | `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`; `m0-freeze-evidence-audit.md` |
| CRG-1〜8 overlay | Done as research artifact | `m0-freeze-overlay.json` |
| Golden cases | Done as definition | `golden-cases.json` |
| Traceability | Done | `m0-freeze-traceability-matrix.md` |
| Docs反映文案 | Ready | `docs-contract-update-ready-snippets.md` |
| Scorecard wiring spec | Ready | `scorecard-overlay-wiring-spec.md`; `scorecard-overlay-code-map.md` |
| Fable D1〜D6 decision | Pending | `m0-freeze-decision-record.md` |
| docs契約反映 | Pending | Fable only |
| `m-contract-gate` overlay wiring | Pending | Codex only after docs approval |
| overlay込み scorecard 再生成 | Pending | after wiring |
| M0-FREEZE final approval | Pending | Fable final audit |

## Queue

### Q0. Codex precheck

Owner: Codex

Allowed files:

- `research/cr-grounding/*`

Do not touch:

- `docs/*`
- `review.*`
- `scripts/m-contract-gate.ts`
- `scripts/lib/mContractGate.ts`
- `research/m-contract-gate/scorecard.{md,json}`
- git

Commands:

```sh
node research/cr-grounding/verify-m0-freeze-preflight.mjs
node -e "for (const f of ['research/cr-grounding/m0-freeze-overlay.json','research/cr-grounding/golden-cases.json']) { JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('OK '+f); }"
rg -n "TODO|TBD|FIXME|Pending Fable decision|M0-FREEZE NOT COMPLETE|CONTRACT-UPDATE READY" research/cr-grounding
```

Exit criteria:

- overlay/golden JSON parse OK。
- 残る明示的 blocker が `Pending Fable decision` であること。
- Codex が docs / review / scripts / scorecard を変更していないこと。

Current result: pass。次は Q1。

### Q1. Fable decision and docs contract update

Owner: Fable

Inputs:

- `m0-freeze-review-packet.md`
- `q1-fable-one-shot-brief.md`
- `m0-freeze-evidence-audit.md`
- `m0-freeze-traceability-matrix.md`
- `m0-freeze-decision-record.md`
- `q1-decision-record-approve.patch`
- `verify-q1-decision-record.mjs`
- `verify-q1-decision-patch-effect.mjs`
- `docs-contract-update-map.md`
- `docs-contract-update-ready-snippets.md`
- `q1-docs-contract.patch`
- `m0-freeze-q1-gap-audit.md`

Actions:

1. D1〜D6 を `Approve to contract-update stage` / `Reject` / `Hold` で判断する。
2. Approve の場合、`docs-contract-update-ready-snippets.md` の E1〜E4 / A1〜A2 を `docs/engine-spec.md` / `docs/acceptance.md` へ反映する。
3. `m0-freeze-decision-record.md` は必要なら Fable が decision を記録する。Codex は Fable decision を捏造しない。

Post-apply checks:

```sh
node research/cr-grounding/verify-q1-patch-ready.mjs
node research/cr-grounding/verify-q1-patch-effect.mjs
rg -n "m0-freeze-overlay|crGroundingOverlay|legacyFrozen|PASS\\(core\\)|PASS\\(boundary\\)|partial-allowed" docs/engine-spec.md docs/acceptance.md
node research/cr-grounding/verify-q1-docs-contract.mjs
npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot
```

Exit criteria:

- docs が overlay JSON を M0-FREEZE の機械可読正本として参照している。
- docs が `frozen = legacyFrozen && crGroundingOverlayApproved` 方針を持つ。
- docs が `PARTIAL` / `PASS(core)` / `PASS(boundary)` を plain `PASS` に潰さない。
- docs反映だけで M0-FREEZE 完了扱いしていない。
- S-* 実装に進んでいない。

### Q2. Scorecard overlay wiring

Owner: Codex

Precondition:

- Q1 が Approve され、docs 契約に反映済み。
- Fable が `review.m-contract-gate` の期待更新要否を判断済み。

Inputs:

- `scorecard-overlay-wiring-spec.md`
- `scorecard-overlay-code-map.md`
- `q2-scorecard-overlay-test-plan.md`
- `q2-scorecard-overlay.patch`
- `verify-q2-patch-ready.mjs`
- `verify-q2-patch-effect.mjs`
- `verify-q2-scorecard-output.mjs`
- `m0-freeze-overlay.json`

Target files:

- `scripts/lib/mContractGate.ts`
- `scripts/m-contract-gate.ts`
- Codex-owned normal tests, if needed

Do not touch:

- `review.*`
- S-* implementation files unrelated to scorecard gate
- git

Required behavior:

- `m0-freeze-overlay.json` を読む。
- legacy判定を `legacyFrozen` として保存する。
- CR-grounding overlay 判定を `crGroundingOverlayApproved` / `crGroundingOverlayProblems` として保存する。
- 総合判定を `frozen = legacyFrozen && crGroundingOverlayApproved` にする。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` を `PASS` に変換しない。
- `remainingBoundary` の無い partial/core/boundary pass を承認しない。

Exit criteria:

- overlay 判定純関数の通常テストが通る。
- `review.m-contract-gate` が通る。
- `npm run m-contract-gate` を実行しても overlay を落とさない状態になっている。
- `q2-scorecard-overlay-test-plan.md` の T1〜T9 / C1〜C3 を満たす。

### Q3. Scorecard regeneration

Owner: Codex after Q2

Commands:

```sh
npm run m-contract-gate
```

Exit criteria:

- `research/m-contract-gate/scorecard.json` に `legacyFrozen` / `crGroundingOverlay` / `crGroundingOverlayApproved` / `crGroundingOverlayProblems` がある。
- `research/m-contract-gate/scorecard.md` に `CR-grounding Overlay` と `R-FREEZE Designs` が表示される。
- 旧 `Superseded` 注記が overlay included 注記へ置換される。

### Q4. M0-FREEZE audit

Owner: Fable / Codex verification split

Codex verification commands:

```sh
npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

Fable checks:

- scorecard の overlay 判定が docs と一致する。
- CRG-4 / CRG-4.5 / CRG-6 が `PARTIAL` のまま境界明示されている。
- CRG-7 が `PASS(core)` のまま境界明示されている。
- CRG-8 が `PASS(boundary)` のまま境界明示されている。
- M0-FREEZE を「未実装ゼロ」と誤読していない。

Exit criteria:

- docs契約、scorecard、overlay JSON、Markdown出力、テストが同じ判定をしている。
- Fable が M0-FREEZE final approval を出す。

### Q5. Post-freeze implementation sequence

Owner: Codex after Fable final approval

Sequence:

1. S-CHOICE / S-TURN: `pendingRuleChoices`
2. S-EVENTS / PRIORITY: 603.3b second bucket
3. S-EVENTS / MANA: 605.1b triggered mana ability no-stack
4. S-SBA incremental: `sba-inventory.md` の S-* carry を価値順に追加
5. S-ZONES / S-LAYERS: 400.7 exceptions / effective snapshot
6. C-GRAMMAR: Oracle compiler expansion

Invariant:

各実装は、CR refs + state invariant + executable golden/test を同時に追加する。

## Definition of done for "定規を作れた"

次をすべて満たしたときだけ、「定規を作れた」と言う。

1. `m0-freeze-overlay.json` が docs契約で M0-FREEZE 判定入力として参照されている。
2. `m-contract-gate` が overlay JSON を実際に読んでいる。
3. scorecard JSON/Markdown が overlay status と remaining boundary を表示している。
4. `frozen` が旧7条件だけで true にならない。
5. `PARTIAL` / `PASS(core)` / `PASS(boundary)` が plain `PASS` に潰れていない。
6. targeted review test と機械チェック4点が通っている。
7. Fable が M0-FREEZE final approval を記録している。

## Stop conditions

以下のどれかが起きたら S-* 実装へ進まず止める。

- D1〜D6 のいずれかが Reject / Hold。
- docs と overlay wiring の判定語彙がずれる。
- `m-contract-gate` が overlay を読まずに `frozen: true` を出す。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` が Markdown または JSON で消える。
- `remainingBoundary` が空のまま承認される。
- 605.1b、603.3b second bucket、400.7例外群、新語彙実行器が、未実装のまま `PASS` に混ざる。
