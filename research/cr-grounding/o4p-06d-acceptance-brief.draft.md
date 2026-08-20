# O4P-06D Acceptance Brief

Base: `f050bd5b0db21b70a4fd6edbd89719b57bbf9e56`

1. Public constants and client methods match the frozen contract; state snapshots are deeply frozen and capability-free.
2. URL validation accepts only the exact query-free/hash-free WebSocket room route and never transmits a credential in a URL.
3. Worker ready -> client hello -> accepted server hello -> projection request -> valid projected snapshot is the only path to `open`.
4. Projection remains null/unchanged for submit/send/ACK/reject/revision/reconnect; only a current-epoch validated projection can replace it.
5. The outbox is immutable, insertion ordered, capability-free, capped at 64, duplicate-id safe, replayed byte-for-byte, and settled only by a matching current-epoch closed ACK/reject.
6. Lost ACK, duplicate response, response-before-open, unrelated identity, lower revision, higher revision, `resyncRequired`, and out-of-order snapshot cases are executable.
7. Unexpected close/error retains outbox and follows the exact six-delay sequence. Explicit disconnect cancels reconnect; stale epoch callbacks are inert.
8. Malformed/oversized/accessor/symbol/prototype/sparse/unknown/version/identity/capability-fragment hostile values fail closed without throwing through the public API or exposing the credential.
9. Browser production code has no React, Zustand, storage, logging, Worker/DO import, dependency/config/version/CR change, randomness, or optimistic authority.
10. O4P-06D ordinary tests plus Judge review/architecture review, affected predecessor reviews, `npx tsc -b`, affected ESLint, generator check, and diff check pass before cold audit.

Deferred: public App/UI, room create/join presentation, persistent/offline queue, token refresh, multi-tab ownership, Cloudflare server edits/deploy, and four-browser production acceptance.
