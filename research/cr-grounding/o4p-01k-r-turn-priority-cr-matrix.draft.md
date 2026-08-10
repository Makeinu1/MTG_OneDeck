# O4P-01K Turn / Priority CR Procedure Matrix

- Status: `analyzed-not-integrated`
- Role: independent Requirements Analyst
- Milestone: O4P-01K
- Analysis base: `PLAN_SHA=04e3268c0ca8e884153728590e0c2248a8edb458`
- Rules authority: pinned local `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, effective 2026-06-19
- Scope boundary: additive, mode-neutral turn/phase/step, priority, pass, SBA/trigger checkpoint, cleanup, and turn-rotation grounding only.
- This draft chooses no TypeScript names, public exports, command/event shape, UI behavior, concrete SBA catalogue, trigger detector, combat engine, effect resolver, or serialization form.

## 1. Purpose and 21-section reading order

This matrix is a procedure contract input, not an implementation contract. Sections 1–21 are intentionally ordered from global procedure to turn advance and deferrals. The 36 rows K-01–K-36 are the complete scenario set for this grounding lane.

## 2. Ruleset and source hierarchy

Deterministic claims use only the pinned local CR. Prior O4P-01G/H/I/J contracts constrain integration boundaries but do not override CR meaning. O4P-01G supplies zone-transition/new-object boundaries; O4P-01H supplies the sole active-player/turn-order registry authority; O4P-01I supplies pending-versus-placed trigger distinction; O4P-01J supplies atomic stack transaction reuse.

## 3. Classification vocabulary

`STRUCTURE_V1` means a deterministic turn/phase/step/rotation or non-stack structural boundary. `CHECKPOINT_V1` means the priority opportunity and its fixed-point/pass/stack-readiness procedure. `EFFECT_LATER` means the boundary is known but the effect's concrete execution is deferred. `COMBAT_LATER` means combat-specific procedure or result is intentionally deferred. `OUT_OF_SCOPE` means no O4P-01K state or execution claim is permitted.

## 4. Universal procedure invariant

At every priority opportunity, the engine must apply the CR order: perform applicable SBAs as one event; repeat until none; put waiting triggered abilities on the stack; repeat the SBA/trigger cycle until stable; then give priority to the player prescribed by the turn/stack rule. No priority is granted during resolution or during a no-priority step. A phase/step with priority ends only when its stack is empty and all players pass in succession.

## 5. Turn and phase sequence

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-01 | turn boundary | previous turn complete | advance to next turn | beginning phase / untap | no-priority step | empty or resolved; no object may remain unresolved | rotate to next seated player in turn order | none during transition; untap later has none | 500.1, 502.4, 117.3a | STRUCTURE_V1 | two-player and four-player rotation | Active player is read from O4P-01H authority; do not duplicate it. |
| K-02 | phase boundary | current phase ended | enter the next normal phase | next phase's first step | phase-begin boundary | stack empty and consecutive passes completed | unchanged until turn ends | granted only at the prescribed step | 500.1-2, 500.12 | STRUCTURE_V1 | full normal turn skeleton | No game event exists between phases. |

## 6. Beginning phase

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-03 | beginning phase | phase start | enter beginning phase | untap step | no-priority | stack is empty | remains active player | none in untap | 501.1, 502.4 | STRUCTURE_V1 | beginning→untap transition | Beginning-of-phase triggers wait for next priority opportunity. |
| K-04 | beginning phase | after untap | advance after untap actions | upkeep step | priority checkpoint | no unresolved stack object | unchanged | held untap triggers are placed before active player priority | 502.1-4, 503.1-1a | CHECKPOINT_V1 | untap trigger carryover and upkeep priority | No trigger is placed at the instant it triggers. |

## 7. Untap and other no-priority steps

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-05 | untap step | turn-based actions | perform phasing/day-night/untap actions | upkeep step | first priority checkpoint | no spells or abilities resolve in untap | makes untap choices where required | none during untap | 502.1-4, 703.4a-c, 117.2c | STRUCTURE_V1 | assert no priority/cast/activation | Concrete phasing/day-night semantics are not implemented here. |
| K-06 | no-priority step | specified actions incomplete | reject attempted cast, activation, or resolution | same step | still no-priority | stack remains unavailable | no player action window | no priority | 500.3, 117.2c | OUT_OF_SCOPE | negative boundary test | The prohibition is CR fact; action validation is later. |

## 8. Upkeep and draw

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-07 | upkeep step | step start | place untap/upkeep triggers | upkeep step | priority checkpoint | trigger placement completes before priority | remains active player | active player receives priority after fixed point | 503.1-1a, 117.3a, 117.5 | CHECKPOINT_V1 | held-trigger placement then AP priority | Trigger detection itself is deferred. |
| K-08 | draw step | step start | draw turn-based action | draw step | priority checkpoint | draw does not use stack | active player draws once | active player receives priority after action/fixed point | 504.1-2, 703.4d, 117.3a | CHECKPOINT_V1 | draw-before-priority ordering | Library/draw legality is outside this slice. |

## 9. Main phase

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-09 | precombat main | phase start | perform main-phase turn-based actions | precombat main | priority checkpoint | stack empty for land play; otherwise normal stack rules | active player may make permitted main-phase action | active player receives priority | 505.2-6, 703.4e-g, 117.3a | CHECKPOINT_V1 | main-phase priority and land-action gate | Card timing/land legality is not implemented. |
| K-10 | postcombat main | phase start | enter second main phase | postcombat main | priority checkpoint | stack empty at phase end | active player remains active | active player receives priority | 505.1-2, 505.6, 117.3a | CHECKPOINT_V1 | combat skipped still yields postcombat main | Do not infer “second” from total-game phase count. |

## 10. Phase/step ending by passes

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-11 | priority-bearing step | stack empty | all players pass in succession | next step/phase | transition | stack must be empty | active player unchanged unless turn rotates | no further priority in ended step | 500.2, 117.4 | CHECKPOINT_V1 | empty-stack all-pass termination | Empty stack alone must not advance. |
| K-12 | priority-bearing step | stack nonempty | all players pass in succession | same step | resolution boundary | top object resolves; stack need not be empty before resolution | active player unchanged | after resolution, fixed point then priority | 117.3b-4, 608.1 | CHECKPOINT_V1 | top resolution-ready transition | Actual effect resolution is EFFECT_LATER. |

## 11. Priority assignment and pass state

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-13 | most steps | after turn-based action | grant initial priority | same step | player action window | actions complete; fixed point clean | active player is first recipient | active player receives priority | 117.3a, 117.5 | CHECKPOINT_V1 | initial priority recipient | Untap and normal cleanup exceptions remain excluded. |
| K-14 | any priority window | after cast/activation/special action | return priority to actor | same step | next priority | committed stack object if applicable | actor remains current controller | actor receives priority again | 117.1, 117.3c | CHECKPOINT_V1 | priority-after-action | O4P-01J commit may be reused, but legality/payment are later. |
| K-15 | any priority window | player declines action | pass and advance recipient | same step | next player's window | no stack mutation from pass | active player unchanged | next player in turn order receives priority | 117.3d | CHECKPOINT_V1 | pass rotation and mana announcement boundary | Mana announcement is not mana creation. |

## 12. SBA fixed point

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-16 | before priority | priority would be granted | check and perform all applicable SBAs simultaneously | same checkpoint | repeat SBA check | no priority during SBA event | no player controls SBA | priority withheld | 117.2d, 117.5, 704.1-3 | CHECKPOINT_V1 | no priority between SBA iterations | Concrete condition catalogue remains deferred. |
| K-17 | SBA checkpoint | an SBA was performed | repeat SBA check | same checkpoint | trigger checkpoint or another SBA | stack unchanged by SBA itself unless later placement | unchanged | still no priority | 704.3 | CHECKPOINT_V1 | fixed point requires zero SBA event | “Fixed point” means no applicable SBA, not no state changes ever. |
| K-18 | SBA checkpoint | no SBA performed | proceed to waiting-trigger placement | same checkpoint | trigger placement | pending triggers may be placed | unchanged | still withheld until trigger cycle ends | 704.3, 117.5 | CHECKPOINT_V1 | SBA→trigger ordering | Do not skip trigger placement when pending triggers exist. |

## 13. Trigger placement checkpoint

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-19 | before priority | waiting triggers exist | place triggered abilities as stack objects | same step | post-placement fixed point | each placed ability becomes topmost stack object | controller fixed at trigger time except delayed-trigger rule | no priority until repeat cycle is stable | 117.2a, 117.5, 603.3 | CHECKPOINT_V1 | pending→placed boundary | O4P-01I record and O4P-01J atomic commit are reusable structural inputs. |
| K-20 | trigger placement | multiple ordinary triggers | apply first APNAP bucket | same step | second bucket or fixed point | stack order is bottom-to-top result of placement | each controller orders own bucket | no priority | 603.3a-b, 405.3, 101.4 | CHECKPOINT_V1 | two-bucket placement | The two-part ordinary/ability-triggered process must not be flattened. |
| K-21 | trigger placement | modal/targeted trigger | announce mode/targets/division while placing | same step | post-placement fixed point | illegal trigger is removed, not committed | controller makes required choices | no priority | 603.3c-d, 601.2c-d | EFFECT_LATER | choice-needed and no-legal-choice cases | Choice legality and target predicates are later responsibilities. |

## 14. APNAP ordering

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-22 | simultaneous choices | APNAP collection | active player chooses first; if a nonactive choice creates an outstanding choice for an earlier player, restart APNAP for that choice | same procedure | restarted outstanding-choice window | no priority while choices are collected | active player participates again when CR requires restart | none | 101.4, 101.4d | STRUCTURE_V1 | three-player APNAP order plus dependent-choice restart | Do not linearize CR 101.4d as one pass through players. |
| K-23 | trigger placement | controller buckets | order each controller's triggers APNAP | same step | fixed-point check | all selected abilities become one ordered stack | active player bucket processed first, stack top reflects reverse placement chronology | none | 101.4, 603.3b, 405.3 | CHECKPOINT_V1 | active/nonactive multi-trigger ordering | Preserve explicit within-controller choice order; do not sort it. |

## 15. Resolution-ready boundary

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-24 | priority window | all players passed in succession | mark top stack object resolution-ready | resolution boundary | resolving object | top object exists | unchanged | no priority during resolution | 117.4, 117.2e, 608.1 | CHECKPOINT_V1 | nonempty-stack resolution readiness | This does not execute effects or choose resolution-time choices. |
| K-25 | resolution boundary | object finished resolving | remove/move resolved object per supplied later result | same step | post-resolution checkpoint | resolved object no longer blocks next top | unchanged | fixed point, then priority to active player | 117.3b, 608.2m-n, 608.3 | EFFECT_LATER | post-resolution priority | Destination and effect semantics remain later; O4P-01J can supply structural exit. |

## 16. Combat phase structure

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-26 | combat phase | phase start | enter beginning of combat | beginning of combat step | priority checkpoint | normal priority boundary | active player is attacking player | active player priority after required choices/triggers | 506.1-2, 507.1, 703.4h, 117.3a | COMBAT_LATER | combat-step skeleton only | Defending-player selection is a combat action, not implemented. |
| K-27 | declare attackers step | step start | declare attackers | declare blockers or skip | priority checkpoint or skip boundary | declaration is turn-based and non-stack | active player declares | active player priority after fixed point | 506.1, 508.1, 703.4i, 117.3a | COMBAT_LATER | attacker declaration boundary | Attack legality and combat state are later. |
| K-28 | declare blockers step | step start | declare blockers | combat damage or skip | priority checkpoint or skip boundary | declaration is turn-based and non-stack | defending player declares | active player priority after fixed point | 506.1, 509.1-2, 703.4j | COMBAT_LATER | blocker declaration and no-attacker skip | No blockers/combat damage step when combat is skipped under CR 506.1. |
| K-29 | combat damage step | step start | assign/deal combat damage | end of combat or second damage step | priority checkpoint | assignment/dealing do not use stack | APNAP assignment; damage simultaneous | active player priority after damage/fixed point | 506.1, 510.1-3, 703.4k,m | COMBAT_LATER | first/double strike boundary | Actual assignment, damage, and resulting SBAs are deferred. |

## 17. Ending phase and end-of-combat boundary

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-30 | end of combat step | priority window | complete end-of-combat step | postcombat main | priority checkpoint | empty stack plus consecutive passes | unchanged | next active-player priority in postcombat main | 506.1, 511.1, 117.4 | COMBAT_LATER | combat→postcombat transition | Combat removal and end-of-combat effects are later. |
| K-31 | ending phase | end step complete | enter cleanup | cleanup step | exceptional/no-priority window | normally empty; exceptional stack may arise | active player unchanged | normally none | 500.1, 513.1, 514.1, 117.3a | STRUCTURE_V1 | end→cleanup transition | End-step trigger placement is a normal priority checkpoint before cleanup. |

## 18. Cleanup exceptional repeat

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-32 | cleanup step | first cleanup actions | discard to maximum, remove damage, end until-end-turn effects | cleanup step | exceptional check | no stack normally | active player performs discard; simultaneous cleanup actions | no priority if no SBA/triggers | 514.1-3, 703.4n,p | STRUCTURE_V1 | normal cleanup no-priority completion | Duration expiry and mana emptying are distinct boundaries. |
| K-33 | cleanup step | SBA/trigger condition present | perform SBA/put triggers on stack and grant priority | another cleanup step | priority window then repeat | stack may be nonempty exceptionally | active player receives priority | players may act; after empty/all-pass begin another cleanup | 514.3a, 704.3, 117.4-5 | CHECKPOINT_V1 | exceptional cleanup repeat until clean | Must not end the turn after one exceptional cleanup pass. |

## 19. Mana emptying and duration boundaries

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-34 | any phase/step end | end boundary | expire end-of-step effects, then empty all players' unspent mana | next step/phase | its prescribed window | no stack use | mana pools become empty | no intervening priority | 500.4-5, 703.4q | STRUCTURE_V1 | mana empties before next window | Mana ability execution and mana restrictions are later. |
| K-35 | combat/turn end | duration boundary | expire “until end of combat” or “until end of turn/this turn” effects | next specified boundary | next checkpoint or cleanup | expiration is non-stack | unchanged | priority only after applicable checkpoint | 500.4-5a-b, 514.2, 703.4p | STRUCTURE_V1 | exact duration timing | Do not expire end-of-combat effects at beginning of end-combat step. |

## 20. Extra and skipped boundaries

| Scenario ID | Current phase/step | Current window | Operation | Next phase/step | Next window | Stack requirement | Active player result | Priority result | Governing CR | O4P-01K classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K-36 | turn/phase/step schedule | effect has added/skipped unit | apply supplied extra-turn/phase/step or skip marker | scheduled next existing/extra unit | that unit's prescribed window | schedule mutation is not itself a stack object | extra turns use insertion order; skipped unit is passed as though nonexistent | priority follows resulting unit, not skipped unit | 500.7-11, 500.10a, 614.10 | STRUCTURE_V1 | multiple extra units, most-recent-first, skip combat/turn | Effect creation, permission, and schedule-producing resolution are EFFECT_LATER. |

## 21. Coverage, findings, and DEFER ledger

Coverage count: K-01–K-36 = 36 scenarios; sections 1–21 = 21 sections. The matrix covers turn sequence, no-priority steps, turn-based checkpoints, SBA fixed point, trigger placement, APNAP, resolution-ready, cleanup exceptional repeat, mana emptying, duration boundaries, combat-later boundaries, and extra/skipped boundaries.

### CR findings

- CR fact: 117.5 orders SBA fixed-point checking before trigger placement and priority; 704.3 gives the same repeated procedure and its cleanup exception.
- CR fact: 603.3a fixes triggered-ability controller at trigger time except delayed-trigger rules; 603.3b uses two APNAP placement parts; 603.3c-d apply choices and remove an unplaceable trigger.
- CR fact: 500.2 requires an empty stack plus successive passes to end a priority-bearing phase/step; 117.4 makes successive passes resolve the top object when the stack is nonempty.
- CR fact: 500.3/502.4/514.3 distinguish no-priority steps; 514.3a is the exceptional cleanup repeat.
- CR fact: 500.4-5 and 703.4q/p establish duration expiry and mana emptying at the relevant boundary; 500.7-11 establish extra and skipped turn/phase/step schedule semantics.
- CR fact: 506.1 and 703.4h-k,m define combat sequence and turn-based combat actions; this lane does not automate combat.

### Implementation DEFERs

- DEFER: concrete SBA condition evaluation and resulting zone/state changes; only the fixed-point checkpoint is `CHECKPOINT_V1`.
- DEFER: trigger detection, trigger subscriptions, source look-back, delayed/reflexive trigger creation, and target/mode legality; only placement order and boundary are grounded.
- DEFER: full spell/ability effect resolution, replacement/prevention effects, resolution-time choices, and destination selection; `EFFECT_LATER` records only the readiness boundary.
- DEFER: combat legality, attack/block assignment, damage assignment, combat damage, first/double strike semantics, and combat-trigger detection; rows are `COMBAT_LATER`.
- DEFER: mana production/payment and priority-time mana abilities; this matrix only records pool emptying.
- DEFER: extra-turn/phase/step effect creation, control/permission, and schedule-producing resolution; only supplied schedule application is `STRUCTURE_V1`.
- DEFER: lifecycle field names, TypeScript names, public exports, command/event/replay envelopes, Solo integration, UI, Online, Cloudflare, package scripts, ledger, docs, review tests, and git/release operations.

### Read-only verification report

- Exact writable output: `research/cr-grounding/o4p-01k-r-turn-priority-cr-matrix.draft.md`.
- Read-only checks performed: `rg`/`sed` extraction of the pinned CR clauses and prior O4P-01G/H/I/J drafts; count/structure inspection of this draft after writing.
- No code, docs, `AGENTS.md`, ledger, package files, machine-checks, or `review.*` files were modified. No git command was used.
- Independent grounding result: no CR-irreducible ambiguity found for the requested procedure boundaries. Implementation remains `analyzed-not-integrated` pending judge adjudication and contract freeze.
