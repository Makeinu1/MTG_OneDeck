# O4P-06 Roadmap Registration — Full Check Repair 1

Date: 2026-08-15<br>
Owner: Judge<br>
First full-check fingerprint: `14d29eaab782f5b22bd276f7f6950904626f8f2650013b651e44c11d1ff98120`

## Detected failure

The first authorized `npm run check` passed every verifier, docs, lint, and all
Core tests. DOM completed with exactly three failures:

- `review.o4p-04b-table-display-boundary.test.ts`
- `review.o4p-04c-display-pairing-boundary.test.ts`
- `review.o4p-04d-guided-actions-boundary.test.ts`

Each failure was the same base-relative registration guard. It rejected the
eight already-audited O4P-06 roadmap files because those successors did not
exist when O4P-04B/C/D were frozen. No product, privacy, projection, layout, or
runtime assertion failed. First full-check totals were Core 226 files / 2,086
tests passing and DOM 305 of 308 files / 2,116 of 2,119 tests passing.

## Bounded repair

The three historical review files admit only these exact O4P-06 registration
paths: the roadmap contract, acceptance, ledger proposal, planned-sequence
draft, audit brief, predecessor-gate repair, this full-check repair, audit
record, and Judge-owned O4P-06 review. Existing prohibited production paths and
all prior assertions remain unchanged.

Because O4P-05C freezes those three Judge reviews by hash, its verifier hashes
are re-anchored to the assertion-only bytes. Because O4P-05D freezes the
O4P-05C verifier, that one parent hash is then re-anchored. No implementation
or release evidence is rewritten.

## Required closure

Run the three invalidated reviews, the O4P-05C and O4P-05D verifiers/reviews,
and the O4P-06 review. Return the new frozen candidate to the same BROAD cold
auditor. Only after BLOCKER/HIGH zero may the second and final `npm run check`
run.
