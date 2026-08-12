# O4P-02B continuation packet

Status: `implemented-not-audited`

Milestone: `O4P-02B`

Base SHA: `62fd41918590de90165fdd3b982efe0032dd6ddb`

Reason for boundary: the first context compaction occurred after bounded
implementation and judge integration. Governance requires closing only the
current atomic action, recording this packet, and ending before a new auditor,
repair wave, full check, or adjacent milestone.

## Frozen authority and audit entrypoint

- Contract: `research/cr-grounding/o4p-02b-four-seat-room.contract.draft.md`
- Acceptance: `research/cr-grounding/o4p-02b-acceptance-brief.draft.md`
- Implementer brief: `research/cr-grounding/o4p-02b-implementation-brief.draft.md`
- Cold-audit brief: `research/cr-grounding/o4p-02b-cold-audit-brief.draft.md`
- Loop state: `.claude/loop-state.md`

## Completed in this task

- Clean-base O4P-02B preflight at the base SHA, including `npm ci`, baseline
  full `npm run check`, forbidden diff scan, ledger/active-program health, and
  shipped O4P-02A prerequisite.
- Frozen pure local four-seat Room contract, implementation brief, and
  judge-owned acceptance matrix.
- Bounded implementer source and ordinary tests under `src/online/room/**`.
- Judge-owned fixture, functional review, architecture review, offline
  verifier, machine-check registration, checks TypeScript registration, and
  targeted `online-room` domain.
- One implementer repair return closed a judge-found source-index drift in
  relation/host diagnostics after an unreadable earlier seat.
- Targeted evidence listed in the cold-audit brief is green. No full release
  check was run after candidate implementation.

## Remaining in exact order

1. Start one fresh read-only cold auditor with only the cold-audit brief path.
2. If BLOCKER/HIGH exists, return the smallest bounded correction to the same
   implementer; one repair return remains. Re-freeze and re-audit.
3. On BLOCKER/HIGH 0, record findings in an archive note and mark
   `AUDIT-OK-PENDING-FULL-CHECK`.
4. Run one fingerprint-matched full `npm run check`. Repair and re-audit only
   if that check exposes a candidate defect.
5. Update exactly one O4P-02B entry in each ledger collection to shipped,
   preserve all DEFERs, complete loop-state, and re-run governance checks.
6. Explicitly stage intended files, commit with the cold-auditor identifier,
   push main, verify GitHub Actions test/build/Pages, served HTML/JS/CSS HTTP
   200, and a clean worktree.
7. End O4P-02B. Start O4P-02C only in a fresh task/preflight; then repeat the
   same governed sequence for O4P-02C, O4P-02D, and O4P-02E.

The user has already authorized normal Pages shipment without another human
ship decision. That authorization does not waive audit, fingerprint, full
check, CI, Pages, or milestone-separation gates.
