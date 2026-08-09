# O4P-01D cold-audit record

This file records the independent cold-audit result for the O4P-01D candidate.
It is audit evidence, not a formal specification, active contract, or shipped
release declaration.

- Milestone: O4P-01D
- Candidate fingerprint at final audit: `3761a9fc183fe023e7e4f0f79fe396490326555ccda00377b191e45665465d27`
- Auditor identifier: `019fe4b9-580a-7931-a6f6-1224e8419d81`
- Verdict: `AUDIT-OK-PENDING-FULL-CHECK`
- BLOCKER: 0
- HIGH: 0
- MEDIUM: 1
- LOW: 0

## Final finding

MEDIUM: successful validator output preserves input record insertion order for
`players`, `zones.byPlayer`, definitions, physical cards, and objects. The
validator is required not to sort or otherwise repair input, while the factory
is the deterministic canonical-output boundary and now normalizes its records.
This remains a known DEFER for a future contract decision; it is not treated as
a HIGH or BLOCKER for this milestone.

## Closed findings

- Non-enumerable fields and accessor values no longer produce validator
  false-green results or getter side effects.
- Factory input `kind` is not overwritten, input descriptors are not executed,
  and input remains unmodified.
- Array extra own properties, functions, and symbols are rejected.
- Compiler API boundary detection covers imports, import types, re-exports,
  dynamic imports, namespace imports, type queries, star re-exports, `.js`
  substitutions, unresolved imports, product paths, existing engine types,
  `node:` subpaths, and the Core production allowlist.
- Numeric-like record keys are preserved in factory output through explicit
  `ownKeys` ordering and have a regression test.

The cold auditor did not edit files, commit, or run the full `npm run check`.
