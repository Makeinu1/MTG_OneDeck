# O4P-04D local authority-hash repair cold-audit brief

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Auditor: `/root/o4p04d_cold_auditor`

Frozen semantic fingerprint:
`eefeb15bdf6dcd5e3f57fd4803d12f151780b3ad588b7f4a8710c85f84d812f1`

Frozen context fingerprint:
`622ddce07ef83a6aa915a43533577f62c61302d13d1250c21c2c7242d5b870fc`

Read `.claude/audit-standing.md`,
`research/cr-grounding/o4p-04d-local-authority-hash-repair-1.draft.md`, the
prior full-check repair/audit evidence, and the complete Base-relative
candidate diff. Do not edit files or run a third local `npm run check`.

The second and final authorized local full check stopped only because the
registered O4P-03D production-gate verifier retained the pre-timeout-repair
SHA-256 for its Judge review file. Audit this fail-closed reanchor:

- verify the Judge review file SHA-256 is exactly
  `3771acdf221e50f3609cbacec70b52993bdadfa9f961c017fa53f7ea7f8ef0a1`;
- verify `scripts/checks/verify-online-cloudflare-production-gate.ts` changes
  exactly the corresponding prior hash literal and no other byte;
- verify the O4P-04B/C/D candidate-path gates add only that exact verifier
  filename, with no directory/wildcard broadening;
- probe that a neighboring script filename remains rejected by all three;
- confirm no source, test body/assertion, contract, dependency, config,
  version, workflow, Cloudflare resource/behavior, or DEFER changed.

Judge evidence: O4P-03D verifier PASS; repaired review plus three candidate
gates 4 files / 26 tests PASS; `npm run check:docs`, scoped ESLint,
TypeScript/Vite `npm run build`, and `git diff --check` PASS. No third local
full check is authorized; exact-head CI must provide the complete check,
forbidden scan, build, and Pages evidence.

Recompute fingerprints before inspection and return. Semantic is the
Base-relative binary diff under `src`, `research/design`, and the exact
O4P-03D verifier script, then SHA-256 rows for untracked files under those
paths in bytewise order. Context is that stream followed by SHA-256 rows, in
this order, for the manifest, contract, acceptance, implementation, correction
1, correction 2, Judge surgery 1, contract reanchor, full-check repair 1,
local authority-hash repair 1, and cold-audit record. Audit briefs and
loop-state are excluded.

Return exact findings totals and commands. End with
`AUDIT-OK-PENDING-EXACT-HEAD-CI` only when BLOCKER/HIGH are zero and clearly
state whether all severities are zero.
