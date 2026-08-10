# O4P-01K Cold Audit Brief

## Candidate

- Milestone: O4P-01K
- Candidate SHA: `a215ec335ea6e98364f43974074c53df1df17f4c`
- Base SHA: `fc345821ddc8545da8e6651c6708148065a456bc`
- Candidate fingerprint: `aaf78f1966e0211a978a4797e5917bc8e7ecb2d8606fdd233264ef09a255f4a0`
- Fingerprint definition: SHA-256 of `git diff --binary BASE_SHA CANDIDATE_SHA`
- Contract: `research/cr-grounding/o4p-01k-turn-priority-lifecycle.contract.draft.md`

## Auditor boundary

Read the repository at the candidate SHA and compare the implementation with the
frozen contract and fixed CR. Do not edit files, run git mutation commands, or
infer acceptance from implementer reports. Return findings only, with severity
`BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`, file/line evidence, and a contract or CR
basis. Confirm the candidate SHA and fingerprint before auditing.

## Required audit questions

1. Active Player and Turn Order have one source in the Object Registry; lifecycle does not duplicate them.
2. Position and window unions are exact, canonical, deeply frozen, non-mutating, and cross-validated.
3. Untap has no priority; turn-based checkpoints, phase/step transitions, position sequence, mana clearing, and next-turn reset obey the contract.
4. Priority starts at the active player, validates the contiguous pass chain, resets after action, and produces the exact all-pass result.
5. Resolution-ready names the current stack top; explicit removal returns to the SBA boundary without resolving effects.
6. Pending triggers reject ObjectId collisions, preserve historical sources and text snapshots, and maintain exact pendingObjectIds/byObject parity.
7. APNAP bucket order is ordinary then ability-triggered, with active-player rotation and manual same-controller ordering.
8. Trigger placement is bottom-to-top, atomic, uses the O4P-01J synthetic commit, clears pending triggers only on success, and returns to SBA.
9. SBA coordination records caller-reported application, repeats on applied actions, orders triggers after a stable check, and grants priority only at the stable boundary.
10. Cleanup recalculates discard requirements, clears marked damage including phased-out objects, preserves counters/orientation/attachments, empties mana, and distinguishes stable, exceptional-priority, and repeated cleanup.
11. Concrete SBA condition evaluation, trigger detection, effect resolution, legality, Combat, Control/Permission, Command/Event, Online, UI, and version changes are absent and not falsely advertised.
12. Hostile inputs reject accessors, non-enumerable and symbol fields, sparse/extended arrays, class instances, unknown/missing fields, coercion, trim, sort, and deduplication; all issues are deterministic.
13. Public exports are additive and preserve O4P-01G/H/I/J shapes, Solo source, versions, fixtures, package lock, dependencies, and product boundaries.
14. Compiler API architecture checks cover static, type-only, dynamic, and re-export forms; no reverse import from Object Registry, Stack Announcement, or Stack Transaction into Turn exists.
15. Property and review tests are non-vacuous, independent of implementer reasoning, and cover the 51 acceptance pins.
16. Machine-check ordering places Turn/Priority immediately after Stack Transaction, with no duplicate or removed checks.

## Required result

Report:

- candidate SHA/fingerprint confirmation;
- every finding with severity and exact evidence;
- explicit `BLOCKER/HIGH count`;
- whether the result is `AUDIT-OK-PENDING-FULL-CHECK`.

Do not change the candidate or any audit artifact.
