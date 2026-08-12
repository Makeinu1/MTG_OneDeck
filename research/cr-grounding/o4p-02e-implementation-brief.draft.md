# O4P-02E bounded implementer brief

Milestone: `O4P-02E`

Base SHA: `19bb9cbe6b1792d6ba0aad6960d7c539c472df0b`

Contract:
`research/cr-grounding/o4p-02e-local-headless-room-gate.contract.draft.md`

## Goal

Implement the frozen deterministic local four-Player plus Table headless gate,
exact hostile-input and safe-report validators, serial composition operation,
capability-safe public report, non-vacuous coverage, reconnect/stale/duplicate
tracking, and Core closure/replay parity without changing shipped lower layers
or any transport/UI/release surface.

## Sole write scope

The implementer may add only:

- `src/online/headless/index.ts`
- implementation files directly under `src/online/headless/`
- ordinary tests under `src/online/headless/__tests__/` whose names do not
  contain `review`

No existing file may be edited. Do not create `src/online/index.ts`.

## Forbidden

No git operation. No `review.*`, `src/test/architecture/**`, fixture, verifier,
package/lock, docs, research, ledger, loop-state, generated API, shared version,
Core, compatibility, Room, protocol, projection, Solo, store, UI, transport,
network, Cloudflare, Worker, Durable Object, SQLite, WebSocket, persistence,
dependency, clock, timer, storage, ambient RNG, or logging side-effect edit.

Import only the shipped public Core/Room/protocol/projection/versioning barrels.
Never call a direct Core reducer/mutation operation. Never forward raw nested
diagnostics, capabilities, hidden state, projection data, or receipts in the
safe report/error surface.

## Required implementation properties

Implement every exact input/action/report schema, descriptor-safe validation
rule, serial operation step, authority/replay boundary, non-vacuous coverage
witness, privacy scan, reconnect/revision/dedup relation, public export, and
DEFER in the frozen contract. Use `unknown` plus descriptor-safe guards; no
`any`. Prefer small modules and one local public barrel.

Run only targeted ordinary headless tests, explicit scoped lint, narrow strict
TypeScript, and scripts/checks TypeScript while iterating. Report changed files,
targeted results, explicit DEFERs, and unresolved points. Do not run or edit
judge review/architecture/fixture/verifier evidence or the full release check;
do not claim audit or shipment.
