# M3 Verification Harness Plan — candidate

Status: CANDIDATE / design only  
Baseline: `main@195212b139bac814eb5f48068aa6d091572fe7cb`  
Gate: M3-PLAN  
Implementation authority: none

## 1. Goal

Build the smallest verification harness that can answer, for an explicit repository candidate:

1. Which M2 semantic nodes are affected by this change?
2. Which Acceptance scenarios claim to verify those nodes?
3. Which current evidence bindings must be executed or inspected?
4. Which obligations are automated, manual, deferred, unbound, stale, failed or current?
5. Can the candidate pass the verification gate without confusing test success with semantic MATCH?

M3 turns the M2 Semantic Control Plane into an executable verification control plane.

It does **not** change Product Truth, UX semantics, implementation behavior, M1 semantic verdicts or work ownership.

## 2. Reconstruction story

The milestone chain remains layered:

- **M0 — Constitution / Truth** owns WHY/WHAT and interaction authority.
- **M1 / M1.1 — Canonical Project State** owns NOW, bounded MATCH/GAP/CONFLICT/UNKNOWN verdicts and semantic freshness.
- **M2 — Contract Architecture** owns semantic identity, semantic ownership/dependency and authored Acceptance→semantic claims.
- **M3 — Verification Harness** owns evidence binding, change impact, execution selection, evidence freshness and fail-closed verification.
- **M4 — Work Protocol / SOW** will own how bounded work is delegated, reviewed and escalated.
- **M5 — Audit / Hygiene / Recovery** will own drift/dead-state detection and recovery from interrupted/corrupted work.
- **M6 — Closed Execution Loop** will compose inspect → plan → work → verify → repair → audit under M0–M5 controls.
- **M7 — Normal Product Development** resumes normal product change after the reconstruction loop is trustworthy.

M3 must not absorb M4 process authority, M5 hygiene ownership or M6 orchestration.

## 3. Frozen inputs

M3 treats these as inputs, not redesign targets:

### Product Truth

`docs/product-requirements.md`

Especially:

- P-03 semantic consistency
- P-04 Parent Resolution / Choice / effect-granted action / HOLD
- P-06 Manual Resolution / Look / Reveal / Move
- P-08 strict shared chronological actor-owned Undo
- P-09 continuation / recovery
- P-10 hidden information / Audience
- P-15 development convergence / manageable scale
- Q-01 narrow Room Owner recovery
- Q-02 confirmed elimination/end irreversibility

### UX Truth

`docs/contracts/ux-constitution.md`

Including stable M2 anchors:

- UX-CONST-MANUAL
- UX-CONST-HOLD
- UX-CONST-CHOICE
- UX-CONST-GRANTED-ACTION
- UX-CONST-UNDO
- UX-CONST-INFORMATION
- UX-CONST-ELIMINATION
- UX-CONST-RECOVERY

### M1 current reality

Preserve unless separate implementation evidence requires an M1 re-audit:

MATCH:
- CR-01
- CR-02
- CR-03
- CR-09
- CR-10
- CR-13

CONFLICT:
- CR-04
- CR-12

GAP:
- CR-05
- CR-06
- CR-07
- CR-08
- CR-11

UNKNOWN:
- CR-14 OPTIONAL
- CR-15 REQUIRED

A passing verifier does not convert these verdicts.

### M2 architecture

Canonical semantic identity remains:

- Product definition rows for P-* / resolved Q-*;
- active-contract inline `<!-- clause: ID -->` markers;
- Acceptance scenario IDs.

Canonical semantic relations remain:

- `refines`
- `constrainedBy`
- `scenario.verifies`

M3 may consume these. It must not author reverse semantic edges or duplicate semantic prose.

## 4. Current verification inventory

At the M3 baseline:

- 61 traceability verification rows;
- 42 `automated`;
- 16 `acceptance`;
- 2 `manual`;
- 1 `deferred-needs-decision`;
- 29 unique evidence paths;
- all current direct automated evidence paths are Vitest test files;
- 31 Acceptance scenarios: 29 active, 1 deferred, 1 periodic;
- 17 manual-only scenarios, 14 automated scenarios;
- 14 semantic-map edges;
- 14 active manifest contracts share one historical `lastVerifiedCommit` pin.

Current verification is split across:

- `traceability.json.verifiedBy`;
- `scenarios.json.automatedBy`;
- `manifest.json.verifiedBy`;
- `manifest.json.lastVerifiedCommit`;
- `check-docs`;
- `check:fast` / validation domains;
- full machine/release checks.

The components are individually useful but do not yet form one semantic-aware invalidation/execution loop.

## 5. Core distinction: truth, claim, evidence, result, verdict

M3 must keep five concepts distinct.

### 5.1 Semantic truth

Owned by Product Requirements and active contracts.

### 5.2 Verification claim

Owned by `scenario.verifies`.

A scenario says what semantic node it intends to verify.

### 5.3 Evidence binding

Owned by M3 verification metadata.

It says which executable/manual evidence is relevant to a semantic node or scenario.

It does not say the evidence currently passes.

### 5.4 Execution result / freshness

Computed for an explicit candidate/base pair.

Examples:

- PASS
- FAIL
- MANUAL_REQUIRED
- DEFERRED
- UNBOUND
- NOT_RUN

Freshness examples:

- CURRENT
- STALE
- UNKNOWN

These are verification states, not semantic verdicts.

### 5.5 Semantic verdict

Owned by M1 Project State:

- MATCH
- GAP
- CONFLICT
- UNKNOWN

M3 never computes a semantic verdict from a test result.

## 6. Evidence roles

A major M3 risk is calling any existing test “proof” of semantic conformance.

M3 must distinguish at least:

### `conformance`

Evidence whose oracle directly evaluates the bound semantic requirement.

### `characterization`

Evidence that records current implementation behavior but does not establish that the behavior matches the semantic authority.

This distinction is required for cases such as CR-12, where executable rollback tests can be current and green while the M1 semantic verdict remains CONFLICT.

Do not add additional evidence-role categories unless a concrete current binding cannot be represented by these two.

## 7. Verification binding registry

M3 should reuse `docs/contracts/traceability.json` rather than create a second authored **direct-evidence** registry.

Its M3 role becomes:

> optional semantic-ID → direct evidence-binding metadata

It must remain unable to create semantic identity, and a semantic node is **not required** to have a traceability row merely to exist or to be Acceptance-verified.

Acceptance-backed semantics are owned by `scenario.verifies` plus the scenario execution/manual binding. Product nodes and stable UX anchors may therefore be verified only through Acceptance without receiving synthetic traceability rows.

### Proposed schema direction

Move from misleading “currently verified” wording:

`verifiedBy`

toward stable binding wording:

`evidenceBindings`

Conceptual example:

```json
{
  "id": "ENG-CMD-003",
  "contractId": "CONTRACT-ENGINE-COMMANDS",
  "status": "active",
  "sourcePath": "docs/contracts/engine/commands-and-transactions.md",
  "sourceMarker": "clause: ENG-CMD-003",
  "verificationDisposition": "automated",
  "evidenceBindings": [
    {
      "kind": "automated",
      "role": "conformance",
      "path": "src/store/__tests__/interactionUndo.test.ts",
      "marker": "verifies: ENG-CMD-003"
    }
  ]
}
```

No PASS/FAIL/freshness or semantic prose belongs in this registry.

Evidence-role migration must be independently reviewed row by row. Existing `verifiedBy` entries must **not** be bulk-defaulted to `conformance`; where a current test only characterizes implementation behavior, bind it as `characterization`.

### Acceptance-backed semantics

The current 16 `verificationDisposition: acceptance` traceability rows are M2 compatibility residue: their only useful relation is already authored by `scenario.verifies`.

After scenario execution bindings are structurally validated, M3 should retire those redundant acceptance rows rather than promote them into permanent duplicate metadata.

For Acceptance-backed semantics:

- the semantic claim is derived only from `scenario.verifies`;
- scenario execution binding remains on the Acceptance scenario;
- no traceability row is required;
- do not duplicate scenario IDs into reverse traceability arrays.

### Manual / deferred

Keep only stable metadata needed to explain the obligation:

- `manualProcedure`
- `needsDecision`

Do not pretend these are green because a structure exists.

## 8. Acceptance execution binding

`docs/acceptance/scenarios.json` remains the Acceptance specification.

M3 owns execution binding fields such as the current `automatedBy`.

A scenario contains:

- scenario ID;
- semantic targets via `verifies`;
- preconditions;
- steps;
- oracle;
- automated execution binding when one exists;
- manual/deferred status where automation does not exist.

M3 should not add a generic scenario DSL or workflow engine.

Acceptance scenario markers/bindings are verification metadata only; they do not make a scenario pass and do not alter its oracle.

All current automated scenario bindings are test-file paths; M3 should reuse that reality.

Current `automatedBy` test files do not contain stable Acceptance scenario markers. During M3 migration, automated scenarios should gain a lightweight machine-checkable binding marker (for example `scenario: ACC-...`) in their bound test file, or an equally narrow explicit binding mechanism. Once migrated, the checker must reject an `automatedBy` path that does not prove it is bound to that scenario.

Do not infer scenario coverage merely because a test file name looks related.

## 9. Required missing Acceptance specifications

M2 intentionally left four M0-reconciled semantics without fabricated verification.

M3 must define explicit behavioral Acceptance specifications for at least:

### Choice Authority

Required behavior:

- A owns parent Resolution;
- B owns B's Magic-required choice;
- B's choice signal itself does not mutate canonical state;
- A applies the parent effect after receiving the choice;
- secret choice preserves intended audience.

### Effect-granted action

Required behavior:

- A owns parent Resolution;
- effect explicitly permits/instructs B to perform a bounded Magic action;
- B acts as that action's actor;
- B does not request HOLD;
- A retains parent Resolution;
- parent resumes after the granted action commits.

### Undo recovery

Required behavior:

- one strict newest-first shared history;
- normal Undo belongs to the operation actor;
- Room Owner proxy is available only when that actor is unavailable and that actor's operation is the current undoable top;
- learned information is not erased;
- Q-02 irreversible elimination/end is not silently crossed.

This Acceptance must not convert the current CR-12 CONFLICT to MATCH.

### Information / Audience

Required behavior:

- self / specific participant(s) / table are distinct;
- Look / Reveal / Move are distinct;
- Reveal changes audience, not zone;
- parent/HOLD/Room Owner authority does not widen hidden-information access;
- reconnect/view changes do not widen audience.

If current implementation cannot pass these scenarios, M3 records them as unverified/deferred obligations. It does not fabricate green evidence.

## 10. Semantic fingerprinting

M3 change impact should operate on semantic units, not only files.

### Product definitions

Compare normalized definition rows per P/Q ID between explicit base and head.

A changed definition invalidates that Product semantic ID.

If parsing becomes ambiguous, fail closed to all Product IDs in the file rather than guessing.

### Active contract clauses

Compare semantic clause segments identified by inline clause markers.

A changed semantic segment invalidates that clause ID.

Text in an active contract that changes outside a resolvable clause segment must conservatively invalidate all semantic IDs owned by that file.

M3 must not require adding IDs to every sentence merely to improve diff precision.

### Acceptance scenarios

Compare scenario objects by scenario ID.

A changed scenario invalidates that scenario's execution freshness and all of its authored `verifies` claims for the candidate.

No hashes need to be persisted in semantic sources; fingerprints are computed from base/head content.

## 11. Semantic change propagation

M2 edges are directional:

- specific `refines` broader;
- domain owner `constrainedBy` external semantic constraint.

For invalidation, M3 derives reverse impact in memory:

> when a target changes, its dependent `from` nodes must be reconsidered.

Example:

`P-08` changes
→ `UX-CONST-UNDO` impacted
→ `ENG-CMD-R6-001` impacted
→ scenarios verifying those nodes impacted.

Reverse edges are generated, never authored.

Changing a specific refiner does not automatically invalidate the broader target.

## 12. Implementation and evidence-path impact

Semantic-source changes are not the only invalidation input.

### Evidence file changes

If an evidence file itself changes:

- every semantic binding using that evidence path is impacted;
- every Acceptance scenario using that `automatedBy` path is impacted.

This prevents modified tests from being treated as automatically fresh merely because the contract text did not change.

### Implementation source changes

A production/source-code change may alter behavior even when no semantic source or bound test file changed.

M3 must reuse the existing validation-domain resolver:

1. changed implementation files select validation domains;
2. domains select concrete test files;
3. selected test files are reverse-mapped to semantic direct-evidence bindings and Acceptance `automatedBy` bindings;
4. those semantic/scenario obligations become part of the M3 impact report;
5. tests selected by domain safety remain selected even when no semantic binding exists.

This gives M3 an explanation path from implementation diff → existing safety domain → test evidence → semantic/scenario obligation without inventing a second implementation ownership map.

If a changed implementation path is unknown to the domain resolver, retain the existing full-check escalation and report semantic impact as UNKNOWN rather than guessing.

If an automated evidence path cannot be resolved to an executable test lane, fail closed rather than silently skipping it.

## 13. Execution selection

M3 should reuse current verification infrastructure.

Current direct automated evidence is Vitest-based.

Initial M3 execution rule:

- paths under `src/engine/` run in Vitest project `core`;
- current non-engine test evidence runs in project `dom`;
- deduplicate test files before execution.

Reuse/refactor the existing test-project and validation-domain logic rather than building a new generic runner.

If a future evidence binding needs a non-Vitest executor, add an explicit named executor only for that demonstrated need.

Do not add arbitrary shell commands to authored JSON.

## 14. Verification gates and plan

M3 needs two distinct machine surfaces.

### Structural integrity gate

A base-independent gate (for example `check:verification`) validates:

- binding schemas;
- semantic endpoint existence;
- evidence paths/markers;
- scenario execution binding integrity;
- no duplicate/reverse metadata;
- no malformed role/disposition.

This belongs in ordinary `npm run check` and can run on any checkout.

It must not claim that candidate-specific manual or automated evidence is current.

### Candidate verification gate

A candidate-specific gate (for example `verify:semantic --base <sha> --head <sha>`) computes impact/freshness and is the gate that may say candidate evidence is established.

The base/head pair must be explicit. M3 must not silently guess a semantic verification base.

`check:fast --base ... --head ...` and PR/release workflows can invoke this gate with their already-known diff base.

A release flow that omits an explicit base may still run full structural/general safety checks, but it must not claim M3 candidate semantic verification.

### Verification plan

For explicit `base` and `head`, M3 generates an ephemeral plan containing:

- directly changed semantic IDs;
- transitively impacted semantic IDs;
- impacted Acceptance scenarios;
- direct automated evidence paths;
- scenario automated evidence paths;
- manual obligations;
- deferred decisions;
- unbound obligations;
- reason/provenance for every selected item.

This plan is generated output, not canonical semantic state.

The plan must be deterministic for the same repository/base/head.

## 15. Verification result model

Execution output keeps separate dimensions.

Example conceptual result:

```text
semantic: UX-CONST-UNDO
impact: TRANSITIVE
evidence:
  automated: PASS
  acceptance: MANUAL_REQUIRED
freshness: CURRENT_FOR_CANDIDATE
semanticVerdict: NOT_COMPUTED
```

Never output:

`semanticVerdict: MATCH`

from verification execution.

The harness may report the existing M1 verdict as context, but it must label it as Project State input.

## 16. Manual evidence boundary

M3 must surface manual obligations explicitly.

Initial M3 behavior:

- impacted manual-only Acceptance produces `MANUAL_REQUIRED`;
- no automatic green result is manufactured;
- M3 defines the machine-readable requirement and freshness target;
- M4 will standardize who performs, approves and records bounded manual work.

M3 should not invent a broad reviewer/approval workflow.

If implementation requires a minimal manual evidence receipt format, it must be narrowly scoped to:

- scenario ID;
- exact candidate/semantic fingerprint;
- pass/fail result;
- evidence reference.

Process roles, assignments and escalation policy remain M4.

## 17. Deferred decisions

`deferred-needs-decision` is not failure and not pass.

It is a blocking unresolved verification state when the affected semantic is in the candidate impact set.

`CONFLICT-TURN-DRAW-001` remains surfaced through Project State.

M3 must not resolve that Product/contract judgment automatically.

## 18. Freshness

M3 should retire the idea that one historical file-level commit pin proves all current semantic evidence.

Freshness is candidate-relative:

> was the required evidence for the impacted semantic/scenario set executed or explicitly satisfied against this candidate?

Do not store freshness inside:

- semantic-map;
- Product Requirements;
- active contract prose;
- M1 semantic verdicts.

### Manifest migration

Current manifest:

- `verifiedBy`
- `lastVerifiedCommit`

are M3-owned compatibility fields.

Once the M3 harness provides equivalent/firmer fail-closed protection, retire these file-level fields from active manifest entries.

This removes the M2-observed all-contract pin blast radius.

Migration must be staged; do not remove the old gate before the replacement gate is green.

## 19. Relationship to check:fast

`check:fast` currently answers:

> which broad validation domains/tests should run for changed files?

M3 answers:

> which semantic obligations and evidence bindings are impacted?

These are complementary.

M3 must not delete useful domain-level safety fallback.

Recommended composition:

1. compute semantic verification plan;
2. compute existing domain validation plan;
3. union required tests;
4. unknown/unmapped change escalates conservatively;
5. full release checks remain available as final safety net.

A semantic-aware narrow plan must never reduce existing safety because it happens to know fewer nodes.

## 20. Fail-closed conditions

At minimum M3 fails closed on:

1. impacted semantic ID whose available direct/Acceptance verification metadata is malformed;
2. impacted semantic ID with neither direct evidence nor an Acceptance claim when verification is required (`UNBOUND`);
3. automated disposition with no executable evidence binding;
4. evidence binding path missing;
5. direct evidence marker missing or points to another semantic ID;
6. automated Acceptance binding missing its scenario marker after migration;
7. scenario `verifies` unresolved;
8. impacted active/deferred scenario with no usable execution/manual disposition;
9. unknown semantic-source diff that cannot be mapped safely;
10. unknown implementation path without conservative domain escalation;
11. unknown evidence executor;
12. required automated evidence FAIL;
13. required evidence not run;
14. required manual evidence absent;
15. affected deferred decision unresolved;
16. stale evidence path changed but not rerun;
17. generated verification plan/result inconsistent with base/head.

Fail-closed means “verification not established”, not “semantic CONFLICT”.

## 21. Explicit non-goals

M3 does not:

- modify gameplay behavior;
- repair CR-04 or CR-12;
- change Product Requirements or UX Constitution semantics;
- infer MATCH/GAP/CONFLICT from test results;
- create a generic CI platform;
- replace all existing validation-domain checks;
- execute arbitrary commands from JSON;
- create a generic reviewer workflow;
- define M4 SOW/task protocol;
- perform M5 repository cleanup;
- implement M6 autonomous orchestration;
- turn every source line into a semantic ID;
- require full-project tests for every tiny change when precise fail-closed evidence exists.

## 22. M3 implementation slices

M3 implementation should remain on one candidate branch until final verification migration and bounded M1 re-audit are complete.

### M3-1 — Evidence semantics and missing Acceptance

Implement:

- formal evidence-binding vocabulary;
- `conformance` vs `characterization`;
- independently classify existing direct bindings rather than bulk-defaulting their role;
- migrate `traceability.verifiedBy` toward stable `evidenceBindings`;
- retire redundant `verificationDisposition: acceptance` traceability rows after scenario bindings are validated;
- keep semantic identity external to traceability;
- define Choice / Granted Action / Undo Recovery / Information Acceptance scenarios;
- add/validate lightweight scenario markers for current automated Acceptance bindings;
- no fake pass evidence;
- structural validation for binding ownership and markers.

Exit:

A fresh reader can identify what evidence is supposed to establish, without mistaking binding for result.

### M3-2 — Semantic impact resolver

Implement:

- base/head Product definition comparison;
- active contract clause-segment comparison;
- Acceptance scenario comparison;
- reverse M2 dependency closure;
- evidence-path reverse lookup;
- implementation diff → validation domain → selected tests → semantic/scenario reverse mapping;
- deterministic impact reasons;
- conservative fallback for unmappable semantic or implementation edits.

Exit:

For a candidate diff, the harness deterministically identifies impacted semantic IDs/scenarios/evidence.

### M3-3 — Execution and freshness harness

Implement:

- add a base-independent verification-integrity gate;
- add an explicit-base candidate semantic verification gate;
- generate verification plan;
- map current automated evidence to core/dom Vitest execution;
- union semantic-required tests with existing validation-domain plan;
- execute/deduplicate required automated evidence;
- surface MANUAL_REQUIRED / DEFERRED / UNBOUND;
- separate result from freshness from M1 verdict;
- integrate into ordinary machine/release checks without weakening existing checks.

Exit:

A candidate cannot claim verification if required evidence was skipped/stale/failed.

### M3-4 — Compatibility migration + bounded re-audit + cold restart

After replacement harness is green:

- retire manifest `verifiedBy` / `lastVerifiedCommit` active-contract compatibility fields;
- remove obsolete compatibility behavior from `check-docs`;
- do not remove generated-entry verification metadata unless the replacement covers its distinct generated-file role;
- run full verification chain;
- bounded M1 re-audit only because watched roots changed;
- preserve semantic verdicts unless independent implementation evidence requires change;
- rebaseline Project State once after final watched-root bytes;
- Cold Restart M3.

Cold Restart must prove a fresh reader can reconstruct:

- semantic truth/identity/relations from M0/M2;
- current M1 verdicts;
- verification binding ownership;
- impact propagation;
- selected evidence;
- manual/deferred/unbound obligations;
- freshness model;
- why green verification does not mean MATCH;
- M4 boundary.

Exit:

main can answer “what needs verification for this candidate and why?” without chat history.

## 23. M3 acceptance criteria

M3 is complete only if:

- semantic truth remains outside verification metadata;
- traceability cannot create semantic identity;
- evidence binding and execution result are distinct;
- conformance and characterization are not conflated;
- scenario.verifies remains the sole authored Acceptance→semantic relation;
- Choice / Granted Action / Undo Recovery / Information have explicit Acceptance specifications;
- no fake passing evidence is created for current GAP/CONFLICT semantics;
- base/head impact resolution is deterministic;
- Product and contract semantic changes propagate through M2 dependencies;
- evidence-file changes invalidate their bindings;
- required automated evidence cannot be silently skipped;
- manual/deferred/unbound obligations are explicit and fail closed when impacted;
- current domain-level safety checks are not weakened;
- file-level manifest verification pins can be retired without reducing protection;
- M1 verdicts are not inferred or promoted from M3;
- CR-04 and CR-12 remain visible conflicts unless separate implementation evidence changes reality;
- Project State remains NOW;
- verification plan/result is not another NOW authority;
- full verification chain is green;
- M1 freshness is restored after final watched-root migration;
- Cold Restart PASS;
- no M4/M5/M6 implementation is smuggled into M3.

## 24. Risks and audit questions

Independent audit must challenge at least:

### Over-invalidation

Does changing one semantic clause unnecessarily run the whole repository?

Prefer precise semantic fingerprints, with conservative fallback only when mapping is ambiguous.

### Under-invalidation

Can upstream Product/UX changes leave dependent engine/UI semantics looking fresh?

Reverse M2 dependency closure must prevent this.

### Test tautology

Can changing a test make itself “fresh” without rerun?

Evidence-path changes must select the bound obligation and rerun it.

### Green-test semantic promotion

Can passing characterization tests hide a known M1 conflict?

Evidence role separation and explicit M1 verdict separation must prevent this.

### Manual evidence laundering

Can manual-only scenarios silently become green because a field exists?

No. Impacted manual evidence stays MANUAL_REQUIRED until explicit evidence is supplied.

### Second NOW source

Can a verification result/receipt override Project State?

No. Verification state is evidence state only.

### Framework growth

Is M3 becoming a generic workflow/CI platform?

If a structure has no current semantic/evidence use case, remove it.

## 25. Rollback rule

If a proposed M3 abstraction cannot answer one of:

- what semantic changed;
- what depends on it;
- what evidence is required;
- what must run;
- whether evidence is current;
- why verification is blocked;

then remove it.

If an exact mapping is uncertain, fail closed or broaden execution. Do not guess.

## 26. M3-PLAN recommendation

Proceed with M3-1 through M3-4 after independent audit and Owner approval.

The core architecture decision is:

> Keep truth in M0/M2, NOW/verdicts in M1, and use M3 only to compute candidate-relative evidence obligations and freshness. Reuse traceability as the stable evidence-binding registry, derive impact from M2 semantic relations, reuse existing Vitest/domain execution, and retire coarse historical verification pins only after the replacement harness is demonstrably fail-closed.

M3 implementation must not begin merely because this candidate plan exists. The M3-PLAN gate requires independent audit and Owner approval.
