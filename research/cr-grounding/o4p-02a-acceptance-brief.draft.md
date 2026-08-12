# O4P-02A judge acceptance brief

Status: frozen by the Sol judge on 2026-08-12; not an implementer write lane.

Base SHA: `e1a71beac93f4882827bd8138990360840363a29`

Contract:
`research/cr-grounding/o4p-02a-solo-core-compatibility.contract.draft.md`

## Judge-owned evidence paths

- `src/engine/compatibility/__tests__/review.o4p-02a-solo-core-compatibility.test.ts`
- `src/test/architecture/review.o4p-02a-solo-core-compatibility-boundary.test.ts`
- `src/engine/compatibility/fixtures/o4p-02a-solo-core-compatibility-v1.json`
- `scripts/checks/verify-solo-core-compatibility.ts`
- package and machine-check registration selected serially by the Sol judge

## Acceptance IDs

### A-CATALOG-01 closed honest capability catalog

- The exact 20 concerns, order, classes, and non-empty reason codes match the
  contract.
- No `identical`, open-string concern, generic success fallback, or unknown
  payload escape is exported.
- Commander/combat/player-exit Core capabilities are classified from shipped
  O4P-01M/N source rather than the historical O4P-01C blocked table.
- Catalog and lookup results are fresh/deeply frozen where prescribed.

### A-MAP-01 exact bijective identity map

- Valid four-player, physical-card, and object mappings preserve input order
  and validate Core IDs plus Solo object incarnations.
- Duplicate Solo keys, duplicate Core values, missing players/cards, unknown or
  stale objects, sparse arrays, accessors, symbols, unknown fields, and hostile
  proxies fail with complete deterministic issues.
- Validation does not mutate, trim, sort, deduplicate, or merge input.

### A-VIEW-01 deterministic common projection

- Fixed Solo and Core fixtures project to the same closed view for active
  player, turn number/position, ordered private/shared zones, Commander
  identity/cast count, and null/non-null multiplayer combat assignments.
- All Solo phase mappings are exercised.
- Array order differences remain differences; projectors do not sort to pass.
- Missing map entries, source IDs, Core cast ledgers, owner identity, stale
  object incarnations, and Solo battle combat targets reject atomically.
- Projected data contains no card definitions, Oracle text, full source root,
  event log, UI log, or arbitrary hidden payload.

### A-DIFF-01 differential parity and honest failure

- At least one shared semantic state change is run independently through the
  Solo and Core authority in the test harness, then projected and compared.
- Equal views return `compatible` with empty issues.
- Each comparable-view field has a mutation vector that returns
  `incompatible` at the exact deterministic path.
- Lossy, Solo-only, Core-only, and unsupported catalog concerns cannot be
  passed to the comparator as if they were supported.
- The adapter never calls `applyCommand`, `applyCoreCommandV1`, store commit,
  journal replay, or event reduction.

### A-SNAPSHOT-01 Solo persistence preservation

- `SNAPSHOT_VERSION` remains exactly `1`; `GameSnapshot` retains exactly
  `version`, `state`, `deck`, and `autoAdvanceToMain`.
- Existing IndexedDB round trip, version mismatch, clear, restore history
  reset, legacy private-zone backfill, third/fourth player restore, and
  development-fixture isolation suites remain green.
- Manual-resolution persistence still stores its Solo baseline.
- Core closure/replay versions remain unchanged and are not imported by
  `src/data/gameSnapshot.ts`.

### A-OFFLINE-01 offline and dependency boundary

- Compatibility source imports only engine Solo types and public Core
  types/validators.
- Compiler/API inspection rejects React, DOM, Zustand, store, App, IndexedDB,
  Online, Room, protocol, projection, Cloudflare, Worker, WebSocket, Node-only
  runtime, randomness, clock, timer, and dependency imports.
- The verifier runs in-process with network access unavailable.
- Existing Solo routes remain production-authoritative; no application source
  imports the compatibility adapter in O4P-02A.

### A-IMMUTABLE-01 hostile input and deterministic evidence

- Valid outputs, issues, catalog entries, maps, views, and parity results are
  deeply frozen as prescribed.
- Repeated projection/comparison of equivalent inputs produces the same JSON
  bytes and issue order.
- Inputs remain deeply equal and descriptor-equivalent after every operation.
- Unsupported values and traps fail closed without raw error or secret echo.

## Required affected checks

- implementer ordinary compatibility tests;
- all O4P-01N closure tests and `verify:mode-neutral-core-closure`;
- `src/test/architecture/soloOnlineBoundary.test.ts`;
- `src/store/__tests__/review.m424.test.ts`;
- `src/store/__tests__/snapshotPersistenceControl.test.ts`;
- `src/store/__tests__/zonesByPlayer.test.ts`;
- `src/store/__tests__/review.mp-zones-commands.test.ts`;
- the new judge review tests and compatibility verifier;
- lint, build, forbidden diff scan, and `git diff --check`.

## Candidate gate order

1. Luna ordinary tests, targeted affected tests, lint/build, and diff check.
2. Sol source review and serial judge evidence integration.
3. Freeze candidate fingerprint and run all targeted review/verifier checks.
4. Independent Luna cold audit receives only the audit brief/frozen paths.
5. Close BLOCKER/HIGH findings, refreeze, and re-audit as required.
6. Mark `AUDIT-OK-PENDING-FULL-CHECK` on the final fingerprint.
7. Run one fingerprint-matched full `npm run check`.
8. Manifest/ledger/commit/push/CI/Pages only with publication authority.
