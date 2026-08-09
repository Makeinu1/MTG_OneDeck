# O4P-01H Universal Object Registry & Non-Card Stack Substrate V2

Status: drafted

Parent: O4P-01H
Base: PLAN_SHA=9ffcf64
Judge ruling: user-ruling-2026-08-09

This judge-owned contract is the additive V2 structural substrate. It is
grounded in the pinned CR 2026-06-19 and the four completed grounding lanes:
R 019fe712-d87d-7a02-a6cd-d26ec826513b, A 019fe712-d8dd-72a3-be0a-7458b41702a8,
B 019fe712-d944-7092-8656-7eb30ffcc372, and C
019fe712-d9af-7d03-a49b-7ba35eb58e21. All four are analyzed-not-integrated.
The contract does not claim object creation, choices, priority, resolution, or
automation of any deferred rule procedure.

## 1. V1 preservation

The following remain byte- and behavior-compatible and are not edited:
CoreObjectId, CorePlayerId, CorePhysicalCardId, coreCardObjectIdOf,
ModeNeutralCoreIdentityZoneSliceV1, ModeNeutralCoreCardRuntimeSliceV1, their
validators/factories/canonicalizers/fixtures, O4P-01G transition behavior, Solo
GameState, and Solo snapshots. V1 types receive no optional fields. Existing
V1 fixtures are not rewritten. V2 is additive and never weakens a V1 validator.

## 2. Universal object ID V2

Existing card object IDs remain byte-for-byte:

    <CorePhysicalCardId>:<incarnation>

Synthetic forms are:

    @token:<seed>:<incarnation>
    @spell-copy:<seed>
    @activated-ability:<seed>
    @triggered-ability:<seed>

A seed is caller-supplied, one to 128 ASCII characters, and follows the
existing Core base-ID alphabet and first-character rule. It also cannot
contain colon, at-sign, slash, or whitespace. Incarnation is a non-negative
safe integer in canonical decimal: zero is 0; nonzero values have no leading
zero, sign, decimal point, exponent, or alternate spelling.

The leading at-sign is not legal for a Core base ID, so synthetic forms cannot
collide with card object IDs. Parsing is strict and fail-closed: it does not
trim, normalize, or accept a second spelling. Required exports are:
CoreObjectIdKindV2, ParsedCoreObjectIdV2, parseCoreObjectIdV2,
isCanonicalCoreObjectIdV2, coreTokenObjectIdOfV2,
coreSpellCopyObjectIdOfV2, coreActivatedAbilityObjectIdOfV2, and
coreTriggeredAbilityObjectIdOfV2.

Factories receive the seed explicitly and never call Math.random, Date.now,
crypto.random, or a hidden PRNG. Seed allocation, command IDs, event IDs, and
command-generated object creation are later milestones. Card ID bytes are
preserved by parse/format. This milestone validates caller-supplied IDs and
does not implement an allocator or retired-ID table.

## 3. Universal registry root and identity union

The exact root fields and literal are:
kind = mode-neutral-core-object-registry-slice-v2; players; turnOrder;
activePlayerId; cardDefinitions; physicalCards; objects; zones.

objects is Readonly<Record<CoreObjectId, CoreGameObjectIdentityV2>>. The exact
identity union is:

- card: kind card; physicalCardId CorePhysicalCardId; incarnation number;
  baseControllerPlayerId CorePlayerId or null.
- token: kind token; definitionId CoreCardDefinitionId; ownerPlayerId
  CorePlayerId; incarnation number; baseControllerPlayerId CorePlayerId;
  origin CoreTokenOriginV2.
- spell-copy: kind spell-copy; definitionId CoreCardDefinitionId;
  controllerPlayerId CorePlayerId; copiedFromObjectId CoreObjectId.
- activated-ability: kind activated-ability; controllerPlayerId CorePlayerId;
  sourceObjectId CoreObjectId or null; abilityKey string.
- triggered-ability: kind triggered-ability; controllerPlayerId CorePlayerId;
  sourceObjectId CoreObjectId or null; abilityKey string.

CoreTokenOriginV2 is either { kind: created, sourceObjectId:
CoreObjectId or null } or { kind: copy, sourceObjectId: CoreObjectId }.
Origin and copiedFromObjectId are provenance only. A historical source reference
does not need to be present in the current registry. abilityKey follows the
existing Core base-ID grammar, is stable within the source, is not UI or Oracle
text, and is not automatically parsed here.

## 4. V2 zone invariants

The V1 zone shape is the single zone representation. zones.shared.stack is
bottom-to-top and stack[stack.length - 1] is top. There is no second
stackOrder field.

The strict validator enforces:

1. Every registry object ID occurs in exactly one zone array.
2. Every zone reference resolves to an object in objects.
3. Every physical card has exactly one live kind=card object.
4. Card object ID, physical-card, incarnation, controller, and zone semantics
   remain the V1 rules.
5. A token is battlefield-only; its owner/controller are seated players and its
   definition exists.
6. A spell-copy is stack-only; its controller and definition exist.
7. Activated and triggered abilities are stack-only and their controllers are
   seated.
8. Non-card objects do not require a physical card.
9. Player-scoped ownership/controller rules remain V1 rules.
10. Mixed stack order is the array order and no separate order is stored.

CR 109-113, 400.7, 405, 704.5d-e, and 707 ground these distinctions: tokens
are objects but not cards; abilities are stack objects independent of their
source; mixed spells/abilities use one ordered stack; token/copy cease rules
are not generic zone-move permissions; and a spell copy has no card.

Mana abilities are not registry objects and do not enter this stack. Static
abilities are not registry objects and do not enter this stack. Pending
triggers are not silently treated as already-placed triggered ability objects.

## 5. Runtime V2

The exact root literal is kind = mode-neutral-core-object-runtime-slice-v2
with byObject: Readonly<Record<CoreObjectId,
CoreCardObjectRuntimeStateV1>>. byObject has exactly the key set of registry
objects whose kind is card or token. It contains no spell-copy,
activated-ability, or triggered-ability row. Token rows reuse the existing
CoreCardObjectRuntimeStateV1 shape; no second runtime shape is introduced.
Battlefield runtime constraints apply to tokens, including orientation,
counters, marked damage, and attachment. Stack-only objects have no V2 card
runtime row.

## 6. Strict validation and canonicalization

V2 validators are strict and fail closed. They reject unknown fields and
discriminants, missing fields, invalid record keys, symbols, accessors,
non-enumerable fields, non-plain records, unsafe keys, noncanonical IDs,
duplicate zone membership, stale runtime rows, and invalid cross-object
references. They do not trim, auto-sort semantic arrays, deduplicate, fill
defaults, delete zero values, merge records, or mutate input.

Validation returns deterministic complete issue lists. Successful values are
fresh canonical values and deeply frozen. Canonical record keys use deterministic
code-unit order; zone and stack arrays preserve semantic order. Meaning
comparison is not implemented as a bare JSON.stringify shortcut.

## 7. V1 to V2 adapters

upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2 must strictly
validate V1 first; preserve card IDs byte-for-byte; preserve players, turn
order, active player, definitions, physical cards, zone arrays, and V1
controller/ownership rules; move cardObjects into objects without creating
token/copy/ability objects; reject malformed input; leave input unchanged; and
return canonical deeply frozen output with deterministic JSON.

upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2 must strictly
validate V1 identity and runtime, agree with the V2 identity adapter, preserve
all card runtime keys and values, leave inputs unchanged, and return canonical
deeply frozen output. No downgrade adapter exists. Synthetic V2 objects cannot
be silently coerced into V1 card objects.

## 8. Integration exports and machine gate

The integration lane may add the named ID, identity, registry state, validation
result/error, runtime, canonicalization, and adapter exports from the O4P-01H
brief. Existing V1 exports remain available. It may add
verify:mode-neutral-core-object-registry and its ordered machine-check step,
without changing workflow, dependency, package-lock, version values, Solo
source, Online runtime, UI, or existing review files.

## 9. Explicit DEFER

- object creation, token generation, spell-copy, and ability activation commands;
- trigger detection, priority, APNAP execution, stack resolution, targets,
  modes, announced X, cost payment, and choices;
- copiable-values derivation, copy-effect application, source-following,
  source snapshots, and complete CR707 automation;
- token/copy cease SBA, token zone transitions, replacement effects, and
  face-down behavior;
- pending/delayed trigger lifecycle, mana-ability transactions, static
  abilities, continuous effects, visibility, and projection;
- ControlEffect, Room, revision, WebSocket, Cloudflare, Online protocol,
  Solo runtime changes, UI, version-axis changes, dependencies, and release
  evidence.

This document freezes structure only; it does not claim unsupported processing
is implemented.
