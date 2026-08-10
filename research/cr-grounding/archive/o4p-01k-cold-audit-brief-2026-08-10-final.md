# O4P-01K Final Candidate Cold Re-Audit Brief

## Candidate

- Milestone: O4P-01K
- Candidate SHA: `f3fbb4321fc659387567ce89cc356ee8be50d27b`
- Base SHA: `fc345821ddc8545da8e6651c6708148065a456bc`
- Candidate fingerprint: `e5f71f2cdc91b5c1e593c9b7d870617d1ca9f1a31ae82f5e04166eebacf1200f`
- Fingerprint definition: SHA-256 of `git diff --binary BASE_SHA CANDIDATE_SHA`
- Frozen contract: `research/cr-grounding/o4p-01k-turn-priority-lifecycle.contract.draft.md`
- Prior records: `research/cr-grounding/archive/o4p-01k-cold-audit-record-2026-08-10.md`, `research/cr-grounding/archive/o4p-01k-cold-reaudit-record-2026-08-10.md`

## Auditor boundary

Perform an independent read-only cold audit at the candidate SHA. Do not edit
files or run git mutation commands. Confirm candidate SHA and fingerprint first.
Return every finding with severity, exact file/line evidence, and fixed-contract
or fixed-CR basis.

## Mandatory prior-finding closure

1. Pending triggers must be rejected for every `priority`, `resolution-ready`,
   `position-advance-ready`, `cleanup-repeat-ready`, and `turn-advance-ready`
   lifecycle window; no all-pass path may bypass `trigger-order-required`.
2. Lifecycle arrays must reject Array subclasses, extra properties, sparse
   elements, symbols, accessors, and non-enumerable elements.
3. SBA outcome and position-advance operation inputs must reject class instances
   and accessors without executing hostile getters.

## Full audit scope

Audit the complete O4P-01K contract: single-source active player and turn order;
exact position/window unions and cross-slice invariants; untap and turn-based
checkpoints; priority cycle, pass chain, all-pass outcomes, and resolution
removal; pending-trigger parity, historical sources, APNAP bucket/controller
order, manual same-controller ordering, atomic placement, and SBA fixed-point;
cleanup discard/damage/mana/repetition; deep freeze, canonicalization,
non-mutation, hostile inputs, property-test non-vacuity, public exports,
O4P-01G/H/I/J and Solo preservation, machine-check ordering,
package-lock/dependency/version preservation, and absence of concrete SBA
evaluation, trigger detection, effect resolution, Combat, Control/Permission,
Command/Event, Online, or UI.

## Required result

Report candidate confirmation, all findings, explicit BLOCKER/HIGH count, and
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero. Do not modify the
candidate or audit artifacts.
