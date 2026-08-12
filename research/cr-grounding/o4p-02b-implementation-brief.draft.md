# O4P-02B bounded implementer brief

Milestone: `O4P-02B`

Base SHA: `62fd41918590de90165fdd3b982efe0032dd6ddb`

Contract:
`research/cr-grounding/o4p-02b-four-seat-room.contract.draft.md`

## Goal

Implement the frozen four-seat local Room schema and pure participant/lifecycle
operations without changing Core, Solo, protocol, projection, UI, governance,
or release-owned files.

## Sole write scope

The implementer may add only:

- `src/online/room/index.ts`
- implementation files directly under `src/online/room/`
- ordinary tests under `src/online/room/__tests__/` whose names do not contain
  `review`

No existing file may be edited. Do not create a repository-wide Online barrel.

## Forbidden

No git operation. No `review.*`, `src/test/architecture/**`, fixture, verifier,
package/lock, docs, research, ledger, loop-state, generated API, version,
Core, compatibility, Solo, store, UI, network, Cloudflare, WebSocket, worker,
dependency, timer, clock, or ambient-random edit.

Import Core types/factories/validators only through the shipped public
`src/engine/core/index.ts` barrel. The Room module may validate a supplied Core
root but must never call the Core reducer.

## Required implementation properties

Follow every exact algebra, lifecycle invariant, operation, validation,
immutability, capability secrecy, and DEFER in the frozen contract. Prefer
small modules with one public barrel. Use `unknown` plus guards; no `any`.

Run only targeted ordinary tests while iterating. Report changed files,
targeted results, explicit DEFERs, and unresolved points. Do not run the full
release check and do not claim audit or shipment.
