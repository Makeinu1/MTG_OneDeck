# O4P-01L-F Cross-Slice Bundle Grounding

status: drafted
milestone: O4P-01L
role: Architecture Analyst
baseSha: be3240e77e2c1cfc6be30707bbc3f052c2524b9a

## Finding

O4P-01L should add one mode-neutral authority coordinator around the shipped
`CoreTurnPriorityBundleV1`. It must have one authoritative Registry/Runtime
and one authoritative Turn source. It must not copy those sources into the
new slices. The existing source path is:

```text
bundle.turnPriority.stackBundle.objectRegistry
bundle.turnPriority.stackBundle.objectRuntime
bundle.turnPriority.lifecycle
```

The coordinator is a transaction boundary, not a CR 613 dependency engine.
Every successful operation returns one fresh, canonical, deeply frozen bundle;
every failure returns no candidate bundle and leaves every input untouched.

## Proposed bundle shape and exact root key set

The public root is the following exact record. `kind` is present in validated
values and absent from factory input, matching Registry V2, Turn Lifecycle V1,
and Turn Priority Bundle V1.

```text
CoreRuleAuthorityBundleV1
  kind: "mode-neutral-core-rule-authority-bundle-v1"
  turnPriority: CoreTurnPriorityBundleV1
  control: CoreControlSliceV1
  continuity: CoreContinuitySliceV1
  visibility: CoreVisibilitySliceV1
  decisionAuthority: CoreDecisionAuthoritySliceV1
  searchSessions: CoreSearchSessionSliceV1
  playPermission: CorePlayPermissionSliceV1
```

Required root key set, in canonical order:

```text
["kind", "turnPriority", "control", "continuity", "visibility",
 "decisionAuthority", "searchSessions", "playPermission"]
```

Factory input key set, in canonical order, is the same list without `kind`.
Unknown string keys, symbol keys, missing keys, accessors, non-enumerable
fields, arrays, and non-plain prototypes are invalid. No optional root field
may be represented by omission, `undefined`, or an extra extension key.

The exact key set of each domain slice remains owned by its lane contract. F
requires these cross-slice minimums: each slice has a literal `kind` and one
stable collection field; each collection record has a stable identity key;
all source, object, player, turn, and duration references use the existing
canonical ID/value objects; and every slice rejects unknown fields. A lane may
not add a second Registry, Runtime, active player, turn number, or wall-clock
expiry field.

Recommended collection identity keys are `effectId` for Control and
Continuity, `queryId`/`sessionId` for Visibility/Search, `decisionId` for
Decision Authority, and `attemptId` for Play Permission. These are identities,
not ordering hints; arrays preserve semantic order unless their lane contract
explicitly says otherwise.

## Validation order

Validation is fail-closed and dependency ordered:

1. Inspect the root descriptor and require the exact root key set.
2. Validate `turnPriority` using `validateCoreTurnPriorityBundleV1`. This
   transitively validates Stack Transaction, then Registry V2, Runtime V2,
   Announcements, Pending Triggers, Lifecycle, and existing Turn cross-slice
   invariants. Do not validate a dependent slice against raw input.
3. Bind local references to the canonical Registry at
   `/turnPriority/stackBundle/objectRegistry`; bind temporal facts to the
   canonical Lifecycle at `/turnPriority/lifecycle`.
4. Validate Control entries against Registry object/player existence and the
   lane's explicit effect order. Validate Continuity against the accepted
   Control result and the same Registry source facts.
5. Validate Visibility against Registry, accepted Control/Continuity, and its
   explicit viewer/searcher/selector distinctions.
6. Validate Decision Authority against Registry, Turn, Control/Continuity,
   and Visibility. It must distinguish rules actor, controlled player, active
   player, and decision maker; equality is never inferred merely from being
   seated.
7. Validate Search Sessions against the accepted Visibility and Decision
   Authority results. A session must name its searcher/selector and its
   lifecycle state; it cannot manufacture card criteria or move cards.
8. Validate Play Permission last, against Turn, Registry, Control/Continuity,
   Visibility, Decision Authority, and any referenced Search Session. It
   reports a permission decision only; timing, card-type, cost, target, and
   cast/play legality remain deferred.
9. Run whole-bundle cross-slice checks, canonicalize all slices, deep-freeze,
   and return one fresh success value. If any check fails, return the complete
   deterministic issue set and no value.

This order is intentionally stricter than parallel independent validation.
Independent reads may be batched internally, but a dependent validator must
receive the preceding canonical result, never the caller's mutable object.
The existing Turn implementation is the precedent: Stack first, Pending only
after a valid Stack/Registry, Lifecycle, then cross-slice checks.

## All-or-nothing invariants

The bundle is valid iff all of the following hold:

- There is exactly one Registry/Runtime/Turn source, reachable through
  `turnPriority`; no slice contains a shadow copy of `players`, `objects`,
  `zones`, `activePlayerId`, `turnNumber`, or `positionSequence`.
- Every referenced object/player exists in that Registry, except a nullable
  source reference explicitly permitted by the owning lane. A dangling
  non-null reference is not silently converted to `null`.
- Every source-bearing Control/Continuity record has the same source identity,
  affected identity, controller identity, duration, and explicit order in both
  slices. Control and Continuity must be either both present for an effect or
  both absent; one-sided records are a `CROSS_SLICE_MISMATCH`.
- A controller derived from an effect is the controller selected by that
  effect's explicit order. Do not evaluate competing effects, layer systems,
  or dependency ordering from CR 613. The caller supplies already-resolved
  explicit order; the bundle checks shape and parity only.
- A visibility result cannot expose an object or zone not present in Registry,
  and a hidden-zone result cannot be widened by Search Session or Play
  Permission. Viewer, searcher, selector, and decision maker are separate
  fields and are checked for seated-player identity independently.
- Decision Authority may refer to a controlled player only when Control says
  that player is controlled for the operation. Active player comes only from
  Registry/Turn. Rules actor is not a player identity unless the slice contract
  explicitly says so.
- A Search Session is usable only while open, bound to its declared searcher,
  and backed by the Visibility/Decision Authority facts from the same bundle.
  It may retain candidate object IDs as a snapshot, but it cannot authorize
  movement, reveal, shuffle, or selection outside its declared boundary.
- A Play Permission record cannot be affirmative if its required authority,
  visibility, control, continuity, or search dependency is absent, expired, or
  mismatched. `true` means only that this authority gate passed.
- One invalid slice invalidates the complete bundle. No valid slices, pruned
  records, or partial operation result may be returned alongside failure.
- A successful operation commits all derived changes as one new bundle. The
  old bundle remains unchanged and is never mutated in place.

## Control/Continuity parity and source handling

Control is the current derived controller fact; Continuity records whether the
effect remains applicable across the source's relevant transitions. They must
share an exact parity key, preferably `(effectId, affectedObjectId)` plus the
source identity where the lane contract requires it. A parity check must
reject duplicates, missing counterparts, mismatched controller/player IDs,
mismatched duration, and mismatched source/zone boundary.

The Registry is authoritative for current object existence and current zone.
An effect source is not kept alive by a copied name, printed card, or stale
object ID. A source that is absent from Registry may be pruned only by an
explicit lifecycle/transition operation that returns a complete new bundle;
validation of a caller-supplied authoritative slice reports the dangling
reference. Pruning must:

1. inspect and copy the input;
2. remove only derived records whose source is provably missing under the
   owning contract;
3. remove the matching Control and Continuity counterpart together;
4. re-run all dependent validators from the Registry forward; and
5. return either the fully validated bundle or failure, never an intermediate.

Do not prune an object from Registry, a player, a turn record, an explicit
user decision, or a source whose zone rule is merely unknown. Unknown CR 613
dependencies are not evidence that a source is missing.

## EOT expiry and turn-start activation

Expiry is logical Turn state, not wall-clock state. An until-end-of-turn
record must be keyed to the originating turn context, at minimum the
canonical `turnNumber` and the explicit phase/position boundary required by
the lane contract. At the first operation observed in a later turn, expired
derived Control/Continuity records are removed as one paired pruning step
before dependent validation. The original bundle is unchanged.

Expiry must not be implemented as `Date.now()`, a timeout, an implicit array
position, or a comparison against a duplicated turn number. If the turn
context is missing or inconsistent, fail with a temporal cross-slice error;
do not guess whether the effect expired.

Turn-start activation is an explicit operation boundary. It may activate only
records whose declared activation boundary is the current Turn position and
whose source/authority dependencies validate. It must not grant priority,
perform turn-based actions, move cards, or resolve an effect. The operation is
atomic: all eligible activations are applied in deterministic declared order,
or none are applied.

## Canonicalization, immutability, and input preservation

All validators must inspect descriptors safely, reject accessors and unsafe
record keys, preserve array order, and never sort or deduplicate semantic
arrays. Record keys use deterministic code-unit order where the owning
contract defines a map. The canonical root order is the eight-key order above;
slice record order is lane-owned and must be stated explicitly.

Every success value is fresh relative to the input and to every nested input
value. Every object, array, record, issue, and result envelope is deeply frozen.
The input graph is byte/descriptor-equivalent after validation, including on
failure. Canonicalization is a clone operation, not an in-place sort, trim,
merge, deletion of zero values, or mutation of caller arrays/maps.

The acceptance invariant is:

```text
JSON.stringify(validate(x).value) === JSON.stringify(validate(JSON.parse(JSON.stringify(x))).value)
```

for every valid JSON fixture, while field order is canonical and semantic
array order is preserved.

## Operation error taxonomy

Validation returns deterministic sorted issues. Operations throw one stable
operation error only after validating the input operation and current bundle.
Use the existing naming style and keep nested validator issues available:

```text
INVALID_RULE_AUTHORITY_BUNDLE
INVALID_OPERATION_INPUT
DEPENDENCY_MISMATCH
SOURCE_NOT_FOUND
SOURCE_ZONE_MISMATCH
EFFECT_EXPIRED
TURN_START_MISMATCH
CONTROL_CONTINUITY_MISMATCH
VISIBILITY_MISMATCH
DECISION_AUTHORITY_MISMATCH
SEARCH_SESSION_CLOSED
PLAY_PERMISSION_DENIED
CANDIDATE_INVALID
```

`SOURCE_NOT_FOUND` is for an operation that requires a source and cannot
legitimately prune it. `SOURCE_ZONE_MISMATCH` is not interchangeable with
missing source. `DEPENDENCY_MISMATCH`/the domain mismatch codes identify
cross-slice disagreement, not card legality. There is no success result with
an error field and no error result containing a partially updated bundle.

## Future boundaries

Typed Command/Event is deferred: current operations are pure bundle-to-bundle
functions and must not emit or consume a command/event envelope. Projection is
deferred: no network/UI/spectator projection, revision, commandId, websocket,
or serialization policy is implied by canonicalization. Player Exit is
deferred: no concession, seat removal, control transfer, authority fallback,
or search-session cancellation policy is invented here. Combat is deferred:
no attack/block/damage legality or combat-step activation is part of Play
Permission. Card movement, shuffle, reveal events, cast/play commands, timing,
cost legality, Commander rules, Online runtime, and full CR 613 evaluation
remain explicit DEFERs.

## Required cross-slice acceptance tests

The judge-owned review must include, at minimum:

1. Valid four-player fixture: canonical root and nested key order; one shared
   Registry/Runtime/Turn source; JSON round trip; fresh identity at every
   mutable boundary; deep freeze recursively.
2. Root exactness: reject each missing root key, each extra key, symbol key,
   accessor, non-enumerable key, array root, and non-plain prototype; factory
   rejects `/kind`.
3. Dependency order: corrupt Registry and a dependent Visibility/Permission
   field; assert Registry issues are present and no dependent validator reads
   raw/uncanonical input or returns a value.
4. Registry reference closure: missing source, missing affected object, and
   unseated player each fail with deterministic paths; no partial bundle.
5. Control/Continuity parity: delete either counterpart, alter controller,
   duration, source, or order; assert `CONTROL_CONTINUITY_MISMATCH` and no
   derived result.
6. Explicit-order boundary: provide competing effects with caller-supplied
   order; assert the order is preserved and no CR 613 dependency automation is
   attempted.
7. Visibility/authority: hidden object, wrong viewer, wrong searcher,
   selector/decision-maker mismatch, controlled-player mismatch, and active
   player mismatch all deny or fail at their owning dependency, without
   widening visibility.
8. Search lifecycle: open, closed, expired, wrong searcher, stale candidate
   snapshot, and candidate absent from Registry. Closed/expired sessions never
   authorize Play Permission.
9. Play Permission: missing authority, visibility, control, continuity, or
   search dependency denies atomically; positive output does not claim timing,
   card-type, cost, target, cast, or play legality.
10. EOT: same-turn valid record; next-turn paired expiry; missing/inconsistent
    turn context; wall-clock independence; old bundle unchanged.
11. Turn-start activation: activate eligible records once in explicit order,
    reject wrong position/source/authority, and prove failure leaves every
    slice equal to the original.
12. Missing-source pruning: prune only paired derived records through the
    explicit pruning operation; never prune Registry/Turn or an unknown zone
    case; revalidate all dependents after pruning.
13. No partial results: inject failures at every slice and at each cross-slice
    check; assert `ok:false`, complete sorted frozen issues, and absence of
    `value`.
14. Nonmutation/property coverage: randomize insertion order and valid array
    contents; prove input preservation, deterministic canonical output, fresh
    output, deep freeze, and JSON round-trip preservation.
15. Boundary guards: compile-time/architecture tests demonstrate no imports
    from React, Store, Online, Projection, Command/Event, Player Exit, or
    Combat modules and no card movement or CR 613 dependency evaluator.

These tests are acceptance evidence for the additive contract. They do not
authorize integration, public exports, release metadata, or shipment.
