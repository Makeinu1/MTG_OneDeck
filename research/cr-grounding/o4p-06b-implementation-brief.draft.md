# O4P-06B Luna Implementer Brief

Milestone: `O4P-06B`
Base SHA: `a0c33741f5a2bde35f5e9a621671f5908a6b1284`
Role: implementer
Model requested by user: Luna / xhigh
Contract: `research/cr-grounding/o4p-06b-playable-table-command-surface.contract.draft.md`
Acceptance: `research/cr-grounding/o4p-06b-acceptance-brief.draft.md`

## Goal

Implement the frozen ordinary tabletop Core command matrix and its ordinary
tests. Reuse the existing Core object registry/runtime, turn-priority component,
journal/replay, Protocol authority, receipt, projection, and O4P-06A bootstrap.

## Allowed writes

- `src/engine/core/closure/**`, excluding any filename containing `review.`;
- new `src/engine/core/tabletop/**`, excluding any filename containing
  `review.`;
- `src/engine/core/index.ts` and ordinary Core test files necessary for exports;
- `src/online/protocol/support.ts`, `src/online/protocol/command.ts`, and
  ordinary Protocol tests solely for configured-capability fragment rejection
  of lengths eight or greater before Core application;
- new ordinary tests in `src/online/headless/__tests__/**`, excluding any
  filename containing `review.`.

Do not modify any other Online production module or Protocol schema/validator.
The current generic `CoreCommandV1` envelope, participant-seat actor check,
receipt, revision, and projection must otherwise compose unchanged.

## Constraints

- Read the contract and acceptance brief first and treat them as frozen.
- No git operation, dependency/version/config change, Judge/governance/doc/ledger
  write, `review.*` write, fixture-corpus mutation, or network call.
- TypeScript strict; no `any`; reject hostile runtime values without throwing or
  reflecting them. Preserve deep freeze and canonical sorting.
- Do not add a top-level Core root field or version bump. Do not implement an
  arbitrary state patch, Oracle compiler, rules engine shortcut, or transport/UI.
- Reuse shipped factories and turn transition functions so their invariants
  remain active. If a frozen requirement truly cannot compose without a
  contract change, stop and report the exact conflict; do not broaden scope.
- Run affected checks only. Do not run `npm run check`, publish, commit, push,
  deploy, or edit loop state.

## Done when

All acceptance items are implemented with ordinary tests, targeted commands are
green, `npx tsc -b` and `git diff --check` pass, and the report includes changed
paths, results, defers, and unresolved points. The correct terminal status is
`implemented-not-audited`.
