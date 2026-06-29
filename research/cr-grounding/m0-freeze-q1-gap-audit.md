# M0-FREEZE Q1 Gap Audit

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Q1(Fable decision and docs contract update) が現時点で完了しているかを、現物 docs / scorecard から確認する。Codex は docs を直接変更しないため、このファイルは Fable が Q1 を閉じるための差分監査である。

## 結論

Q1 は **未完了**。

現行 docs は CRG-1〜8 の人間向け表と `PASS` / `PARTIAL` / `PASS(core)` / `PASS(boundary)` の区別を一部持っている。しかし、M0-FREEZE の判定器として必要な以下がまだ足りない。

- `research/cr-grounding/m0-freeze-overlay.json` を機械可読正本として契約化していない。
- `legacyFrozen` / `crGroundingOverlayApproved` の合成判定を契約化していない。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` の overlay 判定規則を docs に明文化していない。
- `docs/acceptance.md` に M0-FREEZE required treatment 表と evidence links がない。
- `research/m-contract-gate/scorecard.json` は legacy fields のみで、overlay fields を持たない。

したがって、次の作業は S-* 実装ではなく、Fable による Q1 docs contract update である。

## Evidence commands

2026-06-28 時点で確認したコマンド。

```sh
rg -n "m0-freeze-overlay|crGroundingOverlay|legacyFrozen|PASS\\(core\\)|PASS\\(boundary\\)|partial-allowed|CONTRACT-UPDATE READY|M0-FREEZE NOT COMPLETE|frozen = legacyFrozen" docs/engine-spec.md docs/acceptance.md research/m-contract-gate/scorecard.json research/m-contract-gate/scorecard.md
node -e "const fs=require('fs'); const p='research/m-contract-gate/scorecard.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); for (const k of ['legacyFrozen','crGroundingOverlay','crGroundingOverlayApproved','crGroundingOverlayProblems']) console.log(k+': '+Object.prototype.hasOwnProperty.call(j,k)); console.log('frozen: '+j.frozen); console.log('keys: '+Object.keys(j).join(', '));"
```

Observed:

- `docs/engine-spec.md` has CRG status text at current line 1799.
- `docs/acceptance.md` has CRG-7 `PASS(core)` and CRG-8 `PASS(boundary)` at current lines 517-518.
- No hit for `m0-freeze-overlay`, `crGroundingOverlay`, `legacyFrozen`, `partial-allowed`, `CONTRACT-UPDATE READY`, `M0-FREEZE NOT COMPLETE`, or `frozen = legacyFrozen` in the target docs/scorecard files.
- `research/m-contract-gate/scorecard.json` keys are `generatedAt`, `supersededBy`, `conditions`, `frozen`, `headCoverage`, `unverifiable`.
- `scorecard.json` does not have `legacyFrozen`, `crGroundingOverlay`, `crGroundingOverlayApproved`, or `crGroundingOverlayProblems`.

## Q1 criteria audit

| Q1 criterion | Current state | Verdict | Required Fable action |
|---|---|---|---|
| D1〜D6 decision recorded | `m0-freeze-decision-record.md` still says `Pending Fable decision` | Missing | Mark each D1〜D6 as Approve / Reject / Hold |
| overlay JSON is machine-readable source of truth | docs currently point to `research/cr-grounding/README.md` and `docs/acceptance.md` CRG table as status source | Missing | Apply E1 from `docs-contract-update-ready-snippets.md` |
| contract-update ready / M0-FREEZE not complete distinction | old `M-CR-RECONCILE` block remains; no `CONTRACT-UPDATE READY` block | Missing | Apply E2 |
| scorecard output fields include overlay | docs do not mention `legacyFrozen` / `crGroundingOverlay*` | Missing | Apply E3 |
| deterministic overlay verdict rules | docs have only legacy 3-step gate logic | Missing | Apply E4 |
| acceptance required treatment table | CRG table exists, but no required-treatment table | Missing | Apply A1 |
| acceptance evidence links | no Q1 evidence link list after CRG table | Missing | Apply A2 |
| S-* remains blocked | docs still say S-EVENTS not allowed before M-FREEZE; research queue also blocks S-* | Satisfied | Preserve |

## Minimal Fable patch source

Use:

- `docs-contract-update-ready-snippets.md`
- `q1-docs-contract.patch` if Fable wants a unified diff draft.

Apply:

- E1 after current `docs/engine-spec.md` line 1799 CRG status source sentence.
- E2 after current `docs/engine-spec.md` `> **次 = M-CR-RECONCILE**...` block.
- E3 after current `docs/engine-spec.md` scorecard artifact paragraph.
- E4 after current `docs/engine-spec.md` deterministic gate logic item 3.
- A1 after current `docs/acceptance.md` CRG-1〜8 table.
- A2 after A1.

Post-apply verification:

```sh
rg -n "m0-freeze-overlay|crGroundingOverlay|legacyFrozen|PASS\\(core\\)|PASS\\(boundary\\)|partial-allowed|CONTRACT-UPDATE READY|M0-FREEZE NOT COMPLETE|frozen = legacyFrozen" docs/engine-spec.md docs/acceptance.md
node research/cr-grounding/verify-q1-docs-contract.mjs
npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot
```

Do not run `npm run m-contract-gate` until Q2 scorecard overlay wiring is implemented.

## Stop rule

If Fable does not approve D1〜D6, Q2 must not start. The next action is then to update only the rejected/held research artifact named in `m0-freeze-decision-record.md`.
