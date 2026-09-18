# Work Protocol / Statement of Work

Status: active process contract after M4 implementation merge  
Owner: M4 — Work Protocol / SOW  
Semantic authority: none

## Purpose

A Work Order is a bounded execution envelope for handing one coherent unit of MTG OneDeck work to another execution context.

It records:

- the requested Goal;
- canonical authority references that constrain interpretation;
- current-reality context references;
- verification intent;
- bounded change scope and expected change roots;
- task-local Non-goals and protected boundaries;
- task-local constraints;
- observable Definition of Done;
- additional escalation triggers;
- inherited review policy.

A Work Order exists to make delegated work precise and restartable. It does not become a new source of Product Truth, Project State, semantic ownership, verification result, roadmap state, or external-write permission.

## Authority boundary

The execution context always reads current repository authority first.

- Product WHY/WHAT remains in `docs/product-requirements.md`.
- Interaction semantics remain in the active UX Constitution.
- Project NOW and MATCH/GAP/CONFLICT/UNKNOWN remain in `docs/project-state/index.json`.
- Semantic identity / ownership / dependency remain in M2 contract sources.
- Evidence binding, impact, manual-evidence validation and candidate freshness remain in M3/M3.1.
- CR adjudication remains in `docs/judge-protocol.md`.
- Global execution and external-write rules remain in `AGENTS.md` and the applicable repository Skill.

If a Work Order conflicts with those sources, the Work Order does not win by being newer.

## External-write boundary

A stored Work Order never authorizes commit, push, merge, deploy, publish, destructive remote mutation, or another external write.

Current explicit user instruction is required at execution time for any external action that repository policy treats as permission-bearing.

Fields such as `authorizedToPush`, `authorizedToMerge`, `authorizedToDeploy`, semantic verdicts, verification PASS/freshness, current milestone, or next gate are not part of the Work Order schema and are rejected as unknown fields wherever they are nested.

## Canonical packet

The canonical structural schema is:

`docs/work-protocol/work-order.schema.json`

The root form always contains `parentWorkId: null`.

A child Work Order contains a non-empty parent Work Order ID. Parent/child semantic subset validation belongs to M4-3; M4-1 validates only the packet shape.

The schema is recursively closed. Every object rejects undeclared fields.

## Field intent

### Identity

- `schemaVersion`: Work Order schema version.
- `workId`: execution-envelope ID. It is not a semantic ID or Project State identity.
- `parentWorkId`: `null` for a root packet; a parent Work Order ID for a child.
- `title`: short human label.
- `planningBase`: exact commit SHA from which the packet was planned.
- `goal`: one observable outcome.

### Authority references

`authorityRefs` identifies canonical authority that constrains interpretation.

It does not grant permission to edit those authorities.

- `semanticRefs`: stable semantic IDs where available.
- `paths`: canonical authority paths only. M4-2 validates the authority class at the planning snapshot.

### Current-reality context

`contextRefs.capabilityRefs` lists M1 capability IDs whose current state matters.

The Work Order stores only the IDs. It never copies MATCH/GAP/CONFLICT/UNKNOWN values; the executor reads current Project State.

### Verification intent

`verificationIntent` states semantic / Acceptance obligations the work intends to satisfy or preserve.

- `semanticRefs`
- `acceptanceRefs`
- `policy: INHERIT_M3`

M3/M3.1 owns evidence paths, execution, manual receipt validation and freshness.

If M3.1 reports `MANUAL_REQUIRED`, M3.1 validates the exact-candidate receipt. M4 governs the bounded work procedure around performing/reviewing that manual check; the Work Order does not persist the receipt's PASS as truth.

### Change scope

`scope` is a forecast and drift boundary, not a filesystem permission system.

- `targetSemanticRefs`: semantic area the requested change may materially affect.
- `inputPaths`: repository material expected to be inspected.
- `expectedChangeRoots`: repository-relative files/directories where edits are expected.

M4-2 resolves references and M4-3 evaluates candidate drift.

### Local boundaries

- `nonGoals`: local exclusions needed to prevent scope creep.
- `protected.paths`: task-specific paths expected to remain unchanged.
- `protected.semanticRefs`: semantic meaning that must remain unchanged.
- `constraints.local`: task-local constraints only; global rules remain in AGENTS/Skills.
- `doneWhen`: observable completion statements.
- `escalateWhen`: task-specific escalation triggers that may strengthen, never weaken, protocol escalation.
- `review.policy`: currently fixed to `INHERIT_AGENTS`.

## Structural validation

Run:

```sh
npm run check:work-order -- path/to/work-order.json
```

M4-1 structural validation checks schema shape only.

It intentionally does **not** yet decide:

- whether `planningBase` exists;
- whether semantic/capability/Acceptance references resolve;
- whether authority paths are canonical authority classes;
- whether repository paths exist or are safe;
- whether a child is a valid subset of its supplied parent;
- whether an explicit candidate has drifted outside expected scope.

Those are M4-2 / M4-3 responsibilities.

## Mandatory runtime principles

Even when a packet is structurally valid:

1. current Project State must be read at execution start;
2. the planning snapshot must be reinspected if authority assumptions changed;
3. scope may narrow to a smaller sufficient solution but cannot silently broaden;
4. required external writes need current explicit authorization;
5. M3/M3.1 verification blockers are not converted into Work Order PASS;
6. HIGH/BLOCKER review findings remain unresolved until separately cleared;
7. canonical authority is never edited merely to make implementation easier.

## Persistence

M4 creates no permanent `current-work.json` registry.

A Work Order may live in a prompt, PR body, temporary artifact, or committed work evidence when persistence is useful. Its persistence never turns it into Project State NOW.

## M4 boundaries

M4 defines a valid unit of work.

M5 owns deeper audit/hygiene/recovery, including stale/dead artifact cleanup and interrupted-work recovery beyond the basic packet/git restart inputs.

M6 owns orchestration. M4 does not auto-select work, dispatch recursive agents, retry failed work, merge competing worker outputs, or advance milestones automatically.

Before M6 closed-loop orchestration is approved, M6-PLAN must require an independently bounded CR-15 audit for the automation surfaces it will invoke.
