# O4P-01K Orchestration Plan

Date: 2026-08-10
Milestone: O4P-01K
Authority: user-ruling-2026-08-10
Role: Judge / Orchestrator
Base ancestor: cee68c74ce6ef8ec736ecfcda455474ad44e3a6a

## Goal

Add an independent, mode-neutral turn lifecycle slice to the shipped
`CoreStackTransactionBundleV1`: turn position, priority, consecutive passes,
SBA fixed-point boundaries, committed pending triggers, APNAP placement,
resolution-ready boundaries, cleanup repetition, and active-player rotation.

## Preserved contracts

- O4P-01G/H/I/J public contracts and production files remain unchanged.
- `ModeNeutralCoreObjectRegistrySliceV2` is the sole source of active player
  and turn order.
- `CoreStackTransactionBundleV1` is not widened with lifecycle fields.
- Solo state, snapshots, commands, and `CURRENT_CONTRACT_VERSIONS` remain
  unchanged.
- No UI, Store, Online, Cloudflare, Command/Event, replay, or protocol work.
- No concrete SBA catalog, trigger detection, target legality, or effect
  resolution is claimed.

## Role and worktree policy

This milestone uses the user-authorized bounded parallel Luna exception.
Every lane uses `fork_context:false`, an independent worktree, a disjoint
allowlist, and no git, ledger, docs, `AGENTS.md`, package, dependency, or
`review.*` mutation unless explicitly owned by the orchestrator. Cold audit is
read-only and receives only the frozen audit brief path, candidate SHA, and
candidate fingerprint.

## Execution waves

1. Activate the existing O4P-01K entries by appending this plan path and the
   fixed orchestration note. Keep status `pending` and commit as PLAN_SHA.
2. From PLAN_SHA, run five parallel grounding lanes: CR procedure matrix,
   Solo reuse/gap matrix, turn-position checkpoint analysis, priority/pass
   analysis, and SBA/trigger/cleanup analysis.
3. The judge resolves grounding against the pinned 2026-06-19 CR and the
   shipped O4P-01G/H/I/J contracts, then freezes the additive O4P-01K contract.
4. From CONTRACT_SHA, run the independent Acceptance Author lane. Review tests
   are judge-owned and are not changed by implementers.
5. Implement lifecycle primitives/validators serially, then run the three
   disjoint component lanes for pending triggers/APNAP, priority/resolution,
   and turn advance/cleanup. Integrate the coordinator serially.
6. Add fixture/scenario and Compiler-API architecture assets in parallel;
   integrate exports, verifier, machine-check registration, and package script
   in the judge lane.
7. Freeze the candidate and record semantic evidence and a `BROAD` cold-audit
   brief. A cold auditor must return `AUDIT-OK-PENDING-FULL-CHECK` with
   BLOCKER/HIGH = 0 before the release full check.
8. Run `npm run check`, `npm run check:forbidden`, and `git diff --check` once
   on the unchanged audited fingerprint. Only then perform the audited ledger
   update and the authorized CI/Pages ship closure.

## Required evidence gates

- Every lane reports changed files, allowlist result, targeted tests, lint,
  build, `check:forbidden`, and explicit DEFERs.
- Trigger placement is atomic and uses O4P-01J synthetic stack commit APIs.
- All successful values are canonical, input-preserving, JSON round-trippable,
  and deeply frozen; validators fail closed on hostile objects.
- Active player and turn order are never duplicated in the lifecycle slice.
- The shipped state remains honest about concrete SBA, trigger detection,
  combat, effect expiry, effect resolution, and all O4P-01L+ responsibilities.

## Stop conditions

Stop and return to the user only for a CR-irreducible ambiguity, a normal
Commander scope change, a North-Star/architecture change, a breaking change to
O4P-01G/H/I/J, a required O4P-01L+ responsibility being pulled forward, or
two failed implementation corrections by the same implementer.
