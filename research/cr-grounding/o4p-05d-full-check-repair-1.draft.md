# O4P-05D full-check repair 1

Milestone: `O4P-05D`

Audited candidate: `3931290f7dbbdf8200d489da364bea075db439f5`

First local release full-check result: FAIL only in three predecessor
base-relative architecture reviews. All registered verifiers, docs, lint, and
Core 226 files / 2,086 tests passed. DOM passed 304 of 307 files and 2,110 of
2,113 tests; build was skipped after the three test failures.

## Root cause

The O4P-04B/C/D architecture reviews had exact successor allowlists through
O4P-05C. They correctly rejected eight new O4P-05D Judge-owned paths, but had
not yet re-owned the registered D contract/brief/verifier/review paths or the
second exact package script. No production behavior, assertion, threshold,
dependency, lockfile, CR, Worker configuration, or Pages workflow failure was
reported.

## Bounded correction

- In exactly the O4P-04B/C/D architecture reviews, admit only milestone-scoped
  `research/cr-grounding/o4p-05d-*.draft.md`, the exact final D archive record,
  the exact D verifier, and the exact D architecture review.
- Require changed package scripts to equal exactly the C and D verifier scripts,
  with both exact command values.
- Refresh the three exact predecessor review hashes in the O4P-05C verifier,
  then refresh only that verifier hash and the D review hash in the O4P-05D
  verifier.
- Extend the D protected-drift allowance only to the three corrected predecessor
  Judge reviews plus its own D Judge review. Production source remains forbidden.

Run the three invalidated predecessor reviews, O4P-05C/D verifiers, D review,
machine-order review, scoped lint/Node typecheck, and `git diff --check`. Return
the corrected candidate to the same cold auditor. Only after a matching
BLOCKER/HIGH-zero repair audit may the governance-maximum second and final local
`npm run check` run. No push, CI, Pages, or Cloudflare deployment is authorized
before that closure.

## Repair-audit wording correction

The first repair audit found no mechanical weakening but correctly rejected the
older contract phrase that predicted an O4P-05D-only forbidden stop. Because
this repair re-owns the O4P-04B/C/D predecessor architecture reviews too, the
actual base-relative first CI must list exactly those three review paths plus
the O4P-05D review path. Contract, acceptance, review, and verifier now bind
that exact four-path set; no additional code or scope correction is made.
