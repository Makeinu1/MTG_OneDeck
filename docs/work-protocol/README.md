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
- `inputPaths`: repository material expected to exist and be inspected at `planningBase`.
- `expectedChangeRoots`: repository-relative files/directories where edits are expected.

M4-2 requires `inputPaths` to exist at the planning snapshot. M4-3 does **not** require those inputs to survive at candidate HEAD: deleting an obsolete input is valid when the deletion is inside the bounded change scope. Protected/authority paths retain their stricter candidate requirements.

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
npm run check:work-order -- path/to/work-order.json --head <candidate-sha>
npm run check:work-order -- child.json --head <candidate-sha> --parent parent.json
```

The command now performs two layers:

1. M4-1 structural validation against the recursively closed canonical schema.
2. M4-2 planning-snapshot reference resolution against the exact `planningBase` commit.

M4-2 validates:

- `planningBase` exists as a commit;
- semantic refs resolve from Product definition rows / active contract clause IDs at that snapshot;
- capability refs resolve from Project State at that snapshot;
- Acceptance refs resolve from the Acceptance registry at that snapshot;
- authority paths belong to the canonical authority classes at that snapshot;
- input/protected paths are safe repository-relative paths and exist at that snapshot;
- expected change roots use safe repository-relative path syntax.

With `--head <sha>`, M4-3 additionally validates the exact candidate:

- `planningBase` must be an ancestor of the candidate head;
- planning-snapshot references must still resolve at the candidate;
- Project State execution boundary changes require reinspection/replan;
- referenced M1 capability context (verdict/delivery/lifecycle/requirement level) changes require reinspection/replan;
- referenced Acceptance claim/oracle/execution-contract changes require reinspection/replan;
- referenced authority paths must not silently change;
- protected paths must remain unchanged;
- M3/M3.1 provenance distinguishes authority-source changes from ordinary implementation/evidence impact;
- referenced/protected semantic authority changes require reinspection/replan;
- changed files outside `expectedChangeRoots` are reported as drift rather than automatically judged wrong.

For child Work Orders, pass `--parent <parent.json>` with `--head`. M4-3 checks:

- child `workId` is distinct from the parent `workId`;
- exact `parentWorkId`;
- shared `planningBase`;
- all parent authority semantic/path refs and capability-context refs remain inherited; a child may add read-only refs;
- target semantic scope is a subset of the parent;
- expected change roots do not broaden beyond the parent;
- parent protected path/semantic boundaries remain inherited;
- parent Non-goals, task-local constraints and escalation triggers remain inherited;
- review / verification policies are not weakened;
- parent verification semantic / Acceptance obligations relevant to the child target are retained;
- a child completion report may establish only the child's bounded contribution; it cannot mark the parent complete or self-approve review that AGENTS requires to be independent.

M4-3 does not infer whether natural-language Goal wording is truly “narrower”; that remains an execution/review judgment rather than an LLM-generated authority claim.

## Mandatory runtime principles

Even when a packet is structurally valid:

1. current Project State must be read at execution start;
2. the planning snapshot must be reinspected if authority assumptions changed;
3. scope may narrow to a smaller sufficient solution but cannot silently broaden;
4. required external writes need current explicit authorization;
5. M3/M3.1 verification blockers are not converted into Work Order PASS;
6. HIGH/BLOCKER review findings remain unresolved until separately cleared;
7. canonical authority is never edited merely to make implementation easier.

## Manual evidence procedure

When M3.1 reports `MANUAL_REQUIRED`:

1. read the referenced Acceptance scenario and its oracle; do not invent a substitute manual check;
2. the check may be performed by the current execution actor only when that actor can directly observe every required condition with available tools;
3. human sensory, strategic, table-agreement, or inaccessible real-browser/physical observations must be escalated to the current user/human rather than simulated by an LLM;
4. a manual PASS is evidence only. It is not independent review approval and does not change an M1 semantic verdict;
5. when AGENTS requires independent review, the required reviewer remains separate from the implementation context even if the manual scenario was already performed;
6. communicate the result to M3.1 as the exact-candidate receipt (`scenarioId`, `PASS|FAIL`, `evidenceRef`) bound to the same base/head;
7. do not persist that receipt inside the Work Order as current truth or as external-write permission.

## Escalation packet

When a mandatory or task-local escalation condition is reached, report only the bounded decision packet:

- blocking question;
- exact authority/evidence causing the block;
- why deterministic resolution is unavailable;
- smallest viable options;
- consequence of each option;
- a justified recommendation when one exists;
- exact human/Owner decision required.

This is a communication shape, not a persistent escalation registry. It never grants external-write authority and does not update Project State by itself.

## Persistence

M4 creates no permanent `current-work.json` registry.

A Work Order may live in a prompt, PR body, temporary artifact, or committed work evidence when persistence is useful. Its persistence never turns it into Project State NOW.

## M4 boundaries

M4 defines a valid unit of work.

M5 owns deeper audit/hygiene/recovery, including stale/dead artifact cleanup and interrupted-work recovery beyond the basic packet/git restart inputs.

M6 owns orchestration. M4 does not auto-select work, dispatch recursive agents, retry failed work, merge competing worker outputs, or advance milestones automatically.

Before M6 closed-loop orchestration is approved, M6-PLAN must require an independently bounded CR-15 audit for the automation surfaces it will invoke.

## Representative fixtures

- `docs/work-protocol/examples/root-implementation.json` — machine-valid root Work Order.
- `docs/work-protocol/examples/child-evidence.json` — machine-valid monotonic child Work Order.
- `docs/work-protocol/examples/invalid-authority-escalation.json` — intentionally invalid nested external-write authority attempt; the Work Protocol gate must reject it.

Run `npm run check:work-protocol` to validate these fixtures and delegation invariants together.
