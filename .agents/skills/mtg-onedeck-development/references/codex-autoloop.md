# Codex milestone loop

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

## 3. Freeze and verify

- Confirm scope and protected-file ownership.
- Run targeted judge evidence, then `npm run check` once on the frozen tree.
- For visible UI, verify 375×812, 812×375, 1440×900 and zero console errors in one stable browser session.
- Record the frozen tree fingerprint and check evidence in the audit brief.

## 4. Cold audit

- Spawn one different auditor with `fork_context: false`; pass only the audit brief path.
- The auditor follows `.claude/audit-standing.md`, edits nothing, and returns findings only.
- A full check from the exact frozen fingerprint is reusable. The auditor still runs the specified `review.*`, boundary, vacuity, spot-check, and adversarial evidence.

## 5. Correct

- Classify red findings with `docs/judge-protocol.md`.
- Reuse the implementer for implementation defects. Run invalidated targeted checks, then one final full check. If the frozen tree changes materially, re-audit the affected claim.

## 6. Ship

After BLOCKER/HIGH = 0, review evidence green, and full check green:

1. Update ledger/audit evidence and archive the completed packet.
2. Stage explicit files only; never use `git add -A`.
3. Commit conventionally and include the cold-auditor id.
4. Push, verify `HEAD == origin/main`, watch the matching-SHA CI run to success, and verify Pages HTTP 200.
5. Confirm a clean worktree.

## 7. Close

Reset loop-state to:

```text
milestone: complete
step: shipped
baseSha: <shipped SHA>
treeFingerprint: <clean fingerprint>
next: start a new task and run npm run codex:context
```

End the task. New feedback that is not an acceptance failure or critical regression is recorded in the matching ledger entry for a future milestone.
