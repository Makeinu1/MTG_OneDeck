# O4P-09C-UI repair candidate 1 implementer envelope

Milestone ID: `O4P-09C-UI`

Base SHA: `b87fc0b47b8a7073ee3037f6bd55e4a46e21ada8`

Brief path: `research/cr-grounding/o4p-09c-ui-repair-1-implementation-brief.draft.md`

Goal: Repair the production Pregame candidate so the sole `GameScreen` remains
mode-neutral, ordinary fixtures do not bypass the Core boundary, and the
Pregame styling uses the established theme tokens without changing the frozen
O4P-09C-UI behavior.

Constraints:

- Preserve the exact contract and acceptance in
  `research/cr-grounding/o4p-09c-ui-production-pregame.contract.draft.md` and
  `research/cr-grounding/o4p-09c-ui-acceptance-brief.draft.md`.
- You own product source and ordinary non-`review.*` tests under
  `src/components/game/**`, `src/components/online/**`,
  `src/online/publicApp/**`, and `src/dev/visualFixtures/**` only.
- Move the Online-specific Pregame layer and its ordinary test out of
  `src/components/game/**`. Keep `GameScreen` mode-neutral by accepting only a
  generic presentation slot/port; it must not import `src/online/**`, duplicate
  Pregame types, or apply Pregame/Core commands. Compose the Online layer from
  `PublicOnlineApp` inside the sole `GameScreen` root.
- Remove all direct `src/engine/core/**` imports from the affected ordinary UI,
  public-app tests, and visual fixture. Use structurally valid fixed fixture
  values or public Online types; do not add a new Core allowance.
- Replace the new Pregame raw CSS color fallbacks with existing theme-token
  references. Preserve the verified layout, 44px targets, focus visibility,
  and 2/4-player behavior.
- The Judge owns `research/**`, `.claude/loop-state.md`, the ledger,
  `scripts/checks/**`, and every `review.*` file. Do not edit them. Do not use
  git. You are not alone in the worktree; preserve and accommodate concurrent
  Judge edits.
- Do not change dependencies, config, CR, public Pregame semantics, persistence,
  security, O4P-09D-J behavior, or expose any Room ID, invite, capability,
  private card identity, raw state, digest, or raw error.

Done when:

- `GameScreen` has no Online import and still contains the Online Pregame layer
  as its rendered pregame presentation; Solo behavior remains unchanged.
- The four previous direct Core-import violations are gone, the Pregame CSS has
  no new raw-color offense, and affected ordinary 2/4-player, keyboard,
  recovery, and public-controller tests pass.
- Run only focused ordinary tests, affected lint/type/build checks as useful,
  and `git diff --check`; do not run `npm run check` or edit Judge-owned guards.
- Return a compact report of changed files, commands/results, deferred
  Judge-owned failures, and unresolved points without secret values.
