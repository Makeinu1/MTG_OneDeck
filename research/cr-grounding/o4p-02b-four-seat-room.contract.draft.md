# O4P-02B Four-seat Room contract

Status: frozen by the Sol judge for bounded implementation on 2026-08-12.

Base SHA: `62fd41918590de90165fdd3b982efe0032dd6ddb`

Grounding:

- `research/cr-grounding/o4p-01-to-05-rebaseline-2026-08-10.draft.md`
- `research/cr-grounding/o4p-01n-to-02e-forward-plan.draft.md`
- shipped O4P-01N public Core closure barrel
- shipped O4P-02A Solo/Core compatibility boundary

## Purpose and authority

O4P-02B adds a pure local Online Application Room envelope around the shipped
mode-neutral Core. It owns four application seats, participant presence,
readiness, host authority, start/activation state, player rejoin, and the
application reflection of Core concession/defeat.

The Room is not a second game reducer. Core player lifecycle remains
authoritative for concession and defeat. A connection loss changes Room
presence only. It MUST NOT mutate, replace, annotate, serialize into, or add
connection fields to `ModeNeutralCoreRootV1`.

O4P-02B is R3 because it adds an application schema and public boundary. It is
not CR adjudication and changes no Magic rule meaning.

## Version and identity boundary

Public constant: `ONLINE_ROOM_SCHEMA_VERSION_V1`, exact value `1`.

This additive Room schema is independent of Solo `SNAPSHOT_VERSION`, every
`CoreClosureVersionVectorV1` field, and shared state/event/protocol/projection
versions. O4P-02B changes none of them.

Room IDs and participant IDs are application identities. They are not aliases
for `CorePlayerId`. Each of four seats has one immutable, separately supplied
`CorePlayerId`; every player participant is linked to exactly one seat.

The V1 ID grammar for Room and participant IDs is
`[A-Za-z0-9][A-Za-z0-9._-]{0,79}` excluding the unsafe exact values
`__proto__`, `prototype`, and `constructor`. Values are case-sensitive and
MUST NOT be trimmed or normalized.

A seat capability is a caller-supplied opaque string matching
`[A-Za-z0-9_-]{32,128}`. Capabilities are case-sensitive, unique across the
four seats, never generated with an ambient RNG/clock, never copied into a
Core command/event/root, and never echoed in an error code, path, or message.
O4P-02D owns redaction from audience projections. O4P-02B returns no public
projection and makes no claim that the private Room state is audience-safe.

## Public module and exact state algebra

Implementation directory: `src/online/room/`.

Public barrel: `src/online/room/index.ts`. O4P-02B does not add or edit a
repository-wide `src/online/index.ts` barrel.

Public names include:

- `ONLINE_ROOM_SCHEMA_VERSION_V1`
- `OnlineRoomIdV1`, `OnlineRoomParticipantIdV1`,
  `OnlineRoomSeatCapabilityV1`
- `OnlineRoomParticipantRoleV1`, `OnlineRoomPresenceV1`,
  `OnlineRoomLifecycleV1`, `OnlineRoomSeatOutcomeV1`
- `OnlineRoomParticipantV1`, `OnlineRoomSeatV1`, `OnlineRoomV1`
- `OnlineRoomValidationIssueV1`, `OnlineRoomValidationResultV1`
- `validateOnlineRoomV1`, `createOnlineRoomV1`
- the operation inputs and functions named below
- `OnlineRoomCreationErrorV1`, `OnlineRoomOperationErrorV1`

`OnlineRoomParticipantRoleV1` is the closed union `player | table | spectator`.
Host is an orthogonal authority reference, not a fifth role: the immutable
`hostParticipantId` MUST reference a `player` participant occupying one of the
four seats. This permits the normal P1 host plus P2-P4 and one Table Display
without inventing a fifth game player.

`OnlineRoomLifecycleV1` is the closed ordered state machine:

```text
forming -> ready -> started -> active -> finished
```

`OnlineRoomPresenceV1` is `connected | disconnected`.
`OnlineRoomSeatOutcomeV1` is `pending | conceded | defeated`.

The exact `OnlineRoomV1` root fields, in order, are:

1. `kind: 'online-room-v1'`
2. `schemaVersion: 1`
3. `roomId`
4. `lifecycle`
5. `hostParticipantId`
6. `participants`
7. `seats`

The exact participant fields, in order, are `participantId`, `role`,
`presence`, and `seatIndex`. Player participants have a seat index 0 through
3. Table and spectator participants have `seatIndex: null`. Participant array
order is creation/join order and is never sorted.

The exact seat fields, in order, are `seatIndex`, `corePlayerId`,
`seatCapability`, `participantId`, `ready`, and `outcome`. `seats` is always a
dense four-element array in exact index order 0, 1, 2, 3. Core player IDs and
seat capabilities are unique. Seat index and Core player ID never change.

There may be at most one `table` participant and any number of spectators.
Participant IDs are globally unique within a Room. Every player participant
and occupied seat form a one-to-one relation. Empty seats have
`participantId: null`, `ready: false`, and `outcome: pending`.

Lifecycle invariants:

- `forming`: at least one seat is empty, disconnected, or not ready; every
  outcome is pending.
- `ready`: all four seats are occupied by connected player participants, all
  are ready, and every outcome is pending.
- `started`: the same four-seat roster was host-started; seats remain ready
  and pending, while later connection loss is allowed.
- `active`: activation was proved against one valid Core root with the exact
  four-player full lifecycle roster. Seats remain occupied; later Room
  presence is independent of Core lifecycle.
- `finished`: reconciliation proved that the valid Core root has at most one
  active player. Each exited Core player is reflected as `conceded` or
  `defeated`; the sole survivor, if any, remains pending.

An active Room may already contain reconciled terminal outcomes while more
than one Core player remains active. A Room never infers concession or defeat
from disconnection, readiness, time, host action, or participant removal.

## Validation and immutability

`validateOnlineRoomV1(unknown)` returns a closed result union:

- `{ ok: true, value }` with a fresh canonical deeply frozen Room; or
- `{ ok: false, issues }` with fresh deterministic deeply frozen issues.

Validation is exact-record, descriptor-safe, trap-safe, dense-array-safe,
complete where sibling values remain safely inspectable, and deterministic.
It invokes no getter and throws no raw error for hostile user data. Issue order
is UTF-16 code-unit path, then code. It rejects unknown/symbol fields, sparse
arrays, extra array properties, non-ordinary prototypes, accessors,
non-enumerable fields, duplicate IDs/capabilities/Core players, invalid
relations, and lifecycle-invariant mismatches.

Validation and operations never trim, sort, deduplicate, default, merge,
delete, or mutate caller input. Successful operations return a fresh deeply
frozen Room root; structural sharing of already frozen unchanged children is
allowed. Failed operations throw only the frozen typed Room error with
deterministic issues and leave the input by identity and value unchanged.

## Creation and participant operations

`createOnlineRoomV1` accepts exactly `roomId`, `seatAssignments`, and `host`.

- `seatAssignments` is a dense four-element array in exact seat-index order;
  each item contains `seatIndex`, `corePlayerId`, and `seatCapability`.
- `host` contains `participantId` and `seatCapability`. The capability MUST
  claim one configured seat. Creation links the host as a connected player,
  leaves that seat not ready, and returns lifecycle `forming`.
- No table/spectator is implicitly created.

`joinOnlineRoomV1(room, input)` accepts a closed union:

- player: `participantId`, `role: player`, and `seatCapability`;
- table/spectator: `participantId` and the exact role, with no capability.

A player join is allowed only in forming/ready, claims one empty matching
seat, and starts not ready. Joining another player while ready recalculates
the state from invariants; it cannot replace an occupied seat. A single table
or spectators may join while forming, ready, started, or active. No participant
may join after finished.

`disconnectOnlineRoomParticipantV1(room, participantId)` changes presence
only. Before start, disconnecting a player clears that seat's ready bit and
recalculates lifecycle to forming. At started/active it preserves the frozen
roster and readiness record. It never changes a Core root or a seat outcome.

`rejoinOnlineRoomPlayerV1(room, input)` accepts `participantId` and
`seatCapability`. It succeeds only for the same disconnected player/seat with
pending outcome. Wrong, reused, or cross-seat capability fails generically.
It cannot revive a conceded/defeated player or replace participant identity.
Observer reconnect authorization is DEFERred to O4P-02C; V1 observer
participants may disconnect but cannot rejoin through this player operation.

`setOnlineRoomPlayerReadyV1(room, input)` accepts `participantId`,
`seatCapability`, and `ready`. It is allowed only for a connected pending
player in forming/ready before start. Lifecycle is derived: exactly when all
four seats are occupied, connected, ready, and pending it becomes ready;
otherwise it is forming.

## Host start and Core activation

`startOnlineRoomV1(room, hostParticipantId)` requires the immutable host,
connected and still pending, and lifecycle ready. It returns started. Host
identity cannot be transferred in V1.

`activateOnlineRoomV1(room, input)` accepts exactly `hostParticipantId` and
`coreRoot`. It requires started, the connected immutable host, a valid
`ModeNeutralCoreRootV1`, and exact ordered equality between the Room seat Core
player IDs and the Core full `playerLifecycle.players` roster. All four Core
entries MUST be active with null exit cause. It stores no Core root, digest,
command, event, transport, or connection data and returns active.

## Core lifecycle reconciliation

`reconcileOnlineRoomCoreLifecycleV1(room, coreRoot)` is allowed only for an
active Room and a valid Core root whose complete lifecycle roster equals the
four immutable Room seat Core player IDs in order.

It derives each Room seat outcome solely from the matching Core lifecycle:

- Core `active/null` -> Room `pending`;
- Core `exited/concession` -> Room `conceded`;
- Core `exited/defeat` -> Room `defeated`.

Outcomes are monotonic. A previously terminal Room seat cannot become pending
or change cause, and any mismatch rejects atomically. If zero or one Core
players remain active, the returned lifecycle is finished; otherwise it stays
active. Connection presence is preserved.

The acceptance harness creates a normal public `CoreCommandV1` player-exit
command and applies it with `applyCoreCommandV1` outside the Room module, then
passes only the accepted result root into reconciliation. The Room module MUST
NOT call `applyCoreCommandV1`, inspect private command metadata, or manufacture
a Core exit.

## Explicit DEFERs and non-goals

O4P-02B does not add:

- ClientHello/ServerHello, command ID, revision, ACK/reject, deduplication,
  resync, Build ID, or any O4P-02C protocol behavior;
- audience projections, hidden-card allowlists, SearchSession projection,
  secret-safe logs, or any O4P-02D behavior;
- four-client/Table headless closure, WebSocket, Cloudflare Worker, Durable
  Object, SQLite, UI, routes, store wiring, browser behavior, or network I/O;
- capability generation, rotation, host transfer, player replacement,
  observer rejoin authorization, kick/ban, matchmaking, or room persistence;
- Core root/command/event changes, Solo reducer/snapshot changes, compatibility
  catalog changes, version bumps, dependencies, or package exports.

## Required evidence and release gate

The candidate requires:

- ordinary Room tests for canonical creation, all roles, readiness/state
  machine, disconnect/rejoin, wrong/cross-seat capability, start/activate,
  Core concession/defeat reconciliation, finish, immutability, and JSON round
  trip;
- hostile/property-style ordinary tests for exact records, dense arrays,
  traps, duplicates, complete deterministic issues, and secret-free errors;
- judge-owned review and architecture tests;
- a judge-owned four-seat Room fixture and offline verifier;
- O4P-01N closure and O4P-02A compatibility regression evidence;
- independent cold audit with BLOCKER/HIGH 0, then one fingerprint-matched
  `npm run check`, explicit-file commit with auditor ID, push, CI/Pages proof,
  and clean worktree.
