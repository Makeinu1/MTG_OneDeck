# O4P-02C bounded implementer brief

Milestone: `O4P-02C`

Base SHA: `64eb31e2ff5cd276e8bb73ea835d51a34c3b5ef1`

Contract:
`research/cr-grounding/o4p-02c-in-memory-protocol.contract.draft.md`

## Goal

Implement the frozen pure in-memory protocol state, hostile-input validators,
hello/reconnect, command handling/deduplication, ACK/reject, snapshot request,
and metadata-only resync without changing Core, Room, versioning, Solo, UI,
governance, judge evidence, or release-owned files.

## Sole write scope

The implementer may add only:

- `src/online/protocol/index.ts`
- implementation files directly under `src/online/protocol/`
- ordinary tests under `src/online/protocol/__tests__/` whose names do not
  contain `review`

No existing file may be edited. Do not create `src/online/index.ts`.

## Forbidden

No git operation. No `review.*`, `src/test/architecture/**`, fixture, verifier,
package/lock, docs, research, ledger, loop-state, generated API, shared version,
Core, Room, compatibility, Solo, store, UI, transport, network, Cloudflare,
WebSocket, Worker, dependency, clock, timer, storage, or ambient-random edit.

Import Core, Room, and versioning only through their shipped public barrels.
Do not forward raw Room/Core diagnostic data or capability-bearing data to a
public response. Do not invent projection data.

## Required implementation properties

Implement every exact schema, validation property, precedence rule, secrecy
boundary, lifecycle effect, DEFER, and named public operation in the frozen
contract. Use `unknown` plus descriptor-safe guards; no `any`. Keep the Core
reducer call confined to the command handler. Prefer small modules and one
local barrel.

Run only targeted ordinary protocol tests and scoped lint while iterating.
Report changed files, targeted results, explicit DEFERs, and unresolved points.
Do not run review tests, architecture tests, a verifier, or full release check;
do not claim audit or shipment.
