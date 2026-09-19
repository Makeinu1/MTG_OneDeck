# M6 — Closed Execution Loop Plan

Status: Owner-approved design record for M6 implementation  
Authority: process design only; this file is not Product Truth, Project State NOW, semantic authority, verification PASS, or external-write permission.

## 1. Purpose

M6 connects the existing M0–M5 capabilities into a bounded closed execution loop so an LLM can safely continue or stop work without inventing a second source of truth.

M6 owns only one decision:

> Can this execution continue?

M6 does not own Product priority, semantic meaning, verification truth, repository NOW, recovery truth, or write authority.

## 2. Existing owners

| Question | Owner |
| --- | --- |
| What should the product achieve? | M0 Product Truth |
| What is current NOW / active milestone / next gate? | M1 Project State |
| What semantics and dependencies apply? | M2 Contract Architecture |
| What evidence is required and fresh? | M3/M3.1 Verification Harness |
| What bounded work is requested? | M4/M4.1 Work Protocol |
| What can be resumed, retired, rescued, or quarantined? | M5 Audit / Hygiene / Recovery |
| May execution continue? | M6 |

M6 must not duplicate those authorities.

## 3. Runtime protocol

M6 uses six protocol phases:

```
ADMIT
  ↓
PREPARE
  ↓
EXECUTE
  ↓
PROVE
  ↓
RECONCILE
  ↓
CLOSE
```

These are protocol phases, not a durable state machine. M6 must not create a canonical `current-loop-state.json`, work queue, semantic registry, evidence registry, or second Project State.

### ADMIT

Read current Project State, Work Order, relevant contracts/dependencies, verification controls, M5 recovery/hygiene state, and Git reality.

A Work Order is not admitted when:
- M1 does not permit the work;
- M4 planning validation fails;
- relevant authority is stale or contradictory;
- required M5 recovery/hygiene capability is unavailable;
- the requested automation surface is not within the reviewed CR-15 boundary.

M6 never invents the next Work Order.

### PREPARE

Resolve the exact planning base, isolated workspace/candidate, relevant authority, semantic impact, M3 verification plan, and protected boundaries.

M6 does not prescribe the implementation algorithm. It constrains observable scope and evidence.

### EXECUTE

One writer owns the candidate. Verifiers and auditors are read-only.

Executor claims such as "done", "tested", or "safe" do not advance the lifecycle.

### Candidate freeze

Verification always binds to an exact candidate. Any repair produces a new candidate and invalidates evidence that is no longer applicable.

### PROVE

M6 delegates test/evidence selection and freshness to M3/M3.1. It must not substitute its own verification selection.

Objective evidence is preferred:
- compiler/type checks;
- deterministic tests;
- browser/runtime observations;
- static architecture guards;
- exact candidate-bound evidence.

Independent LLM audit is added only for AGENTS.md high-risk categories.

### RECONCILE

A failed check is diagnosed before production repair. Runtime diagnosis may classify failure as:
- REAL_REGRESSION
- STALE_TEST
- STALE_FIXTURE
- INFRA_FAILURE
- FLAKY_SUSPECTED
- MANUAL_EVIDENCE_MISSING
- EXPECTED_AUTHORIZED_CHANGE
- UNKNOWN_FAILURE

The classification is run-local evidence, not a durable truth registry.

UNKNOWN_FAILURE stops. FLAKY_SUSPECTED must not trigger speculative production changes.

### CLOSE

Before closing, compare the frozen candidate with latest main and current relevant authority/dependency state.

A candidate closes only when current evidence still applies.

## 4. Terminal result vocabulary

M6 uses exit results rather than a persistent runtime state machine:

- COMPLETE
- NO_CHANGE_REQUIRED
- MANUAL_EVIDENCE_REQUIRED
- OWNER_DECISION_REQUIRED
- UNKNOWN_COVERAGE
- STALE_REPLAN_REQUIRED
- RECOVERY_REQUIRED
- BUDGET_EXHAUSTED
- ABORTED

`COMPLETE` means only that the Work Order is complete for the exact candidate and required evidence. It never means Product complete, semantic MATCH, milestone complete, deployment authorized, or next work selected.

## 5. Single-writer and parallelism

Default execution is serial with a single candidate writer.

Parallel work is allowed only when:
- separate Work Orders exist;
- separate isolated candidates exist;
- M2 dependency inspection supports independence;
- no shared mutable candidate exists.

Different files alone do not prove semantic independence.

## 6. Recovery and partial success

M6 consumes M5 recovery pointers. It does not create a second recovery registry.

Recovery may reconstruct:
- Work Order reference/hash;
- planning base;
- candidate branch/head/fingerprint;
- canonical pointers;
- evidence references;
- unresolved review references.

Recovery never grants rollback, push, merge, deploy, branch deletion, or semantic authority.

Partial work may remain resumable when exact candidate/evidence bindings are still valid. Otherwise M6 returns REPLAN or RECOVERY_REQUIRED.

## 7. Product outcome revalidation

Child Work Order success must not be substituted for the original Product outcome.

Original outcome revalidation is required at:
- parent Work Order closeout;
- milestone closeout;
- user-originated UX problem closeout.

Repeated closure of the same Product symptom followed by the same user-reported problem requires structural re-planning rather than another automatic local patch.

## 8. Convergence observations

M6 may report, but does not canonically score:
- change amplification;
- verification amplification;
- repair-loop count;
- reopened work;
- recurrence of the same Product symptom.

These are signals for M1/Owner reassessment, not candidate failure by themselves.

## 9. Verification cadence

M6 development uses candidate-relative targeted verification by default.

- Ordinary M6 control-plane changes run through `check:fast`.
- `check:fast` must fail closed to the full release gate for unknown paths, unrunnable changed tests, or validation domains explicitly marked `full`.
- Browser evidence is run only when its owned runtime/evidence paths change.
- Pages/full release verification is not triggered by docs/M6 control-plane-only main merges.
- Full `check:release` is required at M6 final certification and at any earlier candidate that crosses a full-risk validation domain.

This is a standing development policy, not a one-off optimization. The goal is to prevent verification amplification from turning the harness itself into the dominant delivery cost.

## 10. M6 itself is not trusted

M6 changes are harness changes and can regress previously successful work.

A fixed regression set must cover at least:
1. ordinary small change;
2. NO_CHANGE_REQUIRED;
3. UNKNOWN_COVERAGE;
4. manual evidence;
5. stale candidate;
6. real regression;
7. flaky/infra failure;
8. high-risk independent audit;
9. interrupted/resume;
10. parallel semantic conflict.

Any new M6 gate, Skill, agent, registry, or state must be justified by a concrete failure that the simpler loop could not safely handle. Additions are compared against the fixed regression set and removed when they do not improve safety or utility.

## 11. M6 milestones

### M6-0 — Preconditions

- M5 clean baseline certified.
- CR-15 current audited automation boundary read and preserved.
- M6 design recorded.
- Shadow-controller regression fixtures defined before execution automation.

### M6-1 — Shadow Controller

Read-only controller.

Inputs:
- M1 Project State;
- M2/M3 current control-plane inputs;
- M4 Work Order;
- M5 certification/recovery/hygiene;
- Git candidate reality.

Outputs only:
- CONTINUE;
- NO_CHANGE_REQUIRED;
- MANUAL_EVIDENCE_REQUIRED;
- OWNER_DECISION_REQUIRED;
- UNKNOWN_COVERAGE;
- STALE_REPLAN_REQUIRED;
- RECOVERY_REQUIRED.

It does not edit production source, commit candidates, push, open/merge PRs, deploy, or retry external writes.

### M6-2 — Local Outer Loop

Only after M6-1 pilot demonstrates value. Connect the read-only controller to the existing Coding Harness through a stateless local-only step protocol. M6 does not spawn a generic Executor or Planner: it emits the current bounded action (`EXECUTE`, `PROVE`, `RECONCILE`, `PRE_CLOSE_FRESHNESS`, or a stop reason), the Work Order write/protection boundary, the exact candidate identity, and required M3 evidence. Runtime verification/failure signals are run-local inputs and are not persisted as truth. Verification requires an exact commit candidate; remote writes remain forbidden.

### M6-3 — Resume / Recovery

Fresh-session resume consumes M5 recovery pointers rather than creating an M6 recovery registry. A supplied M5 receipt must still match current Project State, production map, Work Order hash, exact candidate HEAD and diff fingerprint. `RESUME` reconstructs the same M6-2 LOCAL_ONLY envelope; `REPLAN` stays stale, `RESCUE` requires explicit recovery, and `BLOCKED` remains fail-closed. Recovery never grants rollback or remote-write authority.

### M6-4 — High-risk Independent QA

Independent QA remains policy-owned by `AGENTS.md`. M6 does not invent a second risk taxonomy. Before COMPLETE, the outer harness must explicitly classify whether independent review is required. Unclassified candidates cannot close; required candidates route to read-only QA; unresolved QA findings route back to reconciliation. QA status is run-local evidence and must bind to the exact candidate.

### M6-5 — Integration Gate

After exact candidate verification passes, M6 reconstructs M5 recovery against the current repository again. `RESUME` proves the candidate still contains latest main/current authority; `REPLAN`, `RESCUE`, and `BLOCKED` prevent COMPLETE. A fresh candidate that also satisfies the AGENTS review boundary may return `COMPLETE`, but M6 still reports external-write authority `NONE`; push/merge/deploy require separate execution-time permission.

### M6-6 — Harness Regression / Ablation

Benchmark M6 changes and remove non-load-bearing machinery.

### M6-7 — Pilot

Run heterogeneous real Work Orders. Success is reduced low-level human intervention without false COMPLETE or increased systemic overhead.

## 12. M6 success conditions

### Safety

- false COMPLETE = 0 in the pilot set;
- UNKNOWN never becomes implicit green;
- stale candidate acceptance = 0;
- fabricated evidence/freshness = 0;
- unauthorized external write = 0;
- exact candidate evidence binding is preserved;
- fresh-session recovery works;
- NO_CHANGE_REQUIRED can close without code churn.

### Utility

Compared with the pre-M6 baseline:
- low-level human intervention decreases;
- routine work does not acquire ceremonial audits;
- repair loops do not grow without bound;
- lead time does not degrade persistently;
- original Product outcome remains observable;
- M6 metadata/mechanism does not grow faster than the work it coordinates.

## 13. Simplification rule

When M6 itself becomes the source of complexity, prefer:
1. delete;
2. merge into an existing M0–M5 owner;
3. delegate generic harness behavior to the platform;
4. keep only the smallest evidence gate still needed.

Do not add a new M6 truth layer to solve an M6 coordination problem.
