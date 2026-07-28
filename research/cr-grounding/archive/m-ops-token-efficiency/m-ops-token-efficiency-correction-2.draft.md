# M-OPS-TOKEN-EFFICIENCY correction 2

Role: same implementer as the original brief.
Base brief: `research/cr-grounding/m-ops-token-efficiency-implementation-brief.draft.md`.
The judge-owned `scripts/__tests__/review.codex-ops.test.mjs` is immutable.

Fix one bounded defect only: `fullCheckInvocations` must count actual shell
command invocations of `npm run check`, not mentions embedded in an `rg` search,
prompt, message, or arbitrary tool argument. Restrict direct function-call
inspection to shell execution calls and classify nested `exec_command` command
properties rather than scanning an entire Code Mode cell for the phrase.
Continue to exclude `npm run check:forbidden`.

Run only:

`npx vitest run scripts/__tests__/codexUsage.test.mjs scripts/__tests__/codexContext.test.mjs scripts/__tests__/review.codex-ops.test.mjs`

Do not run the full check, edit protected files, or use git. Report changed
files, exact targeted result, deferrals, and uncertainty.
