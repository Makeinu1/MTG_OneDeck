# M2 Contract Architecture Plan — candidate

Status: CANDIDATE / design only  
Baseline: `main@11496a4871b0ab577aec35aa523b3b4719dcce3e`  
Gate: M2-PLAN  
Implementation authority: none

## 1. Goal

Build a small Semantic Control Plane that lets a fresh reader or later machine gate answer:

1. Which repository source owns a semantic decision?
2. Which broader authority does a more specific semantic statement refine or remain constrained by?
3. Which acceptance scenario claims to verify that semantic statement?
4. When an upstream meaning changes, what downstream meaning must be reconsidered?

M2 defines semantic ownership and dependency. It does not implement gameplay, choose product behavior, or decide test execution/freshness policy.

## 2. Non-goals

M2 does not:

- create another prose specification that restates Product Requirements or active contracts;
- introduce a global `Product > UX > Engine > UI` ranking;
- infer semantic correctness from green CI;
- map test file paths, execution lanes, last-pass commits, or invalidation algorithms — those belong to M3;
- change any current M1 MATCH/GAP/CONFLICT/UNKNOWN verdict;
- implement R6 behavior;
- add a generic ontology, permission framework, or future-proof graph platform;
- require every sentence or every constitutional invariant to receive an ID.

The graph exists only where a stable cross-source semantic relation is useful.

## 3. Current inventory

Current active sources:

- Product WHY/WHAT: `docs/product-requirements.md`
- interaction authority: `docs/contracts/ux-constitution.md`
- file-level contract registry: `docs/contracts/manifest.json`
- clause/verification registry: `docs/contracts/traceability.json`
- acceptance registry: `docs/acceptance/scenarios.json`
- canonical NOW/verdicts: `docs/project-state/index.json` + capability files

Current structural facts at the baseline:

- 15 manifest entries, 14 active contracts, 1 generated entry;
- 64 traceability clauses;
- 31 acceptance scenarios: 29 active, 1 deferred, 1 periodic;
- active manifest `dependsOn` has no unresolved references, no cycles, and no duplicate `authorityFor` ownership;
- `manifest.milestone` still says `VALIDATION-HARDENING-2026-08`, although Project State now owns current milestone/gate;
- clause `acceptedBy` and scenario `verifies` are stored in both directions and have substantial drift;
- scenario `contractRefs` is almost derivable from `verifies`; the exceptional case is contextual rather than verification ownership;
- traceability duplicates contract prose through fields such as `rule`, `resultingBehavior`, `failureBehavior`, and `invariant`;
- `verifiedBy`, `automatedBy`, and `lastVerifiedCommit` mix verification execution/freshness into the same structures that describe semantic ownership;
- `owner: judge` is workflow/process metadata, not semantic ownership;
- `ENG-MP-004` contains a stale literal reference to UX Constitution v6.3 even though v6.4 is active. Stable IDs/relations should replace version-string authority coupling.

These are architecture problems, not reasons to reinterpret Product Truth.

## 4. Authority model

M2 uses domain ownership rather than one global precedence ladder.

### 4.1 Product Requirements

`P-01` through `P-15`, plus stable resolved product-decision IDs such as `Q-01` and `Q-02`, own product outcome/value boundaries.

Product Requirements is not renamed into a “contract”. Its existing IDs are valid graph roots.

### 4.2 UX Constitution

Stable `UX-CONST-*` clauses own interaction semantics: human authority, Manual Resolution, HOLD, Choice Authority, effect-granted actions, Undo, information audience, recovery, etc.

### 4.3 Engine/UI contracts

`ENG-*`, `UI-*`, and `AV-*` clauses own their domain semantics. They may refine or be constrained by Product/UX authority, but they do not become subordinate in unrelated domains.

### 4.4 Acceptance

`ACC-*` scenarios are evidence specifications. They do not own product or engine semantics. They may claim that they verify semantic nodes.

### 4.5 Project State

Project State owns NOW and semantic verdicts. It consumes M2 structure but does not become part of the semantic graph.

## 5. Semantic node universe

M2 resolves only three existing ID families:

1. Product nodes: `P-*` / resolved `Q-*` IDs parsed from `docs/product-requirements.md`.
2. Contract-clause nodes: stable inline clause IDs registered by the active clause registry.
3. Acceptance scenario nodes: `ACC-*` IDs from `docs/acceptance/scenarios.json`.

No separate copy of node prose is stored in the graph.

A node's meaning always comes from its owning source file.

## 6. Relation model

The minimum relation vocabulary is exactly three relations.

### 6.1 `refines`

Direction: **specific → broader**.

Meaning: the source gives a more specific expression of the same product/interaction intent and must not contradict the target.

Examples:

- `UX-CONST-HOLD refines P-04`
- `UX-CONST-UNDO refines P-08`

A change to the target means the refiner must be reconsidered. M3 derives that reverse impact; M2 does not store a reverse edge.

### 6.2 `constrainedBy`

Direction: **domain owner → external semantic constraint**.

Meaning: the source owns its own domain, but its valid design space is limited by the target.

Examples:

- `ENG-CMD-R6-001 constrainedBy UX-CONST-UNDO`
- `ENG-TURN-R6-002 constrainedBy UX-CONST-HOLD`

This relation prevents a false global hierarchy. Engine transaction semantics still belong to the engine contract; UX owns the interaction constraint.

### 6.3 `verifies`

Direction: **acceptance scenario → semantic node**.

The authoritative storage for this relation remains `scenario.verifies` in `docs/acceptance/scenarios.json`.

M2 must not also store a reverse `acceptedBy` relation. Reverse lookup is generated.

## 7. Physical layout

M2 adds one small edge registry:

`docs/contracts/semantic-map.json`

Target shape:

```json
{
  "schemaVersion": 1,
  "edges": [
    {"from":"UX-CONST-HOLD","type":"refines","to":"P-04"},
    {"from":"ENG-TURN-R6-002","type":"constrainedBy","to":"UX-CONST-HOLD"}
  ]
}
```

No edge rationale/prose is stored. If an edge cannot be understood from the two source clauses, the clauses are not sufficiently legible.

The effective Semantic Control Plane is composed from:

- Product Requirement IDs from `product-requirements.md`;
- active contract/clause IDs from manifest + clause registry;
- `refines` / `constrainedBy` from `semantic-map.json`;
- `verifies` from `scenarios.json`.

This is a logical control plane, not a second prose truth source.

## 8. Existing registry responsibilities after M2

### 8.1 `manifest.json`

Owns file-level registration and broad domain ownership only:

- contract ID;
- active/generated lifecycle;
- path;
- `authorityFor` domain labels;
- historical `supersedes`.

`manifest.milestone` should be removed because Project State owns current milestone.

`dependsOn` must not remain semantic authority. M2 should either retire it or produce any useful contract-level dependency view by collapsing clause-level semantic edges. Do not preserve two normative dependency graphs.

`owner` is process-role metadata and is explicitly outside M2; M4 may rename/rework it.

`verifiedBy` / `lastVerifiedCommit` are M3-owned compatibility fields until verification architecture migrates them.

### 8.2 `traceability.json`

Becomes a thin clause/source registry, not a second contract body.

Normative semantic prose fields should be removed:

- `rule`
- `precondition`
- `resultingBehavior`
- `failureBehavior`
- `invariant`

Current verification fields may remain temporarily only to preserve existing gates until M3 replaces them. They must not be interpreted as M2 semantic ownership.

`acceptedBy` should be removed during M2 because it duplicates `scenario.verifies`.

The pending-decision link currently encoded through `verificationDisposition=deferred-needs-decision` / `needsDecision` should be migrated to an explicit decision reference that Project State can consume without pretending that a semantic decision is a test disposition.

### 8.3 `scenarios.json`

Scenario content remains here.

`verifies` is the only normative scenario→semantic verification relation.

`contractRefs` should not duplicate contracts already derivable from `verifies`. If a scenario truly needs a non-verifying contract for setup/context, retain only that exception as an optional `contextRefs`.

The three `ACC-ACCEPT-00*` meta-clauses describe registry mechanics rather than product/engine semantics. Their structural rules should be enforced by `check-docs`, not by scenarios self-verifying an Acceptance semantic contract.

## 9. Required new stable UX anchors

The M0 reconciliation created five semantic groups that are important downstream but currently have no stable clause ID.

M2 should add only these anchors:

- `UX-CONST-MANUAL` — Manual Resolution ownership / parent effect application;
- `UX-CONST-CHOICE` — Choice Authority / Choice Signal;
- `UX-CONST-GRANTED-ACTION` — effect-granted independent Magic action;
- `UX-CONST-INFORMATION` — intended audience / Look / Reveal / Move;
- `UX-CONST-RECOVERY` — narrowly-defined Room Owner recovery proxy.

Do not assign IDs mechanically to all 33 constitutional invariants.

The five anchors exist because downstream ownership/impact must reference them; that is the stable-ID threshold.

## 10. Initial authority map

The first M2 map should include at least the following high-value edges.

### Product → interaction refinement

- `UX-CONST-MANUAL refines P-03`
- `UX-CONST-MANUAL refines P-06`
- `UX-CONST-HOLD refines P-04`
- `UX-CONST-HOLD refines P-07`
- `UX-CONST-CHOICE refines P-04`
- `UX-CONST-CHOICE refines P-06`
- `UX-CONST-GRANTED-ACTION refines P-04`
- `UX-CONST-GRANTED-ACTION refines P-07`
- `UX-CONST-UNDO refines P-08`
- `UX-CONST-INFORMATION refines P-06`
- `UX-CONST-INFORMATION refines P-10`
- `UX-CONST-RECOVERY refines P-09`
- `UX-CONST-RECOVERY refines Q-01`
- `UX-CONST-ELIMINATION refines Q-02`

These edges express product→interaction ownership without copying the requirement text.

### Lower-domain constraints

- `ENG-CMD-004 constrainedBy UX-CONST-MANUAL`
- `ENG-CMD-R6-001 constrainedBy UX-CONST-UNDO`
- `ENG-TURN-R6-002 constrainedBy UX-CONST-HOLD`
- `ENG-MP-005 constrainedBy UX-CONST-ELIMINATION`
- `ENG-MP-005 constrainedBy UX-CONST-RECOVERY`
- `ENG-ZONES-001 constrainedBy UX-CONST-INFORMATION`

Do not invent a lower contract node merely to make every UX node have a child. Absence of a lower semantic node may be a real implementation/contract gap.

## 11. Graph invariants

The M2 validator must enforce:

1. every edge endpoint resolves to an existing stable ID;
2. `from != to`;
3. duplicate edge tuples are rejected;
4. `refines` and `constrainedBy` together form an acyclic authority/dependency graph;
5. `verifies` originates from an existing acceptance scenario and targets an existing semantic node;
6. reverse edges are never authored;
7. a clause ID has exactly one owning source marker;
8. active semantic meaning is never stored as prose in `semantic-map.json`;
9. Product Requirements, active contract clauses, and acceptance scenarios remain their own source of truth;
10. Project State verdicts are not inferred from graph connectivity or verification presence.

## 12. M2 / M3 boundary

M2 answers:

- who owns meaning;
- how meanings relate;
- what an acceptance scenario claims to verify.

M3 answers:

- which file/test/runtime evidence verifies a node;
- what changed since verification;
- which nodes/scenarios/tests are invalidated by a source change;
- what checks must run;
- what is stale/fail-closed;
- how verification freshness is recorded.

Therefore the following current fields are explicitly M3 concerns:

- manifest `verifiedBy`;
- manifest `lastVerifiedCommit`;
- traceability `verifiedBy`;
- acceptance `automatedBy`;
- machine/path binding and change-impact execution.

M2 may preserve them for compatibility but does not redesign their behavior.

## 13. M2 implementation slices

### M2-1 — Semantic identity and edge substrate

- add `semantic-map.json` schema v1;
- add validator support for Product IDs, clause IDs, scenario IDs and edge invariants;
- populate only reviewed high-value `refines` / `constrainedBy` edges;
- no gameplay changes;
- no verification behavior changes.

Exit: the map can answer authority/dependency questions without prose duplication.

### M2-2 — Stable anchors and one-way acceptance relations

- add the five UX stable anchors;
- update clause registry/checker so a semantic clause can exist without inventing immediate acceptance evidence;
- make `scenario.verifies` authoritative;
- derive reverse accepted-by views;
- remove authored `acceptedBy`;
- replace exceptional non-verifying scenario contract references with `contextRefs`.

Exit: no bidirectional verification edge drift remains.

### M2-3 — Clause registry slimming / decision cleanup

- remove duplicated normative prose from traceability;
- move Acceptance-registry structural invariants into `check-docs`;
- replace deferred-decision encoding with explicit decision reference;
- remove stale manifest milestone;
- retire manifest `dependsOn` as semantic authority and generate any useful file-level dependency view from semantic edges.

Exit: semantic meaning lives only in Product Requirements / active contracts; registries hold IDs/relations only.

### M2-4 — Cold restart and compatibility audit

Using repo-only context, prove a fresh reader can answer:

- who owns P-04/P-08/P-10;
- how HOLD, Choice, effect-granted action, Undo, Information, Recovery connect to product requirements;
- which engine clauses are constrained by those UX semantics;
- which acceptance scenarios verify existing semantic nodes;
- which M0 semantics still lack lower-contract or verification coverage;
- that M1 verdicts remain unchanged.

Exit: M2-PLAN implementation is legible without prior chat and does not create a second truth system.

## 14. M2 acceptance criteria

M2 implementation is complete only if:

- no active semantic prose is duplicated into the graph/registry;
- no authored reverse edge remains;
- current `acceptedBy` / `verifies` drift class is impossible by schema;
- Product Requirements participate in the graph without being reclassified as a contract;
- the five M0-reconciled semantic groups have stable anchors;
- file-level and clause-level authority are distinguishable;
- `manifest.milestone` no longer competes with Project State NOW;
- graph cycles and unresolved endpoints fail CI;
- M1 capability verdicts do not change merely because the architecture became clearer;
- M3 has a clean handoff for verification/freshness without M2 owning test paths;
- the new machinery remains small enough that a human can inspect the entire semantic edge set directly.

## 15. Explicitly deferred to M3

M2 does not add the missing acceptance coverage itself.

M3 must decide and bind verification for at least:

- Choice: B signals a required choice, signal itself does not mutate canonical state, parent owner applies the effect;
- effect-granted action: B performs the granted Cast without HOLD while A retains parent Resolution;
- Undo recovery: strict newest-first, actor-owned normal Undo, Room Owner proxy only for unavailable actor at current top;
- information: intended-audience Look / Table Reveal / Move distinction.

The M2 graph makes those obligations addressable; M3 makes them executable/fail-closed.

## 16. Risks and rollback

Main risks:

- over-modeling every sentence;
- treating graph connectivity as proof of implementation;
- preserving both `dependsOn` and semantic edges as competing dependency truths;
- moving M3 verification concerns into M2;
- adding IDs purely for completeness metrics.

Rollback rule:

If an M2 structure cannot explain a concrete authority, dependency, cold-restart, or future invalidation need, remove it.

## 17. M2-PLAN recommendation

Proceed with the four slices above.

The core architecture decision is:

> Keep canonical meaning in Product Requirements and active contracts. Add one sparse, typed, prose-free semantic edge map. Store verification direction once in acceptance scenarios. Generate reverse views. Keep NOW in Project State and verification/freshness in M3.

This is the smallest architecture that closes the observed authority gaps without introducing a second semantic truth.
