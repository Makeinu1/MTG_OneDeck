# M-OPS-TOKEN-EFFICIENCY re-audit brief

Read the original brief at
`research/cr-grounding/m-ops-token-efficiency-cold-audit-brief.draft.md`, then
re-audit only the two confirmed findings and regressions they could introduce.
Do not edit files.

Original cold auditor: Kuhn `019fa948-c842-7a43-8396-9896f3469423`.
Original verdict: M-OPS-CONTEXT HIGH; M-OPS-MEASURE MEDIUM;
GOVERNANCE-DIET and ARCHIVE-HYGIENE SHIPPED-OK.

The judge made these bounded corrections after the implementer had reached its
two-correction limit:

1. Ledger health now validates every `domains` and `plannedSequence` status
   against `statusDefinitions`. Missing and unknown values must produce
   `INVALID_STATUS`, integrity selection, and exit 2 even when both live copies
   agree on the corrupt value.
2. `fullCheckInvocations` now requires both an ordered static candidate and an
   observed canonical machine-check start in subsequent tool output. A literal
   `if (false)` candidate without output must not count; a literal
   `bash -lc 'npm run check'` with observed output must count. The report exposes
   its detection strategy and explicitly states that output-suppressed or
   dynamically-built invocations are not observable.

The authoritative corrected fingerprint is in `.claude/loop-state.md`; updated
full-check evidence for that exact fingerprint is in
`/private/tmp/mtg-onedeck-m-ops-check-evidence.md`.

Required checks:

1. Require `npm run codex:context -- --domain cr-609-one-shot-mass` exit 0,
   matching fingerprint, health OK, and current loop-state.
2. Reproduce missing and unknown status cases through exported pure APIs.
3. Reproduce the conditional false-positive and shell-wrapper false-negative;
   inspect real reports for parent `019fa8fd-19bb-7d91-80ec-5fd6f3addd01` and
   implementer `019fa91f-2429-7133-b66a-15edae3b341e` without printing source
   bodies. The parent should report two observed full checks (initial freeze and
   post-audit correction); the implementer should report one.
4. Run the three targeted test files. Reuse the final full check only if its
   fingerprint exactly matches.
5. Check `git diff --check` and confirm no unrelated scope change since the
   original audit.

Return findings only and final verdicts for `M-OPS-MEASURE` and
`M-OPS-CONTEXT`: `SHIPPED-OK`, `BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`. State
whether the original findings are resolved. Do not re-open the two already-green
areas unless the correction changed them.
