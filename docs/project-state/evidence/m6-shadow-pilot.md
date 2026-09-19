# M6-1P Shadow Pilot

Status: candidate evidence; non-authoritative  
Authority: none — Project State remains canonical NOW  
Purpose: replay real bounded work against the M6 Shadow Controller before local execution automation is enabled.

## Pilot question

Does the read-only M6 coordinator reduce low-level routing decisions without creating unsafe continuation?

The pilot does not attempt to prove autonomous implementation. It tests only the current M6-1 responsibility:

> Can this execution continue, and if so what evidence/review phase is next?

## Root Work Order replay set

| Source | Work Order | Observed class | Expected M6 routing |
| --- | --- | --- | --- |
| PR #79 | WO-20260919-101 | read-only M1 reconciliation control-plane | CONTINUE → PROVE |
| PR #80 | WO-20260919-R1-C | release/deploy topology | CONTINUE → INDEPENDENT_QA |
| PR #85 | WO-20260919-601 | read-only M6 control-plane | CONTINUE → PROVE |
| PR #87 | WO-20260919-602 | verification/release Fast Path | CONTINUE → INDEPENDENT_QA |
| M6-1P | WO-20260919-603 | read-only replay/evidence | CONTINUE → PROVE |

The fifth case is the pilot's own bounded root Work Order. Four of five are independent historical/current PR work items; the pilot does not rely on synthetic-only fixtures.

## Additional observed failure episodes

### PR #67 — browser evidence synchronization drift

The first unified browser evidence run exposed an observation/synchronization drift in the evidence runner rather than a product semantic regression. M6 must route `STALE_FIXTURE` / `STALE_TEST` to reconciliation without authorizing production repair.

Expected: `CONTINUE → RECONCILE_WITHOUT_PRODUCTION_REPAIR`

### PR #71 — repository reality blocked closeout

The M5.2 closeout audit found remaining workflow residue and closed the candidate unmerged rather than advancing Project State ahead of repository reality.

Expected: `STALE_REPLAN_REQUIRED → REPLAN`

## Pilot acceptance

The candidate passes only when focused regression evidence shows:

- all five root Work Order replays produce the expected routing;
- release/deploy work is identified as requiring independent QA without making ordinary control-plane work high-risk;
- stale test/fixture signals never authorize production repair;
- repository-reality/candidate drift fails closed to replan;
- no semantic verdict, Project State mutation, external-write authority, or M7 work selection is introduced.

## Measurements

This replay is intentionally lightweight.

- false unsafe continuation: must be 0 in the replay set;
- false high-risk routing: must be 0 in the root replay set;
- manual routing decisions represented by explicit M6 output: all replay cases;
- full repository/browser verification: not required for this control-plane pilot;
- final full assurance remains deferred to M6 final certification.

A passing Shadow Pilot authorizes only the next M6 design/implementation gate recorded by Project State. It does not itself authorize remote writes, Product work, or semantic promotion.
