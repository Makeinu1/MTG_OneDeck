# O4P-02D bounded implementer brief

Milestone: `O4P-02D`

Base SHA: `84edd7e0639d7f7ec4e239f5e522ca8fa5815af8`

Contract:
`research/cr-grounding/o4p-02d-audience-projection.contract.draft.md`

## Goal

Implement the frozen pure Player/Table/Spectator projection, exact request and
wire validators, authenticated projected-snapshot operation, hidden-card
protection, filtered SearchSession/VisibilityGrant/PlayPermission surfaces,
and secret-safe returned log without changing Core, Room, protocol, versioning,
Solo, UI, governance, judge evidence, or release-owned files.

## Sole write scope

The implementer may add only:

- `src/online/projection/index.ts`
- implementation files directly under `src/online/projection/`
- ordinary tests under `src/online/projection/__tests__/` whose names do not
  contain `review`

No existing file may be edited. Do not create `src/online/index.ts`.

## Forbidden

No git operation. No `review.*`, `src/test/architecture/**`, fixture, verifier,
package/lock, docs, research, ledger, loop-state, generated API, shared version,
Core, Room, protocol, compatibility, Solo, store, UI, transport, network,
Cloudflare, WebSocket, Worker, dependency, clock, timer, storage, ambient RNG,
or logging side-effect edit.

Import Core, Room, protocol, and versioning only through their shipped public
barrels. Never call a Core reducer/mutation operation. Never forward raw Core/
Room/protocol diagnostic or capability-bearing data.

## Required implementation properties

Implement every exact schema, allowlist, audience rule, validation property,
controlled-decision/search/grant/permission rule, reconnect effect, secrecy
boundary, normalized runtime/duration rule, DEFER, and named public operation
in the frozen contract. Use `unknown` plus descriptor-safe guards; no `any`.
Prefer small modules and one local barrel.

Run only targeted ordinary projection tests, scoped lint, and the narrow
scripts TypeScript check while iterating. Report changed files, targeted
results, explicit DEFERs, and unresolved points. Do not run review tests,
architecture tests, a verifier, or full release check; do not claim audit or
shipment.
