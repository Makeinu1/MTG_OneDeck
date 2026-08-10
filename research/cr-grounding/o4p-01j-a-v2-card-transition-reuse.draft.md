# O4P-01J-A: V2 Card-Transition Reuse Analysis

Base requested by the lane: `PLAN_SHA 3476e170124158da849dadb5a3031dfda4a28a3c`.
This is an architecture analysis only. It does not implement a transaction,
freeze the final contract, or choose final public TypeScript names.

## 1. V1 reusable parts

The reusable part of O4P-01G is the card-only semantic kernel, not the V1
function as a whole.

- `validateCoreCardZoneDestinationV1` remains the authority for the existing
  destination union, owner-library placement (`top`, `bottom`, or checked
  index), owner hand/graveyard routing, shared-zone routing, and explicit
  battlefield/stack base controller. This preserves the O4P-01G rule that a
  destination is never repaired, trimmed, or inferred.
- `nextCoreCardIncarnationV1` and `nextCoreCardObjectIdV1` are reusable for
  the deterministic CR 400.7 new-object representation. They preserve the
  existing `<physical-card-id>:<incarnation>` bytes and the explicit
  `Number.MAX_SAFE_INTEGER` overflow failure.
- `createDefaultCoreCardRuntimeAfterZoneChangeV1` and its strict predicate are
  reusable as the one reset constructor and oracle for the new card row.
  The existing orientation, counter/damage, and attachment value-object
  factories and validators must continue to be used.
- The V1 card identity shape and its owner/controller checks remain reusable
  through the V2 registry's V1 projection. The current V2 validator already
  validates the complete V2 object set and zones separately, then uses a
  card-only V1 projection for card invariants (`objectRegistryValidationV2.ts`
  lines 926-982).

The non-reusable part is `applyCoreCardZoneTransitionV1` as a transaction
driver. Its result has only Identity/Zone V1 plus card Runtime V1, and its
candidate builders intentionally enumerate only V1 card records and V1 zone
arrays (`cardZoneTransition.ts` lines 205-276). O4P-01J needs one candidate
containing Registry V2, Runtime V2, and Announcement V1, followed by one
cross-validation boundary. Copying the V1 driver would make preservation an
accidental property rather than a checked invariant.

## 2. Preservation of non-card objects and exact runtime key set

For every card transition, every untouched non-card object must remain present
with the same identity payload, provenance fields, zone, and relative position.
This includes tokens on the battlefield, spell copies on the stack, and
activated/triggered ability objects on the stack. Their historical
`sourceObjectId` or `copiedFromObjectId` references are structural payloads;
they must not be rewritten merely because a card incarnation changes. The
V2 contract explicitly allows historical references to be absent from the
current registry (`o4p-01h-universal-object-registry.contract.draft.md`
lines 80-85).

The successful Runtime V2 value must have exactly the key set

    { objectId | registry.objects[objectId].kind is card or token }

and no other keys. Thus a card transition removes the old card key and adds
the new card key; it does not create rows for spell copies or abilities, and it
does not remove or rewrite token rows. This is the exact invariant in the V2
contract (lines 118-128) and in the current validator (`objectRegistryValidationV2.ts`
lines 1031-1045). Record-key canonicalization may make key enumeration
deterministic, but semantic key membership and every untouched row value must
be preserved.

The announcement slice has a parallel preservation rule: all untouched
records survive unchanged, while its key set remains exactly the current
shared-stack object set. A card entering the stack therefore changes both
Registry and Announcement membership; a card leaving the stack removes the
corresponding record. No synthetic object is silently converted into a card or
given a runtime row.

## 3. Card incarnation and old/new ObjectId behavior

CR 400.7 requires the moved card to be a new object. The current V1 algorithm
advances exactly once, constructs the next ID from the same physical card, and
sets the new identity's base controller to the destination controller only
for battlefield/stack destinations (`cardZoneTransition.ts` lines 236-248).

The V2 transaction must preserve this exact replacement relation:

- old `objectId` is absent from `objects`, every zone array, Runtime V2, and,
  when it was a stack object, Announcement V1;
- new `objectId` is the same physical card with `incarnation + 1`, appears in
  exactly one destination zone, and is the only live object for that physical
  card;
- no unrelated ObjectId is regenerated, and no seed, random value, clock, or
  hidden allocator is consulted;
- references in unrelated announcement records are not retargeted. They are
  historical selections under O4P-01I, not liveness links.

`PC:0 -> PC:1` is a replacement, not an alias or a second live copy. Overflow
at the maximum safe incarnation must fail before any candidate is exposed.
The V1 helper tests already pin the one-step increment and overflow behavior;
the V2 tests must add mixed-stack and non-card neighbors to those cases.

## 4. Exactly-one physical card

`physicalCards` is not changed by a zone transition. The physical-card record
continues to have exactly one live `kind: "card"` object. The candidate must
remove the old card entry before inserting the new entry, and the zone edit
must remove the old ID before inserting the new ID. The V2 validator's
card-only V1 projection enforces `PHYSICAL_CARD_NOT_IN_EXACTLY_ONE_OBJECT`,
while the V2 layer enforces that every object occurs in exactly one zone
(`objectRegistryValidationV2.ts` lines 942-960; `identityZoneValidation.ts`
lines 727-763).

Acceptance must reject all of these rather than repairing them: old and new
IDs both live for one physical card; two new incarnations for one physical
card; a new ID in two zones; an old ID left in a zone after its registry entry
is removed; or a new registry entry with an ID/physical/incarnation mismatch.
The exactly-one rule is an invariant of the whole candidate bundle, not a
property that can be checked independently in three partially committed
outputs.

## 5. Source/destination zone and runtime changes

The source is located by scanning all player-scoped zones and all shared zones.
It must occur exactly once. A same-zone operation remains rejected, including
the V1 boundary that excludes same-zone reorder/shuffle. Destination routing
must remain:

- owner-library/hand/graveyard uses
  `physicalCards[physicalCardId].ownerPlayerId`;
- battlefield/stack uses the explicit destination base controller;
- exile/command are shared destinations;
- library top is insertion index `0`, bottom is the pre-insertion length,
  and an explicit index is checked against the pre-insertion length;
- hand, graveyard, and shared-zone insertion retains the V1 append semantics.

For a card-spell commit, source removal, old-object removal, new-object
creation, destination insertion, old runtime-row removal, new reset-row
creation, and announcement addition are one candidate construction. For a
card-spell movement out of the stack, the same replacement moves to the
requested non-stack destination, removes the old stack announcement, and
leaves every other stack object and record in place. A generic card move between
two non-stack zones has no announcement addition/removal.

Runtime changes are therefore keyed to ObjectId, not physical-card ID: remove
`Runtime.byObject[oldId]`, add a fresh default row at `newId`, and preserve all
other card and token rows. The final Registry, Runtime, and Announcement must
be validated together because Runtime V2 checks zone-sensitive orientation,
damage, and attachment constraints against Registry V2.

## 6. Reset defaults

The new card row must be the exact value returned by
`createDefaultCoreCardRuntimeAfterZoneChangeV1`:

- `orientation`: `faceIndex: 0`, `faceDown: false`, `tapped: false`,
  `flipped: false`, `phasedOut: false`;
- `counterDamage`: `counters: []`, `markedDamage: 0`;
- `attachment`: `attachedTo: null`.

The root, all nested value objects, and the counters array must be fresh and
deeply frozen. No prior row is copied, and no fields are carried through as a
convenience. This follows CR 122.2 for counters and the O4P-01G reset policy;
entry modifiers, replacement effects, face-down entry, phasing, meld, and
Commander replacement remain outside this transition reuse analysis. Runtime
cross-validation may reject a reset row only if the surrounding candidate is
otherwise inconsistent (for example, a bad definition/zone relationship); it
must not silently add defaults to an invalid input.

## 7. Announcement add/remove

O4P-01I is committed-only: an announcement record exists exactly for each
current stack object, with kind mapping `card` to `card-spell`, and with no
proposal/payment/status fields (`o4p-01i-stack-announcement.contract.draft.md`
lines 203-225 and 10). The transition transaction must not derive announcement
choices from Oracle text, re-read a source object, or invent a partial record.

- Card-spell commit adds one complete `card-spell` record under the new stack
  ObjectId. Its `abilityTextSnapshot` is `null`; the remaining choices are
  supplied as the committed announcement payload and validated as a record.
- Card-spell movement out of the stack removes the old ObjectId's record and
  does not create a destination record.
- Immutable retarget replaces the record value under the same stack ObjectId;
  it changes neither the announcement key set nor Registry/Runtime.
- Synthetic cease removes the synthetic registry object and its announcement
  together; synthetic objects never gain a card runtime row.

The transaction must construct the new `byObject` map and validate its exact
key set against the candidate stack. It must not call the existing standalone
announcement factory first and then expose a Registry/Runtime candidate, or
the three slices could disagree between calls.

## 8. Stack order

There is one stack representation: `registry.zones.shared.stack`, bottom to
top; the last element is the top. Announcement `byObject` enumeration order
must match that same array, and there is no second `stackOrder` field. The
current announcement validator enforces both exact key membership and order
(`stackAnnouncementValidationV1.ts` lines 222-250).

For card-spell commit, append the new card ObjectId to the stack and append
its announcement record at the matching top position. For movement out,
remove the old card ObjectId and its record while preserving the relative order
of all remaining stack objects. In a mixed stack such as card, spell copy,
activated ability, triggered ability, a card removal must leave the latter
three in exactly that order; a card commit must not sort all records by ObjectId.
Canonical record-key sorting is not a substitute for semantic stack-array
order.

## 9. Why the V1 API cannot be called directly

Calling `applyCoreCardZoneTransitionV1` with V2 data is not a safe adapter.
Its input contract accepts a V1 identity slice and V1 card-runtime slice, while
V2 stores all identities in `objects` and Runtime V2 admits card and token
rows. More importantly, the existing V1-to-V2 implementation deliberately
projects V2 to V1 by retaining only `kind: "card"` objects and filtering every
zone array to those card IDs (`objectRegistryCanonicalizationV2.ts`
lines 248-273 and `objectRegistryValidationV2.ts` lines 499-519).

That projection is correct for V1 validation and downgrade-free adapter
boundaries, but it is lossy for a transaction: token/copy/ability objects and
their mixed-stack positions disappear. Calling V1 and upgrading its result
would therefore lose non-card objects, change stack order, omit their
announcements, and potentially make the returned bundle appear valid only
because the missing objects were never checked. It also returns no announcement
candidate and cannot atomically add/remove one. Direct invocation would violate
O4P-01H's additive preservation contract and O4P-01I's exact stack-object set.

V1 may still be used for a card-only parity oracle or for shared validators on
a deliberately card-only projection. It must not be used as the V2 mutation
driver.

## 10. Internal helper extraction

The safe reuse shape is to extract an unexported card mutation primitive from
the V1 driver, then have two wrappers:

1. the existing V1 wrapper keeps its current input inspection, error vocabulary,
   V1 validation, V1 result shape, and behavior;
2. the O4P-01J transaction wrapper supplies V2-aware source lookup and
   candidate containers, invokes the same card semantics for incarnation,
   destination routing, replacement, and runtime reset, then builds and
   cross-validates the complete V2/V1 bundle.

The helper must operate on supplied immutable snapshots/builders or on a
card-focused edit description. It must not own a second ObjectId parser,
destination grammar, reset constructor, or controller rule. It must also not
filter a V2 zone to cards. The V2 wrapper must explicitly preserve all
non-card entries before applying the card edit and must make old/new ID
replacement visible to the final cross-validator.

The helper remains private to the transition/transaction implementation. A
public alias would freeze an intermediate representation and invite callers
to bypass the Registry/Runtime/Announcement atomic boundary.

## 11. Regression risks

- A V1-style `cardObjects` rebuild can drop every non-card object or reorder a
  mixed stack.
- Filtering Runtime V2 by card IDs can accidentally drop tokens, while copying
  every registry object into Runtime creates forbidden spell-copy/ability rows.
- Keeping the old ObjectId creates a stale announcement/runtime row or breaks
  CR 400.7; keeping both old and new violates exactly-one physical card.
- Reusing an old runtime row leaks tap, face, counters, marked damage, or
  attachment state across the new-object boundary.
- Appending the new announcement independently from the stack edit can produce
  a missing, extra, or incorrectly ordered record.
- Sorting a stack or announcement map by ObjectId destroys bottom-to-top
  semantics; canonical record-key order must not be applied to semantic arrays.
- A destination helper that uses the active player instead of the owner or
  explicit base controller regresses the O4P-01G owner/controller divergence.
- Calling standalone V2 factories in sequence can expose a valid intermediate
  Registry with an invalid Runtime/Announcement combination, defeating the
  O4P-01J atomic result boundary.
- Changing the existing V1 implementation while extracting the helper can
  regress its error codes, descriptor-safe rejection, deep-freeze depth,
  no-mutation guarantee, or same-zone/library-index behavior.
- Treating token/copy cease or replacement exceptions as generic card moves
  would cross the O4P-01H/O4P-01J deferred CR boundary.

## 12. Public versus private API

Existing O4P-01G public module exports, V1 types, error behavior, fixtures, and
direct-import behavior remain unchanged. The V2 transaction's public surface
should expose only the frozen atomic input/result/error contract approved by
the judge: one complete Registry V2, Runtime V2, and Announcement V1 result,
plus only operation-specific ObjectIds as permitted by the O4P-01J plan. It
must not expose partial candidates, mutable builders, projection adapters, or
the internal card-edit primitive.

The final public TypeScript names are intentionally not selected in this lane.
The architecture requirement is the boundary: callers cannot invoke a helper
that updates only one slice, and existing V1 callers cannot observe a behavior
change merely because the implementation shares an internal kernel.

## 13. Property-test strategy

Use generated, already-valid V2 bundles containing arbitrary combinations of
card and token battlefield rows plus mixed stack rows (card spells, spell
copies, activated abilities, and triggered abilities), with Runtime V2 exactly
matching the card/token subset and Announcement V1 exactly matching stack
order. Generate valid source cards and all V1 destination forms, including
owner/controller divergence and library placement boundaries.

For every successful card transition, assert:

- every untouched registry object, non-card zone position, token runtime row,
  non-source card runtime row, and untouched announcement record is preserved;
- the old/new ObjectId relation is one increment, the old ID is absent, the new
  ID is present once, and each physical card has exactly one live card object;
- Runtime V2 keys equal the card/token object set exactly, with the new row at
  the reset default and no synthetic rows;
- Announcement keys equal the stack array exactly and enumerate in the same
  bottom-to-top order;
- all three outputs are deeply frozen, deterministic across repeated calls,
  fresh where mutation could alias input, and the input bundle is unchanged.

Add a card-only metamorphic parity property: project a valid V2 case to the
V1 card-only domain, run the existing V1 transition, and compare the card
portion of the V2 result with the V1 result. This is a regression oracle only;
the V2 test must additionally assert preservation of the objects and records
that the projection intentionally omits. Add sequence properties for repeated
valid zone changes to prove incarnation increases once per successful move.

Generate invalid cases by duplicating/moving source IDs, stale runtime keys,
synthetic runtime rows, missing/extra/reordered announcements, bad destination
indices, same-zone destinations, bad controllers, and incarnation overflow.
Assert deterministic complete failures, no partial result, and unchanged input.

## 14. Failure-injection strategy

Failure injection must exercise the transaction's stages without adding a
production failure hook or widening the public API. The test-only plan is:

- inject malformed roots, unknown/accessor/symbol fields, and invalid V2/V1
  components at initial bundle validation;
- inject source-not-found, duplicate-source, same-zone, invalid destination,
  invalid library index, and incarnation-overflow cases before candidate
  construction;
- inject a candidate with old/new duplication, a missing zone entry, a
  mismatched card ID, a stale/extra Runtime key, a non-default new row, or a
  missing/extra/reordered announcement, then require final cross-validation to
  reject it;
- inject a synthetic object into a card runtime edit and a card runtime row
  into a synthetic stack object, proving the exact V2 key-set guard is active;
- if helper-level fault coverage is needed, pass a test-only internal builder
  or validator seam to the private helper and make it throw at each candidate
  stage. That seam must not be exported or reachable from the public
  transaction. The production path must use the real validators and no
  injectable callback.

For every injected failure, capture only an error/failure result: no partial
Registry, Runtime, or Announcement is observable. Compare serialized input
before and after, check that no nested input object was mutated, and repeat the
same injection to verify deterministic issue ordering/code. Include a hostile
mixed stack in every relevant injection so a failure cannot be masked by a
card-only projection.

Changed file: `research/cr-grounding/o4p-01j-a-v2-card-transition-reuse.draft.md`

Status: `analyzed-not-integrated`
