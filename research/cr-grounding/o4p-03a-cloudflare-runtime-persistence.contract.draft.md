# O4P-03A Cloudflare Runtime & Persistence contract

Status: judge-frozen implementation contract

Milestone: `O4P-03A`

Base SHA: `95b34868966de671c97f0aa824422ccb0c14e051`

Risk / audit lane: `R3 / BROAD`

Inputs:

- shipped O4P-02C in-memory protocol state and command-envelope operations;
- shipped O4P-02E local five-client headless gate and privacy/replay evidence;
- Cloudflare Workers / Durable Objects API documented for 2026-08-13;
- the user-authorized O4P-03 program order `03A -> 03B -> 03C -> 03D`.

This contract puts the already-shipped application protocol behind one Worker,
one room-addressed Durable Object, and SQLite-backed persistence. It does not
change Room, Core, protocol, projection, Solo, or UI meaning.

## Goal and trust boundary

Provide a deployable, dependency-free TypeScript Worker entry and deterministic
SQLite repository that:

1. routes one validated Room ID to one Durable Object with `getByName(roomId)`;
2. initializes exactly one canonical `OnlineProtocolStateV1` for that Room;
3. accepts the shipped `OnlineCommandEnvelopeV1` over a bounded HTTP Room API;
4. applies the shipped `handleOnlineCommandEnvelopeV1` operation exactly once;
5. atomically persists each new accepted command and the resulting canonical
   protocol state in SQLite; and
6. exposes a WebSocket upgrade entry without yet claiming message protocol,
   hibernation, reconnect, outbox, or recovery behavior.

Worker and Durable Object request bodies are hostile `unknown`. SQLite data is
trusted only after JSON parse plus the shipped validators. Public responses,
errors, status records, and WebSocket bootstrap data MUST NOT contain a seat or
observer capability, Core root, Core command, receipt digest, hidden card or
object value, SQL text/row, stack, or nested cause.

## Version and dependency decision

- `ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1` is exactly `1`.
- O4P-03A does not change `CURRENT_CONTRACT_VERSIONS`, protocol version, Core
  version, projection version, Solo snapshot version, or `CACHE_SCHEMA_VERSION`.
- No npm dependency or devDependency is added. Runtime API types are minimal
  structural interfaces owned under `src/online/cloudflare/`; no hand-written
  interface may invent behavior beyond the Cloudflare methods used here.
- `wrangler.jsonc` is strict JSON-compatible JSONC with:
  - `main: "src/online/cloudflare/worker.ts"`;
  - compatibility date `2026-08-13`;
  - binding `ONLINE_ROOMS` to class `OnlineRoomDurableObject`;
  - declarative `exports.OnlineRoomDurableObject` with
    `{ "type": "durable-object", "storage": "sqlite" }`;
  - no legacy `migrations`, remote resource ID, account ID, route, secret, or
    production hostname.

## Closed Room API

The public Worker accepts only the following exact routes. The path Room ID is
one percent-decoded segment and must satisfy the shipped Room-ID grammar.
Cloudflare applies URL normalization before a request reaches a Worker, and the
Fetch `Request.url` is a parsed URL. Therefore the serialized, platform-
normalized `new URL(request.url).pathname` is the only routing authority in
this milestone. A raw spelling already removed by RFC 3986 dot-segment
normalization is not observable and MUST NOT be reconstructed or treated as a
distinct Room path.

```text
PUT  /api/online/rooms/:roomId
GET  /api/online/rooms/:roomId
POST /api/online/rooms/:roomId/commands
GET  /api/online/rooms/:roomId/websocket
```

Unknown paths, including a valid Room ID followed by an unknown action or an
extra segment, return `404`; wrong methods return `405`; invalid encoded/path
Room IDs return `400`; a missing `ONLINE_ROOMS` binding fails closed with a
generic `500`. Valid requests are forwarded to exactly
`env.ONLINE_ROOMS.getByName(roomId).fetch(request)`. Query strings never select
or alter a Room. In the platform-normalized pathname, a decoded slash, empty
Room segment, visible dot Room segment, prototype key, control character, or
invalid encoding rejects before binding lookup. Unknown actions and extra
segments also reject before lookup with `404`.

`Content-Type` for PUT/POST is exactly JSON-compatible
`application/json` with optional parameters. `Content-Length`, when present,
must be a canonical non-negative integer no greater than
`ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 = 1_048_576`. The actual UTF-8 body is
also capped at that value. Empty, malformed, oversized, or non-object JSON
fails with one generic public error and never reaches the shipped operation.

### Initialization

PUT body is the exact record:

```text
kind:          "online-cloudflare-room-initialize-v1"
schemaVersion: 1
state:         OnlineProtocolStateV1
```

The body is closed and validated descriptor-safely after JSON parse. The path
Room ID, `state.room.roomId`, and Durable Object `ctx.id.name` must be equal.
Initialization accepts only a new canonical Room state with `revision === 0`,
`state.coreRoot.acceptedCommandCount === 0`, and an empty `receipts` array.
Importing a nonzero snapshot is migration/recovery behavior deferred to
O4P-03D and rejects without a write.
The first valid PUT initializes SQLite atomically. Repeating the byte-equivalent
canonical state is idempotent and returns the same status without a second
write. Any different reinitialization returns `409` and never overwrites data.
Initialization returns only the public status record below.

### Status

GET returns `404` when the Room is not initialized, otherwise the exact frozen
record:

```text
kind:                   "online-cloudflare-room-status-v1"
schemaVersion:          1
roomId
revision
roomLifecycle
acceptedCommandCount
```

`revision === acceptedCommandCount === state.coreRoot.acceptedCommandCount`.
`roomLifecycle` is the shipped Room lifecycle literal. No raw persisted state
is returned.

### Commands

POST body is exactly the shipped `OnlineCommandEnvelopeV1`. The path Room ID
must equal the envelope Room ID. The Durable Object loads and revalidates the
persisted protocol state, calls `handleOnlineCommandEnvelopeV1` exactly once,
and returns its shipped ACK or reject response without rewording its semantics.

- A new accepted or accepted-with-warning ACK advances revision by one and is
  persisted in one synchronous SQLite transaction together with one journal
  row.
- A duplicate ACK, stale rejection, authorization rejection, invalid command,
  or any other rejection performs zero SQLite writes.
- A thrown composition, parse, validation, SQL, or serialization failure
  returns a stable generic `500` and performs no partial write.
- The repository never mutates the input or returned shipped state.

The accepted-command journal stores only the already-validated fields
`commandId`, `participantId`, `baseRevision`, `acceptedRevision`, and the exact
serialized `CoreCommandV1`. It MUST NOT store `participantCapability`, a full
command envelope, a public response, or an error/stack. The command JSON is
internal and is never returned by this milestone.

## Canonical serialization

`serializeOnlineCloudflareProtocolStateV1(unknown)` first calls
`validateOnlineProtocolStateV1`; success returns deterministic JSON of that
fresh canonical value. Failure returns deterministic frozen issues or throws
only the milestone's generic serialization error, as frozen by the public API.

`deserializeOnlineCloudflareProtocolStateV1(string)` rejects an oversized,
malformed, non-canonical, or validator-invalid payload. Success returns a fresh
deeply frozen `OnlineProtocolStateV1`. Serializing, deserializing, then
serializing a canonical state is byte-identical. No `eval`, dynamic import,
reviver, prototype mutation, auto-sort, trim, deduplication, or in-place
mutation is permitted.

Accepted commands are serialized from the validated envelope's `command` only.
Before opening the accepted-command transaction, the repository must prove
that no configured participant capability or any contiguous capability
fragment of eight or more UTF-16 code units is present in any textual journal
parameter: `commandId`, `participantId`, or serialized command JSON. A failure
throws the milestone serialization error before the shipped ACK is returned;
the Durable Object exposes only the generic `500`, opens no transaction, and
writes nothing.

## SQLite schema and atomicity

The Durable Object constructor creates two `STRICT` tables with constant SQL:

- one singleton Room-state row containing schema version, Room ID, revision,
  lifecycle, accepted-command count, and canonical state JSON;
- an append-only accepted-command journal keyed by accepted revision and with a
  unique command ID.

No request-derived identifier is interpolated into SQL text. All values use
positional parameters. Initialization and each new accepted command execute in
`ctx.storage.transactionSync`, whose callback is synchronous. For an accepted
command, the journal insert and singleton state update are in the same callback;
an exception rolls both back. Repository load checks exactly one singleton row,
column types, schema version, Room/revision/count relations, journal count and
max revision, and one matching accepted receipt for every journal row. The
accepted receipt and journal row must have the same accepted revision,
participant ID, command ID, and base revision; every loaded textual journal
parameter is rechecked for configured capability fragments. It then
deserializes and validates the state. Any mismatch fails closed without repair,
deletion, sorting, or inferred defaults. Full command replay and recovery proof
remain O4P-03D; O4P-03A validates canonical command structure and the complete
journal-to-receipt metadata relation without claiming replay recovery.

O4P-03A makes no recovery or migration promise. It does not call `deleteAll`,
PITR, alarm, or schema-altering statements after table creation.

## WebSocket entry boundary

The WebSocket route requires `Upgrade: websocket`, an initialized Room, and no
body. The Durable Object creates one `WebSocketPair`, calls the standard server
socket `accept()` exactly once, and returns status `101` with the client socket.
It sends one capability-free bootstrap frame containing only schema version,
Room ID, current revision, and the exact deferred list:

```text
["messages", "hibernation", "reconnect", "outbox"]
```

O4P-03A MUST NOT call `ctx.acceptWebSocket`, attach an application message
handler, accept command frames, serialize socket attachments, restore sockets,
broadcast, reconnect, or claim hibernation. Those behaviors belong to O4P-03B.

## Public surface and dependency boundary

`src/online/cloudflare/index.ts` exports exactly the milestone constants,
closed public types, validators/codecs, repository, Worker factory, and
`OnlineRoomDurableObject`. `src/online/cloudflare/worker.ts` exports that class
and a default Worker handler.

Production files under `src/online/cloudflare/` may import only shipped public
barrels:

- `src/engine/core/index.ts` for types only;
- `src/online/room/index.ts` for types/ID guard only;
- `src/online/protocol/index.ts` for the shipped state validator, envelope
  validator, command operation, and public types.

They must not import React, DOM UI, Zustand, Solo store, IndexedDB,
`src/online/headless/**`, `src/online/projection/**`, protocol/Room internals,
Node built-ins, test helpers, or a root Online barrel. Reverse imports from
shipped lower layers are forbidden.

## Explicit DEFER / non-goals

- WebSocket application messages, hibernation API, attachments, reconnect,
  reauthentication, snapshot reload, outbox, and command dedup beyond the
  shipped in-memory receipt semantics (`O4P-03B`);
- capability expiry/rotation, host/table/spectator separation expansion,
  controller leases, role allowlists beyond shipped protocol behavior, rate or
  message limits, abuse control, and audit logging (`O4P-03C`);
- production Cloudflare deploy, account/zone/routes, secrets, custom domain,
  data migration, PITR/recovery claims, load/long-room proof, schema migration,
  observability, and deployment recovery (`O4P-03D`);
- UI, browser store wiring, Table rendering, matchmaking, accounts, lobby,
  timers, new Core/Room/protocol/projection meaning, or version bumps.
