# O4P-01C Mode-Neutral Core State Architecture (draft)

This document is a milestone draft, not a formal specification and not an
active contract. It records the implementation-facing policy for O4P-01C.
The Mode-Neutral Core itself is not implemented. Online runtime is not
implemented. `stateSchemaVersion` is unchanged. `BLOCKED_REDESIGN` entries are
not resolved by this milestone.

Base SHA: `c7c88bad78869cef1b53c244d4ee213d53fd3f00`

## 1. Decision

The selected architecture is:

`MODE_NEUTRAL_CORE_WITH_SOLO_FACADE_AND_ONLINE_ENVELOPE`

The machine-readable value is
`mode-neutral-core-with-solo-facade-and-online-envelope`.

The final rules truth is a future Mode-Neutral Core. The current `GameState`
remains in place as a Solo Compatibility Facade so existing Solo Store,
Snapshot, and UI paths remain intact. A future Online Room State will wrap the
Core with transport, authority, visibility, revision, and persistence
metadata; it will not create a second MTG semantic state.

## 2. Evidence from O4P-01S

O4P-01S established the current boundaries in
`research/cr-grounding/o4p-01s-solo-online-boundary.draft.md`:

- private zones have `zonesByPlayer` as their per-player substance while flat
  `zones` includes a Solo-local mirror;
- `players` coexists with legacy P1 scalar mirrors such as `life`, `manaPool`,
  and turn counters;
- `localPlayerId` is a Solo display and implicit-subject pivot, not an Online
  session or authorization identity;
- `eventLog` is structured engine evidence while `log` is Japanese Solo
  display text;
- `commanderDamage` is keyed by a free-form commander label rather than a
  player and physical commander identity;
- Solo Snapshot versioning is separate from the contract version vector; and
- `src/online/**` had no runtime implementation, while existing engine and
  multiplayer review evidence remained Solo-side pure-engine evidence.

The independent O4P-01S cold audit
(`019fe3f9-1ba5-7d80-a9a9-636a63934a61`) closed with BLOCKER/HIGH = 0 and
`AUDIT-OK-PENDING-FULL-CHECK`. O4P-01C consumes those findings as input and
does not reclassify O4P-01S concerns as shipped Online behavior.

## 3. Rejected alternative: raw GameState envelope

The current `GameState` cannot be declared the Online Canonical State and then
serialized as a room payload. It contains Solo-local mirrors, Japanese
presentation log entries, local subject assumptions, and representations that
do not encode four-player commander damage or combat targets completely.
Using it as a WebSocket payload, Durable Object value, or Player/Table
Projection would leak responsibility and hidden information across layers.

`GameState` JSON serialization for Online persistence or transport is therefore
prohibited. Solo Snapshot storage remains a separate compatibility contract.

## 4. Rejected alternative: independent Online semantic state

An Online-only rule state would duplicate command application, card/object
semantics, zone changes, priority, trigger ordering, and event meaning. That
would create two semantic authorities and allow Solo and Online behavior to
drift. Online may add an Envelope and later projections, but it must not
implement an independent MTG state transition path.

## 5. Selected architecture

The boundary is:

```text
future Mode-Neutral Core
        ▲
        │ normalize / derive
current GameState ── Solo Compatibility Facade
        │
        └── future Online Room Envelope (outside Core)
              roomId, revision, commandId, session, authority,
              visibility, persistence, projection subscription
```

This milestone only fixes the architecture literal and the exhaustive field
policy. It does not add a Core type, factory, validator, adapter, Room,
Projection, command envelope, WebSocket, Worker, Durable Object, or migration.

## 6. GameState field policy

The policy is a mapped type over every `keyof GameState`, with required keys and
no index signature. `dungeonDefs` and `dungeons` are optional properties in
`GameState`, but they are still mandatory policy keys.

| Disposition | Fields |
|---|---|
| `CORE_DIRECT` | `effectsAuto`, `activePlayerId`, `turnOrder`, `turn`, `phase`, `emptyLibraryDrawAttemptedSinceLastSba`, `combatDamagePreventedUntilEndOfTurn`, `oncePerTurnTriggerLedger`, `powerUpActivated` |
| `CORE_NORMALIZE` | `defs`, `cards`, `zones`, `zonesByPlayer`, `players`, `eventLog`, `pendingTriggers`, `pendingRuleChoices`, `linkedExiles`, `dungeonDefs`, `dungeons` |
| `SOLO_FACADE` | `localPlayerId`, `life`, `poison`, `energy`, `experience`, `opponentLife`, `manaPool`, `mulliganCount`, `landsPlayedThisTurn`, `spellsCastThisTurn`, `drawnThisTurn`, `pendingSbaChoices`, `log` |
| `BLOCKED_REDESIGN` | `commanders`, `combat`, `commanderDamage`, `defeat` |

Counts are exactly `CORE_DIRECT = 9`, `CORE_NORMALIZE = 11`,
`SOLO_FACADE = 13`, `BLOCKED_REDESIGN = 4`, total `37`.

`CORE_DIRECT` means the rule meaning can move to the Core without semantic
conversion. `CORE_NORMALIZE` means the rule meaning is needed but the current
representation has mirrors, presentation data, partial records, visibility,
or identifiers that must be normalized first. `SOLO_FACADE` is excluded from
the Core and Online durable semantic state; it remains for compatibility or is
derived for Solo view. `BLOCKED_REDESIGN` is explicitly held out until the
four-player representation is specified.

The disposition-to-entry rules are fixed:

| Disposition | `reasonCode` | `persistInModeNeutralCore` | `requiresExplicitFollowUp` |
|---|---|---:|---:|
| `CORE_DIRECT` | `RULE_SEMANTIC_DIRECT` | `true` | `false` |
| `CORE_NORMALIZE` | `NORMALIZATION_REQUIRED` | `true` | `true` |
| `SOLO_FACADE` | `SOLO_COMPATIBILITY_VIEW` | `false` | `false` |
| `BLOCKED_REDESIGN` | `MULTIPLAYER_REDESIGN_REQUIRED` | `false` | `true` |

## 7. Core invariants

The selected architecture fixes these invariants for later milestones:

1. The Mode-Neutral Core has no `localPlayerId`.
2. The Core has no P1-only scalar mirror.
3. The Core has no Japanese Solo display `log`.
4. `players` is the player-state authority in the Core.
5. Private zones and shared zones are separate concepts.
6. The same private zone is not stored redundantly in both `zones` and
   `zonesByPlayer` in the Core.
7. Card definitions are normalized toward a rules-only snapshot; image URLs
   and `printedName` are not Core rules truth.
8. The server-internal Core may contain hidden information, but it is never
   sent directly as a Player/Table Projection.
9. Player/Table values are produced only by a later explicit projection
   allowlist.
10. The current `GameState` remains available as the Solo Compatibility
    Facade.
11. Solo Snapshot format and Online state/protocol versions remain separate.
12. Room metadata remains outside the Core.
13. `GameState` is not JSON-stringified for Online save or transport.
14. Online does not duplicate `applyCommand`-equivalent semantic transitions.
15. Any future `GameState` root-field change requires policy reclassification.

## 8. Solo Facade boundary

The Solo Store, undo/redo history, pending UI interaction state, Snapshot,
IndexedDB/localStorage persistence, App resume flow, and current UI remain
Solo responsibilities. `localPlayerId` and flat local mirrors may remain in
the Facade for compatibility. Existing Solo preservation and O4P-01S AST
boundary tests remain gates.

The architecture-only module imports `GameState` with a type-only import and
does not import Store, components, Snapshot, React, Zustand, DOM, Cloudflare,
WebSocket, HTTP, IndexedDB, or Scryfall code. `src/engine/**` does not import
back into `src/online/**`.

## 9. Online Envelope boundary

The future Envelope may own `roomId`, `revision`, `commandId` deduplication,
session and role/capability, connection state, persistence metadata, and
projection subscriptions. It must not turn any Solo Facade field into a shared
rules authority and must not expose hidden Core values directly.

Room lifecycle, authentication, authorization, server authority, command
acceptance, reconnect, event persistence, and Player/Table visibility are
future Online-only contracts. None is implemented here.

## 10. BLOCKED_REDESIGN

- `commanders`: `CommanderInfo[]` does not encode each player's commander
  ownership and does not provide a unique four-player commander-to-cast-count
  relation.
- `combat`: `CombatState` assumes one `defendingPlayerId` and cannot fully
  represent attackers aimed at different players, planeswalkers, or battles in
  one multiplayer combat.
- `commanderDamage`: its free-form label key does not identify a target
  `PlayerId` and physical commander object.
- `defeat`: `DefeatPlayerRef` is tied to `P1`/`opponent` labels rather than a
  general four-player identity model.

These four fields are not resolved, normalized by assertion, or admitted to a
future Core by O4P-01C.

## 11. Verification strategy

`src/online/architecture/stateArchitecture.ts` exports the architecture
literal, four disposition/reason types, the exhaustive policy, summary type,
and policy-derived summary function. The policy uses
`{ readonly [K in keyof GameState]-?: GameStateFieldPolicyEntry }`, with no
`Record<string, ...>`, `Partial`, index signature, broad assertion, or unknown
field fallback. The policy and every entry are deeply frozen; summary results
are frozen.

`src/test/architecture/onlineStateArchitecture.test.ts` verifies the exact
sets, counts, entry combinations, freeze behavior, mutation resistance,
optional dungeon fields, TypeScript Compiler API compile fixtures for added
and deleted fields, architecture dependency imports, and engine reverse
imports. `scripts/checks/verify-online-state-architecture.ts` repeats the
runtime invariants without network access or source mutation.

The machine-check order is now CR pin, contract versions, Solo preservation,
Online state architecture, lint, test, and build. O4P-01S preservation and
boundary tests remain part of the required gates.

## 12. Inputs for O4P-01D

O4P-01D must use this policy as input and must not independently reinterpret
the 37 fields. It must first define the Core representation and normalization
contracts for `CORE_NORMALIZE`, then define explicit actor/owner/controller
inputs and private/shared zone visibility. It must decide the adapter boundary
for Solo scalar mirrors, events versus display log, pending rule choices, and
card-definition normalization.

Before resolving any `BLOCKED_REDESIGN` field, O4P-01D needs a four-player
identity model, commander ownership/object identity, multiplayer combat target
model, commander-damage matrix, and general defeat representation. It must keep
Solo Snapshot and Online version vectors separate and preserve the no-duplicate
semantic transition rule.

## 13. DEFER

- ModeNeutralCoreState type, Core factory, Core validator, and state adapters.
- Online Canonical State, Room State, Player/Table Projection, and visibility
  payloads.
- WebSocket, Worker, Durable Object, authentication, authorization, revision,
  commandId, event persistence, protocol negotiation, and migration.
- Online UI, route changes, Cloudflare configuration, dependency changes, and
  version increments.
- Commander, commander-damage, combat, and defeat redesign.

Status before independent cold audit: `implemented-not-audited`.
