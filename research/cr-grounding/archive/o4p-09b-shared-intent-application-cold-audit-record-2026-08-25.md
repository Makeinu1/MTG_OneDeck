# O4P-09B Shared Intent / Application cold-audit record

Date: 2026-08-25
Base SHA: `ce06a17b123cb6684090b48f9350df085e98ec54`
Risk: R3 / STANDARD
Judge: `/root`
Implementer: `/root/o4p09b_luna_implementer` (`gpt-5.6-luna`, `xhigh`)
Cold auditor: `/root/o4p09b_cold_audit` (fresh-context Sol/high, read-only)

## Frozen scope

Product implementation is additive under `src/online/application/**`. Judge
ownership covers the O4P-09B contract/acceptance/implementation/audit packet,
the O4P-09B protected architecture review, and the immutable O4P-09A history
guard correction. No Core, Protocol, Projection, Browser, Cloudflare, Room,
GameScreen, controller, store, dependency, configuration, or CR bytes changed.

## Semantic hashes at accepted audit candidate

- Candidate fingerprint:
  `52e6d37e560d3aa9e308ae66ccb2eec18304a87c48881931ba6f276ac96297c3`
- `applicationV1.ts`:
  `cae1ef351bc8bb3c319623dcb42ea7ea3257a523f15f043d2f52196500dbb4de`
- `types.ts`:
  `593983d85bb951770d9fdb8ed3207462d196ddf430f090918e2c12ab5686e7b4`
- Local adapter:
  `014096cbded6e29606e088e4641bb20219abba2b61a400fa8b425e7fd6182942`
- Remote adapter:
  `196c2ce0b3ec06f503152f1bafda2c9790458ec32379d32ed1e05d68d9c69c02`
- Ordinary application evidence:
  `2c00f6dba42db13cff9bcc8aa5057038333be9c265bd884995661e636fd68dcc`
- Judge review:
  `fec4602dcf6a35201cbbb3b2739a860bb919759a9e52cb94de0320b91c760479`
- Contract:
  `1f5d6b53adfee17d9ff7d5a9b8acf4671cdad2fe726f2b4a0581a6b1951b734e`

## Audit history

1. Initial candidate
   `fbce16fad0875fd15590613703403ba0f0583df78cd693605632b4a5d699faca`
   was rejected with BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0. A hostile Remote
   exchange could combine a stale-revision issue with duplicate and resync
   values that the shipped variable handler cannot emit.
2. The bounded correction made adapter authority/execution private, retained
   the single shared application entrypoint, and enforced current protocol
   receipt relations: exactly one reject issue, reject is never duplicate,
   resync is required exactly for stale revision, stale base differs from the
   current revision, and a non-duplicate ACK is the current accepted head.
   Hostile descriptor, transport-error, stale, reuse-mismatch, impossible
   reject, and impossible ACK evidence was added without changing Protocol.
3. Re-audit of candidate
   `52e6d37e560d3aa9e308ae66ccb2eec18304a87c48881931ba6f276ac96297c3`
   returned BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 with verdict
   `AUDIT-OK-PENDING-FULL-CHECK`.

## Judge verification before audit closure

- O4P-09A history, O4P-09B protected review, application ordinary tests, and
  focused Protocol/Projection suites: 6 files / 39 tests passed.
- Affected ESLint: passed.
- `tsc -b`: passed.
- `check:docs`: passed.
- `git diff --check`: passed.
- Secret-pattern scan over the candidate packet and product paths: passed.
- `check:forbidden -- --diff <base>` classified the four Judge packet files as
  `NEEDS-REAUTH` and the two Judge-owned `review.*` files as `FORBIDDEN` to an
  implementer. The seated Judge re-owns those exact six paths. No
  implementer-owned forbidden path changed.
- Ledger collection parity remained 144/144 domains and 123/123 planned
  sequence entries. O4P-09B remained the healthy pending selection and the
  declared base equaled both HEAD and `origin/main`.

## Release state

Cold audit is closed at BLOCKER/HIGH zero and semantic commit
`509cc02dfe13cb228b0dd5cc70b0661ce51ce973` exists. The initial release full
check exposed the Judge-only findings recorded below. Their independent
reaudit, one replacement full check, terminal ledger/loop-state closure,
exact-head CI, Pages asset verification, and clean worktree remain pending. No
UI browser scenario or Cloudflare Worker deployment is claimed by this
application-only slice.

## Release full-check finding

Semantic commit `509cc02dfe13cb228b0dd5cc70b0661ce51ce973` passed machine
verifiers, docs, lint, and Core `227 files / 2,093 tests`. DOM completed
`357 passed / 5 failed` files and `2,421 passed / 5 failed` tests. Four failures
were exact Judge architecture registrations for the new `application` root and
its two reviewed Core imports. One was the existing O4P-06C lobby scenario
exceeding the default five-second timeout under full-suite load; the unchanged
scenario passed alone at 3/3 with 4.93 seconds of test work.

The Judge-only correction registers the exact new module/import pairs and
calibrates only that scenario to a 10-second timeout. It adds no wildcard,
changes no assertion or fixture, and leaves all O4P-09B product hashes above
unchanged. Focused architecture evidence passed 5 files / 30 tests; the lobby
scenario passed 1 file / 3 tests. Independent exact-byte reaudit and one
replacement release full check remain required.

The Judge repair candidate
`71d272c7ac04ab82ac4d3671456efc23d119aa77cd7e47a5e8976a64b087822d`
was independently reaudited by `/root/o4p09b_cold_audit` at
BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 and received
`REPLACEMENT-FULL-CHECK-AUTHORIZED`. Repair commit
`7afcad181c5d029ce726ab495a6d5ec950162e8f` then passed the replacement
release full check: all machine verifiers, lint, Core `227 files / 2,093
tests`, DOM `362 files / 2,426 tests`, TypeScript/Vite build, and the
production-runtime verifier passed in 986,681 ms. Built assets were
`index-F6C4yCH4.js` and `index-B9TjsUJs.css`. Product hashes remained exactly
those recorded above. Exact-head CI, Pages asset verification, and terminal
ledger/loop-state closure remain pending.
