# O4P-01I-R Stack Announcement CR Matrix

- Status: `drafted` / requirements-analysis only
- Milestone: `O4P-01I-R`
- Base: `PLAN_SHA=5418d82`
- Authority: local `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, pinned `mtg-cr-2026-06-19` only.
- Boundary: committed announcement facts for card spells, spell copies, activated abilities, and triggered abilities. This draft does not choose final TypeScript names, ID formats, UI, protocol, copyable-values, or resolution behavior.

## 1. Scope

The matrix covers the facts fixed while an object is proposed/announced and placed on the stack: modes, targets, X, alternative/additional-cost intentions, hybrid/Phyrexian payment intentions, division among targets, ability text at trigger/placement time, source/controller provenance, and copy-source decisions. It distinguishes structural storage from future commands and resolution.

## 2. Fixed ruleset

Use CR 115 (targets), 405.1–405.5 (stack), 601.2 and 601.2a–i (casting), 602.2 and 602.2a–b (activation), 603.3 and 603.3a–d (trigger placement), 608.2b and 608.2d (resolution checks/late choices), 707.10 and 707.10a–f (copies), and 727.1–2 (restart boundary). CR 601.2 defines proposal as 601.2a–d and costs as 601.2f–h; 601.2e is the legality checkpoint between them.

## 3. Terms

- **Announcement**: a choice or intention fixed by the applicable 601.2b–d, 602.2b, or 603.3c–d step.
- **Proposal**: the casting portion through 601.2d, before the 601.2e legality check.
- **Committed**: the completed stack object after 601.2a–i, 602.2, or 603.3; it is not evidence that an implementation has resolved anything.
- **Target**: a chosen object/player under CR 115; target identity is checked again at resolution under 608.2b.
- **Late choice**: a choice normally made while resolving; CR 707.10 excludes it from copied decisions.
- **Classification**: `STRUCTURE_V1` means store the committed fact now; `COMMAND_LATER` means a future proposal/commit command owns it; `RESOLUTION_LATER` means do not settle it at announcement; `COPY_LATER` means defer copy derivation/execution; `OUT_OF_SCOPE` means outside this milestone.

## 4. Casting announcement sequence

CR 601.2a moves the card or card copy to the stack and establishes spell/controller characteristics. 601.2b fixes mode, splice, cost intentions, X, and payment-form intentions. 601.2c fixes target count and targets; 601.2d fixes division/distribution among targets. 601.2e checks legality. 601.2f locks the total cost, 601.2g allows mana abilities, 601.2h pays without partial payment, and 601.2i makes the spell cast and triggers cast/stack triggers. Storage may represent only the completed committed record, not an in-progress transaction.

## 5. Activated ability announcement sequence

CR 602.2a announces activation, creates a non-card ability on top of the stack, and fixes its controller. CR 602.2b reuses 601.2b–i, with the activation cost in place of the spell mana cost. Thus modes, X, targets, division, cost intentions, locked cost, payment, and final commitment have the same phase distinction as a spell. A mana ability follows its separate CR 605 path and is not silently manufactured as an ordinary stack object.

## 6. Triggered ability placement

Triggering itself makes no stack change (CR 117.2a, 603.2). At the next priority opportunity, 603.3 puts the ability on the stack; 603.3a fixes controller from source control when it triggered (with delayed-trigger exceptions), 603.3b orders simultaneous triggers APNAP, 603.3c announces mode, and 603.3d applies target and division steps. If required choices or legality cannot be satisfied, the ability is removed rather than committed (603.3d). The committed record must therefore distinguish a pending trigger from a placed stack object.

## 7. Spell-copy decision inheritance

CR 707.10 says a copy is put on the stack, not cast/activated, and copies characteristics and decisions including modes, targets, X, and alternative/additional costs. Choices normally made on resolution are not copied. 707.10c permits new legal targets only when the copying effect says so; unchanged targets may remain even if illegal. The matrix records the boundary between source decisions and future copy derivation; it does not define copyable-values, new-target selection, or execution.

## 8. Target lifetime

Targets are chosen at casting (601.2c), activation (602.2b), or triggered-ability placement (603.3d). A target is a historical announcement fact, not a promise of future legality. CR 608.2b rechecks whether each target is still in its required zone and otherwise legal; all-illegal spells/abilities do not resolve, while partially illegal effects can still affect legal targets. Zone changes and new-object identity are not repaired by rewriting the old announcement. Target removal, retargeting, and resolution outcomes are later work.

## 9. Division/distribution

CR 601.2d fixes division/distribution when the spell is put on the stack, and each selected target receives at least one of the divided quantity. The same rule applies to an activated ability through 602.2b and to a triggered ability through 603.3d. By contrast, CR 608.2d makes choices during resolution for untargeted recipients; those values are not announcement facts. Store only committed target-associated division assignments, not resolution-time distribution.

## 10. Cost announcement versus payment

601.2b announces which alternative/additional costs and variable/payment-form intentions apply; 601.2f determines and locks the total cost; 601.2g permits mana abilities; 601.2h pays in full with no partial payment. 602.2b inherits this sequence. An announcement snapshot is not proof of resources, legality, or payment. Payment, mana production, rollback, and atomic commit belong to a later command/lifecycle slice.

## 11. Proposal versus committed

Proposal is the reversible attempt described by 601.2a–d. 601.2e may reject it and returns the game to before proposal; 602.2 has the analogous rollback boundary. A committed spell exists only after 601.2a–h and becomes cast at 601.2i; a committed activated ability follows 602.2; a triggered ability commits only after 603.3 placement choices succeed. O4P-01I stores committed-only payloads and must not claim that a proposal or payment-in-progress is a stack object.

## 12. Illegal-action boundary

An inability to comply with a required step makes casting/activation illegal and returns the game to the pre-proposal state (601.2, 602.2). A proposed spell is checked at 601.2e; a triggered ability with no legal required choice is simply removed at 603.3d. Invalid targets, impossible mode/target combinations, insufficient resources, and unpayable costs are not committed facts. The matrix does not choose rollback command shape or an error protocol.

## 13. Required fields

The committed record must preserve, without prescribing public names or ID formats: object kind (card spell, spell copy, activated ability, triggered ability); stack placement/order relation; source/provenance where applicable; controller at the CR-defined event; ability text/characteristics snapshot required by the announcement; selected modes; target selections and target count; announced variable values such as X; alternative/additional-cost intentions and payment-form intentions; division assignments; copy-origin reference/decision boundary; and an explicit distinction between committed values and deferred values. It must not persist proposal-in-progress, payment-in-progress, target legality result, priority, resolution choice/result, UI state, protocol state, or a final copyable-values policy.

## 14. Required acceptance tests

Each row is a required scenario. The twelve columns are fixed for this
analysis only; they do not choose final public TypeScript names or ID formats.
`Classification` is intentionally one of the five exact contract values.

| Scenario ID | Object kind | Announcement timing | Stored choice | Governing CR | Mutable after commitment | Copied by CR707.10 | Resolution-time recheck | Required state field | O4P-01I classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | card spell | cast announcement | nonmodal choice set, possibly empty | 601.2b | only by explicit later effect | yes, if copied | targets only, if any | chosen modes | `STRUCTURE_V1` | committed nonmodal spell | empty arrays are structural values |
| 2 | card spell | cast announcement | selected mode keys in declaration order | 601.2b | no ordinary mutation | yes | targets only, if any | chosenModeKeys | `STRUCTURE_V1` | modal spell preserves order | legality belongs later |
| 3 | card spell | cast announcement | X and other announced variable values | 601.2b | no ordinary mutation | yes | no automatic recalculation | announcedVariables | `STRUCTURE_V1` | X=0 and positive X | X is a variable entry, not a separate field |
| 4 | card spell | cast announcement | selected alternative cost | 601.2b, 601.2f-h | no ordinary mutation | yes as a decision | payment/legality later | costChoices.alternativeCost | `STRUCTURE_V1` | alternative choice without payment | choice is not total cost |
| 5 | card spell | cast announcement | mandatory additional cost choices and counts | 601.2b, 601.2f-h | no ordinary mutation | yes as a decision | payment/legality later | costChoices.additionalCosts | `STRUCTURE_V1` | additional cost times | no sacrificed object is stored |
| 6 | card spell | cast announcement | optional additional cost choice and count | 601.2b | no ordinary mutation | yes as a decision | payment/legality later | costChoices.additionalCosts | `STRUCTURE_V1` | optional cost selected or empty | selected choice is not proof of payment |
| 7 | card spell | cast announcement | targets grouped by target requirement | 115.1a, 601.2c | explicit target-change effect only | yes, subject to CR707.10 | current legality later | targetSelections.groupKey | `STRUCTURE_V1` | multiple groups | same object may occur in different groups |
| 8 | card spell | cast announcement | zero selected targets | 601.2c | no ordinary mutation | yes | no target check when empty | targetSelections=[] | `STRUCTURE_V1` | zero-target spell | required count is not checked here |
| 9 | card spell | cast announcement | up-to target selection in declaration order | 115.1a, 601.2c | explicit target-change effect only | yes | current legality later | targetSelections | `STRUCTURE_V1` | up-to zero and nonzero | candidate generation is deferred |
| 10 | card spell | cast announcement | amount assigned to each selected target | 601.2d | explicit target-change effect only | yes as a decision | target legality later | distributions | `STRUCTURE_V1` | damage division | totals are effect-definition responsibility |
| 11 | activated ability | activation announcement | selected target reference | 115.1c, 602.2b | explicit target-change effect only | not a spell-copy rule | current legality later | targetSelections | `STRUCTURE_V1` | targeted activation | no legal-target predicate here |
| 12 | activated ability | activation announcement | announced X or generic variable | 602.2b | no ordinary mutation | not a spell-copy rule | no recalculation | announcedVariables | `STRUCTURE_V1` | activated ability X | range legality is deferred |
| 13 | activated ability | activation announcement | additional cost choice and repetition | 602.2b | no ordinary mutation | not a spell-copy rule | payment/legality later | costChoices | `STRUCTURE_V1` | activation additional cost | no payment ledger |
| 14 | triggered ability | stack placement | selected mode keys | 603.3c | explicit later effect only | not automatically asserted | targets/legality later | chosenModeKeys | `STRUCTURE_V1` | modal trigger | pending trigger is not this record |
| 15 | triggered ability | stack placement | selected target references | 115.1d, 603.3d | explicit target-change effect only | not automatically asserted | current legality later | targetSelections | `STRUCTURE_V1` | targeted trigger | source may later disappear |
| 16 | triggered ability | stack placement | target division assignments | 603.3d, 601.2d analogy | explicit target-change effect only | not automatically asserted | current legality later | distributions | `STRUCTURE_V1` | trigger division | untargeted resolution distribution is separate |
| 17 | any targeted stack object | after announcement | historical object target reference | 115.1, 608.2b | explicit retarget effect only | copied only by applicable copy rule | zone/liveness recheck later | target.kind/objectId | `RESOLUTION_LATER` | target leaves zone | current registry presence is not required |
| 18 | any player-targeted stack object | after announcement | historical player target reference | 115.1, 608.2b | explicit retarget effect only | copied only by applicable copy rule | player status/legality later | target.kind/playerId | `RESOLUTION_LATER` | player leaves or loses | exit model is deferred |
| 19 | activated or triggered ability | stack placement | ability rules-text snapshot | 603.3d, 602.2b, 405.4 | immutable in this slice | not a spell-copy assertion | text is not re-fetched | abilityTextSnapshot | `STRUCTURE_V1` | source disappears | source current existence is not required |
| 20 | spell copy | copy placement | copied mode decisions | 707.10 | choose-new-targets effect is separate | copy rule applies to copied values | targets may be rechecked | chosenModeKeys | `COPY_LATER` | copy retains modes | copy execution is deferred |
| 21 | spell copy | copy placement | copied target decisions | 707.10, 707.10c | explicit choose-new-targets effect | yes, subject to 707.10c | current legality later | targetSelections | `COPY_LATER` | copy retains targets | no source-match validation here |
| 22 | spell copy | copy placement | copied X and variable decisions | 707.10 | no ordinary mutation | yes | no local recalculation | announcedVariables | `COPY_LATER` | copy retains X | copyable-values derivation is deferred |
| 23 | spell copy | copy placement | copied cost decisions | 707.10 | no ordinary mutation | yes as copied decision | no payment re-run here | costChoices | `COPY_LATER` | copy retains cost choices | payment is never stored |
| 24 | spell copy | copy placement | whether new targets are chosen | 707.10c | controlled by copying effect | copy rule boundary | target legality later | targetSelections replacement boundary | `COPY_LATER` | choose-new-targets boundary | no implementation here |
| 25 | any stack object | after commitment | explicit retarget request | 115.1, 707.10c | only future command/effect | depends on copy rule | new legality later | immutable record replacement | `COMMAND_LATER` | retarget effect | O4P-01J owns mutation API |
| 26 | mana ability | activation | no ordinary stack announcement | 605.3-4, 602.2 | not applicable | no | no | none | `OUT_OF_SCOPE` | mana ability does not create ordinary stack object | payment/transaction is deferred |
| 27 | static ability | continuous effect | no stack announcement | 604, 405.6 | not applicable | no | not applicable | none | `OUT_OF_SCOPE` | static ability excluded | no stack object is created |
| 28 | card spell | failed proposal or legality | no committed record | 601.2a-e | rollback before commitment | no | not applicable | none | `COMMAND_LATER` | failed casting proposal leaves no record | proposal/rollback is another transaction |
| 29 | activated ability | failed proposal or legality | no committed record | 602.2a-b | rollback before commitment | no | not applicable | none | `COMMAND_LATER` | failed activation proposal leaves no record | no pending payment state |
| 30 | any supported stack kind | after complete placement | all committed structural choices | 405.1-4, 601.2i, 602.2, 603.3, 707.10 | record replaced only by explicit future effect | kind-specific | future resolver rechecks as applicable | exact byObject record | `STRUCTURE_V1` | mixed stack fully committed | object and record lifecycle are atomic in a future milestone |

## 15. DEFER

- Exact TypeScript type/property names, ID formats, object-incarnation scheme, and export surface.
- Proposal/payment transaction state, rollback/undo command shape, priority, and legality engine.
- Target eligibility computation, retargeting, zone-change repair, and CR 608 resolution.
- Copyable-values derivation, copy execution, new-target UI, and copy-origin mechanics.
- APNAP command orchestration beyond recording the committed order.
- Ability text snapshot encoding, projection, online protocol, persistence, UI, and game-restart implementation.

## 16. Contradictions

1. CR 601.2 calls casting one operation but separates proposal (601.2a–d), legality (601.2e), cost determination/payment (601.2f–h), and “cast” status (601.2i). The contract therefore stores only the post-commit result; it must not imply that proposal equals commitment.
2. CR 603.2 says triggering changes nothing immediately, while 603.3 later creates/places the stack object. A pending-trigger record and a committed stack record are distinct lifecycle facts.
3. CR 707.10 copies announced decisions but excludes resolution-time choices. A single undifferentiated “choices” bag would be semantically contradictory; fields must retain the boundary without deciding the eventual copyable-values API.
4. CR 608.2b rechecks targets, while 601.2c/602.2b/603.3d choose them earlier. Stored target identity is therefore historical input, not a legality verdict.
5. CR 601.2d fixes division among targets, whereas 608.2d chooses distribution among untargeted recipients during resolution. “Distribution” cannot be one timing category.
6. CR 405.3 allows APNAP ordering for simultaneous placement, while the existing stack is bottom-to-top. The payload may record the resulting committed relation, but this draft does not authorize a second stack-order representation.
