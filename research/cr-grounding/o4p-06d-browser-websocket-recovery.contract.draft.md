# O4P-06D Browser WebSocket, Outbox & Recovery Contract

Date: 2026-08-21
Base SHA: `f050bd5b0db21b70a4fd6edbd89719b57bbf9e56`
Status: Judge-frozen for bounded implementation

## Goal

Add the browser-side transport boundary that consumes the shipped Worker WebSocket protocol without changing that protocol. A player/table browser can connect, authenticate by hello, obtain an audience projection, queue ordinary commands, settle ACK/reject responses, resynchronize after revision notices, and recover after an unexpected disconnect without optimistically mutating authoritative state or silently losing a command that the server may already have accepted.

## Owned surface

Production implementation is additive under `src/online/browser/**` and is exported only through `src/online/browser/index.ts`. The public v1 surface includes:

- `ONLINE_BROWSER_CLIENT_SCHEMA_VERSION_V1 = 1`;
- `ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1 = 64`;
- `ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1 = [250, 500, 1000, 2000, 4000, 8000]`;
- `createOnlineBrowserWebSocketClientV1(config)`;
- public config/socket/scheduler/command-intent/result/state/subscription types.

The client object exposes `connect()`, `disconnect()`, `submit(intent)`, `getSnapshot()`, and `subscribe(listener)`. `getSnapshot()` returns a deeply frozen, JSON-safe state with phase, room/participant identity, connection epoch, known authoritative revision, accepted projection or null, redacted pending commands, recovery attempt, and a closed issue code or null. It never returns the participant capability, WebSocket URL, raw frames, timers, socket objects, or callbacks.

## Protocol and authority

- The WebSocket URL must be `ws:` or `wss:`, have no username/password/query/fragment, and end at the exact encoded `/api/online/rooms/{roomId}/websocket` route. Capability material is never placed in the URL.
- Credentials remain only in the client runtime closure. They may appear in the required outbound hello/projection/command frame, but not in public state, storage, logs, errors, subscriptions, projections, or command intents.
- The existing protocol/projection schema versions remain unchanged. Accepted inbound kinds are exactly Worker ready/error/revision plus protocol v1 server-hello, command ACK/reject, and projected-snapshot response.
- Every inbound frame is UTF-8/size bounded, closed-shape validated, room/participant/protocol/build/revision checked, and capability-fragment safe before use. A projected snapshot is accepted only after `validateOnlineParticipantProjectionV1` succeeds.
- The projection is the only authoritative client game view. Submit, send, retry, ACK, reject, revision notice, socket open/close, or timer events never modify it. Only a current-epoch valid projected snapshot may replace it.

## Handshake and recovery

The deterministic phases are `idle`, `connecting`, `awaiting-ready`, `authenticating`, `resyncing`, `open`, `recovering`, `failed`, and `closed`.

1. `connect()` creates one socket and increments a positive connection epoch.
2. Socket open waits for the Worker ready frame; ready sends exactly one client hello.
3. Accepted server hello sends a projection request at the last known revision.
4. A current valid projected snapshot installs the authoritative projection, enters `open`, and replays the pending outbox in insertion order.
5. A higher current-epoch revision notice or `resyncRequired` reject sends one projection request; duplicates do not create a request storm.
6. Unexpected close/error preserves pending commands and schedules the next fixed reconnect delay. Six failed reconnects end in `failed`; explicit `connect()` starts a fresh attempt sequence. `disconnect()` cancels timers, closes the socket, enters `closed`, and never auto-reconnects.
7. Every socket callback is epoch-bound. Frames/close/error from an older epoch are ignored before parsing and cannot settle commands, replace projection, schedule recovery, or change phase.

## Bounded outbox

- `submit` accepts an intent without a capability and constructs the network envelope only at send time from the private credential.
- At most 64 distinct command IDs are pending. The 65th returns `OUTBOX_FULL` without state change.
- Duplicate command ID plus byte-identical intent is idempotent; reuse with different content returns `COMMAND_ID_REUSE`.
- Pending entries are insertion ordered, immutable, JSON-safe, and capability-free. Reconnect replays their original command ID, base revision, protocol version, and Core command bytes.
- Only a current-epoch, closed, identity-matching ACK/reject can settle its matching entry. An ACK lost after server acceptance is recovered by replay and the server's duplicate receipt. A stale/out-of-order/unrelated response is ignored. A settling reject is surfaced by closed issue code; `resyncRequired` additionally requests a projection.

## Safety and explicit defers

- No `localStorage`, `sessionStorage`, IndexedDB, Cache API, cookies, URL credential, console/network fact logging, or persistence is permitted.
- No React/Zustand/UI integration, lobby HTTP changes, Cloudflare Worker/Durable Object edits, protocol version widening, dependency/config change, optimistic Core mutation, multi-tab leader election, background sync, offline command persistence, token refresh, or production browser acceptance.
- O4P-06E owns public App integration. O4P-06F owns four-real-browser production evidence.

## Done when

The Judge review and ordinary tests prove handshake order, projection-only authority, 64-entry bound, exact replay/settlement, stale-epoch rejection, duplicate/out-of-order delivery, reconnect exhaustion/cancellation, current-revision resync, hostile frame rejection, and credential absence from every public/ambient surface. Independent cold audit must report BLOCKER/HIGH zero before the single final full check.
