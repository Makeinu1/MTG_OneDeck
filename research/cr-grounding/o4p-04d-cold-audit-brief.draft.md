# O4P-04D cold audit brief

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Audit lane / budget: `BROAD R3 / one bounded 45-minute wait`

Frozen semantic fingerprint:
`b4832f8a5090ce8da94dba7413ec022ffe4eed15e7843ca54acf7c03363bead7`

Frozen context fingerprint:
`589be34eaa5b6ffdba03ad7ee892009cfc386e7452b73c25de5b01282bc24724`

Read only:

- `research/cr-grounding/o4p-04d-guided-manual-actions.contract.draft.md`
- `research/cr-grounding/o4p-04d-acceptance-brief.draft.md`
- the complete tracked and untracked candidate diff from the Base SHA.

First read `.claude/audit-standing.md`. Do not edit any file. Do not read
implementation rationale or agent history. Do not run release `npm run check`.
Recompute both fingerprints before inspection and before return using the same
sets: semantic is the Base-relative binary diff plus untracked SHA-256 rows
under `src` and `research/design`; context adds the contract, acceptance,
implementation, and correction-1 draft hashes. This audit brief and loop-state
are excluded from the context set.

Audit adversarially for:

1. projection/private-data leakage, hidden identity reconstruction, or caller
   diagnostic reflection through view, DOM, actions, errors, labels, values, or
   attributes;
2. false automation, legality, or acknowledgement claims; correction digest or
   physical Commander ID invention; manual-only action bindability;
3. exact search/control/attack/block action and protocol-envelope algebra,
   actor/revision/decision/candidate drift, bearer/fragment handling, and stale
   session/projection acceptance;
4. getter/descriptor/prototype/symbol/sparse-array/Proxy traps, source mutation,
   missing fresh deep freeze, order drift, trim/default/dedup/merge, or retained
   prior projection/form confirmation;
5. Store/Solo/GameScreen/private Core/Room/protocol/projection imports,
   Cloudflare/headless/network/storage/timer/RNG behavior, root App integration,
   version/dependency/config drift, or architecture allowlist broadening;
6. unreachable native controls, missing manual boundary, horizontal overflow,
   app-owned fixed overlays, or viewport divergence at 375x812, 812x375, and
   1440x900;
7. vacuous Judge assertions, weakened predecessor `review.*`, or behavior
   claimed beyond explicit DEFER.

Judge evidence before freeze:

- review/model/component: 5 files / 20 tests PASS;
- architecture successor set: 10 files / 46 tests PASS;
- invalidated full-source AST architecture gate: 1 file / 2 tests PASS with
  assertions unchanged and only a 60-second execution budget added;
- scoped ESLint, `npx tsc -b`, and `git diff --check`: PASS;
- browser: exact 375x812, 812x375, 1440x900; all five sections visible and
  scroll-reachable; horizontal overflow 0; app-owned fixed elements 0; manual
  boundary labels 2; guided confirmation emits nothing before confirmation and
  one exact `apply-control` action after confirmation; console errors 0;
- `check:docs` currently stops only because the modified manifest-verified
  `soloOnlineBoundary.test.ts` requires candidate-commit SHA reanchor;
- forbidden scan reports only Judge-owned `review.*` and `NEEDS-REAUTH` paths.

Run `npm run check:forbidden -- --diff <base>` and report all ownership paths.
Run the two O4P-04D Judge review tests and the directly invalidated predecessor
architecture tests, plus adversarial/vacuity probes. Do not rerun the release
full check.

Return findings only, each with severity `BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`,
exact path/line, reproduction/evidence, impact, and smallest safe correction.
Return observed fingerprints, commands/outcomes, findings sorted by severity,
and exact totals. End with `AUDIT-OK-PENDING-FULL-CHECK` only when
BLOCKER/HIGH are zero; otherwise `AUDIT-FIX-REQUIRED`. Timeout or incomplete
inspection is no verdict.
