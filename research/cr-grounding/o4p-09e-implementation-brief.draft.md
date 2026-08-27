# O4P-09E implementer envelope

Milestone ID: `O4P-09E`

Base SHA: `b8f851794ce8051811093093adc8b22196f3d4c2`

Brief path: `research/cr-grounding/o4p-09e-implementation-brief.draft.md`

Goal: Implement the frozen secret-safe Look, Reveal, and Choose production
journey through versioned high-level intent, server binding, Core visibility
lifecycle/structured choice, persistence/replay, projection, and the sole
`GameScreen`.

Constraints:

- Implement exactly
  `research/cr-grounding/o4p-09e-visibility-decisions.contract.draft.md` and
  `research/cr-grounding/o4p-09e-acceptance-brief.draft.md`.
- You own required product source and ordinary non-`review.*` tests under
  `src/engine/core/rules/**`, narrow `src/engine/core/closure/**`, a new
  `src/online/visibilityDecisions/**`, narrow `src/online/protocol/**`,
  `src/online/projection/**`, `src/online/browser/**`,
  `src/online/application/**`, `src/online/cloudflare/**`,
  `src/online/publicApp/**`, and `src/components/online/**`. Keep edits minimal
  and preserve existing factories, journal, projection, and GameScreen root.
- The Judge owns all `research/`, `docs/`, ledger, loop state, configuration,
  generated files, and
  `src/test/architecture/review.o4p-09e-visibility-decisions.test.ts`. Preserve
  those bytes. You are not alone in the worktree; do not revert or overwrite
  another agent's edits and adapt around concurrent Judge files.
- Do not use git, edit any `review.*`, change dependencies/config/CR, add a
  parallel reducer/screen, apply Core in UI, expose secret material, or
  implement O4P-09F-J. Commit, push, deploy, publish, and ship are false.
- Keep D's `look`/`reveal`/`choose` binding rejection. E's wire is a separate
  exact high-level intent. The server derives actor, Core IDs/grant keys,
  duration authority, and delegated selector binding from the current root.
- Add `src/engine/core/rules/visibilityGrantOperationsV1.ts` with exported
  `openCoreVisibilityGrantV1` and `pruneCoreVisibilityGrantsV1`. Extend Core and
  projected duration schemas exactly as the contract maps them, and retain a
  Core-only top-library prefix digest for deterministic invalidation.
- Model wire duration as the exact discriminated union in the contract. The
  server must recheck supported subject ownership/control/zone, source-handle
  authority, and choice-session authority against the current root; scanning
  for a syntactically matching ID anywhere in a projection is insufficient.
- Preserve selected Core IDs in the private typed search-complete event/journal
  while projecting only the permitted result count or `revealFound` identity.
- Never include Room IDs, invite codes, capabilities, raw private errors,
  hidden orders, unrelated identities, raw grant/source keys, or decision
  authority records in reports, fixtures, DOM, console, or evidence.

Done when:

- Core and ordinary tests prove Look/Reveal grant creation, exact audiences,
  all four bounded durations, automatic invalidation, structured search choice,
  delegated selector authority, one reducer, deterministic events/replay, and
  unchanged-state rejection.
- Versioned validation, server binding, protocol/runtime/persistence,
  participant/table/observer projection, browser reconnect/outbox, and public
  application tests prove idempotency, stale/reuse/descriptor/authority
  failures, no optimistic reveal, and secret leak 0 for 2p and 4p.
- `PublicOnlineApp` renders `OnlineVisibilityDecisions` inside the existing
  `GameScreen`; ordinary DOM tests execute Japanese Look/Reveal/Choose flows,
  confirmation, projected-only candidates, busy/offline recovery, and the D
  disabled-to-E handoff without a second screen/reducer.
- Run focused affected tests, affected ESLint, build/typecheck, generated-doc
  byte verification, release preflight, and `git diff --check`. Report changed
  files, exact results, deferred scope, unresolved points, and expected
  unauthorized terminal gates without any secret value.
