# M-OPS-TOKEN-EFFICIENCY cold-audit record

- Base SHA: `5b0856229e6b4cfc799dd8920f4b7f2f9bf8ced1`
- Implementer: Tesla `019fa91f-2429-7133-b66a-15edae3b341e`
  (`fork_context: false`)
- Cold auditor: Kuhn `019fa948-c842-7a43-8396-9896f3469423`
  (`fork_context: false`, findings only)
- Final audited code/governance fingerprint:
  `2ced9f1dd08323f7c3f8e54b79c6c04c26624b607c09b63c40d55c01f3794775`

## Final verdicts

| Area | Verdict |
|---|---|
| M-OPS-MEASURE | SHIPPED-OK |
| M-OPS-CONTEXT | SHIPPED-OK |
| GOVERNANCE-DIET | SHIPPED-OK |
| ARCHIVE-HYGIENE | SHIPPED-OK |

Final BLOCKER/HIGH: 0. Final unresolved MEDIUM: 0.

## Findings and adjudication

1. Initial HIGH: missing/unknown live ledger statuses were not rejected and
   could silently change automatic selection. Fixed by validating both
   `domains` and `plannedSequence` against `statusDefinitions`; reproduced as
   `INVALID_STATUS`, integrity selection, and exit 2. Re-audit: resolved.
2. Initial MEDIUM: source-text matching counted `if (false)` and missed a shell
   wrapper. Replaced with candidate plus observed canonical machine-check start;
   wrapper and conditional cases pinned. First re-audit found a remaining
   carry-over false positive.
3. Re-audit MEDIUM: an unobserved candidate survived its own output and was
   consumed by a later unrelated saved-log replay. Fixed by scoping candidates
   to `call_id`; carry is allowed only through an explicit yielded cell and its
   matching `wait`. Second re-audit: findings none, SHIPPED-OK.
4. Re-audit LOW: the first re-audit brief expected one parent full check, while
   the real parent task correctly contained two at that point. Corrected to
   parent 2 / implementer 1. After the final budget-exception check, the parent
   report correctly records 3.

## Evidence

- Targeted: 3 files / 25 tests PASS.
- Final `npm run check`: lint PASS (one pre-existing
  `AudioVisualProvider.tsx:281:6` warning), 306 test files / 2531 tests PASS,
  typecheck/build PASS.
- The final full check ran at the audited fingerprint above; post-check context
  projection remained healthy/current and `git diff --check` passed.
- Context projection output was under 12 KiB and returned the explicit CR609
  domain plus two shipped recursive dependencies.
- Real usage reports: parent task full checks 3, implementer 1; both
  `inheritedContext: false`; no transcript bodies emitted.
- Governance diet: `AGENTS.md` 9242 bytes at audit, all required North Stars,
  protected lanes, STOP classes, shipped gates, engine/UI/accessibility gates
  retained.
- Archive hygiene: 29 prior packets byte-identical to base paths and backed by
  shipped/superseded plus independent-audit evidence.
- No `src/`, game, UI, engine, dependency version, or public API change.
- `npm run check:forbidden` exited 1 as expected for judge-authored
  `AGENTS.md`/`review.*`; protected changes were independently inspected rather
  than treated as implementer-owned.

## Operational exception and remaining external gate

The judge invoked full `npm run check` three times, exceeding the planned cap of
two. The second re-audit found a remaining MEDIUM after the second check; a
third exact-fingerprint run was required to avoid fake-green release evidence.
This implementation milestone is not part of the first-three-milestone trial;
the scorecard begins with the next milestone.

The personal Custom Instructions A/B has not been executed in this task because
it requires two fresh non-forked top-level tasks under controlled settings. Its
exact treatment text, fixed task, and decision rule are prepared in
`archive/governance/m-ops-custom-instructions-ab-protocol.md`. No efficiency
benefit is claimed until that experiment is completed.
