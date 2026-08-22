# O4P-07 roadmap registration full-check repair 1

Date: 2026-08-22
Failed exact-head run: `32549910643`
Failed HEAD: `bc0c564572f5526561c2efb109b3e303949604de`
Risk: R1 Judge-review allowlist repair

## Failure

The exact-head workflow reached the DOM project after all earlier verifiers and
then failed only in
`src/test/architecture/review.o4p-07-roadmap-registration.test.ts`. The review's
exact changed-path allowlist did not include the already audited two-file CI
reauthorization metadata commit, so it rejected the cold-audit brief path as an
unexpected change. The workflow stopped before diff-base resolution,
`check:forbidden`, artifact upload, or Pages.

## Bounded repair

Extend only that Judge-owned exact-path allowlist with:

- the already committed initial CI reauthorization record and brief;
- this repair record, audit brief, and later archived findings record; and
- the exact two filenames reserved for the terminal ownership-only
  reauthorization after this review change triggers the expected forbidden
  stop.

No wildcard, directory prefix, product path, runtime/config/dependency byte,
selection semantic, acceptance assertion, or forbidden policy changes. The
review continues to reject every unnamed path.

## Acceptance

The repaired Judge review passes, all historical registration/gate reviews and
O4P-05D verifier remain green, scoped TypeScript/ESLint/diff checks pass, and a
fresh context auditor reports BLOCKER/HIGH zero before the repair commit. The
next exact-head workflow must pass its full check; an expected ownership-only
stop for the changed review is not Pages or shipment success.
