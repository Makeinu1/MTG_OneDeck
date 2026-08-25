# O4P-09C Pregame lifecycle contract

Date: 2026-08-25
Base SHA: `5f62a8f6730fd7a758d8b284ba818cf19f09c347`
Risk: R3 / BROAD Core setup, hidden information, randomness, and online authority

## Authority and goal

The repository-local CR pin dated 2026-06-19 is the rules authority. O4P-09C
adds one first-class, serializable Pregame boundary between the shipped ready
Room/genesis substrate and the shipped active variable Protocol. It owns:

1. public commander-set confirmation;
2. a server-authoritative starting-player result and the exact clockwise turn
   order beginning with that player;
3. recorded library permutations and opening hands of seven;
4. ordered declarations, simultaneous London mulligan waves, bottom choices,
   keep locks, and the multiplayer free-mulligan difference;
5. a bounded, honest manual pregame-action checkpoint;
6. per-player Pregame readiness and one transition to turn one; and
7. the two-player-only first-turn draw-step skip.

This milestone is a headless domain seam. It does not wire Pregame into the
Cloudflare Durable Object, Browser transport, public client, player screen, or
legacy Solo store.

## Frozen CR truth table

- CR 103.1 and 800.5: the authority result selects one seated starting player;
  default clockwise turn order is the existing seat order rotated to begin
  with that player. A client cannot submit or reorder that result.
- CR 103.2c and 903.6: commanders already identified by the accepted genesis
  are face up in the command zone. Confirmation records the public set and is
  not a new deck-legality decision.
- CR 103.3: every library shuffle is a server-recorded exact physical-card
  permutation. No Pregame operation calls `Math.random`, reads a clock, or
  accepts a client-selected shuffle result.
- CR 103.4c and 903.7: this Commander Pregame accepts only a 40-life, two- or
  four-player virgin variable genesis state.
- CR 103.5 and 101.4e: declarations are made starting-player first and then in
  turn order. After all eligible declarations, every declared mulligan begins
  atomically. Bottom choices are collected in the same order and committed as
  one atomic batch before the next declaration round. A keep is permanent.
- The pinned CR 103.5 text is operative: taking a mulligan shuffles the current
  hand, draws the starting hand size, and then bottoms the charged number before
  declarations repeat. This is why the candidate hand decreases and why the
  zero-hand limit below is finite; external recollection of a different London
  procedure does not override the repository pin.
- In two-player Commander, mulligan number `n` bottoms `n` cards; at seven the
  opening hand becomes zero and no further mulligan is possible.
- In four-player Commander, the first mulligan is free; mulligan number `n`
  bottoms `max(0, n - 1)` cards; at eight the opening hand becomes zero.
- CR 103.6: after mulligans, players receive the bounded manual-action
  checkpoint one at a time in starting-player order.
- CR 103.8a, 103.8c, 800.7, and 903.2: the starting player in a two-player game
  skips the draw step of turn one. In a four-player game the normal draw step
  and one-card draw remain mandatory.

## Server random plan

`OnlinePregameRandomPlanV1` is an exact, deeply frozen server-only record:

- `kind: 'online-pregame-random-plan-v1'`
- `schemaVersion: 1`
- `decisionId`: one canonical non-capability identifier
- `startingPlayerId: CorePlayerId`
- `turnOrder: readonly CorePlayerId[]`
- `libraryPlans`: one entry per seated player in seat order; each entry has
  `playerId` and `orders`, an array of exact physical-card permutations.

Each player's `orders[0]` is the initial shuffle. A two-player plan contains
exactly eight orders per player (initial plus seven possible mulligans); a
four-player plan contains exactly nine (initial plus eight possible
mulligans). Every order is an exact permutation of that player's noncommander
starting-library physical IDs. The turn order must be the one rotation of the
Room seat order beginning with `startingPlayerId`.

The plan is injected by trusted server construction, persisted in
`OnlinePregameStateV1`, and replayed. It is never accepted in a participant
command, projection, acknowledgement, log, or public error.

## Pregame state and authority

`createOnlinePregameLifecycleV1({ initialState, randomPlan })` accepts only a
validated, virgin `OnlineVariableProtocolStateV2`: active variable Room,
revision and Core accepted-command count zero, no protocol receipts, turn one
at untap, empty hands/graveyards, the shipped command-zone commander set, and
two or four players at 40 life. It treats that state only as the immutable
post-deck-admission construction substrate, creates an exact `started` Room
copy, and creates one `OnlinePregameStateV1` without mutating the input.

The state has these exact top-level fields:

- `kind`, `schemaVersion`, `protocolState`, `randomPlan`, `phase`,
  `currentPlayerId`, `mulliganRound`, `players`, `revision`, and `journal`.

Its phases are `commander-reveal`, `mulligan-declaration`, `mulligan-bottom`,
`pregame-actions`, `ready`, and `complete`. Player records contain only exact
Pregame facts: player ID, commander confirmation, mulligan decision and total
taken, required bottom count and pending bottom object IDs, manual action
count/completion, and Pregame readiness. The private journal contains the
normalized command, participant ID, base revision, command ID, request digest,
and bounded response; it never stores a capability or raw error.

The journal is capped at 256 accepted entries. Reaching that cap rejects a new
command with `CAPACITY_EXCEEDED`; it never evicts history or wraps revision.

`validateOnlinePregameStateV1` fails closed on malformed descriptors, surplus
or missing fields, invalid nested Protocol/Core state, impossible phases,
roster/order/revision/hand/count relations, or journal inconsistency.
`replayOnlinePregameLifecycleV1(initialState, randomPlan, journal)` must
reproduce the same canonical state without randomness, network, or clock.

## Command envelope and state machine

`OnlinePregameCommandEnvelopeV1` is exact and contains `kind`, `schemaVersion`,
Room/participant identity, participant capability, command ID, base revision,
and one command from this closed union:

- `confirm-commanders`
- `declare-mulligan` with `decision: 'mulligan' | 'keep'`
- `submit-mulligan-bottom` with exact current-hand `objectIds`
- `record-manual-pregame-action`
- `complete-pregame-actions`
- `set-ready` with one boolean `ready`

Room ID, participant ID, and command ID use the existing application-ID grammar
`^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$`; decision ID uses the Core base-ID grammar
and maximum 128 characters; participant capability uses the existing 32-128
base64url-safe grammar. Base revision is a canonical nonnegative safe integer.
Bottom arrays are dense, descriptor-safe, distinct, and at most seven IDs.

Acknowledgement and rejection are exact closed records:

- ACK keys are `kind`, `schemaVersion`, `commandId`, `acceptedRevision`,
  `currentRevision`, and `duplicate`. A new ACK has both revisions equal to the
  new state revision and `duplicate: false`; an exact duplicate returns its
  original accepted revision, the current state revision, and `duplicate: true`.
- REJECT keys are `kind`, `schemaVersion`, `commandId`, `currentRevision`,
  `resyncRequired`, and `issues`. `commandId` is null only when hostile input
  prevents extracting a valid ID. Issues contain only exact `code` and `path`.
- The code union is `INVALID_COMMAND`, `ROOM_MISMATCH`,
  `AUTHORIZATION_REJECTED`, `STALE_REVISION`,
  `COMMAND_ID_REUSE_MISMATCH`, `INVALID_PHASE`, `ACTOR_MISMATCH`,
  `INVALID_CHOICE`, `PLAN_EXHAUSTED`, `INVALID_BOTTOM`, `CAPACITY_EXCEEDED`,
  and `INVALID_STATE`. Every rejection contains exactly one issue.
  `currentRevision` always equals the validated input state's revision. Issue
  path is either empty or a slash-prefixed sequence of ASCII letters, digits,
  `.`, `_`, `~`, and `-`, with a maximum of 160 characters; it never reflects
  secret input.
- `resyncRequired` is true exactly for `STALE_REVISION` and false for every
  other rejection. A command ID is unique within the Pregame state. Duplicate
  comparison covers participant ID, base revision, and the normalized command;
  authority/capability is checked before a stored receipt can be replayed.
- Rejection precedence is: invalid state, invalid envelope, Room mismatch,
  authorization, command-ID duplicate/reuse, stale revision, journal capacity,
  then actor/phase/choice/plan/bottom semantics. The first applicable bounded
  issue is returned; hostile multi-invalid input cannot probe later authority.

The handler validates the entire graph before authority or state mutation.
Room, participant, and capability must map to the occupied player seat.
Commands are phase gated and, except readiness, actor gated to
`currentPlayerId`. Manual actions are bookkeeping markers only, bounded to 16
per player, contain no free text/card identity/Oracle claim, and do not mutate
Core. Unsupported Leyline, Gemstone Caverns, Chancellor, Companion, and other
Oracle semantics therefore remain explicitly manual and are not reported as
automated.

The handler is revisioned and idempotent. A new accepted command increments the
Pregame revision once and appends one journal entry. An exact duplicate returns
the original acknowledgement without another mutation; command-ID reuse with
different content, stale revision, invalid phase/actor/choice, authorization,
and plan exhaustion reject without changing state. Rejections use bounded
codes and never reflect capabilities, plan material, hidden card identity, or
private exception text.

Opening deal and each mulligan wave use pure Core Pregame operations. All wave
inputs are validated before any player root changes. Cards crossing zones gain
the next canonical incarnation; initial and mulligan draws do not increment
`drawnThisTurn`; `mulliganCount` records total mulligans taken. Submitted
bottom object IDs must be distinct, belong to that player's current hand, and
equal the charged count. Their listed order becomes the final library suffix.

When every player completes pregame actions, phase becomes `ready`. The last
`ready: true` activates the existing variable Room with
`activateOnlineVariableRoomV2`, preserves Protocol V2 schema and revision zero,
and enters `complete`. The Core root begins turn one at untap with exact turn
order, starting active player, opening hands, mulligan counters, and
`drawnThisTurn: 0`.

## Core setup and first-turn draw boundary

New pure code under `src/engine/core/pregame/**` owns only pre-command setup:
exact turn-order rotation, initial library order/opening deal, atomic mulligan
shuffle/deal, and atomic bottom placement. It returns validated deeply frozen
`ModeNeutralCoreRootV1` values and never calls the Core command reducer,
increments accepted command count, creates domain events, reads online
authority, or imports product/React/store/transport code.

The shipped Core root validator also currently equates canonical Registry
player-record order and lifecycle seat order with game turn order. O4P-09C
corrects only that invalid relation: Registry player IDs, active lifecycle
player IDs, and turn-order IDs must be the same duplicate-free set, while
`turnOrder` may be the authoritative starting-player rotation. Ordered
Commander/damage/provenance relations remain ordered and unchanged.

The existing `CoreCommandV1` remains schema version 1 under the O4P-06B
precedent for extending its closed algebra without a top-level state or version
change. `CoreTabletopTurnTransitionV1` gains exactly
`{ kind: 'first-turn-draw-skip' }`. It is accepted only for the active actor in
an exact two-player root, turn one, at beginning/upkeep with the lifecycle
`position-advance-ready`, empty stack, and no pending trigger. It atomically
skips the draw step and enters precombat main's required checkpoint without a
draw. It rejects everywhere else. Four-player progression continues through
the normal draw position and checkpoint and draws exactly one.

No Core root field, closure version-vector value, Protocol/Room/Projection
schema, persistence schema, dependency, or configuration version changes.

## Audience projection

`projectOnlinePregameV1(state, participantId)` returns one exact immutable
`OnlinePregameProjectionV1` containing only its version, Pregame revision and
phase/current player, public starting player/turn order, public per-player
status/count facts, and the shipped audience-safe
`OnlineVariableParticipantProjectionV3` for that participant.

Only the owning player sees their hand identities through the shipped v3
projector. Other players and table/spectator audiences see hidden entries and
counts only. Projection and public receipts contain no random plan, library
order, pending bottom identities, capability, request digest, journal, raw
Core root, internal Protocol receipts, or private error.

The shipped v1/v3 projection validators currently equate turn order with seat
order. O4P-09C corrects that narrow invalid assumption: game turn order is an
exact duplicate-free permutation of the seated Core player IDs, while Room
seats remain in seat-index order and projected player/zone arrays remain in
turn order. The compatibility validator and one ordinary projection regression
test may change only for this relation; visibility and descriptor rules remain
unchanged.

## Product and write boundary

Product implementation is limited to:

- new `src/engine/core/pregame/index.ts`, `typesV1.ts`, `operationsV1.ts`,
  and ordinary `__tests__/pregameOperationsV1.test.ts`;
- `src/engine/core/index.ts`, `src/engine/core/turn/index.ts`,
  `src/engine/core/turn/turnAdvanceV1.ts`,
  `src/engine/core/tabletop/commandV1.ts`,
  `src/engine/core/closure/commandV1.ts`,
  `src/engine/core/closure/applyCommandV1.ts`,
  `src/engine/core/closure/rootValidationV1.ts`, and ordinary
  `src/engine/core/closure/__tests__/repairWave1.test.ts` for the exact
  draw-skip and rotated-player-set seams; and
- new `src/online/pregame/index.ts`, `types.ts`, `validation.ts`,
  `operations.ts`, `projection.ts`, and ordinary
  `__tests__/pregameLifecycleV1.test.ts`; and
- `src/online/projection/validation.ts` plus ordinary
  `src/online/projection/__tests__/projectionV1.test.ts` only for the exact
  rotated-turn-order compatibility correction.

Judge-owned review and architecture allowlists may add only the new `pregame`
module and its exact public-Core imports. The Judge may mechanically refresh
only `docs/generated/engine-api.md` for the new public Core exports. No existing genesis, Room, Protocol,
Projection constructor/visibility semantics, application, Browser, Cloudflare,
public client, GameScreen, controller, store, UI, dependency, configuration,
CR byte, or O4P-09D-J product change is allowed.

## Verification and deferrals

Judge review covers exact hostile validation, two/four-player CR truth tables,
ordered and simultaneous mulligans, keep/zero locks, idempotency/stale/reuse,
replay, final activation, first-turn draw behavior, audience secrecy, and the
frozen path boundary. Ordinary tests cover full state-machine branches and Core
atomicity. Focused Core/Pregame/Protocol/Projection tests, affected lint,
TypeScript, docs/ownership/diff checks, and a fresh-context R3/BROAD cold audit
must pass before the one release full check.

Deferred: Oracle-specific pregame automation, client RNG, deck admission or
Commander-legality changes, production persistence/transport/UI wiring,
general tabletop expansion, hidden-information operations beyond Pregame,
assisted priority/HOLD, shared undo, spectator presentation, and all later
O4P-09D-J scope.
