# O4P-06D Implementation Brief

- Milestone: `O4P-06D`
- Base: `f050bd5b0db21b70a4fd6edbd89719b57bbf9e56`
- Goal: implement the frozen browser WebSocket/outbox/recovery client.
- Read fully: `AGENTS.md`, the development skill/governance, `docs/judge-protocol.md`, the O4P-06D contract, acceptance brief, existing protocol/projection public barrels, and shipped Worker WebSocket behavior.

## Implementer ownership

- Add/modify only production and ordinary-test files under `src/online/browser/**` that do not contain `review.` in the filename.
- Do not edit Judge reviews, architecture reviews, research/docs/ledgers, Cloudflare server files, other Online modules, package/config/lock/workflow/generated files, or git state.
- No dependency, protocol version, CR, schema, UI, Worker, persistence, or deployment change.

## Required work

- Implement the exact public API and phases in the contract with private volatile credentials, closed hostile validation, deep immutability, current-epoch callback fencing, bounded reconnect scheduling, projection-only authority, and a capability-free 64-entry outbox.
- Provide a default real browser WebSocket/timer adapter plus injected socket/scheduler seams for deterministic ordinary tests.
- Ordinary tests must run a valid full handshake/projection using shipped protocol/projection construction, lost-ACK replay, duplicate/out-of-order/stale-epoch cases, reconnect delay/exhaustion/cancel, URL/credential leakage probes, outbox collision/bound, and hostile frames.

Run targeted tests only, then `npx tsc -b`, affected ESLint, generator `--check`, and `git diff --check`. Do not run `npm run check`. Report changed files, acceptance results, defers, unresolved findings, and freeze without git operations.
