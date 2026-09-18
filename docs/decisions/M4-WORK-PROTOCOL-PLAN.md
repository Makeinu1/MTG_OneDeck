# M4 Work Protocol / SOW Plan — candidate

Status: CANDIDATE / design only  
Baseline: `main@315476b3156b53b4eb01139a7aa48ada3b908233`  
Gate: M4-PLAN  
Implementation authority: none

## 1. Goal

Define the smallest reusable work protocol that lets a human or LLM hand one bounded unit of MTG OneDeck work to another execution context without transferring or duplicating project authority.

M4 standardizes:

- Goal;
- Scope;
- Authority references;
- Inputs;
- Constraints;
- Acceptance / evidence intent;
- Definition of Done;
- Escalation conditions;
- handoff / resume identity.

M4 does **not** decide Product Truth, project NOW, semantic ownership, semantic verdicts, verification freshness, or external-write permission.

The intended result is a compact, machine-checkable SOW envelope that makes delegated work precise enough to execute and audit while remaining subordinate to M0–M3.

## 2. Reconstruction story

The reconstruction chain remains layered:

- **M0 — Constitution / Truth** owns Product WHY/WHAT and interaction authority.
- **M1 / M1.1 — Canonical Project State** owns project NOW, active milestone/gate, bounded MATCH/GAP/CONFLICT/UNKNOWN and semantic freshness.
- **M2 — Contract Architecture** owns semantic identity, ownership/dependency and Acceptance→semantic claims.
- **M3 — Verification Harness** owns candidate-relative evidence binding, impact selection, execution selection and verification freshness.
- **M4 — Work Protocol / SOW** owns the execution envelope for a bounded work item.
- **M5 — Audit / Hygiene / Recovery** will own drift, dead/stale structure, interrupted-work recovery and repository hygiene.
- **M6 — Closed Execution Loop** will orchestrate inspect → plan → work → verify → repair → audit using the controls already defined.
- **M7 — Normal Product Development** resumes ordinary product work once the reconstruction loop is trustworthy.

M4 must not absorb M5 recovery machinery or M6 orchestration.

## 3. Existing current authority and process inputs

M4 is not greenfield. It must reuse the current repository rules rather than create a second operating system.

### Project State

`docs/project-state/index.json`

Owns:

- current milestone;
- next gate;
- prohibited scope;
- current semantic capability verdicts;
- current audited baseline / watched roots.

A Work Order may reference Project State. It may not override it.

### AGENTS.md

Already defines:

- minimal-sufficient work;
- Goal / Non-goals / Acceptance / What stays untouched;
- scope restraint;
- read order;
- implementer / judge boundary;
- external-write safety;
- independent review triggers;
- targeted-test discipline;
- completion definition;
- interruption reconstruction.

M4 should normalize these into a portable work envelope, not rewrite AGENTS.md as prose again.

### Development skill

`.agents/skills/mtg-onedeck-development/SKILL.md`

Already defines a bounded development sequence:

- inspect HEAD/status;
- state Goal / constraints / Done;
- implement only requested change;
- targeted verification;
- risk-based independent review;
- completion report.

M4 should provide the input contract that this skill can consume.

### Release skill

`.agents/skills/mtg-onedeck-release/SKILL.md`

Explicitly states that a skill or stored artifact does not create external-write permission.

M4 must preserve this invariant.

### Judge protocol

`docs/judge-protocol.md`

Owns deterministic CR adjudication / escalation.

M4 must not add a competing adjudication layer.

### M3 verification harness

M4 may reference:

- semantic IDs;
- Acceptance scenario IDs;
- verification gates;
- evidence requirements.

M4 must not copy evidence paths or claim PASS/freshness.

## 4. Core distinction: authority vs execution envelope

A Work Order is:

> a bounded execution envelope that records what outcome is requested, where the work may operate, which canonical authorities apply, what must remain untouched, how completion will be judged, and when execution must stop for a decision.

A Work Order is **not**:

- Product Truth;
- Project State NOW;
- a contract body;
- a semantic graph;
- an M1 semantic verdict;
- an M3 verification result;
- a release authorization;
- a persistent permission token;
- a status tracker;
- a roadmap.

If a Work Order conflicts with M0–M3 authority, the Work Order is invalid or requires escalation. The Work Order never wins by being newer.

## 5. Required invariants

### 5.1 Reference, do not copy authority

Canonical product/contract/project-state meaning should be referenced by stable IDs / paths where possible.

Do not paste copied Product Requirement or contract prose into the SOW merely to make it self-contained.

A Work Order may include task-local explanatory text, but canonical meaning remains at the referenced source.

### 5.2 No semantic verdict promotion

A Work Order may state:

- current Project State verdict as input;
- intended repair target.

It must never change MATCH/GAP/CONFLICT/UNKNOWN itself.

### 5.3 No verification laundering

A Work Order may state which Acceptance scenarios or semantic nodes define completion.

It must not claim:

- test PASS;
- evidence freshness;
- semantic verification success.

Those are M3 outputs for an exact candidate.

### 5.4 No durable external-write authority

A stored Work Order never grants:

- commit;
- push;
- PR merge;
- deployment;
- publication;
- external API write;
- destructive remote action.

Such authority must come from current explicit user instruction at execution time.

A Work Order may record that an external action is part of the **intended future workflow**, but it cannot serve as authorization when replayed later.

### 5.5 Scope cannot silently expand

Execution may reduce scope to a smaller sufficient solution.

Execution may not broaden scope beyond the SOW without an explicit escalation/decision.

### 5.6 Child delegation cannot increase authority

A child Work Order must be a monotonic restriction of its parent:

- same or narrower goal contribution;
- scope subset;
- inherited protected/untouched boundaries;
- no additional semantic authority;
- no additional write authority;
- no weaker verification / review obligations;
- no broader external side effects.

A child cannot approve its parent or itself.

### 5.7 Work state is not Project State

A SOW may identify:

- planning base;
- work branch / candidate reference if known;
- expected outputs.

It must not become the canonical source for current milestone, project status, or semantic reality.

PR/branch execution status remains a work surface; Project State remains NOW.

## 6. Proposed Work Order format

M4 should introduce one small machine-readable schema.

Recommended logical shape:

```json
{
  "schemaVersion": 1,
  "workId": "WO-...",
  "title": "...",
  "planningBase": "<40-char commit SHA>",
  "goal": "...",
  "scope": {
    "semanticRefs": ["..."],
    "capabilityRefs": ["CR-.."],
    "acceptanceRefs": ["ACC-..."],
    "inputPaths": ["..."],
    "expectedChangeRoots": ["..."]
  },
  "nonGoals": ["..."],
  "protected": {
    "paths": ["..."],
    "semanticRefs": ["..."],
    "statements": ["..."]
  },
  "constraints": {
    "projectStateGate": "M4-...",
    "local": ["..."]
  },
  "doneWhen": ["..."],
  "escalateWhen": ["..."],
  "review": {
    "policy": "INHERIT_AGENTS"
  }
}
```

This is a conceptual target, not final schema syntax.

## 7. Field semantics

### 7.1 `schemaVersion`

Version of Work Order schema.

No free-form compatibility machinery unless an actual migration need appears.

### 7.2 `workId`

Stable execution-envelope identifier.

It is not a semantic ID and must never participate in M2 semantic identity.

Recommended form:

`WO-YYYYMMDD-NNN`

or another non-semantic unique ID.

Avoid encoding project meaning into the identifier.

### 7.3 `title`

Short human-readable summary.

Not an authority field.

### 7.4 `planningBase`

Exact commit from which the SOW was planned.

Purpose:

- restart safety;
- stale detection;
- parent/child consistency;
- diff interpretation.

It does not assert that the commit remains current main.

At execution start, the protocol compares planning base with current Project State / target branch and decides whether reinspection is required.

### 7.5 `goal`

One observable outcome.

Rules:

- outcome-first;
- no implementation recipe unless implementation itself is the requested outcome;
- one coherent result per Work Order;
- must not restate whole Product Truth.

Bad:

> Refactor the architecture and improve UX.

Good:

> Make actor-owned Undo recovery behavior addressable by one bounded implementation change while preserving current shared-history semantics.

### 7.6 `scope.semanticRefs`

Optional stable M2 semantic IDs materially affected by or constraining the work.

Validation:

- IDs must resolve through current M2 sources;
- absence is valid for tooling-only work.

These are references, not copied clauses.

### 7.7 `scope.capabilityRefs`

Optional M1 capability IDs whose current verdict is relevant.

The SOW records the dependency only.

It does not assign a new verdict.

### 7.8 `scope.acceptanceRefs`

Optional Acceptance scenario IDs describing required behavioral outcome.

M3 owns evidence binding and freshness.

The SOW must not list raw test files when an Acceptance reference already defines the behavioral claim.

### 7.9 `scope.inputPaths`

Files/directories that are relevant inputs.

This is not a write allowlist.

It answers:

> what repository material must be inspected?

### 7.10 `scope.expectedChangeRoots`

Expected locations of edits.

This is a scope forecast / drift guard, not a permission system.

If implementation requires edits outside these roots:

- small mechanically necessary support changes may be proposed;
- the discrepancy must be surfaced;
- semantic/scope broadening requires escalation.

Do not block a correct fix merely because a support file was not predicted.

### 7.11 `nonGoals`

Explicit exclusions for this work item.

Must not duplicate all repository prohibitions.

Use only local ambiguity that would otherwise cause scope creep.

Project-wide prohibited scope remains in Project State / AGENTS.

### 7.12 `protected.paths`

Task-specific repository areas that must remain unchanged.

Use sparingly.

### 7.13 `protected.semanticRefs`

Semantic identities whose meaning must not change in this work.

Example:

- implementation repair may reference `UX-CONST-UNDO`;
- Work Order may state that the UX contract itself is protected.

This is especially useful when repairing implementation to match an existing semantic authority.

### 7.14 `protected.statements`

Small task-local invariants that do not have stable semantic IDs.

These must not be used to create a second canonical product/contract body.

If a statement is durable semantic truth, it belongs in M0/M2 authority, not here.

### 7.15 `constraints.projectStateGate`

Snapshot of the expected gate / milestone context.

This is a drift detector only.

Current Project State remains authoritative.

If current Project State differs, execution must re-evaluate the Work Order rather than treating the stored gate as current.

### 7.16 `constraints.local`

Task-local execution constraints.

Examples:

- no dependency update;
- no production data migration;
- keep public API unchanged.

Do not copy global AGENTS constraints here.

### 7.17 `doneWhen`

Observable completion statements.

Rules:

- must be verifiable;
- may reference Acceptance IDs / M3 candidate verification;
- may include “no change” conditions;
- must not claim future PASS.

Example:

- specified behavior implemented;
- M3 candidate verification has no blocking obligation for the exact candidate;
- required independent review has no HIGH/BLOCKER;
- diff remains inside bounded scope.

### 7.18 `escalateWhen`

Task-specific escalation triggers beyond the protocol's mandatory triggers.

This field may strengthen escalation.

It may not weaken mandatory escalation conditions.

### 7.19 `review.policy`

Initial M4 should use:

`INHERIT_AGENTS`

Do not invent a second risk classification system unless the existing AGENTS review triggers prove insufficient.

## 8. Mandatory escalation conditions

These are protocol invariants and do not need repetition in every SOW.

Execution must stop for a decision when:

1. canonical authorities conflict or are irreducibly ambiguous;
2. satisfying the Goal requires semantic meaning outside the declared bounded scope;
3. current Project State prohibits the work;
4. the SOW planning base is stale in a way that invalidates assumptions;
5. a required external write is not explicitly authorized in the current execution context;
6. an irreversible action is required and current rules demand confirmation;
7. M3 reports MANUAL_REQUIRED / DEFERRED / UNBOUND / UNKNOWN_COVERAGE that cannot be resolved within the declared work;
8. an independent review returns HIGH/BLOCKER;
9. completion requires weakening an active contract, acceptance oracle or verification gate;
10. completion requires introducing a second implementation / framework that violates minimal-sufficient design;
11. parent/child delegation would broaden scope or authority;
12. the requested change would update Product Truth / Project State / semantic authority without that authority mutation being the explicit Goal.

## 9. Escalation packet

When escalation is necessary, M4 should standardize a **small decision request**, not an open-ended dump.

Required content:

- blocking question;
- exact authority / evidence causing the block;
- why it cannot be resolved deterministically;
- smallest viable options;
- consequence of each option;
- recommended option if one can be justified;
- exact decision needed.

This is a communication shape, not a new persistent registry.

Do not create an escalation database in M4.

## 10. Execution start protocol

Before editing:

1. load Project State NOW;
2. load AGENTS.md;
3. validate Work Order syntax / references;
4. compare current HEAD / intended base with `planningBase`;
5. inspect only the minimal referenced authority/code/test inputs;
6. confirm current Project State does not prohibit the work;
7. resolve deterministic ambiguity using canonical authority / judge protocol;
8. if irreducible, escalate;
9. state the bounded execution interpretation.

Do not read the entire repository by default.

## 11. During-work protocol

Execution must:

- remain within Goal / scope;
- prefer one root cause → one coherent fix;
- use existing abstractions before adding new framework;
- update implementation/tests only as required;
- use targeted verification while iterating;
- treat unexpected out-of-scope changes as drift;
- avoid modifying canonical authority merely to make implementation easier;
- preserve current external-write boundary.

A Work Order does not require ceremonial status updates to be stored in repository files.

## 12. Verification handoff

At candidate completion:

1. M3 determines semantic/evidence impact for exact base/head;
2. relevant targeted/domain evidence runs;
3. candidate blockers are surfaced;
4. required independent review runs according to AGENTS;
5. Work Order `doneWhen` is evaluated;
6. only then may the work be reported as locally complete.

The Work Order does not record its own PASS as canonical truth.

A completion report is evidence / work history only.

## 13. External-write boundary

This is a critical M4 invariant.

### Persistent SOW

Never grants external writes.

### Current user instruction

May authorize a specific external action.

### Runtime rule

Before commit/push/merge/deploy:

- verify the current instruction actually authorizes it;
- verify the exact target and candidate;
- follow the release/write-specific repository rules.

A previously committed Work Order saying “push to main” is not sufficient authorization in a later session.

This prevents stale SOW replay from becoming an authority escalation vector.

## 14. Parent / child delegation

M4 must support bounded delegation without becoming an orchestrator.

A parent Work Order may be decomposed only when child work is independently executable.

Each child records:

- parent workId;
- same planning base unless explicitly replanned;
- narrower Goal;
- subset semantic/capability/acceptance scope;
- inherited protected boundaries;
- inherited mandatory escalation rules.

A child must not:

- add new semantic scope;
- relax protected constraints;
- grant external-write authority;
- mark parent complete;
- approve its own high-risk result;
- create further delegation merely to parallelize non-independent work.

M6 may later orchestrate multiple valid child Work Orders.

M4 only defines validity.

## 15. Resume / interruption boundary

M4 provides a basic resume contract, not full M5 recovery.

A new execution context reconstructs from:

1. Project State NOW;
2. Work Order;
3. current branch / HEAD / diff;
4. M3 verification state for the current candidate;
5. unresolved review findings.

Conversation history is optional context, not authority.

If Work Order assumptions no longer match current repository authority, the Work Order is stale and must be replanned or narrowed.

M5 will later own deeper stale/dead-work detection and recovery hygiene.

## 16. Work Order persistence policy

M4 should **not** create a permanent registry of every task.

Preferred model:

- Work Order is a portable machine-readable packet;
- it may be carried in a prompt, PR body, temporary artifact, or committed decision/work evidence when persistence is materially necessary;
- no single “current-work.json” becomes project NOW;
- no historical Work Order can override Project State.

If later automation needs repository persistence, M5/M6 may define lifecycle/hygiene around it.

M4 should avoid premature work-order storage architecture.

## 17. Validation model

M4 implementation should add a small validator capable of validating a supplied Work Order.

It should check:

- schemaVersion;
- required fields;
- exact planningBase commit exists;
- workId syntax;
- semanticRefs resolve;
- capabilityRefs resolve;
- acceptanceRefs resolve;
- referenced paths exist where required;
- expectedChangeRoots / protected.paths are repository-relative and safe;
- protected semantic IDs resolve;
- `review.policy === INHERIT_AGENTS`;
- prohibited fields are absent;
- no durable external-write authorization field exists.

It should **not**:

- infer user intent;
- infer semantic correctness;
- infer Project State verdicts;
- decide external-write authority;
- automatically edit the Work Order;
- auto-expand scope.

## 18. Forbidden Work Order fields / concepts

To prevent authority leakage, M4 validator should reject authored fields that attempt to store higher-layer results.

Initial forbidden concepts:

- `semanticVerdict`
- `verificationResult`
- `verificationFreshness`
- `currentMilestone` as independent authority
- `nextGate` as independent authority
- `authorizedToPush`
- `authorizedToMerge`
- `authorizedToDeploy`
- arbitrary shell command arrays
- embedded secrets / credentials

The exact forbidden-field list should remain small and evidence-based.

## 19. Work Order stale conditions

A Work Order is not automatically invalid merely because HEAD moved.

Reinspection is required when:

- `planningBase` is not an ancestor of the intended candidate;
- Project State active milestone/gate/prohibited scope changed materially;
- a referenced semantic ID was removed / changed ownership;
- a referenced Acceptance scenario was removed / materially changed;
- protected semantic authority changed;
- parent Work Order changed in a way that invalidates child assumptions.

A tool-only unrelated commit should not force ceremonial replanning if none of the Work Order assumptions changed.

M4 should prefer semantic staleness over naive “HEAD changed = stale”.

M5 may later generalize drift detection.

## 20. Definition of Done semantics

A SOW is complete only when:

- Goal is achieved;
- no Non-goal was accidentally implemented;
- protected boundaries remain intact;
- required verification is established or explicitly blocked/deferred according to M3;
- required independent review is clear;
- unresolved escalation is empty;
- diff remains minimal enough to explain;
- current external-write boundary was respected.

Completion of the Work Order does not itself mean:

- Product requirement is fully satisfied;
- M1 capability becomes MATCH;
- milestone is complete;
- release has occurred.

Those remain their respective authorities.

## 21. M4 / M5 boundary

M4 owns:

- valid work envelope;
- bounded execution scope;
- delegation monotonicity;
- escalation triggers;
- local completion contract.

M5 will own:

- finding stale Work Orders automatically;
- dead/abandoned work artifact cleanup;
- duplicate/outdated document detection;
- interrupted work recovery beyond basic resume;
- repository hygiene;
- corruption/drift audit.

Therefore M4 should not build:

- background stale scanners;
- garbage collection;
- document-health dashboards;
- recovery queues.

## 22. M4 / M6 boundary

M4 defines a valid unit of work.

M6 will orchestrate units of work.

M4 must not:

- auto-select next work;
- auto-dispatch recursive agents;
- retry failed work automatically;
- choose repair strategy loops;
- merge outputs from competing workers;
- autonomously advance milestones.

A validator / packet generator is not an orchestrator.

## 23. Proposed implementation slices

M4 should be implemented on one candidate branch after M4-PLAN approval.

### M4-1 — Work Order contract

Implement:

- canonical Work Protocol document;
- work-order schema v1;
- minimal validation library;
- no current-work registry;
- no external-write authority field.

Exit:

A human/LLM can author one bounded Work Order and a machine can reject malformed authority leakage.

### M4-2 — Repository reference resolution

Implement validation for:

- planningBase;
- semanticRefs;
- capabilityRefs;
- acceptanceRefs;
- input/protected paths;
- project-state gate snapshot.

Add tests for:

- valid bounded Work Order;
- unresolved semantic reference;
- stale/invalid commit;
- forbidden authority/result fields;
- unsafe path.

Exit:

Work Order references are machine-resolvable without copying higher-layer truth.

### M4-3 — Delegation and scope-drift validation

Implement:

- optional parentWorkId / parent packet comparison;
- child scope subset validation;
- inherited protected boundaries;
- no weakened review policy;
- no external-write escalation;
- diff-vs-expectedChangeRoots reporting.

Diff drift should initially be **reporting / escalation input**, not an absolute hard failure for mechanically necessary support files.

Exit:

A delegated child cannot silently gain authority or scope.

### M4-4 — Cold Restart / Project State handoff

After M4-1..M4-3:

- create representative machine-valid Work Order fixtures;
- verify one normal implementation SOW and one child SOW;
- verify invalid authority-escalation fixture fails;
- document restart/read order;
- bounded M1 re-audit only if watched semantic roots changed;
- update Project State to M5-PLAN only after final M4 audit;
- Cold Restart M4.

Cold Restart must let a fresh reader answer:

- what a Work Order owns;
- what it does not own;
- how it references M0–M3;
- how to determine scope;
- how to know when to stop/escalate;
- why a stored SOW cannot authorize push/merge/deploy;
- how child delegation is bounded;
- how to resume after interruption;
- where M5 begins.

Exit:

The repository can hand one bounded work item to a fresh execution context without relying on chat history and without creating a second authority system.

## 24. M4 acceptance criteria

M4 is complete only if:

- Work Order is explicitly subordinate to M0–M3;
- no Product/contract prose is duplicated as a new truth source;
- Project State remains the only project NOW;
- semantic verdicts remain M1-owned;
- evidence result/freshness remains M3-owned;
- stored SOW cannot grant external-write authority;
- required fields cover Goal / Scope / Authority refs / Inputs / Constraints / DoD / Escalation;
- canonical references are machine-resolvable;
- scope broadening requires escalation;
- child delegation is monotonic and cannot gain authority;
- child cannot self-approve or complete parent;
- existing AGENTS review rules are inherited rather than duplicated;
- no arbitrary-shell execution DSL is introduced;
- no permanent current-work registry is created;
- basic interruption resume works from repo + Work Order + git candidate;
- M5 recovery/hygiene is not implemented prematurely;
- M6 orchestration is not implemented prematurely;
- validator remains small and inspectable;
- representative valid/invalid fixtures prove the protocol;
- relevant CI is green;
- Cold Restart PASS.

## 25. Independent audit questions

The independent M4-PLAN audit must challenge at least:

### Second authority system

Can a SOW override Product Truth, Project State, semantic ownership or verification state?

Required answer: no.

### Permission replay

Can an old committed SOW be replayed later as push/merge/deploy authorization?

Required answer: no.

### Scope laundering

Can an executor add adjacent improvements under broad Goal language?

Required answer: no; Goal must be bounded and scope expansion escalates.

### Self-approval

Can implementer or child task mark high-risk work approved?

Required answer: no.

### Verification laundering

Can `doneWhen` or a SOW field store PASS/freshness and bypass M3?

Required answer: no.

### Over-schema

Does every task need dozens of fields or a persistent registry?

Required answer: no.

### Under-specification

Can a fresh executor know what not to change and when to stop?

Required answer: yes, through bounded scope / protected / escalation.

### Parent-child authority escalation

Can child work broaden semantic scope, protected boundaries, external side effects or review requirements?

Required answer: no.

### M5 leakage

Is M4 trying to solve repository hygiene/recovery?

Required answer: no.

### M6 leakage

Is M4 dispatching/retrying/orchestrating agents?

Required answer: no.

## 26. Rollback rule

Remove any M4 field or mechanism that does not directly improve one of:

- work intent clarity;
- scope bounding;
- authority reference clarity;
- protected-boundary clarity;
- completion observability;
- escalation precision;
- safe delegation;
- restartability.

If the Work Order begins to duplicate Product/contract/Project State/verification truth, delete the duplicated field and keep a reference.

If a proposed mechanism is primarily about stale-artifact cleanup or autonomous orchestration, defer it to M5 or M6.

## 27. M4-PLAN recommendation

Proceed with M4-1 through M4-4 after independent audit and Owner approval.

Core decision:

> Introduce one small machine-checkable Work Order envelope that references M0–M3 authority instead of copying it, never stores external-write permission or verification verdicts, bounds scope and protected areas, defines observable Done and mandatory escalation, and allows only monotonic child delegation. Keep work progress in ordinary branch/PR surfaces and leave drift recovery to M5 and orchestration to M6.

Implementation authority remains **none** until M4-PLAN is independently audited and Owner-approved.
