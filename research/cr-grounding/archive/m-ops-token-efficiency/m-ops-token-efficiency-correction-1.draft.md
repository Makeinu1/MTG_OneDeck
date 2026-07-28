# M-OPS-TOKEN-EFFICIENCY correction 1

Role: same implementer as the original brief.
Base brief: `research/cr-grounding/m-ops-token-efficiency-implementation-brief.draft.md`.
The judge-owned `scripts/__tests__/review.codex-ops.test.mjs` is immutable.

Fix these two bounded defects only:

1. In a JSONL containing copied parent history, preserve every current-session
   turn after the initial current bootstrap. A later `task_started` or user
   message must not reset the isolation boundary and discard earlier current
   usage.
2. Export a pure `contextExitCode(projection)` helper and make the context CLI
   exit nonzero for a stale loop state. Keep existing distinct integrity,
   ambiguity, and no-selection exits; use exit code 5 for stale state.

Run only:

`npx vitest run scripts/__tests__/codexUsage.test.mjs scripts/__tests__/codexContext.test.mjs scripts/__tests__/review.codex-ops.test.mjs`

Do not run the full check, edit protected files, or use git. Report changed
files, exact targeted result, deferrals, and uncertainty.
