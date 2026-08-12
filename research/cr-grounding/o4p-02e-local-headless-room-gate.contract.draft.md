# O4P-02E Local four-client plus Table headless room gate contract

Status: judge-frozen implementation contract

Milestone: `O4P-02E`

Base SHA: `19bb9cbe6b1792d6ba0aad6960d7c539c472df0b`

Risk / audit lane: `R3 / BROAD`

Inputs:

- shipped O4P-01N four-player Core command, digest, journal, replay, and
  headless-closure APIs;
- shipped O4P-02A Core/Solo compatibility and parity evidence;
- shipped O4P-02B four-seat Room lifecycle and participant capabilities;
- shipped O4P-02C in-memory protocol authentication, revision, deduplication,
  stale rejection, snapshot, and reconnect operations;
- shipped O4P-02D audience projection and secret-safe response/log boundary.

This file freezes a local deterministic composition gate. It does not
authorize Cloudflare, Worker, Durable Object, SQLite, WebSocket, persistence,
browser store, UI, network I/O, clock, timer, ambient randomness, or a root
`src/online/index.ts` barrel.

## Goal and authority boundary

Run exactly four local Player clients and one Table Display through one fresh
active in-memory protocol state and one explicit serial action script. Every
action must traverse the shipped Room, protocol, and projection public
operations. The protocol state returned by those operations is the only game
and Room authority. The gate may replay accepted unique Core commands through
the shipped pure Core headless-closure API only as verification; replay output
must never replace or repair protocol state.

The complete transition state is trusted application-internal evidence and may
contain capabilities and hidden Core data. Only the returned `report` is a
public-safe artifact. Callers must not publish or aggregate the internal state,
credentials, per-audience projections, receipts, commands, or operation
responses.

## Version and input

`ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1` is exactly `1`. It does not bump
any shared contract version. Protocol and projection remain at their shipped
version `1`.

`OnlineHeadlessRoomGateClientV1` is the exact record:

```text
participantId
participantCapability
clientBuildId
```

`OnlineHeadlessRoomGateInputV1` is the exact record:

```text
kind:          "online-local-headless-room-gate-input-v1"
schemaVersion: 1
state:         OnlineProtocolStateV1
clients:       readonly OnlineHeadlessRoomGateClientV1[]
actions:       readonly OnlineHeadlessRoomGateActionV1[]
```

The canonical starting state is active, revision `0`, and has no receipts. Its
Room contains exactly the four seated Player participants and exactly one
Table participant, all connected, with no Spectator. `clients` contains exactly
those five participants: the seats' Core player IDs are exactly
`P1`, `P2`, `P3`, `P4` in seat-index order, and clients are those Players in
that order followed by Table. Each capability authenticates the matching
participant in the starting state; no capability or participant appears twice.
Every starting seat is `ready: true` with `outcome: pending`, and the Core
player lifecycle contains exactly active P1-P4 in that order. Thus malformed or
already-exited starting authority rejects as `INVALID_RELATION` during input
validation rather than surfacing later as a replay failure.

The closed action union is:

```text
{ kind: "client-hello", participantId }
{ kind: "disconnect", participantId }
{ kind: "command", participantId, commandId, baseRevision, command }
{ kind: "projection", participantId, knownRevision, decisionContext }
```

`command` is the shipped exact `CoreCommandV1`. `decisionContext` is the
shipped exact Core decision/search context or `null`. A command action may
name Table so the shipped protocol can prove role rejection; the gate never
manufactures a Player capability for Table. Actions contain no capability or
Build ID. Action order is preserved and is the only scheduler. The action
array contains at most 256 entries; oversized hostile array lengths reject as
`INVALID_ARRAY` before any per-index loop. The same bounded inspection applies
the exact known maxima to the five-client and fixed report arrays.

`validateOnlineHeadlessRoomGateInputV1(unknown)` is closed,
descriptor-safe, getter-free, trap-safe, and returns a fresh deeply frozen
canonical value or deterministic, complete, deeply frozen issues. It rejects
accessors, symbols, non-enumerable/unknown fields, non-ordinary prototypes,
sparse or extra-property arrays, invalid scalars, invalid nested state/command/
context, client-order/set drift, and capability mismatch. A successful value
retains capabilities solely for internal authentication. Failed validation,
thrown errors, paths, messages, and all other public evidence never echo a
capability or a configured capability substring.

`OnlineHeadlessRoomGateIssueCodeV1` is the exact closed union:

```text
INVALID_ROOT | MISSING_FIELD | UNKNOWN_FIELD | INVALID_DESCRIPTOR |
INVALID_TYPE | INVALID_LITERAL | INVALID_VERSION | INVALID_ID |
INVALID_CAPABILITY | INVALID_INTEGER | INVALID_ARRAY | NON_DENSE_ARRAY |
INVALID_BUILD_ID | INVALID_PROTOCOL_STATE | INVALID_CLIENT_SET |
INVALID_ACTION | INVALID_RELATION | COMPOSITION_REJECTED |
COVERAGE_MISSING | PRIVACY_REJECTED | REPLAY_MISMATCH
```

An issue is exactly `{ code, path, message }`. Paths contain only frozen
contract field names/indices; a capability-shaped or capability-containing
unknown key is represented as `/<unknown-field>`. Messages are stable generic
English text and never embed received scalar values or nested diagnostics.

## Serial operation

`runLocalOnlineHeadlessRoomGateV1(unknown)` performs the following, without an
ambient side effect:

1. validate/canonicalize the complete input and preserve its starting Core
   root plus empty accepted-command verification list;
2. resolve every action's credential by exact participant ID;
3. for `client-hello`, construct the exact shipped hello request and call
   `handleOnlineClientHelloV1` once;
4. for `disconnect`, call `disconnectOnlineRoomParticipantV1`, construct an
   otherwise unchanged protocol-state candidate, and canonicalize it through
   `validateOnlineProtocolStateV1`; Core root, revision, receipt history,
   seats, roles, and outcomes must not change;
5. for `command`, construct one exact shipped command envelope and call
   `handleOnlineCommandEnvelopeV1` once. A Table credential is passed as-is as
   hostile unknown and must be rejected by the shipped protocol. Append only a
   nonduplicate accepted command to the verification list;
6. for `projection`, construct one exact shipped projection request and call
   `handleOnlineProjectedSnapshotRequestV1` once. Validate each accepted
   projection again with `validateOnlineParticipantProjectionV1`;
7. after every call, scan the complete public response and any projection log
   against every configured seat/observer capability. Any full capability or
   any contiguous capability fragment of at least eight UTF-16 code units in
   public evidence fails closed;
8. after the script, run the accepted unique command list from the original
   Core root through `runOrdinaryFourPlayerCoreClosureV1`, replay its package
   through `replayCoreCommandsV1`, and require both final Core digests to equal
   the authoritative final protocol Core digest;
9. require every non-vacuous coverage clause below, build one exact safe
   report, scan it against every capability and every at-least-eight-code-unit
   fragment, validate it, and return the exact
   deeply frozen `{ state, report }` transition.

Expected stale, duplicate, role, authentication, or Core command rejection is
recorded from the shipped response and leaves authority with the returned
protocol state. An invalid starting/input value, unexpected composition
failure, incomplete coverage, privacy failure, or replay mismatch throws
`OnlineHeadlessRoomGateOperationErrorV1`. Its name, code, issues, message, and
enumerable data are generic, deterministic, deeply frozen where applicable,
and capability/hidden-data safe. Raw Core/Room/protocol/projection errors,
messages, paths, values, stacks, and response payloads are never forwarded.

## Reconnect and command semantics

A reconnect is counted only when the script first disconnects that participant
and a later accepted projected snapshot reports shipped reason `rejoined`.
The successful rejoin may change only Room presence. At least one Player and
the Table must independently satisfy this path.

A duplicate is counted only when an exact previously handled command envelope
returns an accepted response with `duplicate: true`; it must not change Core,
revision, or receipts. A stale rejection is counted only for shipped issue
`STALE_REVISION` with `resyncRequired: true`, followed later by an accepted
projection for the same participant at the current revision. A role rejection
is counted only for a Table command rejected before Core. At least one other
non-stale rejected Player command must prove that rejection does not advance
the revision. At least two distinct unique commands must be accepted so replay
order is non-vacuous. A stale envelope's Core command sequence still equals
its stale `baseRevision + 1`; it must reach `STALE_REVISION`, not fail the
earlier command-sequence boundary.

## Public-safe report

`OnlineHeadlessRoomGateReportV1` is the exact record:

```text
kind:              "online-local-headless-room-gate-report-v1"
schemaVersion:     1
protocolVersion:   1
roomId
initialRevision:   0
finalRevision
finalRoomLifecycle: "active" | "finished"
clients:           readonly OnlineHeadlessRoomGateReportClientV1[]
counts:            OnlineHeadlessRoomGateCountsV1
coverage:          OnlineHeadlessRoomGateCoverageV1
deferred:          readonly ["cloudflare", "worker", "durable-object",
                   "sqlite", "websocket", "persistence", "ui"]
```

Report clients are in Player seat order then Table and contain exactly
`{ participantId, role, corePlayerId, presence }`. Player `corePlayerId` is its
immutable literal `P1`, `P2`, `P3`, or `P4` at that array position; Table uses
`null`. No credential, Build ID, projection,
zone/card/object/definition/session/permission data, Core command/event/result,
receipt, request digest, Core digest, issue path/message, error text, or stack
is present.

Counts are exact non-negative safe integers:

```text
clientHellosAccepted
clientHellosRejected
commandsAccepted
commandsRejected
commandDuplicates
staleRevisionRejections
roleRejections
projectionsAccepted
projectionsRejected
disconnects
playerRejoins
tableRejoins
```

`commandsAccepted` counts only nonduplicate ACKs and each advances revision by
one. `commandDuplicates` counts duplicate ACKs separately and never advances
revision. `commandsRejected` counts every command rejection;
`staleRevisionRejections` and `roleRejections` are subsets of it.
`playerRejoins` and `tableRejoins` are subsets of accepted projections.
Consequently `finalRevision === commandsAccepted`, every subset count is no
greater than its parent, and the gate operation derives coverage from its
internal per-participant/per-action witness sets rather than counts alone.
`acceptedCommand` additionally requires `commandsAccepted >= 2`.

Coverage is the exact closed record below, and a successful report requires
every value to be literal `true`:

```text
fourPlayers
tableDisplay
allClientHellos
allClientProjections
acceptedCommand
rejectedCommand
duplicateCommand
staleRevision
roleIsolation
playerReconnect
tableReconnect
privacyGate
replay
```

`validateOnlineHeadlessRoomGateReportV1(unknown)` is closed,
descriptor-safe, getter-free, trap-safe, relation-complete, non-mutating, and
returns a fresh deeply frozen report or deterministic complete frozen issues.
It checks order, roles, Core-player relation, final connected presence,
revision/count relations, every true coverage witness, exact DEFER order, and
all string/array/scalar restrictions.

Because the safe report deliberately omits per-action and per-audience secret
evidence, the standalone report validator checks only each coverage flag's
publicly representable count/client/revision implications. It is not a proof
that an arbitrary received report came from the gate. Only
`runLocalOnlineHeadlessRoomGateV1` owns the exact internal witness sets and may
derive a successful report; no exported report builder exists.

`OnlineHeadlessRoomGateOperationErrorV1` has exact name
`OnlineHeadlessRoomGateOperationErrorV1`, a readonly `code` restricted to
`INVALID_INPUT | COMPOSITION_REJECTED | COVERAGE_MISSING | PRIVACY_REJECTED |
REPLAY_MISMATCH`, and readonly frozen generic `issues`. The instance and issues
are frozen. It exposes no nested cause, request, response, capability, state,
projection, or stack as enumerable data.

## Privacy composition boundary

The gate does not reimplement O4P-02D audience rules. It proves that every
client request is authenticated through the shipped operation, every accepted
projection self-validates, no public response/log/report contains any
configured capability substring, Player views remain separate, and Table is
never treated as a Core Player. Judge evidence supplies distinct hidden
sentinels and directly inspects the per-audience shipped projections before
discarding them; the gate report can reveal only that privacy checks passed.

## Public surface and dependency boundary

`src/online/headless/index.ts` exports exactly:

- `ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1`;
- the named input/action/client/report/count/coverage/transition/issue/
  validation result types in this contract;
- `validateOnlineHeadlessRoomGateInputV1`;
- `validateOnlineHeadlessRoomGateReportV1`;
- `runLocalOnlineHeadlessRoomGateV1`;
- `OnlineHeadlessRoomGateOperationErrorV1`.

Production files under `src/online/headless/` may import only shipped public
barrels `src/engine/core/index.ts`, `src/online/room/index.ts`,
`src/online/protocol/index.ts`, `src/online/projection/index.ts`, and
`src/versioning/index.ts`. The only Core execution helper permitted is
`runOrdinaryFourPlayerCoreClosureV1` plus digest/replay validation needed for
verification. Direct reducer/mutation imports or calls, reverse imports from a
shipped lower layer, and a root Online barrel are forbidden.

## Explicit DEFER / non-goals

- Cloudflare, Worker, Durable Object, SQLite, WebSocket, network transport,
  persistence, hibernation, deployment recovery, and outbox;
- browser store, UI, Table rendering, input devices, animation, and audio;
- shared contract-version or Solo snapshot-version changes;
- Spectator composition beyond the already shipped O4P-02D projection;
- new Room/protocol/projection/Core semantics, capability rotation/abuse
  control, matchmaking, accounts, lobby, timers, or automatic combat damage.

These remain for O4P-03 or later. Passing O4P-02E authorizes the roadmap to
begin O4P-03A; it does not implement any O4P-03 behavior.
