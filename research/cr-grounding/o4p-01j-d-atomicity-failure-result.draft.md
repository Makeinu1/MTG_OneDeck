# O4P-01J lane D — atomicity, failure, and result analysis

Status: `analyzed-not-integrated`

Plan base: `PLAN_SHA=3476e170124158da849dadb5a3031dfda4a28a3c`

This is an architecture analysis only. No O4P-01J transaction implementation
or public transaction surface exists in the inspected tree. The only named
transaction bundle in the plan is `CoreStackTransactionBundleV1`; the plan
requires the result to contain one complete bundle and operation-specific IDs,
but it does not freeze a transaction error union or result-metadata shape
(`research/cr-grounding/o4p-01j-orchestration-plan.draft.md:53-65`). This
missing contract is recorded below; this lane does not invent error codes or
public names.

## 1. Required atomic boundary

The transaction must be a pure local computation over three complete inputs:

1. Registry V2;
2. Runtime V2 validated against that Registry; and
3. Announcement V1 validated against that Registry.

The only observable success is one complete, canonical, deeply frozen bundle
containing all three values. A failure must contain no Registry, Runtime, or
Announcement candidate, even when one or two candidates were successfully
constructed internally. No caller-owned object, store, event log, or other
publication target may be written before the final success boundary.

This follows the O4P-01I lifecycle rule that a future atomic operation produces
one valid committed transition or no transition, and that committed payload is
not itself a Command or Event (`research/cr-grounding/o4p-01i-d-committed-lifecycle.draft.md:218-235`).

## 2. Pre-validation

Pre-validation is the hostile-input-safe inspection phase. It must occur before
semantic operation work and before any candidate is allocated:

- inspect every raw input as an `unknown`-shaped value;
- reject arrays, class instances, accessors, symbols, non-enumerable fields,
  unknown fields, sparse arrays, unsafe record keys, and unreadable Proxy
  descriptors;
- preserve caller array order and record meaning; do not trim, coerce,
  default, sort, deduplicate, merge, or mutate; and
- catch inspection failures and convert them to the already-existing
  constituent validation issue form.

Registry V2 already takes a descriptor snapshot before reading the root and
returns a frozen failure result rather than leaking an inspection exception
(`src/engine/core/object/objectRegistryValidationV2.ts:883-896`). Its record
and array readers use descriptors rather than invoking accessors
(`src/engine/core/object/objectRegistryValidationV2.ts:241-409`). Runtime V2
first validates the identity input and prefixes those failures under
`/identity` (`src/engine/core/object/objectRegistryValidationV2.ts:1006-1029`).
Announcement V1 catches Registry validation failure and reports the existing
`INVALID_OBJECT_REGISTRY` issue (`src/engine/core/stack/stackAnnouncementValidationV1.ts:208-218`).

The transaction must perform this baseline validation in one fixed order:

1. raw operation shape and descriptors;
2. Registry V2 input;
3. Runtime V2 input against the validated Registry;
4. Announcement V1 input against the validated Registry; and
5. operation-specific semantic inputs and cross-references.

The order is observable only through issue ordering; all returned issues must
be deterministically sorted. A transaction may reuse the existing validators,
but it must not allow a failed baseline validator to be replaced by a later
candidate or by an empty/default value.

## 3. Operation input validation

After the current bundle is valid, operation inputs are validated without
building a candidate:

- a card-spell commit must identify exactly one current card object outside the
  stack, accept only an existing card identity, and validate the supplied stack
  controller/announcement shape without claiming timing, payment, or legality;
- a synthetic stack-object commit must validate the existing synthetic identity
  family and generated ID form, reject an occupied ID, and accept only
  spell-copy, activated-ability, or triggered-ability stack objects;
- retarget must identify one existing stack object and validate a replacement
  announcement structurally. Target existence and target legality remain
  outside this milestone because Announcement V1 deliberately accepts
  historical target references;
- card-spell movement out of the stack must identify exactly one current card
  object in `zones.shared.stack`, validate the existing destination contract,
  and reject same-zone behavior; and
- synthetic cease must identify exactly one current synthetic stack object and
  reject a card or a card/token Runtime row as the removal target.

The existing card transition demonstrates the useful ordering and guards:
input read, identity validation, destination validation, Runtime validation,
exact source lookup, same-zone rejection, then candidate construction
(`src/engine/core/transition/cardZoneTransition.ts:205-240`). Its existing
operation-adjacent classifications include `SOURCE_NOT_FOUND`,
`SOURCE_DUPLICATED`, `SAME_ZONE_TRANSITION`, `INVALID_LIBRARY_INDEX`, and
`TRANSITION_CANDIDATE_INVALID` (`src/engine/core/transition/cardZoneTransition.ts:39-48`).
Those are V1 transition codes, not an O4P-01J transaction code union; they must
not be silently reinterpreted as a new public O4P-01J contract.

## 4. Candidate construction order

Once pre-validation and operation input validation pass, construction must be
strictly local and ordered as follows:

1. construct a Registry candidate, including zone membership and old/new ID
   replacement where the operation changes card identity;
2. construct a Runtime candidate against that Registry candidate, removing the
   old card row and creating the existing default post-zone-change row for a
   new card ID, while never creating rows for synthetic stack objects;
3. construct an Announcement candidate against that Registry candidate,
   replacing or removing the exact `byObject` entry as required; and
4. cross-validate the complete candidate triple before assembling the success
   result.

The Registry candidate must continue to satisfy exact-one-zone membership,
object-ID/identity-kind agreement, card incarnation agreement, and token,
spell-copy, and ability zone restrictions. Registry V2 performs those checks
in its semantic pass (`src/engine/core/object/objectRegistryValidationV2.ts:942-961`).
Runtime V2 must then have exactly the card/token object set and no synthetic
rows (`src/engine/core/object/objectRegistryValidationV2.ts:1031-1065`).
Announcement V1 must have exactly the candidate stack object set, the same
bottom-to-top order, and kind parity (`src/engine/core/stack/stackAnnouncementValidationV1.ts:222-250`).

Existing reusable construction pieces are:

- `nextCoreCardIncarnationV1` and `nextCoreCardObjectIdV1` for explicit card
  reincarnation, including the existing overflow behavior;
- `coreSpellCopyObjectIdOfV2`, `coreActivatedAbilityObjectIdOfV2`,
  `coreTriggeredAbilityObjectIdOfV2` and the existing synthetic identity
  validators/factories;
- `removeCoreObjectIdExactlyOnceV1` and `insertCoreObjectIdAtV1` for fresh,
  frozen, non-mutating zone arrays; and
- the Registry V2, Runtime V2, and Announcement V1 validators/factories and
  canonicalizers.

`applyCoreCardZoneTransitionV1` is useful precedent for card old/new identity,
zone replacement, and Runtime reset, but it returns only V1 identity/runtime,
wraps candidate failure as a raw `Error` in `issues`, and has no Announcement
candidate (`src/engine/core/transition/cardZoneTransition.ts:240-276`). It
therefore cannot be treated as the complete O4P-01J atomic boundary.

## 5. Candidate cross-validation and success-only publication

Cross-validation must be performed on the candidate triple, not inferred from
the operation edits:

- Registry candidate validates all current objects and all zone references;
- Runtime candidate validates Registry/Runtime cross-state constraints such as
  face index, battlefield-only status fields, attachments, and exact row set;
- Announcement candidate validates stack set/order, identity kind mapping,
  ability-text rules, target/choice/distribution/cost nested structure, and
  committed-only fields; and
- the final triple must be rechecked as one coherent state before publication.

The transaction must not expose the Registry candidate after Registry success,
must not expose Registry+Runtime after Announcement failure, and must not
publish a candidate before deep-freezing the complete bundle and operation
metadata. An exception from any validator/factory is failure, never permission
to publish the candidates already built.

## 6. Input non-mutation and hidden partial candidates

All existing successful validators return fresh canonical values. Registry V2
and Runtime V2 canonicalization deep-freeze their nested output, and
Announcement V1 canonicalization deep-freezes records and nested values
(`src/engine/core/object/objectRegistryCanonicalizationV2.ts:183-219`,
`src/engine/core/stack/stackAnnouncementCanonicalizationV1.ts:15-23`). Existing
tests also pin input non-mutation for V2 Runtime and Announcement values
(`src/engine/core/object/__tests__/objectRuntimeV2.test.ts:15-35`,
`src/engine/core/stack/__tests__/stackAnnouncementValidationV1.test.ts:12-24`).

The transaction must preserve that boundary for operation inputs, old bundle
inputs, nested target records, old snapshots, and all arrays. It must never
freeze caller input as a shortcut. Removed snapshots must be fresh historical
values, not references that can be altered through the input after return.

There is a reuse hazard in the old transition: candidate failure is represented
as `issues: [error]` (`src/engine/core/transition/cardZoneTransition.ts:259-275`).
The transaction failure result must not leak raw Error objects, candidate
references, stack traces, or partial values. Nested failures must be plain,
frozen issue data with deterministic paths and codes.

## 7. Exact error classification and nested issues

There is no O4P-01J transaction error-code union in the plan or source at this
SHA. Registry and Runtime validation codes are currently open `string` aliases
(`src/engine/core/object/objectRegistryValidationV2.ts:61-120`); Announcement
V1 has a closed, existing union containing `INVALID_OBJECT_REGISTRY`,
`STACK_OBJECT_SET_MISMATCH`, `ANNOUNCEMENT_KIND_MISMATCH`, `INVALID_ORDER`,
`INVALID_ABILITY_TEXT`, target/distribution/cost errors, and the structural
codes (`src/engine/core/stack/stackAnnouncementValidationV1.ts:23-40`).
Consequently, the exact top-level O4P-01J classification is a contract gap.
Lane D does not name a replacement code or public error type.

Until the judge freezes that union, the safe classification rule is:

- preserve existing constituent Registry, Runtime, Announcement, identity,
  zone-destination, stack-object, and card-reincarnation codes in nested issues;
- preserve all issues, not only the first one;
- retain source paths with deterministic context when crossing a component
  boundary; and
- classify a thrown hostile-input inspection as the existing `INVALID_TYPE`
  style issue where the reused validator already does so, rather than leaking
  the thrown value.

The existing validators already deduplicate by path/code and sort by code-unit
path and code (Registry/Runtime: `src/engine/core/object/objectRegistryValidationV2.ts:203-238`;
Announcement: `src/engine/core/stack/stackAnnouncementValidationV1.ts:60-65`).
The transaction must not collapse nested issues into a single generic failure,
translate a known code to an invented code, or attach non-deterministic Error
objects. The existing `TRANSITION_CANDIDATE_INVALID` code is limited to the V1
card-zone transition and is not evidence of an O4P-01J code contract.

## 8. Hostile nested input and failure injection

The existing hostile-input coverage is strong for Registry V2, target
selections, and the top-level Announcement `byObject` record. Registry V2
contains safe descriptor handling for revoked/nested Proxies, and its tests pin
that boundary (`src/engine/core/object/__tests__/objectRegistryValidationV2.test.ts:136-154`).
Target selection array inspection is wrapped in a catch
(`src/engine/core/stack/targetAnnouncementV1.ts:189-235`).

There is a remaining hostile-input gap before treating Announcement V1 as a
total transaction validator: `choiceAnnouncementV1.ts` calls `Array.isArray`
and reads `value.length` without an enclosing inspection catch, and the
Announcement record validator delegates to it without a catch
(`src/engine/core/stack/choiceAnnouncementV1.ts:148-190`,
`src/engine/core/stack/stackAnnouncementValidationV1.ts:190-201`). A revoked
Proxy or a throwing length trap nested in chosen modes, variables,
additional costs, or distributions can therefore escape the Announcement
boundary. The transaction must catch and classify such a failure before any
candidate is published. This is a HIGH contract/reuse finding for the frozen
acceptance surface; no source fix is made in this lane.

Failure injection should be test-local and cover each boundary without adding
a production injector or public name:

1. unreadable root and nested descriptors/accessors/Proxy traps;
2. invalid operation input after a valid current bundle;
3. card incarnation overflow through the existing `Number.MAX_SAFE_INTEGER`
   guard;
4. duplicate or occupied synthetic ID;
5. Registry candidate invalidity;
6. Runtime candidate invalidity after a valid Registry candidate;
7. Announcement candidate invalidity after valid Registry and Runtime
   candidates; and
8. final bundle deep-freeze/canonicalization inspection failure.

Each injected failure must prove that the original three inputs remain bytewise
unchanged, no candidate is returned, no old/new metadata is returned as a
success artifact, and no later component is published. The pure design means
test cases should force failures with malformed/hostile values and boundary
integers, not monkey-patch production internals.

## 9. Deterministic output and deep freeze

Successful Registry and Runtime values use existing canonicalizers that sort
record keys while preserving semantic zone/stack array order. Announcement
canonicalization preserves stack and semantic selection order while its
validator rejects unsorted lists where the contract requires sorted unique
keys (`research/cr-grounding/o4p-01i-stack-announcement.contract.draft.md:266-282`).
The transaction must preserve those rules and never sort a stack to make a
candidate pass.

Failure output must be deterministic for the same hostile input: complete issue
set, RFC 6901 paths, existing codes/messages, code-unit ordering, frozen issue
objects, and a frozen issue array. Success output must be a fresh deeply frozen
bundle, including nested metadata and removed snapshots. Top-level
`Object.freeze` on the bundle alone is insufficient.

The existing Announcement sort compares path then code, while Registry and
Runtime also compare message on a full tie. This is safe only if the component
validators retain their existing deterministic contracts; the transaction
must not introduce a second competing sort or depend on insertion order.

## 10. Result metadata, old/new IDs, and removed snapshots

The following is the required metadata semantics, not a proposal for new field
names. The plan permits only operation-specific IDs in addition to the complete
bundle, so any additional snapshot surface requires judge approval and must not
be invented by lane D.

| operation | old ID | new ID | removed snapshots on success |
|---|---|---|---|
| card-spell commit | source card ID | next card incarnation ID | source Registry card identity and source Runtime row; no prior Announcement row |
| synthetic stack-object commit | none | caller-seeded synthetic stack-object ID | none; no Runtime row exists |
| immutable retarget | same stack object ID | same ID | prior Announcement record for that ID, if removal metadata is exposed; Registry and Runtime are unchanged |
| card-spell movement out of stack | current stack card ID | next card incarnation ID | old Registry card identity, old Runtime row, and old Announcement record |
| synthetic-object cease | current synthetic stack-object ID | none | old synthetic Registry identity and old Announcement record; no Runtime row |

For card movement, the old/new relationship must preserve physical-card ID and
advance incarnation using the existing V1 reincarnation rules. The new card
Runtime row is the existing default post-zone-change value, not a copied stack
row (`src/engine/core/transition/cardZoneTransition.ts:240-275`). For synthetic
objects, the registry and announcement removal must be simultaneous; a
synthetic object must never acquire a Runtime row.

If removed snapshots are not part of the judge-frozen result metadata, they
must not appear in a hidden partial error or an ad hoc success property. If
they are included, they are success-only, historical, fresh, canonical, and
deeply frozen. Failure returns neither old/new IDs as a partial result nor any
removed snapshot.

## 11. No-op operations

No-op semantics are not frozen by the plan and must be resolved by the judge
without inventing a code. The atomic invariant is unambiguous:

- a no-op must not allocate a new card incarnation or synthetic ID;
- it must not add/remove/reorder a stack object or Runtime row;
- it must not create a replacement Announcement snapshot merely for identity;
- it must not expose hidden candidates; and
- it must not imply a Command, Event, revision, or commandId change.

The likely no-op case is retargeting to an announcement structurally equal to
the current record. Whether that is accepted as a fresh canonical unchanged
bundle or rejected using an already-frozen operation code is a contract
decision. Missing source, duplicate source, duplicate synthetic ID, and cease
of an absent object are not silently converted to success/no-op.

## 12. Replay, Event, Command, revision, and commandId boundaries

O4P-01J must not add `Command`, `Event`, replay-log, actor, authority,
visibility, revision, or commandId data to Registry V2, Runtime V2,
Announcement V1, or the transaction result. O4P-01I explicitly defers
Command/Event, revision, and commandId (`research/cr-grounding/o4p-01i-stack-announcement.contract.draft.md:300-308`).

The transaction is replay-safe only in the narrow pure-function sense: the
same canonical before-bundle and the same operation input produce the same
canonical after-bundle and the same structural metadata. It does not emit an
Event, consume a commandId, increment a revision, or append to a replay log.
A later command/event milestone may record the before/after bundle around this
pure boundary; that envelope is outside O4P-01J. On every O4P-01J failure,
there is no accepted transition and therefore no transaction-level event or
revision publication.

## 13. Findings to carry into contract freeze

1. The all-or-nothing construction order is clear: pre-validate, validate
   operation inputs, Registry candidate, Runtime candidate, Announcement
   candidate, cross-validate, then publish one frozen result.
2. Existing validators/factories and zone/reincarnation helpers are reusable,
   but the V1 card transition is not a complete V2 triple transaction and its
   raw-Error candidate wrapper must not be reused as nested failure data.
3. The exact O4P-01J transaction error union and result metadata shape are not
   present at PLAN_SHA. This is a contract freeze blocker; this lane adds no
   code or public name.
4. Announcement V1 has an uncovered hostile nested-array exception path via
   `choiceAnnouncementV1.ts`; transaction-level containment is required before
   claiming total failure classification.
5. No-op policy and removed-snapshot exposure require judge decisions. Until
   frozen, no implementation may infer either behavior.
6. Replay/Event/Command/revision/commandId remain outside this structural
   transaction and must not be smuggled into result metadata.

Changed file: `research/cr-grounding/o4p-01j-d-atomicity-failure-result.draft.md`

Status: `analyzed-not-integrated`
