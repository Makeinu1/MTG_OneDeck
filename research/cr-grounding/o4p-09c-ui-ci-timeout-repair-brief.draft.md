# O4P-09C-UI CI timeout release-repair envelope

Milestone ID: `O4P-09C-UI`

Base SHA: `7a8932629b949977341c9d2174f5edc61aed9141`

Brief path: `research/cr-grounding/o4p-09c-ui-ci-timeout-repair-brief.draft.md`

Goal: Make the exact O4P-09C-UI Local/Remote parity and gameplay transport
tests tolerate the measured GitHub Actions runtime without changing product
behavior, test inputs, or assertions.

Constraints:

- Own only `src/online/cloudflare/__tests__/variableRuntimeV4.test.ts`.
- Preserve every existing assertion, the exact two/four-player matrix, the
  Durable Object route, persisted reconstruction, and final Protocol-root
  comparisons.
- Apply only explicit per-test timeout headroom to the two cases that exceeded
  their current limits in Actions run `32937078805`: four-player parity took
  32.03 seconds against 30 seconds, and gameplay transport took 7.43 seconds
  against the default 5 seconds.
- Do not edit product code, `review.*`, `research/**`, the ledger, loop-state,
  `docs/**`, scripts, configuration, dependencies, or git state.
- You are not alone in the worktree. Preserve the Judge-owned brief and all
  existing candidate changes.

Done when:

- The two/four-player parity cases retain their exact assertions with a
  60-second per-case timeout.
- The gameplay transport case retains its exact assertions with a 30-second
  timeout.
- The focused test file, affected ESLint, and `git diff --check` pass.
- Return changed files, results, deferred scope, and unresolved points; do not
  run `npm run check`.
