# O4P-09D Full-Check Repair 4

Date: 2026-08-27
Repair-candidate base SHA: a95c9b2177bd1e33d8438ff3f6f7dc4bb7895657
Semantic base SHA: d11a54a54bb3f3ad3dcb624132f3ea3e23de1fd2
Owner: Judge
Implementer: gpt-5.6-luna / xhigh / fresh context
Risk: R3 / BROAD product-regression repair and exact governance reownership

## Authority and trigger

The user explicitly authorized correction wave 4 with exactly one
Luna/xhigh product condition repair in validation.ts, Judge reownership of four
architecture guards, repair records, independent cold audit, and an additional
commit, push, and exact-head CI cycle. The existing 2026-08-26 end-to-end
O4P-09D ship authority remains in force. No authority is added for O4P-09E
shipment. All cumulative repair-wave, full-check, CI, and usage counters remain
continuous and are not reset.

Exact-head Actions run 33023118482, build job 98358061795, ran against
a95c9b2177bd1e33d8438ff3f6f7dc4bb7895657. The repaired O4P-03A through
O4P-05D frozen-hash chain, docs validation, and lint passed. The DOM project
then exposed five bounded failures: one O4P-09D projection regression caught by
the unchanged O4P-02D Judge acceptance test and four stale historical
architecture ownership guards. Build and Pages correctly remained skipped.

## Frozen product repair

The Luna/xhigh implementer changes exactly
src/online/projection/validation.ts. In the projected token-definition keyword
predicate only, remove the rejection of a carriage-return character. Preserve
the NUL rejection, nonempty/length/trim bounds, unique and code-unit-sorted
requirements, serialized-size budgets, and carriage-return rejection for
name, layout, typeLine, face fields, and optional text.

Do not change
src/online/projection/__tests__/review.o4p-02d-audience-projection.test.ts.
That historical Judge acceptance is authoritative: Core accepts the keyword
Alpha\rBeta, so the projected value must self-validate without weakening any
other projected text boundary. Do not change another product source, ordinary
test, dependency, config, contract, or O4P-09E byte.

## Frozen Judge reownership

The Judge changes exactly these four architecture guards:

1. src/test/architecture/review.o4p-09c-pregame-lifecycle.test.ts
2. src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts
3. src/test/architecture/review.o4p-06d-browser-websocket-recovery-boundary.test.ts
4. src/test/architecture/review.o4p-04a-personal-workbench-boundary.test.ts

The exact changes are:

- Register the complete exact O4P-09D successor path set exposed by the 09C
  lifecycle guard, including the D records, product/UI/Core/Online paths, and
  Judge guards, plus the repair-4 records. The set is literal and closed; add
  no prefix, regex, directory-wide allowance, or O4P-09E path.
- Add only ../tabletopManual/index to the 07A Cloudflare lower-barrel set.
- Add only ../tabletopManual/index and the existing type-only
  ../tabletopManual/types surface to the 06D browser lower-barrel set.
- Exclude only OnlineTabletopManual.tsx and tabletopManualViewTypes.ts from the
  legacy 04A aggregate scan. Those successor files remain governed by the
  O4P-09D and mode-neutral boundaries; the PersonalWorkbench assertions and all
  other production Online component checks remain unchanged.

No regex is weakened, no directory-wide exemption is added, and no accepted
behavior or historical assertion is changed.

## Verification and release boundary

Run the complete O4P-02D audience-projection review file, the four exact
architecture guards, affected projection tests, scoped ESLint, docs validation,
git diff --check, context verification, and release preflight. A fresh-context
R3/BROAD cold auditor must return BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0 at the
frozen fingerprint. The canonical full check remains owned by the authorized
replacement exact-head CI after audited commit and push; do not spend another
local full-check invocation.
