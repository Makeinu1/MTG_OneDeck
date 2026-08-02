# CR701 cross-player actions completion packet

- Milestone: `cr-701-cross-player-actions`
- Base SHA: `0eff51307c96816f6d67cac1ed715f39690ed31f`
- Judge: Codex
- Implementer: `/root/cr701_implementer`
- Cold auditor: `/root/cr701_cold_auditor`

## Delivered slice

- Exact fixed-count `each player` / `each opponent` / `each other player`
  discard, mill, and sacrifice grammar with roster-independent compiler output.
- Runtime APNAP expansion into concrete player prompts, including wrapped
  four-player order and controller exclusion for each-opponent effects.
- Player-aware discard, mill, and sacrifice execution after all choices are
  collected, with available-portion behavior for insufficient resources.
- Correct `discard`, `mill`, and `sacrifice` semantic reasons and one shared
  simultaneous group per action; mill does not count as an empty-library draw.
- Concrete affected-player labels and legal-candidate ownership in blocking UI,
  while preserving self actions and interaction undo/redo.
- Whole-effect fail-closed behavior for unresolved binding, variable/random or
  qualified choices, conditional companions, and unsupported composites.

## Verification evidence

- Judge targeted replay: core 4 files / 23 tests and DOM 10 files / 92 tests
  passed after the final surgical repair.
- Targeted ESLint, `git diff --check`, decision snapshot, and context health are
  green.
- Browser evidence covered 375×812, 812×375, and 1440×900 with no horizontal
  overflow and console error 0.
- Independent final audit: BLOCKER/HIGH/MEDIUM/LOW 0 and
  `AUDIT-OK-PENDING-FULL-CHECK`; detailed findings are stored beside this file.
- Snapshot relative to the base: 0 additions, 0 removals, 2 `m→a`, 45 `m→g`,
  and 104 safe fail-closed `m→m` changes.
- Full-check invocation 1 passed lint and exposed one stale ordinary sacrifice
  expectation. The contract-aligned test repair passed the affected core replay
  (5 files / 27 tests) and targeted ESLint; invocation 2 remains the final gate.

## Deferred boundary

Target/that/defending/chosen-player binding, random or variable counts,
qualified sacrifice selection, and composites whose every action cannot be
represented remain whole-effect manual. No dependency, cache schema, or new
`GameState` field was introduced.

The release judge records the final full-check, commit, push, CI, Pages,
served-asset, and clean-worktree evidence in the shipping follow-up.
