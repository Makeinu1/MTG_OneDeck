# O4P-01I Stack Announcement Payload & Lifecycle V1

Status: frozen by the judge after Gate 1 CR/reuse reconciliation.

Milestone: `O4P-01I`  
Base: `5418d82` (PLAN_SHA)  
Ruleset: pinned local CR `2026-06-19` only

## 1. Scope and adjudication

This contract adds an independent Mode-Neutral Core slice for a stack object
whose placement is complete. It records the choices fixed at announcement for
card spells, spell copies, activated abilities, and triggered abilities. It is
not a cast/activation proposal, payment session, legality result, resolution
context, command envelope, event, projection, protocol, or UI.

The five grounding lanes agree on the following CR boundary. CR 601.2b-d and
602.2b/603.3c-d identify announcement choices; CR 601.2e-h and 602.2 include
legality/cost/payment procedure; CR 608.2b rechecks targets; CR 707.10 and
707.10c define copy decision boundaries; CR 405 preserves stack object
identity/order semantics. The Solo matrix found no safe direct alias: current
Solo records are adapted into fresh immutable values. Historical references
remain structural references and are not liveness or legality claims.

## 2. V1/V2 preservation

The following are unchanged:

- `ModeNeutralCoreIdentityZoneSliceV1`
- `ModeNeutralCoreCardRuntimeSliceV1`
- `ModeNeutralCoreObjectRegistrySliceV2`
- `ModeNeutralCoreObjectRuntimeSliceV2`
- `CoreObjectId` and all Core ObjectId V2 formats
- O4P-01G transition contracts
- O4P-01H contracts and fixtures
- existing Core public exports, Solo GameState, Solo Snapshot, and
  `CURRENT_CONTRACT_VERSIONS`

No existing type receives an optional field. Object identity and runtime do not
receive announcement fields. The new value is a separate root slice.

## 3. Choice keys

`CoreStackChoiceKeyV1` is a string of one to 128 ASCII characters matching:

```text
^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$
```

The first character is alphanumeric; subsequent characters may be alphanumeric,
dot, underscore, or hyphen. Colon, slash, backslash, whitespace, and control
characters are forbidden. `__proto__`, `prototype`, and `constructor` are
forbidden as record keys. Keys are for stable structural identifiers only, not
UI text or Oracle text. This applies to mode keys, selection IDs, group keys,
variable keys, cost keys, and distribution keys.

## 4. Target references and selections

```ts
type CoreStackTargetRefV1 =
  | { readonly kind: "object"; readonly objectId: CoreObjectId }
  | { readonly kind: "player"; readonly playerId: CorePlayerId };

type CoreStackTargetSelectionV1 = {
  readonly selectionId: CoreStackChoiceKeyV1;
  readonly groupKey: CoreStackChoiceKeyV1;
  readonly target: CoreStackTargetRefV1;
};
```

Object IDs pass `isCanonicalCoreObjectIdV2`. Player IDs pass the existing Core
base-ID rule. `selectionId` is unique within the record. Array order is
declaration order and is never sorted. `groupKey` may repeat. The same target
is forbidden twice within one group, but is allowed in different groups. An
empty list is valid, including zero-target and up-to-zero structural cases.

Target refs are historical selection snapshots. Validation does not require a
target object to be present in the current registry, to remain in its zone, or
to remain an active/legal player. Resolution-time legality and player-exit
semantics are deferred. Candidate generation, target predicates, protection,
hexproof, shroud, and outcomes are outside this contract.

## 5. Modes and variables

```ts
type CoreStackVariableAnnouncementV1 = {
  readonly variableKey: CoreStackChoiceKeyV1;
  readonly value: number;
};
```

`chosenModeKeys` preserves declaration order, allows an empty array, and allows
repeated keys. It is not sorted, deduplicated, or cardinality-checked.
`announcedVariables` is unique by key and must be in code-unit ascending key
order. Values are numeric, integral, finite, safe, and nonnegative. Numeric
strings, NaN, Infinity, fractions, and duplicate keys are rejected. X may be
represented by `variableKey: "X"`; no X-only field exists. Effect-defined
ranges and mode legality are deferred.

## 6. Cost choices

```ts
type CoreStackAlternativeCostChoiceV1 = {
  readonly costKey: CoreStackChoiceKeyV1;
};
type CoreStackAdditionalCostChoiceV1 = {
  readonly costKey: CoreStackChoiceKeyV1;
  readonly times: number;
};
type CoreStackCostChoiceSetV1 = {
  readonly alternativeCost: CoreStackAlternativeCostChoiceV1 | null;
  readonly additionalCosts: readonly CoreStackAdditionalCostChoiceV1[];
};
```

Additional `times` is a positive safe integer. Cost keys are unique and in
code-unit ascending order; repeated selection is represented by `times`. The
slice stores selected cost choices only. It never stores total cost, mana
payment, payment plan, sacrificed/discarded objects, cost increase/reduction,
or Commander tax. Total-cost and payment algorithms remain later command and
authority work.

## 7. Distribution

```ts
type CoreStackDistributionAssignmentV1 = {
  readonly targetSelectionId: CoreStackChoiceKeyV1;
  readonly amount: number;
};
type CoreStackDistributionAnnouncementV1 = {
  readonly distributionKey: CoreStackChoiceKeyV1;
  readonly assignments: readonly CoreStackDistributionAssignmentV1[];
};
```

Each amount is a positive safe integer. Assignment IDs must reference a target
selection in the same record and may not repeat within one distribution.
Assignment order follows target-selection order. Assignments are nonempty.
Distribution keys are unique and in code-unit ascending order. Totals are not
checked; the effect definition owns the required total. This can represent
damage or another targeted division, but not untargeted resolution-time
distribution.

## 8. Announcement record union

All four records have this exact field order:

1. `kind`
2. `abilityTextSnapshot`
3. `chosenModeKeys`
4. `targetSelections`
5. `announcedVariables`
6. `distributions`
7. `costChoices`

```ts
type CoreStackAnnouncementRecordV1 =
  | {
      readonly kind: "card-spell";
      readonly abilityTextSnapshot: null;
      readonly chosenModeKeys: readonly CoreStackChoiceKeyV1[];
      readonly targetSelections: readonly CoreStackTargetSelectionV1[];
      readonly announcedVariables: readonly CoreStackVariableAnnouncementV1[];
      readonly distributions: readonly CoreStackDistributionAnnouncementV1[];
      readonly costChoices: CoreStackCostChoiceSetV1;
    }
  | {
      readonly kind: "spell-copy";
      readonly abilityTextSnapshot: null;
      readonly chosenModeKeys: readonly CoreStackChoiceKeyV1[];
      readonly targetSelections: readonly CoreStackTargetSelectionV1[];
      readonly announcedVariables: readonly CoreStackVariableAnnouncementV1[];
      readonly distributions: readonly CoreStackDistributionAnnouncementV1[];
      readonly costChoices: CoreStackCostChoiceSetV1;
    }
  | {
      readonly kind: "activated-ability";
      readonly abilityTextSnapshot: string;
      readonly chosenModeKeys: readonly CoreStackChoiceKeyV1[];
      readonly targetSelections: readonly CoreStackTargetSelectionV1[];
      readonly announcedVariables: readonly CoreStackVariableAnnouncementV1[];
      readonly distributions: readonly CoreStackDistributionAnnouncementV1[];
      readonly costChoices: CoreStackCostChoiceSetV1;
    }
  | {
      readonly kind: "triggered-ability";
      readonly abilityTextSnapshot: string;
      readonly chosenModeKeys: readonly CoreStackChoiceKeyV1[];
      readonly targetSelections: readonly CoreStackTargetSelectionV1[];
      readonly announcedVariables: readonly CoreStackVariableAnnouncementV1[];
      readonly distributions: readonly CoreStackDistributionAnnouncementV1[];
      readonly costChoices: CoreStackCostChoiceSetV1;
    };
```

Card spells and copies require `abilityTextSnapshot: null`. Activated and
triggered abilities require a nonempty snapshot of one to 16,384 Unicode code
points. NUL and CR are forbidden; LF is allowed; leading/trailing Unicode
whitespace is forbidden. The value is never trimmed, newline-normalized,
Oracle-fetched, or re-read from the source object. It persists if that source
disappears. The text is stored, not interpreted.

## 9. Root slice and cross-slice invariants

```ts
type ModeNeutralCoreStackAnnouncementSliceV1 = {
  readonly kind: "mode-neutral-core-stack-announcement-slice-v1";
  readonly byObject: Readonly<
    Record<CoreObjectId, CoreStackAnnouncementRecordV1>
  >;
};
```

`CreateModeNeutralCoreStackAnnouncementSliceV1Input` is the root with `kind`
omitted. The factory and validator receive a
`ModeNeutralCoreObjectRegistrySliceV2` registry.

The registry itself must pass its V2 validator. The `byObject` key set equals
the registry shared-stack ObjectId set exactly and each stack object has one
record. No stack-external record exists. Record key order is the existing stack
array bottom-to-top order; the array tail is top. No second stack-order field is
stored. Registry kind maps exactly: `card`→`card-spell`, `spell-copy`→
`spell-copy`, `activated-ability`→`activated-ability`, and
`triggered-ability`→`triggered-ability`. Tokens are not announcement objects;
the existing registry validator rejects a token in stack before this slice.

The record does not duplicate controller, source/copy current existence,
decision maker, actor, `issuedBy`, or `rulesActor`. Those belong to future
Command/Event/DecisionAuthority contracts. Copy records are complete payloads;
this slice does not compare them with a source announcement, derive copyable
values, enforce choose-new-targets, or execute CR 707.

## 10. Committed-only lifecycle

Every record in this slice is committed. No `status`, `draft`, `proposed`,
`pendingPayment`, `paymentComplete`, `legal`, `resolved`, `countered`, or
`readyToResolve` field is permitted. Proposal, choices-in-progress, payment,
and illegal rollback do not produce a record.

A future atomic transaction will add/remove the stack object, zone entry,
runtime row where needed, and announcement record together. Removal, retarget
replacement, and mutation APIs are not implemented here. O4P-01J owns atomic
stack commit, retarget, and removal.

## 11. Validation and canonicalization

The exact validation code union is:

```ts
type CoreStackAnnouncementValidationCode =
  | "INVALID_ROOT" | "INVALID_OBJECT_REGISTRY" | "MISSING_FIELD"
  | "UNKNOWN_FIELD" | "INVALID_TYPE" | "INVALID_LITERAL" | "INVALID_ID"
  | "UNSAFE_RECORD_KEY" | "INVALID_STRING" | "INVALID_INTEGER"
  | "INVALID_ARRAY" | "INVALID_ORDER" | "DUPLICATE_VALUE"
  | "STACK_OBJECT_SET_MISMATCH" | "ANNOUNCEMENT_KIND_MISMATCH"
  | "INVALID_ABILITY_TEXT" | "DUPLICATE_TARGET_SELECTION_ID"
  | "DUPLICATE_TARGET_IN_GROUP" | "DISTRIBUTION_TARGET_NOT_FOUND"
  | "DUPLICATE_DISTRIBUTION_TARGET" | "INVALID_COST_CHOICE";
```

Issues have `code`, RFC 6901 `path`, and `message`. Root path is `""`; `~`
escapes to `~0` and `/` to `~1`. Results are the exact success/failure union
through `CoreStackAnnouncementValidationResult`, and creation failures use
`CoreStackAnnouncementCreationError`.

Validation accepts `unknown` and fails closed for null, arrays-as-records,
Date, Map, Set, class instances, accessors, non-enumerable fields, symbols,
sparse arrays, and extra array properties. Missing and unknown fields are
errors. It does not default, trim, sort, deduplicate, merge, coerce, or mutate
input. It returns all issues sorted by path and then code using code-unit
comparison. Successful values are fresh objects, JSON-round-trippable, and
deep-frozen. The factory and validator share one validation/canonicalization
path; the validator does not sort or repair input.

Canonical field/array order is root `kind`, `byObject`; record order above;
target selection `selectionId`, `groupKey`, `target`; target `kind`, ID;
variable `variableKey`, `value`; distribution `distributionKey`, assignments;
assignment `targetSelectionId`, `amount`; cost set `alternativeCost`,
`additionalCosts`; alternative cost `costKey`; additional cost `costKey`,
`times`. Chosen modes, target selections, assignments, and stack preserve input
order. Variables, distributions, and additional costs require pre-sorted
unique keys and reject unsorted input. `localeCompare` is forbidden.

## 12. Public exports

The stack index and `src/engine/core/index.ts` export the following exact
surface: `CoreStackChoiceKeyV1`, `CoreStackTargetRefV1`,
`CoreStackTargetSelectionV1`, `CoreStackVariableAnnouncementV1`,
`CoreStackAlternativeCostChoiceV1`, `CoreStackAdditionalCostChoiceV1`,
`CoreStackCostChoiceSetV1`, `CoreStackDistributionAssignmentV1`,
`CoreStackDistributionAnnouncementV1`, `CoreStackAnnouncementRecordV1`,
`ModeNeutralCoreStackAnnouncementSliceV1`,
`CreateModeNeutralCoreStackAnnouncementSliceV1Input`,
`CoreStackAnnouncementValidationCode`, `CoreStackAnnouncementValidationIssue`,
`CoreStackAnnouncementValidationResult`,
`CoreStackAnnouncementCreationError`,
`validateModeNeutralCoreStackAnnouncementSliceV1`, and
`createModeNeutralCoreStackAnnouncementSliceV1`.

## 13. Explicit DEFER

Casting/activation commands, trigger detection/placement, cost calculation and
payment, total-cost lock, legality, candidate generation, resolution,
priority/APNAP, counters, copy execution/copyable values, choose-new-targets,
retarget effects, Resolution Context, DecisionAuthority, Command/Event,
revision/commandId, visibility, Player/Table/Room, Cloudflare/WebSocket,
projection, persistence, Online runtime, UI, and Solo connection remain
unimplemented. No unsupported behavior may be reported as automated.

## 14. Acceptance pins

The independent review must pin mixed-stack exact parity, order, kind matching,
ability text/null rules, historical targets, mode repetition/order, duplicate
selection/cost/distribution rejection, X=0, committed-only unknown fields,
canonical JSON, deep freeze, and input non-mutation. It must also prove that
Object Registry V2 and Solo exports/source remain unchanged and that no Online
runtime is created.

This contract does not change any version axis. The next milestone is
`O4P-01J Atomic Stack Commit, Retarget & Removal Transaction V1`.
