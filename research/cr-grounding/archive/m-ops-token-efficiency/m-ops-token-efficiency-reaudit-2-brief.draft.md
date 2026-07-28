# M-OPS-TOKEN-EFFICIENCY second re-audit brief

Read the original audit and first re-audit briefs. Re-audit only the remaining
M-OPS-MEASURE MEDIUM from Kuhn `019fa948-c842-7a43-8396-9896f3469423`.
Do not edit files.

Remaining defect: a conditional candidate survived its own empty output and was
incorrectly consumed by a later unrelated command that replayed saved
machine-check output.

Bounded correction:

- Candidates are now owned by their outer tool `call_id` and expire with that
  call's output when no canonical check start is observed.
- The only carry path is an explicit `Script running with cell ID <id>` result;
  a subsequent `wait` for exactly that cell inherits the candidate.
- An unrelated log replay has no candidate and cannot increment the count.
- The report still states that output-suppressed and dynamically-built commands
  are not observable.

Required checks:

1. Reproduce the original conditional-empty-output followed by unrelated saved
   log replay; require `fullCheckInvocations = 0`.
2. Reproduce `bash -lc 'npm run check'` with canonical output; require 1.
3. Reproduce a yielded Code Mode cell followed by `wait` for the exact cell;
   require 1, then verify later `write_stdin` output does not double count it.
4. Run the three targeted test files; require 25/25.
5. Inspect real reports without transcript bodies: parent
   `019fa8fd-19bb-7d91-80ec-5fd6f3addd01` must report 2; implementer
   `019fa91f-2429-7133-b66a-15edae3b341e` must report 1.
6. Require the fingerprint in `.claude/loop-state.md` to match the projection,
   `git diff --check` to pass, and no unrelated changed path.

The final full check for this exact tree is intentionally deferred until this
logic re-audit passes, because the two-run operational budget was already
exhausted by the original audit correction. Do not treat that explicit pending
ship gate as a code finding in this pass. If logic passes, the judge will run
one documented budget-exception full check without modifying the audited tree.

Return findings only and one verdict for `M-OPS-MEASURE`: `SHIPPED-OK`,
`BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`. State whether the carry-over finding is
resolved and list limitations.
