# O4P-09C implementer envelope

Milestone ID: `O4P-09C`

Base SHA: `5f62a8f6730fd7a758d8b284ba818cf19f09c347`

Brief path: `research/cr-grounding/o4p-09c-implementation-brief.draft.md`

Goal: Implement the frozen headless server-authoritative Pregame lifecycle,
audience-safe projection/replay, atomic Core setup operations, and the exact
two-player first-turn draw-step skip.

Constraints:

- Implement exactly
  `research/cr-grounding/o4p-09c-pregame-lifecycle.contract.draft.md` and
  `research/cr-grounding/o4p-09c-acceptance-brief.draft.md`.
- Own only `src/engine/core/pregame/index.ts`, `typesV1.ts`, `operationsV1.ts`,
  ordinary `__tests__/pregameOperationsV1.test.ts`, and
  `src/online/pregame/index.ts`, `types.ts`, `validation.ts`, `operations.ts`,
  `projection.ts`, ordinary `__tests__/pregameLifecycleV1.test.ts`, plus these
  existing product files for the frozen export/draw-skip seam:
  `src/engine/core/index.ts`, `src/engine/core/turn/index.ts`,
  `src/engine/core/turn/turnAdvanceV1.ts`,
  `src/engine/core/tabletop/commandV1.ts`,
  `src/engine/core/closure/commandV1.ts`,
  `src/engine/core/closure/applyCommandV1.ts`,
  `src/engine/core/closure/rootValidationV1.ts`, and ordinary
  `src/engine/core/closure/__tests__/repairWave1.test.ts` only for the frozen
  rotated-player-set relation, plus
  `src/online/projection/validation.ts` and ordinary
  `src/online/projection/__tests__/projectionV1.test.ts` only for the frozen
  rotated-turn-order compatibility correction.
- The Judge owns all dirty research files, every `review.*` test, architecture
  allowlists, ledger/docs, loop state, and git. Preserve them exactly. You are
  not alone in the worktree; do not revert, overwrite, or reformat another
  agent's edits.
- Do not edit git state, governance, existing genesis/Room/Protocol/Projection
  constructor or visibility semantics/Application, Browser/Cloudflare/public
  client, GameScreen/controller/store/UI,
  dependencies, configuration/version vectors, CR bytes, generated files, or
  O4P-09D-J product scope.
- No second Core reducer, random/clock/network call, client-selected plan,
  optimistic mutation, raw patch/whole-state command, free-text manual action,
  or Oracle-specific pregame automation.
- Never expose Room authority, capabilities, random/library plans, pending
  bottom identities, request digests, journals/Core roots, other players'
  hidden identities, or raw private errors through projections/receipts/logs.

Done when:

- The exact plan/state/envelope/command/receipt/projection validators, creator,
  handler, projector, and deterministic journal replay are exported from
  `src/online/pregame/index.ts` and implement every frozen phase/relation.
- Pure Core Pregame operations atomically set order, deal opening hands, begin
  simultaneous mulligans, and commit bottom batches with valid reincarnation,
  counters, frozen roots, input preservation, and no command-count advance.
- The `first-turn-draw-skip` transition is strictly validated, accepted only in
  the frozen two-player turn-one window, and four-player ordinary draw remains
  unchanged.
- Judge review, ordinary Pregame/Core tests, focused existing Core/Protocol/
  Projection suites, affected ESLint, TypeScript build, and `git diff --check`
  pass.
- Report changed files, commands/results, deferred scope, and unresolved points.
