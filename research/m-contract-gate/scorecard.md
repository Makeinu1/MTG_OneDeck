# M-CONTRACT Gate Scorecard

Generated: 2026-06-25T13:40:37.869Z

## Conditions

| ID | Condition | Status | Value | Threshold | Unverifiable | Source | Note |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- |
| 1 | Slice1-4 complete | PASS | - | - | 0.00% | docs/engine-state-ontology.md | Slice1-4 完了(commit 3e220e7) |
| 2 | Head coverage | PASS | 92.45% | 90.00% | 0.00% | research/layer-coverage/report.json, research/event-coverage/report.json, research/zone-coverage/report.json, research/timing-coverage/report.json | escape-box-free: oracle-gated(真の被覆は条件3/7 へ委ねる) |
| 3 | Model churn | FAIL | 11.86% | 5.00% | 0.00% | research/layer-coverage/report.json, research/event-coverage/report.json, research/zone-coverage/report.json, research/timing-coverage/report.json | 下面抽出単独 churn=§4 では弱い陽性のみ。post-independent-yardstick churn は per-slice oracle log 参照 |
| 4 | Non-LLM independent yardstick | BLOCKED | - | - | 0.00% | research/cr-conformance-audit.md | CR真理テーブル/cr-conformance-audit.md を代表カード集合へ体系化=M-GATE-2 |
| 5 | Golden replay (deck-weighted) | PASS | 88.89% | 70.00% | 0.00% | research/golden-replay/cases | total=32, pass=32, verified=24, pureScopeBoundary=5, runtimeGap=3, inScope=27, verifiedInScopeRate=88.89%, perDeck(total/verified/pureScopeBoundary/runtimeGap): Celes=8/6/1/1, Gogo=8/6/1/1, Kefka=8/6/2/0, Muldrotha=8/6/1/1; remaining runtime-gap: Celes / Karmic Guide ETB candidate[src/engine/commands.ts: guidedPlanForStackTop / eligibleTargets: The replay can emit Karmic Guide's ETB candidate, but guided target selection cannot choose a creature card in the graveyard and apply the return command.]; Gogo / Displacer Kitten watches a noncreature cast[src/engine/commands.ts: guidedPlanForStackTop / eligibleTargets: The cast watcher is detected, but the replay cannot yet answer the guided target prompt and execute Displacer Kitten's exile-and-return sequence.]; Muldrotha / Tatyova landfall stack resolution[src/engine/grammar/index.ts: classifyAbilityShape / src/engine/grammar/compile.ts: compileAbilityIR: The ability-word-prefixed landfall line is classified as static during stack resolution, so the otherwise auto-capable gain-life and draw atoms do not execute.] |
| 6 | Classifier parity | PASS | 0.00% | 0.00% | 0.00% | research/classifier-parity/report.json | 研究分類器と runtime 分類器の乖離解消=M-GATE-2 |
| 7 | Unverifiable rate | PASS | 2.44% | 10.00% | 2.44% | research/llm-oracle/report.json, research/event-oracle/report.json, research/zone-oracle/report.json, research/timing-oracle/report.json | max=5.82%; per-oracle: layer=0.00%(n=192), event=2.46%(n=203), zone=5.82%(n=189), timing=1.53%(n=196); golden-replay 検証不能は条件5へ分離 |

## Head Coverage

- Aggregate: 92.45%
- Threshold: 90.00%

| Axis | Escape box | Total | Escape frequency | Coverage | Oracle-gated |
| --- | --- | ---: | ---: | ---: | --- |
| event-family | other | 9791 | 739 | 92.45% | no |
| timing-juncture | other | 1129 | 9 | 99.20% | no |
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

## Verdict

**NOT FROZEN**

