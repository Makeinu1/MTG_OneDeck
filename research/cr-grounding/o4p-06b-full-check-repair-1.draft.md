# O4P-06B Full-Check Repair 1

Date: 2026-08-21
Owner: Judge
Release base HEAD: `02ec9141b22f70d7f9ce5745a7b0ee5b71751f08`

## Detected failure

The first recovery-task `npm run check` passed CR, version, docs, Core, Solo,
Online, and every verifier through the Cloudflare production gate. It then
stopped in `verify:o4p-05c-release-gates` because that historical O4P-05C guard
still compared its 2026-08-15 base to the live working tree. O4P-06B is the
first authorized successor to change the guarded Core, Protocol, and Headless
paths, so the historical test-only assertion misclassified audited successor
source as O4P-05C production drift.

No O4P-06B command, replay, authority, secrecy, generated API, dependency,
version, or documentation-contract assertion failed.

## Bounded Judge repair

Pin both O4P-05C historical scope comparisons to the exact O4P-05C shipped
closure `e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c`, following the already audited
O4P-06A precedent used by the O4P-04 and O4P-05D historical gates.

Allowed semantic repair paths:

- `scripts/checks/verify-o4p-05c-release-gates.ts`;
- `src/test/architecture/review.o4p-05c-release-gates.test.ts`.

Allowed mechanical hash-chain re-anchor:

- the O4P-05C verifier's frozen hash for its architecture review; and
- `scripts/checks/verify-o4p-05d-production-release-closure.ts` frozen hash for
  the O4P-05C verifier.

The current live production-tree scan that prevents imports of the test-only
evidence helper, every frozen Cloudflare/configuration hash, dependency and CR
pin checks, and the O4P-05D current-untracked protected-path guard must remain
unchanged and non-vacuous. No wildcard successor allowance is permitted.

Prohibited: product source, O4P-06B contract/acceptance meaning, generated API,
manifest re-anchor, package/lock/config/workflow, ledger, dependency, version,
or unrelated review changes.

## Invalidated checks

Run only the repaired O4P-05C verifier/review, the dependent O4P-05D verifier
and review, the O4P-06 registration review, machine-check registration test,
targeted ESLint, `npx tsc -b`, and `git diff --check`. Prove a wrong closure SHA
makes the historical scope guard red and that live product imports of the
test-only evidence helper remain rejected. Do not run `npm run check`.

Freeze the repaired release fingerprint and obtain independent cold re-audit.
Only BLOCKER/HIGH zero permits the second and final recovery-task full check.
