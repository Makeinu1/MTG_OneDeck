# O4P-06A Candidate CI Judge Reauthorization

Milestone: `O4P-06A`
Candidate commit: `b1d76216ab5cc4a9d12fe9683e125787125f6a7a`
Resolved CI diff base: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Audited recovery fingerprint: `15a039868cd7b7a1f8590bd3ff1c514154ce3fd16dda258292c4a0d8ded00f0f`

## Exact-head CI evidence

GitHub Actions run `32385256052` executed at the exact candidate commit. The
registered full check passed before the ownership scan:

- every verifier, docs check, and lint: passed;
- Core: 226 files / 2,086 tests passed;
- DOM: 312 files, 2,133 tests passed and 1 skipped (2,134 total);
- TypeScript project build and Vite production build: passed;
- full-check duration: 612,663 ms;
- diff-base resolution: passed and produced the exact base above.

The ownership scan then stopped on exactly these eight Judge-owned review
paths:

1. `src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts`
   — sha256 `a90f387ebafb16ca37fbe0a1a902710654a7de2a7acc5fb758fa34a43442dc74`;
2. `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts`
   — sha256 `d43422b2fbacdc74e3cbf34c4f2d44cd4b8184b2d87536b12347e1755d8ee373`;
3. `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts`
   — sha256 `060994cda417d9c038719a6c977fb2213977745424abc5f65fbe4f38c0000666`;
4. `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts`
   — sha256 `dbf1ddc2613367c597e859d9bda8654e7ba179c963b628b8e7e859ea6ed78e6f`;
5. `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts`
   — sha256 `70fbe00827b403af5aaa9a6d37ece4e62dbb47f274443dc3d7529d8e5bd27a3b`;
6. `src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts`
   — sha256 `7b1a9ee4f716f25f0f111221957a0e0fbe08e0a3534ad4dae1e82e60d1800166`;
7. `src/test/architecture/review.o4p-05d-production-release-closure.test.ts`
   — sha256 `315a828e12a7c8dd0c1da4e702142bbd8681c1cef3be7bb6b979f8f5c9fdfc6d`;
8. `src/test/architecture/review.o4p-06-roadmap-registration.test.ts`
   — sha256 `ad000bc173008b651757a76cbd0ff5c2af6e2599163535a82476e05ad9318efa`.

All research paths were informational `NEEDS-REAUTH` entries. No ninth
forbidden path appeared. Pages configuration, artifact upload, and deployment
were skipped after the expected ownership stop.

## Judge disposition

The Judge re-owns exactly the eight hashes above. The O4P-06A primary audit
record and recovery audit record together cover their semantic and architecture
claims at `BLOCKER/HIGH = 0`. This record does not modify a review byte, weaken
the forbidden policy, or claim run `32385256052` as Pages or release success.

After independent findings-only confirmation, only this reauthorization record
and its audit brief may be committed and pushed. The resulting exact-head CI
must pass full check, ownership scan, build, and Pages before ledger promotion.
