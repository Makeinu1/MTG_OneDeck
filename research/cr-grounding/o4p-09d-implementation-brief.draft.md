# O4P-09D implementer envelope

Milestone ID: `O4P-09D`

Base SHA: `9adc0851cd520aa09f1c50cfa266d6dbc610d9a5`

Authority: local writes only. Commit, push, deploy, and ship are false for this
cycle; do not manufacture a generated-API verification checkpoint.

Brief path: `research/cr-grounding/o4p-09d-implementation-brief.draft.md`

Goal: Implement the frozen safe public/shared tabletop primitive algebra and
the Structured Manual / Freeform Manual production player journey through the
existing server-authoritative application, Core, projection, persistence, and
sole `GameScreen`.

Constraints:

- Implement exactly
  `research/cr-grounding/o4p-09d-tabletop-primitives.contract.draft.md` and
  `research/cr-grounding/o4p-09d-acceptance-brief.draft.md`.
- You own required product source and ordinary non-`review.*` tests under
  `src/engine/core/tabletop/**`, narrow `src/engine/core/closure/**`,
  `src/online/application/**`, `src/online/tabletopManual/**`, narrow
  `src/online/protocol/**`, `src/online/projection/**`,
  `src/online/cloudflare/**`, `src/online/publicApp/**`,
  `src/components/online/**`, and narrow `src/components/game/**`. Keep changes
  minimal and cohesive; use existing Core factories and public projections.
- The Judge owns all `research/`, `docs/`, ledger, loop state, configuration,
  generated files, and
  `src/test/architecture/review.o4p-09d-tabletop-primitives.test.ts`. Preserve
  those bytes. You are not alone in the worktree; do not revert or overwrite
  another agent's edits and adapt around concurrent Judge files.
- Do not use git, edit any `review.*`, change dependencies/config/CR, add a
  parallel reducer or player screen, apply Core in UI, trust client entropy or
  order, expose secret material, or implement O4P-09E-J.
- Public intent carries no actor override, seed, entropy, permutation,
  before/after order, hidden index, capability, or arbitrary state patch.
  Server-generated randomness is injectable in tests and exact retries consume
  it once.
- `Look`, `Reveal`, and `Choose` remain visibly disabled and fail closed.
  Reports, fixtures, logs, and evidence must contain no Room ID, invite,
  capability, raw private error, hidden order, or secret card identity.

Done when:

- Every frozen primitive family and both modes pass ordinary Core/application
  tests through accepted journal, replay, projection, and final state.
- Server-authoritative shuffle/reorder, retry idempotency, reconstruction,
  seat/object authority, hidden-zone rejection, descriptor hardening, note
  safety, manual stack top-only resolve, and redaction are executable tests.
- `PublicOnlineApp` renders the post-Pregame player journey inside `GameScreen`
  with a typed `OnlineTabletopManual` panel and no second reducer/screen;
  ordinary DOM tests cover mode selection, action submission, disabled future
  vocabulary, busy/error gating, and accessible buttons.
- Run focused affected tests, affected ESLint, build/typecheck, generated-doc
  byte verification, release preflight, and `git diff --check`. Report the
  expected manifest reanchor/full-check terminal gate separately from product
  failures, plus changed files, exact results, deferred scope, unresolved
  points, and no secret values.
