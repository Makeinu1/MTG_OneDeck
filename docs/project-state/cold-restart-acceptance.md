# Cold Restart Acceptance

## Purpose

Prove that a brand-new LLM with no prior chat, memory, Issue context or human briefing can recover the **current** project state from repository files alone without promoting historical evidence into NOW.

The historical M1 acceptance record is `docs/project-state/evidence/m1-cold-restart-2026-09-17.md`. It is evidence, not current state.

## Fixed prompt

> You have no prior context for this repository. Using repository files only, explain the current project state. Identify the product goal, authoritative Constitution, active contract registry, implementation roots/surfaces explicitly represented by Project State, current MATCH items, GAP items, explicit CONFLICT items, UNKNOWN items whose requirement level matters, DEPRECATED/RETIRED items, completed milestone, active milestone, next work/gate, unresolved/deferred and resolved decisions, and frozen/prohibited scope you must not change. Cite repository paths. Do not infer current state solely from Issues, PRs, green CI, deployment status, roadmap/history files, or historical evidence. State whether the canonical Project State is stale against the checked-out repository and whether the checked-out branch is `main` or a candidate branch.

## Required result

A passing answer must recover all of the following without past conversation:

1. Product goal from `docs/product-requirements.md`, not re-invented from implementation.
2. `docs/contracts/ux-constitution.md` as the upper interaction authority.
3. `docs/contracts/manifest.json` as the active contract registry, not as project NOW.
4. The audited baseline and watched roots from `docs/project-state/index.json`.
5. MATCH/GAP/CONFLICT/UNKNOWN from capability state rather than guessed from open Issues/PRs or CI.
6. Requirement level for UNKNOWN capabilities when it changes the meaning of current risk or required work.
7. Completed milestone, active milestone and next gate from current Project State, without fixed historical milestone values.
8. Current unresolved/deferred decisions and resolved decisions that Project State is responsible for surfacing.
9. Lifecycle warnings, including DEPRECATED/RETIRED entries when present.
10. Frozen/prohibited scope from current Project State.
11. The CR backbone ledger as roadmap/provenance/history, not NOW authority.
12. Green CI/deployments as verification evidence only, never semantic MATCH by themselves.
13. Historical M1 evidence as historical evidence only; it must not override current milestone/gate values.
14. If watched semantic roots changed after the audit baseline, Project State is reported stale rather than silently reinterpreted.
15. On `main`, Project State is committed NOW. On a non-main branch, branch-local Project State is a candidate state until merged and must not be presented as already committed main reality.

## Machine integrity gate

`scripts/checks/check-project-state.mjs` validates Project State integrity and freshness. It must remain fail-closed for malformed or stale canonical state and must not auto-promote a PR, Issue, test pass or green CI run into `MATCH`.

Machine validation and the repo-only reading are complementary: machine checks establish structural integrity; the cold restart establishes that the repository communicates the same state model to a new reader.

## Pass condition

Cold Restart passes only when the machine integrity gate and a repo-only reading agree on the same current-state model for the checked-out branch, and the reader can distinguish current canonical state from candidate, roadmap and historical evidence.
