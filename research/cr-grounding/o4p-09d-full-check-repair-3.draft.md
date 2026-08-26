# O4P-09D Full-Check Repair 3

Date: 2026-08-27
Repair-candidate base SHA: 36edfe95a26b53fd312df520c2e998ca4ade2205
Semantic base SHA: d11a54a54bb3f3ad3dcb624132f3ea3e23de1fd2
Owner: Judge
Risk: R3 / BROAD governance repair

## Authority and trigger

The user explicitly authorized a new repair candidate, correction wave 3,
Judge reownership of the nine failing architecture guards, and one additional
commit, push, and exact-head CI cycle. Cumulative counters are retained:
repair wave 3 does not reset the prior two correction waves or full-check
usage.

Actions run 32981379929, build job 98218614567, ran against exact head
36edfe95a26b53fd312df520c2e998ca4ade2205. Its canonical npm run check failed
only in nine legacy Judge-owned architecture guard files, producing eleven
assertion failures. Product tests, product bytes, and the already accepted
O4P-09D semantics are not the repair target.

## Bounded deterministic repair

Change exactly these nine Judge-owned files:

1. src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts
2. src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts
3. src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts
4. src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts
5. src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts
6. src/test/architecture/review.o4p-01j-stack-transaction-boundary.test.ts
7. src/test/architecture/review.o4p-01h-core-boundary.test.ts
8. src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts
9. src/test/architecture/modeNeutralCoreBoundary.test.ts

The ownership changes are fixed and exact:

- Register only projectionBudgetV1.ts in the two Cloudflare exact production
  file lists that enumerate that tree.
- Register only ../tabletopManual/index in the three Cloudflare lower-barrel
  allowlists.
- Register only the tabletopManual directory in the three exact Online-root
  enumerations.
- Register only tabletop/operationsV1.ts as the new stack-transaction consumer
  in the two stack guards.
- Register only OnlineTabletopManual.tsx to its own
  onlineTabletopManual.css import.
- Register only the observed O4P-09D source-file, resolved-Core-target, and
  imported-symbol triples in the mode-neutral boundary. Namespace imports,
  re-exports, dynamic imports, type queries, unlisted sources, unlisted Core
  targets, and unlisted symbols remain rejected.

No wildcard, prefix, directory-wide Core exemption, regex weakening, product
source, ordinary product test, package, config, dependency, contract,
acceptance meaning, or O4P-09E byte is changed.

## Verification and release boundary

The nine exact guard files pass 49/49 focused tests. Scoped ESLint and
git diff --check pass. No local canonical npm run check is authorized for this
repair; the additional exact-head CI cycle owns the canonical full-check
evidence after fresh-context cold audit, release preflight, fingerprint freeze,
commit, and push.
