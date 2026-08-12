# O4P-02D Player, Table, and Spectator Projection contract

Status: judge-frozen implementation contract

Milestone: `O4P-02D`

Base SHA: `84edd7e0639d7f7ec4e239f5e522ca8fa5815af8`

Risk / audit lane: `R3 / BROAD`

Inputs:

- shipped O4P-01L Control, SearchSession, VisibilityGrant, PlayPermission, and
  DecisionAuthority APIs;
- shipped O4P-01N Mode-Neutral Core root and object/runtime registry;
- shipped O4P-02B Room roles, seats, presence, and capabilities;
- shipped O4P-02C protocol state, authentication, reconnect, revision, and
  metadata-only snapshot/resync operation.

This file freezes a local application projection only. It does not authorize a
network transport, Cloudflare runtime, persistence, browser store, or UI.

## Goal and trust boundary

Produce one deterministic, audience-specific snapshot from a canonical
`OnlineProtocolStateV1` without returning the Core root, Room capabilities,
observer authorizations, receipts, request digests, Core commands/events,
physical-card IDs, definition-record keys, or unauthorized hidden identities.

The full protocol state is trusted application-internal state. Projection
requests and separately received projections are hostile `unknown`. Only an
authenticated participant receives a projection. A player is a Core rules
viewer; Table and Spectator are observers, not additional Core players.

## Version and request

`ONLINE_PROJECTION_SCHEMA_VERSION_V1` is exactly `1`. It does not bump a
shared contract version. `protocolVersion` remains
`CURRENT_CONTRACT_VERSIONS.protocolVersion`, currently `1`.

`OnlineProjectionRequestV1` is the exact record:

```text
kind:                  "online-projection-request-v1"
protocolVersion:       1
roomId:                OnlineRoomIdV1
participantId:         OnlineRoomParticipantIdV1
participantCapability: seat or observer capability
knownRevision:         non-negative safe integer
clientBuildId:         BuildId
decisionContext:       CoreDecisionContextV1 | null
```

A decision context is the shipped exact `decision` or `search-session` union;
its optional `turnNumber`, when present, is a non-negative safe integer.
Absence and `null` are not interchangeable. No outside-game context exists.

`validateOnlineProjectionRequestV1(unknown)` is closed, descriptor-safe, and
returns a fresh deeply frozen value or deterministic frozen projection issues.
It never invokes a getter. A successful value retains the caller-supplied
capability because the typed request is the internal input to the authenticated
operation; a failed result never echoes it in issues or other public evidence.

## Projected snapshot operation

`handleOnlineProjectedSnapshotRequestV1(state, unknown)` performs:

1. validate/canonicalize the complete O4P-02C protocol state;
2. validate the exact projection request, with protocol mismatch selected
   before authentication-dependent evidence;
3. construct an exact capability-bearing O4P-02C snapshot request internally
   and call `handleOnlineSnapshotRequestV1` once;
4. preserve its generic authentication and authorized reconnect semantics;
5. on an accepted resync, build the projection from the returned state and
   authenticated participant role;
6. scan the public response and log against every configured seat/observer
   capability and fail closed with `PROJECTION_REJECTED` if any capability or
   capability substring would escape;
7. return the exact deeply frozen transition `{ state, response, log }`.

The operation always returns a current projection after successful
authentication, including when `knownRevision === revision`. Its `reason` is
the O4P-02C value `synchronized`, `snapshot-required`, or `rejoined`.
Reconnect may change only Room presence under the shipped protocol contract.
Projection never changes Core, revision, receipt order, seat outcome, or any
other Room field.

Malformed/authentication failures return a rejected projected-snapshot
response and the canonical unchanged state. Invalid protocol state throws the
typed `OnlineProjectionOperationErrorV1` with only generic frozen evidence.
If projection construction fails after an authorized reconnect, the rejoined
state is retained but no projection is returned.

## Response and safe log

`OnlineProjectedSnapshotAcceptedV1` is exactly:

```text
kind:               "online-projected-snapshot-v1"
protocolVersion:    1
status:             "accepted"
roomId
participantId
role
knownRevision
revision
serverBuildId
clientBuildIdMatch
reason
projection:         OnlineParticipantProjectionV1
issues:             []
```

The rejected member has the same `kind`, server protocol version, current
`revision`, and `serverBuildId`; `status` is `rejected`; `roomId`,
`participantId`, `role`, `knownRevision`, `clientBuildIdMatch`, `reason`, and
`projection` are all `null`; and `issues` contains only generic frozen
`OnlineProjectionIssueV1` values. It never reconstructs a command-style reject
or forwards a Core/Room/protocol thrown message.

`OnlineProjectionLogEntryV1` is exactly:

```text
kind:       "online-projection-log-v1"
status:     "accepted" | "rejected"
revision
role:       "player" | "table" | "spectator" | null
reason:     "synchronized" | "snapshot-required" | "rejoined" | null
issueCodes: readonly OnlineProjectionIssueCodeV1[]
```

The log contains no room/participant/object/card/definition/session/permission
ID, zone count, path, message, Build ID, capability, payload, digest, error
text, or stack. This milestone performs no ambient logging side effect; the
caller may emit only this returned safe value.

## Projection envelope and Room allowlist

`OnlineParticipantProjectionV1` is the exact record:

```text
kind:            "online-participant-projection-v1"
schemaVersion:   1
protocolVersion: 1
roomId
participantId
role
corePlayerId:    CorePlayerId | null
revision
room:            OnlineProjectedRoomV1
game:            OnlineProjectedGameV1
```

`corePlayerId` is the immutable seat player for role `player` and `null` for
Table/Spectator. The Room projection includes only lifecycle,
hostParticipantId, and ordered participant records
`{ participantId, role, presence, seatIndex }`, plus ordered seat records
`{ seatIndex, corePlayerId, participantId, ready, outcome }`. It omits every
seat/observer capability and every observer-authorization record.

## Public game allowlist

`OnlineProjectedGameV1` contains exactly:

```text
turnOrder:          readonly CorePlayerId[]
turn:               { activePlayerId, turnNumber, positionSequence, position }
players:            readonly OnlineProjectedPlayerV1[]
zones:              OnlineProjectedZonesV1
visibilityGrants:   readonly OnlineProjectedVisibilityGrantV1[]
searchSessions:     readonly OnlineProjectedSearchSessionV1[]
playPermissions:    readonly OnlineProjectedPlayPermissionV1[]
```

Players and player-zone groups are in Core `turnOrder`. A projected player
contains its Core player ID, the exact public scalar resource/state fields
(`life`, poison, energy, experience, mana pool, mulligan/draw/land/spell
counts, maximum hand-size override), plus lifecycle status and exit cause.
The turn projection contains no priority-window object IDs, pending triggers,
stack announcements, command data, or decision authority record.

Zones preserve canonical Core order. Each zone is exactly `{ count, entries }`
and `count === entries.length`. `byPlayer` is an ordered array rather than a
record keyed by attacker-controlled IDs. Shared zones are battlefield, stack,
exile, and command. The three closed entry variants are:

```text
{ kind: "hidden-card" }
{ kind: "concealed-object", objectId, objectKind, runtime }
{ kind: "visible-object", objectId, objectKind, ownerPlayerId,
  controllerPlayerId, commander, definition, runtime }
```

`hidden-card` exposes neither an object ID nor runtime and is used for every
unauthorized hand/library identity. `concealed-object` is used only for a
trackable object in a public zone whose identity is hidden (for example a
face-down battlefield/stack/exile object). It exposes the canonical game
object ID and public object-kind/runtime facts but no physical-card ID,
definition ID/snapshot, owner, controller, copy/source/origin, or ability key.

`visible-object` contains a full copied Core card-definition snapshot when the
object has one, otherwise `definition: null`; normalized owner/effective
controller or `null`; and `commander` derived from the root Commander identity
registry rather than the raw physical-card flag, without exposing the physical
card ID. Activated/triggered abilities retain their identity controller even
though they are not targets of ControlEffect.
Its `runtime` is the projected runtime when Core has runtime for that object and
is `null` for stack ability/copy objects without a runtime row. Projection must
not invent default runtime. It never returns the raw Core object-identity union.

Projected runtime contains public counters/damage and an attachment union of
`none`, `player`, `object`, or `concealed`. A visible object may include its
actual face index and flipped flag. A concealed object uses `faceIndex: null`
and `flipped: null`, while retaining public face-down/tapped/phased-out,
counter/damage, and safely projected attachment facts. An object attachment
target becomes `concealed` when its object ID has no public handle for this
audience.

## Audience visibility decisions

For a player request, the effective rules-viewer set starts with that player's
seat Core player. When a non-null request decision context makes that player
the result of `coreDecisionMakerForV1` for another controlled player, that
controlled player is added for that context only. Projection grants the union
of identity information visible to those effective rules viewers through the
shipped `coreCanPlayerViewObjectIdentityV1` query, including authorized open
SearchSession candidates. It does not persist a past grant or infer a new one.

Thus:

1. a player's own hand is visible; every library is hidden by default;
2. face-up battlefield/stack/exile and graveyard/command identities are
   visible;
3. face-down battlefield/stack identity is visible only to its effective
   controller; face-down exile requires an applicable grant/search rule;
4. open search candidates are visible only to their rules actor/selector or
   the exact applicable decision maker;
5. controlled-player information is exposed only for the supplied matching
   in-game decision context;
6. Table and Spectator receive the same public-information identity boundary:
   default public face-up objects plus only `mode: reveal`,
   `audience: all-players` grants. They never inherit own-hand, controller,
   selector, look, permission, or decision-maker visibility.

Table and Spectator projections are structurally distinct only by `role`; they
must be byte-equivalent in `game` for the same state and revision.

## VisibilityGrant, SearchSession, and PlayPermission surfaces

Visibility grants preserve Core grant order after filtering. A player receives
only grants applicable to at least one effective rules viewer; an entry names
the ordered `effectiveForPlayerIds`, mode, safe subject, and normalized
duration. Table/Spectator receive only all-player reveal entries with an empty
effective-player list. Raw grant keys, source object IDs, and source-bound
duration IDs are omitted; source-bound duration is the literal
`{ kind: "source-bound" }`.

A player receives only an open SearchSession in which it is rules actor or
selector, or the request's exact search decision context makes it the decision
maker for that session's rules actor. The projected entry preserves the
session ID, rules actor, selector, zone, portion, criteria, reveal/shuffle
flags, and ordered candidates. Every candidate is a `visible-object`; a
candidate that cannot be safely materialized makes projection fail closed.
Table/Spectator receive an empty session array and cannot learn session
existence, count, IDs, criteria, or candidates.

A player receives only currently attemptable PlayPermissions for its own or an
applicably controlled player, evaluated by
`coreCanPlayerAttemptPlayObjectV1`. Object-subject permission is emitted only
when the subject identity is visible. Top-of-library permission may be emitted
without revealing identity; its `topObjectId` is `null` unless that exact top
object is independently visible. Entries contain permission ID, allowed
player, action, safe subject, and normalized duration; source object IDs are
omitted. This remains attempt-only, not full timing/type/cost/legality.
Table/Spectator receive an empty permission array.

## Validation, secrecy, and immutability

`validateOnlineParticipantProjectionV1(unknown)` validates the complete closed
wire shape and internal relations: versions; role/core-player relation; Room
participant/seat coverage; turn/player/zone ordering; zone count/entry parity;
unique zone object handles; search-candidate handle coverage; safe duration,
subject, definition, runtime, and filtered-role forms. It does not claim to
reconstruct authorization without the source state; the projection operation
owns that proof.

All new validators are exact-record, own-key/descriptor based, getter-free,
trap-safe, dense-array-safe, and non-ordinary-prototype rejecting. They reject
unknown/symbol/accessor/non-enumerable fields, sparse or extra-property arrays,
invalid IDs/integers/literals, duplicates, and relation drift. Issues are
complete for safely inspectable siblings and sorted by UTF-16 code-unit path,
then code, then message after redaction.

No validator or operation trims, sorts caller arrays, deduplicates, defaults,
merges, deletes, or mutates input. Canonical outputs, definitions, runtime,
issues, responses, logs, and transitions are fresh and deeply frozen; already
canonical protocol state may be structurally shared.

Every public response, failed validation result, typed error, and log must
serialize without any configured capability literal or substring, unauthorized
card/face/oracle
sentinel, physical-card ID, hidden definition ID, Core root/event/warning/
issue text, receipt/digest, raw thrown text, or stack. Capability-shaped data
in any would-be public projection field causes generic fail-closed rejection,
not string substitution or partial projection.

No ambient time, RNG, locale, environment, network, storage, DOM, React, or
Zustand value may affect projection.

## Public module boundary

Implementation is additive under `src/online/projection/**`, with one local
public barrel `src/online/projection/index.ts`. It may import only the public
Core, Room, protocol, and versioning barrels plus sibling projection modules.
It may query Core but must not call a Core reducer or any mutation operation.
Core, Room, and protocol cannot import projection. No repository-wide
`src/online/index.ts` is created.

The runtime public surface is exact:

```text
ONLINE_PROJECTION_SCHEMA_VERSION_V1
validateOnlineProjectionRequestV1
validateOnlineParticipantProjectionV1
handleOnlineProjectedSnapshotRequestV1
OnlineProjectionOperationErrorV1
```

The local barrel also exports every named V1 request, projection, response,
log, issue, validation-result, and transition type in this contract, and no
unversioned alias or internal helper.

## Explicit DEFER / non-goals

No WebSocket/HTTP/Worker/Durable Object/Cloudflare/SQLite transport, persistence,
reconnect timeout, capability issuance/rotation, encryption, rate limiting,
telemetry sink, Solo/store/UI/Table screen, command creation, search UI,
selection completion, movement, shuffle, reveal event, play legality, hidden
information memory policy, or shared version bump. O4P-02E owns the four-local-
client plus Table headless composition gate; O4P-03 owns transport.
