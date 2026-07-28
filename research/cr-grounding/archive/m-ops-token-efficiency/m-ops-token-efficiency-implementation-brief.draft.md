# M-OPS-TOKEN-EFFICIENCY implementation brief

Milestone: `M-OPS-TOKEN-EFFICIENCY`
Base SHA: `5b0856229e6b4cfc799dd8920f4b7f2f9bf8ced1`
Role: implementer
Goal: add deterministic, read-only Codex usage and milestone-context diagnostics without changing game behavior.

## Scope

- Add `npm run codex:usage -- --session <id> [--compare <id>]`.
- Add `npm run codex:context -- [--domain <domainId>]`.
- Add ordinary tests for both CLIs. The judge-owned `review.codex-ops` test is immutable.
- No dependency additions. No network calls. No game/UI/engine changes.

## `codex:usage` contract

- Locate one rollout JSONL by exact session UUID below `$CODEX_HOME/sessions` (default `~/.codex/sessions`); support `--sessions-root` for sanitized tests.
- Export pure functions usable by Vitest, including `analyzeSessionRecords` and `compareUsageReports`.
- Report current-session-only input, cached input, uncached input, output, reasoning output, model cycles, compactions, exec cells, explicit parallel exec cells, nested tool calls, direct function calls, and `npm run check` invocations.
- Use the first `session_meta` as the current session. If copied parent metadata is present, exclude inherited records by finding the last current bootstrap marker and summing only subsequent `last_token_usage`; never sum final cumulative counters across fork files.
- Report current session id, model/effort, source kind, parent id, `inheritedContext`, lineage ids, and deduplication strategy/confidence.
- Never output user prompts, reasoning, tool arguments, tool output, file contents, or secrets.
- `--compare` reports percentage deltas and an efficiency signal only; coverage/quality remains an external human gate.

## `codex:context` contract

- Export pure functions usable by Vitest, including `buildContextProjection`, `parseLoopState`, and tree-fingerprint helpers.
- Validate required ledger keys and compare `domains`/`plannedSequence` counts with `git show HEAD:<ledger>`; count decreases are integrity errors.
- Merge `domains` and `plannedSequence` by domain id while keeping `domains.status` canonical. Any differing live status is an integrity error, not a silent winner.
- With `--domain`, return that domain and its recursive dependency closure.
- Without `--domain`, choose unaudited implementation first, otherwise the eligible pending normal-Commander domain with the smallest numeric `crOrder`. Dependencies must be shipped. A same-rank tie returns an ambiguity result instead of guessing.
- Exclude explicit design/maintenance sequence entries from automatic CR selection. Do not exclude an entry only because its lane is `pruned`.
- Output ledger SHA-256, HEAD SHA, counts/health, selection reason, selected domain, dependency closure, relevant canonical paths, and loop-state assessment. Keep successful output below 12 KiB.
- Missing/invalid ledger or status mismatch exits nonzero. An ambiguous automatic selection exits distinctly. The commands are read-only.
- Loop state is stale if required `baseSha`/`treeFingerprint` fields are absent, base SHA differs from HEAD, tree fingerprint differs, or its matching ledger domain is already shipped. `milestone: complete` with matching SHA/fingerprint is current.

## Acceptance

- `npx vitest run scripts/__tests__/codexUsage.test.mjs scripts/__tests__/codexContext.test.mjs scripts/__tests__/review.codex-ops.test.mjs`
- `npm run codex:usage -- --session 019f8f6f-694e-7fc2-8ca3-1c13d11cec1b` returns a cold-subagent report without prompt text.
- `npm run codex:context -- --domain cr-609-one-shot-mass` returns a healthy bounded projection after the judge repairs the known cr-606 status inconsistency.
- Completion report lists changed files, exact test results, deferrals, and uncertainty. Do not run git.
