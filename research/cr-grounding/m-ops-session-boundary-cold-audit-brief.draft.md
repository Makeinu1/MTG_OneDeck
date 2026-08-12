# M-OPS-SESSION-BOUNDARY cold-audit brief

Milestone: `M-OPS-SESSION-BOUNDARY`
Base SHA: `4829bbaa49ebdd6ccae5062ff152bcb9c15c7f99`
Profile: `BROAD` (selection policy, governance, checks, and task lifecycle)
Candidate fingerprint: `cd25729ed889ab6f209b1dee09b24cc874a34fd2975daf227d001bcbbaf0ab4d`

The fingerprint is `computeTreeFingerprint` over exactly these paths; this
audit brief is excluded:

- `.agents/skills/mtg-onedeck-development/SKILL.md`
- `.agents/skills/mtg-onedeck-development/references/codex-autoloop.md`
- `.agents/skills/mtg-onedeck-development/references/cycle.md`
- `.agents/skills/mtg-onedeck-development/references/document-governance.md`
- `.agents/skills/mtg-onedeck-development/references/token-economy.md`
- `AGENTS.md`
- `docs/judge-protocol.md`
- `scripts/codex-context.mjs`
- `scripts/__tests__/codexContext.test.mjs`
- `scripts/__tests__/review.check-gates.test.mjs`
- `scripts/__tests__/review.codex-ops.test.mjs`
- `research/cr-grounding/m-ops-session-boundary-implementation-brief.draft.md`
- `research/cr-grounding/m-ops-session-boundary-active-program-proposal.draft.md`
- `research/cr-grounding/cr-backbone-ledger.json`

## Audit role

Read this brief, the listed candidate paths, `AGENTS.md`, and
`.claude/audit-standing.md`. Compare the candidate with base SHA. Do not edit
files. Return findings only, ordered BLOCKER, HIGH, MEDIUM, LOW, with exact
paths/lines and a final severity count.

## Required claims

1. The optional `goalPolicy.activeProgram` shape is exact, complete,
   deterministic, and fail-closed for malformed, duplicated, missing,
   non-linear, blocked-status, blocked-dependency, and cross-collection
   dependency-set mismatch cases. Neither collection may silently win merge
   precedence. Active-program entries require both collections, while a shipped
   external prerequisite may remain in either collection and is unknown only
   when absent from both.
2. Global `implemented-not-audited` priority and explicit `--domain` behavior
   remain intact. A complete active program falls back to normal CR selection.
3. Projection and exit codes cannot turn an invalid or blocked active program
   green, and successful output remains bounded.
4. New sessions are directed to `document-governance.md`; three compatibility
   files contain pointers only, with no competing operative rules.
5. The operative workflow enforces a clean per-milestone worktree, one task per
   milestone, one implementer plus one auditor, no future-milestone research,
   one bounded audit wait, a first-compaction exit boundary, targeted checks
   before audit, and one final full check (maximum two only after a real release
   failure).
6. The workflow preserves role ownership, fingerprint, independent audit,
   `AUDIT-OK-PENDING-FULL-CHECK`, STOP, CR authority, and release gates; token
   savings do not weaken quality.
7. The live ledger activates exactly `O4P-01G` through `O4P-02E` as bounded
   program `O4P-02`, based on the existing O4P-02A user-ruling note. It does not
   append O4P-03A or later, change any entry, or infer authority from thread
   text/`nextGate` alone. Default projection selects O4P-02B; explicit domain
   remains authoritative.
8. No O4P manifest, archive record, product code, dependency, timeout, status,
   release evidence, or git history is changed by this candidate.

## Existing evidence

- `npx vitest run scripts/__tests__/codexContext.test.mjs` — 19/19 PASS.
- `npx vitest run scripts/__tests__/codexContext.test.mjs scripts/__tests__/review.codex-ops.test.mjs scripts/__tests__/review.check-gates.test.mjs` — 38/38 PASS after adding both
  dependency-set mismatch directions and both single-collection external
  prerequisite directions.
- targeted ESLint — PASS.
- `git diff --check` — PASS.
- `npm run check:docs` — PASS.
- Live-ledger `npm run codex:context` reports `health.ok: true` and selects
  `O4P-02B` with reason `active-program-order`; explicit
  `--domain cr-114-emblems` remains authoritative. Its current nonzero exit is
  only the expected pre-freeze loop-state fingerprint mismatch.
- O4P-02A is already shipped at the declared base with terminal CI/Pages
  evidence. `npm run check:docs` must pass on this candidate.

Do not run the release full check. Flag vacuous or self-authored acceptance,
status fallthrough, stale pointer content, hidden live-ledger activation, or a
task-lifetime escape as HIGH or above.

## Re-audit note

Earlier isolated audits found and closed completed/malformed dependency-graph
fallthrough and a stale `codex-autoloop.md` authority reference. The latest
isolated audit found one remaining HIGH: `domains` and `plannedSequence`
dependency lists were not reconciled before merge, so one collection could
hide a pending dependency declared by the other. The current candidate must
include adversarial ordinary and judge tests for both mismatch directions.
Audit all prior claims and the complete candidate; do not rely on an earlier
verdict.
