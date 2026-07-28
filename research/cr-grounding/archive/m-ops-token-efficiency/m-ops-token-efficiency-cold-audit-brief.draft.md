# M-OPS-TOKEN-EFFICIENCY cold-audit brief

Read `AGENTS.md` and `.claude/audit-standing.md` first.

Audit target: the working tree based on
`5b0856229e6b4cfc799dd8920f4b7f2f9bf8ced1`.
Claimed status: `implemented-not-audited`.
Task: adversarially test the status and scope claims below. Do not confirm a
desired promotion; look for data loss, weakened governance, token double-count,
privacy leaks, fake-green evidence, and selection drift.

The authoritative frozen `baseSha` and `treeFingerprint` are in
`.claude/loop-state.md`. Full-check evidence for that exact fingerprint is in
`/private/tmp/mtg-onedeck-m-ops-check-evidence.md`.

## Claims to test

### M-OPS-MEASURE

- `npm run codex:usage -- --session <id> [--compare <id>]` reports only
  aggregate current-session usage and activity.
- Copied parent cumulative history is not summed again; later current turns are
  retained.
- User/developer prompts, reasoning, tool arguments/output, file bodies, and
  secrets cannot appear in output.
- Full-check counts represent shell command execution, not text search or prompt
  mentions. Dynamic command expressions are intentionally not guessed.
- Comparison deltas do not claim to measure quality.

### M-OPS-CONTEXT

- `npm run codex:context -- [--domain <id>]` validates ledger keys/counts/status
  consistency, emits the working-ledger SHA-256 and HEAD SHA, and stays under
  12 KiB on success.
- An explicit domain includes the complete recursive dependency closure.
- Automatic selection prioritizes unaudited work, otherwise uses the earliest
  eligible normal-Commander CR order, excludes design/maintenance, and returns
  a true same-rank tie instead of guessing. `lane=pruned` alone is not exclusion.
- Missing/corrupt/mismatched ledger state fails closed. Stale loop-state exits
  with code 5; integrity, ambiguity, and no-selection remain distinct.

### Governance/context diet

- `AGENTS.md` is at most 14 KiB and retains all three North Stars, protected
  lanes, four STOP classes, five shipped conditions, engine invariants,
  `npm run check`, acceptance rerun behavior, right-click alternatives, three
  UI viewports, and console-error zero.
- Long precedent/history and duplicated workflow moved to referenced Skill or
  archive without changing authority or safety meaning. Model names are not
  release gates.
- `docs/judge-protocol.md` section 0 normally consumes the verified projection
  and reads the full ledger only on integrity/tie/scope/history fallback.
- The exact external batching instruction is present only in the personal A/B
  protocol, not in shared `AGENTS.md`. The A/B itself is explicitly not claimed
  as executed in this milestone.
- Twenty-nine completed packets were moved byte-for-byte. Each has a shipped or
  superseded claim plus an independent-audit record; uncertain drafts remain in
  the active lane.
- No game, UI, engine, dependency version, or public API behavior changed.

## Evidence and procedure

1. Verify `.claude/loop-state.md` against `npm run codex:context -- --domain
   cr-609-one-shot-mass`; require health OK, current loop-state, two shipped
   dependencies, bounded output, and exit 0.
2. Read `/private/tmp/mtg-onedeck-m-ops-check-evidence.md`; reuse it only if its
   fingerprint exactly matches step 1. Do not duplicate the full check when it
   matches.
3. Run:
   `npx vitest run scripts/__tests__/codexUsage.test.mjs scripts/__tests__/codexContext.test.mjs scripts/__tests__/review.codex-ops.test.mjs`.
4. Run `npm run check:forbidden`. `AGENTS.md` and `review.codex-ops` are
   judge-authored protected changes and will be reported; verify that fact and
   inspect them adversarially rather than treating either the warning or this
   brief as an automatic pass.
5. Spot-check both CLIs using existing sessions/fixtures without printing
   transcript bodies. Test a normal session, a cold subagent, inherited-history
   fixture, compaction fixture, status mismatch, dependency cycle/missing
   dependency, selection tie, stale base SHA/tree, and a full-check text mention.
6. Compare `AGENTS.md` to `git show 5b085622:AGENTS.md` for semantic weakening.
   Inspect the thin compatibility wrappers and recovery hook for a dangling or
   contradictory authority path.
7. Verify archived draft contents against their old paths at the base SHA and
   challenge archive eligibility against ledger notes, audit records, and commit
   messages.
8. Inspect `git diff --check`, package dependency blocks, and changed-path scope.

## Constraints and output

- Do not edit files, stage, commit, push, or change the contract.
- Findings only. Do not repeat implementation rationale.
- Return a verdict for each of `M-OPS-MEASURE`, `M-OPS-CONTEXT`,
  `GOVERNANCE-DIET`, and `ARCHIVE-HYGIENE`: `SHIPPED-OK`, `BLOCKER`, `HIGH`,
  `MEDIUM`, or `LOW`.
- Each finding must cite exact file/line or deterministic reproduction and state
  whether it invalidates the claimed status. Finish with commands run and any
  limitations.
