# O4P-05B Four-player release scenario contract

Milestone: `O4P-05B`

Base SHA: `76da2a67743d4e54f9ef6008ca86373963c965fe`

## Goal

Provide one deterministic local release scenario that composes the shipped
four-player Commander Core, in-memory Room/Protocol/Projection runtime, and
the shipped Personal Workbench, Table Display, Display Pairing, and Guided
Actions view-model layers. The scenario is executable evidence: final Core
state and event transcript must replay exactly, and every claimed UI surface
must be constructed from the same final protocol revision.

## Evidence surface

O4P-05B is a release integration witness, not a new product abstraction. Add
one Judge-owned executable review:

`src/online/headless/__tests__/review.o4p-05b-four-player-release-scenario.test.ts`

It composes only shipped public constructors and validators. Do not add a
production export, runtime namespace API, application state, generic
`src/online/index.ts` barrel, package dependency, or version constant.

## Canonical fixture

The review constructs a fresh canonical `OnlineHeadlessRoomGateInputV1` from
the shipped Core, Room, Protocol, and Headless public constructors. Synthetic
identifiers and capabilities stay inside the test. The fixture performs no
network, storage, clock, random, environment, or DOM access. Existing shipped
validators remain the only input validators; O4P-05B must not duplicate them.

## Required four-player authority

The canonical scenario contains exactly four active seated Players `P1`–`P4`
and exactly one Table participant. Every Player must own one distinct Commander
identity and must contribute at least one unique accepted Core command. The
accepted commands are derived by exact command-id correlation between the
validated action list and accepted protocol receipts; rejected and duplicate
commands never enter replay authority. All accepted commands remain in their
original protocol order. Missing, reordered, duplicated, or substituted
authority fails closed.

The existing local Headless gate remains the only Room/Protocol command
orchestrator. O4P-05B does not duplicate reducers or mutate `GameState`/
`ModeNeutralCoreRootV1` directly.

## Ruleset-update witness

The scenario uses `PUBLIC_RELEASE_RULESET_V1` from O4P-05A by exact reference.
Its source remains `repository-local-pin`, its ruleset id remains the local
`mtg-cr-2026-06-19` pin, and its `contractVersions` remains the exact
`CURRENT_CONTRACT_VERSIONS` object. No remote/latest lookup, environment
fallback, alias, builder, copied version vector, or version bump is allowed.

## Replay witness

Replay authority is the canonical initial Core root plus the ordered accepted
unique Core commands. Run the shipped Core closure and shipped replay APIs and
require all of the following:

- protocol final Core digest equals closure final-state digest;
- replay final-state digest equals that same digest;
- replay event-transcript digest equals the closure event-transcript digest;
- replay package validates after a JSON round trip;
- at least four accepted unique commands exist and all four Players acted.

The review retains the final canonical protocol state only as local test
evidence. Event output never becomes replay input authority.

## Application and UI witness

From the same final protocol state and revision, request fresh accepted
projections for all four Players and the Table. From those projections build:

- four Personal Workbench views;
- four Guided Actions views;
- one Table Display view;
- four Display Pairing views, each pairing one Player with the same Table
  projection and yielding exactly three opponents.

Every view revision equals the final protocol revision. All four Player ids and
seat indexes are represented exactly once. Serialized public projections and
views must contain no participant capability or capability fragment, observer
authorization, or another Player's private hand/library identity or Oracle
text. No test-only report is promoted into a product/network surface.

## Immutability and determinism

Input, transition, final state, projections, views, version/ruleset reference,
arrays, and nested records are deeply frozen. Repeated runs over
JSON-equivalent inputs produce exact equal final Core state and event transcript
digests. Inputs remain byte-for-byte unchanged.

## Honest boundary / DEFER

- Unsupported compound rules remain guided/manual and are not reported as
  automatic merely because the release scenario passes.
- React/CSS integration, visual redesign, audio, browser geometry, Scryfall
  network access, Cloudflare production, persistence, websocket recovery,
  privacy/load/security/observability stress, and deployment are unchanged.
- O4P-05C owns the dedicated privacy/recovery/load/security/observability gate.
- O4P-05D owns final Cloudflare/Pages production release closure.
- No contract/schema/protocol version is bumped in O4P-05B.
