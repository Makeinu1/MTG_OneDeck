# Cold Restart Acceptance

## Purpose

Prove that a brand-new LLM with no prior chat, memory, Issue context or human briefing can recover the **current** project state and the M0→M3 control model from repository files alone.

A passing reader must keep four layers separate:

1. M0 Product/UX semantic truth;
2. M1 Project State NOW and semantic verdicts;
3. M2 semantic identity/ownership/dependency;
4. M3 candidate-relative verification binding, impact, execution and freshness.

No lower layer may silently become authority for a higher layer.

The historical M1 acceptance record is `docs/project-state/evidence/m1-cold-restart-2026-09-17.md`. It is evidence, not current state.

## Fixed prompt

> You have no prior context for this repository. Using repository files only, explain the current project state, semantic authority model, and verification model. Identify Product Truth, authoritative UX Constitution, active contract registry, Semantic Control Plane, verification binding registry, Acceptance claims, implementation roots/surfaces, current MATCH/GAP/CONFLICT/UNKNOWN items, completed milestone, active milestone, next work/gate, unresolved/deferred decisions, bounded coverage and frozen/prohibited scope. Explain how an explicit base/head candidate is mapped to affected semantic IDs, dependent semantics, Acceptance scenarios and evidence; how automated/manual/deferred/unbound/unknown coverage is represented; and why green evidence does not imply semantic MATCH. Cite repository paths. Do not infer current state from Issues, PRs, CI, graph connectivity or historical evidence alone. State whether Project State is stale and whether the checked-out branch is main or a candidate branch.

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
25. Acceptance specification changes are reported as verification-spec freshness changes. A spec-only edit does not by itself claim or require runtime conformance when Product/contract/implementation/evidence behavior is unchanged.
26. Required automated tests are deduplicated and reuse the existing Vitest `core` / `dom` projects.

### Result and freshness model

27. M3 keeps separate:
   - semantic truth;
   - verification claim;
   - evidence binding;
   - execution result/freshness;
   - M1 semantic verdict.
28. Candidate verification may report `VERIFIED_WITHIN_DECLARED_COVERAGE`, `PARTIAL`, or `UNKNOWN_COVERAGE`; it must not claim complete project-wide verification.
29. Impacted manual-only scenarios surface `MANUAL_REQUIRED`; no automatic green result is manufactured.
30. `deferred-needs-decision` remains neither pass nor failure-to-be-hidden; it is a blocking unresolved verification state when impacted.
31. Impacted semantic nodes with no direct evidence and no Acceptance claim are `UNBOUND`.
32. Characterization-only evidence cannot establish conformance.
33. Candidate freshness is recomputed from explicit base/head execution; it is not stored as semantic truth or Project State verdict.
34. Green full-suite CI does not convert UNKNOWN coverage to MATCH and does not resolve CR-15.

### Compatibility migration

35. Active manifest entries no longer carry historical `verifiedBy` / `lastVerifiedCommit` pins after the replacement M3 gate became green.
36. The generated engine API entry may retain its distinct generated-file verification metadata.
37. `check:fast --base ... --head ...` composes domain safety tests with semantic-required tests and evaluates semantic blockers after the tests run.
38. `check:release --base ... --head ...` runs candidate semantic verification after ordinary release checks.
39. `.github/workflows/semantic-verification.yml` verifies PR candidates and main updates with explicit bases; empty-tree first-push cases do not falsely claim semantic freshness.

### M1 NOW remains intact

40. The current verdict set remains:
   - MATCH 6;
   - CONFLICT 2;
   - GAP 5;
   - UNKNOWN 2.
41. CR-04 and CR-12 remain CONFLICT.
42. CR-14 remains OPTIONAL/UNKNOWN.
43. CR-15 remains REQUIRED/UNKNOWN.
44. M3 architecture or green verification never promotes these verdicts automatically.
45. The audited baseline and watched roots come from `docs/project-state/index.json`.
46. If a descendant of the audited baseline changes a watched root, Project State is stale until bounded re-audit/rebaseline.
47. `coverage.mode = BOUNDED` remains explicit.
48. `docs/project-state/production-map.json` remains the production routing snapshot.
49. CR-grounding remains roadmap/provenance/history under `research/cr-grounding/AUTHORITY.md`, not NOW.
50. On main, Project State is committed NOW. On a non-main branch, branch-local Project State is candidate state until merged.

### Current handoff

51. M3 completion means the repository can answer “what needs verification for this explicit candidate and why?” without chat history.
52. The next milestone is M4 Work Protocol / SOW.
53. M4 owns bounded work delegation: Goal / Scope / Authority / Inputs / Constraints / Evidence / Definition of Done / Escalation.
54. M4 must not move Product Truth, Project State NOW, semantic ownership or verification verdicts into task prompts.
55. No M4 implementation begins before an independently audited Owner-approved M4 plan.

## Machine integrity gates

`npm run check:verification` validates verification bindings without claiming candidate freshness.

`npm run verify:semantic -- --base <sha> --head <sha>` computes candidate impact, executes required automated evidence, and fails closed on impacted manual/deferred/unbound/unknown obligations. It always reports `semanticVerdict: NOT_COMPUTED`.

`npm run check:fast -- --base <sha> --head <sha>` unions existing validation-domain tests with M3 semantic-required tests. Full escalation still runs the existing full machine check before semantic blocker evaluation.

`npm run check:release -- --base <sha> --head <sha>` requires both ordinary release checks and M3 candidate semantic verification for commit-based release diffs.

`npm run check:project-state` independently validates canonical/candidate Project State integrity and watched-root freshness.

These gates are complementary. None of them owns Product Truth or M1 semantic verdicts.

## Pass condition

Cold Restart passes only when a repo-only reader can reconstruct:

- M0 Truth;
- M1 NOW/verdicts/bounded coverage;
- M2 semantic identity/ownership/dependency;
- M3 direct and Acceptance evidence binding;
- candidate impact propagation;
- execution selection;
- manual/deferred/unbound/unknown obligations;
- candidate freshness;
- the distinction between verification success and semantic MATCH;
- active-manifest pin retirement and replacement protection;
- the M4 boundary and next gate;

and the machine gates agree with that model for the checked-out repository.
