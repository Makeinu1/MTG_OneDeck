# O4P-01M Commander, multiplayer combat, and player-exit contract draft

Status: judge draft; not active authority until the grounding reports are
reconciled and the acceptance evidence is frozen.

Base SHA: `1d5a75a60bc6f13a4ed6fd3daf7687e2ed4a0dcf`

## Contract purpose

Add the minimum immutable, mode-neutral Core substrate for Commander identity,
multiplayer combat structure, and player lifecycle. Existing O4P-01G through
O4P-01L slices remain authoritative for identity/zone, object/runtime, stack,
turn/priority, and rule authority. This milestone does not introduce typed
commands/events or a network/application envelope; those are O4P-01N and later.

## CR boundary

- CR 903.3: Commander designation follows the physical card through zones.
- CR 903.8: only a cast from the command zone increments Commander tax history.
- CR 903.9a-c: replacement/choice timing is represented explicitly; it is not
  collapsed into an ordinary zone transition.
- CR 903.10a and CR 104.3j: Commander damage is keyed by the same physical
  Commander and defending player; the 21-damage result is a query/advisory,
  not an implicit player deletion.
- CR 506.1-506.4, 507.1, 508.1, 509.1: multiplayer combat participants,
  defending-player selection, attack targets, blocker assignments, and removal
  from combat.
- CR 510.1: combat damage assignment is a later guided/manual boundary; this
  contract stores structure and assignments only.
- CR 800.4a-j: player exit is distinct from disconnect and requires deterministic
  cleanup directives for owned/controlled objects, priority, and turn order.

## Commander slice

Proposed module: `src/engine/core/commander/commanderStateV1.ts`.

```ts
type CoreCommanderRecordV1 = Readonly<{
  physicalCardId: CorePhysicalCardId;
  ownerPlayerId: CorePlayerId;
  castFromCommandCount: number;
}>;

type ModeNeutralCoreCommanderSliceV1 = Readonly<{
  kind: 'mode-neutral-core-commander-slice-v1';
  commanderOrder: readonly CorePhysicalCardId[];
  byCommander: Readonly<Record<CorePhysicalCardId, CoreCommanderRecordV1>>;
  damageByCommander: Readonly<Record<CorePhysicalCardId,
    Readonly<Record<CorePlayerId, number>>>>;
}>;
```

Required pure operations:

- `createModeNeutralCoreCommanderSliceV1` and
  `validateModeNeutralCoreCommanderSliceV1`;
- register a physical Commander exactly once;
- record a cast only when the caller supplies `fromZone: 'command'`;
- `commanderTaxV1` as `2 * castFromCommandCount`;
- create/validate an explicit 903.9a/903.9b replacement decision without
  silently moving a card;
- record combat damage by physical Commander and defending player;
- query the 21-damage advisory without changing player lifecycle.

All operations validate before making candidate copies, preserve input
immutability, return deeply frozen canonical results, and reject negative
counts/damage, duplicate physical IDs, unknown fields, or invalid player IDs.
The module must not inspect display names or controller IDs to identify a
Commander.

## Combat slice

Proposed module: `src/engine/core/combat/combatStateV1.ts`.

The state stores a combat ID, turn number, attacking player, an ordered list of
defending players, ordered attack assignments, and ordered blocker assignments.
An attack assignment contains the attacking object ID, its controller, and a
defending player ID. A blocker assignment contains the blocking object ID, its
controller, the defending player ID, and the attacked object ID.

Required pure operations:

- create/validate a beginning-of-combat state;
- choose one or more defending players without duplicate IDs;
- declare attackers with one target player per attacker;
- declare blockers with one or more attacked objects per blocker;
- remove an object or player from combat deterministically;
- expose structural damage-assignment inputs but do not apply damage.

The slice validates shape, uniqueness, phase/step, player-reference format, and
basic CR participant relations. Full restrictions/requirements, power
calculation, prevention, first/double strike, and damage application remain
explicitly deferred. No Commander damage counter is mutated by this module.

## Player lifecycle slice

Proposed module: `src/engine/core/player-lifecycle/playerLifecycleV1.ts`.

```ts
type CorePlayerLifecycleStatusV1 = 'active' | 'defeated' | 'conceded' | 'exited';
type CorePlayerExitCauseV1 = 'concession' | 'defeat';
```

The lifecycle state keeps an ordered player list and a status record. A
disconnect is not a Core value and cannot produce an exit transition. A typed
concession and a CR-derived defeat are distinct causes, even when both end in
`exited`.

The exit operation returns a frozen reconciliation result containing:

- the updated lifecycle status and surviving turn order;
- the next surviving active player and priority holder, or `null` when the
  relevant turn/priority action ends under CR 800.4j;
- deterministic cleanup directives for owned objects, controlled objects,
  non-card stack objects, control effects, decision authorities, search
  sessions, and combat participants;
- a distinction between directives that cease, are exiled, are reassigned, or
  merely become unresolved/manual.

The operation must never grant a host/administrator override, mutate a Core
state through an arbitrary path, or treat transport disconnect as concession.
The integration fixture must prove that no surviving reference points to the
exited player where the contract requires cleanup.

## Version and integration boundary

This slice has its own version identifiers in the fixture/verifier. It must not
change Solo `SNAPSHOT_VERSION`, `docs/contracts/manifest.json`, or any future
protocol version. O4P-01N will decide how these slices enter the typed Core
command/event root. Only the O4P-01M integration lane may edit
`src/engine/core/index.ts`, the fixture, and the machine verifier.

## Required acceptance vectors

1. Four Commander records are registered by physical ID; duplicate registration
   and display-name collision are rejected.
2. Command-zone cast count changes exactly once per accepted cast and ordinary
   zone return does not change it.
3. 903.9a and 903.9b choices are typed, source-zone constrained, and do not
   perform a hidden move.
4. Damage from two physical Commanders to two defending players is tracked in
   four independent cells; threshold query is per cell.
5. Four-player combat allows multiple defenders, attack targets, multi-blocker
   assignments, and deterministic participant removal.
6. Concession and defeat produce different cause records; disconnect has no
   Core transition.
7. Exit cleanup returns no stale active-player, priority, combat, control,
   search, decision, or stack-owner reference.
8. Invalid operations leave every input object and array unchanged.
9. Fixture serialization, validation, canonicalization, and deep-freeze checks
   pass; full damage calculation is not claimed automated.

## Judge freeze for implementation — 2026-08-11

The grounding reports identified no CR-determined contradiction after the
following bounded decisions. These decisions are the implementation authority
for O4P-01M; later O4P-01N may wrap them in typed commands/events but may not
silently change their meaning.

### Frozen lifecycle decisions

1. Core retains a stable player roster for historical owner/controller and event
   references. A separate lifecycle status/eligibility record determines who
   may receive priority, act, defend, or be selected as a surviving player.
   O4P-01M does not delete a player ID from the historical roster.
2. `concession` and `defeat` are distinct causes. An accepted lifecycle exit
   records the cause and, for defeat, the CR rule reference when known. The
   existing Solo defeat advisory remains advisory; O4P-01M does not silently
   convert all Solo SBAs into hard game termination.
3. There is no Core `disconnect`, `connected`, timeout, browser, session, or
   transport field. No missing command or transport event can invoke an exit.
4. Exit reconciliation is a pure, atomic calculation over an explicit typed
   reference bundle. It returns typed cleanup directives for owned objects,
   non-card stack objects, other controlled objects, control effects, decision
   authorities, search sessions, combat participants, and current
   active/priority references. It does not mutate an arbitrary path or pretend
   that all references have the same CR treatment.
5. The next eligible player is selected by the existing ordered roster after
   filtering exited players. A turn may continue without its departed active
   player; if the departed player held priority, the result is an explicit
   next-eligible handoff. No second APNAP/priority engine is introduced.

### Frozen Commander decisions

1. Commander designation and cast history are keyed by `CorePhysicalCardId`;
   current object ID, display name, controller, token, and copied object are
   not identity authorities.
2. Cast history increments exactly once only for an accepted command-zone cast
   record. Zone movement, an uncommitted announcement, a failed validation, or
   a return to the command zone does not increment it.
3. `903.9a` and `903.9b` are separate typed replacement/choice records. M
   records the choice and validation boundary; O4P-G owns ordinary object/zone
   transition. `903.9c` meld/merge composition is deferred.
4. Commander damage is stored by physical Commander and defending player, and
   its automatic 903.10a advisory query requires a combat-damage provenance
   record. Different Commanders never share a threshold counter.

### Frozen combat decisions

1. The combat slice stores structural step, attacking player, ordered defending
   players, per-attacker target player, per-blocker controller/defending player,
   attacked object, and declaration order. It is not a second turn/priority
   state.
2. The slice rejects duplicate object/player assignments and stale exited
   participants when the explicit lifecycle reference bundle is supplied. It
   does not claim full `508.1`/`509.1` restriction/requirement legality.
3. Damage assignment/application, prevention, replacement, first/double strike,
   and keyword semantics remain guided/manual unless a later executable replay
   proves them. The 01M verifier must say this explicitly.

### Frozen output boundary

The 01M public outputs are additive Core value objects and pure operations,
ordinary tests, one fixture, and one machine verifier. No public root
dispatcher, typed command/event/replay envelope, Solo snapshot migration,
protocol, projection, network, UI, or Cloudflare code is part of this
milestone. The only integration writes allowed after the slice implementations
are complete are the Core barrel export, the 01M fixture/verifier registration,
and a judge-owned architecture/acceptance review test.

## Contract amendment — strict collection boundaries (2026-08-11)

The implementation and cold-audit loop additionally freezes these collection
rules for every 01M value object:

1. Arrays are ordered contract data. Factories and operations must preserve
   supplied array order; they must not silently sort, deduplicate, merge, or
   delete zero entries. Duplicate semantic entries are validation failures.
2. Commander damage state has an explicit `defendingPlayerIds` allowlist in
   addition to the physical Commander registry. Record and query reject a
   valid-but-unregistered defending player; a registered pair with no entry
   returns zero.
3. Damage record updates an existing unique pair in its existing position and
   appends a new pair. A zero amount returns the normalized frozen state.
4. Combat add operations normalize their incoming state before success and
   append assignments without reordering existing declarations.

The current micro-candidate cold audit covers these value-object boundaries.
It is not by itself the O4P-01M parent shipment: exit reconciliation,
provenance-gated Commander damage, full structural combat context, fixture,
and machine-verifier closure remain required before the parent can be marked
shipped.

## Contract amendment — parent closure additions (2026-08-11)

The parent closure also includes the following additive boundaries:

1. `CoreCombatContextV1` owns only combat structural context: step,
   attacking player, ordered defending players, per-attacker defender,
   blocker object, blocker controller, and blocker defender. It does not own
   CR 508/509 legality, damage assignment, turn/priority, or control rules.
2. `CoreCommanderDamageProvenanceLedgerV1` is the provenance authority for
   the 903.10a threshold query. A record is keyed by combat object,
   physical Commander, and defending player; the threshold query sums only
   these records. It does not perform an SBA or mutate GameState.
3. The committed O4P-01M fixture and ordinary closure verifier must exercise
   all additive root APIs in one four-player scenario and assert explicit
   DEFER boundaries, deep-freeze, input immutability, and the absence of
   transport/network authority fields.

## Contract amendment — replacement cold-audit adjudication (2026-08-11)

The replacement cold audit at fingerprint
`eec93d2adc1780352016bf489694b3f489e29c7bfd42e36fc761d6ff0de1705a`
found reachable gaps in the earlier candidate. The following decisions
supersede any incompatible provisional shape above while preserving the
milestone boundary.

### Validation safety

1. Every array is an ordinary dense array with only canonical enumerable data
   index properties. Holes, accessors, non-enumerable indices, symbols,
   non-index properties, and proxy/descriptor/prototype traps are typed
   validation failures. Validation must inspect descriptors and must not invoke
   getters through `slice`, iteration, spread, or indexed property access before
   descriptor validation.
2. Every object/prototype/own-key/descriptor inspection is trap-safe. A trap
   becomes a deterministic frozen typed issue; no raw `Error` escapes a public
   factory or operation.
3. All issue arrays use the existing code-unit path-then-code ordering,
   including Commander replacement. Equivalent malformed inputs therefore
   produce the same issue order.

### Unified combat authority

1. `CoreCombatContextV1` is the sole public O4P-01M combat-state authority.
   The provisional standalone `CoreMultiplayerCombatAssignmentStateV1` API and
   its root exports are removed rather than maintained as a second authority.
2. The context contains exactly: `combatId`, positive safe `turnNumber`,
   `step`, `attackingPlayerId`, ordered `defendingPlayerIds`, ordered attacks,
   and ordered blocks. An attack contains attacker object, attacker controller,
   and exactly one defending player. A block contains blocker object,
   blocker controller, attacked object, and that attack's defending player.
3. The attacking player is not a defender. Every attacker controller equals
   the attacking player. Each attacker object appears in exactly one attack.
   Every attack defender is registered. A block is accepted only during
   `declare-blockers`, references an existing attack with the same defender,
   and has blocker controller equal to that defender. A blocker may block more
   than one attacker only through distinct blocker/attacker pairs; duplicate
   pairs fail.
4. Attack addition is accepted only during `declare-attackers`; block addition
   only during `declare-blockers`. Transition to `declare-blockers` preserves
   declarations. There is no backward transition.
5. `reconcileCoreCombatContextForPlayerExitV1` takes an exiting player and an
   ordered dense list of participant object IDs to clear. If the attacker exits,
   combat ends and the operation returns `null`. Otherwise it removes the
   exiting defender, attacks at that defender, blockers controlled by or
   defending that player, explicitly cleared attackers/blockers, and any block
   whose attack no longer survives. Surviving order is preserved and the
   returned context is freshly deeply frozen.
6. No damage assignment/application, restriction/requirement legality,
   first/double strike, turn/priority mutation, or SBA is added.

### Unified lifecycle and CR 800.4 reconciliation

1. A lifecycle entry is `{ playerId, status, exitCause }`, where `status` is
   `active | exited`; `active` requires `exitCause: null`, and `exited` requires
   `exitCause: concession | defeat`. Roster order remains stable. The public
   status query returns `active | exited`; a separate query returns the exit
   cause or `null`.
2. `applyCorePlayerExitV1` remains the pure lifecycle transition, but parent
   acceptance is owned by one atomic `reconcileCorePlayerExitV1` operation over
   lifecycle state, reference bundle, and typed exit request. Its result
   contains the updated lifecycle state, surviving turn order, active player,
   priority handoff, and all cleanup directive arrays. It validates all inputs
   and cross-relations before returning any result.
3. The exiting player must be active, in turn order, and absent from
   `eligiblePlayerIds`. Every eligible player is an active lifecycle player and
   appears in turn order. A non-null active or priority player must be either
   the exiting player or an eligible player. After exit, turn order filters only
   the exiting player; active player becomes `null` only when that player exits;
   priority held by the exiting player passes to the next eligible player in
   turn order, or `null` when none exists.
4. `nonCardStackObjectIds` accepts only spell-copy, activated-ability, and
   triggered-ability object kinds. It rejects card and token IDs. CR 800.4a
   cleanup precedence is owned objects leave, control effects end, non-card
   stack objects cease, then remaining controlled objects exile. An object
   present in the non-card stack list is therefore excluded from the controlled
   exile output; no object is emitted in two object-cleanup categories.
5. The atomic result also carries ordered combat participant cleanup and
   control/decision/SearchSession cleanup. `SearchSession` remains the shipped
   Core rules-domain concept; transport session/connection metadata remains
   forbidden.

### Verifier proof

The standalone verifier must derive DEFER proof from the public export set and
exact returned runtime shapes. It must fail if an automatic combat-damage/SBA
API or field appears. A self-authored constant that merely repeats the DEFER
text is not evidence.

### Lifecycle API clarification

To remove the remaining implementation ambiguity in the atomic parent
operation, the public V1 shapes are fixed as follows.

1. `CorePlayerExitRequestV1` is exactly `{ playerId, cause }`. It is the sole
   owner of the exiting player identity. `CorePlayerExitReferenceBundleV1`
   therefore does not repeat an `exitingPlayerId` field.
2. `reconcileCorePlayerExitV1` has three explicit inputs in this order:
   lifecycle state, reference bundle, and exit request. It must normalize and
   validate all three before applying `applyCorePlayerExitV1`; it does not
   accept a pre-transitioned lifecycle state.
3. `CorePlayerExitReconciliationResultV1` contains exactly the updated
   `lifecycleState`, `survivingTurnOrder`, `activePlayerAfterExit`,
   `priorityHandoffPlayerId`, and these ordered cleanup arrays:
   `ownedObjectsToLeaveGame`, `controlEffectIdsToEnd`,
   `nonCardStackObjectsToCease`, `controlledObjectsToExile`,
   `combatParticipantObjectIdsToClear`, `decisionAuthorityIdsToClear`, and
   `searchSessionIdsToClose`.
4. Object cleanup categories are disjoint under the frozen CR 800.4a
   precedence. An owned object is emitted only by
   `ownedObjectsToLeaveGame`; a surviving non-card stack object is emitted only
   by `nonCardStackObjectsToCease`; `controlledObjectsToExile` excludes both
   preceding categories. Relative order within each source list is preserved.
5. Every player in `turnOrder` is a registered active lifecycle player before
   the requested exit. `eligiblePlayerIds` is the ordered subset eligible after
   that exit, so it excludes the exiting player. The surviving turn order is
   the original order with only the exiting player removed; it is not replaced
   by or reordered to match `eligiblePlayerIds`.
