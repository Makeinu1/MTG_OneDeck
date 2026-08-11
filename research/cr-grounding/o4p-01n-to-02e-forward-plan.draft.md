# O4P-FWD-01N-02 — O4P-01N through O4P-02E forward plan (draft)

Status: read-only architecture planning; no contract is frozen by this file.

Base SHA: `435b691b63492ebb66389cfa37c8a5a3d6d102b4`

Observed HEAD and `origin/main` equal the requested Base SHA. The dependency
preflight was clean before this draft was restored. O4P-01M is shipped at this
SHA with independent cold audit, fingerprint-matched local full check, final
ledger metadata, successful final-head Actions run, and served Pages evidence.
All O4P-01M-dependent claims in the earlier planning pass were rechecked
against that shipped source before this revision.

Evidence labels used below:

- `FACT` means the statement is directly present in the named HEAD source,
  contract, test, verifier, ledger entry, or audit record.
- `INFERENCE` means a dependency or gap derived from those facts.
- `PROPOSAL` means a planning option only. Proposed future symbols and paths
  are never evidence and must be confirmed by a later judge-owned contract.

## 1. Authority and current boundary

| Item | Evidence and consequence |
| --- | --- |
| Requested sequence | `research/cr-grounding/cr-backbone-ledger.json` has `O4P-01N -> O4P-02A -> O4P-02B -> O4P-02C -> O4P-02D -> O4P-02E`; each entry is `pending` and depends on the preceding entry. `research/cr-grounding/o4p-01-to-05-rebaseline-2026-08-10.draft.md` defines O4P-01N as the Core closure point and O4P-02 as the local in-memory Online Application Contract. |
| O4P-01M authority | Both ledger collections record `O4P-01M` as `shipped`, with landing state `commanderPhysicalCard`, `commanderTax`, `commanderDamage`, `combatAssignments`, `playerExit`, `concession`. Its manual boundary allows guided/manual combat and keeps disconnect distinct from exit. Candidate commit was `30b15cff953c8d89f5f5b8eeba50fa48220b1c55`; final ledger commit is this plan's Base SHA. Independent Luna audit `019ff19a-5d53-7433-bfd2-92b0e01e446b` issued `AUDIT-OK-PENDING-FULL-CHECK` for replacement semantic fingerprint `0880024d47613157f4a3ea69c76873ae57c06ee0a1bd09e881896d549e57b00e`. Local `npm run check` passed, final-head Actions run `31515161884` passed full check, forbidden scan, build, and deploy, and the Pages root plus served JS/CSS returned HTTP 200. |
| O4P-01N boundary | The ledger `domains[]` entry for `O4P-01N` requires `coreRoot`, typed commands/events/results, actor, decision maker, deterministic randomness, replay, and four-player headless closure; its manual boundary forbids network, Cloudflare, projection, and UI. |
| O4P-02 boundary | The ledger entries for `O4P-02A`–`O4P-02E` specify compatibility/parity, four-seat room lifecycle, in-memory protocol, projections/privacy, and a local four-client plus Table Display gate. `O4P-03A` is the first entry that names Worker/Durable Object/SQLite/WebSocket. |
| Active contract authority | `docs/contracts/manifest.json` marks the generic engine state, commands, zones/events/LKI, turn/priority/stack, mana, multiplayer, compiler, acceptance, UI, and generated API contracts as active/generated, with `owner: judge`. It contains no active O4P-01N or O4P-02A–E contract. |
| Governance | `AGENTS.md` assigns Core source to implementers, while the judge owns contracts, root/barrel integration, `review.*`, verifiers, ledger, and release. It requires independent cold audit before full check and forbids an unshipped or unaudited candidate from being called shipped. |

## 2. Existing shipped Core inventory (HEAD)

### 2.1 Shared identity, version, and ownership substrate

| Responsibility | Exact shipped source and public surface | Validator/tests/evidence | Owner and version boundary |
| --- | --- | --- | --- |
| Identity and zones | `src/engine/core/ids.ts` (`CorePlayerId`, `CoreCardDefinitionId`, `CorePhysicalCardId`, `CoreObjectId`, ID predicates); `src/engine/core/cardDefinition.ts`; `src/engine/core/identityZoneState.ts` (`ModeNeutralCoreIdentityZoneSliceV1`, `locateCoreObjectV1`, zone-scope/information helpers); `src/engine/core/identityZoneCanonicalization.ts`; `src/engine/core/identityZoneValidation.ts`. | `validateModeNeutralCoreIdentityZoneSliceV1`; `src/engine/core/__tests__/identityZoneState.test.ts`, `identityZoneValidation.test.ts`, `identityZoneProperty.test.ts`; `src/engine/core/fixtures/identity-zone-slice-v1.json`; `scripts/checks/verify-mode-neutral-core-identity-zone.ts`. | Authority owner is judge under `docs/contracts/manifest.json` and `AGENTS.md`; public slice is V1. |
| Card runtime | `src/engine/core/runtime/cardOrientation.ts`, `counterDamage.ts`, `attachment.ts`, `cardRuntimeState.ts`, `cardRuntimeValidation.ts`, `runtime/index.ts`; root exports creation and validation functions from `src/engine/core/index.ts`. | `validateCoreCardOrientationStateV1`, `validateCoreCounterDamageStateV1`, `validateCoreAttachmentStateV1`, `validateModeNeutralCoreCardRuntimeSliceV1`; runtime ordinary/property tests under `src/engine/core/runtime/__tests__/`; `scripts/checks/verify-mode-neutral-core-card-runtime.ts`. | Additive V1 runtime; no Core root state or command envelope. |
| Object registry/runtime | `src/engine/core/object/objectIdV2.ts`, `objectRegistryStateV2.ts`, `objectRegistryValidationV2.ts`, `objectRegistryCanonicalizationV2.ts`, `objectRuntimeV2.ts`, `tokenObjectV2.ts`, `stackObjectV2.ts`, `object/index.ts`; root re-exports their V2 factories, canonicalizers, upgrades, and validators. | `validateCoreGameObjectIdentityV2`, `validateModeNeutralCoreObjectRegistryStateV2`/`SliceV2`, `validateCoreObjectRuntimeStateV2`/`RuntimeV2`; ordinary/property/round-trip/fixture tests under `src/engine/core/object/__tests__/`; `src/engine/core/object/fixtures/object-registry-v2.json`; `src/engine/core/object/__tests__/review.o4p-01h-object-registry.test.ts`; `src/test/architecture/review.o4p-01h-core-boundary.test.ts`; `scripts/checks/verify-mode-neutral-core-object-registry.ts`. | Object taxonomy and registry are V2; the existing V1 identity/runtime upgrades are explicit functions, not an implicit schema merge. |
| Zone transition | `src/engine/core/transition/zoneDestination.ts` (`createCoreCardZoneDestinationV1`, `validateCoreCardZoneDestinationV1`), `cardZoneTransition.ts` (`applyCoreCardZoneTransitionV1`, validator/error), `cardReincarnation.ts` (incarnation/object-ID/default-runtime helpers), `zoneOrder.ts`. | Tests under `src/engine/core/transition/__tests__/`; `src/engine/core/fixtures/card-zone-transition-slice-v1.json`; `scripts/checks/verify-mode-neutral-core-zone-transition.ts`. | O4P-01N and any M-dependent code must consume this identity boundary; no duplicate zone-change identity rule. |
| Version vectors | `src/versioning/contractVersions.ts` defines deeply frozen `CURRENT_CONTRACT_VERSIONS` with `contractSchemaVersion=1`, pinned CR `mtg-cr-2026-06-19`, `engineSemanticsVersion=1`, `stateSchemaVersion=1`, `eventSchemaVersion=1`, `protocolVersion=1`, `projectionSchemaVersion=1`; `scripts/checks/verify-contract-versions.ts` validates the vector against CR metadata. | `src/versioning/contractVersions.test.ts`; `npm run verify:versions` script entry in `package.json`. | The version vector is shared authority and is reserved for serial judge integration. |
| Solo snapshots | `src/data/gameSnapshot.ts` defines `GameSnapshot`, `SNAPSHOT_VERSION = 1`, and `saveSnapshot`/`loadSnapshot`/`clearSnapshot`; `src/test/architecture/soloOnlineBoundary.test.ts` forbids substituting Online protocol/state versions into this path. | `src/data/__tests__/` snapshot persistence tests and `src/store/__tests__/snapshotPersistenceControl.test.ts` (referenced by `package.json` `verify:solo-preservation`). | Solo snapshot version is separate from Online state/protocol/projection vectors; O4P-02A must preserve it. |

### 2.2 O4P-01J — shipped atomic stack transaction

`research/cr-grounding/cr-backbone-ledger.json` marks `O4P-01J` shipped and
records its structural boundary, review/architecture tests, fixture, verifier,
cold-audit identifier, final full check, Actions, and Pages evidence. The
judge-owned contract is
`research/cr-grounding/o4p-01j-atomic-stack-transaction.contract.draft.md`.

| Item | Exact HEAD inventory |
| --- | --- |
| Owned source | `src/engine/core/stack/transaction/cardSpellCommitV1.ts`, `syntheticStackCommitV1.ts`, `stackRetargetV1.ts`, `stackRemovalV1.ts`, `stackTransactionBundleV1.ts`, `stackTransactionValidationV1.ts`, `stackTransactionErrorV1.ts`, `internalStackTransactionV1.ts`, and `src/engine/core/stack/transaction/index.ts`. |
| Public exports | `createCoreStackTransactionBundleV1`, `validateCoreStackTransactionBundleV1`, `CoreStackTransactionErrorV1`; types `CoreStackTransactionBundleV1`, `CreateCoreStackTransactionBundleV1Input`, `CoreStackTransactionValidationCodeV1`, `CoreStackTransactionValidationIssueV1`, `CoreStackTransactionValidationNestedIssueV1`, `CoreStackTransactionValidationResultV1`; `commitCoreCardSpellToStackV1` with its input/result; `commitCoreSyntheticStackObjectV1` with its input/result/object type; `retargetCoreStackObjectV1` with retarget input/result/target replacement; and `removeCoreStackObjectV1` with non-stack destination/removal input/result. These are the exact declarations in `src/engine/core/stack/transaction/index.ts`, re-exported by `src/engine/core/stack/index.ts` and `src/engine/core/index.ts`. |
| Validation/immutability | The contract requires complete bundle validation, strict operation input validation, fresh canonical deeply frozen results, deterministic complete frozen issues, and no mutation/sort/trim/deduplicate/default/merge. The implementation validators are `validateCoreStackTransactionBundleV1` and the nested V2 registry/runtime and V1 announcement validators named in `src/engine/core/stack/transaction/stackTransactionValidationV1.ts` and `internalStackTransactionV1.ts`. |
| Tests and verifier | Ordinary/property/fixture/scenario tests are the exact files under `src/engine/core/stack/transaction/__tests__/` (`cardSpellCommit*`, `syntheticStackCommit*`, `stackRetarget*`, `stackRemoval*`, `stackTransactionBundle*`, `stackTransactionFixtureV1.test.ts`, `stackTransactionScenarioV1.test.ts`) plus `review.o4p-01j-stack-transaction.test.ts`; architecture gates are `src/test/architecture/o4p01jStackTransactionBoundary.test.ts` and `review.o4p-01j-stack-transaction-boundary.test.ts`; fixture is `src/engine/core/stack/transaction/fixtures/stack-transaction-v1.json`; verifier is `scripts/checks/verify-mode-neutral-core-stack-transaction.ts`. |
| Explicit non-ownership | The O4P-01J contract and ledger exclude payment, legality, priority/APNAP, resolution, command/event envelopes, projection, online protocol, and UI. These exclusions are dependencies for, not implementations of, O4P-01N. |

### 2.3 O4P-01K — shipped turn/priority/lifecycle

`research/cr-grounding/cr-backbone-ledger.json` marks `O4P-01K` shipped with
CR refs `500`–`505`, `603`, and `704`, and the contract is
`research/cr-grounding/o4p-01k-turn-priority-lifecycle.contract.draft.md`.

| Item | Exact HEAD inventory |
| --- | --- |
| Owned source | `src/engine/core/turn/turnPositionV1.ts`, `turnLifecycleV1.ts`, `turnLifecycleValidationV1.ts`, `turnAdvanceV1.ts`, `priorityPassV1.ts`, `pendingTriggerV1.ts`, `pendingTriggerValidationV1.ts`, `triggerPlacementV1.ts`, `triggerApnapV1.ts`, `sbaTriggerBoundaryV1.ts`, `cleanupV1.ts`, `resolutionBoundaryV1.ts`, `turnPriorityBundleV1.ts`, `turnPriorityBundleValidationV1.ts`, `turnPriorityErrorV1.ts`, `stackAnnouncementAccessV1.ts`, `stackTransactionAccessV1.ts`, fixture `src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json`, and barrel `src/engine/core/turn/index.ts`. |
| Public exports | Exact barrel exports include `CoreTurnPositionV1`; lifecycle types/factory/validators; pending-trigger types/factory/validator; `CoreTurnPriorityBundleV1`, `CreateCoreTurnPriorityBundleV1Input`, `createCoreTurnPriorityBundleV1`, `validateCoreTurnPriorityBundleV1`; `coreApnapPlayerOrderV1`; pending-trigger order/placement/analyze/append/place operations; SBA outcome recording; priority-cycle/pass/resume/resolution-completion operations; turn-position and turn-advance operations; cleanup operations; and the V1 turn-priority operation/error types in `src/engine/core/turn/index.ts`. The root exports the entire turn barrel at `src/engine/core/index.ts`. |
| Validation/tests/verifier | Bundle validator is `validateCoreTurnPriorityBundleV1` in `turnPriorityBundleValidationV1.ts`; nested lifecycle/pending/stack validation is explicit there. Ordinary/property/fixture/scenario tests are the exact files under `src/engine/core/turn/__tests__/` (including `review.o4p-01k-turn-priority.test.ts`); architecture gates are `src/test/architecture/o4p01kTurnPriorityBoundary.test.ts` and `review.o4p-01k-turn-priority-boundary.test.ts`; verifier is `scripts/checks/verify-mode-neutral-core-turn-priority.ts`. |
| Explicit non-ownership | The contract/ledger defer concrete SBA evaluation, trigger detection, full resolution, combat, command/event metadata, Online, Cloudflare, and UI. O4P-01N must call the existing lifecycle/priority boundary rather than create a second APNAP/priority engine. |

### 2.4 O4P-01L — shipped control/access/authority

`research/cr-grounding/cr-backbone-ledger.json` marks `O4P-01L` shipped with
CR refs `611`, `609`, `701.15`, and `702`; its contract is
`research/cr-grounding/o4p-01l-control-access-authority.contract.draft.md`.

| Item | Exact HEAD inventory |
| --- | --- |
| Owned source | `src/engine/core/rules/controlEffectV1.ts`, `decisionAuthorityV1.ts`, `visibilityGrantV1.ts`, `visibilityQueryV1.ts`, `searchSessionV1.ts`, `searchSessionOperationsV1.ts`, `playPermissionV1.ts`, `ruleDurationV1.ts`, `ruleKeyV1.ts`, `ruleZoneRefV1.ts`, `ruleValidationSharedV1.ts`, `ruleAuthorityBundleV1.ts`, `ruleAuthorityBundleValidationV1.ts`, `ruleAuthorityErrorV1.ts`, `ruleAuthorityLifecycleV1.ts`, fixture `src/engine/core/rules/fixtures/rule-authority-v1.json`, and barrel `src/engine/core/rules/index.ts`. |
| Public exports | The exact public barrel exports the rule-key/zone/duration/shared validation primitives; control creation/validation/current-controller/apply/remove/replace/turn-start/expiry/query operations; decision-authority creation/validation/add/remove/decision-maker/activation/expiry operations; visibility grant/validation/query; search-session creation/validation/open/complete/cancel; play-permission creation/validation/add/remove/consume/find/can-attempt; rule-authority bundle creation/validation/lifecycle. `src/engine/core/index.ts` re-exports `./rules`. |
| Validation/tests/verifier | `validateCoreRuleAuthorityBundleV1` composes `validateCoreTurnPriorityBundleV1` and the control, visibility, search, play, and decision validators in `src/engine/core/rules/ruleAuthorityBundleValidationV1.ts`; ordinary tests are the exact files under `src/engine/core/rules/__tests__/` including `review.o4p-01l-rule-authority.test.ts`; architecture gates are `src/test/architecture/o4p01lRuleAuthorityBoundary.test.ts` and `review.o4p-01l-rule-authority-boundary.test.ts`; verifier is `scripts/checks/verify-mode-neutral-core-rule-authority.ts`. |
| Explicit non-ownership | The ledger and contract leave network delivery/projection allowlists to O4P-02D and leave Commander, combat, player exit, typed command/event, WebSocket, Cloudflare, and UI outside O4P-01L. |

### 2.5 Existing public Core root and dependency verifier

`src/engine/core/index.ts` at HEAD exports identity/zone, V1 runtime,
V2 object registry/runtime, V1 stack announcement plus the J transaction,
K turn, and L rules. It has no typed Core command, event, command-result,
replay, correction, or four-player root dispatcher. The architecture guard
`src/test/architecture/modeNeutralCoreBoundary.test.ts` scans Core imports and
rejects product/runtime imports, existing Solo `GameState`/`CardInstance`/
`CardDef` imports, unresolved imports, and reverse Online imports. The J/K
architecture tests additionally reject React/store/Online/Cloudflare, clocks,
and `Math.random` in their owned Core roots. These are hard inputs to the
O4P-01N write plan.

## 3. Shipped O4P-01M closure

### 3.1 Shipped files and public declarations

The following are shipped and present at HEAD:

| Shipped area | Exact paths and declarations |
| --- | --- |
| Commander | `src/engine/core/commander/commanderIdentityV1.ts` (`CoreCommanderIdentityV1`, `createCoreCommanderIdentityV1`); `commanderTaxV1.ts` (`CoreCommanderCastAttemptV1`, ledger, `createCoreCommanderCastLedgerV1`, `recordCoreCommanderCastV1`, `coreCommanderTaxV1`); `commanderReplacementV1.ts` (`CoreCommanderReplacementChoiceV1`, `createCoreCommanderReplacementChoiceV1`); `commanderDamageV1.ts` (damage state/record, create/record/query); `commanderDamageProvenanceV1.ts` (provenance ledger/record/query/threshold). |
| Combat | `src/engine/core/combat/combatContextV1.ts` is the sole shipped combat authority. It owns ordered attack/block structure, declare-attacker/blocker steps, stable blocker controller/defender identity, and deterministic exit pruning; damage automation remains deferred. The superseded duplicate `combatAssignmentV1` API is absent. |
| Player lifecycle | `src/engine/core/player-lifecycle/playerLifecycleV1.ts` owns ordered `active`/`exited` entries plus typed `concession`/`defeat` exit cause; `playerExitReconciliationV1.ts` owns the atomic lifecycle/reference/request operation and ordered cleanup directives, including shipped rule-key validation for control, decision, and SearchSession references. |
| Public integration | `src/engine/core/index.ts` exports the above APIs and generated `docs/generated/engine-api.md` records them. The fixture is `src/engine/core/fixtures/o4p-01m-commander-combat-player-exit-v1.json`; the public-root verifier is `scripts/checks/verify-mode-neutral-core-commander-combat-player-exit.ts`. |
| Ordinary tests | `src/engine/core/__tests__/commanderIdentityV1.test.ts`, `commanderTaxV1.test.ts`, `commanderReplacementV1.test.ts`, `commanderDamageV1.test.ts`, `commanderDamageProvenanceV1.test.ts`, `combatContextV1.test.ts`, `playerLifecycleV1.test.ts`, `playerExitReconciliationV1.test.ts`, `o4p01mIntegration.test.ts`, and `o4p01mClosureVerifier.test.ts`. Judge-owned review coverage is in `review.o4p-01m-commander-combat-player-exit.test.ts` and the matching architecture review. |
| Planning/audit records | `research/cr-grounding/o4p-01m-commander-combat-grounding.draft.md`, `o4p-01m-player-exit-grounding.draft.md`, `o4p-01m-commander-combat-player-exit.contract.draft.md`, `o4p-01m-implementation-brief.draft.md`, `o4p-01m-orchestration-plan.draft.md`, `o4p-01m-replacement-audit-repair-brief.draft.md`, `o4p-01m-final-reaudit-brief.draft.md`, and the archived audit records. |

### 3.2 Shipment and dependency proof

- `FACT`: Both ledger collections say `O4P-01M: shipped` at Base SHA
  `435b691b63492ebb66389cfa37c8a5a3d6d102b4`. [FACT:
  `research/cr-grounding/cr-backbone-ledger.json`]
- `FACT`: The replacement independent audit reports `BLOCKER/HIGH: 0` and
  `AUDIT-OK-PENDING-FULL-CHECK` at semantic fingerprint
  `0880024d47613157f4a3ea69c76873ae57c06ee0a1bd09e881896d549e57b00e`.
  The subsequent local full check passed. [FACT: archived O4P-01M audit record
  and ledger note]
- `FACT`: Final-head Actions run `31515161884` succeeded at the same Base SHA,
  including full check, forbidden scan, build, and deploy. The Pages root and
  referenced JavaScript/CSS assets returned HTTP 200. [FACT: ledger release
  evidence]
- `INFERENCE`: O4P-01N may now consume the shipped O4P-01M public surface, but
  it must not reinterpret M's guided/manual combat boundary or make transport
  disconnect a Core player-exit transition.

## 4. O4P-01N gap matrix

| O4P-01N concern | Shipped fact | Gap at HEAD | Proposed closure and proof (not frozen) |
| --- | --- | --- | --- |
| Core root | `src/engine/core/index.ts` exports separate identity/runtime/object/stack/turn/rules/commander/combat/player-lifecycle surfaces. [FACT: `src/engine/core/index.ts`] | No single immutable root binds all slices, O4P-01M lifecycle/combat state, command history, event output, or a stable root validation result. | `PROPOSAL`: define one root composition contract that references existing validators and the shipped M slices without adding optional fields to J/K/L/M. Prove fresh/deep-frozen root, cross-slice IDs, ordered players, and no Solo/product imports with a judge-owned root verifier and architecture test. |
| Typed commands | Solo has `GameCommand` and `applyCommand` in `src/engine/commands.ts`; Core architecture tests reject importing Solo types into Core. [FACT: `src/engine/commands.ts`, `src/test/architecture/modeNeutralCoreBoundary.test.ts`] | No mode-neutral typed command union with explicit actor, decision maker, deterministic payload, correction path, or root dispatch result. Reusing `GameCommand` would cross the forbidden boundary. | `PROPOSAL`: create a new Core command envelope/union under a future Core-only lane; command application must be pure, deterministic, atomic at the public boundary, and must not import `GameState`, React, store, Online, or Cloudflare. Prove accepted/rejected/warning outcomes and one command-to-event trace. |
| Typed results/events | J/K/L operations expose slice-specific values and typed errors; `docs/contracts/engine/zones-events-and-lki.md` requires immutable successful semantic events, but no N root event union exists. [FACT: J/K/L source barrels; `docs/contracts/engine/zones-events-and-lki.md`] | No typed `CommandResult`/domain-event stream ties a successful root command to changed state, warnings, or deterministic event references. | `PROPOSAL`: define a result with success/reject/warning cases and a typed event list. Every event must be generated only after successful semantic state change; rejected commands must not emit state-changing events. Add complete issue ordering, JSON round-trip, immutability, and event/state replay pins. |
| Actor / decision maker | O4P-01L already has `coreDecisionMakerForV1` and Decision Authority slices; O4P-01L explicitly separates actor/selector and decision authority. [FACT: `src/engine/core/rules/decisionAuthorityV1.ts`, `src/engine/core/rules/index.ts`, L contract] | No root command field binds the initiating actor to the rule-selected decision maker, and no rule says which one owns a correction or choice response. | `PROPOSAL`: carry both identities in the command/result boundary, resolve the decision maker through the shipped L authority input, and reject stale/unauthorized responses without substituting the local player. Add opponent-turn and selector-vs-actor vectors. |
| Deterministic randomness | Solo has seeded helpers in `src/engine/random.ts`; Solo commands can carry an explicit shuffle order in `src/engine/commands.ts`. Core J/K architecture tests prohibit `Math.random`/clock use in their Core roots. [FACT: those files/tests] | No Core random-choice record binds a random decision to a command payload, replay input, digest, and resulting event. A future protocol must not become the randomness authority. | `PROPOSAL`: make randomness an explicit, serializable command payload/seed-or-permutation record, selected before application; never call ambient RNG in `apply`. Prove same command+input yields byte-identical state/events/digest and that replay fails closed when the random payload is absent or malformed. Exact representation is a STOP-for-contract question, not frozen here. |
| Typed correction | Existing Core operations throw typed operation errors (for example `CoreStackTransactionErrorV1`, `CoreTurnPriorityOperationErrorV1`, and L rule errors). [FACT: exact barrels above] | No typed correction command/result can repair a guided/manual decision while preserving the original failed state, actor, decision maker, and event history. | `PROPOSAL`: add a correction input that references a deterministic pending decision/issue and produces either a new accepted command trace or a typed rejection; it must not mutate an old snapshot or silently convert a warning into success. Prove stale, duplicate, wrong-actor, and already-resolved correction rejection. |
| Save/replay/digest | Solo persistence is `GameSnapshot`/`SNAPSHOT_VERSION=1` in `src/data/gameSnapshot.ts`; existing replay tooling uses Solo `GameState` in `src/engine/goldenReplay.ts` and `src/engine/__tests__/review.golden-replay.test.ts`. [FACT: exact files] | No four-player Core save format, replay input, digest scope, or compatibility rule exists; merging it into Solo snapshot storage would violate the O4P-02A ledger boundary. | `PROPOSAL`: define a Core-only serializable replay package containing version references, initial canonical root, commands, explicit random payloads, and expected event/state digest. Prove save→load→replay equality and tamper/stale-version rejection. Keep `SNAPSHOT_VERSION` and Solo storage unchanged unless a later judge contract explicitly authorizes migration. |
| Four-player headless closure | O4P-01K verifier already exercises a four-player registry/turn cycle, but only the K slice; O4P-01L verifier covers authority bundle, not M or a typed root. [FACT: `scripts/checks/verify-mode-neutral-core-turn-priority.ts`, `verify-mode-neutral-core-rule-authority.ts`] | No one-process four-player scenario executes the full Core command/result/event/replay path with Commander/combat/exit, hidden data boundaries, correction, and digest. | `PROPOSAL`: a serial judge-owned fixture/verifier must run P1–P4 through normal, rejection, correction, concession/defeat, and replay cases and assert final root plus event/digest equality. Full automatic combat damage remains deferred unless an executable replay proves it, per the O4P-01M ledger boundary. |

## 5. O4P-01N to O4P-02E dependency map

The “input” and “output” entries below are contract targets, not claims that
the future contract already exists.

| Stage | Input contract | Output contract | Forbidden dependencies/boundary | Version and privacy boundary |
| --- | --- | --- | --- | --- |
| O4P-01N | `PROPOSAL`: shipped J/K/L/M bundles; existing Core ID/object/zone/runtime validators; L authority and K priority lifecycle. | `PROPOSAL`: one mode-neutral Core root, typed command/result/event path, actor+decision maker, explicit randomness, correction, Core save/replay/digest, and four-player headless closure. | FACT ledger boundary: no network, Cloudflare, projection, UI, WebSocket, Room, or Solo snapshot rewrite. Do not import Solo `GameState`/`GameCommand` into Core. | FACT: current shared vector is all 1s and `SNAPSHOT_VERSION=1`. PROPOSAL: any new Core replay/root marker must be separate from Solo snapshot version and must not silently bump protocol/projection versions. Hidden information remains Core state with explicit audience semantics, not a public event payload. |
| O4P-02A | `PROPOSAL`: O4P-01N root/replay contract and existing Solo `GameState`/`GameSnapshot` facade. `src/online/architecture/stateArchitecture.ts` classifies normalized semantic fields as `CORE_DIRECT`/`CORE_NORMALIZE` and Solo-only fields as `SOLO_FACADE`; `commanders`, `combat`, `commanderDamage`, and `defeat` are currently `BLOCKED_REDESIGN`. [FACT: exact file/test] | Ledger output: explicit Core/Solo compatibility adapter, differential parity gate, preserved Solo snapshots, offline Solo. | FACT ledger: do not rewrite Solo or merge `SNAPSHOT_VERSION` with Online `stateSchemaVersion`; no network/UI. | Keep Solo snapshot format/version and privacy model unchanged. Adapter must not expose hidden Solo zones as Online projection data. |
| O4P-02B | O4P-02A adapter/parity output plus O4P-01N root command boundary. | Ledger output: four-seat Room envelope, room ID, Host/Player/Table/Spectator roles, ready→started→active→finished lifecycle, rejoin/concession, seat capability. | FACT ledger: no Cloudflare transport and no connection metadata in Core state. No UI implementation. | Room/participant identity is application metadata, not a new Core player ID spelling. Privacy is role/capability input to later projection, not an implicit reveal. |
| O4P-02C | O4P-02B room envelope and O4P-01N command/result/replay semantics. | Ledger output: in-memory ClientHello/ServerHello, protocol version, command envelope/id/base revision, ACK/reject, deduplication, stale-revision rejection, snapshot request, resync, Build ID diagnostics. | FACT ledger: transport remains in-memory; no WebSocket or Cloudflare runtime. No direct store/UI dependency. | `protocolVersion` is already present as 1 in `CURRENT_CONTRACT_VERSIONS`, but whether to bump or negotiate it is a future contract decision. Command IDs/revisions must not contain hidden card values. |
| O4P-02D | O4P-02C accepted/rejected command envelopes plus O4P-01N root and O4P-01L visibility/authority/search records. | Ledger output: Player/Table/Spectator projections, allowlists, hidden-card protection, SearchSession, VisibilityGrant, PlayPermission, secret-safe errors/logs. | FACT ledger: application projection only; no Cloudflare transport and no UI. Do not reimplement L visibility/authority or leak full Core state. | `projectionSchemaVersion` exists as 1 but negotiation/bump is not decided. Each projection is audience-specific; library/hand/private search data must be redacted by allowlist, not by UI filtering. |
| O4P-02E | O4P-02A–D local contracts and four explicit local clients plus Table Display consumer. | Ledger output: P1/P2/P3/P4 and Table Display traverse the same room, command, revision, projection, reconnect, stale, duplicate, and privacy paths; headless room gate. | FACT ledger: no Cloudflare implementation until this gate passes; no UI implementation/design in this work package. | Preserve per-role privacy across reconnect/resync and error/log paths. No transport/session fields are written into the O4P-01N Core root. |

## 6. Non-overlapping write-set proposal

All paths in this section are explicitly `PROPOSAL`; they are not existing
future APIs. Implementers may write only their lane and ordinary tests in the
same lane. A serial judge-owned integration lane owns root/barrel/version/
fixture/verifier/review/architecture changes.

| Future lane | Proposed write set | Reads/inputs | Explicitly forbidden in lane |
| --- | --- | --- | --- |
| N-A Core command/result/event types | `PROPOSAL: src/engine/core/command/**`, `src/engine/core/event/**`, and ordinary tests below those directories. | Shipped J/K/L/M public barrels; contracts once frozen. | `src/engine/core/index.ts`, all existing J/K/L/M files, `src/versioning/contractVersions.ts`, Solo `src/engine/commands.ts`, `src/store/**`, `src/online/**`, review/architecture tests, verifier, fixture. |
| N-B randomness/correction/replay | `PROPOSAL: src/engine/core/randomness/**`, `src/engine/core/correction/**`, `src/engine/core/replay/**`, and ordinary tests below those directories. | N-A types through a frozen interface; existing deterministic order helpers only as reference. | Ambient RNG/clock/network, protocol/projection, `src/data/gameSnapshot.ts`, root barrel, version vector, release verifier, review tests. |
| N-C headless scenario | `PROPOSAL: src/engine/core/headless/**` and ordinary tests below it. | N-A/N-B plus shipped J/K/L and shipped M. | Root export, shared fixture, machine verifier, `docs/**`, ledger, UI, Online, Cloudflare, and any unshipped M symbol treated as authority. |
| N-X serial integration and audit | `PROPOSAL: judge-owned serial edits to `src/engine/core/index.ts`, any exact fixture path selected by the frozen contract, a new exact verifier under `scripts/checks/`, `src/test/architecture/**`, and `review.*` evidence. | Frozen N contract and frozen candidate fingerprint. | Parallel implementation writes; no adding new semantics while integrating. Must cold-audit before the fingerprint-matched full check. |
| 02A compatibility adapter | `PROPOSAL: src/online/compat/**` and ordinary tests below it. | Shipped N root/replay and existing Solo facade/snapshot APIs. | `src/engine/**` mutation, `src/data/gameSnapshot.ts`, `src/versioning/contractVersions.ts`, UI, transport, Cloudflare, projection, root barrels. |
| 02B room envelope | `PROPOSAL: src/online/room/**` and ordinary tests below it. | Shipped 02A adapter and N player/decision identities. | Core state fields, Solo store, snapshot storage, protocol transport, projection, UI, Cloudflare. |
| 02C in-memory protocol | `PROPOSAL: src/online/protocol/**` and ordinary tests below it. | Shipped 02B room and N command/result/replay metadata. | WebSocket, Worker, Durable Object, SQLite, UI, raw Core hidden state, direct store/snapshot imports. |
| 02D projection/privacy | `PROPOSAL: src/online/projection/**` and ordinary tests below it. | Shipped 02C envelopes plus L visibility/search/authority records and N events. | Core mutation, UI rendering, WebSocket/Cloudflare, blanket state serialization, secret-bearing logs/errors. |
| 02E local headless room gate | `PROPOSAL: src/online/headless/**` and ordinary tests below it. | Shipped 02A–D contracts and four local client identities plus Table Display data consumer. | Cloudflare, WebSocket, UI implementation/design, version-vector edits, root/barrel edits, production release. |

Reserved serial files for every lane: `src/engine/core/index.ts`, any new
`src/online/index.ts` or package barrel selected later, `src/versioning/
contractVersions.ts`, `src/data/gameSnapshot.ts`, `docs/contracts/**`,
`docs/acceptance/**`, `src/test/architecture/**`, `review.*`, judge-owned
fixtures, `scripts/checks/**`, the ledger, loop-state, package/lock files, and
git state. The exact future file list must be fixed by the relevant contract;
this reservation is a collision-control proposal, not permission to edit.

## 7. Acceptance scenario skeleton

These are scenario shapes for later judge-owned acceptance authoring. They do
not change `docs/acceptance/scenarios.json` in this milestone.

| Scenario | Skeleton and expected oracle | First required stage |
| --- | --- | --- |
| Normal four-player command | Start P1–P4 from one canonical root; submit an actor-authorized command; resolve the decision maker; emit typed result/events; advance the existing K priority lifecycle; assert canonical root and event order. | O4P-01N; extended through O4P-02E. |
| Reject / atomic no-op | Submit malformed ID, stale authority, invalid phase, invalid target, or missing random payload; assert deterministic complete issues, no state mutation, no semantic event, and preserved input. | O4P-01N; protocol projection variants in O4P-02C/D. |
| Stale / duplicate | Submit the same command ID twice and a command with an old base revision; assert one application, deterministic duplicate/stale rejection, ACK/reject shape, and resync request path. | O4P-02C; full four-client gate in O4P-02E. |
| Disconnect / rejoin | Drop an application connection marker without changing Core state; rejoin with the same authorized seat/capability; resync from a canonical revision; assert disconnect is not concession/defeat/exit. | O4P-02B/C/E. The distinction is already a ledger boundary for O4P-01M. |
| Concession / defeat / exit | Exercise explicit concession and rules-derived defeat separately; reconcile owned objects, controlled objects, non-card stack references, control effects, decision authorities, search sessions, combat participants, active player, priority handoff, and surviving turn order; replay the resulting root. | O4P-01M prerequisite, then O4P-01N; room seat lifecycle in O4P-02B/E. |
| Hidden information | Give each player private library/hand/search data; assert Player sees only its allowlist, Table/Spectator see their distinct allowlists, and rejected/error/log payloads contain no card secrets. Test after resync/rejoin. | O4P-02D, closure O4P-02E. Inputs come from L visibility/search contracts. |
| Save / replay / digest | Save canonical initial root plus command sequence and explicit randomness; load under matching version; replay; assert final root, ordered events, and digest equal; tamper command/random/version and assert typed reject with no partial state. | O4P-01N; parity/preservation in O4P-02A. |
| Projection parity | Run the same accepted command through local Solo adapter and four-player Core path where the semantic slice overlaps; compare declared normalized fields while preserving Solo-only fields and snapshots. | O4P-02A. |
| Local room closure | P1–P4 and Table Display use the same room/revision/projection/reconnect/privacy implementations; run normal, reject, stale, duplicate, rejoin, concession, hidden-info, and replay cases in one headless run. | O4P-02E. |

## 8. Risk register

| Risk | Evidence | Mitigation / gate |
| --- | --- | --- |
| Authority duplication | L already owns decision authority/visibility/search; K owns APNAP/priority; J owns atomic stack transaction. [FACT: exact L/K/J barrels/contracts] | One owner per field and operation; N wraps existing validators and never reimplements L/K/J semantics. Cold audit checks imports and duplicate source-of-truth fields. |
| Schema/version coupling | `CURRENT_CONTRACT_VERSIONS` has separate state/event/protocol/projection fields, while Solo uses `SNAPSHOT_VERSION=1`. [FACT: `src/versioning/contractVersions.ts`, `src/data/gameSnapshot.ts`] | Reserve version files serially; never merge Solo snapshot version with Online state schema; require explicit compatibility matrix before any bump. |
| Privacy leakage | Core zones distinguish hidden/public information; L has `VisibilityGrant`, `VisibilityQuery`, `SearchSession`; O4P-02D ledger requires allowlists and secret-safe errors/logs. [FACT: exact source/ledger] | Projection by audience allowlist, negative hidden-card tests, redacted reject/log tests, and reconnect/resync privacy tests. UI must not be the privacy boundary. |
| Nondeterminism | Solo has RNG helpers and explicit shuffle order, while Core architecture tests reject ambient random/clock dependencies. [FACT: `src/engine/random.ts`, `src/engine/commands.ts`, J/K architecture tests] | Random payload selected before command creation; replay includes it; reject missing/tampered payload; digest input excludes ambient time/network. |
| Snapshot compatibility | Existing `GameSnapshot` is Solo-shaped and versioned independently. [FACT: `src/data/gameSnapshot.ts`, `soloOnlineBoundary.test.ts`] | 02A adapter preserves old snapshots; use a separate Core replay/save envelope proposal; differential parity must run before any migration question. |
| Write collision | O4P-01M integration demonstrated that public root and generated API updates are shared serial work, while its implementation brief reserved root integration for the judge. [FACT: `o4p-01m-implementation-brief.draft.md`, shipped O4P-01M source] | Disjoint lane roots; reserve root/barrel/version/verifier/fixture/review files; serial integration only after lane freeze. |
| Shipped dependency drift | O4P-01M is shipped and the clean O4P-01N preflight resolved HEAD, `origin/main`, both ledger collections, and dependency status at the same SHA. [FACT: Base SHA and ledger] | Record the exact O4P-01N Base SHA in every brief; fail closed if M status, public source, or verifier evidence differs before implementation. |
| Stale authority/rejoin confusion | Ledger explicitly distinguishes disconnect from player exit; 02B/02C/02E separate participant lifecycle, revision, and rejoin. [FACT: O4P-01M and O4P-02B–E ledger entries] | No Core transition from transport marker; explicit room command/event path and stale revision rejection. |

## 9. Explicit STOP list

1. STOP if the O4P-01M ledger status, shipped public symbols, verifier, or
   release evidence differs from Base SHA
   `435b691b63492ebb66389cfa37c8a5a3d6d102b4`. Do not substitute an inferred
   M API.
2. STOP freezing an O4P-01N or O4P-02A–E contract in this planning file. The
   active manifest has no such contract; command/event/root/version/privacy
   choices remain judge-owned decisions.
3. STOP parallel work that edits `src/engine/core/index.ts`, any future public
   barrel, version vectors, Solo snapshot code, fixtures/verifiers,
   architecture/review tests, or governance/ledger files. Those are reserved
   for serial integration.
4. STOP at any request to add Cloudflare, Durable Object, SQLite, WebSocket,
   transport runtime, UI implementation/design, or production release before
   the ledger's O4P-02E gate and the later O4P-03 boundaries.
5. STOP and escalate if actor versus decision-maker authority, random payload
   representation, digest scope, hidden-information allowlists, or snapshot
   compatibility cannot be resolved by the named contracts and deterministic
   source evidence. Do not invent a type or version to close the gap.
6. STOP O4P-01N code unless a fresh explicit-domain preflight confirms a clean
   base, O4P-01M shipped in both ledger collections, and O4P-01N pending with
   `dependsOn: ["O4P-01M"]`. This condition was satisfied at the stated Base
   SHA before this draft was restored.

## 10. Facts, inferences, and proposals summary

### Facts

- HEAD and `origin/main` are
  `435b691b63492ebb66389cfa37c8a5a3d6d102b4`; O4P-01M is `shipped`, while
  O4P-01N and O4P-02A–E are `pending` in the live ledger.
- J/K/L/M are shipped and have the exact source, validator, test, architecture,
  fixture, verifier, cold-audit, full-check, and Pages evidence named in the
  ledger and Sections 2.2–2.4 above.
- The current public Core root contains structural J/K/L exports but no typed
  Core command/event/replay/correction root.
- Solo snapshot/version and Online state/protocol/projection version fields
  are separate in the named HEAD files.
- O4P-01M has a clean independent cold-audit verdict, passing local full check,
  successful final-head Actions run `31515161884`, served Pages evidence, and
  shipped ledger state.

### Inferences

- O4P-01N is a composition/authority/replay closure milestone, not another
  rules-slice implementation; it must use M's final shipped public surface.
- O4P-02A must be an adapter/parity boundary, and O4P-02B–E must be application
  boundaries layered above the Core root rather than new Core state fields.
- Serial ownership of public roots, versions, fixtures, verifiers, and review
  evidence is necessary to prevent cross-lane integration collisions.

### Proposals

- The directory lanes and acceptance IDs in Sections 6–7 are planning
  proposals only; no named future symbol/path is asserted to exist.
- A Core replay/save envelope should remain distinct from `GameSnapshot`, with
  explicit random payloads and a deterministic digest, subject to a later
  contract decision.
- O4P-02E should be a headless local room gate, not a UI or Cloudflare slice,
  consistent with the live ledger and rebaseline draft.

## 11. Handoff packet

- Changed file: `research/cr-grounding/o4p-01n-to-02e-forward-plan.draft.md`
  only.
- No production source, ordinary/review/architecture test, contract/acceptance
  file, ledger/status file, verifier, dependency, or git state was changed by
  this planning task.
- O4P-01M-dependent conclusions were refreshed against shipped Base SHA
  `435b691b63492ebb66389cfa37c8a5a3d6d102b4` and its release evidence.
- Next judge action: freeze the O4P-01N command/event/replay/root contract and
  its bounded Luna implementation brief from this grounding.
