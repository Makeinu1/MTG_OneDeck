# O4P-01J Lane B: Synthetic Stack-Object Lifecycle

- Milestone: `O4P-01J`
- Lane: `B` — independent Domain Analyst
- Grounding anchor: `PLAN_SHA=3476e170124158da849dadb5a3031dfda4a28a3c`
- Rules authority: pinned `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, effective 2026-06-19
- Existing contracts: O4P-01H Universal Object Registry & Non-Card Stack Substrate V2 and O4P-01I Stack Announcement Payload & Lifecycle V1
- Status: `analyzed-not-integrated`

## Executive ruling

The synthetic stack lifecycle is a structural three-way transaction over the
existing Object Registry V2, Object Runtime V2, and Stack Announcement V1.
The transaction must create or remove one synthetic stack object and its
announcement record together, while preserving the runtime's exact card/token
key set. A successful commit is either a spell-copy, an activated-ability, or
a triggered-ability object at the tail of the one shared bottom-to-top stack.
A successful cease removes that synthetic object from the registry, stack, and
announcement record as one operation; it does not move it to a card zone and
does not create a PhysicalCard or runtime row.

The operation validates the complete input bundle before publishing a result.
Failure exposes no partial registry, runtime, or announcement. Success returns
a fresh, canonical, deeply frozen complete bundle plus only the operation's
object identifier(s). No public TypeScript API names are selected by this
analysis.

## Ground facts from O4P-01H and O4P-01I

O4P-01H defines the universal ObjectId families and the identity union. The
three relevant families are `@spell-copy:<seed>`,
`@activated-ability:<seed>`, and `@triggered-ability:<seed>`; the seed uses the
existing Core base-ID grammar. H's spell-copy identity contains a definition,
controller, and `copiedFromObjectId`. Its activated- and triggered-ability
identities contain a controller, nullable `sourceObjectId`, and stable
`abilityKey`. These fields are visible in the implemented object substrate at
`src/engine/core/object/objectIdV2.ts:4-16,87-116,135-145` and
`src/engine/core/object/tokenObjectV2.ts:80-106,451-515`.

H also requires a synthetic object to be in the stack, requires every live
registry object to occur in exactly one zone, and accepts historical
provenance references without requiring the referenced object to remain in the
current registry. Its runtime is keyed exactly by card and token identities;
synthetic stack objects have no runtime row. The implemented cross-checks are
at `src/engine/core/object/objectRegistryValidationV2.ts:545-581,656-700,
883-975,1018-1078`.

O4P-01I defines four exact announcement kinds and maps the H registry kind to
the announcement kind. Its `byObject` key set equals the registry's shared
stack set, and its record order equals the bottom-to-top stack order. Copies
require a null ability-text snapshot; activated and triggered abilities
require a nonempty immutable text snapshot. The announcement is historical
data, not a liveness, legality, payment, or resolution proof. The I contract
also requires strict malformed-input rejection, fresh canonical values, deep
freeze, and input non-mutation.

## Lifecycle matrix

| Topic | Required invariant for the synthetic transaction |
| --- | --- |
| ObjectId prefix/kind agreement | Parse the candidate ObjectId and require exact agreement: `@spell-copy:` with `spell-copy`, `@activated-ability:` with `activated-ability`, and `@triggered-ability:` with `triggered-ability`. A card-shaped or token-shaped ID cannot represent a synthetic object. |
| Collision | Never overwrite an existing registry key, stack entry, or announcement key. The exact candidate ObjectId must be absent before commit. Different prefixes are different families even when their seeds match; the same prefix and seed is the same candidate key and therefore collides. No allocator, random ID, timestamp, or retired-ID table is invented here. |
| Controller | Spell-copy controller is the player under whose control the copy is put on the stack (CR 707.10). Activated-ability controller is the activator (CR 113.8/405.4). Triggered-ability controller is the controller of the source when it triggered, with delayed-trigger rules remaining the caller's already-resolved fact (CR 603.3a/405.4). The controller must be a seated player and is not re-derived from a possibly absent source. |
| Definition | A spell-copy must reference an existing `cardDefinitions` entry, because H makes its definition part of the identity. Activated and triggered abilities do not gain a card definition or card characteristics; their committed announcement carries the required ability text snapshot. No copyable-values derivation is performed. |
| Historical source/copy references | `copiedFromObjectId` and `sourceObjectId` must be canonical ObjectIds when present, but their targets may be historical and absent from the current registry. A missing source does not invalidate an already committed ability and never causes lookup by name or silent rebinding to a same-name object. `null` is the explicit no-current-source form allowed by H for abilities. |
| No Runtime row | The runtime bundle's `byObject` set remains exactly the H card/token set. Commit does not add a row for any of the three synthetic kinds; cease does not remove a synthetic row. Any pre-existing synthetic row is malformed input and causes failure. |
| Announcement kind parity | Registry `spell-copy` maps only to announcement `spell-copy`; `activated-ability` maps only to `activated-ability`; `triggered-ability` maps only to `triggered-ability`. A card-spell record is not valid for a synthetic object, and a synthetic record is not valid for a card object. |
| Stack tail insertion | The single `zones.shared.stack` array is bottom-to-top. Commit appends exactly one new synthetic ObjectId at the array tail, so it is topmost. Existing entries and their relative order are unchanged; no second ordering field and no sorting are allowed. |
| Middle removal | Cease removes exactly one occurrence of the target ObjectId from its existing stack position and preserves the relative order of every remaining entry. It deletes the corresponding registry identity and announcement key in the same candidate result. It must reject zero occurrences or duplicate occurrences rather than guess. |
| Cease semantics | A spell-copy may not be represented in a non-stack zone: CR 704.5e/707.10a says a copy of a spell outside the stack ceases to exist. An activated or triggered ability remains independent of its source while on the stack (CR 113.7a), then leaves the stack when countered, resolved, or otherwise removed (CR 405.1, 603.3, 608.2n); it is not moved to a card zone. Synthetic cease therefore means absence from the live registry, all zones, announcements, and runtime—not exile, graveyard, or a replacement PhysicalCard. |
| PhysicalCard non-use | Synthetic commit does not add to `physicalCards`, does not create a `kind: card` identity, does not consume a card incarnation, and does not use card owner/controller derivation. This follows CR 405.1's no-card-associated ability objects and CR 112.1a/707.10's cardless spell copies. |
| Zone exact-one | After commit, every live object—including the new synthetic one—occurs in exactly one zone array, and the synthetic one occurs in `zones.shared.stack` exactly once. After cease, the removed synthetic object occurs in no zone because it is no longer a live registry object; every remaining registry object still occurs exactly once. Historical references do not count as zone membership. |
| Announcement exact parity | After commit, announcement keys equal the complete shared-stack ObjectId set, including the new tail entry, and preserve stack order. After cease, the removed key is absent and every remaining stack entry has exactly one record. No announcement record may exist outside the stack. |
| Malformed inputs | Fail closed on wrong root literals, noncanonical or family-mismatched IDs, wrong discriminants, missing/unknown fields, invalid definitions, unseated controllers, invalid ability keys/text, bad source/copy references, duplicate or stale zone membership, wrong stack zone, stale runtime keys, missing/stale announcement keys, wrong announcement kind, noncanonical arrays, accessors, symbols, proxies that cannot be inspected, sparse arrays, and extra fields. Return the deterministic complete issue set; never repair the input. |
| Input non-mutation | Inspect descriptors without invoking accessors, never sort or splice caller arrays, never deduplicate, trim, default, coerce, or delete caller data, and never reuse mutable nested input as output. Inputs remain byte/shape-equivalent from the caller's perspective after both success and failure. |
| Canonical result | On success return one complete Registry V2 + Runtime V2 + Announcement V1 bundle, with canonical record/field ordering, semantic stack order retained, fresh nested values, and deep freeze. On failure return only the frozen deterministic issues/error; no partial candidate bundle or partial identifier is exposed. |

## Commit cases

### Spell-copy commit

The candidate identity must be a `spell-copy` identity whose ObjectId has the
spell-copy prefix, whose definition exists, and whose controller is seated.
The copy is put directly on the stack; it is not cast and no PhysicalCard is
associated with it. The announcement kind is `spell-copy` and its ability-text
snapshot is exactly `null`. Any copied decisions already supplied in the
announcement are preserved as immutable announcement data, but this lane does
not derive or execute copyable values and does not decide whether any choice or
target was legal.

The `copiedFromObjectId` is provenance. It must remain the exact historical
reference supplied by the committed input and may outlive the referenced
registry entry. It must not be replaced by the current object with the same
name, and it must not be made into a zone member merely because the copy refers
to it. If the candidate ObjectId already exists, the transaction fails without
altering the original object or announcement.

### Activated-ability commit

The candidate identity must be an `activated-ability` identity with a matching
activated-ability ObjectId family, a seated controller, a nullable canonical
source reference, and a valid stable ability key. The announcement kind is
`activated-ability` and its text snapshot is the exact nonempty text supplied
at the committed boundary. The source may leave the zone or disappear after
commit without removing this stack object; source-dependent current/LKI
behavior is a later resolution concern.

CR 605 remains a hard boundary: a mana ability that does not use the stack is
not silently converted into this synthetic stack object. Activation legality,
cost calculation/payment, and priority are also outside this structural
commit.

### Triggered-ability commit

The candidate identity must be a `triggered-ability` identity with a matching
triggered-ability ObjectId family, a seated controller, a nullable canonical
source reference, and a valid stable ability key. The announcement kind is
`triggered-ability` and its text snapshot is the exact nonempty text of the
ability that created it. This commit represents the already-placed stack
object, not a pending trigger. Trigger detection, APNAP placement, and the
legality checks that can remove a triggered ability before placement remain
outside this transaction.

The controller is the historical controller determined at trigger time; it is
not recomputed from the source after the source moves or disappears. The
ability remains a standalone stack object until its later removal boundary.

## Atomic commit and cease boundary

The candidate transition has two phases:

1. Validate the input registry, runtime, announcement, requested synthetic
   identity, and requested announcement as one bundle. Validate all cross-slice
   invariants before editing any candidate collection.
2. Construct fresh candidate Registry, Runtime, and Announcement values. For a
   commit, append the new ObjectId to the stack, add one identity, leave the
   runtime key set unchanged, and add one matching announcement. For a cease,
   remove one middle stack entry, delete its identity and announcement, and
   leave the runtime key set unchanged. Revalidate the complete candidate
   bundle, then publish it only if every check succeeds.

The original bundle is never edited in place. Any failure at either phase
returns no state transition. In particular, an invalid announcement cannot
leave behind an identity, and an ObjectId collision cannot leave behind a
stack append.

The cease operation is synthetic-object removal, not a generic zone move. A
spell-copy that would be placed in any zone other than the stack is rejected or
ceased according to the CR boundary; it is never routed through the card zone
transition because it has no PhysicalCard. An ability's source zone movement
does not itself cause cease. Removal caused by countering, resolution, or a
rule/effect is the event boundary that requests cease; resolution effects and
destinations are not implemented here.

## Canonical and malformed-result requirements

The H and I validators establish the required shape discipline:

- ObjectId parsing is strict and canonical. At-sign synthetic families cannot
  collide with the non-at-sign card form; family mismatch is still an error.
- Identity discriminants and exact fields are closed. A spell-copy cannot carry
  ability fields, and an ability cannot acquire a spell-copy definition field.
- Seated-player and card-definition references are checked where H requires
  them. Historical source/copy references are syntax/provenance checks, not
  current-registry membership checks.
- Registry zones are the only stack representation. The tail is top; middle
  removal does not reorder the remaining objects.
- Runtime entries are exactly for card/token identities. Synthetic rows are
  rejected rather than ignored.
- Announcement records use exact kind parity and exact key parity with the
  stack. Copies use `null` text; abilities use the supplied immutable text.
- Arrays whose order carries meaning retain their input order. Canonical record
  keys may use deterministic code-unit ordering, but canonicalization never
  sorts the semantic stack or repairs unsorted contract data.
- Successful values are fresh and deeply frozen. Errors/issues are deterministic
  and complete, and both paths preserve input.

## Explicit DEFER

This analysis does not define or implement copyable-values derivation, copy
effect execution, legality or target legality, proposal/activation/trigger
detection, cost calculation or payment, priority, APNAP execution, resolution,
replacement/prevention effects, current/LKI source lookup, event/command
envelopes, actor authority, projection, Online, Solo integration, persistence,
UI, or final public TypeScript API names. A valid structural commit is not
evidence that the source action was legal, that a cost was paid, or that the
object can resolve.

## Changed file and status

Changed file: `research/cr-grounding/o4p-01j-b-synthetic-stack-lifecycle.draft.md`

Status: `analyzed-not-integrated`.

No implementation, ledger, docs, AGENTS.md, review test, package file, or git
operation was performed.
