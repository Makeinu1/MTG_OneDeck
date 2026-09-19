# Canonical Project State

This directory owns **project NOW** on `main`: the audited implementation/contract relationship, the active reconstruction milestone, the next gate, lifecycle state, and surfaced decisions.

On a non-main branch, the files in this directory describe a **candidate Project State for that branch** until merged. A branch-local candidate must not be reported as already committed `main` reality.

Project State does **not** restate product rules or contract clauses. It references their canonical sources.

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
| What is the current audited MATCH/GAP/CONFLICT and reconstruction gate? | **this Project State on `main`** |
| What is extended roadmap/provenance/history? | `research/cr-grounding/cr-backbone-ledger.json` under `research/cr-grounding/AUTHORITY.md` |
| What are Issues/PRs? | Work/history evidence, never current state by themselves |
| What is CI? | Verification/deployment evidence, never semantic correctness by itself |
| What is historical Cold Restart evidence? | `docs/project-state/evidence/` |

Canonical Project State says **what the current verdict is**. Existing authorities say **what the rules are**. Source says **what implementation does**. Evidence says **what was checked**.

Fields in other registries that resemble project lifecycle metadata, such as an older contract-manifest milestone or a roadmap `activeProgram` / `nextGate` / planned-sequence field, do not override Project State NOW. CR-grounding material may retain those names as historical provenance; `research/cr-grounding/AUTHORITY.md` explicitly removes their current-work authority.

## Three independent axes

Every capability carries three independent state axes:

- `semanticVerdict`: `UNKNOWN | MATCH | GAP | CONFLICT`
- `deliveryState`: `UNKNOWN | UNPLANNED | PLANNED | ACTIVE_WORK | IMPLEMENTED | VERIFIED`
- `lifecycle`: `ACTIVE | DEPRECATED | RETIRED`

`requirementLevel` is separate from those axes. For example, `UNKNOWN + REQUIRED` is materially different from `UNKNOWN + OPTIONAL` and must remain visible to a restart reader.

This permits states such as `CONFLICT + IMPLEMENTED + ACTIVE` without hiding the contradiction.

## Transition rules

Semantic transitions require bounded audit judgment; CI, PR or merge status never changes them automatically.

- `UNKNOWN -> MATCH | GAP | CONFLICT` after bounded audit.
- `GAP -> MATCH` only after selected work, implementation, targeted verification, and audit.
- `CONFLICT -> MATCH` only after authority-directed repair, evidence, and audit.
- `MATCH` may regress to `GAP` or `CONFLICT` when a later audit establishes it.

Delivery normally moves `UNPLANNED -> PLANNED -> ACTIVE_WORK -> IMPLEMENTED -> VERIFIED`.
Lifecycle normally moves `ACTIVE -> DEPRECATED -> RETIRED`.

## Coverage boundary

Project State is a **bounded audited state model**, not proof that every repository concern has already been enumerated. `index.json.coverage` states the current coverage claim, completeness inputs and known limitations. The capability index defines the currently audited capability set.

The integrity checker fails closed when an active traceability clause marked `deferred-needs-decision` is not surfaced as a Project State pending decision. It also checks the reverse relationship: surfaced acceptance evidence must remain deferred and verify one of the referenced deferred clauses. `OWNER_REQUIRED` cannot exist without an explicitly linked open Owner Decision. This does not replace the broader Contract Architecture completeness work in M2.

## Integrity and freshness policy

`index.json.baseline.commit` is the commit against which the semantic snapshot was audited. `npm run check:project-state` fails when a descendant of that baseline changes any configured `watchedRoots` without refreshing Project State.

The production routing snapshot has a separate `observedAtCommit` and `freshness.watchedPaths`. A routing/deployment change after that observation makes the production map stale even when the semantic audit itself has not changed.

The checker also verifies:

- referenced paths;
- exact/case-sensitive symbol-like locator anchors, while prose locators receive only a best-effort sanity check rather than a semantic proof;
- baseline provenance against the declared `main` branch;
- non-main candidates have incorporated the currently fetched `main`;
- production routing-map references, provenance and routing-path freshness;
- required bounded-coverage inputs and generated-view freshness;
- pending-decision/acceptance linkage and Owner escalation linkage.

The JSON schemas in `docs/project-state/schema/` document the machine shape; the executable integrity gate is `scripts/checks/check-project-state.mjs`. `index.json` schema version 2 is the M1.1 hardening shape; capability state files remain on their independent version-1 schema. The checker intentionally **does not infer semantic verdicts from code**. That belongs to later verification/audit milestones, not Project State integrity.

While a PR is open, the merge gate must still rebase/re-audit against the then-current `main`; a branch that has not incorporated a newer main cannot prove that newer main did not invalidate the audit.

`npm run check` includes `check:project-state`, and `npm run check:release` invokes `npm run check`, so Project State integrity is part of the ordinary release chain rather than a separate green signal.

## Candidate reconciliation before rebaseline

A watched-root change still makes the global semantic epoch stale. Before advancing the baseline, freeze the implementation candidate as exact commits and produce a read-only reconciliation plan:

```sh
npm run plan:project-state-reconciliation -- --base <candidate-base-sha> --head <candidate-head-sha>
npm run plan:project-state-reconciliation -- --base <candidate-base-sha> --head <candidate-head-sha> --json
```

The planner reuses M3 candidate impact and the existing M1 capability references. It emits only:

- `PRESERVATION_CANDIDATE`: no direct M1 reference intersected the known candidate impact. This is **not** proof of non-impact and never preserves a verdict by itself.
- `REVIEW_REQUIRED`: the capability has a direct implementation/evidence intersection, or Product/Contract/Acceptance authority changed.
- `UNKNOWN`: the pre-candidate Project State baseline was already stale, the candidate edits Project State before reconciliation, or M3 reports unknown implementation coverage.

The planner never computes `MATCH/GAP/CONFLICT/UNKNOWN` semantic verdicts, never edits Project State, and never advances `baseline.commit` or any `auditedAtCommit`. M1 remains the semantic-state owner. When the declared `main` ref is available locally, the planner also requires the frozen candidate to contain that current main; a stale candidate is `UNKNOWN` rather than a preservation candidate. After the M1 owner reviews every classification and resolves all `REVIEW_REQUIRED` / `UNKNOWN` entries, the ordinary Project State update may advance the single global epoch and regenerate the human view.

The reconciled `head` is the audited implementation candidate SHA. When the owner accepts that reconciliation, `baseline.commit` / capability `auditedAtCommit` advance to that exact implementation SHA. The later bookkeeping commit that writes Project State and regenerates the human view may sit after that audit point because those Project State files are not watched semantic roots; it must not silently include a further watched-root change.

Run reconciliation **before** editing `docs/project-state/index.json`, capability state files, or the generated Project State view. If those control-plane files are already changed, the planner fails closed rather than accepting circular self-reconciliation.

M2/M3 impact is evidence for scoping the re-audit, not authority to promote or preserve a semantic verdict. Unmapped implementation remains fail-closed through M3 `UNKNOWN_COVERAGE`. This keeps the global epoch safety property while avoiding an automatic assumption that every capability needs the same depth of re-audit.

## Current program boundary

The current active milestone, next gate and prohibited scope live only in `docs/project-state/index.json` and the generated restart view. This README intentionally does not pin a specific milestone's prohibited list, so a completed milestone cannot leave stale scope instructions behind.
