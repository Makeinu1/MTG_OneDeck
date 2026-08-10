# O4P-01I-B target and distribution analysis (draft)

Status: analyzed-not-integrated

Role: Domain Analyst

Milestone: `O4P-01I-B`  
Base: `PLAN_SHA=5418d82`  
Source boundary: pinned local Comprehensive Rules effective 2026-06-19 and
the current Core O4P-01H V2 shape. This is a requirements analysis, not an
implementation contract. It does not change O4P-01H identity or runtime
objects and does not choose TypeScript names, wire formats, UI behavior, or a
candidate-selection algorithm.

## Current shape that this analysis must preserve

O4P-01H has a mode-neutral object registry keyed by universal `CoreObjectId`.
The identity union distinguishes card, token, spell-copy, activated-ability,
and triggered-ability objects. Tokens are battlefield-only; spell copies and
activated/triggered abilities are stack-only. The stack is the existing shared
bottom-to-top zone array; its array order is the only stack order. The runtime
rows cover card and token objects only. `sourceObjectId` and
`copiedFromObjectId` are provenance references; a historical reference need
not remain in the current registry. These facts are the substrate for this
analysis, not permission to add announcement state to identity/runtime.

The target/distribution payload therefore needs to be an immutable, committed
announcement-side value associated with a stack object, whose references can
name objects or players that were selected at announcement time. It must not
pretend that a reference is a live object, that an affected object is
necessarily a target, or that a target selection has already been resolved.

## CR anchors

- CR 109.1, 112.1-112.2, and 113.1c/113.7 define objects, spells, stack
  abilities, sources, and the distinction between a stack ability and its
  source.
- CR 115.1-115.10 define targets, target declaration, target identity,
  repeated target words, zero targets, target changes, division/distribution,
  current legality, and the distinction between targets and affected objects.
- CR 400.7-400.10 define new-object identity after zone changes and the
  limited exceptions that can find or preserve a moved object.
- CR 401.1-401.2 and 406.1-406.3 establish ordered library/exile-zone
  representation and hidden-zone information boundaries.
- CR 601.2a-e and 602.2a-b establish announcement timing for spells and
  activated abilities; CR 603.3b-d establishes triggered-ability placement
  and target choice.
- CR 608.2b, 608.2h, 608.2i, and 608.2j govern resolution-time target
  legality, information from the source/last-known information, and
  impossible instructions. CR 608.3 governs the result of resolving an
  object.
- CR 707.10 and 707.10c-f establish that copied spells/abilities copy the
  original decisions, including targets and division, while new-target
  permission is explicit.
- CR 101.3-101.4 and 101.4a-d govern impossible instructions and ordered
  simultaneous choices. CR 107.1, 107.1b, and 107.3 govern numbers and
  announced variable values.

## Twenty required topics

### 1. Object references

An object selection identifies a game object, not a card name, printed name,
definition ID, or current map position. The natural Core reference is a
canonical `CoreObjectId`; it must remain distinct from the O4P-01H physical
card ID and from a source snapshot. CR 115.1 and 109.1 support object targets;
CR 400.7 explains why the reference cannot silently mean every later object
represented by the same physical card.

### 2. Player references

A player selection is a player identity, not an object ID and not a UI seat
label. It must use the existing seated-player identity domain and remain
distinct from a player’s controlled objects. CR 102.1 and 115.1 identify
players as targetable entities; CR 113.8 distinguishes controller from the
source or object being affected.

### 3. Historical references

The payload may retain a reference to an object that is no longer live in the
current registry. This is a historical announcement fact, not a requirement
that O4P-01H keep a tombstone row or reconstruct the object. The reference
must be distinguishable from a live lookup failure. CR 400.7 and 113.7a allow
specific effects to use a moved object or source/LKI, but do not make all old
references live.

### 4. Liveness

Liveness is evaluated separately from selection identity. A selected object
can be recorded while live and become non-live before resolution; a player
reference can become unavailable under future game rules. The payload must
not rewrite or delete the original selection when liveness changes. A later
legality/resolution layer decides whether the recorded reference is usable.

### 5. Zone change

A zone change creates a new object by default (CR 400.7). Therefore a stored
object reference does not automatically follow a card from battlefield to
graveyard, or from one public zone to another. Only a specific CR exception,
such as a public-zone move being findable by the effect that caused it, may
bridge that transition. Token/copy cease rules and zone-transition commands
remain outside this analysis.

### 6. Groups

Selections need an explicit group/slot structure rather than one flattened
set. A group represents one semantically distinct target or distribution
instruction (for example, one target word, one mode branch, or one affected
recipient group). Group identity is structural and ordered; it must survive
serialization and copying. It must not be inferred from display labels.

### 7. Selection identity

Each selected occurrence needs a stable slot identity within its group, while
the referenced object/player identity is stored as its value. This preserves
the difference between “the same object chosen for two target occurrences”
and “one deduplicated object.” CR 115.3 and 115.9a count target occurrences,
not merely distinct current objects.

### 8. Duplicate selections within a group

Duplicate occurrences are not universally legal or illegal. CR 115.3 forbids
choosing the same target more than once for one instance of “target,” but
allows reuse across separately worded target instances. The representation
must preserve duplicates and leave the per-effect rule to a future legal
predicate; it must not deduplicate during canonicalization.

### 9. Duplicate selections across groups

The same object/player may occur in different groups when the underlying
effect has separate target instances or separate distribution instructions.
Cross-group equality therefore cannot be treated as a global uniqueness
constraint. Group-local semantics and the card/effect wording determine the
constraint; the payload records the occurrences faithfully.

### 10. “Up to” quantities

“Up to N” describes a choice range, not a requirement to fill N slots. The
announcement must preserve the chosen count and the declared upper bound (or
the source expression that determines it) without padding absent selections.
CR 601.2c and 115.6 support variable/zero target counts; no default maximum
selection is implied by the data shape.

### 11. Zero selections

Zero can be a meaningful announced choice where the effect permits it. An
empty selection is not equivalent to an omitted target field, an untargeted
effect, or an invalid payload. CR 115.6 explicitly allows a targeted spell or
ability to require zero targets, so validation must preserve an explicit zero
cardinality.

### 12. Order

Order is semantic wherever the effect, target wording, APNAP choices, or
distribution instruction makes it semantic. Preserve source/group order and
within-group selection order; do not sort by object ID, player ID, name, or
zone position. CR 101.4/101.4c and 601.2c-d establish ordered choices, while
CR 405.1-405.4 make the existing stack array order independently meaningful.

### 13. Division amounts

For a divide/distribute instruction, each recipient occurrence needs its
announced nonnegative amount, associated with the exact selection occurrence
rather than only with a distinct object. The payload must preserve the
division as announced, including repeated recipients where the effect permits
them. CR 601.2d requires the division during announcement and CR 115.7f says
target changes do not change the original division.

### 14. Division totals

The payload should retain enough information to verify the declared total
against the effect’s announced quantity, including a variable value when
already announced, but it must not silently recompute, normalize, or repair a
total. A total mismatch is a validation/legality issue for a later layer. CR
601.2b-d and 107.3 distinguish an announced X/value from later resolution
information; CR 101.3 handles impossible instructions rather than authorizing
best-effort redistribution.

### 15. Target change

Target changes are a separate operation over the committed selection. “Change
the target(s),” “change a target,” “change any targets,” and “choose new
targets” have different all-or-some and unchanged-illegal behavior under CR
115.7a-d. A target-change record must preserve the original group/slot
identity and division amounts; it may replace only references permitted by the
effect. CR 115.7e evaluates the final set, while 115.7f forbids changing the
original division.

### 16. Resolution legality

Announcement-time acceptance and resolution-time legality are different
checks. On resolution, the future resolver must examine the current target
objects/players and the spell or ability’s target requirements. CR 608.2b
applies the all-targets-illegal result, and CR 115.9b says current information
is used only when the referenced object is still in its expected zone or the
player is still in the game. This analysis does not define the legal predicate.

### 17. Stale representation

A stale reference is not a malformed reference. A well-formed historical
selection can be stale because its object changed zones, ceased to exist, or
no longer satisfies the effect. Canonicalization must preserve it and expose
the distinction to later validation/resolution; it must not replace it with a
name lookup, current object with the same physical card, or null.

### 18. Confidentiality

Selection identity and visibility are separate concerns. A reference to a
card in a hidden zone must not disclose its identity to players who cannot see
that card. The committed payload may carry an opaque object identity for the
engine, while projection and protocol decide who may see which characteristics
or selection facts. CR 401.2, 406.2-406.3, and 701.20/701.20e support the
hidden-zone boundary. No visibility policy is fixed here.

### 19. Target-slot multiplicity and count

The payload must distinguish target-slot count from the number of distinct
referenced identities. A spell with two target occurrences can have two slots
that happen to reference the same player/object when the wording permits it;
an “up to” effect can have fewer slots than its upper bound; and zero is an
explicit count. This is the structural bridge between CR 601.2c, 115.3,
115.6, and 115.9a. It is not a candidate generator.

### 20. Target versus affected object/player

Only an object/player identified as a target by the effect or keyword rule is
in the target payload. Objects affected later without being targeted are not
silently added to the selection groups. CR 115.10-115.10b makes this
distinction explicit; resolution-time affected sets and resulting state belong
to a later outcome layer.

## Explicitly unfixed / deferred

This analysis deliberately leaves the following unfixed:

- candidate generation and candidate ordering;
- legal predicates, including the complete treatment of hexproof, shroud,
  protection, and other target restrictions;
- resolution outcomes, effect application, replacement/prevention handling,
  state-based actions, and final `GameState` projection;
- player-exit model and its impact on stored player references or stack
  objects;
- `Projection`, including confidentiality/redaction and any public/private
  serialized view;
- target grammar, mode selection, X-expression evaluation, cost/payment,
  retarget command semantics, copying execution, and protocol/UI concerns.

These deferrals are intentional. O4P-01I-B may describe the committed
target/distribution facts and their invariants, but it does not claim that a
target can be generated, legally selected, retargeted, resolved, or projected
by the current engine.
