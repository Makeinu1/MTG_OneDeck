# O4P-02A Solo/Core compatibility grounding (draft)

Status: Grounding Analyst evidence draft; not a frozen O4P-02A contract.

Milestone: `O4P-02A`
Work package: `A-G1 — Solo/Core Compatibility Grounding`
Role: Grounding Analyst
Requested Base SHA: `e1a71beac93f4882827bd8138990360840363a29`
Required shipped dependency: `O4P-01N`
Allowed change in this task: this file only.

## Evidence conventions

- `[FACT]` is directly observed in the named source, test, fixture, verifier, contract, or ledger entry.
- `[INFERENCE]` is a bounded conclusion from named facts; it is not a current symbol or implementation claim.
- `[PROPOSAL]` is a candidate for Sol to decide in the frozen O4P-02A contract. Proposed paths and symbols do not currently exist.
- `[UNRESOLVED]` is an authority or compatibility question not closed by current evidence.

All current-code claims below name an exact path and symbol/test/verifier. This file does not add an adapter, change Solo, or change any version.

## 1. Milestone and dependency facts

| Fact | Evidence |
| --- | --- |
| O4P-01N is the shipped Core closure and O4P-02A is pending and depends on it. | `[FACT]` `research/cr-grounding/cr-backbone-ledger.json`, the unique `domains[]` and `plannedSequence[]` entries for `O4P-01N` and `O4P-02A`. O4P-01N has `status: "shipped"`; O4P-02A has `status: "pending"` and `dependsOn: ["O4P-01N"]`. |
| O4P-02A boundary is compatibility adapter, differential parity, preserved snapshots, and offline Solo. | `[FACT]` `research/cr-grounding/cr-backbone-ledger.json`, O4P-02A `landingState`, `boundary`, `manualBoundary`, and `nextGate`; `research/cr-grounding/o4p-01-to-05-rebaseline-2026-08-10.draft.md`, §1 and §5. |
| O4P-02A must not rewrite Solo or merge `SNAPSHOT_VERSION` with Online `stateSchemaVersion`. | `[FACT]` `research/cr-grounding/cr-backbone-ledger.json`, O4P-02A `manualBoundary`; `research/cr-grounding/o4p-01n-to-02e-forward-plan.draft.md`, §2.1; `src/test/architecture/soloOnlineBoundary.test.ts`. |
| The shipped O4P-01N Core contract explicitly excludes Solo snapshot authority and transport/application concerns. | `[FACT]` `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`, §§1, 2, 7, 9; `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`. |

## 2. Exact current Solo authority inventory

### 2.1 Solo state, identity, initialization, and normalization

| Authority | Exact current surface | Tests/evidence |
| --- | --- | --- |
| Solo state type | `src/engine/types.ts`: `GameState` (`L676-L714`) contains `defs`, `cards`, ordered `zones`, `zonesByPlayer`, `commanders`, `effectsAuto`, active/local player, partial `players`, `turnOrder`, turn/phase/combat, legacy local life/counters/mana scalars, opponent life/commander-damage maps, defeat advisory, event log, pending triggers, once-per-turn ledger, pending rule/SBA choices, linked exiles, log, and optional dungeon fields. | `src/engine/types.ts`, `GameState`; `src/engine/__tests__/commands.test.ts`; `src/engine/__tests__/review.properties.test.ts`. |
| Solo card/object identity | `src/engine/types.ts`: `CardInstance` (`L30-L78`) uses physical `id` plus `zoneChangeCounter`; `objectIdOf` (`L80-L82`) returns `${id}:${zoneChangeCounter}`. `ObjectSnapshot` (`L146-L163`) carries physical/object IDs and selected characteristics. | `src/engine/__tests__/commands.test.ts` zone-change tests; `src/engine/__tests__/review.properties.test.ts` immutability/invariant walk; `src/store/__tests__/zonesByPlayer.test.ts`. |
| Solo player/private-zone compatibility views | `src/engine/types.ts`: `clonePlayerPrivateZones`, `cloneZonesByPlayer`, `zonesByPlayerWithP1Mirror`, `syncP1ZonesByPlayerFromFlatZones`, `syncFlatPrivateZonesFromPlayers`, `syncPlayersFromLegacyScalars`, and `syncDerivedViews` (`L716-L897`). Flat `zones.library/hand/graveyard` and `zonesByPlayer[localPlayerId]` are deliberately synchronized views. | `src/store/__tests__/zonesByPlayer.test.ts`: initialization, flat-to-player mirror, legacy backfill, missing player/zone arrays; `src/store/__tests__/review.mp-zones-commands.test.ts`: opponent routing, third/fourth player persistence, and snapshot restore. |
| Solo initialization | `src/engine/init.ts`: `InitDeckCard` (`L17-L20`) and `initGame` (`L44-L139`). Commanders start in `command`; non-commanders are shuffled into library using `createRng(seed)`/`shuffledOrder`; initial turn/phase is `1/'untap'`, life is 40, and the store later draws seven. | `src/engine/__tests__/gameStore.test.ts`, `newGame` and opening-hand tests; `src/engine/__tests__/commands.test.ts`; `src/engine/__tests__/random.test.ts`. |
| Solo state transition | `src/engine/commands.ts`: `applyCommand(state, cmd)` (`L7296-L7298`) calls `applyCommandInternal`; `applyResolutionCommands` (`L7300-L7309`) applies a sequence while deferring the SBA/priority boundary until the last command. `ApplyResult` (`L336-L339`) is `{ state, warnings }`. | `src/engine/__tests__/commands.test.ts`; `src/engine/__tests__/review.properties.test.ts` (`applyCommand` input immutability and random walks); `src/engine/__tests__/review.golden-replay.test.ts`. |

### 2.2 Solo command algebra

`src/engine/commands.ts`, `GameCommand` (`L94-L334`), is the current Solo command authority. The closed TypeScript union currently contains these tags:

```text
destroyPermanents, moveCard, setTapped, setFace, setFaceDown,
setManualKeywords, setEffectsAuto, setCardEffectsAuto, addCounters,
markDamage, dealDamage, clearMarkedDamage, preventCombatDamageThisTurn,
enterCombat, declareAttackers, declareBlockers, resolveCombatDamage,
attach, setController, adjustLife, adjustPlayerCounter,
setMaximumHandSizeOverride, applyPlayerEffect, adjustCommanderDamage,
adjustOpponentLife, addMana, adjustMana, payMana, clearManaPool, draw,
mill, shuffle, untapAll, discard, putOnBottom, playLand, arrangeTop,
crackTreasure, castSpell, castCommander, castToStack, addAbilityToStack,
resolveStackTop, removeStackItem, setManualTargets, copyStackItem,
copyPermanent, createToken, createDefinedToken, createScenarioDummy,
nextPhase, nextTurn, completeCleanupStateActions, mulligan,
ventureIntoDungeon, setClassLevel, setSolved, chooseBattleProtector.
```

`applyPlayerEffect` and `dealDamage` have multiple discriminated object shapes inside the union; the tag list above does not collapse their target/effect fields. `[FACT]` The exact field definitions are only `src/engine/commands.ts`, `L94-L334`; no Core type is imported there.

The Solo command algebra includes direct state editing, card movement, full local combat damage resolution, mana and player counters, card casting/ability resolution, guided/manual target paths, turn transitions, and card-specific helper commands. It is broader than the O4P-01N Core V1 payload union. `[FACT]` `src/engine/commands.ts`, `GameCommand`; `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`, `payloadKinds` (`L29-L35`) and the closed-algebra assertion (`L92-L99`).

### 2.3 Solo store, snapshot, undo, and redo authority

| Authority | Exact current surface | Semantics evidenced by source/tests |
| --- | --- | --- |
| Store public authority | `src/store/gameStore.ts`, `GameStore` (`L954-L1101`): `state`, warnings, guided/cast/resolution/commander interaction state, `canUndo/canRedo`, `newGame`, `restoreGame`, `takeSnapshot`, `dispatch`, `undo`, `redo`, and all UI-facing operation methods. | `[FACT]` `src/store/gameStore.ts`, `GameStore`; `src/engine/__tests__/gameStore.test.ts` exercises new game, dispatch, store operations, and undo/redo. |
| Store internal history | `src/store/gameStore.ts`, `InternalState` (`L1103-L1116`) has `past`, `future`, pending guided history, remembered deck, `lastSeed`, and grouped resolution history. `HISTORY_LIMIT` is 200 (`L103-L105`). | `[FACT]` `src/store/gameStore.ts`; `src/engine/__tests__/gameStore.test.ts`, `history is capped at 200`, `undo/redo round trip`, and single-step transaction tests. |
| Commit chokepoint | `src/store/gameStore.ts`, local `commit` (`L1770-L1844`) collects pending triggers, commander-zone choices, cleanup advancement, pushes the prior `GameState` into `past`, clears `future`, and publishes the next state. | `[FACT]` `src/store/gameStore.ts`, `commit`; `src/engine/__tests__/gameStore.test.ts` tests that auto-tap/cast, cycle, mulligan, and bundled basic-land mana are one undo step. |
| Dispatch route | `src/store/gameStore.ts`, local `dispatch` (`L1956-L1965`) calls Solo `applyCommand` and then `commit`; `GameStore.dispatch` exposes this route (`L985-L987`). | `[FACT]` `src/store/gameStore.ts`, `dispatch`; `src/engine/__tests__/gameStore.test.ts`. |
| Undo/redo route | `src/store/gameStore.ts`, `undo` (`L3145-L3211`) first handles pending cast, manual resolution, commander resolution, guided interaction, then global `past/future`; `redo` (`L3213-L3264`) mirrors the interaction/global branches. Global undo/redo stores snapshots, clears pending triggers, and never calls Core. | `[FACT]` `src/store/gameStore.ts`, `undo`/`redo`; `src/engine/__tests__/gameStore.test.ts`, `dispatch pushes history`, `undo/redo round trip`, `history is capped at 200`, `castFromHand ... single undo step`, `cycle ... single step`, and `mulligan ... single step`. |
| Solo snapshot creation | `src/store/gameStore.ts`, `newGame` (`L2942-L2970`), `restoreGame` (`L2972-L2996`), and `takeSnapshot` (`L2998-L3009`). `restoreGame` resets global and interaction history, normalizes the incoming state, and preserves `autoAdvanceToMain`; `takeSnapshot` deep-copies state with `JSON.parse(JSON.stringify(s))`. | `[FACT]` `src/store/gameStore.ts`; `src/store/__tests__/review.m424.test.ts`, `store.restoreGame`; `src/store/__tests__/zonesByPlayer.test.ts`. |
| Solo persistence subscriber | `src/store/gameStore.ts`, subscription (`L5651-L5675`) writes `s.resolutionSession?.baseline ?? s.state`, current deck, `SNAPSHOT_VERSION`, and `autoAdvanceToMain` after a 400 ms delay; null state clears storage. | `src/store/__tests__/snapshotPersistenceControl.test.ts`; `src/store/__tests__/review.m424.test.ts`. |
| Solo random entry point | `src/store/gameStore.ts`, `randomSeed` (`L1121-L1123`) uses `Math.random`; store helpers create a seeded `createRng` and explicit `shuffledOrder` arrays for mulligan, library shuffle, random discard, and fetch/resolve paths. `src/engine/random.ts` implements deterministic mulberry32 and non-mutating Fisher–Yates. | `src/engine/__tests__/random.test.ts`; `src/engine/__tests__/gameStore.test.ts`, fixed-seed `discardRandom`; `src/engine/__tests__/review.properties.test.ts`. |

### 2.4 Solo persistence and application route

| Route | Exact evidence |
| --- | --- |
| Snapshot schema and storage | `src/data/gameSnapshot.ts`: `GameSnapshot` has exactly `version`, `state`, `deck`, and `autoAdvanceToMain` (`L5-L10`); `SNAPSHOT_VERSION = 1` (`L12`); IndexedDB database `mtg-onedeck-game`, object store `snapshot`, key `current`, database version `1` (`L14-L35`); `saveSnapshot`, `loadSnapshot`, and `clearSnapshot` (`L40-L69`) swallow IndexedDB failures. `loadSnapshot` returns `null` unless the record version equals `SNAPSHOT_VERSION` (`L49-L59`). |
| Resume path | `src/App.tsx`: `loadSnapshot` is called on mount (`L75-L86`); the `restore-game` action calls `useGameStore.getState().restoreGame(snapshot)` (`L234-L245`); starting a deck calls `newGame` (`L166-L169`, `L249-L259`). |
| Snapshot normalization/backfill | `src/store/gameStore.ts`, `normalizeSnapshotState` (`L620-L700`) normalizes zones, player-zone mirrors, players, combat, cards, counters, event/pending-trigger/linked-exile fields, and derived views. `src/store/__tests__/zonesByPlayer.test.ts` proves legacy flat-zone backfill and missing private-zone arrays. |
| Persistence tests | `src/store/__tests__/review.m424.test.ts`: IndexedDB round trip, version mismatch returns null, clear removes record, restore clears undo history. `src/store/__tests__/snapshotPersistenceControl.test.ts`: a development fixture restore does not overwrite the normal saved game. `src/store/__tests__/review.mp-zones-commands.test.ts`: third/fourth player state and private zones survive commands and snapshot restore. |
| Solo/Online boundary | `src/test/architecture/soloOnlineBoundary.test.ts` rejects engine/store/UI imports across the current boundary and specifically rejects importing Online `protocolVersion` or `stateSchemaVersion` into `src/data/gameSnapshot.ts` (`L243-L248`, `L429-L447`). |

## 3. Exact current O4P-01N Core authority inventory

### 3.1 Core root, versions, and public integration

| Authority | Exact current surface | Tests/fixture/verifier |
| --- | --- | --- |
| Core root | `src/engine/core/closure/rootV1.ts`, `ModeNeutralCoreRootV1` (`L10-L21`) has exactly `kind`, `versions`, `acceptedCommandCount`, `ruleAuthority`, `playerLifecycle`, `commanders`, `commanderCastLedgers`, `commanderDamage`, `commanderDamageProvenance`, and `combatContext`. `ruleAuthority` nests the shipped J/K/L bundles; the root does not duplicate them. | `src/engine/core/closure/rootValidationV1.ts`, `validateModeNeutralCoreRootV1` and `createModeNeutralCoreRootV1`; `src/engine/core/closure/__tests__/rootV1.test.ts`; `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`; fixture `src/engine/core/fixtures/o4p-01n-mode-neutral-core-closure-v1.json`. |
| Core root validation | `src/engine/core/closure/rootValidationV1.ts`: exact fields, nested validators, active-player/turn-order/lifecycle consistency, commander and damage registries, combat references, fresh canonical output, and frozen deterministic issues. | `src/engine/core/closure/__tests__/rootV1.test.ts`; `repairWave1.test.ts` hostile root/roster tests; `scripts/checks/verify-mode-neutral-core-closure.ts`, `deepFrozen` and root construction. |
| Core closure version vector | `src/engine/core/closure/versionsV1.ts`: `CoreClosureVersionVectorV1` and `CORE_CLOSURE_VERSION_VECTOR_V1` have independent `coreStateSchemaVersion`, `coreCommandSchemaVersion`, `coreEventSchemaVersion`, and `coreReplaySchemaVersion`, all `1` (`L1-L13`). | `src/engine/core/closure/__tests__/review.o4p-01n-mode-neutral-core-closure.test.ts`; `scripts/checks/verify-mode-neutral-core-closure.ts` (`L113`). |
| Public root | `src/engine/core/index.ts` re-exports `./closure`; `src/engine/core/closure/index.ts` re-exports versions, root, canonical, command, result, event, random order, correction, apply, journal, replay, and headless closure. | `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`, required export list (`L14-L27`) and public-root assertion (`L63-L78`). |

The already shipped supporting Core authorities remain separate and are consumed by the O4P-01N root/reducer:

- Identity/zones: `src/engine/core/ids.ts`, `cardDefinition.ts`, `identityZoneState.ts`, `identityZoneCanonicalization.ts`, and `identityZoneValidation.ts`; tests under `src/engine/core/__tests__/`; fixture `identity-zone-slice-v1.json`; verifier `scripts/checks/verify-mode-neutral-core-identity-zone.ts`.
- Object registry/runtime: `src/engine/core/object/**`, V2 validators/factories/upgrades; tests under `src/engine/core/object/__tests__/`; fixture `object-registry-v2.json`; verifier `scripts/checks/verify-mode-neutral-core-object-registry.ts`.
- Stack transaction: `src/engine/core/stack/transaction/**`; tests under `src/engine/core/stack/transaction/__tests__/`; fixture `stack-transaction-v1.json`; verifier `scripts/checks/verify-mode-neutral-core-stack-transaction.ts`.
- Turn/priority: `src/engine/core/turn/**`; tests under `src/engine/core/turn/__tests__/`; fixture `turn-priority-lifecycle-v1.json`; verifier `scripts/checks/verify-mode-neutral-core-turn-priority.ts`.
- Rules/authority: `src/engine/core/rules/**`; tests under `src/engine/core/rules/__tests__/`; fixture `rule-authority-v1.json`; verifier `scripts/checks/verify-mode-neutral-core-rule-authority.ts`.
- Commander/combat/player lifecycle: `src/engine/core/commander/**`, `combat/combatContextV1.ts`, and `player-lifecycle/**`; tests under `src/engine/core/__tests__/`, review `src/engine/core/__tests__/review.o4p-01m-commander-combat-player-exit.test.ts`, fixture `o4p-01m-commander-combat-player-exit-v1.json`, and verifier `scripts/checks/verify-mode-neutral-core-commander-combat-player-exit.ts`.

`[FACT]` The inventory above is also recorded in `research/cr-grounding/o4p-01n-to-02e-forward-plan.draft.md`, §§2.1–3.2. The architecture boundary `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts` forbids Solo `GameState`/`GameCommand`/`SNAPSHOT_VERSION`, React, Zustand, IndexedDB, Online, transport, clocks, and ambient randomness in the closure source (`L80-L99`).

### 3.2 Core command, result, event, and reducer

| Authority | Exact current surface | Semantics |
| --- | --- | --- |
| Typed command envelope | `src/engine/core/closure/commandV1.ts`, `CoreCommandV1` (`L40-L48`): `kind`, `schemaVersion: 1`, `sequence`, `actorPlayerId`, `decisionMakerPlayerId`, `decisionContext`, and closed `payload`. `validateCoreCommandV1` and `createCoreCommandV1` are exported (`L273-L331`). | Every nested record/array is structurally validated and deeply frozen. Actor and decision maker are distinct typed fields; the command is not Solo `GameCommand`. |
| Closed Core payload union | `src/engine/core/closure/commandV1.ts`, `CoreCommandPayloadV1` (`L33-L38`) contains exactly 15 kinds: `stack-commit-card-spell`, `stack-remove-object`, `priority-pass`, `search-open`, `search-complete`, `control-effect-apply`, `commander-cast-record`, `commander-damage-record`, `combat-step-set`, `combat-attack-add`, `combat-block-add`, `player-exit`, `random-zone-order`, `correct-player-life`, `correct-commander-damage`. | `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`, payload list (`L29-L35`) and closed-algebra assertion (`L92-L99`); fixture payload list; verifier asserts `15`. |
| Reducer | `src/engine/core/closure/applyCommandV1.ts`, `applyCoreCommandV1` (`L204-L273`). It validates root, command, sequence, active actor/decision maker, decision authority, payload bindings, invokes one typed handler, validates the candidate root, increments `acceptedCommandCount` only for success, and returns typed rejection without mutation/events. | `src/engine/core/closure/__tests__/repairWave1.test.ts`: malformed/authority/sequence/operation rejection, actor binding, inactive defender, four-player payload surface; `src/engine/core/closure/__tests__/review.o4p-01n-mode-neutral-core-closure.test.ts`; verifier. |
| Command result | `src/engine/core/closure/commandResultV1.ts`: `CoreCommandResultV1` and `CoreCommandIssueV1`/`CoreCommandWarningV1`; `src/engine/core/closure/applyCommandV1.ts` returns `accepted`, `accepted-with-warning`, or `rejected`. Rejected results retain the exact input root reference and have no events. | `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`, §§7–8; `repairWave1.test.ts`; `scripts/checks/verify-mode-neutral-core-closure.ts`. |
| Domain events | `src/engine/core/closure/domainEventV1.ts`: `CoreDomainEventPayloadV1`, `CoreDomainEventV1`, and `createCoreDomainEventV1`. Events include command sequence/index/actor/decision maker and closed semantic payloads; they are derived output, not a reducer. | `src/engine/core/closure/__tests__/repairWave1.test.ts`; architecture test forbids `applyDomainEvent`, `reduceDomainEvent`, and whole-state event replacement (`L92-L99`). |
| Canonical state/event digest | `src/engine/core/closure/canonicalV1.ts`: `serializeCoreCanonicalValueV1`, `coreSha256HexV1`, `coreCanonicalDigestFromValueV1`, `serializeModeNeutralCoreRootV1`, and `serializeCoreDomainEventsV1`. | `src/engine/core/closure/__tests__/canonicalV1.test.ts` standard SHA-256, UTF-16 key order, descriptor traps, cycles, and repeated references; verifier SHA-256 vectors (`L113-L115`). |

### 3.3 Core randomness, correction, journal, save/load boundary, and replay

| Authority | Exact current surface | What is actually proven |
| --- | --- | --- |
| Deterministic random outcome | `src/engine/core/closure/randomZoneOrderV1.ts`: `CoreRandomZoneOrderInputV1`, `validateCoreRandomZoneOrderV1`, and `applyCoreRecordedZoneOrderV1`. The command records complete `beforeOrder` and `afterOrder` for a player library; the reducer does not call `Math.random` or read a seed. | `src/engine/core/closure/__tests__/repairWave1.test.ts`, hostile random-order arrays and tampered replay; `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`; verifier random permutation vector. |
| Typed manual correction | `src/engine/core/closure/correctionV1.ts`: `CORE_MANUAL_CORRECTION_WARNING_CODE_V1`, `validateCoreCorrectionReasonV1`, and `createCoreCorrectionWarningV1`. Payloads are in `commandV1.ts`; reducer handlers are in `applyCommandV1.ts`. | `repairWave1.test.ts` and verifier prove accepted correction warning, safe event metadata, journal reason retention, stale digest rejection, and tampered-reason replay divergence. |
| Journal | `src/engine/core/closure/journalV1.ts`: `CoreCommandJournalEntryV1`, `appendCoreCommandJournalEntryV1`, and `validateCoreCommandJournalEntryV1`. Each entry stores command, command digest, status, before/after state digests, and event digest. | `repairWave1.test.ts` checks frozen normalized entries, rejected-command sequence retention, exact sequence validation, and hostile descriptors. |
| Replay package | `src/engine/core/closure/journalV1.ts`: `CoreReplayPackageV1`, `createCoreReplayPackageV1`, and `validateCoreReplayPackageV1`; `src/engine/core/closure/replayV1.ts`: `replayCoreCommandsV1` and `replayCoreCommandsFromRootV1`. Replay starts from the initial root and re-applies typed commands; it does not trust stored events/results to transition state. | `repairWave1.test.ts`, `rootV1.test.ts`, and verifier use `JSON.stringify`/`JSON.parse` round-trip, final state/event digest equality, and first-divergence checks for command/status/before/after/event/final digests. |
| Core save/load | `[FACT]` No Core IndexedDB/file/network persistence function is present in `src/engine/core/closure/**`; `rg` finds serialization and JSON round-trip only in `canonicalV1.ts`, `journalV1.ts`, tests, and `scripts/checks/verify-mode-neutral-core-closure.ts`. The current Core “save/load” authority is therefore the frozen `CoreReplayPackageV1` value plus validation/replay, not a storage service. | `src/engine/core/closure/journalV1.ts`; `src/engine/core/closure/replayV1.ts`; `src/engine/core/closure/__tests__/repairWave1.test.ts`; `scripts/checks/verify-mode-neutral-core-closure.ts`, `L169-L173`. |
| Four-player closure | `src/engine/core/closure/headlessClosureV1.ts`: `CoreHeadlessClosureReportV1`, `runOrdinaryFourPlayerCoreClosureV1`, and alias `executeOrdinaryFourPlayerCoreClosureV1`. The report includes initial/final roots and digests, journal, events, replay package, and explicit six-item defer list. | `src/engine/core/closure/__tests__/repairWave1.test.ts`; fixture `o4p-01n-mode-neutral-core-closure-v1.json`; verifier `scripts/checks/verify-mode-neutral-core-closure.ts`, `L159-L185` and final output. |

## 4. Solo/Core field and operation parity matrix

The classification column uses only the requested vocabulary. “Transformable” means a deterministic adapter can be specified from current evidence, not that an adapter exists. “Lossy” means at least one direction cannot preserve the current authority’s identity/meaning without an explicit loss policy. “Unsupported” means the shipped Core V1 contract explicitly does not expose the operation. “Unresolved” means current evidence does not establish a safe mapping.

| Concern | Solo authority | Core authority | Classification | Grounding consequence |
| --- | --- | --- | --- | --- |
| Immutable state-transition boundary | `src/engine/commands.ts`, `applyCommand`; `ApplyResult`. | `src/engine/core/closure/applyCommandV1.ts`, `applyCoreCommandV1`; `CoreCommandResultV1`. | transformable | Both are pure reducer-shaped boundaries, but their state and command types are disjoint. A parity adapter must compare normalized results, not object identity. |
| Whole root envelope | `GameState` in `src/engine/types.ts`. | `ModeNeutralCoreRootV1` in `src/engine/core/closure/rootV1.ts`. | transformable | The adapter must explicitly enumerate fields; no spread/structural cast can be treated as parity. |
| Card physical identity | `CardInstance.id` and `zoneChangeCounter`; `objectIdOf` in `src/engine/types.ts`. | `CorePhysicalCardId` and V2 `CoreObjectId`/incarnation in `src/engine/core/ids.ts`, `object/objectIdV2.ts`. | transformable | Require a bidirectional physical-card/object-incarnation table. Reconstructing an object ID from a stale Solo card reference must reject, not silently retarget. |
| Zone topology and order | Seven Solo zones plus `zonesByPlayer` private-zone mirror in `src/engine/types.ts`. | Per-player library/hand/graveyard and shared battlefield/stack/exile/command in Core object registry, consumed by `applyCommandV1.ts`. | transformable | Map owner/private zones and shared zones explicitly; preserve array order. Solo’s flat private arrays are a derived compatibility view, not a second Core zone. |
| Player identity and roster | `PlayerId = string`, default `P1`/`OPPONENT_A`, partial players, arbitrary opponent labels in `src/engine/types.ts` and `gameStore.ts`. | Typed Core player IDs, four-player active registry, stable historical lifecycle in `rootV1.ts` and player-lifecycle sources. | lossy | Solo can represent arbitrary labels but does not preserve Core’s stable historical roster/exit semantics; Core four-seat history cannot be round-tripped into a two-player/default Solo view without policy. |
| Local/acting player | `localPlayerId` and UI/store caller in `GameState`/`GameStore`. | `actorPlayerId` and `decisionMakerPlayerId` validated by `applyCoreCommandV1.ts`. | lossy | Never map UI/local identity directly to Core decision authority. A proposal must define actor and decision-maker separately or reject. |
| Commander identity | `CommanderInfo { cardId, castCount }` and `GameState.commanders` in `src/engine/types.ts`; cast actions in `commands.ts`. | `CoreCommanderIdentityV1`, cast ledgers, physical IDs, owner roster in `rootV1.ts` and commander sources. | transformable | `cardId` maps to physical commander ID; cast count maps to the corresponding ledger only after owner/object identity is verified. |
| Commander damage | `GameState.commanderDamage: Record<string, number>` keyed by free-form opponent labels. | `CoreCommanderDamageStateV1` keyed by commander physical ID and defending Core player, plus provenance ledger and combat object. | lossy | Solo label keys do not prove physical commander or defending-player identity; Core provenance cannot be reconstructed from a label-only entry. Adapter must reject or mark explicit loss. |
| General life | Solo local `life`, `opponentLife`, player life in `PlayerState`; `adjustLife`/`adjustOpponentLife`. | Core root has no general life field in `ModeNeutralCoreRootV1`; V1 only has `correct-player-life`, which writes registry player life in `applyCommandV1.ts`. | lossy | Core correction is not a general life-transition algebra. Do not claim Solo life parity from the correction payload. |
| Poison, energy, experience | Solo `GameState` and `PlayerState` fields plus `adjustPlayerCounter`. | No corresponding Core root field or V1 payload in `rootV1.ts`/`commandV1.ts`. | Solo-only | Preserve in Solo facade; do not drop during a Core round trip unless a later contract explicitly defines loss. |
| Mana pool and payment | Solo `ManaPool`, player mana fields, `addMana`/`adjustMana`/`payMana`/`clearManaPool`. | No mana field or mana payload in Core V1 root/command union. | Solo-only | Core adapter cannot claim cast/payment parity. Keep these routes Solo-only or reject Core conversion. |
| Turn/phase/priority | Solo top-level `turn`, `phase`, `activePlayerId`, `nextPhase`, `nextTurn`, `dispatchTurnTransition`. | Core K lifecycle/priority nested in `ruleAuthority.turnPriorityBundle`; V1 exposes only `priority-pass` in `commandV1.ts`. | transformable | Normalize turn position/window/holder/pass state; do not flatten Core lifecycle into Solo fields without retaining the Core source. |
| Stack objects and announcements | Solo stack cards/abilities and `castToStack`, `addAbilityToStack`, `resolveStackTop`, `removeStackItem`. | Core J stack transaction bundle and only V1 `stack-commit-card-spell`/`stack-remove-object`. | lossy | The V1 command subset cannot represent all Solo ability/copy/resolve semantics. Non-subset stack actions must not be silently converted. |
| Search and control | Solo search/compiler/store flows in `commands.ts`/`gameStore.ts`. | Core L search sessions and control-effect operations, exposed through `search-open`, `search-complete`, `control-effect-apply`. | transformable | Only the exact Core operation inputs are candidates; Solo reveal/move/shuffle and guided behavior need separate row-level vectors. |
| Visibility/private information | Solo state is local and contains full `defs`/cards/zones in `GameState`. | Core has visibility slices but O4P-01N events avoid full hidden-zone contents; `review.o4p-01n...` forbids projection/transport. | unresolved | Current evidence does not define whether a Solo full-information snapshot may become a Core root while preserving privacy and event redaction. Stop before any hidden-card projection rule is inferred. |
| Combat declaration structure | Solo `CombatState`, `enterCombat`, `declareAttackers`, `declareBlockers`. | Core `CoreCombatContextV1`, `combat-step-set`, `combat-attack-add`, `combat-block-add`. | transformable | Compare ordered attackers/blockers/defenders after explicit object-ID mapping. |
| Full combat damage | Solo `resolveCombatDamage` and damage/SBA behavior in `commands.ts`. | O4P-01N fixture/report explicitly defers `full-combat-damage`; no Core payload exists. | unsupported | Do not route Solo `resolveCombatDamage` through Core V1. |
| Pending triggers/SBA/cleanup | Solo pending triggers, choices, automatic collection, and phase transitions in `GameState`, `commands.ts`, `gameStore.ts`. | Core K exposes primitive lifecycle/priority/trigger slices, but O4P-01N command contract explicitly defers trigger placement/SBA/turn advance handlers. | unsupported | Existing Core primitives are not evidence of command parity. Keep conversion bounded to no-pending-choice vectors or reject. |
| Events/logs | Solo `eventLog: GameEvent[]` plus Japanese `log: LogEntry[]`. | Core immutable typed `CoreDomainEventV1` and event transcript digest. | lossy | Solo log text and broad event union cannot be byte/semantic-equal to Core events; compare a judge-defined semantic subset only. |
| Accepted result | Solo returns `{ state, warnings }`. | Core returns new root, status, events, warnings, and before/after digests. | lossy | Solo has no typed accepted/rejected result envelope or digest. Adapter must define normalization and cannot equate warning strings with typed Core warnings. |
| Rejected operation | Solo `applyCommand` can throw `EngineError`; store `reportActionError` puts the message in warnings. | Core returns `status: 'rejected'`, exact input-root reference, typed issues, unchanged digest, and no events. | lossy | A store warning is not a Core rejection. Differential vectors must record thrown/store-visible/error semantics separately. |
| Randomness | Solo action helpers use ambient `randomSeed()` then put the generated order in some commands; `newGame` accepts a seed but `GameSnapshot` does not store the seed. | Core `random-zone-order` records decision ID, exact before order, exact after order and replays the recorded result. | transformable | Compare recorded resulting order, not RNG algorithm/seed. A missing Solo random decision record is a STOP for replay parity. |
| Undo/redo | Store `past`/`future` snapshots with guided/manual interaction branches, 200 cap. | Core has ordered journal/replay and no `undo`/`redo` API. | Solo-only | A Core adapter must not pretend replay-prefix is the same as Solo undo/redo; if offered later it requires a separate contract. |
| Manual correction | No typed correction command in Solo `GameCommand`; users/store can perform ordinary commands/manual resolution. | Core typed `correct-player-life` and `correct-commander-damage` with stale-digest guard and warning. | Core-only | Do not synthesize correction from ordinary Solo commands without a dedicated audit policy. |
| IndexedDB snapshot persistence | `saveSnapshot`/`loadSnapshot`/`clearSnapshot` in `src/data/gameSnapshot.ts`. | No storage API in Core closure; only replay package value validation/replay. | Solo-only | Preserve current IndexedDB schema independently; Core replay package storage, if later desired, is a separate proposal. |
| JSON replay package | No Solo replay package or canonical state/event digest API is exported. | `CoreReplayPackageV1`, journal validation, `replayCoreCommandsV1`. | Core-only | Use Core package as Core evidence, not as a replacement for `GameSnapshot`. |
| Offline single-process operation | Solo `App`/`GameStore` works without network and persists locally. | O4P-01N headless closure is pure, transport-free, and defers network/room/projection/UI. | transformable | “Offline” is an environment property shared by both routes; authority remains route-specific. |

## 5. Snapshot compatibility matrix

### 5.1 Current Solo snapshot contract

| Item | Current fact | Compatibility requirement for O4P-02A |
| --- | --- | --- |
| Version | `SNAPSHOT_VERSION = 1` in `src/data/gameSnapshot.ts:L12`. | Keep version `1` loadable. Do not reuse or alias it to `coreStateSchemaVersion`, `stateSchemaVersion`, `eventSchemaVersion`, `protocolVersion`, or `projectionSchemaVersion`. |
| Top-level schema | `GameSnapshot` has exactly `version`, `state`, `deck`, `autoAdvanceToMain` in `src/data/gameSnapshot.ts:L5-L10`. | Existing records must remain accepted with the same field meanings. Adding a Core root field to this record would be a schema change, not an invisible adapter. |
| Storage identity | DB `mtg-onedeck-game`, object store `snapshot`, key `current`, IDB version `1` in `src/data/gameSnapshot.ts:L14-L35`. | Do not change database/store/key or replace the current record with a Core replay envelope in O4P-02A. |
| Load behavior | `loadSnapshot` returns `null` for missing storage, storage errors, or any version other than `1` in `src/data/gameSnapshot.ts:L49-L59`. | Preserve fail-closed version behavior; do not reinterpret Core version failures as valid Solo snapshots. |
| Save behavior | `saveSnapshot` writes the whole `GameSnapshot` and swallows IndexedDB errors in `src/data/gameSnapshot.ts:L40-L47`. | Preserve offline/no-storage continuation behavior. A Core adapter must not make Solo save success depend on Core conversion. |
| Clear behavior | `clearSnapshot` deletes the fixed record and swallows errors in `src/data/gameSnapshot.ts:L62-L69`. | Preserve current clear semantics. |
| Write timing/value | `src/store/gameStore.ts:L5651-L5675` debounces 400 ms and stores resolution baseline when a manual resolution session is active; otherwise current state, current deck, version, and `autoAdvanceToMain`. | Differential tests must compare the persisted value after the debounce and must include active manual-resolution baseline behavior. |
| Restore behavior | `src/store/gameStore.ts:L2972-L2996` clears global/pending histories, calls `normalizeSnapshotState`, restores `autoAdvanceToMain`, and marks no mulligan decision pending. | Core conversion must be outside this route or explicitly preserve these Solo post-restore semantics. Do not make Core journal history appear as Solo undo history. |
| Backfill behavior | `normalizeSnapshotState` and `syncDerivedViews` backfill/normalize player private zones, legacy flat zones, cards, counters, triggers, linked exiles, and derived views; tests are in `src/store/__tests__/zonesByPlayer.test.ts:L111-L174`. | Legacy snapshots must keep loading exactly as before. Any adapter must consume the normalized result and must not bypass `restoreGame`. |
| Byte compatibility | `[FACT]` Current `GameSnapshot` has no exported canonical serializer or SHA-256 byte contract; persistence uses IndexedDB structured cloning. | `[UNRESOLVED]` “Byte compatible” cannot be claimed as a canonical byte equality guarantee from current source. The frozen contract must choose whether schema/value compatibility alone is required, or define a new additive envelope without changing `GameSnapshot`. |
| Existing tests | `src/store/__tests__/review.m424.test.ts` covers IndexedDB round trip/version mismatch/clear/restore history; `snapshotPersistenceControl.test.ts` covers isolation; `review.mp-zones-commands.test.ts` covers multiplayer snapshot restore. | O4P-02A acceptance must rerun the complete affected snapshot suites, not only a new adapter test. |

### 5.2 Core version and replay package boundary

| Item | Current fact | Required preservation |
| --- | --- | --- |
| Core version vector | `src/engine/core/closure/versionsV1.ts:L1-L13` has four independent Core V1 fields. | Keep all four independent from Solo snapshot and shared Online vectors. |
| Core replay envelope | `CoreReplayPackageV1` in `src/engine/core/closure/journalV1.ts:L22-L29` contains versions, initial Core root, journal, expected final state digest, and expected event transcript digest. | It must remain a Core replay value; it must not be stored by overwriting the current Solo `GameSnapshot`. |
| Replay load/validation | `validateCoreReplayPackageV1` validates exact fields, versions, root, dense journal, digests, and contiguous accepted-command sequence in `journalV1.ts:L119-L141`. | Any adapter replay vector must validate before conversion and must fail closed on version/sequence/digest mismatch. |
| Replay transition authority | `replayCoreCommandsV1` in `src/engine/core/closure/replayV1.ts:L16-L41` replays by calling `applyCoreCommandV1`; it does not apply stored events. | Do not run Solo `applyCommand` and Core `applyCoreCommandV1` on the same command and choose whichever state “looks right”. |

## 6. Authority rule proposal and current route classification

### 6.1 Proposed rule for Sol to freeze

`[PROPOSAL]` One session has one transition authority. A Solo session is authorized by `GameState` + Solo `applyCommand`/`applyResolutionCommands` + `GameStore.commit`; a Core session is authorized by `ModeNeutralCoreRootV1` + `CoreCommandV1` + `applyCoreCommandV1`. An adapter may translate at a boundary and compare normalized evidence, but it must not have both reducers mutate a session and then select one result.

`[PROPOSAL]` Core domain events/journal evidence are derived from the Core reducer and are not a second reducer, consistent with `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`, §§1 and 7. Solo `eventLog`/`log` are also observations, not a substitute for `GameState`.

### 6.2 Current route classification

| Current route | Authority classification | Evidence |
| --- | --- | --- |
| `App` mount → `loadSnapshot` → resume button → `GameStore.restoreGame` | Solo-authoritative | `src/App.tsx:L75-L86`, `L234-L245`; `src/data/gameSnapshot.ts`; `src/store/gameStore.ts:L2972-L2996`. |
| UI/store operation → `GameStore.dispatch` → Solo `applyCommand` → `commit` | Solo-authoritative | `src/store/gameStore.ts:L985-L987`, `L1956-L1965`, `L1770-L1844`. |
| Store helper with generated command list → Solo `applyCommands`/`applyCommand` → `commit` | Solo-authoritative | `src/store/gameStore.ts`, `applyCommands` call sites and `commit`; `src/engine/commands.ts:L7296-L7309`. |
| `src/engine/core/closure` command route | Core-authoritative and transport-free | `src/engine/core/closure/applyCommandV1.ts:L204-L273`; `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts:L80-L99`. |
| Core replay package route | Core-authoritative replay evidence | `src/engine/core/closure/journalV1.ts:L103-L141`; `src/engine/core/closure/replayV1.ts:L16-L41`. |
| Solo/Core compatibility adapter | Not present in current tree | `[FACT]` No adapter path/symbol is named by `src/engine/core/index.ts`, `src/store/gameStore.ts`, `src/data/gameSnapshot.ts`, or the O4P-01N closure barrel; `[INFERENCE]` O4P-02A must introduce and own this boundary only after contract freeze. |

## 7. Candidate adapter boundary and non-overlapping lanes

These are proposals, not current paths or symbols.

### 7.1 Candidate boundary

`[PROPOSAL]` Put a narrow, pure compatibility module between the Solo facade and Core closure, for example:

```text
PROPOSAL: src/engine/compatibility/soloCoreAdapterV1.ts
PROPOSAL: src/engine/compatibility/soloCoreNormalizationV1.ts
```

The proposed boundary should accept one fully normalized Solo `GameState` plus an explicit mapping/context, or one Core root plus an explicit import policy, and return a typed conversion result with complete issues. It must not import React, Zustand, IndexedDB, `App`, Online, Cloudflare, or UI. These paths are proposals only; no such files currently exist.

`[PROPOSAL]` Keep persistence separate:

```text
PROPOSAL: src/engine/compatibility/soloSnapshotBridgeV1.ts
PROPOSAL: src/engine/compatibility/__tests__/soloCoreDifferentialV1.test.ts
PROPOSAL: src/engine/compatibility/__tests__/soloSnapshotPreservationV1.test.ts
```

The bridge should call existing `restoreGame`/`takeSnapshot` only through an explicit test seam or store-facing boundary chosen by Sol; it must not rewrite `src/data/gameSnapshot.ts` as part of the grounding-derived assumption.

### 7.2 Non-overlapping implementation/test lanes

| Lane | Proposed write scope | Must not touch |
| --- | --- | --- |
| Adapter implementer | `[PROPOSAL]` `src/engine/compatibility/**` production adapter only. | `src/engine/core/closure/**`, `src/engine/core/index.ts`, `src/data/gameSnapshot.ts`, `src/store/gameStore.ts`, version vectors, docs, ledger, review tests, fixture/verifier. |
| Differential test implementer | `[PROPOSAL]` ordinary tests under `src/engine/compatibility/__tests__/**`. | `review.*`, Core closure tests, Solo existing tests, fixture/verifier, production adapter outside the lane. |
| Snapshot preservation lane | `[PROPOSAL]` additive ordinary tests only, or a judge-owned serial lane if existing snapshot tests must change. | Existing `GameSnapshot` schema/version/storage code unless Sol explicitly authorizes a contract-driven change. |
| Judge-owned integration | Serial only: Core public barrel, version vectors, fixture/verifier, architecture/review evidence, manifest, ledger, loop-state, git/release. | Parallel adapter lanes. |

`[FACT]` Existing O4P-01N ownership is already explicit in `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`, §§10–11: the implementer owned closure/ordinary tests while Sol owned root integration, fixture, verifier, architecture/review evidence, manifest, ledger, and release. The same separation should be retained for O4P-02A.

## 8. Minimum differential replay vectors

`[PROPOSAL]` The frozen O4P-02A acceptance contract should require a vector table with an explicit normalized comparison function. The comparison must never compare unrelated full JSON objects or silently delete fields.

1. **Initial normalization.** Start from a fixed Solo `initGame(deck, seed)` plus store opening-hand path and a fixed four-player Core fixture/root. Verify card/physical/object mapping, player mapping, zone order, commanders, active player, turn/phase/window, and all fields that are intentionally excluded. Evidence: `src/engine/init.ts`, `src/store/gameStore.ts:newGame`, `src/engine/core/fixtures/o4p-01n-mode-neutral-core-closure-v1.json`, and `scripts/checks/verify-mode-neutral-core-closure.ts:48-101`.
2. **Accepted/rejected commands.** For one shared semantic operation, record Solo `ApplyResult` or thrown `EngineError`/store warning and Core `CoreCommandResultV1`. Include accepted state, rejected state, event absence, root/reference preservation, sequence behavior, and typed issue normalization. Evidence: `src/engine/commands.ts:7296-7309`; `src/engine/core/closure/applyCommandV1.ts:204-273`; `repairWave1.test.ts:145-158`.
3. **Actor versus decision maker.** Use a Core search-open/search-complete vector where actor and decision maker differ, and a Solo guided/search equivalent. Verify that the adapter never substitutes local UI identity for decision authority. Evidence: `commandV1.ts`, `applyCommandV1.ts:215-240`, `scripts/checks/verify-mode-neutral-core-closure.ts:136-138`.
4. **Undo/redo.** Apply a shared supported operation, Solo `undo`, Solo `redo`, and compare normalized Solo states. Separately replay the Core journal prefix/full package and assert that this is a distinct evidence path, not a claimed Core undo implementation. Evidence: `gameStore.ts:3145-3264`; `journalV1.ts`; `replayV1.ts`; `gameStore.test.ts` undo/redo tests.
5. **Save/load.** Save and load a current version-1 Solo snapshot through fake IndexedDB; restore through `restoreGame`; assert clean history, normalization/backfill, deck, `autoAdvanceToMain`, and unchanged persisted record after a development fixture restore. Separately JSON round-trip a Core replay package, validate, replay, and compare final state/event digests. Evidence: `gameSnapshot.ts`, `gameStore.ts:2972-3009` and `5651-5675`, `review.m424.test.ts`, `snapshotPersistenceControl.test.ts`, `journalV1.ts`, `replayV1.ts`, verifier `169-173`.
6. **Commander fields.** Cover one commander, two Solo commanders, command-zone return, cast count/tax, Core physical commander identity, cast ledger, commander damage, provenance combat object, and an inactive defender rejection. Do not compare Solo label-keyed commander damage to Core provenance as equal without an explicit mapping. Evidence: `src/engine/types.ts:649-652,676-714`; `src/engine/__tests__/commands.test.ts` commander tests; `src/engine/__tests__/gameStore.test.ts:341-360`; `repairWave1.test.ts:261-313`; verifier `139-147`.
7. **Randomness.** Use a fixed Solo seed for initialization and a fixed recorded shuffle order for every converted operation. Compare resulting ordered zones, not RNG implementation. Include a missing/recomputed order rejection and Core tampered `afterOrder` divergence. Evidence: `src/engine/random.ts`; `src/store/gameStore.ts:1121-1123,3021-3026,3274-3279`; `random.test.ts`; `randomZoneOrderV1.ts`; `repairWave1.test.ts:297-303`.
8. **Offline operation.** Run the same vector with no network/Online imports: Solo through `App`/store snapshot route and Core through headless closure/replay. Assert the route-specific authority rule and explicit Core defer list. Evidence: `src/test/architecture/soloOnlineBoundary.test.ts`; `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`; `headlessClosureV1.ts`.
9. **Unsupported/lossy cases.** Include mana, poison/energy/experience, full combat damage, guided/manual resolution, arbitrary opponent labels, and hidden/full-zone data. Each must produce an explicit class/rejection/loss result, never a successful partial conversion. Evidence: the Solo `GameState`/`GameCommand` definitions and O4P-01N payload/defer lists named in §4.
10. **Determinism and immutability.** Freeze/compare inputs before and after both routes; run the same normalized vector twice; compare canonical Core digests and normalized Solo values. Evidence: `src/engine/__tests__/review.properties.test.ts`; `canonicalV1.test.ts`; `repairWave1.test.ts`; Core verifier `deepFrozen` and digest assertions.

## 9. Risks and STOP conditions

### 9.1 Risks

- **Lossy conversion:** Solo opponent-label commander damage, arbitrary player labels, full-information local state, and legacy scalar/mirror views do not carry all Core physical/player/provenance identity. Evidence: `src/engine/types.ts:649-714,742-897`; Core `rootV1.ts`; `commanderDamageV1.ts`; `commanderDamageProvenanceV1.ts`.
- **Object identity mismatch:** Solo `id:zoneChangeCounter` and Core physical/object incarnation IDs look related but are not the same authority. Evidence: `src/engine/types.ts:30-82`; `src/engine/core/object/objectIdV2.ts`; `src/engine/core/transition/cardReincarnation.ts`.
- **Hidden fallback:** Solo store helpers may construct command lists, warnings, guided/manual sessions, or random outcomes before commit. Evidence: `src/store/gameStore.ts:1770-1844,1956-1965,2689-2826,4033-4039,4707-4737`. A parity adapter that only observes final `GameState` may miss rejected/partial/guided semantics.
- **Snapshot migration:** `restoreGame` normalizes and backfills legacy snapshots. Evidence: `src/store/gameStore.ts:620-700`; `src/store/__tests__/zonesByPlayer.test.ts:111-174`. Replacing this with Core canonical validation would change current Solo compatibility.
- **Version coupling:** Solo version 1, Core closure versions 1, and shared Online vector fields are distinct. Evidence: `src/data/gameSnapshot.ts:5-12`; `src/engine/core/closure/versionsV1.ts:1-13`; `src/versioning/contractVersions.ts:178-196`; `soloOnlineBoundary.test.ts:243-248`.
- **Online import leakage:** Core closure and Solo snapshot boundaries explicitly forbid Online/transport/storage imports. Evidence: `review.o4p-01n-mode-neutral-core-closure-boundary.test.ts:80-99`; `soloOnlineBoundary.test.ts:225-270`.
- **Randomness mismatch:** Solo has ambient seed generation (`Math.random`) while Core replays explicit outcomes. Evidence: `src/store/gameStore.ts:1121-1123`; `src/engine/core/closure/randomZoneOrderV1.ts`; O4P-01N contract §7.
- **Authority duplication:** Calling both reducers and selecting a “matching” result would make the adapter a hidden second authority. Evidence: `src/store/gameStore.ts:1956-1965`; `src/engine/core/closure/applyCommandV1.ts:204-273`; O4P-01N contract §1.

### 9.2 STOP conditions

Stop the O4P-02A contract/implementation lane if any of the following occurs:

1. A required mapping cannot preserve physical object identity, player identity, commander provenance, or ordered zones without an explicit `lossy` policy and acceptance vector.
2. A proposed adapter needs to mutate both `GameState` and `ModeNeutralCoreRootV1` for one semantic command, or needs to select between two reducer results.
3. A snapshot proposal changes `SNAPSHOT_VERSION`, `GameSnapshot` top-level fields, IndexedDB DB/store/key, or existing `restoreGame` backfill semantics without a separately approved migration contract.
4. A Core replay proposal treats stored events/results as state-transition input, rerolls Solo/Core randomness, or omits the recorded before/after order.
5. A conversion of Solo `resolveCombatDamage`, mana/payment, poison/energy/experience, guided/manual resolution, or arbitrary label-keyed commander damage is presented as successful Core V1 parity.
6. A route imports `src/online/**`, React, Zustand, IndexedDB, UI, Cloudflare, WebSocket, or transport into the Core closure/adapter purity boundary without an explicit later-slice authorization.
7. A new version is introduced by aliasing Solo `SNAPSHOT_VERSION` to Core/shared Online schema versions.
8. A proposed implementation lane needs to edit Core closure/root/barrel, existing Solo snapshot/store source, review tests, fixture/verifier, version vectors, ledger, or governance files outside the serial judge-owned lane.
9. Current source/test evidence conflicts with the named O4P-01N shipped contract or ledger and the conflict cannot be resolved by an exact source/test reference. Do not silently infer parity.

## 10. Facts, inferred gaps, proposals, unresolved conflicts

### Repository facts

- `[FACT]` Solo’s authoritative transition path is `GameStore.dispatch` → `applyCommand` → `commit`, and its authoritative persistence path is `GameSnapshot` version 1 through IndexedDB. Evidence: `src/store/gameStore.ts`, `src/data/gameSnapshot.ts`.
- `[FACT]` Solo has snapshot-based global and interaction undo/redo with a 200-entry limit. Evidence: `src/store/gameStore.ts:103-105,1103-1116,3145-3264`.
- `[FACT]` Core O4P-01N has an independent immutable root, typed command/result/event closure, recorded random outcome, journal, replay package, and four-player headless report. Evidence: `src/engine/core/closure/**`, O4P-01N fixture/verifier, and ledger O4P-01N evidence.
- `[FACT]` Core has no current IndexedDB/save-service authority; Core JSON round-trip evidence is replay-package validation/replay. Evidence: `src/engine/core/closure/journalV1.ts`, `replayV1.ts`, closure tests, and `scripts/checks/verify-mode-neutral-core-closure.ts:169-173`.
- `[FACT]` No current Solo/Core adapter exists in the named routes/barrels. Evidence: `src/store/gameStore.ts`, `src/data/gameSnapshot.ts`, `src/engine/core/index.ts`, `src/engine/core/closure/index.ts`.

### Inferred gaps

- `[INFERENCE]` O4P-02A needs a field-level normalization contract before production adapter code; final-state JSON equality is invalid because the state envelopes intentionally differ.
- `[INFERENCE]` Snapshot preservation and Core replay preservation are two separate compatibility obligations. One cannot be proven by the other.
- `[INFERENCE]` Differential parity must include rejected commands, warnings, pending interaction state, randomness evidence, and history semantics, not only accepted final board state.

### Proposals

- `[PROPOSAL]` Use a pure additive adapter boundary with an explicit mapping/loss result and no reducer duplication.
- `[PROPOSAL]` Keep `GameSnapshot`/`SNAPSHOT_VERSION` unchanged for O4P-02A and test Core replay package compatibility separately.
- `[PROPOSAL]` Treat unsupported Core V1 operations as explicit rejects/defer results rather than partial conversions.
- `[PROPOSAL]` Reserve Core root/barrel/version/fixture/verifier/review integration for serial judge ownership and keep ordinary adapter tests disjoint.

### Unresolved authority conflicts

- `[UNRESOLVED]` Whether O4P-02A should support Solo→Core import, Core→Solo projection, or only differential observation is not decided by current source. The ledger says “compatibility adapter” but does not define direction or loss policy.
- `[UNRESOLVED]` Whether Core general player life is intended to become a shared state field is not answered by O4P-01N; the current V1 correction handler is not a general life-transition algebra. Evidence: `rootV1.ts` and `applyCommandV1.ts:268`.
- `[UNRESOLVED]` Whether `GameSnapshot` requires byte-level equality or only existing structured-clone/schema/value compatibility is not answered by current source; no Solo canonical byte serializer is exported.
- `[UNRESOLVED]` Whether Solo pending guided/manual interaction state is part of parity or an explicit Solo-only boundary must be frozen by Sol before adapter implementation.
- `[UNRESOLVED]` Whether Core player exit/active-player handoff can be represented by the existing Solo opponent model without loss is not established; Core V1 explicitly rejects active-player/priority-holder exit that cannot be rebuilt through its existing turn authority. Evidence: `applyCommandV1.ts:140-154`; O4P-01N contract amendment §11.

### Bounded follow-ups instead of broad exploration

The following inventories are intentionally not expanded in this grounding pass. Each is an exact, bounded follow-up with a finite source/test scope; it is not evidence that the follow-up work has been completed.

| Follow-up | Exact scope | Done when |
| --- | --- | --- |
| `FUP-02A-SOLO-OPS` — operation-level Solo catalog | `src/store/gameStore.ts`, `GameStore` method signatures `L970-L1101`, local `dispatch`/`commit`/`undo`/`redo` `L1770-L1844,1956-L1965,3145-L3264`; `src/engine/commands.ts`, `GameCommand` `L94-L334`; tests limited to `src/engine/__tests__/gameStore.test.ts`, `commands.test.ts`, `review.properties.test.ts`, and `src/store/__tests__/review.mp-zones-commands.test.ts`. | One table maps every public `GameStore` operation to its direct command tag(s), whether it groups history, whether it can enter guided/manual state, and one exact test name. No other store/UI/compiler file is scanned. |
| `FUP-02A-CORE-SLICES` — adapter-relevant Core schema catalog | Only the public barrels and validators for `src/engine/core/object/**`, `stack/transaction/**`, `turn/**`, `rules/**`, `commander/**`, `combat/combatContextV1.ts`, and `player-lifecycle/**`; corresponding `src/engine/core/**/__tests__` files, fixtures, and `scripts/checks/verify-mode-neutral-core-*.ts` verifiers named in §3.1. | One table lists only types/operations consumed by a frozen O4P-02A adapter candidate and marks each direct/transformable/unsupported. It must not inventory unrelated CR behavior or design Online/Room/Projection. |
| `FUP-02A-SNAPSHOT-EDGE` — snapshot edge-case closure | `src/data/gameSnapshot.ts:L5-L69`, `src/store/gameStore.ts:L620-L700,2972-L3009,5651-L5675`; tests `src/store/__tests__/review.m424.test.ts`, `snapshotPersistenceControl.test.ts`, `zonesByPlayer.test.ts`, and `review.mp-zones-commands.test.ts`. | A finite vector table records exact serialized fields, normalization/backfill, manual-resolution baseline, history reset, version mismatch, and fixture isolation. No new migration or serializer is designed in the follow-up. |

Until Sol explicitly starts one of these bounded follow-ups, the current draft's category-level inventory and parity classifications are the complete grounding result. No broad repository exploration is required for O4P-02A contract freeze.

## Handoff to Sol

This grounding is sufficient to freeze an O4P-02A contract only after Sol decides the unresolved directions/loss policy. The non-negotiable facts are: preserve Solo snapshot schema/version and restore/backfill behavior; keep Core closure versions separate; choose exactly one state-transition authority per session; compare normalized evidence; and make unsupported/lossy cases explicit.
