# O4P-04D full-check repair cold-audit brief

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Auditor: `/root/o4p04d_cold_auditor`

Frozen semantic fingerprint:
`700da223a9ac75fb8740370bde730e6a673ae6a83f88ec71578e38e48410cf7b`

Frozen context fingerprint:
`3a48eff40f9c7240c6e27bf694d9d342a3f229263766e8d99fc2e5a7260d72bb`

Read `.claude/audit-standing.md`,
`research/cr-grounding/o4p-04d-full-check-repair-1.draft.md`, the frozen O4P-04D
contract/acceptance brief, and the complete Base-relative candidate diff. Do
not edit any file or run release `npm run check`.

The first formal release check passed every verifier, docs, lint, and Core 226
files / 2,086 tests. DOM passed 299 of 300 files and 2,079 of 2,080 tests, then
the existing O4P-03D recovery test timed out after about 33.2 seconds against
its explicit 30-second execution budget. Its assertions did not fail. Build was
not reached. A prior sandbox IPC failure occurred before candidate tests and is
not a product/check verdict.

Audit only this bounded Judge repair plus the complete resulting candidate:

- in
  `src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts`,
  confirm the named recovery test changes only its final timeout from 30,000 to
  60,000 and that its callback/body/assertion bytes are identical to `HEAD`;
- in the O4P-04B/C/D candidate-path gates, confirm the only new scope is that
  exact predecessor review filename, with no directory/wildcard broadening;
- confirm runtime, contracts, dependencies, config, version, Projection, Core,
  protocol, Room, Cloudflare behavior, and DEFERs are unchanged;
- probe that a neighboring Cloudflare review filename remains rejected.

Judge evidence after repair: complete O4P-03D + O4P-04D combined set 15 files /
76 tests PASS; `npm run check:docs`, scoped ESLint, `npx tsc -b`, and
`git diff --check` PASS. Do not treat the failed first formal full check as
release evidence; the repaired tree requires the second and final full check
after this audit.

Recompute fingerprints before inspection and before return. Semantic is the
Base-relative binary diff under `src` and `research/design`, then SHA-256 rows
for untracked files under those paths in bytewise order. Context is that stream
followed by SHA-256 rows, in this order, for the manifest, contract, acceptance,
implementation, correction 1, correction 2, Judge surgery 1, contract reanchor,
full-check repair 1, and cold-audit record. Audit briefs and loop-state are
excluded.

Return exact findings totals and commands. End with
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero and clearly state
whether all severities are zero.
