# M6 Final Closed Execution Loop Certification

Status: final certification candidate  
Authority: evidence only; Project State remains canonical NOW until this candidate is merged  
Scope: M6-0 through M6-7

## Certification claim

M6 is certifiable when the exact final candidate proves that OneDeck can coordinate bounded work through existing M0-M5 authority/evidence without creating a second Product/semantic/project/recovery truth layer and without silently acquiring external-write authority.

M6 owns only the continuation decision. Product priority, semantic meaning, verification evidence, Work Order scope, recovery disposition, and external-write permission remain owned elsewhere.

## Integrated M6 layers

- **M6-0 Plan / Preconditions** — owner-approved thin outer-loop architecture; M5 clean baseline consumed.
- **M6-1 Shadow Controller** — read-only admission/stop coordinator using M1/M3/M4/M5 current reality.
- **M6-1P Shadow Pilot** — five real root Work Order/history points replayed; one post-M6 lifecycle false-stop defect was found and repaired.
- **M6-2 Local Outer Loop** — stateless `LOCAL_ONLY` envelope for existing Coding Harness actions; no generic Executor/Planner.
- **M6-3 Resume / Recovery** — fresh-session resume consumes M5 receipt/reconstruction and recreates the same local envelope; no M6 session registry.
- **M6-4 High-risk QA boundary** — AGENTS.md remains the review-policy owner; unclassified review applicability cannot COMPLETE and required work routes to independent read-only QA.
- **M6-5 Integration Gate** — exact candidate verification is followed by current-main/current-authority reconstruction; stale/divergent/blocked candidates do not COMPLETE.
- **M6-6 Harness Regression / Ablation** — fixed regression responsibilities are distributed to their owning layer and superseded Shadow branches were removed.
- **M6-7 Pilot / Certification** — real M6 Work Orders plus historical bounded root Work Orders exercise admission, stale/recovery, verification, close, release/governance, and no-change/unknown/manual/high-risk regressions.

## Fixed regression coverage

| Case | Current owner/evidence |
| --- | --- |
| ordinary small bounded change | `m6-shadow-controller.test.mjs` admission |
| NO_CHANGE_REQUIRED | `m6-local-loop.test.mjs` + `m6-preclose.test.mjs` |
| UNKNOWN_COVERAGE | `m6-shadow-controller.test.mjs` |
| manual evidence required | Shadow + Local regression fixtures |
| stale candidate / authority drift | Shadow + Preclose recovery/freshness fixtures |
| real regression | `m6-local-loop.test.mjs` |
| flaky / infra / stale-test failure | `m6-local-loop.test.mjs`; production repair is not authorized |
| high-risk independent QA | `m6-preclose.test.mjs` |
| interrupted / fresh-session resume | `m6-resume.test.mjs` + M5 recovery tests |
| parallel/integration drift | Preclose current-main recovery; first integrated main makes a stale parallel candidate REPLAN/RESCUE |

The fixed set is intentionally distributed. M6-6 removed duplicate runtime-failure/no-change/QA/parallel branches from the Shadow layer after M6-2/4/5 became their actual owners.

## Ablation result

Final M6 does **not** contain:

- a Planner;
- a generic Executor agent;
- a generic Auditor agent;
- a persistent loop-state file;
- a work queue;
- a second Project State;
- a second semantic registry;
- a second evidence registry;
- an M6 recovery database;
- a generic context/memory/tool router;
- push/merge/deploy automation.

The remaining stateless scripts each own a distinct boundary:

- `m6-shadow-controller.mjs` — admission / fail-closed stop.
- `m6-local-loop.mjs` — local execution/proof/reconcile envelope.
- `m6-resume.mjs` — M5-owned fresh-session recovery handoff.
- `m6-preclose.mjs` — explicit QA classification + current-main/current-authority close gate.

Removing any one of those loses one required M6 safety boundary; overlapping branches that became non-load-bearing were removed before certification.

## Real-work pilot

Real root Work Orders exercised during M6 include:

- `WO-20260919-602` — incremental verification Fast Path / release topology boundary.
- `WO-20260920-603` — Shadow Pilot and lifecycle repair.
- `WO-20260920-604` — Local Outer Loop.
- `WO-20260920-605` — fresh-session Resume / Recovery.
- `WO-20260920-606` — High-risk QA / Integration Gate.

The earlier Shadow Pilot also replayed root Work Order history from R1-B and R1-C to test stale/release/governance behavior.

Observed false continuation: **0**.  
Observed structural false stop: **1**, found during Shadow Pilot (M6 disabled after moving to M7); repaired and regression-tested.  
Unauthorized remote writes by M6 runtime: **0**.  
M6-created semantic verdicts: **0**.

## Verification-cost observation

Before the Fast Path, PR #85 Candidate Verification ran from 2026-09-19T14:26:23Z to 14:40:07Z.

After the targeted policy was integrated, representative M6 control-plane Candidate Verification runs completed approximately:

- PR #88: 59 seconds.
- PR #90: 52 seconds.
- PR #92: 60 seconds.
- PR #94: 61 seconds.

These are observed workflow durations, not a universal performance guarantee. The certification requirement is that incremental M6 work no longer requires unrelated full-repository/browser release evidence; unknown/full-risk changes still escalate fail-closed.

## CR-15 boundary

CR-15 remains **REQUIRED / UNKNOWN** and is not promoted by M6.

That is intentional and visible:

- R1-D bounded the current primary Cockpit and compatibility GameStore automation surfaces.
- From M6 entry main `b2f7c9f5acd98aa44e447c61739d74d55e43d0ff` through the pre-certification main `381e39b8fa6aef7f59f89f440c261f96560f68d8`, M6 changed no `src/**`, active contract, Acceptance, or Product Requirement file.
- M6 therefore introduced no new gameplay automation recognizer and does not claim global gameplay-automation exhaustiveness.
- M6 treats UNKNOWN as non-green; future gameplay automation expansion must remain selected/audited work until CR-15 receives an exhaustive machine-enforced capability manifest or another authority-approved resolution.

M6 completion means the **execution loop** is bounded. It does not fabricate completion of unresolved Product capabilities.

## Final read-only audit finding

The final cold read-only audit found two material findings before certification:

1. **BLOCKER** — `m6-preclose.mjs` was internally calling the local loop with `verificationStatus: PASS`, which meant M6 could manufacture the transition to pre-close freshness instead of consuming M3 evidence.
2. **HIGH** — independent QA `PASS` / `FAIL` was not bound to an exact candidate HEAD, so stale QA evidence could theoretically be reused after candidate mutation.

Repairs applied before certification:

- pre-close now runs M3 `runSemanticVerification` on the exact planning base/head;
- only `freshness = CURRENT_FOR_CANDIDATE` advances to pre-close freshness;
- test failures route to `CLASSIFY_VERIFICATION_FAILURE`;
- manual/deferred/unknown blockers preserve their fail-closed destinations;
- only after actual M3 proof does the local envelope receive PASS;
- independent QA PASS/FAIL must carry the exact current candidate HEAD; missing or stale QA binding routes back to `INDEPENDENT_QA`.

Regression coverage was added in `m6-preclose.test.mjs`.

Post-repair final-audit status: **BLOCKER 0 / HIGH 0** within M6 scope.

## External-write boundary

Even after `COMPLETE`:

- `semanticVerdict = NOT_COMPUTED`;
- Project State mutation authority is not granted by the runtime;
- external-write authority is `NONE`;
- push / PR mutation / merge / deploy / rollback require separate execution-time permission.

`COMPLETE` means only: the exact Work Order candidate is current and has the required bounded evidence/review state.

## Final full gate

This file is intentionally registered in validation domain `m6-final-certification` with escalation level `full`.

The exact final candidate must pass the repository's full `check:release` path. Incremental M6 PRs intentionally did not repeat that full gate.

## Certification result

**PASS CANDIDATE**, conditional on the exact final candidate completing the full release verification and Project State integrity gates with no HIGH/BLOCKER finding.

On successful integration, M6 may be recorded complete and Project State may advance to M7 planning. M7 Product implementation remains prohibited until its own bounded plan/Owner selection.
