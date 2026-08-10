# O4P-01K Corrected Candidate Cold Re-Audit Brief

## Candidate

- Milestone: O4P-01K
- Candidate SHA: `647d429b532b39a5832c0257a7355793f207b4a7`
- Base SHA: `fc345821ddc8545da8e6651c6708148065a456bc`
- Candidate fingerprint: `69e99e4e53c29ee799479be5c0692860ad9b51e9b86f6b1bbe59ddd874fb3a19`
- Fingerprint definition: SHA-256 of `git diff --binary BASE_SHA CANDIDATE_SHA`
- Frozen contract: `research/cr-grounding/o4p-01k-turn-priority-lifecycle.contract.draft.md`
- Prior findings: `research/cr-grounding/archive/o4p-01k-cold-audit-record-2026-08-10.md`

## Auditor boundary

Read the repository at the candidate SHA and perform an independent read-only
cold re-audit. Do not edit files or run git mutation commands. Confirm the SHA
and fingerprint before auditing. Return every finding with severity, exact
file/line evidence, and fixed-contract or fixed-CR basis.

## Mandatory re-audit of prior HIGH findings

1. `position-advance-ready`, `cleanup-repeat-ready`, and `turn-advance-ready`
   cannot be valid while pendingObjectIds remain; pending trigger placement must
   precede progression.
2. Every lifecycle array rejects Array subclasses, extra properties, sparse
   elements, symbols, accessors, and non-enumerable elements while accepting the
   exact ordinary canonical array.
3. SBA outcome inputs reject class instances and accessors without reading them;
   position advance rejects class/accessor operation objects and never executes
   an accessor for nextPosition.

## Full audit scope

Also audit the full original brief checklist: single-source active player and
turn order; exact position/window unions and cross-slice invariants; untap and
turn-based checkpoints; priority cycle, pass chain, all-pass outcomes, and
resolution removal boundary; pending-trigger parity, historical sources, APNAP
bucket/controller order, manual same-controller ordering, atomic stack
placement, and SBA fixed-point coordination; cleanup discard/damage/mana and
repetition; deep freeze, canonicalization, non-mutation, hostile input
rejection, property-test non-vacuity, public exports, O4P-01G/H/I/J and Solo
preservation, machine-check ordering, package-lock/dependency/version
preservation, and absence of concrete SBA evaluation, trigger detection,
effect resolution, Combat, Control/Permission, Command/Event, Online, or UI.

## Required result

Report candidate confirmation, all findings, explicit BLOCKER/HIGH count, and
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero. Do not change the
candidate or audit artifacts.
