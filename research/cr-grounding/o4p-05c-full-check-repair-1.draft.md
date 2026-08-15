# O4P-05C release full-check repair 1

Milestone: `O4P-05C`

Authorized release candidate fingerprints before the check:

- semantic:
  `c684e22e09a1e334e3a9e6e8d7f428db3927dc14591f0454be70bd0ec5ebcabe`;
- context tree:
  `52d485f390de21f308051f8588589ef21dfb624c0f39bbe7a5be63636c84cc2b`.

## Detected release-gate defect

The first substantive `npm run check` passed the local pinned CR, every
registered verifier through O4P-05C, docs, lint, and Core 226 files / 2,086
tests. DOM then passed 303 of 306 files and 2,105 of 2,108 tests. Exactly three
older successor-aware architecture reviews failed:

- `review.o4p-04b-table-display-boundary.test.ts`;
- `review.o4p-04c-display-pairing-boundary.test.ts`;
- `review.o4p-04d-guided-actions-boundary.test.ts`.

Their base-relative path allowlists ended at O4P-05B, so every legitimate
O4P-05C candidate path was rejected. Build was skipped fail-closed. This is a
real predecessor registration defect and consumes the first of at most two
release full-check invocations.

## Exact Judge repair

Only those three Judge-owned reviews change. Each adds exact O4P-05C paths for
the frozen contracts/audit record, verifier/machine registration, test-only
validator/evidence/review, architecture review, and Node TypeScript registry.
`package.json` is permitted only with a stronger replacement assertion:

- dependencies and devDependencies equal the review's original base;
- exactly one script value differs;
- the only changed script is `verify:o4p-05c-release-gates` with the exact
  `tsx scripts/checks/verify-o4p-05c-release-gates.ts` command.

The existing bans on package-lock, Vite/version/application entrypoints,
projection/protocol/Cloudflare production barrels, and all other unexpected
paths remain. No wildcard grants O4P-05D, production code, or arbitrary scripts.

The repaired reviews and O4P-05C targeted evidence must pass, the repaired
hashes must be bound by the O4P-05C verifier, and the same independent auditor
must re-audit weakening/scope/vacuity before the final permitted full-check
rerun.
