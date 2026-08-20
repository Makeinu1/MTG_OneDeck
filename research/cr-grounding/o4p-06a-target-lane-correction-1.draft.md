# O4P-06A Judge Target-Lane Correction 1

Date: 2026-08-20
Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`

## Finding

The frozen acceptance brief named `--project core` for tests under
`src/online/bootstrap/**`. The repository's existing `vite.config.ts` limits
that project to `src/engine/**`; the exact command therefore exited with
`No test files found`. The additive milestone boundary prohibits changing the
existing Vitest configuration.

## Judge ruling

Correct the targeted command to `--project dom`. This is the repository's
existing collection lane for non-engine tests and is also the lane used by the
release `npm run check`. The correction changes no contract meaning, runtime,
test content, dependency, version, or production behavior. A passing direct
test command is not accepted as a substitute: both the ordinary files and the
Judge-owned `review.o4p-06a-four-real-deck-bootstrap.test.ts` must be collected
by `--project dom` before candidate freeze.
