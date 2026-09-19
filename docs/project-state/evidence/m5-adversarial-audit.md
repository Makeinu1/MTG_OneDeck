# M5.5 Adversarial / Destructive Audit

Status: candidate audit specification/evidence index  
Authority: none  
Production mutation: none

M5.5 executes only isolated fixtures or read-only inspections. The audit intentionally injects the approved fourteen failure classes and expects each unsafe state to fail closed.

| # | Injected fault | Expected guard |
|---|---|---|
| 1 | changed but unowned runnable test | changed-test self-selection + full escalation |
| 2 | deleted test | unrunnable changed-test full escalation |
| 3 | renamed test | old path full escalation + new path self-selection |
| 4 | stale legacy overlay itemKey | legacy decision binding rejection |
| 5 | generated inventory drift | deterministic generated output mismatch |
| 6 | missing workflow marker | workflow bundle referential integrity |
| 7 | missing workflow patch | workflow bundle referential integrity |
| 8 | unclassified write-capable legacy workflow | exact workflow inventory / write-owner guard |
| 9 | hidden/missing evidence consumer | evidence consumer graph |
| 10 | non-merged branch auto-retirement attempt | merged same-repo exact-head branch hygiene boundary |
| 11 | historical authorization replay | NON-REPLAYABLE guard |
| 12 | stale Work Order planningBase | M4 planning snapshot validation |
| 13 | old green evidence reused on changed candidate | recovery receipt/candidate freshness block |
| 14 | compatibility asset retirement while retained path/consumer exists | COMPATIBILITY retention guard |

The pass condition is not that the injected candidates become green. The pass condition is that every unsafe injected condition is detected and rejected by the named guard without mutating main, deployed runtime, or persisted production state.
