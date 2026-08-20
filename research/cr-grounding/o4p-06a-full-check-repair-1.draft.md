# O4P-06A Full-Check Repair 1

Date: 2026-08-20
Owner: Judge
Failed candidate commit: `e134e46444a33e5629d9d4c12f83e1bf7831e139`

## Detected failure

The first effective `npm run check` passed the CR, version, docs, Core, Solo,
Online, and O4P-05C verifiers, then stopped in the O4P-05D historical release
verifier. That verifier and four related Judge reviews computed their original
milestone scope from a frozen base to the current `HEAD`. O4P-06A is the first
authorized successor with new product source, so the historical guards treated
all audited `src/online/bootstrap/**` and O4P-06A evidence as O4P-05D/O4P-04
scope drift. Targeted DOM evidence reproduced five failures in the O4P-04B,
O4P-04C, O4P-04D, O4P-05D, and O4P-06 registration guards. No bootstrap,
catalog, state, replay, size, privacy, dependency, or version assertion failed.

The earlier sandbox-only `tsx` IPC `EPERM` attempt did not execute the release
gate and is recorded as environment noise, not an effective full-check result.

## Bounded Judge repair

- Historical O4P-04B/C/D scope lists now compare their original base to the
  exact pre-O4P-06A registration closure
  `04dd0575388d3aa5a09f63ef6123f67b63933fe3`.
- The O4P-05D verifier/review now compare their base to the exact O4P-05D
  closure `69559e13716e9d0767d8189714d8c14fb630db46`, and separately require zero
  current untracked protected drift. Later audited source is no longer
  misclassified as historical O4P-05D drift.
- The O4P-06 roadmap review reads the registered ledger from its exact closure
  for registration assertions and checks the live projection against the first
  currently pending O4P-06 parent, so shipping A can advance deterministically
  to B without weakening program order.
- Frozen hash chains are re-anchored only to these Judge-owned assertion bytes.

No O4P-06A runtime, ordinary test, catalog fixture, public API, Core/Room/
Protocol/Cloudflare semantics, dependency, version, workflow, or UI byte may
change in this repair.

## Closure

Run the five invalidated reviews, the O4P-05C and O4P-05D verifiers/reviews,
the O4P-06A Judge review, scoped lint/typecheck, and diff check. Return the
repaired fingerprint and exact changed paths to the same cold auditor. Only an
impact re-audit with BLOCKER/HIGH zero permits the second and final effective
`npm run check`.
