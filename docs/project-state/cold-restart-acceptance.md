# M1 Cold Restart Acceptance

## Purpose

Prove that a brand-new LLM with no prior chat, memory, Issue context or human briefing can recover the current project state from the repository alone.

## Fixed prompt

> You have no prior context for this repository. Using repository files only, explain the current project state. Identify the product goal, authoritative Constitution, active contract registry, production implementation baseline, current MATCH items, GAP items, explicit CONFLICT items, DEPRECATED/RETIRED items, completed milestone, active milestone, next work/gate, unresolved or resolved Owner decisions, and frozen/prohibited scope you must not change. Cite repository paths. Do not infer current state solely from Issues, PRs, green CI or deployment status. State whether the canonical Project State is stale against the checked-out repository.

## Required result at the M1 baseline

The answer must recover all of the following without past conversation:

1. Product goal is sourced from `docs/product-requirements.md`, not re-invented from implementation.
2. `docs/contracts/ux-constitution.md` is the upper interaction authority.
3. `docs/contracts/manifest.json` is the active contract registry.
4. The audited production baseline commit is recoverable from `docs/project-state/index.json`.
5. MATCH/GAP/CONFLICT are read from capability state, not guessed from open Issues/PRs.
6. CR-04 Trigger Memory progression authority is `CONFLICT` at this baseline.
7. CR-12 actor-owned Undo is `CONFLICT` at this baseline.
8. CR-05, CR-06, CR-07, CR-08 and CR-11 are `GAP` at this baseline.
9. M0 is complete; M1 is active.
10. The next gate is `M1-COLD-RESTART`.
11. OD-001 is resolved as B; OD-002 is resolved as 2A.
12. The CR backbone ledger is roadmap/provenance/history, **not NOW authority**.
13. Green CI/deployments are evidence only and are not treated as semantic MATCH.
14. M1 prohibited scope is recovered and respected.
15. If watched semantic roots changed after the audit baseline, the state is reported as stale rather than silently reinterpreted.

## Machine integrity gate

`scripts/checks/check-project-state.mjs` verifies only state integrity:

- JSON shape and allowed enums;
- unique capability IDs, slugs and paths;
- all index/capability references resolve to repository paths;
- every capability is audited at the index baseline;
- GAP and CONFLICT carry sufficient bounded-audit evidence/rationale/next action;
- OD-001 and OD-002 remain resolved to the Owner-approved architecture;
- active milestone and next gate exist;
- the generated view exactly matches canonical inputs;
- watched semantic roots have not changed in the checked-out lineage after the audit baseline.

It must not auto-promote a PR, Issue, test pass or green CI run into `MATCH`.

## Pass condition

M1 passes only when both the machine integrity gate and a repo-only cold-restart reading produce the same current-state model.
