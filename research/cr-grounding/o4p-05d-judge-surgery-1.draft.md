# O4P-05D Judge surgery 1

Milestone: `O4P-05D`

Base SHA: `e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c`

Authority: first independent cold audit by `/root/o4p05d_cold_auditor`, verdict
`AUDIT-FIX-REQUIRED`, totals BLOCKER 0 / HIGH 3 / MEDIUM 0 / LOW 0.

## Accepted findings and bounded correction

1. The uncommitted Judge-owned `review.*` path makes the worktree-oriented
   forbidden guard red. Freeze and explicitly commit the corrected candidate
   locally before re-audit. Do not push. The clean committed candidate must
   make plain `npm run check:forbidden` green while the base-to-candidate diff
   and audit still expose the exact Judge-owned review path.
2. A bare ledger change from O4P-05D `pending` to `shipped` passed both the
   verifier and review. Keep `pending` valid during candidate/production
   evidence collection, but require the final secret-free O4P-05D production
   audit record and its closure markers whenever either ledger entry is
   `shipped`.
3. `package-lock.json` drift passed the dependency guard. Freeze its exact base
   hash, include it in protected-drift detection, and compare it byte-for-byte
   with the base in the architecture review.

No product source, runtime, protocol, projection, UI, CR, Worker configuration,
Pages workflow, dependency, version, release threshold, external service, or
deployment state may change in this correction. Re-run only the invalidated
O4P-05D verifier/review, machine-check ordering test, scoped lint/typecheck,
forbidden guard after local commit, and adversarial claims before returning to
the same cold auditor. The release full check, push, CI, Pages, and Cloudflare
deployment remain prohibited.
