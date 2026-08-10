# O4P-01J Atomic Stack Commit, Retarget & Removal Transaction V1

Status: frozen by judge after independent grounding lanes
Milestone: O4P-01J
Initial BASE_SHA: `2cd27710e690ae12cdcacfde6d9ac544ab85201f`
PLAN_SHA: `3476e170124158da849dadb5a3031dfda4a28a3c`
Ruleset: pinned local CR `2026-06-19` only
Authority: `user-ruling-2026-08-10`

This is an additive pure Core transaction contract. It joins the existing
Object Registry V2, Object Runtime V2, and Stack Announcement V1 values into
one success boundary. It does not implement action legality or resolution.

## 1. Grounding and adjudication

The five independent lanes are recorded as `analyzed-not-integrated`:

- `o4p-01j-r-stack-transaction-cr-matrix.draft.md`
- `o4p-01j-a-v2-card-transition-reuse.draft.md`
- `o4p-01j-b-synthetic-stack-lifecycle.draft.md`
- `o4p-01j-c-retarget-contract.draft.md`
- `o4p-01j-d-atomicity-failure-result.draft.md`

The pinned CR resolves the deterministic boundaries:

- CR 112.1-2: a spell is a card on the stack, copies can be spells without a
  card, and owner/controller are distinct;
- CR 115.7-8: target replacement is separate from mode replacement and
  choose-new-targets preserves unchanged targets when permitted;
- CR 400.7: a zone change creates a new object unless a listed exception
  applies;
- CR 405.1-2: card spells and cardless abilities share one ordered stack;
- CR 405.4: a spell has a controller;
- CR 601.2, 602.2, and 603.3: card spell, activated-ability, and
  triggered-ability stack-entry boundaries;
- CR 608.2n and 608.3: supplied structural exit destinations are distinct
  from resolution and its cause;
- CR 701.6: countering is a later rule action, not inferred here; and
- CR 707.10 and 707.10c: copies preserve decisions, and new-target legality
  is a later boundary.

The contract therefore accepts already-validated structural inputs and never
claims that a cast, activation, trigger, target change, payment, counter, or
resolution was legal. The R-lane matrix grouped some source-zone variants for
analysis; this frozen contract expands them into separate acceptance pins so
each required source/destination case is independently executable.

## 2. Existing contract preservation

The following are unchanged and are not edited by this milestone:

- `ModeNeutralCoreIdentityZoneSliceV1`;
- `ModeNeutralCoreCardRuntimeSliceV1`;
- `ModeNeutralCoreObjectRegistrySliceV2`;
- `ModeNeutralCoreObjectRuntimeSliceV2`;
- `ModeNeutralCoreStackAnnouncementSliceV1`;
- all Core ObjectId V1/V2 formats and existing factories/validators;
- O4P-01G public API and fixtures;
- O4P-01H public API and fixtures;
- O4P-01I public API and fixtures;
- Solo `GameState`, Solo commands, snapshots, and source;
- `CURRENT_CONTRACT_VERSIONS` and `SNAPSHOT_VERSION`; and
- all existing review tests.

No existing type receives an optional field. Registry, Runtime, and
Announcement do not receive transaction status, actor, reason, resolved,
countered, payment, legality, revision, or command metadata.

## 3. Bundle

The transaction bundle has exactly these fields and this order:

```ts
type CoreStackTransactionBundleV1 = Readonly<{
  readonly objectRegistry: ModeNeutralCoreObjectRegistrySliceV2;
  readonly objectRuntime: ModeNeutralCoreObjectRuntimeSliceV2;
  readonly stackAnnouncements: ModeNeutralCoreStackAnnouncementSliceV1;
}>;

type CreateCoreStackTransactionBundleV1Input = Readonly<{
  readonly objectRegistry: ModeNeutralCoreObjectRegistrySliceV2;
  readonly objectRuntime: ModeNeutralCoreObjectRuntimeSliceV2;
  readonly stackAnnouncements: ModeNeutralCoreStackAnnouncementSliceV1;
}>;
```

`validateCoreStackTransactionBundleV1` validates in this fixed order:

1. Object Registry V2;
2. Object Runtime V2 against the validated Registry; and
3. Stack Announcement V1 against the validated Registry.

It reuses the existing validators and canonicalizers; it does not duplicate
their logic. Success returns a fresh canonical, deeply frozen bundle. Failure
returns a deterministic, complete, deeply frozen issue result. The factory
`createCoreStackTransactionBundleV1` throws
`CoreStackTransactionErrorV1` on failure and returns the same canonical frozen
success value. Neither path mutates or freezes its input.

The Registry validator enforces exact one-zone membership and the existing V2
identity rules. Runtime V2 has exactly the key set of Registry objects whose
kind is `card` or `token`; it has no spell-copy, activated-ability, or
triggered-ability row. Announcement V1 has exactly the shared-stack key set
in the existing bottom-to-top array order. Its record kind must match the
Registry object kind.

## 4. Strict input and candidate policy

Every operation first validates the complete input bundle. It then strictly
validates the operation input as `unknown` before constructing a candidate.
Unknown fields, missing fields, symbols, accessors, non-enumerable fields,
sparse arrays, unsafe record keys, invalid canonical IDs, and throwing Proxy
inspection are rejected. Existing validator issues are preserved as frozen
nested issues; raw thrown objects, stack traces, and partial values are never
returned.

All operations then run this exact sequence:

1. validate the input bundle;
2. validate operation input;
3. construct a candidate Registry;
4. construct a candidate Runtime;
5. construct a candidate Announcement;
6. validate the complete candidate bundle; and
7. only after all success, construct and deeply freeze the public result.

No Registry-only, Registry+Runtime, Announcement-only, or other partial
candidate is observable. No callback writes external state. No operation
sorts, trims, deduplicates, defaults, merges, deletes zero values, or mutates
input. IDs are caller-deterministic or derived by the existing incarnation
rule; there is no random, clock, crypto, or network access.

The transaction wrapper catches validator/factory exceptions and maps them to
the frozen transaction error contract. In particular, hostile nested
Announcement choice arrays are contained at the transaction boundary even if
an existing nested validator throws during inspection.

## 5. Card spell commit

```ts
type CoreCardSpellCommitInputV1 = Readonly<{
  readonly sourceObjectId: CoreObjectId;
  readonly controllerPlayerId: CorePlayerId;
  readonly announcement: Extract<
    CoreStackAnnouncementRecordV1,
    { readonly kind: "card-spell" }
  >;
}>;

type CoreCardSpellCommitResultV1 = Readonly<{
  readonly bundle: CoreStackTransactionBundleV1;
  readonly previousObjectId: CoreObjectId;
  readonly committedObjectId: CoreObjectId;
}>;
```

`commitCoreCardSpellToStackV1(bundle, input)` requires:

1. a valid input bundle;
2. a source ObjectId present in Registry V2 with identity kind `card`;
3. the source card present in exactly one zone and not in `shared.stack`;
4. a controller present in Registry `players`;
5. a matching `card-spell` announcement record shape; and
6. no collision for the derived next card ObjectId.

The source may be in `library`, `hand`, `graveyard`, `battlefield`, `exile`,
or `command`. This is a structural permission of this transaction only; no
cast permission, timing, legality, payment, or Commander tax is checked.

The successful candidate removes the source card from its old zone, preserves
its `physicalCardId` and owner through the Registry physical-card relation,
increments its incarnation exactly once, removes the old ObjectId, and adds a
new card ObjectId with `baseControllerPlayerId` equal to the supplied
controller. The new ObjectId is appended to the shared stack. The old Runtime
row is removed and the new row is the existing default post-zone-change
Runtime value. The supplied announcement is added under the new ObjectId.
All unrelated objects, Runtime rows, announcements, and stack order remain
unchanged. The result contains only the complete bundle and old/new IDs.

The existing O4P-01G V1 transition is a reuse reference, not a direct call:
it returns V1 Identity/Runtime only, does not update Announcement, cannot
represent synthetic objects, and has a distinct error surface. A private V2
card edit helper may share safe pieces such as incarnation calculation,
descriptor-safe collection rebuilding, and default Runtime creation, but the
public transaction owns the V2 triple candidate and final validation.

## 6. Synthetic stack commit

```ts
type CoreSyntheticStackCommitInputV1 = Readonly<{
  readonly objectId: CoreObjectId;
  readonly object:
    | CoreSpellCopyObjectIdentityV2
    | CoreActivatedAbilityObjectIdentityV2
    | CoreTriggeredAbilityObjectIdentityV2;
  readonly announcement:
    | Extract<CoreStackAnnouncementRecordV1, { readonly kind: "spell-copy" }>
    | Extract<CoreStackAnnouncementRecordV1, { readonly kind: "activated-ability" }>
    | Extract<CoreStackAnnouncementRecordV1, { readonly kind: "triggered-ability" }>;
}>;

type CoreSyntheticStackCommitResultV1 = Readonly<{
  readonly bundle: CoreStackTransactionBundleV1;
  readonly committedObjectId: CoreObjectId;
}>;
```

`commitCoreSyntheticStackObjectV1(bundle, input)` requires:

1. a valid input bundle;
2. a canonical V2 ObjectId whose family matches `object.kind`;
3. an ObjectId absent from Registry objects and every zone;
4. exact object-kind/announcement-kind parity;
5. a seated `controllerPlayerId`;
6. an existing `cardDefinitions` entry for a spell-copy definition; and
7. strict identity-specific fields and canonical source/copy references.

`sourceObjectId` and `copiedFromObjectId` are historical structural references;
their current existence is not required. The candidate adds the supplied
synthetic identity and appends its ObjectId to the stack. It adds the matching
Announcement record and does not add, remove, or rewrite any Runtime row. It
does not add a PhysicalCard, derive copyable values, execute a copy effect, or
perform source lookup. Tokens, static abilities, mana abilities, pending
triggers, and any other non-stack object are rejected or outside this union;
they do not become synthetic stack objects.

## 7. Immutable retarget

```ts
type CoreStackTargetReplacementV1 = Readonly<{
  readonly selectionId: CoreStackChoiceKeyV1;
  readonly target: CoreStackTargetRefV1;
}>;

type CoreStackRetargetInputV1 = Readonly<{
  readonly objectId: CoreObjectId;
  readonly replacements: readonly CoreStackTargetReplacementV1[];
}>;

type CoreStackRetargetResultV1 = Readonly<{
  readonly bundle: CoreStackTransactionBundleV1;
  readonly objectId: CoreObjectId;
}>;
```

`retargetCoreStackObjectV1(bundle, input)` requires the object to be in the
shared stack with an Announcement record. Replacements must have unique
selection IDs, and every ID must exist in that record. An empty array and a
replacement to the same target are valid structural no-ops. The current
target's existence is never required.

The candidate is an immutable replacement of exactly one Announcement record
for the same ObjectId. It preserves:

- `selectionId`, `groupKey`, and target-selection array order;
- all unspecified target references;
- `chosenModeKeys` and their order;
- `announcedVariables`, including X and its values;
- `distributions` byte-for-byte;
- `costChoices` byte-for-byte;
- `abilityTextSnapshot` and record `kind`;
- Registry object identity, Runtime, and stack order.

The replacement target must pass only the existing structural target-reference
shape and the final candidate Announcement validator. The operation does not
choose targets, generate candidates, check current target existence, check
target legality, inspect protection/hexproof/shroud, alter a mode, alter a
distribution amount, or implement CR 115.7d/707.10c legality. Existing
same-group duplicate target structure remains a validator invariant; a
candidate violating it fails atomically rather than being repaired.

## 8. Stack removal

```ts
type CoreNonStackCardZoneDestinationV1 = Exclude<
  CoreCardZoneDestinationV1,
  { readonly kind: "stack" }
>;

type CoreStackRemovalInputV1 =
  | Readonly<{
      readonly kind: "card-to-zone";
      readonly objectId: CoreObjectId;
      readonly destination: CoreNonStackCardZoneDestinationV1;
    }>
  | Readonly<{
      readonly kind: "cease";
      readonly objectId: CoreObjectId;
    }>;

type CoreStackRemovalResultV1 = Readonly<{
  readonly bundle: CoreStackTransactionBundleV1;
  readonly removedObjectId: CoreObjectId;
  readonly nextObjectId: CoreObjectId | null;
}>;
```

`removeCoreStackObjectV1(bundle, input)` requires the ObjectId to occur in the
shared stack. It may remove a middle or top entry, deletes only that stack
entry, preserves the relative order of every other entry, and deletes the
matching Announcement. It stores no cause, reason, status, resolved flag, or
countered flag.

For `card-to-zone`, the target must be a `card` object. The destination must
not be `stack`. The card keeps its physical-card ID and owner, advances its
incarnation once, removes the old ObjectId, and inserts a new card ObjectId in
the supplied destination. A battlefield destination uses its supplied
`baseControllerPlayerId`; every non-battlefield destination uses
`baseControllerPlayerId: null`. The old Runtime row is removed and a default
new row is added. The new ObjectId is returned as `nextObjectId`.

For `cease`, the target must be a `spell-copy`, `activated-ability`, or
`triggered-ability`. Its Registry identity, stack entry, and Announcement are
deleted together. Runtime is unchanged, no destination object is generated,
and `nextObjectId` is `null`. `card` with `cease`, or a synthetic object with
`card-to-zone`, is rejected. A token cannot be on the stack in a valid bundle
and is not a removal target.

The function is a structural exit primitive. It does not decide countering,
resolution, target recheck, state-based actions, replacement effects, or
permanent-spell copy-to-token conversion.

## 9. Validation, errors, and results

The exported validation surface is:

```ts
type CoreStackTransactionValidationCodeV1 =
  | "INVALID_TRANSACTION_BUNDLE"
  | "INVALID_OPERATION_INPUT"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_NOT_ON_STACK"
  | "SOURCE_ALREADY_ON_STACK"
  | "OBJECT_ALREADY_EXISTS"
  | "OBJECT_KIND_MISMATCH"
  | "ANNOUNCEMENT_KIND_MISMATCH"
  | "INVALID_DESTINATION"
  | "ID_COLLISION"
  | "CARD_TRANSITION_FAILED"
  | "TARGET_SELECTION_NOT_FOUND"
  | "DUPLICATE_TARGET_REPLACEMENT"
  | "RETARGET_STRUCTURE_MISMATCH"
  | "CANDIDATE_INVALID";

type CoreStackTransactionValidationIssueV1 = Readonly<{
  readonly code: CoreStackTransactionValidationCodeV1;
  readonly path: string;
  readonly message: string;
  readonly nested?: readonly Readonly<{
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }>[];
}>;

type CoreStackTransactionValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreStackTransactionBundleV1 }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CoreStackTransactionValidationIssueV1[];
    }>;
```

The top-level error code is this exact union and no implementation lane may
add a member:

```ts
type CoreStackTransactionErrorCodeV1 = CoreStackTransactionValidationCodeV1;
```

`CoreStackTransactionErrorV1` extends `Error`, has
`name === "CoreStackTransactionErrorV1"`, readonly `code`, and deeply frozen
readonly `issues`. Nested constituent validator issues are retained as plain
data. No raw `Error` object is placed in `issues`. Operation failure throws;
the successful result types above contain no actor, reason, legality,
resolved/countered status, payment, event, revision, commandId, timestamp, or
removed snapshot.

The following exports are required from
`src/engine/core/stack/transaction/index.ts`, then `src/engine/core/stack/index.ts`
and `src/engine/core/index.ts`:

- Bundle: `CoreStackTransactionBundleV1`,
  `CreateCoreStackTransactionBundleV1Input`,
  `CoreStackTransactionValidationCodeV1`,
  `CoreStackTransactionValidationIssueV1`,
  `CoreStackTransactionValidationResultV1`,
  `validateCoreStackTransactionBundleV1`,
  `createCoreStackTransactionBundleV1`;
- card commit: `CoreCardSpellCommitInputV1`,
  `CoreCardSpellCommitResultV1`, `commitCoreCardSpellToStackV1`;
- synthetic commit: `CoreSyntheticStackCommitInputV1`,
  `CoreSyntheticStackCommitResultV1`, `commitCoreSyntheticStackObjectV1`;
- retarget: `CoreStackTargetReplacementV1`, `CoreStackRetargetInputV1`,
  `CoreStackRetargetResultV1`, `retargetCoreStackObjectV1`;
- removal: `CoreNonStackCardZoneDestinationV1`,
  `CoreStackRemovalInputV1`, `CoreStackRemovalResultV1`,
  `removeCoreStackObjectV1`; and
- error: `CoreStackTransactionErrorCodeV1`, `CoreStackTransactionErrorV1`.

The private `internalStackTransactionV1.ts` helper is not exported.

## 10. Required acceptance pins

The independent review must cover at least these structural cases:

1. valid Bundle creation from valid Registry/Runtime/Announcement;
2. invalid Registry, Runtime, and Announcement rejection;
3. card commit from hand;
4. card commit from graveyard;
5. card commit from exile;
6. card commit from command;
7. card commit from library;
8. card commit from battlefield;
9. old ObjectId removal, new incarnation, Runtime reset, Announcement add,
   and stack-tail append;
10. spell-copy, activated-ability, and triggered-ability commit;
11. synthetic commit with no Runtime change and no PhysicalCard;
12. duplicate ObjectId and kind mismatch rejection;
13. one-target, all-target, subset-target, and empty/no-op retarget;
14. selectionId/groupKey/order, mode, X, costChoices, distributions,
   ability text, and kind preservation;
15. historical target acceptance without a target-legality check;
16. same-group duplicate structural rejection;
17. card removal to owner graveyard, battlefield, owner hand, exile, and
   command, including battlefield controller and non-battlefield null reset;
18. middle-stack card removal with remaining order preserved;
19. spell-copy, activated-ability, and triggered-ability cease;
20. invalid operation/failure injection with unchanged input and no partial
   result;
21. deep freeze, deterministic canonical JSON, JSON round-trip, and hostile
   accessor/Proxy/non-enumerable/symbol handling;
22. no import or modification of O4P-01G/H/I contracts, Solo source, or
   Online runtime; and
23. no new version axis, package-lock change, dependency, network, clock, or
   random source.

The exact 30-scenario matrix remains the grounding evidence and is pinned by
the following individual scenario families: hand, graveyard, exile, command,
library, battlefield card commit; spell-copy, activated-ability, and
triggered-ability commit; stack-tail append; central-object retarget; all,
subset, and no-op retarget; target group, mode, X, cost, and distribution
preservation; owner-graveyard, battlefield, owner-hand, exile, and command
card exits; synthetic spell-copy/activated/triggered cease; middle removal;
invalid operation; and input non-mutation.

## 11. Atomicity and canonicalization boundary

The three slices are one transaction boundary, not three public updates.
Candidate values are fresh and are canonicalized only through the existing
slice factories/validators. Registry object key ordering follows V2
canonicalization; Runtime key ordering follows its validator; Announcement
record and array semantics follow O4P-01I. Stack arrays are never sorted:
existing order is preserved, commit appends to the tail, retarget leaves order
unchanged, and removal deletes only the requested entry.

Every successful result is recursively deeply frozen. Every failure issue
array and nested issue is recursively deeply frozen. Input remains structurally
unchanged, including when a failure happens after one or two internal
candidates were constructed.

## 12. Explicit DEFER

This milestone does not implement:

- cast/activation proposals, timing legality, cost calculation, Commander tax,
  mana or non-mana payment, rollback, priority, pass, or APNAP;
- target candidate generation, target legality, protection, hexproof, shroud,
  ward, or final target-set legality;
- trigger detection, trigger ordering, resolution, Resolution Context, target
  recheck, effect execution, state-based actions, or replacement effects;
- copyable-values derivation, copy-effect execution, copy comparison,
  choose-new-targets permission derivation, or complete CR 707 automation;
- domain events, Command Envelope, actor, issuedBy, rulesActor,
  DecisionAuthority, Visibility, Projection, Room, revision, commandId,
  Cloudflare, WebSocket, Online, UI, or Solo connection; and
- new version axes, persistence/schema migration, data deletion, dependency
  changes, or network access.

The structural functions may be named commit, retarget, and remove. Their
names do not prove that the corresponding rules action was legal.

## 13. Frozen handoff

Acceptance Author review tests are created from this contract without
implementation history. Implementation status remains
`implemented-not-integrated` until the candidate passes an independent cold
audit. A clean cold audit is `AUDIT-OK-PENDING-FULL-CHECK`; it is not ship
approval. The final full check runs only once on the same fingerprint after
all BLOCKER/HIGH findings are closed.
