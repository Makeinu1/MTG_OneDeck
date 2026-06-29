# M-CONTRACT Gate Scorecard

Generated: 2026-06-29T15:38:50.182Z

## Conditions

| ID | Condition | Status | Value | Threshold | Unverifiable | Source | Note |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- |
| 1 | Slice1-4 complete | PASS | - | - | 0.00% | docs/engine-state-ontology.md | Slice1-4 完了(commit 3e220e7) |
| 2 | Head coverage | PASS | 91.81% | 90.00% | 0.00% | research/layer-coverage/report.json, research/event-coverage/report.json, research/zone-coverage/report.json, research/timing-coverage/report.json | escape-box-free: oracle-gated(真の被覆は条件3/7 へ委ねる) |
| 3 | Model churn | PASS | 1.95% | 5.00% | 0.00% | research/layer-coverage/report.json, research/event-coverage/report.json, research/zone-coverage/report.json, research/timing-coverage/report.json | post-independent-yardstick(§34.7.5): CR-conformance 裁定後・baseline=churnBaselineCommit に対し4スライス同時測定。perSlice churn: layer=0.00%, event=1.95%, zone=0.00%, timing=0.82% |
| 4 | Non-LLM independent yardstick | PASS | 100.00% | 95.00% | 0.00% | research/cr-conformance/report.json | inScope=160, conformant=160, divergent=0, scopeBoundary=0, perAxis(inScope/conformant/divergent): event-family=40/40/0, layer=40/40/0, timing=40/40/0, zone-transition=40/40/0; bounded=true |
| 5 | Golden replay (deck-weighted) | PASS | 88.89% | 70.00% | 0.00% | research/golden-replay/cases | total=32, pass=32, verified=24, pureScopeBoundary=5, runtimeGap=3, inScope=27, verifiedInScopeRate=88.89%, perDeck(total/verified/pureScopeBoundary/runtimeGap): Celes=8/6/1/1, Gogo=8/6/1/1, Kefka=8/6/2/0, Muldrotha=8/6/1/1; remaining runtime-gap: Celes / Karmic Guide ETB candidate[src/engine/commands.ts: guidedPlanForStackTop / eligibleTargets: The replay can emit Karmic Guide's ETB candidate, but guided target selection cannot choose a creature card in the graveyard and apply the return command.]; Gogo / Displacer Kitten watches a noncreature cast[src/engine/commands.ts: guidedPlanForStackTop / eligibleTargets: The cast watcher is detected, but the replay cannot yet answer the guided target prompt and execute Displacer Kitten's exile-and-return sequence.]; Muldrotha / Tatyova landfall stack resolution[src/engine/grammar/index.ts: classifyAbilityShape / src/engine/grammar/compile.ts: compileAbilityIR: The ability-word-prefixed landfall line is classified as static during stack resolution, so the otherwise auto-capable gain-life and draw atoms do not execute.] |
| 6 | Classifier parity | PASS | 0.00% | 0.00% | 0.00% | research/classifier-parity/report.json | 研究分類器と runtime 分類器の乖離解消=M-GATE-2 |
| 7 | Unverifiable rate | PASS | 2.44% | 10.00% | 2.44% | research/llm-oracle/report.json, research/event-oracle/report.json, research/zone-oracle/report.json, research/timing-oracle/report.json | max=5.82%; per-oracle: layer=0.00%(n=192), event=2.46%(n=203), zone=5.82%(n=189), timing=1.53%(n=196); golden-replay 検証不能は条件5へ分離 |

## Head Coverage

- Aggregate: 91.81%
- Threshold: 90.00%

| Axis | Escape box | Total | Escape frequency | Coverage | Oracle-gated |
| --- | --- | ---: | ---: | ---: | --- |
| event-family | other | 10060 | 824 | 91.81% | no |
| timing-juncture | other | 1274 | 10 | 99.22% | no |
| zone-scope | unknown | 17138 | 166 | 99.03% | no |
| layer | - | 17491 | 0 | oracle-gated | yes |
| zone-axis | - | 25541 | 0 | oracle-gated | yes |
| timing-castTiming | - | 17504 | 0 | oracle-gated | yes |

## Unverifiable Rate

- Weighted mean: 2.44%
- Maximum: 5.82%
- Ceiling: 10.00%

| Oracle | Sample size | Rate |
| --- | ---: | ---: |
| layer | 192 | 0.00% |
| event | 203 | 2.46% |
| zone | 189 | 5.82% |
| timing | 196 | 1.53% |

## CR-grounding Overlay

- CR version: 2026-06-19
- Overlay status: ready-for-fable-review

| ID | Name | Status | Freeze treatment | Evidence | Remaining boundary |
| --- | --- | --- | --- | --- | --- |
| CRG-1 | CR 2026-06-19 fixed | PASS | required-pass | rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json, research/cr-grounding/README.md | - |
| CRG-2 | CR-grounded golden cases defined | PASS | required-pass | research/cr-grounding/golden-cases.json | - |
| CRG-3 | Commander tax CR 903.8 | PASS | required-pass | src/engine/__tests__/m431.test.ts, src/store/__tests__/review.m431.test.ts, research/cr-grounding/golden-cases.json#cr-commander-tax-cast-not-return | - |
| CRG-4 | Mana abilities CR 605 | PARTIAL | partial-allowed-only-if-605-1b-is-s-carry | src/engine/__tests__/review.g4-activate.test.ts, research/cr-grounding/mana-ability-substrate.md | Triggered mana abilities CR 605.1b/605.4a are not implemented and must not be reported as PASS. |
| CRG-4.5 | Commander zone choice CR 903.9a/b | PARTIAL | partial-allowed-only-if-generic-rule-choice-is-s-carry | src/store/__tests__/crGrounding.test.ts, src/components/playmat/Playmat.test.tsx, research/cr-grounding/rule-choice-substrate.md | 903.9a bridge is implemented, but generic pendingRuleChoices/deferred SBA choice UI are S-CHOICE carry. |
| CRG-5 | Token death before token cease CR 111.7/704.5d | PASS | required-pass | src/store/__tests__/crGroundingGoldenCases.test.ts#cr-token-dies-before-ceases, research/cr-grounding/golden-cases.json#cr-token-dies-before-ceases | - |
| CRG-6 | Triggered abilities, SBA, priority CR 603/704/117 | PARTIAL | partial-allowed-only-if-second-bucket-and-full-sba-are-s-carry | src/store/__tests__/crGroundingGoldenCases.test.ts#cr-trigger-sba-priority-loop, research/cr-grounding/priority-event-loop.md, research/cr-grounding/sba-inventory.md | 603.3b second bucket and full SBA suite are not implemented and must not be reported as PASS. |
| CRG-7 | Zone movement and LKI CR 400.7/603.10a | PASS(core) | core-pass-only | src/store/__tests__/crGroundingGoldenCases.test.ts#cr-zone-change-new-object-lki, research/cr-grounding/scope-partition.md | CR 400.7 exceptions and full effective-characteristics snapshots are S-* carry. |
| CRG-8 | 2026-06-19 new vocabulary | PASS(boundary) | boundary-pass-only | research/cr-grounding/golden-cases.json#cr-20260619-new-mechanics-boundary, research/cr-grounding/scope-partition.md | Heal/Power-up/Teamwork/Preparation executors are scope-boundary and must not be reported as implemented. |

## R-FREEZE Designs

| ID | Status | Artifact | Decision direction |
| --- | --- | --- | --- |
| R-FREEZE-1 | drafted | research/cr-grounding/rule-choice-substrate.md | Generalize pendingSbaChoices into pendingRuleChoices. |
| R-FREEZE-2 | drafted | research/cr-grounding/priority-event-loop.md | Add PendingTrigger.stackPlacementBucket and order as bucket -> APNAP -> controller choice. |
| R-FREEZE-3 | drafted | research/cr-grounding/mana-ability-substrate.md | Keep triggered mana abilities out of normal pendingTriggers and resolve inside mana transactions. |
| R-FREEZE-4 | drafted | research/cr-grounding/scope-partition.md | Classify remaining unimplemented CR areas as S-* carry, scope-boundary, or PASS(core). |


## Verdict

- Legacy seven-condition verdict: FROZEN
- CR-grounding overlay: APPROVED
**FROZEN**

> M-CR-RECONCILE overlay is included. `PARTIAL`, `PASS(core)`, and `PASS(boundary)` are not plain PASS; remaining boundaries are displayed below and must remain out of green coverage.

