# Q1 Fable One-shot Brief

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が最小トークンで Q1(Fable decision and docs contract update)を閉じるための一枚ブリーフ。Codex は docs / review.* / git を触らないため、この手順は Fable 側で実行する。

## One-line decision

Codex recommendation:

> D1〜D6 を **Approve to contract-update stage**。ただし **M0-FREEZE 完了ではない**。S-* 実装にもまだ進まない。

## Why this is the next action

現在の blocker は実装不足ではなく、定規が正式契約と scorecard 判定器へ接続されていないこと。

現物 verifier:

```sh
node research/cr-grounding/verify-q1-docs-contract.mjs
```

は現時点で失敗する。これは正しい。`docs/engine-spec.md` / `docs/acceptance.md` に以下がまだ入っていないため。

- `m0-freeze-overlay.json` の機械可読正本化。
- `legacyFrozen && crGroundingOverlayApproved` の合成判定。
- `required-pass` / `core-pass-only` / `boundary-pass-only` / `partial-allowed-*` の判定語彙。
- acceptance required treatment 表。
- evidence links。

## Fable action checklist

1. `m0-freeze-decision-record.md` の D1〜D6 を確認する。
2. 問題なければ全て `Approve to contract-update stage` と判断する。
3. 承認する場合だけ `q1-decision-record-approve.patch` を適用する。
4. `docs-contract-update-ready-snippets.md` の E1〜E4 / A1〜A2 を docs へ反映する。
5. `verify-q1-docs-contract.mjs` と `verify-q1-decision-record.mjs` を実行する。
6. `review.m-contract-gate` を実行する。
7. すべて通れば、Codex に Q2 scorecard overlay wiring を委譲する。

## Files to read in order

最短ならこの順。

1. `m0-freeze-q1-gap-audit.md`
2. `docs-contract-update-ready-snippets.md`
3. `m0-freeze-decision-record.md`
4. `m0-freeze-execution-queue.md`

詳細確認が必要なら追加で:

- `m0-freeze-traceability-matrix.md`
- `m0-freeze-evidence-audit.md`
- `q2-scorecard-overlay-test-plan.md`

差分形式で確認したい場合:

- `q1-docs-contract.patch`

コマンドだけを最短で実行したい場合:

- `q1-fable-command-card.md`

patch として適用する場合:

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
```

## Exact post-apply commands

Fable が docs を更新した後:

```sh
node research/cr-grounding/verify-q1-docs-contract.mjs
node research/cr-grounding/verify-q1-decision-record.mjs
npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot
```

この段階ではまだ実行しない:

```sh
npm run m-contract-gate
```

理由: Q2 scorecard overlay wiring 前に実行すると、旧 scorecard を overlay 未接続のまま再生成する。

## Pass criteria for Q1

Q1 は以下を満たしたら完了。

- D1〜D6 が Approve / Reject / Hold として判断済み。
- Approve の場合、`m0-freeze-decision-record.md` に `Approve to contract-update stage` が記録されている。
- Approve の場合、docs に overlay 正本、合成判定、判定語彙、acceptance required treatment、evidence links が入っている。
- `node research/cr-grounding/verify-q1-docs-contract.mjs` が通る。
- `npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot` が通る。
- S-* 実装には入っていない。
- `npm run m-contract-gate` はまだ実行していない。

## If Reject / Hold

Reject / Hold の場合、Q2へ進まない。差戻し先は `m0-freeze-decision-record.md` の表に従う。

主な差戻し:

| Problem | Destination |
|---|---|
| overlay を旧7条件へ足す方針に反対 | `m0-freeze-overlay.json` / `m0-freeze-handoff.md` |
| `PARTIAL` / `PASS(core)` / `PASS(boundary)` 語彙に反対 | `m0-freeze-contract-draft.md` |
| rule choice substrate に反対 | `rule-choice-substrate.md` |
| 603.3b bucket 方針に反対 | `priority-event-loop.md` |
| 605.1b no-stack 方針に反対 | `mana-ability-substrate.md` |
| scope partition に反対 | `scope-partition.md` |

## Handoff to Codex after Q1

Q1 が通ったら Codex の次作業は Q2。

Use:

- `scorecard-overlay-wiring-spec.md`
- `scorecard-overlay-code-map.md`
- `q2-scorecard-overlay-test-plan.md`
- `m0-freeze-overlay.json`

Codex must not:

- edit `review.*`
- implement S-* features
- run `npm run m-contract-gate` before overlay wiring is implemented
- perform git operations
