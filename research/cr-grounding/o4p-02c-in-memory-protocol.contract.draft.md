# O4P-02C In-memory Protocol & Command Envelope contract

Status: judge-frozen implementation contract

Milestone: `O4P-02C`

Base SHA: `64eb31e2ff5cd276e8bb73ea835d51a34c3b5ef1`

Risk / audit lane: `R3 / BROAD`

Inputs:

- shipped O4P-01N public Mode-Neutral Core root, command, result, digest, and
  reducer APIs;
- shipped O4P-02B four-seat Room and participant lifecycle APIs;
- shipped `CURRENT_CONTRACT_VERSIONS` and `BuildId` validation.

This file freezes application protocol semantics only. It does not authorize a
network transport, projection, UI, store, snapshot persistence, or Cloudflare
runtime.

## Goal and trust boundary

Provide one deterministic in-memory server state and closed message algebra for
ClientHello, ServerHello, command envelope, ACK/reject, command-ID
deduplication, stale revision rejection, snapshot request, resync, Build ID
diagnostics, and authorized reconnect.

The protocol state is trusted application-internal state. Client inputs are
hostile `unknown`. Public responses are metadata-only. They MUST NOT contain a
Core root, Core event, Core warning, Core issue text, Room object, seat
capability, observer capability, command payload, canonical digest, or hidden
card/object value. Audience-specific snapshot data belongs to O4P-02D.

## Version decision

- `ONLINE_PROTOCOL_SCHEMA_VERSION_V1` is exactly `1`.
- Every V1 message `protocolVersion` is exactly
  `CURRENT_CONTRACT_VERSIONS.protocolVersion`, currently `1`.
- O4P-02C does not bump any shared version and does not implement ranges,
  downgrade, feature negotiation, or projection negotiation.
- A protocol mismatch rejects before authentication-dependent evidence.
- `serverBuildId` and `clientBuildId` use the shipped `validateBuildId` grammar.
  Equality is diagnostic only. A valid mismatch never rejects, authenticates,
  orders, deduplicates, changes revision, or changes compatibility semantics.

## IDs, capabilities, and revisions

- `OnlineProtocolCommandIdV1` is a branded string matching
  `[A-Za-z0-9][A-Za-z0-9._-]{0,79}` and excludes `__proto__`, `prototype`, and
  `constructor`.
- A revision is a non-negative safe integer. It contains no timestamp, random
  value, card/object identity, digest fragment, or other hidden data.
- The only revision source of truth is the accepted Core command count. Every
  valid protocol state satisfies
  `revision === coreRoot.acceptedCommandCount`.
- State creation derives revision from the supplied canonical Core root. Each
  accepted or accepted-with-warning Core command advances it by exactly one.
  Every other path leaves it unchanged.
- Player protocol authentication reuses the immutable O4P-02B seat capability.
- Each table/spectator has one pre-supplied observer capability matching the
  O4P-02B capability grammar. Observer capabilities are protocol state, never
  Room or Core state. They are unique across one another and across all seat
  capabilities.
- Client messages use the role-neutral field `participantCapability`. The
  server derives the participant role from Room state; the client cannot
  choose or change it.
- No capability is generated, rotated, defaulted, trimmed, logged, returned, or
  embedded in an ID, revision, issue, error message, digest, or receipt.

## Canonical server state

`OnlineProtocolStateV1` is the exact deeply frozen record:

```text
kind:              "online-protocol-state-v1"
schemaVersion:     1
protocolVersion:   CURRENT_CONTRACT_VERSIONS.protocolVersion
serverBuildId:     BuildId
room:              OnlineRoomV1
coreRoot:          ModeNeutralCoreRootV1
revision:          non-negative safe integer
observerAuthorizations: dense ordered OnlineProtocolObserverAuthorizationV1[]
receipts:          dense ordered OnlineProtocolCommandReceiptV1[]
```

An observer authorization is exactly `participantId` and
`observerCapability`. There is exactly one authorization for every table or
spectator in Room participant order and none for a player. State creation
requires an active Room whose ordered seat Core player roster exactly matches
the supplied valid Core root and whose outcomes match it. It accepts exactly
`serverBuildId`, `room`, `coreRoot`, and `observerAuthorizations`; derives the
other fields; and begins with an empty receipt list.

`validateOnlineProtocolStateV1(unknown)` validates the complete state,
including Room/Core validity, version equality, revision equality, observer
coverage/uniqueness, receipt uniqueness, receipt/result relations, and Room/Core
lifecycle consistency. A finished state is valid after accepted Core exit
reconciliation, but new state creation requires active.

Receipts are append-only in request-processing order. The composite key is
`participantId + commandId`; string concatenation is not used as an object key.
Each receipt stores exactly the participant ID, command ID, a deterministic
request digest which excludes `participantCapability`, and a frozen terminal
outcome sufficient to reconstruct an ACK/reject. It stores no full envelope,
capability, Core root/result/event/warning/issue, Room, or client-visible
snapshot. O4P-02C has no eviction, pruning, TTL, or persistence semantics.

## Closed client messages

`OnlineClientHelloV1` is exactly:

```text
kind:                  "online-client-hello-v1"
protocolVersion:       1
roomId:                OnlineRoomIdV1
participantId:         OnlineRoomParticipantIdV1
participantCapability: seat or observer capability
clientBuildId:         BuildId
```

`OnlineCommandEnvelopeV1` is exactly:

```text
kind:                  "online-command-envelope-v1"
protocolVersion:       1
roomId:                OnlineRoomIdV1
participantId:         OnlineRoomParticipantIdV1
participantCapability: seat capability
commandId:             OnlineProtocolCommandIdV1
baseRevision:          non-negative safe integer
command:               CoreCommandV1
```

`OnlineSnapshotRequestV1` is exactly:

```text
kind:                  "online-snapshot-request-v1"
protocolVersion:       1
roomId:                OnlineRoomIdV1
participantId:         OnlineRoomParticipantIdV1
participantCapability: seat or observer capability
knownRevision:         non-negative safe integer
clientBuildId:         BuildId
```

Every input has a dedicated exported closed validator. Validators return a
fresh frozen success value or deterministic frozen protocol issues. Operations
also accept `unknown` and never require an unsafe cast by callers.

## Public responses

`OnlineServerHelloV1` is an exact closed union with common fields `kind:
online-server-hello-v1`, `protocolVersion`, `status`, `revision`, and
`serverBuildId`.

- accepted contains validated `roomId`, `participantId`, derived `role`,
  `clientBuildIdMatch`, and an empty issue array;
- rejected contains null `roomId`, `participantId`, `role`, and
  `clientBuildIdMatch`, plus only frozen protocol issues.

`OnlineCommandAckV1` is exactly:

```text
kind:             "online-command-ack-v1"
protocolVersion:  1
roomId
participantId
commandId
baseRevision
acceptedRevision
currentRevision
status:           "accepted" | "accepted-with-warning"
duplicate:        boolean
```

`OnlineCommandRejectV1` is exactly:

```text
kind:             "online-command-reject-v1"
protocolVersion:  1
roomId:           validated room ID or null
participantId:    validated participant ID or null
commandId:        validated command ID or null
baseRevision:     validated revision or null
currentRevision
duplicate
resyncRequired
issues:           deterministic frozen OnlineProtocolIssueV1[]
```

`OnlineResyncV1` is metadata-only and exactly:

```text
kind:                "online-resync-v1"
protocolVersion:     1
roomId
participantId
role
knownRevision
revision
serverBuildId
clientBuildIdMatch
reason:              "synchronized" | "snapshot-required" | "rejoined"
projectionRequired:  boolean
```

`projectionRequired` is true exactly when `knownRevision !== revision`.
O4P-02C never labels raw Core state as a snapshot. O4P-02D will attach the
audience projection to this already-authenticated control-plane result.

Every handler returns a deeply frozen `OnlineProtocolTransitionV1<Response>`
containing exact fields `state` and `response`. It never mutates its input.
Rejected paths that append no receipt return the identical state object.

## Protocol issue algebra and secrecy

The public issue codes are closed:

```text
INVALID_ROOT, MISSING_FIELD, UNKNOWN_FIELD, INVALID_DESCRIPTOR, INVALID_TYPE,
INVALID_LITERAL, INVALID_VERSION, INVALID_ID, INVALID_CAPABILITY,
INVALID_INTEGER, INVALID_ARRAY, NON_DENSE_ARRAY, INVALID_BUILD_ID,
INVALID_PROTOCOL_STATE, PROTOCOL_VERSION_MISMATCH, ROOM_MISMATCH,
AUTHORIZATION_REJECTED, PARTICIPANT_NOT_CONNECTED, ROLE_NOT_ALLOWED,
ROOM_NOT_ACTIVE, PLAYER_NOT_PENDING, ACTOR_MISMATCH,
COMMAND_SEQUENCE_MISMATCH, COMMAND_ID_REUSE_MISMATCH, STALE_REVISION,
CORE_COMMAND_REJECTED, CORE_RECONCILIATION_REJECTED
```

Public paths and messages use schema field names and generic descriptions only.
They never forward or interpolate Room/Core issue code, path, message, value,
payload, ID, digest, capability, thrown error text, or `Error.stack`.
Capability-shaped runs are redacted from issue code/path/message before sort and
freeze, including hostile unknown property keys when capability extraction is
unavailable. Authentication failure is always the same
`AUTHORIZATION_REJECTED` shape for missing participant, wrong role credential,
wrong seat, wrong observer capability, or terminal-player rejoin.

## Hello and reconnect operation

`handleOnlineClientHelloV1(state, unknown)` performs:

1. closed state/input and exact protocol/build validation;
2. generic Room/participant/capability authentication;
3. if already connected, no Room change;
4. if a disconnected pending player, call the public
   `rejoinOnlineRoomPlayerV1` with its authenticated seat capability;
5. if a disconnected table/spectator, reconnect presence only after its exact
   observer capability matches, then revalidate through the public Room
   validator;
6. return accepted ServerHello with current revision and Build ID equality.

Reconnect never changes Core, revision, seat outcome, readiness, host, role,
participant order, receipt order, or command history. It cannot revive a
conceded/defeated player. A valid client/server Build ID mismatch still accepts.

## Command handling and deterministic precedence

`handleOnlineCommandEnvelopeV1(state, unknown)` uses this fail-closed order:

1. validate state and exact envelope, including the nested public Core command;
2. reject protocol version mismatch without authentication-dependent detail;
3. authenticate exact room, participant, connected presence, and capability;
4. look up `(participantId, commandId)` before stale-revision evaluation;
5. same key plus same capability-excluded canonical request digest returns the
   stored terminal outcome with `duplicate: true`, performs no Core application,
   appends no receipt, and reports the current state revision;
6. same key plus different digest rejects `COMMAND_ID_REUSE_MISMATCH` without
   replacing/appending a receipt or applying Core;
7. require active Room, connected pending player role, command actor equal to
   that player's immutable seat Core player, and
   `command.sequence === baseRevision + 1`;
8. require `baseRevision === state.revision`; otherwise append one stale reject
   receipt and return `STALE_REVISION` with `resyncRequired: true`;
9. call the shipped public `applyCoreCommandV1` exactly once;
10. for a Core reject, append one generic `CORE_COMMAND_REJECTED` receipt,
    preserve Room/Core/revision, and return `resyncRequired: false`;
11. for Core accepted/accepted-with-warning, reconcile the returned root through
    `reconcileOnlineRoomCoreLifecycleV1`, then atomically store the returned
    Core root, reconciled Room, incremented revision, and one ACK receipt;
12. if reconciliation fails, preserve the pre-command state and return only
    `CORE_RECONCILIATION_REJECTED`; never expose the accepted transient root.

An ACK exposes the Core result status but not warning or event content. A
duplicate ACK preserves original base/accepted revision and status while
setting current revision from the present state. An exact duplicate of a stored
reject reconstructs the same issues/resync flag with `duplicate: true`.

Malformed/protocol/auth/role/actor/sequence/ID-reuse failures append no receipt.
Authenticated stale and Core-terminal outcomes append exactly one receipt so an
exact retry remains deterministic. No failure mutates Room/Core/revision.

## Snapshot request and resync

`handleOnlineSnapshotRequestV1(state, unknown)` validates and authenticates by
the same generic rules as hello. It may perform the same authorized reconnect.
It returns metadata-only `OnlineResyncV1`:

- `reason: rejoined` if presence changed;
- otherwise `synchronized` when `knownRevision === revision`;
- otherwise `snapshot-required`.

The operation never applies Core, appends a receipt, changes revision, or
returns state/projection data. Wrong or malformed credentials return a closed
command-style reject with null command/base fields and generic evidence.
Stale command rejection plus a valid snapshot request is the required V1
resync path.

## Validation, determinism, and immutability

All new validation is exact-record, own-key and descriptor based, getter-free,
trap-safe, dense-array-safe, non-ordinary-prototype rejecting, complete for
safely inspectable siblings, and deterministic. It rejects unknown/symbol
fields, accessors, non-enumerable fields, sparse/extra-property arrays,
duplicates, unsafe IDs, invalid relations, and non-finite/unsafe revisions.

Issue order is UTF-16 code-unit path then code after redaction. Validators and
operations never trim, sort caller arrays, deduplicate, default, merge, delete,
or mutate input. Canonical success values, transitions, responses, receipts,
and error evidence are fresh and deeply frozen; structural sharing of already
frozen trusted state children is allowed.

No ambient time, RNG, locale, environment, network, storage, DOM, React, or
Zustand value may affect results. Request digests use the shipped public Core
canonical digest over a capability-free exact record and are internal only.

## Public module boundary

Implementation is additive under `src/online/protocol/**` with one local public
barrel `src/online/protocol/index.ts`. It may import only:

- the public `src/engine/core/index.ts` barrel;
- the public `src/online/room/index.ts` barrel;
- the public `src/versioning/index.ts` barrel;
- sibling protocol modules.

The protocol may call the Core reducer only in the command handler. Room remains
unable to call the Core reducer; architecture evidence must inspect original
imported symbols, including aliases/namespaces/dynamic forms, rather than raw
source spelling. No repository-wide `src/online/index.ts` is created.

The runtime public surface is exact:

```text
ONLINE_PROTOCOL_SCHEMA_VERSION_V1
isOnlineProtocolCommandIdV1
validateOnlineClientHelloV1
validateOnlineCommandEnvelopeV1
validateOnlineSnapshotRequestV1
validateOnlineProtocolStateV1
createOnlineProtocolStateV1
handleOnlineClientHelloV1
handleOnlineCommandEnvelopeV1
handleOnlineSnapshotRequestV1
OnlineProtocolCreationErrorV1
OnlineProtocolOperationErrorV1
```

The local barrel also exports every named V1 protocol/state/message/response/
transition/issue/input type required to call those functions, but no internal
redaction, descriptor-reading, digest, receipt-construction, authentication, or
Room-rewrite helper. `createOnlineProtocolStateV1(unknown)` is the state factory
described above. The three validators accept `unknown`; the state validator and
factory are separate APIs. All three handlers accept `(state: unknown,
message: unknown)` and either return the closed transition or throw only the
frozen `OnlineProtocolOperationErrorV1`. The factory throws only the frozen
`OnlineProtocolCreationErrorV1`. Typed errors expose only the redacted frozen
protocol issues.

## Explicit DEFERs and non-goals

O4P-02C does not add:

- audience projections, hidden-zone allowlists, SearchSession/VisibilityGrant/
  PlayPermission projection, projected snapshots, public Core events/warnings,
  or O4P-02D privacy/log behavior;
- the O4P-02E four-client/Table closure harness;
- WebSocket, fetch, Cloudflare Worker, Durable Object, SQLite, hibernation,
  network framing, transport retry, outbox, persistence, snapshot storage,
  reconnect after process loss, deployment recovery, timers, TTL, receipt
  pruning, rate limiting, kick/ban, matchmaking, or abuse controls;
- capability generation/rotation, participant/host replacement, dynamic Room
  roster edits after protocol state creation, or protocol downgrade;
- Core schema/root/command/result/event/replay changes, Room schema changes,
  Solo/store/snapshot/UI/router changes, dependency changes, or shared version
  bumps.

## Required evidence and release gate

Judge-owned acceptance must prove at least:

1. exact version/build/hello behavior, including accepted Build ID mismatch and
   rejected protocol mismatch;
2. player plus table/spectator authentication, disconnected rejoin, and no
   Core/revision change from hello/resync;
3. one accepted player command, exact ACK/revision, actor binding, and Room
   lifecycle reconciliation;
4. exact duplicate executes Core once and reconstructs ACK; same command ID
   with different digest rejects;
5. stale revision appends one reject receipt, exact retry is duplicate, and the
   snapshot request returns the correct resync metadata;
6. Core rejection is atomic and generic; public message serialization contains
   no capability, Core root/event/warning/issue text, Room, command payload, or
   hidden object value;
7. hostile descriptor/ownKeys/symbol/sparse/extra-key inputs fail closed with
   deterministic complete deeply frozen issues and untouched input;
8. state validator rejects revision/Core-count drift, observer coverage drift,
   duplicate receipt keys, and malformed stored outcomes;
9. architecture/import/version/non-network boundaries and the prior Room
   reducer-alias gate fail closed;
10. existing O4P-01N, O4P-02A, and O4P-02B verifiers remain green.

Independent cold audit must report BLOCKER/HIGH 0 on one frozen fingerprint.
Only then may the judge run the fingerprint-matched full `npm run check`, record
findings, commit, push, verify CI/Pages, and mark both ledger collections
`shipped`.
