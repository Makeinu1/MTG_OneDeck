# Tier-1 Adversarial Audit — cr-603-triggers-apnap Slice B (delayed-trigger scheduling)

Auditor: independent Tier-1 (cold, no authorship). Scope: uncommitted working-tree diff on
`src/engine/types.ts`, `src/engine/triggers.ts`, `src/engine/commands.ts`, `src/engine/priority.ts`,
`src/store/gameStore.ts`, plus new `src/store/__tests__/delayedTriggers.test.ts`.
Baseline: Slice A shipped as commit `42accc2`.

## Machine checks (all four, run 2026-07-06)

| Check | Result |
|---|---|
| `npm run lint` | PASS (0 errors/warnings, no output) |
| `npx tsc --noEmit` | PASS (0 errors) |
| `npx vitest run` | PASS — 151 test files, 1345 tests, 0 failures |
| `npm run build` | PASS (`tsc -b && vite build` succeeded; `dist/` removed after) |

Isolated re-runs:
- `src/store/__tests__/review.cr603-triggers-sliceA.test.ts` → 5/5 pass, run in isolation.
- `src/store/__tests__/crGroundingGoldenCases.test.ts` → 35/35 pass, run in isolation. Confirmed **unmodified** by this diff (`git diff --name-only` does not list this file; `git status --porcelain` shows no changes to it).
- `src/store/__tests__/delayedTriggers.test.ts` (implementer-authored) → 6/6 pass, run in isolation.

## Adversarial probes

### 1. `readyPendingTriggers` filter correctness (highest-value probe) — NO DEFECT FOUND
Constructed a standalone scenario (temp test, deleted after verification, never committed) mixing
ordinary ready triggers with a co-present scheduled-but-not-due trigger sharing the *same*
controller+bucket as an ordinary trigger (`P1`/`ordinary`), to stress the count-keyed grouping map
in `deterministicPendingTriggerOrderForPriority` (`src/engine/priority.ts:157-193`, mirrored in
`src/store/gameStore.ts:692-710`).

- Result: `deterministicPendingTriggerOrderForPriority({pendingTriggers: [...ordinary, scheduled]})`
  produced an **identical** ordered-id array to the same call without the scheduled trigger present.
  The scheduled trigger's id never appeared in output, and bucket/controller counts were unaffected.
- Also verified `orderPendingTriggersApnap`: explicit order lists that omit the scheduled trigger's
  id resolve normally (`status: 'ordered'`); an explicit order list that *includes* a scheduled
  trigger's id correctly returns `status: 'incomplete'` (unknown id), because `readyPendingTriggers`
  filters it out of `pendingById` (`src/engine/priority.ts:97-99`) before the id is looked up.
- Every call site that used to read `state.pendingTriggers`/`workingState.pendingTriggers` directly
  now routes through `readyPendingTriggers(...)`: `orderPendingTriggersApnap` (L97),
  `deterministicPendingTriggerOrderForPriority` (L159, both engine and store copies),
  `manualOrderRequired` (L208), `pendingTriggersForIds` (L244), `advanceToPriority`'s `readyTriggers`
  gate (L338) and its `explicitTriggerOrderIds` branch (L349), and the store's
  `placePendingTriggersForPriority`/priority-fixed-point loop (`gameStore.ts:2485-2577`).
  `triggerCandidatesFromPendingTriggers` (`triggers.ts:1416`) is also filtered, so scheduled triggers
  never appear as player-visible candidates — consistent with the implementer's own
  `delayedTriggers.test.ts` assertions (`expect(store().triggerCandidates).toEqual([])` while
  scheduled, `.toHaveLength(1)` once promoted).
- **Conclusion: the filter is invisible to APNAP ordering/counting, not merely filtered from the
  final stack.** Claim holds up under adversarial construction. No BLOCKER/HIGH here.

### 2. CR 513.2 "doesn't back up" — NO DEFECT FOUND
Read the actual arithmetic in `scheduleForDelayedPhaseBegin` (`src/engine/triggers.ts:551-570`):

```
return {
  kind: 'phase-begin',
  turn: state.phase === 'end' ? state.turn + 1 : state.turn,
  phase: 'end',
  ...
};
```

- Created while `state.phase === 'end'` → schedules `turn: state.turn + 1, phase: 'end'` (next
  turn's end step) — correct per CR 513.2, verified live via
  `delayedTriggers.test.ts`'s "waits until the next turn end step when a next-end-step trigger is
  created during end step" test (creates during `setTurnPhase(1, 'end')`, asserts
  `schedule.turn === 2`, then drives `nextPhase()`/`advancePhase(5)` through turn 2 main2, confirms
  `readyTriggers()` stays empty until the actual turn-2 end step, at which point it fires).
- Created outside end step (e.g. `main1`) → schedules `turn: state.turn, phase: 'end'` (later same
  turn) — correct, verified live via the "promotes ... when created outside end step" test
  (`schedule.turn === 1`, `phase: 'end'`, fires 3 `nextPhase()` calls later at the current turn's end
  step).
- `NEXT_TURN_UPKEEP_DELAY_PATTERN` timing always uses `state.turn + 1, phase: 'upkeep'` regardless of
  current phase (`triggers.ts:544-550`) — correct, since "next turn's upkeep" has no same-turn
  interpretation to guard against (CR 513.2's back-up concern is specific to the end step / current
  step case; upkeep of the *current* turn has already passed once you're past it, and this
  scheduling always targets a strictly future turn).
- **No off-by-one, no reversed condition. Claim holds.** No BLOCKER/HIGH here.

### 3. One-shot promotion (CR 603.7b) — NO DEFECT FOUND
- `promoteDueScheduledTriggers` (`triggers.ts:635-646`) has exactly **one** call site,
  inside `enterPhase` (`commands.ts:1959`), itself called from exactly 3 sites
  (`applyNextPhase` twice, `applyNextTurn` once), each invoked exactly once per discrete
  `GameCommand`. Promotion deletes the `schedule` field (`delete ready.schedule`), so a
  second entry into the same phase (which cannot happen for the *same* logical transition under
  this engine's turn-strictly-increments model) would find `trigger.schedule === undefined` and
  skip re-promotion via `isPendingTriggerReady`.
- `applyEnterCombat` (`commands.ts:1381`) sets `draft.state.phase = 'combat'` directly, bypassing
  `enterPhase`/`promoteDueScheduledTriggers`. This is **not a bug for this slice's scope** because
  `PendingTriggerSchedule.phase` is typed as `'upkeep' | 'end'` only — `'combat'` can never be a
  schedule target, so no promotion is being skipped in practice. Flagged as a LOW forward-compat
  note below in case `phase-begin` scheduling is ever extended to combat-beginning triggers.
- Verified live via `delayedTriggers.test.ts`'s "promotes a scheduled trigger only once" test:
  activates, advances to the scheduled end step, dismisses the ready candidate
  (`dismissTriggerCandidates()` — which now preserves *scheduled* triggers per the `clearPendingTriggers`
  change but correctly wipes the *ready* one once dismissed), advances a full extra turn back to
  another end step, and asserts `pendingTriggers` and `triggerCandidates` are both empty — i.e. no
  re-fire.
- Checked `undo()`/`redo()` (`gameStore.ts:1917-1946`) and `dismissTriggerCandidates()`
  (`gameStore.ts:2748-2754`): all three call `clearPendingTriggers`, which now filters to
  `trigger.schedule !== undefined` (i.e. drops only *ready* triggers, keeps scheduled ones) —
  semantically correct: a still-pending scheduled trigger is not a "candidate" to be wiped by
  dismiss/undo/redo history clearing, and this is exactly what the one-shot test exercises.
  `removePendingTriggersForSource` (`gameStore.ts:566-571`) has the identical guard.
- **No double-promotion path found.** No BLOCKER/HIGH here.

### 4. Two-bucket APNAP non-regression — CONFIRMED, file untouched
- `git diff --name-only` does not include `src/store/__tests__/crGroundingGoldenCases.test.ts`;
  `git status --porcelain` shows no modification to it. File is byte-identical to pre-Slice-B.
- Read `cr-trigger-6033b-two-bucket-order` (line 666) and `cr-trigger-6033b-apnap-per-bucket`
  (line 745) in full: both still construct real pending triggers via `store().moveCard(...)`,
  manually force `stackPlacementBucket` values via `useGameStore.setState`, and assert genuine
  CR 603.3b bucket-then-APNAP-within-bucket ordering on the resulting stack contents (source ids in
  expected order). Assertions are unweakened; nothing was adjusted to "make room" for scheduling.
  Ran both isolated (35 tests in the file, all pass).

### 5. Slice A non-regression — CONFIRMED
`review.cr603-triggers-sliceA.test.ts` re-run in isolation: 5/5 pass. Read the file's assertions:
still test turn-reset of the once-per-turn ledger, CR 400.7 blink self-retrigger via a fresh
`sourceObjectId` after a zone-change increments `zoneChangeCounter`, ETB self-exclusion
(`trigger.etb` not `trigger.etb-other`), plain-other-ETB firing for a second permanent, and
`markDamage`-caused SBA death exclusion from spurious re-trigger. All unmodified in behavior;
`readyPendingTriggers` is a no-op for any pending trigger without a `schedule` field, which is all
of Slice A's population.

### 6. Snapshot / forward-compat — CONFIRMED
- `normalizePendingTriggerSchedule` (`gameStore.ts:293-320`) returns `undefined` for any input that
  isn't a well-formed `{kind:'phase-begin', turn:number, phase:'upkeep'|'end', createdAtTurn:number,
  createdAtPhase:Phase}` record — including `undefined` itself (via `unknownRecord(undefined) ===
  null`). `normalizeSnapshotState`'s trigger-mapping (`gameStore.ts:493-508`) correctly deletes any
  `schedule` key rather than leaving `schedule: undefined` on the object when the normalized value is
  `undefined`, so no spurious `schedule` key gets attached to legacy triggers.
- Verified live via the implementer's own "restores legacy pending triggers without a schedule
  field" test: constructs a `GameSnapshot` with a hand-built pre-Slice-B-shape `PendingTrigger` (no
  `schedule` key at all), calls `restoreGame`, asserts no throw and `pendingTriggers[0].schedule` is
  `undefined`. Pass.

### 7. Scope leakage — CONFIRMED CLEAN
- `git diff -- src/engine/types.ts` shows only the new `PendingTriggerSchedule` interface and the
  additive `schedule?:` field on `PendingTrigger`. The `GameEvent` union type is untouched (only
  appears as unrelated diff context, not a changed line).
- No file under Slice C's stated territory (discard/sacrifice/counter semantic events) appears in
  `git diff --name-only` or `git status --porcelain`.

### 8. Determinism/purity — CONFIRMED
- Grepped all touched scheduling functions (`scheduleForDelayedPhaseBegin`,
  `makeScheduledDelayedTrigger`, `promoteDueScheduledTriggers`, `readyPendingTriggers`,
  `isPendingTriggerReady`, `isScheduledTriggerDue`) — zero uses of `Object.keys`/`Object.values`/
  `Object.entries`. All iteration is over arrays (`.map`/`.filter`), which have stable, spec-defined
  order. `eventId` construction in `scheduleDelayedTriggerForEffectLine`
  (`commands.ts:3383-3390`) is built from `[draft.state.turn, draft.state.phase, draft.nextSeq,
  sourceSnapshot.objectId, lineIndex]` — fully deterministic given prior state, no `Date.now()`,
  `Math.random()`, or map iteration.

### 9. Test honesty — `delayedTriggers.test.ts` is substantive, not just happy-path smoke
Contrary to the risk flagged in the brief, this file does assert the CR-relevant behaviors, not just
goldens-as-smoke-tests:
- CR 513.2 both directions (created during end step → next turn; created outside end step → same
  turn), with explicit `schedule.turn`/`phase` assertions before advancing, not just "eventually
  fires."
- One-shot consumption across a full extra turn cycle.
- Ordinary-trigger APNAP non-interference: a live mixed scenario (one ready ETB trigger + one
  scheduled artifact trigger) asserting the scheduled trigger stays invisible to
  `triggerCandidates`/APNAP placement while the ready one places correctly onto the stack.
- Legacy snapshot restore.
- Uses the stated goldens (Mishra's Bauble wording verbatim, a generic "end step" style matching
  Arcane Denial/Hide on the Ceiling's timing clause) as vehicles for the above, not as an end in
  themselves.

## Residual findings (no BLOCKER)

**MEDIUM** — `applyEnterCombat` (`src/engine/commands.ts:1369-1388`) sets `draft.state.phase =
'combat'` directly and does **not** call `promoteDueScheduledTriggers`. Currently harmless because
`PendingTriggerSchedule.phase` only accepts `'upkeep' | 'end'`, so no live bug today — but this is a
second, undocumented phase-entry code path alongside `enterPhase`, and it is the kind of thing that
silently becomes a real gap the moment someone extends `schedule.phase` to include `'combat'` (e.g.
for "at the beginning of combat on your next turn" cards) without also touching this call site. Flag
for the next slice that touches combat-phase-begin triggers; not a defect in Slice B's stated scope.

**LOW** — `makeScheduledDelayedTrigger` never passes an `abilityLineIndexOverride` to
`makePendingTrigger` (`triggers.ts:605-612`), so `abilityLineIndex` resolution falls through to
`abilityLineIndexForTriggerDef(state, defId, triggerId)` (`triggers.ts:194-260`). For the realistic
case where the delayed clause is embedded in an **activated**-ability line (Mishra's Bauble:
`"{T}, Sacrifice this artifact: Draw a card at the beginning of the next turn's upkeep."`),
`classifyAbilityShape` (`src/engine/grammar/index.ts:190-196`) classifies the whole line as
`'activated'` (cost-prefix check happens before the delayed-triggered check), not
`'delayed-triggered'`. `abilityLineIndexForTriggerDef`'s matcher only considers lines with
`shape === 'triggered' || shape === 'delayed-triggered'`, so it never finds this line, and
`abilityLineIndex` ends up `undefined` for every activated-ability-sourced delayed trigger. This is
benign today: `oncePerTurnTriggerKey` returns `null` when `abilityLineText` is `undefined` (skips
dedup, which doesn't matter since one-shot consumption is enforced separately via `schedule`
deletion), and the pending trigger's `label` still gets a sensible generic string
(`delayedPhaseBeginLabel`) instead of the specific line text. Would only matter if a single card ever
carried two *different* delayed-phase-begin abilities disambiguated solely by line index — no such
card exists in the current test corpus or golden set. Worth a one-line comment or a follow-up ticket,
not worth blocking this slice.

**LOW** — `isScheduledTriggerDue` (`triggers.ts:627-633`) uses `schedule.turn <= turn` (not
`===`). This is defensive (a trigger scheduled for turn N still fires if promotion logic is somehow
invoked first at turn N+1), which is arguably the right call given no turn-skip mechanic exists yet
in this engine's scope, but it is not literally "fires exactly at the scheduled turn" — worth noting
if a future slice introduces extra-turn effects that could cause a schedule to be skipped over
silently rather than firing at the intended turn.

## Summary

**No BLOCKER or HIGH findings.** All 4 machine checks pass (lint clean, tsc clean, 1345/1345 vitest
tests pass, build succeeds). Both of the brief's highest-value adversarial probes —
`readyPendingTriggers` filter correctness and the CR 513.2 back-up-rule arithmetic — were
independently reconstructed from scratch (not just re-running the implementer's own tests) and found
to behave exactly as the contract requires: scheduled triggers are fully invisible to APNAP
ordering/counting (not merely filtered from the final stack), and the turn/phase arithmetic correctly
sends "created during the end step" to the *next* turn's end step while "created outside the end
step" resolves later in the *same* turn. Slice A and the two-bucket APNAP golden tests are
byte-unmodified and still pass with unweakened assertions. Two LOW notes and one MEDIUM
forward-compat gap (`applyEnterCombat` bypassing promotion, currently inert) are recorded above for
the record but do not block this slice.
