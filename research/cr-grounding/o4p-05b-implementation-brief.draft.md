# O4P-05B implementer brief

Milestone: `O4P-05B`

Base SHA: `76da2a67743d4e54f9ef6008ca86373963c965fe`

Read and implement exactly:

- `research/cr-grounding/o4p-05b-four-player-release-scenario.contract.draft.md`
- `research/cr-grounding/o4p-05b-acceptance-brief.draft.md`

## Allowed writes

- one Judge-owned review under `src/online/headless/__tests__/`;
- ordinary tests under that namespace whose basename does not contain
  `review.`.

## Forbidden writes

- git operations;
- `review.*` tests;
- `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/`, ledger/history,
  `research/cr-grounding/*.draft*`, archive findings;
- `package.json`, lockfiles, scripts/checks, workflows, version constants,
  existing Core/Room/Protocol/Projection/Workbench/TableDisplay/
  DisplayPairing/GuidedActions/Cloudflare files, React/CSS, Store, and app entry;
- dependencies, network calls, environment reads, storage, clocks, randomness,
  and hidden fallback behavior.

## Implementation rules

- Reuse shipped constructors, validators, Headless gate, projection handlers,
  Core closure/replay, and UI view-model builders; do not duplicate reducers.
- TypeScript strict, no `any`; use `unknown` plus guards.
- Exact-field validation, deterministic complete redacted issues, fresh deep
  frozen canonical outputs, no caller mutation/sort/trim/dedup/merge.
- Fixture capabilities are synthetic local test data and must never appear in
  witness, issues, error strings, or logs.
- Do not weaken, skip, or modify an existing assertion.
- Run only namespace-targeted Vitest and scoped ESLint/type verification.

Report changed files, exact target results, DEFER, and unresolved points.
