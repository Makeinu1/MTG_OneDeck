# Q1 Fable Command Card

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19

## Purpose

Fable が Q1 を閉じるための最短実行カード。

Q1 の目的は M0-FREEZE 完了ではない。目的は、D1〜D6 を contract-update stage として判断し、CR-grounding overlay を docs 契約へ接続することである。

## Current expected result before Q1

```sh
node research/cr-grounding/verify-m0-freeze-preflight.mjs
```

Expected:

```text
M0-FREEZE preflight passed.
Q1 docs contract: not applied
Q1 decision record: not recorded
Q2 scorecard overlay wiring: not applied
Next action: Fable: record D1-D6 decision, apply Q1 docs contract patch, then run Q1 verifiers and review.m-contract-gate.
```

If this differs, stop and inspect the changed file first.

## Approve path

Use this only if Fable accepts D1〜D6 as **Approve to contract-update stage**.

```sh
node research/cr-grounding/verify-m0-freeze-preflight.mjs
git apply --check research/cr-grounding/q1-decision-record-approve.patch
node research/cr-grounding/verify-q1-decision-patch-effect.mjs
git apply research/cr-grounding/q1-decision-record-approve.patch
node research/cr-grounding/verify-q1-decision-record.mjs
node research/cr-grounding/verify-q1-patch-ready.mjs
node research/cr-grounding/verify-q1-patch-effect.mjs
git apply --check research/cr-grounding/q1-docs-contract.patch
git apply research/cr-grounding/q1-docs-contract.patch
node research/cr-grounding/verify-q1-docs-contract.mjs
npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot
node research/cr-grounding/verify-m0-freeze-preflight.mjs
```

Expected final state after Q1:

```text
Q1 docs contract: applied
Q1 decision record: recorded
Q2 scorecard overlay wiring: not applied
Next action: Codex: apply Q2 scorecard overlay patch, then run overlay tests and regenerate scorecard.
```

## Do not run in Q1

```sh
npm run m-contract-gate
```

Reason: Q2 overlay wiring is not applied yet. Running this during Q1 can regenerate the legacy scorecard without CR-grounding overlay and make the state look more complete than it is.

## If Q1 is rejected or held

Do not apply the approve patches.

Record the reason in `m0-freeze-decision-record.md` and send the issue back to the artifact named in the decision table:

- D1 problem: `m0-freeze-overlay.json` / `m0-freeze-handoff.md`
- D2 problem: `m0-freeze-contract-draft.md`
- D3 problem: `rule-choice-substrate.md`
- D4 problem: `priority-event-loop.md`
- D5 problem: `mana-ability-substrate.md`
- D6 problem: `scope-partition.md`

## Handoff to Codex after Q1

After the expected final state is reached, Codex can move to Q2 using:

```sh
node research/cr-grounding/verify-q2-patch-ready.mjs
node research/cr-grounding/verify-q2-patch-effect.mjs
```

Then apply `q2-scorecard-overlay.patch` and run the Q2 tests. Codex still must not edit `review.*`, run git commit operations, or start S-* implementation.
