# M2 Contract Architecture Plan — candidate

Status: AUDITED CANDIDATE / design only  
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

M2 resolves three ID families, but semantic identity does **not** depend on the legacy verification registry.

1. Product nodes: `P-*` and resolved `Q-*` IDs defined by the canonical tables in `docs/product-requirements.md`.
2. Contract semantic nodes: stable inline `<!-- clause: ID -->` markers scanned directly from active Markdown contracts listed by `manifest.json`.
3. Acceptance scenario nodes: `ACC-*` scenario IDs from `docs/acceptance/scenarios.json`.

Product-node resolution must be deterministic:

- a `P-xx` definition is a requirement-table row whose first cell is exactly that ID;
- a `Q-xx` definition is a recovery/product-decision table row whose first cell begins with that ID and is explicitly marked resolved/decided;
- ordinary prose mentions such as “P-08” are references, not definitions;
- a targeted product ID must resolve to exactly one definition row.

Contract semantic IDs are discovered from active contract source markers, not from `traceability.json`. The validator rejects duplicate inline IDs across active contracts.

This separation is intentional: semantic meaning can exist before M3 binds verification evidence to it.

No separate copy of node prose is stored in the graph. A node's meaning always comes from its owning Product Requirement or active contract source.

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

Owns file-level registration and broad domain ownership:

- contract ID;
- active/generated lifecycle;
- path;
- `authorityFor` domain labels;
- historical `supersedes`.

`manifest.milestone` should be removed because Project State owns current milestone.

`dependsOn` remains for M2 as a **coarse file-level dependency / compatibility declaration only**. It is not semantic authority and must not be used to infer clause meaning or impact. M2 does not remove a currently consistent field merely to make the new graph look cleaner; a later hygiene phase may retire it if it proves redundant.

`owner` is process-role metadata and is explicitly outside M2; M4 may rename/rework it.

`verifiedBy` / `lastVerifiedCommit` remain M3-owned compatibility fields. M2 may refresh their values when current gates require it, but does not redesign their meaning.

### 8.2 `traceability.json`

After M2 it is a **verification-binding compatibility registry**, not the source of semantic identity and not a second contract body.

M2 removes duplicated normative prose fields:

- `rule`
- `precondition`
- `resultingBehavior`
- `failureBehavior`
- `invariant`

Existing verification fields may remain for M3:

- `verificationDisposition`
- `verifiedBy`
- `manualProcedure`
- explicit pending-decision linkage where still required by current Project State machinery.

`acceptedBy` is removed because it duplicates `scenario.verifies`. Reverse accepted-by views are generated from scenarios.

The three `ACC-ACCEPT-00*` pseudo-semantic clauses are removed. They describe registry mechanics, not product/engine meaning. Their structural requirements become direct `check-docs` invariants.

A semantic inline clause is no longer required to have a traceability row merely to exist. A traceability row, when present, must resolve to an existing semantic ID. This allows M2 to introduce semantic anchors without pretending that M3 verification already exists.

### 8.3 `scenarios.json`

Scenario content remains here.

`verifies` is the only authored scenario→semantic verification claim.

`contractRefs` is removed as an authored field because contract ownership is derivable from each `verifies` target. The current extra UI-architecture reference in `ACC-UI-RESP-001` has no demonstrated machine consumer and does not justify a new `contextRefs` relation. Context that is only explanatory remains in scenario preconditions/tags/prose.

M2 does not add missing behavioral acceptance coverage. It only makes existing verification claims one-directional and structurally consistent.

## 9. Required new stable UX anchors

The M0 reconciliation created five semantic groups that are important downstream but currently have no stable clause ID.

M2 should add only these anchors:

- `UX-CONST-MANUAL` — Section 3 Manual Resolution ownership / parent effect application;
- `UX-CONST-CHOICE` — Section 8 Choice Authority / Choice Signal;
- `UX-CONST-GRANTED-ACTION` — Section 8 effect-granted independent Magic action;
- `UX-CONST-INFORMATION` — Section 11 intended audience / Look / Reveal / Move;
- `UX-CONST-RECOVERY` — Section 10 narrowly-defined Room Owner recovery proxy.

Do not assign IDs mechanically to all 33 constitutional invariants.

The five anchors exist because downstream ownership/impact must reference them; that is the stable-ID threshold.

These anchors are semantic identities only. M2 must not fabricate `acceptedBy`, test bindings, or passing evidence for them. M3 owns that work.

## 10. Initial authority map

The first M2 map must stay sparse and include only relations supported by the current source text.

### Product → interaction refinement

High-confidence initial edges:

- `UX-CONST-MANUAL refines P-06`
- `UX-CONST-HOLD refines P-04`
- `UX-CONST-CHOICE refines P-04`
- `UX-CONST-CHOICE refines P-06`
- `UX-CONST-GRANTED-ACTION refines P-04`
- `UX-CONST-UNDO refines P-08`
- `UX-CONST-INFORMATION refines P-06`
- `UX-CONST-INFORMATION refines P-10`
- `UX-CONST-RECOVERY refines Q-01`

Do **not** create an edge merely because the concepts are adjacent.

In particular:

- `Q-02` currently owns the irreversibility of confirmed elimination/end in Product Requirements, but the existing `UX-CONST-ELIMINATION` text does not explicitly encode that irreversibility. Therefore M2 must not assert `UX-CONST-ELIMINATION refines Q-02` unless the active UX source is separately reconciled.
- P-03 cross-mode semantic consistency is broader than Manual Resolution itself; no `UX-CONST-MANUAL → P-03` edge is required.
- P-07 causality/continuation is broader than HOLD or an effect-granted action; do not add those refinement edges without a more direct clause-level basis.

### Lower-domain constraints

High-confidence initial constraints:

- `ENG-CMD-004 constrainedBy UX-CONST-MANUAL`
- `ENG-CMD-R6-001 constrainedBy UX-CONST-UNDO`
- `ENG-TURN-R6-002 constrainedBy UX-CONST-HOLD`
- `ENG-MP-005 constrainedBy UX-CONST-ELIMINATION`
- `ENG-MP-005 constrainedBy UX-CONST-RECOVERY`

Do not map `UX-CONST-INFORMATION` to `ENG-ZONES-001` merely because both mention private zones. `ENG-ZONES-001` does not own intended-audience / Reveal semantics and currently mixes zone ownership/keying with visibility language. Until an active lower-domain clause actually owns information-audience semantics, the missing lower relation is a visible contract gap rather than an invented edge.

Do not invent a lower contract node merely to make every UX node have a child. Absence of a lower semantic node is valid M2 output.

## 11. Graph invariants

The M2 validator must enforce:

1. every semantic-map endpoint resolves to an existing Product definition or active-contract inline semantic ID;
2. every `scenario.verifies` target resolves to an existing semantic ID;
3. `from != to`;
4. duplicate edge tuples are rejected;
5. `refines` and `constrainedBy` together form an acyclic semantic dependency graph;
6. reverse semantic edges are never authored;
7. inline contract semantic IDs are globally unique across active contracts;
8. product definition IDs targeted by the graph resolve exactly once;
9. active semantic meaning is never stored as prose in `semantic-map.json`;
10. Product Requirements, active contract sources, and acceptance scenarios remain their own source of truth;
11. traceability rows may bind verification to semantic IDs but do not define semantic existence;
12. Project State verdicts are never inferred from graph connectivity or verification presence.

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

M2-1 through M2-3 are implementation-order boundaries, not independently mergeable semantic releases. Because `docs/contracts` and `docs/acceptance` are M1 watched roots, the implementation should stay on one candidate branch until M2-4 performs one bounded M1 re-audit/rebaseline.

Do not open a merge-ready PR from an intermediate stale state.

### M2-1 — Semantic identity and edge substrate

- add `semantic-map.json` schema v1;
- add semantic-node discovery from Product definition rows and active-contract inline markers;
- add validator support for endpoint uniqueness, edge type and DAG invariants;
- populate only reviewed high-confidence `refines` / `constrainedBy` edges;
- treat current manifest `dependsOn` as coarse/non-semantic;
- no gameplay changes;
- no verification behavior changes.

Exit: the map can answer authority/dependency questions without prose duplication or traceability ownership.

### M2-2 — Stable anchors

- add the five UX inline stable anchors;
- validate them through semantic-node discovery, not by fabricating verification rows;
- add reviewed semantic edges for those anchors;
- fix stale version-string authority wording such as `ENG-MP-004` by referring to the active UX Constitution/stable authority instead of “v6.3”;
- do not add acceptance evidence.

Exit: the M0-reconciled interaction semantics are addressable without pretending they are implemented or verified.

### M2-3 — Registry de-duplication and compatibility migration

- make `scenario.verifies` the single authored scenario→semantic verification claim;
- remove authored `acceptedBy` and derive reverse views;
- remove authored `contractRefs`; derive related contract IDs from `verifies` when a view needs them;
- remove duplicated normative prose from traceability;
- remove `ACC-ACCEPT-00*` pseudo-semantic clauses and enforce those structural rules directly in `check-docs`;
- remove stale `manifest.milestone`;
- retain `manifest.dependsOn` as explicitly non-semantic compatibility metadata;
- preserve M3-owned `verifiedBy` / `automatedBy` / `lastVerifiedCommit` behavior.

Compatibility choreography is required because current `check-docs` pins `traceability.json` bytes into every active contract's verification baseline:

1. land the final M2 semantic/registry bytes on the candidate branch at commit **S**;
2. update every affected active contract's `lastVerifiedCommit` to **S** in a later compatibility commit;
3. run the existing full verification chain;
4. do not interpret the metadata refresh as semantic MATCH.

Exit: the current bidirectional-drift class is structurally impossible while current verification behavior still works.

### M2-4 — Bounded M1 re-audit + cold restart

After M2-1 through M2-3 are complete:

- re-audit all M1 capabilities against the final M2 semantic state;
- preserve every MATCH/GAP/CONFLICT/UNKNOWN verdict unless independent evidence requires a change;
- choose the post-compatibility contract commit as the new M1 baseline;
- because that baseline is a feature-branch commit, merge the final M2 implementation PR with a normal merge commit (not squash/rebase) so the audited baseline remains in canonical main ancestry; alternatively perform a separate post-merge rebaseline before claiming M2 complete;
- update capability `auditedAtCommit` and generated Project State;
- verify there are no watched-root changes after the new baseline;
- run repo-only cold restart.

The cold restart must prove a fresh reader can answer:

- who owns P-04/P-08/P-10;
- how HOLD, Choice, effect-granted action, Undo, Information and Recovery connect to product requirements;
- which lower clauses are constrained by those UX semantics;
- where a lower semantic relation is intentionally absent;
- which acceptance scenarios claim to verify existing semantic nodes;
- which M0 semantics remain unverified for M3;
- that M1 verdicts remain unchanged unless separately justified.

Exit: canonical main can consume M2 without prior chat and without a second truth system.

## 14. M2 acceptance criteria

M2 implementation is complete only if:

- no active semantic prose is duplicated into `semantic-map.json`;
- traceability no longer duplicates contract semantic prose;
- semantic identity is discoverable independently from verification binding;
- no authored reverse verification edge remains;
- current `acceptedBy` / `verifies` drift class is impossible by schema;
- Product Requirements participate in the graph without being reclassified as a contract;
- the five M0-reconciled semantic groups have stable anchors without fake verification;
- file-level manifest ownership and clause-level semantic authority are distinguishable;
- `manifest.milestone` no longer competes with Project State NOW;
- `manifest.dependsOn` is explicitly non-semantic and does not compete with the semantic graph;
- graph cycles, duplicate semantic IDs and unresolved endpoints fail CI;
- known unsupported mappings such as Q-02 irreversibility and lower information-audience ownership remain explicit gaps rather than false edges;
- current verification pinning remains functional through the explicit compatibility rebaseline;
- final Project State freshness is restored after all watched-root changes;
- M1 capability verdicts do not change merely because the architecture became clearer;
- M3 has a clean handoff for verification/freshness without M2 claiming test success;
- the new machinery remains small enough that a human can inspect the semantic edge set directly.

## 15. Explicitly deferred to M3

M2 does not add the missing acceptance coverage itself.

M3 must decide and bind verification for at least:

- Choice: B signals a required choice, signal itself does not mutate canonical state, parent owner applies the effect;
- effect-granted action: B performs the granted Cast without HOLD while A retains parent Resolution;
- Undo recovery: strict newest-first, actor-owned normal Undo, Room Owner proxy only for unavailable actor at current top;
- information: intended-audience Look / Table Reveal / Move distinction.

The M2 graph makes those obligations addressable; M3 makes them executable/fail-closed.

## 16. Independent-audit risks and rollback

The independent M2-PLAN audit identified and corrected these design risks:

- **false authority edges** — adjacency is not refinement; unsupported Q-02 and Information→Zones edges were removed;
- **semantic identity coupled to verification** — inline contract markers now define semantic identity independently from traceability;
- **M1 freshness omission** — all watched-root changes are now followed by one bounded final M1 re-audit/rebaseline before merge;
- **verification-pin blast radius** — traceability migration now includes an explicit all-affected-contract compatibility rebaseline;
- **baseline ancestry loss on squash** — the final implementation merge must preserve the audited feature-branch baseline in main ancestry or perform a post-merge rebaseline;
- **unnecessary dependency churn** — `manifest.dependsOn` is retained as coarse non-semantic metadata instead of being deleted during M2;
- **M2/M3 boundary leakage** — new semantic anchors receive no fabricated evidence; missing behavioral acceptance stays in M3.

Remaining general risks:

- over-modeling every sentence;
- treating graph connectivity as proof of implementation;
- adding IDs purely for completeness metrics;
- allowing a compatibility field to quietly regain semantic-authority status.

Rollback rule:

If an M2 structure cannot explain a concrete authority, dependency, cold-restart, or future invalidation need, remove it. If a proposed edge is not directly supported by both endpoint sources, omit the edge and surface the gap.

## 17. M2-PLAN recommendation

Proceed with the four slices above.

The core architecture decision is:

> Keep canonical meaning in Product Requirements and active contracts. Discover semantic IDs directly from those sources, add one sparse prose-free semantic edge map, author scenario verification direction once, and generate reverse views. Keep NOW in Project State and verification/freshness in M3.

Implementation may proceed only with the migration choreography in M2-3/M2-4: current verification pins must be refreshed without semantic promotion, and Project State must be re-audited after all watched-root changes.

This audited candidate is the smallest architecture found that closes the observed authority gaps without introducing a second semantic truth.
