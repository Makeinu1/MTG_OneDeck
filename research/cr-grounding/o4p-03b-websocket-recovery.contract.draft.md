# O4P-03B WebSocket & Recovery contract

Status: judge-frozen implementation contract

Milestone: `O4P-03B`

Base SHA: `c7fe4e32a0b1e8fb4ebf33b07313b1bcd08340e9`

Risk / audit lane: `R3 / BROAD`

Inputs:

- shipped O4P-02C protocol authentication, command deduplication, snapshot, and resync operations;
- shipped O4P-02D audience-projected snapshot operation;
- shipped O4P-03A Worker, Durable Object, SQLite singleton/journal, and HTTP Room API;
- Cloudflare Durable Object Hibernation WebSocket API documented for 2026-08-13;
- the user-authorized O4P-03 program order `03A -> 03B -> 03C -> 03D`.

This contract turns the O4P-03A WebSocket entry into a hibernatable application
transport. It preserves the shipped Room, Core, protocol, projection, Solo, and
HTTP meanings. No new gameplay or authorization role is introduced.

## Goal and trust boundary

Provide a deterministic server connection state machine and client-side pure
outbox helper that:

1. accepts the server socket with `DurableObjectState.acceptWebSocket`;
2. restores a small, secret-free attachment after hibernation or Durable Object recreation;
3. requires shipped participant authentication before snapshot or command traffic;
4. returns only shipped audience-projected snapshots;
5. applies command frames through the shipped command operation and O4P-03A atomic persistence;
6. lets a client replay byte-equivalent pending commands until an ACK or reject settles them; and
7. proves recovery after a new Durable Object instance is constructed over the same SQLite storage.

Every incoming frame, attachment, SQLite row, and public error is hostile
`unknown`. No server attachment, bootstrap, revision notice, error, audit text,
or log may contain a participant capability, Core root, Core command, receipt
digest, hidden card/object value, SQL text, stack, or nested cause.

## Versions and dependency decision

- `ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1` remains exactly `1`.
- O4P-03B does not change contract, protocol, projection, Core, state, event,
  Solo snapshot, or cache schema versions.
- No npm dependency or devDependency is added.
- `wrangler.jsonc` keeps the O4P-03A binding/export and compatibility date.
- No Cloudflare account ID, route, secret, remote ID, legacy migration, or
  production hostname is added.

## Hibernatable socket admission

The existing exact route remains:

```text
GET /api/online/rooms/:roomId/websocket
```

It still requires an initialized Room, `Upgrade: websocket`, and no request
body. The Durable Object creates one pair, calls
`ctx.acceptWebSocket(server)` exactly once, and MUST NOT call `server.accept()`
or install standard WebSocket event listeners.

Before sending application data, the server serializes this exact closed
attachment on the accepted server socket:

```text
kind:            "online-cloudflare-socket-attachment-v1"
schemaVersion:   1
roomId
participantId:  string | null
role:            "player" | "table" | "spectator" | null
authenticated:  boolean
```

The initial attachment is unauthenticated with null identity/role. An accepted
hello replaces it with the authenticated identity and role. The attachment is
descriptor-safely validated on every event, is below Cloudflare's 16,384-byte
limit, and never stores a capability, command, projection, outbox, revision,
timestamp, or error. Missing, malformed, mismatched-Room, or capability-bearing
attachments fail closed with a generic server error and no state write.

The first server frame is the exact frozen bootstrap:

```text
kind:                   "online-cloudflare-websocket-ready-v1"
schemaVersion:          1
roomId
revision
transport:              "hibernation"
authenticationRequired: true
```

## Closed frame protocol

Only UTF-8 JSON text frames no larger than
`ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1` are accepted. Binary, empty, malformed,
non-object, accessor-bearing after parse/validation, oversized, or unknown-kind
frames return one closed `online-cloudflare-websocket-error-v1` frame. The only
error codes are `INVALID_MESSAGE`, `AUTHENTICATION_REQUIRED`,
`IDENTITY_MISMATCH`, and `INTERNAL_ERROR`. Errors contain no input echo, issue
path/message, cause, stack, capability, or Room state.

The client-to-server message kinds are exactly the already-shipped records:

- `online-client-hello-v1`;
- `online-projection-request-v1`;
- `online-command-envelope-v1`.

No wrapper duplicates those records and no batch, ping, chat, presence command,
or arbitrary event kind is accepted in O4P-03B.

### Authentication and reconnect

An unauthenticated socket accepts only `OnlineClientHelloV1`. The Durable Object
loads and validates SQLite state for each hello and calls
`handleOnlineClientHelloV1` exactly once.

- A rejected hello sends the shipped `OnlineServerHelloRejectedV1`, preserves
  the unauthenticated attachment, and performs zero writes.
- An accepted hello stores only its public identity/role in the attachment and
  sends the shipped `OnlineServerHelloAcceptedV1`.
- If the shipped operation changes a disconnected participant to connected,
  that presence-only state is persisted with a same-revision, exact-state
  compare-and-set transaction before the accepted hello is sent.
- Reauthentication of an authenticated socket is allowed only for the exact
  same Room, participant, and role. Any identity switch fails closed without
  changing the attachment or state.

An authenticated socket is itself continuity evidence across hibernation, but
every snapshot request and command still carries and revalidates its shipped
participant capability. Attachment identity never substitutes for a capability.

### Snapshot reload

An authenticated socket accepts `OnlineProjectionRequestV1` only when its Room
and participant equal the attachment. The Durable Object loads SQLite state and
calls `handleOnlineProjectedSnapshotRequestV1` exactly once. It sends only the
shipped `OnlineProjectedSnapshotResponseV1`; raw protocol state, Core root, and
projection logs never cross the socket.

Any presence-only reconnect state returned by the projection operation is
persisted by the same exact-state compare-and-set rule before an accepted
snapshot is sent. A rejected projection sends the shipped safe rejected
snapshot and performs zero writes.

### Commands, revision notice, and deduplication

An authenticated player socket accepts `OnlineCommandEnvelopeV1` only when the
Room and participant equal the attachment. Table/spectator command attempts and
all capability mismatches are left to the shipped validator/operation and do
not acquire new authority here.

The Durable Object loads SQLite state, calls
`handleOnlineCommandEnvelopeV1` exactly once, persists a new accepted command
through the O4P-03A transaction, and sends the shipped ACK/reject to the sender.
The existing receipt digest and `(participantId, commandId)` semantics remain
the sole deduplication authority. A byte-equivalent replay of an accepted
command returns its duplicate ACK and performs zero writes; command-ID reuse
with different content returns the shipped reject and performs zero writes.

After a new accepted command is durably committed, every authenticated attached
socket receives exactly one capability-free revision notice:

```text
kind:          "online-cloudflare-revision-v1"
schemaVersion: 1
roomId
revision
```

The notice contains no projection. Each client requests its own projected
snapshot with its capability. A failed send to one socket does not undo the
already-committed command and does not disclose details to another socket.

## Presence close semantics

`webSocketClose` inspects only validated attachments. When the last authenticated
socket for an identity is gone, the Durable Object uses the shipped Room
disconnect operation to build a candidate protocol state and persists that
presence-only change with exact-state compare-and-set. Multiple sockets for one
identity keep the participant connected until the last closes. Close handling
is idempotent, emits no application frame, writes no capability, and never
changes revision, Core, receipts, authorizations, seats, or lifecycle except a
lifecycle consequence already produced by the shipped Room disconnect
operation.

Cloudflare defines `webSocketError` as a non-disconnection notification. It is
a write-free and frame-free no-op: it never changes the socket attachment,
presence, or any persisted state. A later `webSocketClose` performs the normal
last-socket disconnect handling.

The compatibility date already enables Cloudflare automatic close replies; no
timer, alarm, standard socket listener, `setTimeout`, or `setInterval` is added.

## Same-revision persistence

The repository gains one presence-only compare-and-set operation. It accepts a
previous canonical protocol state and a next canonical protocol state and
proves before opening a transaction that:

- Room ID, schema/protocol/build versions, revision, Core root, receipts,
  observer authorizations, host, seats, and all participant IDs/roles/seat
  indexes are byte-identical;
- only participant presence and the shipped Room lifecycle consequence may differ;
- the current singleton row still contains the exact previous canonical JSON;
- journal count/content still matches the unchanged revision.

The transaction updates the singleton only when Room ID, revision, and previous
canonical JSON all match, then verifies the exact next row. A zero-row or
multi-row result throws and rolls back. It never edits the accepted-command
journal. No repair, merge, inference, retry loop, sort, trim, or deletion occurs.

## Pure client outbox

`src/online/cloudflare/outbox.ts` provides a dependency-free immutable helper.
An outbox is bound to one Room and participant and contains an ordered array of
exact validated `OnlineCommandEnvelopeV1` values.

- enqueue never mutates or reorders entries;
- the same command ID with byte-equivalent content is idempotent;
- the same command ID with different content rejects;
- replay returns fresh byte-equivalent pending envelopes in insertion order;
- an exact matching shipped ACK or reject settles and removes only that entry;
- unknown/mismatched responses do nothing;
- no response may rewrite base revision or command content.

The outbox is client-owned volatile state. It is never serialized into a
server attachment, public error, SQLite row, log, ledger, or audit artifact.
Browser persistence, UI wiring, automatic retry timing, backoff, and batching
remain outside O4P-03B.

## Recreation and recovery claim

The Durable Object keeps no authoritative application state in instance fields.
Every event restores its validated attachment and loads canonical SQLite state.
Therefore a newly constructed instance over the same storage can continue an
existing hibernated socket, authenticate a replacement socket, return a current
projected snapshot, deduplicate replayed outbox commands, and accept the next
command.

This is the complete O4P-03B `deploymentRecovery` meaning: same-schema Durable
Object code/instance recreation over intact storage and healthy sockets. It is
not a claim about production rollout, schema migration, PITR, lost/corrupt
storage, regional movement, load, observability, or rollback; those remain
O4P-03D.

## Public surface and dependency boundary

Production files under `src/online/cloudflare/` may additionally import only
the shipped public `src/online/projection/index.ts` barrel. All O4P-03A allowed
imports and reverse-dependency prohibitions remain. No lower layer imports the
Cloudflare runtime.

The public Cloudflare barrel explicitly exports only the new closed types,
validators/helpers, and outbox operations. It does not use `export *` and does
not export internal attachment parsers or capability-bearing server records.

## Explicit DEFER / non-goals

- capability expiry/rotation, controller leases, role expansion, socket count,
  rate or message-frequency limits, abuse control, audit logging, and ban/kick
  policy (`O4P-03C`);
- production Cloudflare deploy/account/zone/routes/secrets/custom domain,
  migrations, PITR, backup restore, corrupt/lost storage recovery, load and
  long-Room proof, observability, and rollout/rollback proof (`O4P-03D`);
- UI/browser store wiring, persistent browser outbox, automatic retry timing,
  backoff, batching, matchmaking, accounts, lobby, chat, timers, and new
  Core/Room/protocol/projection meaning or version bumps.
