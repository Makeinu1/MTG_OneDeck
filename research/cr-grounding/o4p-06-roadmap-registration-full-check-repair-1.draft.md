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

## CI clean-checkout portability repair

The exact-head Actions run `31883960191` then exposed one environment-only
failure in the Judge-owned O4P-06 review. The review invoked
`scripts/codex-context.mjs` with `execFileSync`, which incorrectly required a
zero exit even though `.claude/loop-state.md` is intentionally gitignored and
therefore absent from a clean checkout. The projection itself was healthy and
selected O4P-06A correctly; the CLI returned its documented stale-loop exit 5.
Core passed 226 files / 2,086 tests and DOM passed 307 of 308 files / 2,118 of
2,120 tests, with this as the only failure.

The bounded repair uses `spawnSync`, requires a clean process invocation and
empty stderr, parses the same projection, retains every health, selection, and
active-program assertion, and now verifies that the CLI exit matches the
reported loop-state status (`0` for current, `5` for stale). This keeps the
local continuation guard strict while making the roadmap assertion reproducible
in both a governed local worktree and an exact-head clean checkout. No ledger,
roadmap, product, runtime, or dependency semantics change.
