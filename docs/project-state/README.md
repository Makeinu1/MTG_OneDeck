# Canonical Project State

This directory owns **project NOW**: the audited implementation/contract relationship, the active reconstruction milestone, the next gate, lifecycle state, and Owner decisions.

It does **not** restate product rules or contract clauses. It references their canonical sources.

## Read order

1. `docs/generated/project-state.md` — generated human/LLM restart view.
2. `docs/project-state/index.json` — canonical project-level state and the capability index.
3. `docs/project-state/capabilities/*.json` — canonical capability-level audit verdicts.
4. Follow referenced contracts, source and evidence only as needed.

The generated Markdown is derived and must never be edited as an independent truth source.

## Authority boundaries

| Question | Canonical source |
| --- | --- |
| Why/what is the product? | `docs/product-requirements.md` |
| What is the upper interaction authority? | `docs/contracts/ux-constitution.md` |
| Which contracts are active? | `docs/contracts/manifest.json` |
| How do clauses connect to verification? | `docs/contracts/traceability.json` |
| Which acceptance scenarios exist? | `docs/acceptance/scenarios.json` |
| What does implementation currently do? | `src/` and tests |
| What is the current audited MATCH/GAP/CONFLICT and reconstruction gate? | **this Project State** |
| What is extended roadmap/provenance/history? | `research/cr-grounding/cr-backbone-ledger.json` |
| What are Issues/PRs? | Work/history evidence, never current state by themselves |
| What is CI? | Verification/deployment evidence, never semantic correctness by itself |

Canonical Project State says **what the current verdict is**. Existing authorities say **what the rules are**. Source says **what implementation does**. Evidence says **what was checked**.

## Three independent axes

Every capability carries three independent state axes:

- `semanticVerdict`: `UNKNOWN | MATCH | GAP | CONFLICT`
- `deliveryState`: `UNKNOWN | UNPLANNED | PLANNED | ACTIVE_WORK | IMPLEMENTED | VERIFIED`
- `lifecycle`: `ACTIVE | DEPRECATED | RETIRED`

This permits states such as `CONFLICT + IMPLEMENTED + ACTIVE` without hiding the contradiction.

## Transition rules

Semantic transitions require bounded audit judgment; CI, PR or merge status never changes them automatically.

- `UNKNOWN -> MATCH | GAP | CONFLICT` after bounded audit.
- `GAP -> MATCH` only after selected work, implementation, targeted verification, and audit.
- `CONFLICT -> MATCH` only after authority-directed repair, evidence, and audit.
- `MATCH` may regress to `GAP` or `CONFLICT` when a later audit establishes it.

Delivery normally moves `UNPLANNED -> PLANNED -> ACTIVE_WORK -> IMPLEMENTED -> VERIFIED`.
Lifecycle normally moves `ACTIVE -> DEPRECATED -> RETIRED`.

## Freshness policy

`index.json.baseline.commit` is the commit against which the semantic snapshot was audited. `scripts/checks/check-project-state.mjs` fails when a descendant of that baseline changes any configured `watchedRoots` without refreshing Project State. It also checks reference integrity, IDs/enums and generated-view freshness.

The checker intentionally **does not infer semantic verdicts from code**. That belongs to later verification/audit milestones, not M1.

While a PR is open, the merge gate must still rebase/re-audit against the then-current `main`; a branch that has not incorporated a newer main cannot prove that newer main did not invalidate the audit.

## M1 scope boundary

M1 records reality; it does not repair it. R6 implementation, gameplay semantic changes, R4b/R5 redesign, Constitution changes, and M2-M6 orchestration are explicitly out of scope.
