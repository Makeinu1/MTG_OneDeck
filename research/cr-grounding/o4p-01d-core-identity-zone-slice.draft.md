# O4P-01D: Mode-Neutral Core Identity & Zone Structural Slice V1 (draft)

> **draft only**. This document is not a formal specification, active contract, or shipped feature.
> It is the implementer/auditor handoff for O4P-01D.

## 1. Milestone scope

O4P-01D is the first structural slice of the selected architecture
`mode-neutral-core-with-solo-facade-and-online-envelope`.

It creates independent Core types, deterministic factories, strict validation,
location helpers, a committed fixture, ordinary tests, an architecture test,
and a machine verifier for:

- player state as one record authority;
- circular `turnOrder` and `activePlayerId`;
- rules-only card-definition snapshots;
- physical card identity versus card object incarnation;
- owner versus base controller;
- player-scoped versus shared zones;
- zone arrays as the sole object-location authority;
- CR zone scope and public/hidden classification;
- strict, non-mutating validation, deterministic generation, deep freeze, and JSON round-trip.

This is not a complete Mode-Neutral Core. Existing `GameState`, Solo Store,
Solo UI, and Solo Snapshot are not connected. No Online runtime, Online State,
Envelope, Room, transport, Projection, command, or persistence is created.

### Judge-authorized I4 timeout exception

The pre-existing judge-owned `src/engine/__tests__/review.properties.test.ts`
has one explicit exception for this milestone handoff: the I4 per-test timeout
may be changed from `30000` to `60000`, with an explanatory comment updated to
record the observed loaded-core runtime. No assertion, property, seed, fixture,
command generator, or test meaning may change. This exception is already
committed before O4P-01D starts; no other `review.*` file may change during the
milestone.

## 2. O4P-01C inputs

Use `research/cr-grounding/o4p-01c-state-architecture.draft.md` as the
architecture input. Its selected architecture is mode-neutral Core with a
Solo facade and a future Online envelope. The field policy used here is:

### CORE_NORMALIZE in this slice

- `defs` as rules-only card-definition snapshots (`cardDefinitions` in this V1 root);
- `cards` as physical cards and card objects;
- `zones`;
- `zonesByPlayer` as the player-scoped zone records;
- `players`.

### CORE_DIRECT in this slice

- `activePlayerId`;
- `turnOrder`.

### Not concrete in this slice

`eventLog`, `pendingTriggers`, `pendingRuleChoices`, `linkedExiles`,
`dungeonDefs`, `dungeons`, `effectsAuto`, `turn`, `phase`,
`emptyLibraryDrawAttemptedSinceLastSba`, `combatDamagePreventedUntilEndOfTurn`,
`oncePerTurnTriggerLedger`, and `powerUpActivated` are not implemented here.

No `SOLO_FACADE` or `BLOCKED_REDESIGN` field is added. In particular,
`commanders`, `combat`, `commanderDamage`, and `defeat` remain deferred.

## 3. CR grounding

The sole rules source is the repository-pinned ruleset
`mtg-cr-2026-06-19`. Do not update CR from the web and do not perform O4P-00B.
The structural decisions are grounded in:

- CR 101.4 for circular turn order/APNAP-compatible participant order;
- CR 102.1 for player identity and participation;
- CR 108.3 and 108.4 for cards and card ownership;
- CR 109.1 and 109.4 for objects and object categories;
- CR 400.1, 400.2, 400.3, 400.5, and 400.7 for zones, ownership, and zone identity;
- CR 401.2 and 401.3 for library order and draw position;
- CR 402.3 for hand information boundary;
- CR 405.3 and 405.5 for stack order and priority-facing public structure;
- CR 903 for Commander command-zone context.

The `public-zone`/`hidden-zone` result below is a CR zone-information
classification, not a viewer-specific Projection or a permission grant.

## 4. Player identity and player-state authority

Files are under `src/engine/core/` only. The Core does not fix player count at
four. `turnOrder` has at least one entry, all IDs are unique, and the key sets
of `players` and `zones.byPlayer` exactly equal `turnOrder`. A one-player order
is structurally valid for Solo simulation; Online format cardinality is later.
`seatOrder` is absent and is not equivalent to `turnOrder`.

The branded IDs are distinct:

- `CorePlayerId`;
- `CoreCardDefinitionId`;
- `CorePhysicalCardId`;
- `CoreObjectId`.

Base IDs are ASCII strings matching
`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`, with no whitespace, colon, slash,
backslash, or control characters. Record keys `__proto__`, `prototype`, and
`constructor` are rejected.

Card object IDs are generated only by:

`coreCardObjectIdOf(physicalCardId, incarnation)`

with `<physicalCardId>:<incarnation>`. Incarnation is a non-negative safe
integer; fractional, negative, non-finite, and numeric-string values are
rejected. There is no arbitrary ObjectId factory.

`CorePlayerStateV1` contains exactly:

- `life`;
- `poison`;
- `energy`;
- `experience`;
- `manaPool`;
- `mulliganCount`;
- `landsPlayedThisTurn`;
- `spellsCastThisTurn`;
- `drawnThisTurn`;
- `maximumHandSizeOverride`.

It does not contain an ID, name, label, display name, local player, seat,
connection, role, UI, or history field. The `players` record key is the only
player-ID authority. `life` is a safe integer and may be negative. All other
counters and all mana values are non-negative safe integers. Mana has exactly
`W`, `U`, `B`, `R`, `G`, and `C`. `maximumHandSizeOverride` is `null`, `none`,
or a non-negative safe integer; `undefined` is invalid.

## 5. Card-definition snapshot boundary

Core stores a rules-only snapshot, never an alias, extension, or direct storage
of existing `CardDef`, `CardFace`, or `CardInstance`.

`CoreCardDefinitionSourceV1` is exactly:

- `{ kind: "scryfall"; scryfallId: string; oracleId: string }`, where both IDs
  are lower-case UUIDs and the record key equals `scryfallId`;
- `{ kind: "engine-synthetic" }`, with no extra fields and the record key as
  the stable definition ID.

`CoreCardDefinitionSnapshotV1` contains exactly `source`, `name`, `layout`,
`manaValue`, `colorIdentity`, `typeLine`, `keywords`, `producedMana`,
`tokenKind`, and `faces`.

`CoreCardFaceSnapshotV1` contains exactly `name`, `manaCost`, `typeLine`,
`oracleText`, `power`, `toughness`, `loyalty`, and `defense`.

Display/cache/API fields such as `printedName`, `printedTypeLine`,
`printedText`, `lang`, image URLs, EDHREC rank, artwork, and timestamps are
rejected. Nullable face strings are `string | null`; names and type lines are
trimmed non-empty strings without CR/NUL; oracle text is required, may be
empty or contain LF, and rejects CR/NUL. `manaValue` is finite and non-negative
and may be fractional. Color identity is unique WUBRG order; produced mana is
unique WUBRGC order; keywords are trimmed, unique, non-empty, and sorted by
JavaScript code unit. The validator never sorts, trims, deduplicates, or
otherwise repairs input. Faces are non-empty and retain input order.

No Scryfall access or external snapshot enrichment occurs.

## 6. Physical card and object incarnation

`CorePhysicalCardV1` contains exactly `definitionId`, `ownerPlayerId`, and
`isCommander`. The physical-card record key is the only physical ID authority.
The owner must be seated and the definition must exist. Multiple physical
cards may reference one definition. Commander placement and cast count are
not modeled; a commander may structurally be outside command.

`CoreCardObjectIdentityV1` contains exactly `kind`, `physicalCardId`,
`incarnation`, and `baseControllerPlayerId`. `kind` is the literal `card`.
The object record key must equal `coreCardObjectIdOf(physicalCardId, incarnation)`.
The object record key is the only object-ID authority.

Each physical card belongs to exactly one card object and each card object
references exactly one physical card. Orphan objects, missing objects, and a
physical card referenced by multiple objects are invalid. Only card objects
exist in this slice. Tokens, spell copies, permanent copies, abilities,
emblems, dungeons, melded/merged objects, and face-down object state are not
represented or disguised as cards.

## 7. Owner and base controller

`ownerPlayerId` is immutable physical-card ownership. `baseControllerPlayerId`
is nullable and records the caster/controller at the relevant entry point:

- stack: the player who cast the spell;
- battlefield: the base controller as the permanent entered;
- other zones: `null`.

An owner and base controller may differ on battlefield and stack. A controller
must be seated for battlefield/stack objects. Effective controller, continuous
layers, timestamps, temporary theft, and `ControlEffect` are not stored or
derived in this slice.

## 8. Player-scoped and shared zones

The zone union is:

- player-scoped: `library`, `hand`, `graveyard`;
- shared: `battlefield`, `stack`, `exile`, `command`.

The root has:

```ts
zones: {
  byPlayer: Record<CorePlayerId, {
    library: readonly CoreObjectId[];
    hand: readonly CoreObjectId[];
    graveyard: readonly CoreObjectId[];
  }>;
  shared: {
    battlefield: readonly CoreObjectId[];
    stack: readonly CoreObjectId[];
    exile: readonly CoreObjectId[];
    command: readonly CoreObjectId[];
  };
}
```

Objects do not contain a zone field. Every object occurs in exactly one zone,
every zone reference exists in `cardObjects`, and no zone contains a duplicate.
Player-scoped cards must be owned by that player. Shared zones allow any owner.

Array order is preserved, never normalized, and has these meanings where
defined: `library[0]` is top, the last graveyard entry is top, and the last
stack entry is top. Hand, battlefield, exile, and command order is preserved
but has no general rule meaning in this slice.

For library, hand, graveyard, exile, and command, base controller is null.
For battlefield and stack it is a seated player ID.

## 9. Zone ordering

Factories and validators preserve `turnOrder` and every zone array. Record
insertion order is deterministic:

- `players` and `zones.byPlayer`: `turnOrder` order;
- `cardDefinitions`: definition-ID code-unit order;
- `physicalCards`: physical-card-ID code-unit order;
- `cardObjects`: ObjectId code-unit order.

Comparisons use `<` and `>` on strings. `localeCompare` is forbidden.

## 10. Zone information classification

Export:

- `CoreZoneScopeV1`: `player-scoped | shared`;
- `CoreZoneInformationClassV1`: `hidden-zone | public-zone`;
- `coreZoneScopeOf`;
- `coreZoneInformationClassOf`.

Classification is fixed as:

| Zone | Scope | Information class |
|---|---|---|
| library | player-scoped | hidden-zone |
| hand | player-scoped | hidden-zone |
| graveyard | player-scoped | public-zone |
| battlefield | shared | public-zone |
| stack | shared | public-zone |
| exile | shared | public-zone |
| command | shared | public-zone |

This is not viewer visibility. No reveal, look, face-down, authorized-viewer,
Player Projection, or Table Projection behavior is implemented.

## 11. Validation and determinism

The root `ModeNeutralCoreIdentityZoneSliceV1` contains exactly:

- `kind: "mode-neutral-core-identity-zone-slice-v1"`;
- `players`;
- `turnOrder`;
- `activePlayerId`;
- `cardDefinitions`;
- `physicalCards`;
- `cardObjects`;
- `zones`.

It contains no room, revision, command, contract, local-player, seat,
display, role, session, connection, log, combat, commander, defeat,
history, timestamp, random seed, or version axis. It is not Online persistent
State and has no `stateSchemaVersion`.

`createModeNeutralCoreIdentityZoneSliceV1` accepts the root without `kind`,
does not mutate input, does not repair invalid values, preserves arrays,
sets the fixed kind, emits deterministic record insertion order, validates the
result, and deep-freezes all output. It rejects Date, Map, Set, BigInt,
function, symbol, and undefined values. Same input has identical JSON output.
Invalid input throws `CoreIdentityZoneCreationError` with `name` equal to
`CoreIdentityZoneCreationError` and all determinable issues.

`validateModeNeutralCoreIdentityZoneSliceV1(unknown)` returns either a deeply
frozen, separately allocated success value or all deterministic issues. It
rejects missing and unknown fields, null/arrays/classes as records, unsafe
keys, non-finite values, numeric strings, and all invalid structures. It never
executes getters or relies on a prototype chain. Issues are unique and sorted
by RFC 6901 JSON Pointer path using code-unit order, then validation code.

The exact validation-code union is:

`INVALID_ROOT`, `MISSING_FIELD`, `UNKNOWN_FIELD`, `INVALID_TYPE`,
`INVALID_LITERAL`, `INVALID_ID`, `UNSAFE_RECORD_KEY`, `INVALID_STRING`,
`INVALID_NUMBER`, `INVALID_INTEGER`, `INVALID_ARRAY_LENGTH`,
`DUPLICATE_VALUE`, `INVALID_ORDER`, `PLAYER_SET_MISMATCH`,
`ACTIVE_PLAYER_NOT_SEATED`, `CARD_DEFINITION_KEY_MISMATCH`,
`CARD_DEFINITION_NOT_FOUND`, `OWNER_NOT_SEATED`,
`BASE_CONTROLLER_NOT_SEATED`, `OBJECT_ID_MISMATCH`,
`PHYSICAL_CARD_NOT_IN_EXACTLY_ONE_OBJECT`, `OBJECT_NOT_IN_EXACTLY_ONE_ZONE`,
`ZONE_OBJECT_NOT_FOUND`, `OWNED_ZONE_OWNER_MISMATCH`,
`INVALID_CONTROLLER_FOR_ZONE`, and `UNSUPPORTED_OBJECT_KIND`.

No additional validation code may be invented. If a required distinction
cannot be represented by this union, defer it rather than silently widening it.

`locateCoreObjectV1` accepts a validated slice and an ObjectId and returns its
single player-scoped or shared location, including index, or null. It does not
return an arbitrary first location for invalid duplicated state.

## 12. Solo compatibility boundary

This slice does not import or connect to existing engine state, Store, Snapshot,
UI, IndexedDB, or Solo adapters. Existing Solo behavior remains authoritative
and unchanged. A future adapter may convert between Solo state and this Core
input, but that adapter is out of scope.

The committed fixture has four players, `turnOrder = [P1,P2,P3,P4]`, active
player not P1, objects in every zone, a commander object in command, at least
one incarnation above zero, and owner/controller differences on battlefield
and stack. It uses short synthetic Oracle text only.

## 13. Online boundary

No `src/online/**` is created or changed. The Core does not contain roomId,
revision, commandId, role, capability, session, connection, authentication,
authorization, persistence, WebSocket, projection, or transport fields.
It is not an Online State and is not sent as a payload. Future Solo Adapter and
Online Envelope decisions remain for later milestones.

`src/engine/core/**` may import only standard TypeScript/JavaScript and other
Core modules. It must not import online, store, components, data, App, React,
React DOM, Zustand, IndexedDB, WebSocket, Cloudflare, HTTP/Scryfall clients,
Node fs/crypto, or aliases/extensions of existing GameState/CardInstance/CardDef.
Existing engine-to-online reverse-import prohibition remains.

## 14. Inputs for O4P-01E

O4P-01E must decide how future dynamic state, commands, zone changes,
effects, event logs, pending choices, control effects, and adapter/envelope
boundaries build on this structural slice. It must not treat this V1 as a
complete canonical state, Online payload, viewer projection, or persistence
contract. The following remain deferred: token/copy/ability objects, face-down
visibility, effective controller, Combat, Commander damage/tax/replacement,
defeat, authentication/authorization, room/revision/commandId, and migration.

## 15. DEFER

- Existing `GameState`, `CardInstance`, `CardDef`, Store, Snapshot, and UI integration.
- Core commands, event log, dynamic card state, tap/counters/damage/attachments.
- ControlEffect and effective-controller layers.
- Token, copy, ability, emblem, dungeon, merged, melded, and face-down objects.
- Commander cast count, Commander damage, combat, defeat, linked exile, and pending choices.
- Player/Table Projection, visibility grants, reveal/look, authentication, authorization.
- Room, session, WebSocket, Durable Object, Cloudflare, persistence, revision, commandId.
- State version changes, protocol negotiation, migration, route/UI changes, and O4P-00B.
