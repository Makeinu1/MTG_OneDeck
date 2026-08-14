# O4P-05A cold audit brief

Milestone: `O4P-05A`

Base SHA: `17965786dba01a15770e19437b9456ca81c0f18b`

Audit lane / budget: `STANDARD R3 / one bounded 30-minute wait`

Frozen semantic fingerprint:
`9abc4a64ae63f84df5092c1f59fac42a624dd68a9d8a0a6aed896f29cc2545b3`

Frozen context fingerprint:
`8a2053765676d25754d07e0be2a7a1e7a8a258ec94f4de466ef8556b1e0c63bd`

Read only:

- `.claude/audit-standing.md`;
- `research/cr-grounding/o4p-05a-public-release-ruleset.contract.draft.md`;
- `research/cr-grounding/o4p-05a-acceptance-brief.draft.md`;
- the complete tracked and untracked candidate diff from the Base SHA.

Do not edit any file. Do not read implementation rationale or agent history.
Do not run release `npm run check`.

Recompute both fingerprints before inspection and before return. Semantic is
the sorted SHA-256 material for exactly:

- `src/versioning/index.ts`;
- `src/versioning/publicReleaseRuleset.ts`;
- `src/versioning/publicReleaseRuleset.test.ts`;
- `src/versioning/review.o4p-05a-public-release-ruleset.test.ts`;
- `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts`;
- `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts`;
- `src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts`.

Context is the same semantic set plus the ledger, frozen contract, acceptance
brief, and implementation brief. This cold-audit brief and ignored loop-state
are excluded.

Audit adversarially for:

1. any CR body/metadata, current version vector, verifier, package, dependency,
   engine, Store, Solo, Online, Cloudflare, UI, or machine-check drift;
2. copied/retyped release version data, reference-identity loss, incomplete
   deep freeze, mutable builder, fallback, unversioned alias, environment or
   latest-version override, filesystem/network/clock/RNG/storage behavior;
3. a descriptor that can claim another ruleset or version, or a release claim
   not bound to the repository-local `mtg-cr-2026-06-19` bytes and SHA;
4. missing fail-closed `verify:cr` / `verify:versions` ordering, vacuous review
   assertions, weakened predecessor tests, or descriptor tests that remain
   green when the implementation is meaningfully broken;
5. active-program/brief inconsistency, unauthorized implementer ownership, or
   claims beyond the explicit O4P-05B/C/D DEFER.

Judge evidence before freeze:

- versioning target: 3 files / 59 tests PASS;
- O4P-05A Judge review: 1 file / 5 tests PASS;
- `npm run verify:cr`: PASS at exact 2026-06-19 SHA;
- native `npm run verify:versions`: PASS;
- scoped ESLint, `npx tsc -b`, and `git diff --check`: PASS;
- first release full check: Core 226/2086 PASS; DOM 299/302 files and
  2088/2091 tests PASS, with only the three predecessor O4P-04B/C/D
  base-relative successor-registration assertions failing on the declared
  O4P-05A paths; build skipped;
- post-full-check repair target: the three invalidated predecessor files plus
  the O4P-05A review, 4 files / 18 tests PASS; exact O4P-05A paths only were
  added to each predecessor allowlist;
- CR/metadata/version/verifier/machine-check/package diff: empty;
- forbidden scan reports only Judge-owned ledger/briefs as NEEDS-REAUTH and the
  Judge-owned new `review.*` file as FORBIDDEN.

Run `npm run check:forbidden -- --diff
17965786dba01a15770e19437b9456ca81c0f18b` and report all ownership paths. Run
the O4P-05A Judge review test, complete versioning target, all three repaired
predecessor architecture tests, both pin verifiers, and adversarial/vacuity
probes. Inspect the three allowlist additions for exact successor scope and
fake-green broadening. Do not rerun the release full check.

Return findings only, each with severity `BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`,
exact path/line, reproduction/evidence, impact, and smallest safe correction.
Return observed fingerprints, commands/outcomes, findings sorted by severity,
and exact totals. End with `AUDIT-OK-PENDING-FULL-CHECK` only when
BLOCKER/HIGH are zero; otherwise `AUDIT-FIX-REQUIRED`. Timeout or incomplete
inspection is no verdict.
