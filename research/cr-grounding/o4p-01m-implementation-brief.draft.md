# O4P-01M implementation brief — additive Core slices

## Task packet

- Milestone ID: `O4P-01M`
- Work package: `M-I` additive Commander / multiplayer combat / player-lifecycle slices
- Role: one implementer; do not act as judge, contract author, auditor, or releaser
- Base SHA: `1d5a75a60bc6f13a4ed6fd3daf7687e2ed4a0dcf`
- Frozen contract: `research/cr-grounding/o4p-01m-commander-combat-player-exit.contract.draft.md`
- Supporting grounding: `research/cr-grounding/o4p-01m-commander-combat-grounding.draft.md`, `research/cr-grounding/o4p-01m-player-exit-grounding.draft.md`
- Orchestration plan: `research/cr-grounding/o4p-01m-orchestration-plan.draft.md`

## Goal

Implement the frozen O4P-01M immutable Core value objects and pure operations
for Commander identity/tax/damage provenance, multiplayer combat assignments,
and concession/defeat/player-exit cleanup directives.

## Authority and non-goals

Read `AGENTS.md`, `docs/judge-protocol.md`, the active contract manifest, the
O4P-01M ledger entries, the frozen contract above, and the shipped O4P-01G–L
source/tests/verifiers before editing. Use only the pinned local CR; relevant
anchors are CR 104.3a/j, 506–510, 704, 800.4, and 903.3/8/9/10a.

Do not implement typed Core commands/events/results, replay, deterministic
randomness, protocol, Room, projection, WebSocket, Cloudflare, UI, Solo
snapshot migration, full payment/legality, generic replacement layers, or
full automatic combat damage.

## Allowed writes

Only these paths may change:

- `src/engine/core/commander/**`
- `src/engine/core/combat/**`
- `src/engine/core/player-lifecycle/**`
- ordinary tests under those three directories only

The implementer must not change any barrel/index, fixture, verifier,
`review.*` test, architecture test, `docs/**`, `AGENTS.md`, `CLAUDE.md`, ledger,
loop-state, package/lock files, dependency, or git state. The judge reserves
integration exports, fixture/verifier registration, and review evidence for a
serial integration step.

## Required semantics

### Commander

- Key designation, cast count, and damage by `CorePhysicalCardId`, never display
  name/current object/controller/token/copy.
- Cast count increments once only when a typed operation explicitly identifies
  an accepted `fromZone: 'command'` cast; movement and invalid/uncommitted
  operations do not increment.
- Provide `903.9a` and `903.9b` as separate validated choice records; do not
  move cards or implement generic replacement effects.
- Track damage by physical Commander and defending `CorePlayerId`; a threshold
  query requires combat-damage provenance and never mutates lifecycle.

### Combat

- Store step, combat ID/turn, attacking player, ordered defending players,
  per-attacker defending-player target, and per-blocker controller/defender /
  attacked-object/declaration-order data.
- Preserve arrays in supplied declaration order; reject duplicates and malformed
  IDs rather than auto-sorting or deduplicating.
- Provide structural participant removal/validation. Do not introduce a second
  priority/APNAP engine or silently calculate complex combat damage.

### Player lifecycle

- Keep a stable roster and separate status/eligibility. Distinguish `active`,
  `defeated`, `conceded`, and `exited` as contract permits; distinguish defeat
  and concession causes.
- No disconnect/connection/timeout/session field or behavior.
- Reconcile an explicit typed reference bundle into typed cleanup directives:
  owned objects, non-card stack objects, other controlled objects, control
  effects, decision authorities, search sessions, combat participants, active
  player, priority holder, and surviving turn order. Do not apply arbitrary
  path mutation or conflate owner/controller/decision maker.
- Reconciliation must be atomic, deterministic, input-preserving, deeply frozen,
  and must not leave a surviving reference to the exited player where the
  directive contract says it must be cleaned.

## Implementation quality rules

- Follow existing Core strict-validation style: exact fields, stable issue
  ordering, safe IDs, non-negative safe integers, no accessors/prototype traps,
  no `any`, typed `unknown` guards only.
- Factories validate before candidate construction; operations validate the
  complete candidate and return fresh deeply frozen outputs.
- Use existing `CorePlayerId`, `CorePhysicalCardId`, `CoreObjectId`, and object
  ID validators. Do not create a second ID spelling or import React/store.
- Keep the result shape explicit and serializable. Preserve input array order;
  no trimming, sorting, deduplication, deletion of zero entries, or mutation.
- Add ordinary tests for valid fixtures, every rejection/atomicity case,
  deep-freeze, input immutability, canonical order, Commander pair separation,
  multiple defenders, multi-blocker structure, concession vs defeat, and
  disconnect absence.

## Targeted checks

Run only the new ordinary Core tests and their direct dependencies while
iterating, for example:

```sh
npm exec vitest run --project core src/engine/core/commander src/engine/core/combat src/engine/core/player-lifecycle
```

Do not run the release `npm run check`; the judge runs it only after serial
integration, candidate freeze, and an independent cold audit. Do not edit or
run review tests as a substitute for implementation evidence.

## Stop conditions

Stop and report without widening the write set if the frozen contract requires a
new root field/export, conflicts with a shipped G–L contract, requires generic
mutation/patches, needs a new error authority not specified by the contract, or
cannot represent a cleanup distinction without conflating owner/controller /
decision-maker/active-player. Report exact files, tests, defers, and unresolved
authority questions.

## Return packet

1. Changed files and confirmation every path is allowed.
2. Contract clauses implemented.
3. Exact targeted commands and results.
4. Explicitly deferred clauses.
5. Unresolved issues/STOP findings.
6. Proposed serial integration steps.
