# O4P-02D cold audit record

Milestone: `O4P-02D` Player / Table / Spectator Audience Projection

Base SHA: `84edd7e0639d7f7ec4e239f5e522ca8fa5815af8`

Audit authority:

- `research/cr-grounding/o4p-02d-audience-projection.contract.draft.md`
- `research/cr-grounding/o4p-02d-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-02d-cold-audit-brief.draft.md`

Independent auditors: `/root/o4p_02d_cold_auditor` for the initial frozen
candidate and `/root/o4p_02d_repair_auditor` for every repair candidate. Both
were read-only and ran no release full check.

## Initial audit and correction return 1

The initial audit matched semantic fingerprint
`0f1dae75d3878383cb1350ce43d158ffef6819e11517a357f80452302a024cee`
and context fingerprint
`da5a93d6f595950b8464568b92b39d00b3070549dadd19c54566613c1feac5da`.
It returned `AUDIT-FIX-REQUIRED`, totals BLOCKER 0 / HIGH 3 / MEDIUM 1 /
LOW 1:

- hostile nested accessors and Proxy get traps could execute;
- a valid decision maker controlling an earlier player produced an ordering
  that the projection validator rejected;
- a configured capability used as an unknown key leaked through failed-request
  issue paths;
- hidden/public zone and visible definition/runtime relations were incomplete;
- search-candidate equality depended on object property insertion order.

Correction return 1 added descriptor-only hostile-input handling, Core-order
effective viewers, selective capability-key redaction, the initial zone/object
matrix, and descriptor-safe structural equality. The judge added matching
ordinary and `review.*` regressions without weakening prior evidence.

## Repair audit and correction return 2

The repair audit matched semantic fingerprint
`ae43b1ad18f9ef71b7e57a6816045b618db4685ce188961022bff5ae33a4b1e5`
and context fingerprint
`5931c4582bab0b0adc5d3a4e9cd013122ed5ad11c05ab128c1599989ef86aa7d`.
It found BLOCKER 0 / HIGH 0 / MEDIUM 1 / LOW 0. The remaining medium proved
that the hostile wire validator accepted face-up concealed exile, non-null
spell-copy runtime, noncanonical counters, and noncanonical color order.

Correction return 2 aligned those runtime, counter, definition, and zone
relations with the public Core constraints. The next audit matched semantic
fingerprint
`103cfc433897135562c9d4006e134ca463d3dc8c647b4b7d1af0fdb81745fae6`
and context fingerprint
`ce5e7459291611a1adfaee8c4c5dd3113bc449defe30fbe334fe91db7b5b6ffd`.
It returned BLOCKER 0 / HIGH 1 / MEDIUM 1 / LOW 0:

- relation checks still coerced hostile scalar Proxies with `String(...)`;
- projected Scryfall IDs were not checked as lower-case UUIDs, while keyword
  validation rejected CR-containing strings that canonical Core accepts.

## Bounded judge surgery and build-graph repair

Both implementer returns were exhausted. The Sol judge made bounded surgery in
the projection validator: every unknown string coercion was removed, Scryfall
source IDs now require lower-case UUIDs, and keyword canonicality exactly
matches public Core. Judge regressions cover seven scalar-Proxy relation
categories, exact UUID paths, and an accepted Core `Alpha\rBeta` keyword that
projects and self-validates.

At semantic fingerprint
`9b7eb9f9f1be077a6133fad01b8f4bd853895db56f4d469576b4451b71fe7391`
and context fingerprint
`e1d5c940b6c6b798062687a0bd57a7969dea6561e55a19231eed21d6aff7d1a5`,
the auditor confirmed all semantic repairs but found BLOCKER 0 / HIGH 1 /
MEDIUM 0 / LOW 0: the configured app TypeScript graph included the judge
review file and exposed 23 test-only readonly/narrowing diagnostics.

The acceptance author changed only test typing boundaries, using an explicit
deep-mutable fixture type, record-typed request fixtures, branded player IDs,
and a proper accepted-transition predicate. No assertion, expectation,
compiler config, exclusion, or suppression changed.

## Final repair audit

The final read-only audit matched semantic fingerprint
`aa348d6391cfadf7fc2f59436b984ce09dcd89bc7a137d372a958a1a2ce11c39`
and context fingerprint
`6bfb9d07bcece1c6a884bd1d3f10671265ffb2966a1e582b0296d221f24d54f0`.
Context health was `ok` and loop state was current. Verdict:
`AUDIT-CLEAR` / `AUDIT-OK-PENDING-FULL-CHECK`; totals BLOCKER 0 / HIGH 0 /
MEDIUM 0 / LOW 0.

Final targeted evidence:

- focused ordinary/review/architecture: 3 files / 38 tests PASS;
- `online-projection` domain: 10 files / 81 tests PASS;
- machine-check registration: 1 file / 7 tests PASS;
- D/C/B, Core closure, and Solo compatibility verifiers: PASS;
- app build-graph TypeScript and scripts-checks TypeScript: PASS;
- scoped ESLint and `git diff --check`: PASS;
- hostile scalar Proxy calls: zero; deterministic deeply frozen rejection;
- configured capability secrecy, Player/Table/Spectator parity, runtime and
  definition relations, search/permission/grant filtering: PASS.

No auditor changed a file or git state. The release `npm run check` remains
pending and must run once on the metadata-inclusive confirmed fingerprint.

## Release full-check finding and focused architecture audit

The first sandbox invocation stopped before candidate testing on the known
environment-only `tsx` IPC `listen EPERM`. The unchanged candidate was rerun
outside that sandbox. It passed every registered verifier, docs, lint, and
Core 226 files / 2086 tests. DOM then passed 264 of 266 files and 1872 of 1874
tests; build was correctly skipped. Both failures were stale central
architecture registrations:

- `modeNeutralCoreBoundary.test.ts` had not registered the four audited
  Projection public-Core consumers or the D verifier;
- `o4p01iStackAnnouncementBoundary.test.ts` had not added the audited
  `projection` Online root directory to its fixed set.

The judge added exactly the D verifier, exact per-file public-Core symbol
allowlists for `project.ts` (13), `support.ts` (7), `types.ts` (11), and
`validation.ts` (6), and the one `projection` root name. Namespace imports,
unlisted symbols, direct Core submodules, non-static forms, future consumers,
reverse imports, and reducer/mutation imports remain rejected.

Focused read-only audit matched semantic fingerprint
`7d3e6ee08adbf7aac52097e4e461b08b66ed71598c883dc142dc4de9e0c453c7`
and context fingerprint
`91721e7beb840a07ea331c821c6e03dc0712470949ba57d03fac687e3e6dd018`.
It returned `AUDIT-OK-PENDING-FULL-CHECK`, totals BLOCKER 0 / HIGH 0 /
MEDIUM 0 / LOW 0. The affected architecture slice passed 3 files / 16 tests;
ESLint, app build-graph TypeScript, and `git diff --check` also passed. The
final release full check remains pending on the metadata-inclusive candidate.

## Final fingerprint-matched release full check

After metadata-only confirmation, the Sol judge ran the final governed
`npm run check` on semantic fingerprint
`b224546b7d42482479aecf33d4a5d637d1706c25fda3981dc5a084fcfce01ca8`
and context fingerprint
`b0f4923b063bf5443e8b23d0b3c8d9fd71ac137e67cc9e60a7f9158f27a31129`.
Context health was `ok` and loop state was current.

- every machine verifier, docs, and lint: PASS;
- Core: 226 files / 2086 tests PASS;
- DOM: 266 files / 1874 tests PASS;
- TypeScript production build and Vite build: PASS;
- `git diff --check`: PASS;
- generated JS: `assets/index-DYJZmvM4.js`;
- generated CSS: `assets/index-JeU5vEot.css`.

The full check changed no candidate or generated tracked artifact. O4P-02D is
`audited` and pending only explicit candidate publication, exact-head GitHub
Actions, Pages/served-asset evidence, terminal ledger metadata, and a clean
worktree.
