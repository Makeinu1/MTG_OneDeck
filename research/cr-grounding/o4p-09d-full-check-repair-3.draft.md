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

The reowned guard candidate was committed and pushed at exact head
785a5315d77f287767c121dd553890537bf8aa61 after final exact-byte audit
e1d8b86b92a57813e20dd2088726f749003604ca04491ebfd0ab7e440eda8ba3.
Workflow-dispatch run 33021844744, build job 98353857805, then reached the
canonical full check and stopped only because the historical O4P-03A verifier
still pinned the pre-reownership SHA-256 of its Judge guard. That failure is a
deterministic transitive ownership consequence of the same nine-guard repair,
not a product, acceptance, dependency, or test-semantics failure.

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

## Deterministic frozen-hash reanchor

Reanchor only the literal frozen SHA-256 chain invalidated by the already
audited 03A, 03B, and 03C guard bytes:

1. Re-pin each changed 03A/03B/03C boundary guard in its matching historical
   Cloudflare verifier.
2. Re-pin those three resulting verifier hashes in
   scripts/checks/verify-o4p-05c-release-gates.ts.
3. Re-pin the resulting O4P-05C verifier hash in
   scripts/checks/verify-o4p-05d-production-release-closure.ts.

The remaining six reowned guards have no executable downstream hash pin. No
assertion, path set, accepted behavior, product byte, review byte, or dependency
is changed by this reanchor.

## Verification and release boundary

The nine exact guard files pass their focused suite. The affected historical
03A/03B/03C, O4P-05C, and O4P-05D verifiers, scoped ESLint, docs validation,
and git diff --check must pass. No local canonical npm run check is authorized
for this repair; exact-head CI owns the canonical full-check evidence after
fresh-context cold audit, release preflight, fingerprint freeze, commit, and
push.
