# O4P-04D cold re-audit brief

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Auditor: `/root/o4p04d_cold_auditor`

Audit lane / budget: `BROAD R3 / one bounded 45-minute wait`

Frozen semantic fingerprint:
`12b935f8c16ae4328570caf730a8e2825461b95933ff06bf26a74d78051ff4f0`

Frozen context fingerprint:
`27241d1a8176fd70ee9016cfefd114e19b96dfed1c4cdab266668026cceb2017`

Read only:

- `.claude/audit-standing.md`;
- `research/cr-grounding/o4p-04d-guided-manual-actions.contract.draft.md`;
- `research/cr-grounding/o4p-04d-acceptance-brief.draft.md`;
- `research/cr-grounding/o4p-04d-correction-1.draft.md`;
- `research/cr-grounding/o4p-04d-correction-2.draft.md`;
- the complete tracked and untracked candidate diff from the Base SHA.

Do not edit any file. Do not read implementer rationale or agent history. Do
not run release `npm run check`.

Recompute both fingerprints before inspection and before return. Semantic is
the Base-relative binary diff under `src` and `research/design`, followed by
SHA-256 rows for every untracked file under those paths in bytewise path order.
Context is the same stream followed by SHA-256 rows, in the order below, for:

1. `o4p-04d-guided-manual-actions.contract.draft.md`;
2. `o4p-04d-acceptance-brief.draft.md`;
3. `o4p-04d-implementation-brief.draft.md`;
4. `o4p-04d-correction-1.draft.md`;
5. `o4p-04d-correction-2.draft.md`.

This brief, the original audit brief, and loop-state are excluded from the
context set.

The first audit reported exactly:

- HIGH: a confirmed `apply-control` action survived same-reference,
  same-revision projection candidate drift;
- MEDIUM: the public binding-input type exposed `unknown` action and a broad
  command ID;
- MEDIUM: the O4P-04D architecture test broadly allowed every dev-fixture file
  without scanning each for ambient effects.

Reproduce each original finding and verify its smallest correction. Then
re-audit the complete candidate adversarially against all seven categories in
the original cold-audit brief, including hostile runtime inputs, action/binder
algebra, private-data non-reflection, manual-only non-bindability, architecture
vacuity, and the viewport evidence boundary. Do not limit inspection to the
three prior findings.

Judge evidence after correction 2:

- combined model/component/predecessor/architecture set: 14 files / 63 tests
  PASS, including a Judge-owned same-reference same-revision stale-confirmation
  regression;
- scoped ESLint, `npx tsc -b`, and `git diff --check`: PASS;
- correction 2 did not change CSS or geometry; the prior exact three-viewport
  evidence remains layout-valid.

Run `npm run check:forbidden -- --diff <base>` and report every ownership path.
Run the O4P-04D Judge tests and directly invalidated predecessor gates plus
bounded adversarial/vacuity probes. Do not run the release full check.

Return observed fingerprints, commands/outcomes, findings sorted by severity,
and exact totals. End with `AUDIT-OK-PENDING-FULL-CHECK` only when
BLOCKER/HIGH are zero; otherwise `AUDIT-FIX-REQUIRED`. Timeout or incomplete
inspection is no verdict.
