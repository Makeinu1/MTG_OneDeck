# O4P-01I-D: Committed Stack Object Lifecycle Analysis

- Milestone: `O4P-01I`
- Role: Domain Analyst
- Base: `PLAN_SHA=5418d82`
- Status: `analyzed-not-integrated`
- Authority: pinned `rule/Magic_The_Gathering_Comprehensive_Rules.txt` (effective 2026-06-19)
- Existing contracts: O4P-01H Universal Object Registry & Non-Card Stack Substrate V2, O4P-01H-C, O4P-01H-F, O4P-01H-H, O4P-01H-R, and `o4p-01i-orchestration-plan.draft.md`.

## Executive ruling

O4P-01I-D should define only the historical record of an object after its
announcement/placement on the stack is committed. It must preserve the
choices and references that were fixed at that boundary, without claiming that
they were legal, paid, or ready to resolve. Proposal, choices-in-progress,
payment-in-progress, and any illegal-action rollback state must never enter
this slice. They are transient procedure state under CR 601.2/602.2 and are
discarded or rolled back before a committed stack object exists.

The slice is a structural, immutable payload attached by object identity. It
does not create objects, perform a transaction, reorder the stack, retarget,
resolve, remove, or calculate last-known information. Future O4P-01J owns the
atomic command that turns an eligible announcement into one stack commit and
the commands that remove or retarget it.

## Grounding and vocabulary

CR 405.1 makes a card spell, activated ability, or triggered ability a stack
object at its respective placement point. CR 405.2 requires one shared ordered
stack, with each new object on top; CR 405.4 gives spells their card
characteristics and gives stack abilities their defining text and no other
characteristics. CR 601.2a-i is the casting procedure, CR 602.2/602.2a-b is
the activated-ability procedure, and CR 603.2-603.3d is the trigger-to-stack
procedure. CR 113.7a gives an activated or triggered ability independence from
its source after placement. CR 400.7 supplies the limited new-object
exceptions; it is not a general identity-preservation rule. CR 608.2b and
608.2h remain resolution-time rules, not announcement validation.

O4P-01H supplies universal object IDs, exact registry/zone membership, a
bottom-to-top `zones.shared.stack`, historical-capable source references, and
no runtime row for spell-copy or ability objects. O4P-01I adds only committed
announcement payload fields and preserves that H contract exactly.

## Twenty lifecycle topics

### 01. Proposed spell or ability

`proposed` is a procedure phase, not a stack object and not a payload kind.
The proposal may fail before any object is committed. No proposed action,
actor authority, priority proof, or partially selected values may be serialized
in O4P-01I. CR 601.2a and 602.2a describe the beginning of the procedure;
CR 603.2 describes triggering before placement, not committed placement.

### 02. Choices-in-progress

Modes, targets, X, division, alternative/additional-cost choices, and ability
choices being gathered are transient. A committed record may contain an
immutable snapshot of choices only after the applicable CR procedure reaches
the stack-placement boundary. It is historical data, not a claim that the
choice was legal or that a choice UI was completed. Choices normally made on
resolution remain absent; CR 707.10 copies only decisions already made, not
resolution choices.

### 03. Payment-in-progress

`payment-in-progress` must never enter this slice. CR 601.2f-h and 602.2b make
cost determination and payment part of the procedure; partial payments are
not allowed under 601.2h. Mana-ability activity is not a committed stack
payload, and a qualifying mana ability does not use the stack (CR 405.6c,
605.3b). Store a cost-choice snapshot only as historical announcement data
after successful completion, never as a live payment ledger, resource delta,
tap/discard/sacrifice draft, or proof of payment.

### 04. Illegal action and rollback

If a casting step is illegal, CR 601.2e returns the game to the moment before
the proposal. If activation cannot comply at any point, CR 602.2 returns to
the moment before activation and announcements/payments cannot be altered
afterward. Therefore rollback is an external transaction concern: no
committed object, payload, audit event, or save record may be emitted for a
failed procedure. A future command may report a rejected attempt, but that is
not an O4P-01I committed lifecycle record.

### 05. Committed card spell

At the committed boundary a physical card is the spell object on the stack
(CR 405.1, 601.2a and 601.2i). The registry object ID remains the H V2 card
incarnation identity; do not create a second identity merely for the spell
role. Payload may retain the announcement choices, selected targets, variable
values, cost choices, divisions, and relevant text snapshot as immutable
historical fields. The record does not authorize casting or resolution.

### 06. Committed spell copy

A spell copy is a stack object without an associated card (CR 112.1a,
707.10). It is not cast. Its payload may preserve copied decisions and the
historical source/copy reference, with an explicit copied-versus-cast kind.
CR 707.10c allows a copy effect to choose new legal targets; that choice is
future copy/retarget procedure, not an automatic O4P-01I operation. A spell
copy outside the stack ceases to exist under 704.5e/707.10a.

### 07. Committed activated ability

CR 602.2a creates a non-card object on top of the stack with the activator as
controller and the text of the ability. O4P-01H's `activated-ability` identity
and nullable historical source reference are the substrate. The payload may
snapshot activation-time choices and cost choices after the procedure
commits; it must not imply that the ability was legal, that costs were paid,
or that the source still exists. A mana ability remains outside this normal
stack path when CR 605 applies.

### 08. Committed triggered ability

CR 603.2 first creates a trigger event; CR 603.3 puts the ability on the stack
when a player would receive priority. The committed object is therefore the
post-trigger, post-placement object, not the pending trigger. Its controller
is determined under CR 603.3a/405.4, including delayed-trigger exceptions.
CR 603.3b-d controls APNAP ordering and choices at placement; O4P-01I stores
the resulting historical record but does not perform APNAP or trigger
collection.

### 09. Exact stack-object key parity

Every committed record must identify exactly one live H V2 registry object,
and every supported committed stack object must have exactly one record. The
record key set must equal the committed stack-object key set: no missing,
stale, duplicate, cross-kind, or card-runtime key is permitted. A card spell,
spell copy, activated ability, and triggered ability are all addressable by
the universal object ID, but only the H identity union determines their kind.
The payload must not become a second object registry.

### 10. Exact stack order and mixed parity

The only order is `zones.shared.stack`, bottom-to-top, with the last element
topmost. CR 405.2 and O4P-01H prohibit a second `stackOrder` field. Spell and
ability objects share this one order; the payload is not an ordering log and
must not sort, deduplicate, or infer APNAP order. Validation may compare
record keys to the stack set while preserving the semantic array order.

### 11. Removal, countering, and resolution exit

Removal is a future lifecycle command. A spell may resolve, be countered, or
move elsewhere; an ability is removed when it resolves or is otherwise moved
(CR 405.1, 608.2n). An instant/sorcery spell is put into its owner's graveyard
at resolution; a permanent spell can become a new permanent object with the
limited CR 400.7 continuity. A removed object must no longer have a committed
payload, but O4P-01I does not perform that deletion or state transition.

### 12. Retarget

Retargeting is not an O4P-01I mutation. Targets chosen during announcement
are historical immutable references. A future effect/command may create a
copy with new legal targets under CR 707.10c, or a rules-defined effect may
change targets; it must validate legality at that later boundary. The original
payload is never edited in place. O4P-01J owns retarget command semantics and
atomicity.

### 13. Immutable fields

The following are immutable once committed: object ID and kind, source and
copied-from references, controller-at-placement metadata where the contract
requires it, ability key/text snapshot, modes, targets, announced variable
values, cost-choice snapshot, and division assignments. A successful value is
fresh, canonical, deeply frozen, and input-preserving in the H validator
style. Historical references may point to an object no longer in the current
registry; that does not resurrect it or make the reference a live zone member.

### 14. Replaceable/current fields

Current characteristics, controller changes, target legality, source
availability, continuous effects, replacement/prevention effects, and
resolution-time information are not frozen as if they were immutable
announcement facts. If a future rules procedure needs a derived current value,
it must derive it from current state and the applicable CR layer. A payload
field may preserve a snapshot only when explicitly historical; it must not
serve as a mutable override or silently replace registry/runtime truth.

### 15. Source disappearance and LKI

After an activated or triggered ability is on the stack, source destruction or
zone movement does not remove the ability (CR 113.7a). At resolution, current
information or last known information is selected according to CR 113.7a and
608.2h; target checks use CR 608.2b. O4P-01I stores a source object ID and,
where separately authorized, a historical source snapshot/reference. It does
not implement source lookup, LKI capture, or source-following, and a missing
current source is not validation failure for an already committed ability.

### 16. Ability text and trigger persistence

An activated or triggered stack ability has the text of the ability that
created it and no other characteristics (CR 405.4, 602.2a, 603.3). The
committed record may retain an immutable `abilityTextSnapshot` and stable
`abilityKey` for audit/replay identity. This text is not a live Oracle parser
result and does not change when the source later changes zones or text. A
pending trigger is not persisted as a committed ability; once placed, its
trigger identity/controller and committed choices persist until the stack
object exits.

### 17. Object versus payload

The H registry identity is the game object; the I payload is an attached
historical announcement record. They have separate responsibilities:

| Concern | Object/registry | Committed payload |
| --- | --- | --- |
| identity, kind, zone, controller invariant | authoritative | reference only |
| one shared stack order | `zones.shared.stack` | none |
| choices fixed at placement | none in H identity | immutable snapshot |
| source/copy provenance | identity relation/reference | historical contextual snapshot if contracted |
| current runtime/status | H runtime for card/token only | never a replacement |
| resolution legality and effects | future engine | never claimed |

Do not put payload fields into identity/runtime, and do not use payload to
manufacture a second stack, object ID, controller, or payment state.

### 18. Command responsibility

O4P-01I may define types and pure validation/canonicalization for a committed
record. It must not implement `propose`, `choose`, `pay`, `activate`, `cast`,
`put-trigger-on-stack`, `remove`, `retarget`, or `resolve` commands. A future
command boundary must receive a complete fixed input and produce either one
valid committed transition or no transition; it must not expose partial
payment or choice writes.

### 19. Event, audit, and save/reload responsibility

Committed payload is suitable for deterministic audit and save/reload because
it is explicit, immutable, canonical data. It is not itself an Event and must
not claim that a command succeeded. A future `Command` records intent, a
future `Event` records an accepted atomic result, and an audit record can
compare the event's before/after object and payload parity. Save/reload must
round-trip the exact canonical payload and stack array, reject unknown or
stale keys, and never reconstruct proposal/payment state from a committed
record. No protocol, revision, actor authority, or online envelope belongs in
this slice.

### 20. Future atomic transaction

The future transaction (O4P-01J) must atomically validate the applicable
announcement procedure, create or select the H object identity, attach the
complete payload, and insert the object into the existing bottom-to-top
stack— or commit none of those effects. It must also define atomic removal and
retarget transitions, with deterministic command/event/audit boundaries.
O4P-01I must not pre-implement that transaction, reserve IDs implicitly,
mutate a payload after freezing, or treat a valid structural record as proof
of CR legality/payment. The explicit boundary is therefore:

`proposal -> choices/payment/legality (transient) -> one future atomic commit -> immutable payload`

Only the final segment is in this slice.

## Required contract consequences

1. Exclude `proposal`, `choices-in-progress`, `payment-in-progress`, illegal
   rollback, priority, legality, resolution, and transaction state from all
   persisted O4P-01I fields.
2. Preserve O4P-01H exact registry, runtime, and single-stack invariants;
   committed records are exact-key validated against stack objects.
3. Keep snapshots immutable and historical. Do not auto-sort semantic arrays,
   trim, deduplicate, merge, fill defaults, or mutate caller input.
4. Keep target/source references stable and historical; retarget and LKI are
   explicit future operations, not in-place payload edits.
5. Treat spell, spell-copy, activated ability, and triggered ability as distinct
   committed kinds while preserving their common stack lifecycle and CR-specific
   controller/text rules.
6. Mark this analysis `analyzed-not-integrated`; it authorizes no implementation,
   ledger/docs/review-test change, integration, or release status.

## Explicit DEFER list

Object allocation, proposal UI/state, choices, payment, legality, priority,
APNAP execution, trigger detection, stack commit transaction, stack removal,
retargeting, resolution, replacement/prevention effects, current/LKI source
lookup, copyable-values derivation, CR 707 execution, projections, online
protocol, actor authority, and save migration are all outside O4P-01I-D.
