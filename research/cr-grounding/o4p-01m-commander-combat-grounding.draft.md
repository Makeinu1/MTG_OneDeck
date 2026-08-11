# O4P-01M Commander / Multiplayer Combat Grounding

Status: `grounding-only`, read-only analyst lane. This is not an implementation brief, a frozen contract, or a release claim.

## 0. Scope and evidence boundary

- Milestone: `O4P-01M`; requested base SHA: `1d5a75a60bc6f13a4ed6fd3daf7687e2ed4a0dcf`.
- Before this report was written, `HEAD` matched the requested base and the worktree was clean. `npm run codex:context -- --domain O4P-01M` reported the requested head, matching tree fingerprint, ledger counts `domains=119 / plannedSequence=98`, and `health.ok=true`.
- The live ledger contains exactly one `domains[]` entry and one `plannedSequence[]` entry for `O4P-01M`. The dependency `O4P-01L` is `shipped`; its recorded shipment commit is `7da637ba225cad8097686e261d1d1c92964ee16a`.
- No O4P-01M candidate, audit result, full-check result, CI result, or Pages result is assumed. The observed `research/cr-grounding/o4p-01m-orchestration-plan.draft.md` is an unshipped draft and is not used as authority.
- Full `npm run check` was intentionally not run in this grounding lane. No git command that mutates state was run.

Evidence labels used below:

- **FACT** — directly observed in the live repository, pinned CR, shipped milestone artifacts, or named tests/verifiers.
- **GAP** — a missing or deliberately deferred fact/contract boundary; not an implementation claim.
- **QUESTION** — a bounded question for the judge to answer before contract freeze; it is not an API proposal stated as existing.
- **DEFER** — explicit non-overlap or honest guided/manual boundary.
- **STOP** — authority or prerequisite condition that prevents implementation/ship from this report.

## 1. Authority, ledger, and stop findings

### 1.1 Live O4P-01M ledger entry

The exact live entries are in `research/cr-grounding/cr-backbone-ledger.json`:

| Collection | Exact observed entry | Consequence |
|---|---|---|
| `domains[]` | `id: O4P-01M`, `crOrder: 903`, `crRefs: ["104", "506", "507", "508", "903"]`, `lane: backbone`, `edhValue: high`, `status: pending`, `dependsOn: ["O4P-01L"]`; landing state `commanderPhysicalCard`, `commanderTax`, `commanderDamage`, `combatAssignments`, `playerExit`, `concession`; boundary is Commander physical-card identity, tax/cast count, replacement, commander damage, multiplayer attacks/blocks, player defeat/concession. | This report grounds exactly that boundary. |
| `plannedSequence[]` | Exactly one entry with `domainId: O4P-01M`, `type: engine-fix`, CR order 903, and the same dependency/boundary. | No duplicate or alternate live O4P-01M sequence was found. |

The ledger also states: full automatic combat damage is not required; guided/manual application is allowed; disconnect remains distinct from player exit; the next gate is contract freeze, implementation, independent cold audit, full check, and CI/Pages evidence before O4P-01N.

### 1.2 Active contract and STOP findings

- **STOP-01 — no frozen O4P-01M contract:** `docs/contracts/manifest.json` is the active manifest, but its active contracts are the generic engine/state, command, zones, turn, mana, multiplayer, compiler, acceptance, UI, and generated-API contracts. It has no O4P-01M Commander/combat/player-exit contract. `.claude/loop-state.md` is still `milestone: O4P-01M`, `step: preflight`, `complete: false`, with the next action to reconcile the brief and freeze the contract. Therefore this document may propose bounded questions, but may not authorize implementation or shipment.
- **STOP-02 — Solo/Core authority is not yet reconciled:** the existing Solo engine has Commander/combat behavior, while O4P-01G–L are additive mode-neutral Core substrates with separate type vocabularies. No active contract says that the Solo fields are the O4P-01M Core representation. The judge must choose the additive bridge and ownership before a contract is frozen; this report does not infer one.
- **PREREQUISITE OK:** the live context reports O4P-01L shipped and no ledger-integrity error. The earlier stale memory state in which the planned sequence was empty was rechecked and is not used as a current finding.
- **UNVERIFIED, not a grounding failure:** O4P-01M has no candidate to audit, so no cold-audit verdict or release gate can exist yet. Full check was intentionally omitted per the lane instruction.

### 1.3 Pinned CR authority

The rules source read for this report is `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, pinned by `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json` to the ledger version `2026-06-19`. The relevant sections read were CR `104`, `506`–`510`, `614`–`615`, `704`, `800`, `802`, `806`, and `903`. The CR, not the current Solo behavior, is the authority for the questions below.

Relevant active generic contracts:

- `docs/contracts/engine/state-and-invariants.md`: `ENG-STATE-003` requires stable physical-card identity, zone-change identity rules, and exclusive-zone integrity; `ENG-STATE-005` requires pinned-CR authority and guided/manual fallback when no executable replay exists.
- `docs/contracts/engine/commands-and-transactions.md`: `ENG-CMD-002` requires deterministic precondition handling and explicit forced choices; `ENG-CMD-004` requires guided choices and honest manual handling for unsupported compounds.
- `docs/contracts/engine/zones-events-and-lki.md`: `ENG-ZONES-001`/`002` own zone categories, ownership/controller continuity, and zone-transition identity.
- `docs/contracts/engine/turn-priority-and-stack.md`: `ENG-TURN-002` owns APNAP/priority structure; `ENG-TURN-004` owns unresolved-choice gating.
- `docs/contracts/engine/multiplayer.md`: `ENG-MP-001`–`004` require explicit player-aware recipients/controllers, existing player identity spelling, APNAP from state player order, and additive state-boundary work.

## 2. Shipped O4P-01G–L handoff matrix

These are shipped-substrate facts, not O4P-01M implementation claims. The listed contract artifacts are historical milestone contract/grounding drafts; the active authority remains the manifest and the generic contracts above.

| Milestone | Contract/grounding artifact read | Source symbols and paths | Tests / verifier read | Handoff and non-overlap |
|---|---|---|---|---|
| O4P-01G | `research/cr-grounding/o4p-01g-d-card-zone-transition-integration.draft.md`; `research/cr-grounding/o4p-01g-r-zone-transition-rule-matrix.draft.md` | `src/engine/core/transition/zoneDestination.ts`: `createCoreCardZoneDestinationV1`, `validateCoreCardZoneDestinationV1`; `cardZoneTransition.ts`: `validateCoreCardZoneTransitionV1`, `applyCoreCardZoneTransitionV1`; `cardReincarnation.ts`: next object/incarnation and default-runtime functions | `src/engine/core/transition/__tests__/cardZoneTransitionProperty.test.ts`; `scripts/checks/verify-mode-neutral-core-zone-transition.ts` | Owns card zone destination, owner/controller routing, new object incarnation, and runtime reset. Commander replacement, same-zone reorder, tokens/copies/abilities, and general replacement remain deferred. M must consume this substrate, not duplicate it. |
| O4P-01H | `research/cr-grounding/o4p-01h-universal-object-registry.contract.draft.md`; `research/cr-grounding/o4p-01h-r-object-taxonomy-matrix.draft.md` | `src/engine/core/object/objectIdV2.ts`, `objectRegistryStateV2.ts`, `objectRegistryValidationV2.ts`, `objectRegistryCanonicalizationV2.ts`, `objectRuntimeV2.ts`, `tokenObjectV2.ts`, `stackObjectV2.ts` and `src/engine/core/object/index.ts` | object `__tests__`; `src/test/architecture/review.o4p-01h-core-boundary.test.ts`; `scripts/checks/verify-mode-neutral-core-object-registry.ts` | Owns additive card/token/spell-copy/ability object taxonomy, canonicalization, registry/runtime validation, and stable physical-card substrate. It does not define Commander designation, tax, combat, effects, or choices. |
| O4P-01I | `research/cr-grounding/o4p-01i-stack-announcement.contract.draft.md`; `research/cr-grounding/o4p-01i-r-stack-announcement-cr-matrix.draft.md` | `src/engine/core/stack/announcementPrimitivesV1.ts`, `choiceAnnouncementV1.ts`, `targetAnnouncementV1.ts`, `stackAnnouncementRecordV1.ts`, `stackAnnouncementSliceV1.ts`, `stackAnnouncementValidationV1.ts`, `stackAnnouncementCanonicalizationV1.ts` | stack `__tests__`; `src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts`; `review.o4p-01i-stack-announcement-boundary.test.ts`; `scripts/checks/verify-mode-neutral-core-stack-announcement.ts` | Owns committed-only announcement/choice/target records. It does not own Commander tax payment, legality, priority, resolution, or combat. |
| O4P-01J | `research/cr-grounding/o4p-01j-atomic-stack-transaction.contract.draft.md`; `research/cr-grounding/o4p-01j-r-stack-transaction-cr-matrix.draft.md` | `src/engine/core/stack/transaction/cardSpellCommitV1.ts`, `syntheticStackCommitV1.ts`, `stackRetargetV1.ts`, `stackRemovalV1.ts`, `stackTransactionBundleV1.ts`, validation/error/internal transaction modules | transaction `__tests__`; `src/test/architecture/o4p01jStackTransactionBoundary.test.ts`; `review.o4p-01j-stack-transaction-boundary.test.ts`; `scripts/checks/verify-mode-neutral-core-stack-transaction.ts` | Owns atomic stack transaction shape and commit/removal/retarget substrate. It does not own payment, timing, target legality, Commander tax semantics, or resolution. |
| O4P-01K | `research/cr-grounding/o4p-01k-turn-priority-lifecycle.contract.draft.md`; `research/cr-grounding/o4p-01k-r-turn-priority-cr-matrix.draft.md` | `src/engine/core/turn/turnPositionV1.ts`, `turnLifecycleV1.ts`, `turnAdvanceV1.ts`, `priorityPassV1.ts`, `pendingTriggerV1.ts`, `triggerPlacementV1.ts`, `triggerApnapV1.ts`, `cleanupV1.ts`, `resolutionBoundaryV1.ts`, `turnPriorityBundleV1.ts`, `sbaTriggerBoundaryV1.ts`, and `src/engine/core/turn/index.ts` (`coreApnapPlayerOrderV1`, priority lifecycle functions) | turn `__tests__`; `src/test/architecture/o4p01kTurnPriorityBoundary.test.ts`; `review.o4p-01k-turn-priority-boundary.test.ts`; `scripts/checks/verify-mode-neutral-core-turn-priority.ts` | Owns turn/phase/priority/APNAP/pending-trigger/cleanup structure and resolution boundaries. Its contract explicitly defers concrete combat evaluation, full SBA condition evaluation, trigger detection, and full resolution. M must not reimplement priority/APNAP. |
| O4P-01L | `research/cr-grounding/o4p-01l-control-access-authority.contract.draft.md`; `research/cr-grounding/o4p-01l-r-control-access-cr-matrix.draft.md` | `src/engine/core/rules/controlEffectV1.ts`, `decisionAuthorityV1.ts`, `playPermissionV1.ts`, `ruleAuthorityBundleV1.ts`, `ruleAuthorityValidationV1.ts`, `ruleAuthorityLifecycleV1.ts`, `ruleDurationV1.ts`, `searchSessionV1.ts`, `visibilityGrantV1.ts`, `visibilityQueryV1.ts`, and `src/engine/core/rules/index.ts` | rules `__tests__`; `src/test/architecture/review.o4p-01l-rule-authority-boundary.test.ts`; `scripts/checks/verify-mode-neutral-core-rule-authority.ts` | Owns control, access/visibility, decision authority, play permission, search authority, duration, and lifecycle. It explicitly defers Commander tax, combat, and player concession/exit. M should consume authority/decision inputs, not replace them. |

## 3. Commander and combat evidence matrix

### M-01 — physical Commander designation and identity

- **CR:** `903.3`, `903.3a`–`e`; related zone identity `400.7`, `400.8`; object/copy distinction `707` as referenced by `903.3`.
- **Current FACT:** Solo uses `src/engine/types.ts` `CardInstance.isCommander`, `PhysicalCardId`, `ObjectId`, `CommanderInfo`, and `GameState.commanders`. `src/engine/commander.ts` exposes `isCommander(state, cardId)`. `src/engine/init.ts` places designated cards in `zones.command` and initializes `castCount: 0`.
- **Core FACT:** O4P-01H validates `CorePhysicalCardId`/card objects and separate object IDs; O4P-01G creates a new card object incarnation on zone change while preserving the physical-card relationship. No read evidence shows a Commander designation field in the O4P-01H registry contract.
- **GAP:** `isCommander` is a Solo card flag, not yet a frozen Core Commander contract. A printed name, current object ID, copy, or current characteristics cannot safely stand in for the CR card attribute.
- **QUESTION:** Should the O4P-01M contract anchor Commander designation to the stable physical card identity supplied by O4P-01G/H, retain it through zone/face-down changes, and explicitly reject copied objects/tokens as Commanders? The answer must also state whether one or two designated cards are supported without inventing a new identity spelling.
- **DEFER:** Commander deck construction/color identity, partner deck-building legality, meld/merge component modeling, and all UI/protocol representation.

### M-02 — command-zone setup, ownership, and casting boundary

- **CR:** `903.6` (start in command zone), `903.8` (owner may cast from command), `903.3d` (Commander card/spell/permanent references).
- **Current FACT:** `src/engine/init.ts` initializes command-zone entries and `commanders`. `src/engine/commands.ts` has `castCommander`/`castToStack` paths; `src/store/gameStore.ts` has `castCommander` and `castToStack` helpers. `src/engine/__tests__/init.test.ts`, `commander.test.ts`, `commands.test.ts`, `m427.test.ts`, and `doubleFacedCommanderResolution.test.ts` cover Solo initialization/casting behavior.
- **GAP:** O4P-01I/J only provide announcement/transaction substrate; they do not define Commander permission, payment, or cast-count semantics. The Solo direct cast path and Core stack substrate are not yet reconciled.
- **QUESTION:** Which already-authorized stack transaction boundary records an accepted cast-from-command so that O4P-01M can update tax history without owning payment, target legality, priority, or resolution?
- **DEFER:** Full CR `601` casting procedure, payment planning, alternative/additional cost evaluation, permission effects, and resolution.

### M-03 — Commander tax and cast count

- **CR:** `903.8`: additional `{2}` for each previous time that player cast that Commander from the command zone during that game.
- **Current FACT:** `src/engine/commander.ts`: `commanderTax(state, cardId)` returns `2 * castCount` for a designated Commander and `0` otherwise. `src/engine/commands.ts`: `applyCast` and `applyCastToStack` increment the matching `CommanderInfo.castCount` when casting from `command`. `src/engine/__tests__/commander.test.ts`, `m431.test.ts`, `m427.test.ts`, `commands.test.ts`, and `src/engine/__tests__/gameStore.test.ts` pin initial zero, increment on command-zone cast, independent commander counts, and no increment on a return to command.
- **GAP:** Current Solo `CommanderInfo` is keyed by Solo `cardId`; successful-cast timing, rollback/cancel semantics, and Core integration with I/J are not frozen. A move to command must not increase tax; a failed/rolled-back announcement must not silently increase it.
- **QUESTION:** Define the authoritative accepted-cast transition and invariant: increment exactly once per Commander per successful cast from command, never for zone movement, duplicate retries, or an uncommitted/rolled-back announcement. Keep the count attached to Commander identity rather than a transient object incarnation.
- **DEFER:** Mana payment, cost reduction/increase, permission effects, stack resolution, and UI auto-payment.

### M-04 — `903.9a` state-based Commander choice

- **CR:** `903.9a`: Commander in graveyard/exile put there since the last SBA check may be moved to command by its owner; this is an SBA. `704.3` controls repeated SBA checking and simultaneity. `704.6d` is the generic Commander graveyard/exile rule reference.
- **Current FACT:** `src/engine/types.ts` defines `CommanderZoneRuleChoice`, `PendingSbaChoice`, and `RuleChoiceSelection` with `kind: 'commander-zone'` and `toCommandZone`. `src/store/gameStore.ts` `moveCommanderWithZoneChoice` first moves to graveyard/exile, derives a choice, and resolves the selected destination. `src/store/__tests__/review.cr609-one-shot-mass.test.ts`, `crGrounding.test.ts`, `ruleChoices.test.ts`, and `review.cr703-704-sba-turn-based.test.ts` cover the Solo choice substrate and the defer-while-choice-is-pending behavior. `src/engine/__tests__/review.cr614-grave-to-exile.test.ts` verifies that the generic graveyard-to-exile replacement path does not consume a Commander before the Commander choice can be observed.
- **GAP:** The choice is implemented in the Solo store, not in the O4P-01G/H Core contract. The current review boundary is advisory/guided and does not establish a complete general `704.3` fixed-point evaluator for all simultaneous SBAs.
- **QUESTION:** Freeze the two-step rule boundary: first a real zone move that supplies the `since last SBA` fact, then an owner-controlled explicit choice at the SBA checkpoint; choosing command creates the O4P-G/H transition, while declining leaves the card in the destination. The contract must preserve deterministic choice identity and prevent unrelated SBA loss through a pending choice.
- **DEFER:** General SBA condition evaluation, all replacement-layer ordering, legend/attachment SBA generalization, and automatic UI choice resolution.

### M-05 — `903.9b` replacement and `903.9c` meld/merged boundary

- **CR:** `903.9b`: if a Commander would be put into its owner’s hand or library, its owner may replace that destination with command; the replacement may apply more than once to the same event and is an exception to `614.5`. `903.9c` defines the component result for a melded or merged Commander permanent.
- **Current FACT:** `src/store/gameStore.ts` `moveCommanderWithZoneChoice` has a hand/library branch that chooses command instead of the requested destination. The same `CommanderZoneRuleChoice`/`RuleChoiceSelection` vocabulary is used. `src/store/__tests__/crGrounding.test.ts` covers the hand replacement; `src/engine/__tests__/review.cr614-grave-to-exile.test.ts` covers the distinct graveyard-to-exile path. O4P-01G explicitly deferred Commander replacement and generic replacement effects.
- **GAP:** No O4P-G/H replacement contract, repeated-application model, or `903.9c` merged/meld component model is present in the active manifest. Treating `903.9a` (SBA) and `903.9b` (replacement) as one event would lose the CR distinction.
- **QUESTION:** Freeze separate replacement-choice boundaries for `903.9a` and `903.9b`, with the owner as decision authority from O4P-01L and the ordinary destination transition from O4P-01G. State explicitly how a repeated hand/library event is re-offered and what evidence is retained for a single event. Decide separately whether `903.9c` is in M or deferred.
- **DEFER:** Generic `614`/`616` application order, replacement/prevention effects unrelated to Commander, meld/merge object composition, and any silent “always put it in command” shortcut.

### M-06 — commander-damage identity and 21-point loss

- **CR:** `903.10a`: a player dealt 21 or more combat damage by the same Commander over the game loses. `704.6c` makes it an SBA; `704.3` governs the check; `104.3j` and `104.5` describe the loss/leave consequence.
- **Current FACT:** `src/engine/types.ts` has `GameState.commanderDamage: Record<string, number>` with a comment identifying free-form opposing-Commander labels; `DefeatReason` includes `commanderDamage` and `DefeatRuleRef` includes `903.10a`. `src/engine/commands.ts` `adjustCommanderDamage` changes a label counter; `applyDefeatStateBasedActions` checks each label and adds a `P1` advisory at 21. `src/store/__tests__/review.903-10a.test.ts`, `review.sba-defeat.test.ts`, `crGroundingGoldenCases.test.ts`, `src/engine/__tests__/review.properties.test.ts`, and `src/store/__tests__/review.mp-state.test.ts` pin the advisory, 20/21 threshold, no cross-label sum, simultaneity, idempotence, snapshot compatibility, and the explicit current boundary that the label is not an opponent player key.
- **Current combat FACT:** `src/engine/commands.ts` `applyResolveCombatDamage` applies current combat damage to life and marked damage but does not attribute a combat-damage result to a Commander/source-recipient pair. `src/engine/__tests__/combat.test.ts` explicitly preserves the existing `commanderDamage` map during ordinary combat tests.
- **GAP:** Current data can be manually corrected but cannot prove “same Commander,” recipient player, combat-damage origin, or persistence across object incarnations/zone changes. It also cannot evaluate a four-player loss for the correct recipient. The current P1 advisory is not exact multiplayer Commander damage automation.
- **QUESTION:** If M records Commander damage, require provenance sufficient to prove source Commander physical identity, damaged player identity, amount, and combat-damage origin; accumulate per `(same Commander, recipient player)` over the game, do not combine different Commanders, and retain the total after zone changes. Only emit a 903.10a advisory for a proven pair; otherwise remain guided/manual. This is a contract question, not an assertion that such a structure already exists.
- **DEFER:** Noncombat damage, copy/meld/merge source identity, prevention/replacement ordering, full automatic replay/event integration, and hard enforcement that ends the Solo sandbox.

### M-07 — combat lifecycle and priority handoff

- **CR:** `506.1` combat has beginning-of-combat, declare attackers, declare blockers, combat damage, and end-of-combat steps; `506.2` active player attacks; `507.1`/`507.2` establish multiplayer defending-player choice and priority.
- **Current FACT:** `src/engine/types.ts` defines `CombatStep`, `CombatState`, `CombatAttacker`, `CombatBlocker`, and `AttackDeclarationEvent`. `src/engine/commands.ts` implements `enterCombat`, `declareAttackers`, `declareBlockers`, and `resolveCombatDamage`; `applyEnterCombat` sets Solo combat directly and chooses a default next-turn-order defender. `src/engine/__tests__/combat.test.ts` and `src/store/__tests__/review.combat.test.ts` cover the existing Solo lifecycle. O4P-01K provides turn/priority/APNAP substrate but its boundary explicitly defers concrete combat evaluation.
- **GAP:** The current command path is a Solo combat convenience path, not proof of CR `507` priority windows or multiplayer combat lifecycle. The singular `CombatState.defendingPlayerId` cannot by itself express all defending players under CR `802`.
- **QUESTION:** Define M’s combat slice as step/assignment facts consumed by the O4P-K turn/priority boundary, with explicit active player and surviving defending-player order, without adding a second priority/APNAP engine.
- **DEFER:** Full priority legality, trigger detection/placement, stack resolution, and all noncombat turn actions.

### M-08 — multiplayer attack target assignment

- **CR:** `903.2` default Commander multiplayer is Free-for-All with the attack-multiple-players option and no limited range; `802.2` all opponents are defending players; `802.2a` resolves “defending player” per attacking creature; `802.3` chooses a defending player/planeswalker/battle per attacker; `802.3a` applies group-specific restrictions/requirements; `802.4` orders blockers by APNAP; `802.5` orders combat-damage assignment; `806.2b` selects attack-left/right/multiple, with Commander’s default pointing to `802`.
- **Current FACT:** `src/engine/types.ts` `CombatTarget` supports a player or battle, and `CombatAttacker` stores a target. `src/engine/commands.ts` `applyDeclareAttackers` accepts per-attacker target data, validates player/battle existence, rejects attacking its own controller, and defaults missing targets to one defender. `src/store/gameStore.ts` `declareAttack(attackerIds, targetLabel, blockers)` resolves one label and supplies that target to each attacker. `src/engine/commands.ts` `defaultDefendingPlayer` chooses the next `turnOrder` player. `src/store/__tests__/review.mp-four-player.test.ts` and `review.mp-state.test.ts` cover explicit multiplayer state/commands, not the complete CR `802` attack/block/damage procedure.
- **GAP:** One store target label and one `defendingPlayerId` are not the Commander default. Current declaration warns on several illegal conditions instead of proving/rejecting all `508.1` restrictions and requirements. There is no evidence of a complete attacked-player set or surviving-player filtering for combat.
- **QUESTION:** Freeze per-attacker target assignment against the live player identity/order, including player/planeswalker/battle defending-player derivation, attack-multiple-players defaults, and no implicit local-player substitution. Define how an attacker remains associated with its defending player for later `802.2a`/`508.5` checks.
- **DEFER:** Attack-left/right, limited range, banding, goad/requirements/restrictions, planeswalker/battle combat semantics beyond identity, and effects that add/remove attackers.

### M-09 — multiplayer blocker declaration and assignment

- **CR:** `509.1a` each blocker is assigned to an attacking creature attacking that defending player or their planeswalker/battle; `509.1b`–`f` restrictions, requirements, and costs; `509.1g` blockers become blocking; `509.1h` blocked status persists if a blocker later leaves; `802.4a`/`b` constrain each defending player’s blocks and ignore other attacks; `802.4` uses APNAP defending-player order.
- **Current FACT:** `src/engine/types.ts` `CombatBlocker.blocking` is an array, but `src/engine/commands.ts` `applyDeclareBlockers` accepts `{cardId, attackerId}` pairs and stores one relation per input. It warns for missing attackers/noncreatures but does not validate defending player, controller, untapped state, restrictions, requirements, or multi-defender legality. Solo tests `src/engine/__tests__/combat.test.ts`, `src/store/__tests__/review.combat.test.ts`, and `review.cr702-lifelink-trample.test.ts` cover reciprocal/single-blocker behavior; MP tests do not establish the full blocker procedure.
- **GAP:** No current evidence proves APNAP block declaration for multiple defenders or complete blocker assignment legality. The array shape is not evidence that multi-blocker assignment is implemented.
- **QUESTION:** Define a deterministic declaration record that retains each blocker’s controller, defending player, attacked target, attacking object, and declaration order; use O4P-K APNAP order and O4P-L decision authority. Define the minimum structural relation M must preserve before keyword legality is added.
- **DEFER:** Banding, menace/fear and other evasion, blocking requirements/restrictions, blocking costs, effects that put creatures blocking, and full `509.1` legality.

### M-10 — combat damage and the guided/manual boundary

- **CR:** `510.1a` attacking power/assignment; `510.1b` unblocked damage to the attacked player/planeswalker/battle; `510.1c` blocked attacker assignment among blockers; `510.1d` blocker assignment to blocked attackers; `510.1e` assignment legality; `510.2` simultaneous damage; `510.3` priority after damage; `510.4` first-strike/double-strike second damage step. `802.5` adds APNAP assignment order.
- **Current FACT:** `src/engine/commands.ts` `applyResolveCombatDamage` calculates unblocked damage, handles single-blocker/trample/lifelink paths, records marked damage and player life changes, and emits `manual-combat-damage` for more-than-one blocker rather than guessing an assignment. It also observes the existing combat-damage-prevention flag. `src/store/__tests__/review.combat.test.ts`, `review.cr702-lifelink-trample.test.ts`, `src/store/__tests__/crGroundingGoldenCases.test.ts`, and `src/engine/__tests__/review.cr614-615-prevent-combat-damage.test.ts` pin these Solo/manual boundaries.
- **GAP:** Current resolution does not provide complete multi-blocker assignment, per-defender APNAP damage assignment, first/double-strike step handling, or Commander-damage provenance. “Automatic combat damage” would overclaim the ledger’s stated boundary.
- **QUESTION:** Freeze the honest minimum: auto-apply only a deterministic, fully represented assignment; expose a guided/manual application for unresolved multi-blocker, replacement, prevention, or first/double-strike cases; preserve enough source/target evidence for a later exact Commander-damage check. Manual application must not be reported as automatic replay.
- **DEFER:** Full combat-damage automation, all replacement/prevention/doubling layers, deathtouch/infect/wither and other damage keywords, first/double-strike second-step automation, and trigger/effect resolution.

### M-11 — Commander-specific replacement choices versus generic replacement layers

- **CR:** `903.9a` is an SBA choice after a graveyard/exile move; `903.9b` is a hand/library replacement choice; `903.9c` is a merged/melded component rule; generic replacement/prevention ordering is `614`–`616`; combat prevention examples are `615` and `510`.
- **Current FACT:** Solo has `moveCommanderWithZoneChoice` and a pending `commander-zone` choice. O4P-01G defers replacement effects, and O4P-01L owns decision authority rather than replacement execution. The CR `614`/`615` review test covers a narrow combat-prevention path, not a general replacement engine.
- **GAP:** A Commander destination choice must not be conflated with generic replacement ordering or combat prevention. No active O4P-M contract assigns ownership of the general `614`/`616` layer.
- **QUESTION:** Keep M limited to Commander-specific destination choice and Commander-damage provenance, consuming O4P-L decision authority and O4P-G zone transitions. Ask separately whether a later replacement lane supplies a normalized replacement event to M.
- **DEFER:** General replacement/prevention engine, timestamp/order selection, damage doubling, multiple simultaneous replacement choices, and automatic combat shield resolution.

### M-12 — defeat, concession, and player exit

- **CR:** `104.2a` remaining player wins when all opponents leave; `104.3a` concession is immediate and causes loss; `104.3b`–`d` life/draw/poison losses are checked at the stated priority/SBA points; `104.3j` Commander damage loss; `104.5` losing/drawing player leaves. `704.3`, `704.6c`, and `704.6d` cover SBA checking and Commander loss/zone choice. `800.4` governs multiplayer continuation and object/control/priority/choice consequences when a player leaves, including `800.4a`–`k`.
- **Current FACT:** `src/engine/types.ts` has `DefeatReason`, `DefeatAdvisoryRecord`, `DefeatAdvisoryEvent`, `DefeatPlayerRef`, and `GameState.defeat`; `src/engine/commands.ts` `applyDefeatStateBasedActions` records advisory reasons for life, draw, poison, and current Solo Commander-damage labels. `src/store/__tests__/review.sba-defeat.test.ts`, `review.903-10a.test.ts`, `review.mp-four-player.test.ts`, and `crGroundingGoldenCases.test.ts` cover advisory behavior, cross-player empty-library defeat, simultaneity, idempotence, and sandbox non-enforcement.
- **Absence checked:** no current engine/store symbol matching `concede`, `disconnect`, `playerExit`, `exitGame`, or `leaveGame` was found in the searched Solo/Core/MP paths. This is a bounded search result, not a claim that no historical design text exists.
- **GAP:** There is no grounded O4P-M player-left state transition or 800.4 cleanup implementation. Defeat advisories are not the same as removing a player and cleaning up that player’s objects, choices, priority, or combat assignments. Disconnect is explicitly outside this rules event.
- **QUESTION:** Define a rules-level player-exit/concession state distinct from transport disconnect: who leaves, why, when the loss is observed, how the surviving turn order/priority/attacks/blocks/choices are repaired under `800.4`, and when the game ends under `104.2a`. Use explicit player identity; do not infer exit from a missing network heartbeat.
- **DEFER:** WebSocket/session disconnect, reconnection, online protocol, spectator behavior, team variants, and UI confirmation. Also defer hard-ending the existing Solo sandbox until the project’s advisory policy is explicitly changed.

## 4. Proposed bounded O4P-01M contract questions

These are proposals for judge decisions, not current APIs or implementation facts.

1. **Commander identity invariant:** A Commander designation is attached to a stable physical card identity, not a zone-local object ID, printed-name label, copied object, token, or current characteristics. O4P-G/H own incarnations and object taxonomy; M owns only the Commander-specific designation relation.
2. **Cast-count invariant:** An accepted cast from command increments exactly once for that Commander; zone moves and uncommitted/rolled-back announcements do not. The count survives Commander zone replacement and is independent for each designated Commander.
3. **Choice split:** `903.9a` is an SBA-time owner choice after a graveyard/exile move; `903.9b` is an owner replacement before hand/library placement; `903.9c` is a separately decided meld/merge case. No single boolean or always-command shortcut may erase the distinction.
4. **Combat assignment invariant:** Every declared attacker has an explicit defending target and declaring player; every declared blocker has an explicit defending player, controller, attacker relation, and declaration order. Surviving-player order comes from the existing multiplayer/turn state and APNAP substrate, not a new identity spelling.
5. **Damage evidence invariant:** Automatic Commander-damage loss recognition requires source Commander identity, recipient player identity, combat-damage origin, and amount. If any required proof is unavailable, the result is guided/manual and not described as automatic replay.
6. **Exit invariant:** Rules defeat/concession/player exit is separate from disconnect. A player leaving triggers the bounded `104`/`800.4` state consequences; it does not silently become a network state or a local-player substitution.
7. **Atomicity/immutability invariant:** Each accepted choice/assignment application is deterministic, input-preserving, and compatible with `ENG-STATE-001`–`005`, `ENG-CMD-002`–`004`, and `ENG-MP-001`–`004`; unresolved choices block only the illegal transition that depends on them.

## 5. Explicit non-overlap lanes

| Existing or future lane | O4P-01M may consume | O4P-01M must not own |
|---|---|---|
| O4P-01G zone transition | Physical-card owner/controller and zone-transition/incarnation substrate | A second zone-transition engine, generic replacement layers, or Commander-specific copy of object identity |
| O4P-01H object registry | Physical-card/object references and object-kind validation | A new ObjectId spelling, token/copy/ability taxonomy, or generic registry canonicalization |
| O4P-01I/J stack | Accepted Commander-cast announcement/transaction boundary once the judge defines the bridge | Payment, casting legality, priority, stack resolution, spell copies, or a second transaction system |
| O4P-01K turn/priority | Active player, turn position, APNAP order, pending-choice/resolution boundary | A second priority/APNAP engine, full SBA fixed-point engine, trigger detection, or trigger resolution |
| O4P-01L control/access/authority | Controller, decision authority, visibility/access, and explicit player identity | Reimplementing control/permission/visibility or inventing implicit local-player substitution |
| Current Solo engine | Regression/compatibility evidence for existing user behavior and honest manual fallback | Treating `GameState.commanderDamage` labels, `CombatState.defendingPlayerId`, or Solo commands as the frozen O4P-M Core API |
| O4P-01N boundary stated by ledger | Later typed commands/events, replay, deterministic randomness, four-player headless closure | Pulling protocol/event/replay closure forward into this grounding slice |
| Online/disconnect lane | Nothing beyond an explicit distinction between rules exit and disconnect | WebSocket/session liveness, reconnect, transport exit, or online UI |

## 6. Explicit DEFER list for the next contract

- Full CR `601` casting/payment/permission/priority procedure and resolution.
- Full `508.1` attacker restrictions/requirements/costs, haste/continuous-control proofs, banding, goad, and attack-left/right/limited-range options.
- Full `509.1` blocker legality, evasion, requirements, costs, banding, and creatures entering blocking.
- Full `510` multi-blocker assignment automation, first/double-strike second-step automation, and all damage keyword semantics.
- Generic `614`–`616` replacement/prevention ordering, damage doubling, prevention shields beyond the existing narrow Solo path, and replacement choice orchestration.
- Melded/merged Commander component identities (`903.9c`) unless the judge explicitly makes them a bounded M acceptance scenario.
- Full SBA condition evaluation and trigger/effect resolution; O4P-K’s stated boundary remains respected.
- Automatic Commander-damage replay when source/recipient/combat provenance is not executable and reviewable.
- Hard enforcement of defeat in the current Solo sandbox, UI/store redesign, typed event/protocol integration, online disconnect, and Pages/release work.

## 7. Grounding conclusion

The dependency chain and pinned CR authority are present, but O4P-01M is still pre-contract. The strongest grounded implementation shape is an additive Commander/combat boundary over the O4P-01G–L substrates: stable physical-card Commander designation, explicit cast-count history, separate `903.9a`/`903.9b` choices, player-aware attack/block assignment, and provenance-gated Commander-damage recognition, with guided/manual damage where the ledger permits it. The active manifest/loop-state authority gap and the Solo/Core representation gap are STOP findings for contract freeze and implementation; they do not prevent this report from serving as the evidence packet for the judge.
