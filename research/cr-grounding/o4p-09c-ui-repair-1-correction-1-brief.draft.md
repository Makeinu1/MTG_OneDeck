# O4P-09C-UI repair candidate 1 correction 1 envelope

Milestone ID: `O4P-09C-UI`

Base SHA: `b87fc0b47b8a7073ee3037f6bd55e4a46e21ada8`

Brief path: `research/cr-grounding/o4p-09c-ui-repair-1-correction-1-brief.draft.md`

Goal: Make the Online Pregame presentation satisfy the unchanged historical
Solo/Online boundary without changing Pregame behavior or modifying existing
contract verification tests.

Constraints:

- Preserve the O4P-09C-UI contract, acceptance, security, persistence, and
  already verified visual behavior.
- Own only `src/components/online/**`, `src/components/game/**`, and
  `src/dev/visualFixtures/**` ordinary product/test paths required by this
  correction. Do not edit any `review.*`, `research/**`, ledger, loop-state,
  `docs/**`, or `scripts/checks/**`; do not use git.
- `src/components/online/OnlinePregameLayer.tsx` must not import any
  `src/online/**` module. Give it a presentation-only structural view and
  action callbacks; `PublicOnlineApp` owns the exact adapter to
  `controller.submitPregame`. Do not duplicate a reducer, persistence,
  validation, random-plan logic, or optimistic state.
- Move the two new component tests under `src/components/online/__tests__/` so
  historical production-only scans do not inspect test transport mocks.
- You are not alone in the worktree. Preserve concurrent Judge changes and all
  secret-free evidence.

Done when:

- Unmodified `soloOnlineBoundary.test.ts`,
  `review.o4p-01h-core-boundary.test.ts`, and
  `review.o4p-04a-personal-workbench-boundary.test.ts` pass.
- Pregame component/PublicOnlineApp tests, mode-neutral Core boundary, focused
  2/4-player journey, affected lint, build, docs, and `git diff --check` pass.
- Return a compact report; do not run `npm run check`.
