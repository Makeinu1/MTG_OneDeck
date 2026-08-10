# Codex milestone loop compatibility pointer

The sole operative workflow is [`document-governance.md`](document-governance.md). The material below is preserved for historical compatibility; do not add new rules here.

One invocation handles exactly one milestone. Project continuity lives in the ledger and a validated loop-state record, not in an endless task transcript.

## 0. Bootstrap

1. Run `npm run codex:context -- [--domain <id>]`.
2. Stop on integrity error, stale loop-state, true selection tie, scope change, North-Star/contract change, or the four `AGENTS.md` STOP classes.
3. Record `milestone`, `step`, `baseSha`, current `treeFingerprint`, role, next action, and intermediate decision in `.claude/loop-state.md`.

## 1. Contract

- Freeze public behavior, failure boundary, evidence, and golden cases before implementation.
- The judge owns `docs/`, ledger, and final `review.*`; an implementer may draft only in `research/cr-grounding/*.draft`.
- Write a narrow implementation brief with milestone-specific facts only.

## 2. Implement

- Spawn one implementer with `fork_context: false` and pass only the brief path.
- The implementer batches independent reads, edits source/ordinary tests, and runs targeted checks.
- Return corrections to the same agent, at most twice. Do not start the next milestone in parallel and do not create generic explorer agents.

## 3. Candidate freeze and pre-audit evidence

- Confirm scope and protected-file ownership.
- Run targeted judge evidence; do not run the release full check yet.
- For visible UI, verify 375×812, 812×375, 1440×900 and zero console errors in one stable browser session.
- Record the candidate fingerprint and targeted evidence in the audit brief.

## 4. Cold audit

- Spawn one different auditor with `fork_context: false`; pass only the audit brief path.
- The auditor follows `.claude/audit-standing.md`, edits nothing, and returns findings only.
- The auditor runs the specified target-domain `review.*`, boundary, vacuity, spot-check, and adversarial evidence without running the full check.
- With BLOCKER/HIGH = 0, record `AUDIT-OK-PENDING-FULL-CHECK`; this is not ship approval.

### Audit timing and timeout contract

Select one timing profile from the audit scope before spawning the auditor. The
profile is a planning budget, not a quality shortcut.

| Profile | Use when | Expected result | Hard wait |
| --- | --- | ---: | ---: |
| `NARROW` | one focused claim, at most five changed paths, and at most 20 specified tests | 5 minutes | 15 minutes (`900000` ms) |
| `STANDARD` | one normal CR/engine/UI milestone or one project test lane | 15 minutes | 30 minutes (`1800000` ms) |
| `BROAD` | governance, architecture, coverage, multiple test lanes, or more than 10 changed paths | 25 minutes | 45 minutes (`2700000` ms) |

The audit brief must state the selected profile. If an older brief does not
state one, use `STANDARD`; never infer `NARROW` from a small test count alone.
The orchestrator should make one `wait_agent` call using the profile's hard
wait. Do not replace it with repeated 30/60/120-second waits or raw transcript
polling. `wait_agent` returning `timed_out` is not an audit verdict and does
not authorize a second auditor while the first auditor is still running.

If the hard wait expires without a final findings result, keep the candidate
frozen and retain `implemented-not-audited`. Do not infer Green from targeted
tests, partial progress, or an absent error. After the auditor reaches a
terminal status, report `AUDIT-TIMEOUT` with the completed evidence and the
unverified claims; do not run the release full check. Any retry is a new,
sequential audit turn with the same frozen candidate and an explicit timing
profile, never an overlapping audit.

## 5. Correct

- Classify red findings with `docs/judge-protocol.md`.
- Reuse the implementer for implementation defects. Run invalidated targeted checks and re-audit every affected claim before release freeze.

## 6. Release freeze and full check

- Freeze the release tree after audit findings close and record its fingerprint.
- Require the release fingerprint to equal the latest audited fingerprint.
- Run `npm run check` once. If it fails, correct only the defect, rerun invalidated targeted evidence and any affected semantic audit, then run one final full check. Never exceed two full-check invocations.

## 7. Ship

After BLOCKER/HIGH = 0, review evidence green, and full check green:

1. Update ledger/audit evidence and archive the completed packet.
2. Stage explicit files only; never use `git add -A`.
3. Commit conventionally and include the cold-auditor id.
4. Push, verify `HEAD == origin/main`, watch the matching-SHA CI run to success, and verify Pages HTTP 200.
5. Confirm a clean worktree.

## 8. Close

Reset loop-state to:

```text
milestone: complete
step: shipped
baseSha: <shipped SHA>
treeFingerprint: <clean fingerprint>
next: start a new task and run npm run codex:context
```

End the task. New feedback that is not an acceptance failure or critical regression is recorded in the matching ledger entry for a future milestone.
