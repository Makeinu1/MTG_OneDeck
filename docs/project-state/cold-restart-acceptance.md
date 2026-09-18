# Cold Restart Acceptance

## Purpose

Prove that a brand-new LLM with no prior chat, memory, Issue context or human briefing can recover the **current** project state and the M0→M4 control model from repository files alone.

A passing reader must keep five layers separate:

1. M0 Product/UX semantic truth;
2. M1 Project State NOW and semantic verdicts;
3. M2 semantic identity/ownership/dependency;
4. M3/M3.1 candidate-relative verification binding, coverage invalidation, manual evidence, impact, execution and freshness;
5. M4 bounded Work Protocol / SOW execution envelope.

No lower layer may silently become authority for a higher layer.

The historical M1 acceptance record is `docs/project-state/evidence/m1-cold-restart-2026-09-17.md`. It is evidence, not current state.

## Fixed prompt

> You have no prior context for this repository. Using repository files only, explain the current project state, semantic authority model, verification model, and bounded Work Protocol. Identify Product Truth, authoritative UX Constitution, active contract registry, Semantic Control Plane, verification binding registry, Acceptance claims, Work Order schema/validator, implementation roots/surfaces, current MATCH/GAP/CONFLICT/UNKNOWN items, completed milestone, active milestone, next work/gate, unresolved/deferred decisions, bounded coverage and frozen/prohibited scope. Explain how an explicit base/head candidate is mapped to affected semantic IDs, dependent semantics, Acceptance scenarios and evidence; how automated/manual/deferred/unbound/unknown coverage is represented; how a Work Order is validated at planningBase and candidate HEAD; how child delegation is bounded; why a stored Work Order cannot authorize external writes; and why green evidence does not imply semantic MATCH. Cite repository paths. Do not infer current state from Issues, PRs, CI, graph connectivity, Work Order history or historical evidence alone. State whether Project State is stale and whether the checked-out branch is main or a candidate branch.

## Required result

A passing answer must recover all of the following without past conversation.

### Truth and semantic identity

1. `docs/product-requirements.md` owns Product WHY/WHAT, including P/Q decisions.
2. `docs/contracts/ux-constitution.md` owns interaction semantics and Human authority.
3. `docs/contracts/manifest.json` is the active **file-level** contract registry, not project NOW and not candidate verification state.
4. Active manifest `dependsOn` remains coarse non-semantic compatibility metadata.
5. `docs/contracts/semantic-map.json` contains sparse prose-free `refines` / `constrainedBy` relations.
6. Product definition rows and active-contract inline clause markers create semantic identity; verification metadata does not.
7. `scenario.verifies` remains the sole authored Acceptance→semantic claim.
8. Q-02 irreversibility and the missing lower Information/Audience semantic node remain explicit M2 gaps rather than invented mappings.

### M3 evidence binding

9. `docs/contracts/traceability.json` schema v2 is an **optional direct-evidence binding registry**. A traceability row cannot create a semantic ID.
10. Redundant `verificationDisposition: acceptance` rows are gone. Acceptance-backed semantics are represented through `scenario.verifies` plus the scenario's execution/manual binding.
11. Direct evidence distinguishes:
   - `conformance`: evidence whose oracle directly evaluates the bound semantic clause;
   - `characterization`: evidence that records current implementation behavior but does not establish semantic conformance.
12. A passing characterization test cannot hide or change an M1 CONFLICT.
13. Current automated Acceptance bindings carry machine-checkable `scenario: ACC-...` markers in their bound test files rather than being inferred from filenames.
14. The explicit M3 Acceptance specifications exist for:
   - `ACC-M3-CHOICE-001`;
   - `ACC-M3-GRANTED-ACTION-001`;
   - `ACC-M3-UNDO-RECOVERY-001`;
   - `ACC-M3-INFORMATION-001`.
15. Those four specifications have no fabricated passing evidence. Their existence does not claim the corresponding runtime behavior is implemented.

### Candidate impact and execution

16. `scripts/checks/check-verification.mjs` is a base-independent structural integrity gate for binding schemas, semantic endpoints, evidence paths/markers and scenario execution bindings.
17. `scripts/checks/semantic-verification.mjs` resolves candidate impact for an explicit base/head pair.
18. `scripts/checks/verify-semantic.mjs` is the candidate semantic verification gate. It requires an explicit base and never computes an M1 semantic verdict.
19. Product definition changes invalidate their P/Q IDs; unattributable Product Truth prose changes conservatively invalidate all Product IDs rather than being ignored.
20. Active contract clause changes invalidate their inline semantic IDs; unattributable active-contract prose changes broaden invalidation rather than guessing.
21. M2 dependency edges are reversed only in memory for impact propagation: upstream target changes invalidate dependent `from` semantics; reverse edges are not authored.
22. Evidence-file changes invalidate every direct/scenario binding using that path.
23. Implementation-source changes reuse the existing validation-domain resolver: implementation diff → domain tests → bound semantic/scenario evidence.
24. Unknown implementation paths retain existing full-check escalation and produce UNKNOWN semantic coverage rather than invented ownership.
25. Acceptance specification changes are reported as verification-spec freshness changes. A newly added specification alone does not fabricate or require runtime conformance when Product/contract/implementation/evidence behavior is unchanged.
26. Removing an Acceptance scenario, changing an existing `scenario.verifies` claim, changing an existing scenario execution contract/oracle, or removing/weakening a direct evidence binding invalidates the affected semantic obligations and is not treated as harmless spec-only metadata.
27. `docs/project-state/evidence/m3-1-direct-evidence-role-audit.md` records the independent row-by-row review of the M3 direct evidence migration; automated evidence is not assumed conformance merely because a marker exists.
28. Impacted manual-only scenarios may be satisfied only by an explicit manual evidence receipt whose exact base/head matches the candidate. The receipt contains scenario/result/evidence reference only and cannot carry semantic verdict or external-write permission.
29. `.github/workflows/semantic-verification.yml` supports an explicit manual `workflow_dispatch` lane for the same exact candidate; the receipt is materialized only for the run and is not repository truth.
30. Required automated tests are deduplicated and reuse the existing Vitest `core` / `dom` projects.

### Result and freshness model

31. M3/M3.1 keeps separate:
   - semantic truth;
   - verification claim;
   - evidence binding;
   - execution result/freshness;
   - M1 semantic verdict.
32. Candidate verification may report `VERIFIED_WITHIN_DECLARED_COVERAGE`, `PARTIAL`, or `UNKNOWN_COVERAGE`; it must not claim complete project-wide verification.
33. Impacted manual-only scenarios surface `MANUAL_REQUIRED`; no automatic green result is manufactured.
34. `deferred-needs-decision` remains neither pass nor failure-to-be-hidden; it is a blocking unresolved verification state when impacted.
35. Impacted semantic nodes with no direct evidence and no Acceptance claim are `UNBOUND`.
36. Characterization-only evidence cannot establish conformance.
37. Candidate freshness is recomputed from explicit base/head execution; it is not stored as semantic truth or Project State verdict.
38. Green full-suite CI does not convert UNKNOWN coverage to MATCH and does not resolve CR-15.

### Compatibility migration

39. Active manifest entries no longer carry historical `verifiedBy` / `lastVerifiedCommit` pins after the replacement M3 gate became green.
40. The generated engine API entry may retain its distinct generated-file verification metadata.
41. `check:fast --base ... --head ...` composes domain safety tests with semantic-required tests and evaluates semantic blockers after the tests run.
42. `check:release --base ... --head ...` runs candidate semantic verification after ordinary release checks.
43. `.github/workflows/semantic-verification.yml` verifies PR candidates and main updates with explicit bases; empty-tree first-push cases do not falsely claim semantic freshness.

### M1 NOW remains intact

44. The current verdict set remains:
   - MATCH 6;
   - CONFLICT 2;
   - GAP 5;
   - UNKNOWN 2.
45. CR-04 and CR-12 remain CONFLICT.
46. CR-14 remains OPTIONAL/UNKNOWN.
47. CR-15 remains REQUIRED/UNKNOWN.
48. M3/M3.1 architecture or green verification never promotes these verdicts automatically.
49. The audited baseline and watched roots come from `docs/project-state/index.json`.
50. If a descendant of the audited baseline changes a watched root, Project State is stale until bounded re-audit/rebaseline.
51. `coverage.mode = BOUNDED` remains explicit.
52. `docs/project-state/production-map.json` remains the production routing snapshot.
53. CR-grounding remains roadmap/provenance/history under `research/cr-grounding/AUTHORITY.md`, not NOW.
54. On main, Project State is committed NOW. On a non-main branch, branch-local Project State is candidate state until merged.

### Current handoff

55. M4 completion means the repository can hand one bounded work item to a fresh execution context, validate its planning snapshot and exact candidate, and bound child delegation without relying on chat history or creating a second authority system.
56. The next milestone is M5 Audit / Hygiene / Recovery.
57. M5 owns repository-wide reassessment and cleanup of stale/dead/duplicate authority surfaces, orphan Acceptance/evidence/tests, legacy implementation/document drift, and interrupted-work recovery beyond M4's basic resume envelope.
58. M5 must preserve M0 Product/UX Truth, M1 semantic verdict ownership, M2 semantic identity, M3/M3.1 verification semantics, and M4 external-write/delegation boundaries unless an explicit separately-authorized authority change is the work itself.
59. No M5 implementation begins before an independently audited Owner-approved M5 plan.

### M4 Work Protocol / SOW

60. `docs/work-protocol/README.md` is the canonical M4 process contract. It owns the bounded execution envelope only; it is not Product Truth, Project State NOW, semantic ownership, verification result, or roadmap authority.
61. `docs/work-protocol/work-order.schema.json` is recursively closed. Every object rejects undeclared nested fields.
62. Root Work Orders use `parentWorkId: null`; child Work Orders carry the explicit parent work ID. The ID links packets but does not create a persistent registry or authority lookup.
63. A Work Order separates:
   - `authorityRefs` — canonical meaning that constrains interpretation;
   - `contextRefs` — current-reality capability IDs whose verdict is read from Project State;
   - `verificationIntent` — semantic / Acceptance obligations inherited from M3/M3.1;
   - `scope` — bounded target semantic area, inputs and expected change roots.
64. Work Orders never store current M1 verdict values, M3/M3.1 PASS/freshness, current milestone/next gate, or durable commit/push/merge/deploy permission.
65. `scripts/checks/work-order.mjs` validates structure and resolves semantic/capability/Acceptance/authority/path references against the exact `planningBase` snapshot. A later repository state cannot retroactively make an invalid old packet valid.
66. With an explicit candidate head, M4-3 requires `planningBase` ancestry, rechecks references, detects Project State execution-boundary changes, M1 capability-context changes and material referenced-Acceptance changes, rejects protected-path mutation, and distinguishes authority-source semantic changes from ordinary M3/M3.1 implementation/evidence impact.
67. Files outside `expectedChangeRoots` are reported as drift for review; file drift alone is not automatically reclassified as semantic failure.
68. Child delegation is monotonic for change authority: target semantic scope and expected change roots cannot broaden, protected boundaries cannot weaken, inherited review/verification policy cannot weaken, and parent verification obligations relevant to the child target cannot silently disappear.
69. A child may add read-only authority/input references needed to understand its narrower task; reference expansion alone is not mutation authority.
70. M3.1 owns exact-candidate manual evidence receipt validation. M4 owns only the bounded procedure around who performs/reviews the manual work and how its evidence reference is handed back.
71. `scripts/checks/check-work-protocol.mjs` verifies the representative root and child fixtures and proves that the nested authority-escalation fixture is rejected.
72. M4 creates no permanent `current-work.json` registry and no arbitrary shell-command execution DSL.
73. Basic interruption resume uses Project State NOW + Work Order + current git candidate + M3/M3.1 verification state + unresolved review findings. Conversation history is optional context, not authority.
74. M5 owns deeper stale/dead artifact audit, repository hygiene and interrupted-work recovery beyond this basic resume envelope.
75. M6 owns orchestration. M4 does not auto-select work, recursively dispatch agents, retry failed work, merge competing outputs or advance milestones.
76. Before M6 closed-loop orchestration is approved, M6-PLAN must require an independently bounded CR-15 audit for the automation surfaces it will invoke.
77. On main, the M4 Work Protocol is committed process state subordinate to Project State NOW; on a non-main branch, Work Protocol changes are candidate process state until merged.

## Machine integrity gates

`npm run check:verification` validates verification bindings without claiming candidate freshness.

`npm run verify:semantic -- --base <sha> --head <sha>` computes candidate impact, executes required automated evidence, and fails closed on impacted manual/deferred/unbound/unknown obligations. An exact-candidate manual receipt may be supplied with `--manual-evidence <path>`; only matching PASS entries clear the corresponding manual blocker. It always reports `semanticVerdict: NOT_COMPUTED`.

`npm run check:fast -- --base <sha> --head <sha>` unions existing validation-domain tests with M3 semantic-required tests. Full escalation still runs the existing full machine check before semantic blocker evaluation.

`npm run check:release -- --base <sha> --head <sha>` requires both ordinary release checks and M3 candidate semantic verification for commit-based release diffs.

`npm run check:work-order -- <work-order.json> [--head <sha>] [--parent <parent.json>]` validates one Work Order's structure, planning-snapshot references and optional candidate/delegation binding.

`npm run check:work-protocol` validates the canonical M4 schema/fixtures and rejects the authority-escalation fixture.

`npm run check:project-state` independently validates canonical/candidate Project State integrity and watched-root freshness.

These gates are complementary. None of them owns Product Truth or M1 semantic verdicts.

## Pass condition

Cold Restart passes only when a repo-only reader can reconstruct:

- M0 Truth;
- M1 NOW/verdicts/bounded coverage;
- M2 semantic identity/ownership/dependency;
- M3/M3.1 direct and Acceptance evidence binding, including row-by-row conformance/characterization audit;
- candidate impact propagation;
- execution selection;
- coverage-weakening invalidation plus manual/deferred/unbound/unknown obligations;
- candidate freshness;
- the distinction between verification success and semantic MATCH;
- active-manifest pin retirement and replacement protection;
- M4 Work Order authority boundaries, planning-snapshot validation, candidate drift, monotonic delegation and external-write non-authority;
- the M4/M5/M6 boundary, the M5-PLAN handoff, and the CR-15 gate before closed-loop orchestration;

and the machine gates agree with that model for the checked-out repository.
