# M3.1 direct-evidence role audit

Date: 2026-09-18  
Baseline reviewed: `main@315476b3156b53b4eb01139a7aa48ada3b908233`  
Purpose: independently classify the 42 automated direct evidence bindings introduced by M3 as `conformance`, `characterization`, or invalid direct evidence.

This is audit evidence, not semantic authority. Contract meaning remains in active contract clauses; M3 verification metadata only binds evidence.

## Decision rule

- **conformance**: the bound test file contains assertions that directly exercise the core normative behavior of the clause.
- **characterization**: the file exercises related current behavior but does not establish the clause's normative requirement.
- **remove**: the file is materially unrelated to the clause as direct evidence. Removal is safe only where another authored Acceptance claim remains or replacement conformance evidence is added.

A file may contain broader tests than the clause; the question is whether its assertions directly evaluate the bound requirement, not whether it is a complete proof of every possible implementation.

## Row-by-row audit

| Semantic | Baseline binding | Audit result | Rationale |
| --- | --- | --- | --- |
| ENG-STATE-001 | `init.test.ts` | conformance | Directly checks deterministic seeded initialization, player/state construction, commander/library placement; this exercises the clause's deterministic state-construction core. |
| ENG-STATE-002 | `commands.test.ts` | conformance | Includes explicit non-mutation of input state and broad fresh-state command transitions across owned state branches. |
| ENG-STATE-003 | `identityZoneState.test.ts` | conformance | Directly checks stable physical/incarnation identity, exact single location, deterministic rejection, deep immutability and identity generation. |
| ENG-STATE-004 | `snapshotPersistenceControl.test.ts` | **remove direct binding** | The test is about fixture restore not overwriting normal persistence; it does not directly establish undo/redo snapshot boundaries/backfill. `ACC-UNDO-001` remains the authored Acceptance claim. |
| ENG-STATE-005 | `eventEnvelope.test.ts` | **remove direct binding** | Event-envelope determinism does not directly establish pinned-CR authority or the replay/manual policy. `ACC-CR-REPLAY-001` remains the authored Acceptance claim. |
| ENG-CMD-001 | `commands.test.ts` | conformance | Directly exercises the canonical `GameCommand → applyCommand` write vocabulary over the engine state boundary. |
| ENG-CMD-002 | `commands.test.ts` | conformance | Directly checks invalid command rejection, warnings/shortfall behavior, unchanged input and deterministic explicit results. |
| ENG-CMD-003 | `interactionUndo.test.ts` | **characterization** | It characterizes undo of guided interaction state but does not directly prove ordered batch atomicity/store single-snapshot transaction semantics. Acceptance claims remain for affected user-visible flows. |
| ENG-CMD-004 | `caseGrammar.test.ts` | conformance | Directly checks supported leaf handling, deferred unsupported behavior, command application and deterministic rejection rather than guessed execution. |
| ENG-ZONES-001 | `cr400LinkedExileSubstrate.test.ts` | **remove direct binding** | Linked-exile behavior does not directly establish shared/private-zone ownership semantics. `ACC-ZONE-001` remains the authored Acceptance claim. |
| ENG-ZONES-002 | `zoneChangeIdentity.test.ts` | conformance | Directly checks zone-change counter/object identity boundary and same-zone non-transition behavior. |
| ENG-ZONES-003 | `zoneChangeEvents.test.ts` | conformance | Directly checks successful zone-change event ordering, before/after snapshots and semantic reasons. |
| ENG-ZONES-004 | `cr400LinkedExileSubstrate.test.ts` | conformance | Directly checks linkage to the original object incarnation/recorded transition rather than a later same-name object. |
| ENG-TURN-001 | `priority.test.ts` | conformance | Directly checks priority-boundary legality and deterministic stop/transition behavior in the active turn/stack boundary. |
| ENG-TURN-002 | `priority.test.ts` | conformance | Directly checks deterministic pending-trigger ordering and APNAP independent of UI order. |
| ENG-TURN-004 | `pendingTriggerV1.test.ts` | **rebind** → `priority.test.ts` | Pending-trigger storage alone is not the pending-choice transition rule. `priority.test.ts` directly checks stopping before priority when a rule choice is pending. |
| ENG-MANA-001 | `mana.test.ts` | conformance | Directly checks supported mana-cost vocabulary and pure payment planning across colored/generic/hybrid/phyrexian/X/colorless forms. |
| ENG-MANA-002 | `manaTransaction.test.ts` | **rebind** → `mana.test.ts` | Triggered-mana fixed-point tests were unrelated to accepted payment/shortfall semantics. `mana.test.ts` directly tests payment and shortfall behavior. |
| ENG-MANA-003 | `activatedAbilityEnvelope.test.ts` | conformance | Directly checks no-stack mana abilities, guided choice-bearing costs and atomic failure of compound nonmana costs. |
| ENG-MP-001 | `zonesByPlayer.test.ts` | conformance | Directly checks local player/private-zone mirrors, opponent zones and legacy snapshot backfill. |
| ENG-MP-002 | `activatedAbilityEnvelope.test.ts` | conformance | Directly checks explicit player-target/recipient handling for player-aware activated ability commands rather than silent local substitution. |
| ENG-MP-003 | `priority.test.ts` | conformance | Directly checks APNAP from state player order and deterministic player-group ordering. |
| ENG-MP-004 | `soloOnlineBoundary.test.ts` | conformance | Direct architecture test for additive multiplayer/state boundary and forbidden cross-boundary expansion. |
| ENG-COMP-001 | `cr701DiscardCompiler.test.ts` | conformance | Directly checks Oracle-driven compiler classification for supported discard forms without pretending unsupported forms are auto. |
| ENG-COMP-002 | `cr701DiscardCompiler.test.ts` | conformance | Directly distinguishes guided and manual results rather than claiming unsupported automation. |
| ENG-COMP-003 | `caseGrammar.test.ts` | conformance | Directly preserves clause parsing boundaries and deterministic command behavior without inventing unsupported resolution. |
| ENG-COMP-004 | `eventEnvelope.test.ts` | **remove direct binding** | Event determinism does not directly establish local pinned-CR/fixture evidence ownership or the periodic live-Scryfall boundary. `ACC-CR-REPLAY-001` remains the authored Acceptance claim. |
| UI-DESIGN-001 | `HudInteractions.test.tsx` | conformance | Broad interaction integration tests directly check consistent repeated affordances, visible feedback and undoable/reversible user operations. |
| UI-DESIGN-002 | `recentCueModel.test.ts` | conformance | Directly checks presentation derives from successful meaningful history/events and suppresses history-navigation replay. |
| UI-DESIGN-003 | `ContextMenu.test.tsx` | conformance | Directly checks keyboard/non-pointer navigation, close/focus restoration and context-menu fallback behavior. |
| UI-VIS-001 | `CardView.test.tsx` | conformance | Directly checks distinct card visual roles/identity presentation including private back, DFC, token and duplicate display-copy behavior. |
| UI-VIS-002 | `HudInteractions.test.tsx` | conformance | Integration tests directly exercise focus/preview, unresolved decision/stack presentation and stable interaction anchors. |
| UI-VIS-003 | `ambientMacroProduction.test.ts` | conformance | Directly checks shared motion/CSS token values and prevents ad-hoc runtime motion mechanisms outside the owned visual system. |
| UI-ARCH-001 | `GameScreenTabletop.test.tsx` | conformance | Directly checks the tabletop projection remains decorative/non-interactive at the component boundary; state mutation remains outside that surface. |
| UI-ARCH-002 | `GameScreenTabletop.test.tsx` | conformance | Directly checks the browser-only tabletop surface does not acquire an independent interaction/accessibility operation surface. |
| UI-ARCH-003 | `TransitionCue.test.tsx` | conformance | Directly checks non-blocking cue lifetime, reduced-motion behavior and presentation replacement without state-transition gating. |
| UI-ARCH-004 | `presentationRuntime.test.ts` | **rebind** → `check-verification.test.mjs` | Presentation runtime is unrelated to architecture traceability indexing. New structural evidence directly checks active UI architecture + Acceptance registry indexing. |
| UI-RESP-001 | `adaptiveLaneLayout.test.ts` | conformance | Directly checks responsive geometry across portrait/landscape constraints and interaction-size floor. |
| UI-RESP-002 | `HudInteractions.test.tsx` | conformance | Integration tests directly check dense-zone/hand reachability, explicit controls, compact stack workspace and focusable interaction alternatives. |
| AV-001 | `recentCueModel.test.ts` | conformance | Directly derives cues from successful semantic event/history input rather than raw pointer/touch events. |
| AV-002 | `av0-presentation.test.ts` | conformance | Directly checks independent BGM/SFX transport, effective audibility, gesture/theme routing and timing policy. |
| AV-003 | `recentCueModel.test.ts` | conformance | Directly checks one meaningful cue path for semantic append/batch behavior and suppresses replayed/non-current history. |

## Result

Baseline automated direct rows reviewed: **42**.

Disposition after audit:

- kept as conformance: 34;
- rebound to better conformance evidence: 3;
- downgraded to characterization: 1;
- removed as invalid direct evidence with existing Acceptance coverage: 4.

The separate deferred row `ENG-TURN-003` remains `characterization` and `deferred-needs-decision`; it was already intentionally non-conformance.

This audit closes the M3-PLAN requirement that legacy automated evidence must not be bulk-promoted to conformance without independent row-by-row review.
