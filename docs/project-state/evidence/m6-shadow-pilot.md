# M6-1P Shadow Pilot Evidence

Status: pilot candidate  
Authority: evidence only; Project State remains canonical NOW  
Scope: read-only M6 Shadow Controller utility/safety pilot

## Purpose

Exercise the M6-1 Shadow Controller against real bounded root Work Order shapes and exact repository history before enabling M6-2 local execution.

The pilot does not claim that M6 existed when older Work Orders originally ran. Historical packets are replay evidence: their real scope/base/head/outcome are compared with what the current controller must do when such a packet is encountered now.

## Root Work Orders sampled

| Work Order | Source | Real outcome | Shadow expectation now |
| --- | --- | --- | --- |
| WO-20260919-101 | PR #79 R1-B M1 Candidate Reconciliation | merged after bounded verification | old packet/candidate must not be silently resumed after main advances; replan |
| WO-20260919-R1-C | PR #80 Release / Integration Hardening | merged after full release/integration review | old packet/candidate must replan; later close path still requires independent QA for release/deploy risk |
| WO-20260919-601 | PR #85 M6-1 Shadow Controller | merged with candidate verification green | after merge/main advancement the old packet is stale and must replan |
| WO-20260919-602 | PR #87 M6 incremental Fast Path | merged after full-risk verification | after merge/main advancement the old packet is stale and must replan |
| WO-20260920-603 | current M6-1P pilot repair | active candidate | current bounded control-plane candidate may continue to targeted proof |

## Observed controller defect

The first M6-1 implementation required:

`activeMilestone === "M6 — Closed Execution Loop"`.

That would make the controller reject every M7 Work Order immediately after M6 certification, even though the whole purpose of M6 is to remain the outer execution controller for later Product work.

Classification: **false STOP / lifecycle-coupling defect**.

Repair:

- M6 is available while M6 is active; or
- after M6 is completed, when `completedMilestones` contains `M6 — Closed Execution Loop`.

The controller still fails closed before M6 has been established.

A fixed regression now covers both sides.

## Pilot observations

- false continuation observed: 0
- false stop observed before repair: 1 structural case (post-M6/M7 availability)
- false stop after repair in the fixed set: 0
- production/runtime changes made by pilot: 0
- semantic verdicts computed by M6: 0
- remote writes performed by the controller: 0
- repair loops required by pilot: 1
- full repository/release scans required for the pilot repair: 0 by policy; candidate-relative Fast Path only
- unrelated browser evidence required: 0

## Human-intervention observations

The Shadow Controller already removes repeated low-level choices about:

- whether stale Work Order/candidate state can be resumed;
- whether M5 recovery/certification is available;
- whether M3 reports unknown/manual/deferred blockers;
- whether scope drift requires replan.

The following remain intentionally outside M6-1 and are not counted as Shadow Controller failures:

- executing code changes after CONTINUE (M6-2);
- durable fresh-session materialization/recovery of an inline Work Order (M6-3);
- automatic routing of AGENTS high-risk work to independent QA before close (M6-4);
- integration freshness and external-write permission (M6-5).

## Gate result

**PASS WITH ONE REPAIR APPLIED.**

M6-1P found a real lifecycle defect, repaired it without adding a new truth layer, and the remaining gaps align with already-planned M6-2 through M6-5 responsibilities.

M6-2 may proceed after this exact candidate is targeted-green and integrated.
