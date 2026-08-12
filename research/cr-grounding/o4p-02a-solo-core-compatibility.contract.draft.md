# O4P-02A Solo/Core compatibility contract

Status: frozen by the Sol judge for bounded implementation on 2026-08-12.

Base SHA: `e1a71beac93f4882827bd8138990360840363a29`

Grounding:
`research/cr-grounding/o4p-02a-solo-core-compatibility-grounding.draft.md`

## Purpose and authority

O4P-02A adds an explicit, pure compatibility boundary between the existing
Solo `GameState` facade and the shipped O4P-01N `ModeNeutralCoreRootV1`. It
does not replace either authority and does not convert a running session from
one reducer to the other.

The V1 adapter is observational:

1. validate an explicit Solo-to-Core identity map;
2. project each already-valid authority into one closed comparable view;
3. compare only the contract-owned common concerns;
4. return deterministic typed parity or incompatibility evidence;
5. classify every excluded concern as lossy, Solo-only, Core-only, or
   unsupported.

A Solo session remains authorized by `GameState`, Solo `applyCommand`, and
`GameStore.commit`. A Core session remains authorized by
`ModeNeutralCoreRootV1`, `CoreCommandV1`, and `applyCoreCommandV1`. The adapter
MUST NOT call either reducer, update either state, select between reducer
results, or treat Core events/journal evidence as a second reducer.

## Direction and loss policy

O4P-02A freezes differential observation, not Solo-to-Core import or
Core-to-Solo export. Those directions are DEFERred until a later contract owns
the required loss and lifecycle policy.

The public capability classification is closed to:

- `transformable`
- `lossy`
- `solo-only`
- `core-only`
- `unsupported`

V1 exposes no `identical` class. A lossy, Solo-only, Core-only, unsupported, or
unmapped concern cannot produce parity success. Unknown concern names, missing
mapping entries, duplicate map keys/values, stale object incarnations, and
non-bijective mappings reject before comparison.

The O4P-01C `src/online/architecture/stateArchitecture.ts` table is retained as
the frozen historical migration inventory for that milestone. It is not the
O4P-02A compatibility authority and is not edited here. In particular, its
old `BLOCKED_REDESIGN` rows do not erase the shipped O4P-01M/N Commander,
combat, or player-lifecycle Core capabilities; O4P-02A classifies the actual
current representations through its own catalog.

## Version boundary

Public constant: `SOLO_CORE_COMPATIBILITY_SCHEMA_VERSION_V1`, exact value `1`.

This additive adapter version is independent of:

- Solo `SNAPSHOT_VERSION`;
- every field of `CoreClosureVersionVectorV1`;
- shared `stateSchemaVersion` and `eventSchemaVersion`;
- future protocol/projection versions;
- ruleset metadata and Build ID.

No existing version changes in O4P-02A.

## Public module and exact algebra

Implementation directory: `src/engine/compatibility/`.

Public barrel: `src/engine/compatibility/index.ts`. The compatibility barrel is
not re-exported by `src/engine/core/index.ts`, because it intentionally imports
both Solo and Core types.

### Capability catalog

Public names:

- `SoloCoreCompatibilityClassV1`
- `SoloCoreCompatibilityConcernV1`
- `SoloCoreCompatibilityCatalogEntryV1`
- `SOLO_CORE_COMPATIBILITY_CATALOG_V1`
- `soloCoreCompatibilityEntryForV1`

The catalog is a deeply frozen dense array in this exact concern order:

1. `player-roster` — `lossy`
2. `active-player` — `transformable`
3. `turn-position` — `transformable`
4. `ordered-zones` — `transformable`
5. `commander-identity` — `transformable`
6. `commander-cast-count` — `transformable`
7. `commander-damage` — `lossy`
8. `combat-assignments` — `transformable`
9. `general-life` — `lossy`
10. `stack-subset` — `lossy`
11. `search-control-subset` — `lossy`
12. `random-zone-order` — `transformable`
13. `full-combat-damage` — `unsupported`
14. `pending-trigger-sba-turn-advance` — `unsupported`
15. `poison-energy-experience` — `solo-only`
16. `mana-payment` — `solo-only`
17. `undo-redo` — `solo-only`
18. `indexeddb-snapshot` — `solo-only`
19. `typed-manual-correction` — `core-only`
20. `core-replay-package` — `core-only`

Each entry contains only `concern`, `classification`, and a stable non-empty
`reasonCode`. It contains no human/private payload and cannot be extended by
an open string.

### Identity map

Public names:

- `SoloCoreIdentityMapV1`
- `SoloCorePlayerMapEntryV1`
- `SoloCorePhysicalCardMapEntryV1`
- `SoloCoreObjectMapEntryV1`
- `validateSoloCoreIdentityMapV1`
- `createSoloCoreIdentityMapV1`

The exact root fields are `kind`, `schemaVersion`, `players`, `physicalCards`,
and `objects`. Arrays preserve caller order. Each array must be dense and every
Solo key and Core value must be unique within its dimension. Player and
physical-card maps are mandatory and non-empty. The object map may be empty
only when both compared combat contexts are absent.

Solo object IDs are `objectIdOf(CardInstance)` values. Core object IDs and
base IDs must pass the shipped public validators. A map entry does not confer
authority: every referenced ID must also exist in the state/root supplied to
projection. Stale or unknown entries produce typed issues.

Validation is trap-safe, exact-record, deterministic, complete, fresh, and
deeply frozen. It never trims, sorts, deduplicates, merges, or mutates input.
Issues are ordered by UTF-16 code-unit path and then code.

### Comparable view

Public names:

- `SoloCoreComparableViewV1`
- `SoloCoreComparableTurnPositionV1`
- `SoloCoreComparableZoneV1`
- `SoloCoreComparableCommanderV1`
- `SoloCoreComparableCombatV1`
- `projectSoloCompatibilityViewV1`
- `projectCoreCompatibilityViewV1`

Both projection functions accept an already constructed state/root plus the
validated identity map and return a closed result union: `projected` with a
fresh frozen view, or `rejected` with deterministic complete frozen issues.
They never throw a raw error for user data and never return a partial view.

The exact comparable view fields, in order, are:

1. `kind: 'solo-core-comparable-view-v1'`
2. `schemaVersion: 1`
3. `activePlayerId` using the Core player ID from the map
4. `turnNumber`
5. `turnPosition`
6. `orderedZones`
7. `commanders`
8. `combat`

`turnPosition` uses the shipped Core phase/step vocabulary. Solo phases map as:

- `untap`, `upkeep`, `draw` -> beginning phase with the same step;
- `main1` -> precombat-main/null;
- `combat` -> combat plus the current Solo combat step when present, otherwise
  beginning-of-combat;
- `main2` -> postcombat-main/null;
- `end`, `cleanup` -> ending phase with the same step.

`orderedZones` is a dense array in player-map order for library, hand, and
graveyard, followed by shared battlefield, stack, exile, and command. Every
entry contains a Core player ID or null, the zone kind, and ordered Core object
IDs. No card definition, Oracle text, hidden-card display data, or complete
source state is copied into the view.

`commanders` is ordered by the Solo commander array for Solo projection and by
the Core root commander array for Core projection, then canonicalized through
the identity map for comparison. Each entry contains Core physical card ID,
Core owner player ID, and command-zone cast count. Missing owner identity or
ledger is a rejection, not a default.

`combat` is null only when source combat is null. Otherwise it contains turn,
step, attacking player, ordered defending players, attacks, and blocks using
mapped Core player/object IDs. Solo battle targets are not transformable in V1
and reject with `UNSUPPORTED_COMBAT_TARGET`. Full damage is never projected.

### Differential comparison

Public names:

- `SoloCoreParityIssueV1`
- `SoloCoreParityResultV1`
- `compareSoloCoreCompatibilityV1`

The comparator accepts one Solo view and one Core view. It compares every
field of the comparable view and returns exactly:

- `compatible`: empty issues and both fresh frozen normalized views;
- `incompatible`: deterministic complete issues and both views.

It cannot ignore a field, take a concern allowlist, or return partial success.
Issue paths identify the comparable-view location without echoing hidden card
data. Input view order is preserved; arrays are never sorted to manufacture a
match.

The differential harness invokes the Solo and Core reducers outside the
adapter, projects both post-states, and compares them. This is test evidence
only and never a production session transition path.

## Snapshot and offline preservation

O4P-02A changes none of the following:

- `src/data/gameSnapshot.ts`;
- `GameSnapshot` fields or `SNAPSHOT_VERSION = 1`;
- IndexedDB database, version, object store, or key;
- `GameStore.restoreGame`, `takeSnapshot`, persistence debounce, history, or
  legacy normalization/backfill;
- `App` resume/new-game route.

Compatibility means schema/value and behavioral preservation under existing
structured-clone persistence. O4P-02A does not claim canonical byte equality,
because Solo exports no canonical byte serializer.

The compatibility implementation must remain usable without network access.
It may import `src/engine/types.ts` and public `src/engine/core/**` types and
validators. It must not import React, DOM, Zustand, store, App, IndexedDB,
`src/online/**`, protocol, projection, Cloudflare, Worker, WebSocket, Node-only
runtime modules, ambient randomness, clocks, or timers.

## Explicit DEFERs and non-goals

O4P-02A does not add:

- a production route that runs Solo through Core;
- full Solo-to-Core state import or Core-to-Solo export;
- mixed transition authority;
- general Core life/mana/counter commands;
- Core undo/redo;
- full combat damage, trigger/SBA/turn-advance command adapters;
- snapshot migration or Core replay storage in the Solo snapshot record;
- Room, seat, participant, connection, protocol, projection, network, UI, or
  Cloudflare behavior.

## Implementation ownership

The Luna implementer may write only:

- `src/engine/compatibility/soloCoreCompatibilityV1.ts`
- `src/engine/compatibility/soloCoreParityV1.ts`
- `src/engine/compatibility/index.ts`
- ordinary tests under
  `src/engine/compatibility/__tests__/soloCoreCompatibilityV1.test.ts` and
  `src/engine/compatibility/__tests__/soloCoreParityV1.test.ts`

The Sol judge owns the frozen contract/acceptance, review tests, fixture,
verifier, package/machine-check registration, manifest, ledger, loop-state,
git, CI, and release. The implementer must not edit existing Solo/Core source,
existing tests, `review.*`, docs, version files, governance, or dependencies.

## STOP conditions

Stop and return a blocker packet if implementation requires:

- applying either reducer inside the adapter;
- changing the closed catalog, view, mapping, issue, or result algebra;
- silently dropping a mapped player/object/zone/commander/combat member;
- treating lossy or unsupported data as compatible;
- changing existing Solo snapshot/store behavior or a Core closure contract;
- importing a forbidden application/network/runtime dependency;
- inventing privacy/projection behavior owned by O4P-02D;
- a new public type or error code not frozen here.
