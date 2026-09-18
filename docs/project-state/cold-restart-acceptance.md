# Cold Restart Acceptance

## Purpose

Prove that a brand-new LLM with no prior chat, memory, Issue context or human briefing can recover the **current** project state and the M0→M2 authority model from repository files alone without promoting historical evidence, graph connectivity, verification metadata or green CI into semantic truth.

The historical M1 acceptance record is `docs/project-state/evidence/m1-cold-restart-2026-09-17.md`. It is evidence, not current state.

## Fixed prompt

> You have no prior context for this repository. Using repository files only, explain the current project state and semantic authority model. Identify the product goal, authoritative Constitution, active contract registry, Semantic Control Plane, implementation roots/surfaces explicitly represented by Project State, current MATCH/GAP/CONFLICT/UNKNOWN items, completed milestone, active milestone, next work/gate, unresolved/deferred and resolved decisions, bounded coverage and its limitations, and frozen/prohibited scope. Explain who owns P-04/P-08/P-10; how Manual Resolution, HOLD, Choice Authority, effect-granted action, Undo, Information/Audience and Room Owner recovery relate to Product Requirements and lower contracts; where M2 intentionally leaves semantic gaps; what Acceptance scenarios claim to verify; and what remains M3 verification work. Cite repository paths. Do not infer current state solely from Issues, PRs, green CI, deployment status, roadmap/history files, graph connectivity, traceability rows or historical evidence. State whether canonical Project State is stale against the checked-out repository and whether the checked-out branch is `main` or a candidate branch.

## Required result

A passing answer must recover all of the following without past conversation:

1. Product goal and P/Q Product Truth from `docs/product-requirements.md`, not re-invented from implementation or lower contracts.
2. `docs/contracts/ux-constitution.md` as the upper interaction authority, including Human authority, Manual Resolution, HOLD, actor-owned Undo, Choice Authority, effect-granted action, Information/Audience and narrow Room Owner recovery.
3. `docs/contracts/manifest.json` as the active **file-level** contract registry, not project NOW and not clause-level semantic authority. Its `dependsOn` field is coarse compatibility/dependency metadata only.
4. `docs/contracts/semantic-map.json` as the sparse prose-free `refines` / `constrainedBy` relation map. The map relates canonical meanings but does not own or restate them.
5. Semantic identity from Product definition rows and active-contract inline `<!-- clause: ID -->` markers, not from `traceability.json`.
6. `scenario.verifies` in `docs/acceptance/scenarios.json` as the only authored Acceptance→semantic verification claim. Reverse accepted-by views are derived, not authored.
7. `docs/contracts/traceability.json` as a verification-binding compatibility registry. A traceability row may bind evidence to a semantic ID but does not create semantic existence.
8. Product ownership for P-04, P-08 and P-10 and the reviewed M2 relations for:
   - Manual Resolution → P-06;
   - HOLD → P-04;
   - Choice Authority → P-04 / P-06;
   - effect-granted action → P-04;
   - Undo → P-08;
   - Information/Audience → P-06 / P-10;
   - Room Owner recovery → Q-01.
9. Reviewed lower-domain constraints, including Commands constrained by Manual Resolution/Undo, Turn progression constrained by HOLD, and Multiplayer lifecycle constrained by Elimination/Recovery semantics.
10. The intentional M2 gaps rather than invented edges:
    - Q-02 confirmed elimination/end irreversibility remains owned by Product Requirements without a claimed `UX-CONST-ELIMINATION refines Q-02` edge;
    - Information/Audience currently has no suitable lower engine semantic clause, so no adjacency-based edge is fabricated.
11. M3 handoff obligations: Choice, effect-granted action, Undo recovery and Information/Audience have stable M2 semantic identity but do not gain implementation/verification status from graph presence. M3 owns evidence binding, execution, freshness, invalidation and fail-closed verification.
12. The audited baseline and watched roots from `docs/project-state/index.json`.
13. MATCH/GAP/CONFLICT/UNKNOWN from capability state rather than guessed from semantic-map edges, tests, open Issues/PRs or CI.
14. The current verdict set remains 6 MATCH / 2 CONFLICT / 5 GAP / 2 UNKNOWN unless repository evidence at a later audited baseline says otherwise. In particular CR-04 and CR-12 remain CONFLICT; M2 cleanup does not promote them.
15. Requirement level for UNKNOWN capabilities when it changes the meaning of current risk or required work.
16. Completed milestone, active milestone and next gate from current Project State. Roadmap/history can explain sequence but cannot override NOW.
17. Current unresolved/deferred decisions and resolved Owner decisions that Project State is responsible for surfacing.
18. Lifecycle warnings, including DEPRECATED/RETIRED entries when present.
19. Frozen/prohibited scope from current Project State; especially no R6 gameplay/production-semantic work and no M3 implementation before an independently audited Owner-approved M3 plan.
20. `coverage.mode = BOUNDED`, the declared coverage scope, completeness sources and known limitations; a passing answer must not claim complete project-wide semantic or verification coverage.
21. `docs/project-state/production-map.json` as the current routing snapshot, including the distinction between primary Cockpit routing and the legacy-visible Public Online surface.
22. The CR backbone ledger as roadmap/provenance/history under `research/cr-grounding/AUTHORITY.md`, not NOW authority. Historical `activeProgram`, `nextGate`, planned-sequence or older "single source" wording inside CR-grounding material does not select current work.
23. Green CI/deployments as verification evidence only, never semantic MATCH by themselves.
24. Historical M1 evidence as historical evidence only; it must not override current milestone/gate values.
25. If watched semantic roots changed after the audit baseline, Project State is reported stale rather than silently reinterpreted.
26. On `main`, Project State is committed NOW. On a non-main branch, branch-local Project State is candidate state until merged and must not be presented as already committed main reality.

## Machine integrity gates

`npm run check:docs` validates the M2 semantic substrate and registry boundaries: semantic endpoint existence, Product definition uniqueness, active inline clause uniqueness, edge shape/duplicates/DAG, Acceptance `verifies` targets, retired reverse/duplicate registry fields, and compatibility verification pins.

`npm run check:project-state` validates Project State integrity and freshness, including bounded coverage metadata, capability audit provenance, deferred-decision surfacing, machine-checkable locator anchors, production routing references, baseline/main provenance and generated-view freshness. It remains fail-closed for malformed or stale candidate/canonical state and never infers semantic verdicts from M2 connectivity or CI.

`npm run check` includes both gates, and `npm run check:release` invokes `npm run check`, so semantic control-plane integrity and Project State freshness remain in the ordinary verification chain.

Machine validation and repo-only reading are complementary: machine checks establish structural integrity; Cold Restart establishes that the repository communicates the same authority/state model to a fresh reader.

## Pass condition

Cold Restart passes only when the machine integrity gates and a repo-only reading agree on the same checked-out state, and the reader can distinguish:

- Product Truth from implementation reality;
- semantic identity/ownership from verification binding;
- Project State NOW from roadmap/history;
- semantic graph relations from implementation proof;
- intentional gaps from missing documentation;
- M2-complete architecture from M3-unimplemented verification machinery;
- main canonical state from candidate-branch state.
