# O4P-03C Capability & Abuse Control contract

Status: judge-frozen implementation contract

Milestone: `O4P-03C`

Base SHA: `a6f4c539a977e38a6891c31fb99acf4fddfee428`

Risk / audit lane: `R3 / BROAD`

Inputs:

- shipped O4P-02B Room roles and participant capabilities;
- shipped O4P-02C authentication, command validation, and role rejection;
- shipped O4P-03A Worker, Durable Object, SQLite, and closed HTTP API;
- shipped O4P-03B hibernatable socket, projected reload, recovery, and outbox;
- Cloudflare Durable Object Hibernation WebSocket, State, and Workers WebSocket
  limits documentation current on 2026-08-13;
- the user-authorized O4P-03 order `03A -> 03B -> 03C -> 03D`.

This contract adds a fail-closed Cloudflare security envelope around the
shipped application protocol. It does not change Room, Core, protocol,
projection, Solo, or UI meaning.

## Goal and trust boundary

Provide one deterministic, SQLite-backed security authority per Room that:

1. classifies every participant bearer as `host`, `seat`, `table`, or `spectator`;
2. makes every network bearer an expiring, rotatable capability token;
3. resolves an accepted token internally to the shipped protocol capability,
   never by changing the lower protocol contract;
4. permits gameplay commands only to `host`/`seat` authorities holding the
   participant's current controller lease;
5. enforces bounded Room/socket, message, malformed-message, HTTP, and rotation rates;
6. rejects hostile payloads, expired/revoked tokens, role escalation, lease
   conflict, clock failure, and missing security state before application mutation; and
7. records only bounded, secret-free security audit facts.

Every request, frame, attachment, SQL row, clock value, and capability is
hostile `unknown`. No public or audit surface—including an already-shipped
application response, attachment, audit row, error, revision notice, status,
or future log—may contain a current/unexpired-retired/next/protocol capability,
capability fragment, Core root/command, receipt digest, hidden object value,
SQL, stack, or cause.

## Version, platform, and migration decision

- `ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1` remains exactly `1`.
- A separate `ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1` is exactly `1`.
- Protocol, projection, Core, state, Solo, cache, and contract versions do not change.
- No dependency, timer, alarm, standard WebSocket listener, WAF rule, Rate
  Limiting binding, account ID, route, secret, remote ID, or hostname is added.
- `wrangler.jsonc` remains byte-identical.
- New initialization atomically creates protocol state and its security rows.
  A pre-03C Room row without a complete canonical security singleton/grant set
  fails closed without repair or partial write. Production migration/backfill
  belongs exclusively to O4P-03D.

Cloudflare's platform limit is not the application limit. The application caps
messages below the documented 32 MiB Worker limit and caps attached sockets
well below the documented Durable Object maximum. Attachments remain below the
documented 16,384-byte serialized limit and are the only per-connection state
relied on across hibernation.

## Security state and initial capability classification

The repository owns exact closed rows for one security singleton, one current
grant per Room participant with its bounded retired-token ledger,
zero or one controller lease per player
participant, and append-only security audit facts.

On a first valid Room initialization, in the same synchronous SQL transaction
as the O4P-03A protocol singleton:

- the host participant's existing shipped bearer becomes authority `host`;
- every other player bearer becomes authority `seat`;
- a table observer bearer becomes authority `table`;
- a spectator observer bearer becomes authority `spectator`.

The current network token initially equals that already-configured bearer. The
underlying protocol capability remains only inside validated protocol state and
is looked up by participant identity after Cloudflare authorization. Every
participant and observer authorization must map exactly once; missing,
duplicate, mismatched-role, extra, malformed, or aliased grants reject the whole
initialization atomically.

The singleton stores the exact initialized grant count so security-only paths
can detect missing grants without reading protocol Room state. Each grant stores
exactly Room ID, participant ID, authority, current token, generation,
issued-at, expires-at, HTTP window/counter, rotation window/counter, and a
canonical closed retired-token ledger. Each retired entry stores only its raw
token, generation, and original expiry inside the same private grant row. The
ledger contains rotated network tokens retained until a later accepted rotation
can prune entries past their original expiry, is generation ordered, and is
capped at 256 entries. Only still-unexpired entries participate in collision
rejection. Configured protocol capabilities are not
duplicated into it. Tokens use the shipped capability-safe string grammar, are
globally unique within the Room across current and unexpired retired entries,
and never appear in another row type.

Exact policy constants are:

```text
capability lifetime                 43,200,000 ms (12 hours)
controller lease lifetime              30,000 ms
maximum attached sockets per Room              16
WebSocket message window                10,000 ms
messages per socket per window                  32
malformed-message window                60,000 ms
malformed messages per socket per window         8
HTTP bearer-action window               10,000 ms
HTTP bearer actions per grant per window        32
rotation window                         60,000 ms
rotations per grant per window                   4
maximum serialized WebSocket frame          65,536 bytes
maximum stored audit facts                     256
maximum retired capabilities per grant         256
```

All times are finite non-negative safe-integer Unix milliseconds supplied by
the Cloudflare runtime clock. Expiration is exclusive: a token or lease is
valid only while `now < expiresAt`. Non-finite, negative, unsafe, or regressing
time fails closed. An accepted security write advances the persisted
`lastObservedAt`; rejected clock input performs no application or security
write and emits no input echo.

## Capability rotation

The exact added route is:

```text
POST /api/online/rooms/:roomId/capabilities
```

It requires JSON and this exact closed body:

```text
kind:              "online-cloudflare-capability-rotate-v1"
schemaVersion:     1
participantId
currentCapability
nextCapability
```

The client generates `nextCapability`; the server never generates, echoes, or
returns a bearer. The current token must be unexpired, match the participant
and path Room, and be below both HTTP and rotation limits. The next token must
be valid, different from every current token and every configured protocol
capability, and contain no configured capability fragment of eight or more
characters. A successful transaction replaces only that grant's network token,
increments generation exactly once, resets its lifetime from the accepted
clock value, clears that participant's controller lease, and appends one safe
rotation audit fact. The previous token becomes invalid immediately, including
on already-authenticated sockets. A rotated network token is retained privately
until its original expiry so it can be rejected if embedded in another field;
expired retired entries are pruned only by a later accepted rotation. If the
bounded retired ledger would exceed 256 after that pruning, rotation is rate
rejected. This security check is exact-token based and must not reject an
otherwise-valid lower identifier merely because its shape resembles a bearer.

The exact success response is closed and secret-free:

```text
kind:          "online-cloudflare-capability-rotated-v1"
schemaVersion: 1
roomId
participantId
authority
generation
expiresAt
```

Malformed input is generic `400`; rejected/expired capability is generic
`401`; role/identity mismatch is generic `403`; reuse/conflict is generic
`409`; rate rejection is generic `429`; internal failure is generic `500`.
None returns input or distinguishes a wrong token from a missing participant.
There is no reset, recovery, list, read, admin, or rotate-after-expiry path in
O4P-03C.

## HTTP and WebSocket authorization

Before a bearer action reaches a shipped protocol operation, Cloudflare must:

1. load and canonically validate protocol and security state;
2. admit the applicable rate window;
3. match Room, participant, current token, generation, expiry, and authority;
4. enforce the authority/action allowlist; and
5. build a fresh internal message whose `participantCapability` is the shipped
   underlying protocol capability for that identity.

It never mutates or aliases the hostile input. The lower operation is called
exactly once only after all five steps. Lower protocol validation and role
checks remain mandatory defense in depth.

The closed allowlist is:

| Action | host | seat | table | spectator |
| --- | --- | --- | --- | --- |
| hello | allow | allow | allow | allow |
| projected snapshot | allow | allow | allow | allow |
| rotate own capability | allow | allow | allow | allow |
| command | lease required | lease required | reject | reject |

O4P-03A HTTP command requests use the same token mapping, rate gate, allowlist,
and controller lease as socket commands. HTTP controller identity is the fixed
secret-free tuple `(participantId, capabilityGeneration, "http")`; it may
acquire or renew only when the current lease is absent, expired, or already
held by that tuple. Status remains capability-free and read-only.

## Hibernatable attachment and controller lease

WebSocket admission first validates initialized security state, enforces the
Room socket cap using `getWebSockets()`, allocates a monotonically increasing
secret-free connection ID in SQL, and only then accepts one pair. Enumeration,
allocation, or attachment failure rejects before `acceptWebSocket`.

The O4P-03B attachment remains closed and adds only:

```text
connectionId
capabilityGeneration: number | null
capabilityExpiresAt:   number | null
messageWindowStartedAt
messageCount
malformedWindowStartedAt
malformedCount
```

It never stores a token, protocol capability, token digest/fragment, Core data,
command, projection, audit row, lease holder for another connection, or raw
input. Every event descriptor-safely validates the whole attachment.

An accepted hello records only the matched generation/expiry and public
identity/authority-derived Room role. Every later frame rechecks its presented
token against current SQL state; attachment authentication or generation never
substitutes for the token. Rotation or expiry therefore invalidates a live
socket on its next application frame.

For a host/seat socket command, the connection ID is the controller identity.
The lease transaction permits absent, expired, or same-holder acquisition and
renewal to exactly `now + 30,000`; a live different holder returns the closed
`CONTROLLER_LEASE_REQUIRED` socket error with zero application mutation. Token
rotation clears the lease. Closing the exact holder releases it; closing a
different or malformed socket does not. `webSocketError` remains a write-free,
frame-free non-disconnection no-op and never releases a lease.

Lease acquisition precedes the lower command operation and may remain renewed
when a syntactically valid controller command is rejected by the lower layer.
It never advances protocol revision or changes Core/Room state.

## Message and abuse admission

Only text JSON frames at most 65,536 UTF-8 bytes enter kind parsing. Binary,
empty, malformed, accessor/descriptor-invalid, oversized, or unknown kinds are
malformed attempts. Each socket's counters are updated by serializing a fresh
attachment before application handling; the window resets only when
`now >= windowStartedAt + windowLength`, never on a rejected attempt.

The 33rd message in one 10-second window and the 9th malformed message in one
60-second window return only the closed `RATE_LIMITED` socket error. While a
window is exhausted, frames do not load protocol state, acquire a lease, call a
lower operation, or write application state. Counter/attachment serialization
failure fails closed with `INTERNAL_ERROR` and no application write.

Socket admission at 16 attached sockets returns generic HTTP `429` before pair
creation/acceptance. Cloudflare may report closing sockets from
`getWebSockets()`; they count toward the fail-closed cap.

The closed socket error codes add only:

- `CAPABILITY_REJECTED` (wrong, revoked, expired, or generation mismatch);
- `ROLE_NOT_ALLOWED`;
- `CONTROLLER_LEASE_REQUIRED`;
- `RATE_LIMITED`.

They contain only kind, schemaVersion, and code. Existing error codes and all
O4P-03B safe-error rules remain.

## Bounded secret-safe audit facts

Only fixed security event codes, safe Room/participant/connection IDs,
authority or null, generation or null, accepted/rejected outcome, and observed
time may enter `online_security_audit`. It never stores a token, digest,
fragment, raw frame/body/header, IP, user agent, Core/protocol payload, issue,
SQL, stack, or cause.

Audit facts are append-only and capped at 256 rows. When full, no row is
deleted or overwritten; the security singleton increments only a safe
`droppedAuditCount`. Rotation success, capability rejection/expiry, role
rejection, lease conflict, rate rejection, and malformed threshold events are
auditable. Normal accepted hello/projection/command traffic is not logged.
Audit failure never turns a rejected action into an accepted one and never
leaks detail publicly. There is no public audit read API or `console.*` sink;
O4P-03D owns production structured-log export and observability.

## Atomicity, recovery, and validation

Initialization, rotation, lease mutation, grant counters, connection
allocation, and audit append/drop counting each use one synchronous SQLite
transaction with exact previous-value compare-and-set and exact post-write
verification. Zero-row, multi-row, duplicate, extra, non-canonical, or hostile
rows throw and roll back. No merge, retry loop, trim, sort, inference, repair,
row delete, or overwrite of an audit fact occurs. Pruning expired entries from
the canonical retired-token value during an accepted rotation is the sole
bounded history-compaction operation.

Every fetch/event reloads authoritative protocol and security state from
SQLite. A newly constructed Durable Object over intact 03C storage therefore
preserves expiry, rotation generation, rate windows, controller lease,
connection sequence, and bounded audit facts. No instance field is
authoritative application or security state.

## Public surface and dependency boundary

Production remains under `src/online/cloudflare/` and may import only the
already-authorized public Room/protocol/projection/Core barrels. Focused local
security and security-persistence modules may be added. Lower layers never
import Cloudflare. The barrel explicitly exports only closed public constants,
types, validation/results, rotation response, and pure policy helpers needed by
clients/tests; it does not export raw grant rows, token resolvers, SQL helpers,
frame parsers, audit storage operations, or capability-bearing internals.

## Explicit DEFER / non-goals

- Cloudflare account/zone/route/deploy, secrets, WAF/Rate Limiting rules,
  production migration/backfill, PITR, backup/restore, corrupt/lost storage,
  structured-log export, dashboards/alerts, load/long-Room proof, rollback, and
  production recovery evidence (`O4P-03D`);
- accounts, identity provider, password reset, admin token recovery, ban/kick,
  IP/device fingerprinting, CAPTCHA, matchmaking, lobby, chat, timers, UI,
  browser token storage, automatic rotation scheduling, and cross-Room quotas;
- a command allowlist below the existing Core command contract, new Room role,
  host gameplay privilege, table/spectator command authority, or any change to
  Core/Room/protocol/projection meaning.
