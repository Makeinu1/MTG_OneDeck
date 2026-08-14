# O4P-04D cold re-audit 2 brief

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Auditor: `/root/o4p04d_cold_auditor`

Frozen semantic fingerprint:
`22c999cb63c63b7e84f2fa5bc8a173e74b4a3bc848593dd3711540a54a8675a9`

Frozen context fingerprint:
`4156d9ef3605041e905a9bea583d1d949be283463e0b5b793e82245a1caff4c6`

Read `.claude/audit-standing.md`, the frozen contract and acceptance brief,
`research/cr-grounding/o4p-04d-judge-surgery-1.draft.md`, and the complete
Base-relative candidate diff. Do not edit files, read agent history, or run the
release `npm run check`.

The immediately prior re-audit closed all three initial findings and reported
one new MEDIUM: the pure-module architecture assertion filtered production
files to `.ts`, while the candidate allowlist accepted an adversarial
`src/online/guidedActions/ambient.tsx` containing `window` and `fetch`.

The Judge-only correction now scans both `.ts` and `.tsx` and requires the
exact approved production set: `errors.ts`, `index.ts`, `model.ts`, and
`types.ts`. Reproduce the original `ambient.tsx` attack, probe a harmless extra
`.ts` and `.tsx`, and confirm that the current exact tree still passes. Inspect
the complete candidate for regression or vacuity; do not limit the verdict to
that probe.

Judge evidence after surgery: the complete combined set passes 14 files / 63
tests; scoped ESLint, `npx tsc -b`, and `git diff --check` pass.

Recompute fingerprints before inspection and return. Semantic is the
Base-relative binary diff under `src` and `research/design`, then SHA-256 rows
for untracked files under those paths in bytewise path order. Context is that
same stream followed by SHA-256 rows for contract, acceptance, implementation,
correction 1, correction 2, and Judge surgery 1, in that order. Audit briefs,
re-audit briefs, and loop-state are excluded.

Return exact findings totals and commands. End with
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero; clearly state
whether all severities are zero.
