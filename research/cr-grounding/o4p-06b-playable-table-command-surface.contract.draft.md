# O4P-06B Playable Table Command Surface Contract

Date: 2026-08-21
Milestone: `O4P-06B`
Base SHA: `a0c33741f5a2bde35f5e9a621671f5908a6b1284`
Status: `CONTRACT-FROZEN`
Risk: R3 / STANDARD cold audit

## Authority

This contract is the bounded O4P-06B child of the user-approved serial O4P-06
roadmap. The pinned local CR (2026-06-19) is authoritative for deterministic
rules facts: CR 106.4 and 500.5 for mana pools; CR 111.1, 111.6, and 111.10 for
tokens; CR 121.1-2 for drawing; CR 122.1-2 for counters; CR 400.7 for zone
identity; CR 500.1-5 and 501.1 for turn order; and CR 701.26 for tap/untap.

The existing O4P Core V1 command, journal, replay, Protocol V1 authority,
receipt, projection, and Room seat contracts remain authoritative. This
milestone extends their closed command algebra; it does not replace them.

## Goal

Make the O4P-06A four-real-deck revision-0 state playable through typed Core
commands for ordinary physical-table bookkeeping. The exact surface is:

1. draw one or more cards one at a time from the actor's library;
2. move a card between supported zones with explicit destination and library
   placement while preserving CR 400.7 reincarnation;
3. set a public permanent's tapped state;
4. adjust the actor's W/U/B/R/G/C mana pool by an explicit signed delta;
5. adjust one named counter kind on a public card or token by an explicit
   signed delta;
6. create one explicitly described engine-synthetic token on the actor's
   battlefield using a caller-fixed collision-safe token seed, and remove a
   token from the battlefield;
7. perform the next deterministic turn/phase checkpoint or successor transition
   through the shipped turn-priority component without bypassing a nonempty
   stack, pending triggers, required choices, or cleanup discard; and
8. retain the shipped guarded life and commander-damage correction payloads as
   the only exceptional correction records. Ordinary corrections use the
   semantic inverse above (untap, negative mana/counter delta, token removal, or
   an explicit zone move).

The public payload discriminants and exact field names may be chosen by the
implementer, but they must be a finite discriminated union with strict runtime
validation and must map one-to-one to the eight meanings above. No open command
record, arbitrary patch, callback, executable text, or client-supplied whole
state is permitted.

## State and version boundary

- `ModeNeutralCoreRootV1` gains no top-level field and keeps the current
  `CORE_CLOSURE_VERSION_VECTOR_V1` values.
- The new commands mutate only existing nested authority: the V2 object
  registry/runtime and shipped turn lifecycle inside
  `ruleAuthority.turnPriorityBundle`, plus `acceptedCommandCount`.
- Protocol version, room schema, projection schema, Cloudflare persistence
  schema, `CURRENT_CONTRACT_VERSIONS`, `PUBLIC_RELEASE_RULESET_V1`, and
  `CACHE_SCHEMA_VERSION` do not change.
- Every accepted command produces deterministic domain event payloads and a
  canonical before/after digest. A rejection returns the original root by
  identity, no events, no warnings, and identical before/after digest.
- Every accepted command remains replayable through the shipped Core journal
  and `replayCoreCommandsV1`; rejected commands never advance Core sequence or
  Protocol revision.

## Frozen command semantics

### Draw

- Actor, decision maker, and target player are the same registered active
  player. The count is a positive safe integer with a bounded maximum of 100.
- Each draw removes the current library top and appends the new CR 400.7 card
  incarnation to that player's hand. `drawnThisTurn` increases by the number
  actually drawn.
- An empty or insufficient library rejects atomically; partial draws are not
  accepted in this manual bookkeeping command.

### Zone movement

- Input names one existing card object and one already-supported
  `CoreCardZoneDestinationV1`. Same-zone reorder stays outside O4P-06B except
  explicit library placement during a cross-zone move.
- A card becomes a new object with the next canonical incarnation; old runtime
  counters, marked damage, orientation, and attachment do not survive.
- A hidden-source move is allowed only when the actor owns that player-scoped
  zone. Public-source movement may be recorded by the authenticated actor as a
  manual table outcome. This is bookkeeping, not an Oracle-effect claim.
- Non-card objects cannot use card zone movement. Token removal uses the token
  removal command and leaves no registry, runtime, zone, attachment, control,
  or stack-announcement reference.
- A `stack` card destination is not a raw table zone move in O4P-06B because
  the shipped stack contract requires an announcement transaction. Such a
  request rejects; callers use the existing typed stack-commit command.

### Tap, mana, counters, and tokens

- Tap/untap targets only a card or token on the battlefield. Setting the
  already-current value rejects as a no-op. It records orientation only; it
  does not claim payment, mana-ability resolution, or trigger automation.
- Mana adjustment targets the actor only, uses one of W/U/B/R/G/C, rejects
  zero, underflow, and unsafe-integer overflow, and does not claim a mana source
  or spending restriction.
- Counter adjustment targets a public battlefield card/token, validates the
  existing counter-kind contract, rejects zero/underflow/overflow, removes a
  zero result from the sorted counter list, and does not run SBAs or abilities.
- Token creation accepts one exact engine-synthetic definition snapshot,
  actor owner/controller, and an explicit canonical token seed. It rejects
  non-synthetic definitions, identity/definition collisions, capability-like
  material, invalid snapshots, and unsafe descriptors. Token runtime begins
  face-up, untapped, unflipped, phased-in, with no counters, damage, or
  attachment. Token removal accepts only an existing battlefield token.

### Turn progression

- Only the current active player may request progression.
- The command delegates to the shipped turn-priority transition functions and
  accepts only the exact next checkpoint/successor required by the current
  lifecycle window. It may complete the untap turn-based action, the draw-step
  draw checkpoint, the precombat-main checkpoint, advance to an explicitly
  valid successor position, or advance cleanup to the next turn.
- The draw-step checkpoint performs exactly one draw before completing the
  shipped checkpoint. Untap performs the shipped untap semantics. Phase/step
  boundaries retain the shipped mana-emptying semantics.
- Nonempty stack, pending triggers, unresolved SBA/trigger/priority windows,
  cleanup discard, invalid successor, inactive actor, and branch-skipping are
  fail-closed. O4P-06B does not fabricate SBA, trigger, choice, or priority
  resolution.

## Authority, secrecy, and hostile input

- Protocol V1 remains the only online participant authentication boundary.
  A participant can submit only a `CoreCommandV1` whose `actorPlayerId` maps to
  that participant's occupied seat; observers/table displays cannot command.
- Core decision authority validation remains mandatory. The command payload
  must not contain Room/Protocol participant capabilities, observer
  capabilities, bearer material, URLs, logging data, or UI state.
- Runtime validators must reject unknown/missing/non-enumerable/accessor/symbol
  fields, exotic prototypes, sparse/extra arrays, revoked proxies, cycles,
  non-finite numbers, unsafe integers, invalid IDs, and capability fragments
  without throwing or reflecting secret input in issues/events.
- Projection continues to conceal opponent library/hand identities and reveal
  only the shipped audience projection. O4P-06B may not add a projection bypass
  or raw Core root to any response.

## Executable four-seat scenario

Starting from the shipped O4P-06A four-real-deck protocol state, an executable
scenario must submit commands through `handleOnlineCommandEnvelopeV1` and cover
all seven new ordinary meanings. At least one command is accepted from each of
P1-P4. The scenario must include an actor mismatch, observer role rejection,
stale revision, duplicate replay, hidden-source authority rejection, underflow,
invalid turn progression, and token collision. It must assert:

- exact accepted/rejected/duplicate revision behavior;
- no cross-seat hidden identity disclosure;
- final visible state for draw, zone, tap, mana, counter, token, and turn;
- canonical final digest equals empty-process replay of the accepted Core
  command journal; and
- all returned states, events, receipts, projections, and replay evidence are
  deeply frozen and contain no configured capability or eight-character
  capability fragment.

## Write boundary

Implementer may change only:

- `src/engine/core/closure/**` except any `review.*` file;
- new files under `src/engine/core/tabletop/**` except any `review.*` file;
- `src/engine/core/index.ts` and ordinary Core tests required for the public
  exports; and
- `src/online/protocol/support.ts`, `src/online/protocol/command.ts`, and
  ordinary Protocol tests only for the existing configured-capability graph
  inspection to reject every configured capability fragment of eight or more
  characters before Core application; and
- new ordinary tests under `src/online/headless/__tests__/**` whose filename
  does not contain `review.`.

No other Judge-owned document, ledger, `review.*`, governance,
version/configuration, dependency, Room, Protocol schema/validator, Projection,
Cloudflare, UI, Worker, fixture corpus, or git operation is authorized.

## Done when

The frozen matrix is implemented through the public Core barrel; targeted Core,
Protocol/headless, replay, architecture, lint, type, and diff checks pass; a
Judge-owned hostile `review.*` scenario passes; an independent STANDARD cold
audit reports BLOCKER/HIGH zero; and the audited fingerprint passes one full
`npm run check` before governed ship evidence is recorded.

## DEFER

Arbitrary Oracle automation, spell/ability semantic resolution, raw
table-zone movement onto the stack, combat damage automation, SBA/trigger
fabrication, generic same-zone reorder, shuffle/random
choice, lobby/HTTP, browser WebSocket recovery, public UI wiring, dependencies,
schema/version migration, and deployment remain deferred to their registered
milestones or later bounded work.
