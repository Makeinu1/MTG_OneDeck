# Tier-1 Adversarial Audit — cr-603-triggers-apnap Slice C (discard/sacrifice/counter semantic events)

Auditor: independent Tier-1 (cold read, no prior context). Scope: uncommitted working-tree diff
(`src/engine/types.ts`, `src/engine/commands.ts`, `src/engine/triggers.ts`, `src/store/gameStore.ts`,
new `src/store/__tests__/cr603SemanticEvents.test.ts`, modified
`src/store/__tests__/crGroundingGoldenCases.test.ts`). Findings only — no files modified except a
throwaway verification test that was created and deleted before this report was written (never
committed, not present in the working tree).

## Summary of 4 machine checks

| Check | Result |
|---|---|
| `npm run lint` | PASS (no output, no errors) |
| `npx tsc --noEmit` | PASS (no output, no errors) |
| `npx vitest run` | PASS — 153 test files, 1355 tests, 0 failures |
| `npm run build` | PASS — `tsc -b && vite build` succeeded, `dist/` produced then removed per instructions |

All four are green. This does not clear the implementation — see HIGH finding below, which is
accepted (not caught) by the existing test suite because the modified golden test bakes in the
buggy behavior as the expected result.

---

## Finding 1 — HIGH — CR 704.5q counter-annihilation silently loses/corrupts `+1/+1` counter-change events

**Adversarial claim**: when a permanent's `+1/+1` and `-1/-1` counters are annihilated by the CR
704.5q state-based action, no `CounterChangeEvent` is ever emitted reflecting the true final count
of the surviving counter type, and a stale, already-false event from an earlier dispatch is left
in the log with no correction — a genuine "counter removed" state change is unobservable via the
event log to any trigger, and the log itself contains data that its own `before`/`after` fields
claim is current-truth but is not.

**Independently re-derived mechanism** (confirmed byte-for-byte against the hypothesis given):

- `src/engine/commands.ts:720-732` `recordCounterChangeIntent` pushes `{cardId, objectId,
  counterType, before}` onto `draft.pendingCounterChanges`.
- `src/engine/commands.ts:1269-1287` `applyAddCounters` mutates `target.counters` via `setCard`,
  then calls `recordCounterChangeIntent(draft, target, counterType, current)` — i.e. it records
  intent only for the **counter type the command explicitly targeted**.
- `src/engine/commands.ts:1841-1867` (inside `performStateBasedActionsOnce`, the CR 704.5q pairing
  loop over `counterPairIds` computed at `commands.ts:1739-1743`) directly does
  `setCard(draft, {...card, counters})`, mutating **both** `'+1/+1'` and `'-1/-1'` counts — **no
  call to `recordCounterChangeIntent` anywhere in this loop**, for either counter type.
- `src/engine/commands.ts:742-768` `flushCounterChangeEvents` is called exactly **once** per
  top-level command, at `commands.ts:4242`, **after** `stabilizeBeforePriority(draft)` at line 4241
  (which runs `performStateBasedActionsOnce` to a fixed point, i.e. after annihilation has already
  happened). It reads `finalCounterValueForIntent` — the **current, post-SBA** value — for each
  recorded intent, computes `delta = after - intent.before`, and **skips emission when `delta ===
  0`** (`commands.ts:752-754`).

**Live, independently constructed reproduction** (throwaway test, executed and then deleted, not
committed):

1. `dispatch({type:'addCounters', cardId, counterType:'+1/+1', delta:2})` on a fresh permanent with
   no counters. Intent recorded: `{counterType:'+1/+1', before:0}`. No annihilation condition (no
   `-1/-1` present). Flush emits one event: `{counterType:'+1/+1', delta:2, before:0, after:2}`.
   This is the **only** `counterChange` event ever produced across the whole scenario.
2. `dispatch({type:'addCounters', cardId, counterType:'-1/-1', delta:1})`. `applyAddCounters`
   records intent `{counterType:'-1/-1', before:0}`. `stabilizeBeforePriority` then runs SBAs;
   `counterPairIds` now includes this card (`plus:2, minus:1`), `removeCount:1`, and the loop at
   `commands.ts:1841-1867` sets `'+1/+1':1` (was 2) and deletes `'-1/-1'` (was 1) via `setCard`,
   bypassing intent recording entirely for **both** mutations. `flushCounterChangeEvents` then
   processes the one recorded intent (`'-1/-1'`, `before:0`): reads the **final** `'-1/-1'` count,
   which is now `0` (deleted key → `?? 0`) → `after:0` → `delta:0` → **skipped, no event**.
3. **Confirmed via live inspection of `store().state.eventLog` after both dispatches**:
   - `store().state.cards[creatureId].counters` → `{'+1/+1': 1}` (true, current state).
   - The full `counterChange` event list in the log is unchanged from step 1: exactly one event,
     `{counterType:'+1/+1', delta:2, before:0, after:2}`.
   - No event anywhere has `counterType:'+1/+1'` with `after:1` (the true value). Verified
     `anyEventReflectsTrueFinalPlusOne === false`.
   - The stale dispatch-1 event (`after:2`) remains in the log uncorrected. Verified
     `staleEvent !== undefined`.
   - No `'-1/-1'` event exists at all (correctly suppressed as net-zero per the flush logic, but
     this suppression is exactly what masks the real, CR-704.5q-driven `+1/+1` reduction, since the
     `'+1/+1'` mutation itself was never tracked as an independent intent).

**This is worse than "an event is missing."** The event log contains a `CounterChangeEvent` whose
`after:2` field is a factual claim about the card's current counter count that became false the
moment the annihilation SBA ran later in the same dispatch, and nothing ever supersedes or
retracts it. Any consumer that trusts `after` as ground truth (a trigger condition evaluator, a UI
tooltip, a replay/audit tool) is misled.

**Golden test confirms the gap is being cemented, not caught**: `crGroundingGoldenCases.test.ts`
lines 1426-1440 (diff: previously asserted
`expect(state?.eventLog).toHaveLength(eventCountBeforeCounters)` — i.e. **zero** counterChange
events for this whole scenario in the pre-Slice-C baseline — now asserts
`toHaveLength(eventCountBeforeCounters + 1)` and pattern-matches the **stale** `{delta:2, before:0,
after:2}` event as the expected/correct outcome, immediately after asserting (line 1428) that the
card's true final counters are `{'+1/+1': 1}`. The test author demonstrably saw both facts
side-by-side in the same test body and did not notice (or did not address) the contradiction.
Re-ran this exact test in isolation: **PASS** — confirming vitest's suite does not currently
detect this as a defect because the assertion was written to match the buggy output.

**CR reference**: CR 704.5q ("If a permanent has both a +1/+1 counter and a -1/-1 counter on it,
N +1/+1 and N -1/-1 counters are removed from it, where N is the smaller of the number of +1/+1
and -1/-1 counters on it") is a real, common state-based action (fights, -1/-1 counter removal
effects, proliferate interactions, wither/infect combat). Any card with "whenever one or more
+1/+1 counters are removed from a permanent you control" (a real, existing EDH ability pattern —
e.g. counter-matters payoffs) would **silently fail to trigger** specifically when the removal
happens via 704.5q pairing rather than a direct negative-delta `addCounters` targeting that exact
counter type.

**Contradicts stated contract**: yes. The implicit contract of `flushCounterChangeEvents` /
`CounterChangeEvent` is "emit an event whenever a counter count genuinely changes" (this is the
entire justification for the intent/before/after mechanism existing at all, rather than just
diffing `counters` objects at command boundaries). The 704.5q loop is a legitimate, CR-mandated
counter-count mutation that this mechanism was supposed to cover and does not.

**Other code paths checked (per audit item (d))** — searched broadly, found none that compensate:
- `grep -rn "counterChange"` across `src/engine/` and `src/store/` (excluding tests): the only
  producer is `flushCounterChangeEvents` (`commands.ts:759`); the only consumer is
  `collectCounterChangePendingTriggers` (`triggers.ts:1462-1489`), which iterates
  `newEventsOfType(prev, next, 'counterChange')` — i.e. it is entirely dependent on the same event
  log and inherits the identical gap. There is no independent "diff counters object at command
  boundary" scan anywhere.
- Also note: only `trigger.counter-put` (CR "put a counter on") trigger-leaf matching was
  implemented in this slice (`triggers.ts:1462-1489`, `counterPutLineMatchesEvent`); there is no
  "counter removed" trigger-leaf pattern at all in the current codebase. So the immediate
  practical blast radius today is limited to future cards needing counter-removal triggers, plus
  any other consumer of `eventLog` that trusts `after` as current truth — but the event-emission
  *contract* itself is broken regardless of whether a consumer exists yet.

**Severity justification**: HIGH, not LOW/cosmetic. It is a genuine, reproducible correctness gap
in a CR-mandated, common state-based action's interaction with a stated "emit on any counter
change" contract, it produces an actively stale/misleading log entry (not just an omission), and
the implementer's own updated golden test demonstrates the discrepancy was visible in the test
output and not caught.

---

## Finding 2 — MEDIUM — duplicated `withMoveReason` helper across module boundary

`src/engine/commands.ts:3287-3296` defines a module-private `withMoveReason(commands, reason)`.
`src/store/gameStore.ts:1146-1152` defines an unrelated, separately-typed module-private
`withMoveReason(commands, reason: 'sacrifice')` with near-identical logic (map over commands,
patch `moveCard`→`graveyard` commands with `reason` if not already set). Not a correctness bug
(both copies are individually correct and behave identically for the sacrifice case), but a
DRY/reuse violation — a future fix to one copy (e.g. broadening the reason-tagging condition, or
fixing an edge case) can silently diverge from the other. Low risk today since both are simple
map functions, but worth flagging as a maintenance smell introduced by this slice.

---

## Finding 3 — LOW/observational — no negative test for cross-player discard/sacrifice false-positive

`cr603SemanticEvents.test.ts`'s "does not tag generic moveCard...as discard or sacrifice" test
(lines 220-260) only tests the *reason-tagging* false-positive path (a plain `moveCard` doesn't get
labeled `discard`/`sacrifice`), not the *trigger-matching* false-positive path across players: e.g.
an opponent's creature being sacrificed should not fire "whenever **you** sacrifice a creature" on
a permanent you control. The regex logic in `sacrificeLineMatchesEvent`
(`triggers.ts:1071-1099`) does contain a `you` vs controller check
(`/\byou\b/i.test(condition) && controllerOf(event.before) !== controllerOf(sourceSnapshot)`), so
this is very likely handled correctly, but it is untested by any test file I found in this diff.
Same applies to `discardLineMatchesEvent` (`triggers.ts:1044-1061`, checks `event.before.ownerId`
against `you`). This is a coverage gap, not a confirmed defect — I did not find a reproduction of
a false positive, only an absence of a test that would catch a regression here. Rated LOW since the
guard code appears present and directionally correct on read.

---

## Other adversarial checks performed — all PASS / no defect found

- **`crGroundingGoldenCases.test.ts` full diff scrutiny**: `git diff` shows exactly one hunk
  touching lines ~1426-1440 (the `cr-sba-plus-minus-counter-annihilation` test) plus an import-type
  addition (`CounterChangeEvent`) at the top. No other test in this 1400+ line file — including
  `cr-trigger-6033b-two-bucket-order` (line 671) and `cr-trigger-6033b-apnap-per-bucket` (line
  750) — appears anywhere in the diff. Confirmed unweakened/untouched.
- **Two-bucket APNAP goldens re-run in isolation** (combined with Slice A/B/golden-cases files):
  `npx vitest run review.cr603-triggers-sliceA.test.ts review.cr603-triggers-sliceB.test.ts
  crGroundingGoldenCases.test.ts` → 3 files, 46 tests, all PASS. Read both APNAP golden test bodies
  directly (not just pass/fail) — assertions are substantive (explicit bucket-order and
  per-bucket-APNAP expectations on `pendingTriggers` ordering), not weakened.
- **Discard reason-tagging accuracy**: `applyDiscard` (`commands.ts:2022-2034`) is the only
  producer of `reason:'discard'`, gated on `card.zone === 'hand'`, and is only invoked via the
  dedicated `discard` `GameCommand` (`commands.ts:4150-4151`), which is only issued by genuine
  discard-effect/cost compilation paths. `grep` across `commands.ts` for any other
  `moveCard`-to-graveyard-from-hand path found none that could be mistagged. SBA deaths
  (`commands.ts:1764,1778,1792,1806`) always pass explicit `'sba'` reason and are untouched by this
  slice's logic — confirmed lethal-damage/0-toughness death stays `reason:'sba'`, not relabeled.
- **Sacrifice reason-tagging**: gated through `withSelfSacrificeReason`/`lineHasSelfSacrifice`
  (cost-side, `commands.ts:3287-3313`) and `withMoveReason`/`guidedCommandsWithSemanticReasons`
  (effect-side, `gameStore.ts:1146-1160`, `commands.ts:3473-3478`), both keyed off
  `effect.sacrifice`/`sacrifice` prompt kind or an explicit self-sacrifice cost regex — not applied
  to generic moves.
- **Scope discipline — Slice B untouched**: `git diff src/engine/triggers.ts` contains zero
  occurrences of `schedule` — confirms `PendingTrigger.schedule`/delayed-trigger logic was not
  touched by this slice.
- **Once-per-turn gate reuse**: no new once-per-turn ledger code was added in this diff (`git diff`
  shows no ledger/`oncePerTurn` changes in `triggers.ts` or `commands.ts`); the new
  `trigger.counter-put` leaf uses the same `addCurrentPermanentPendingTrigger` /
  `TriggerCollectionContext` plumbing as the pre-existing Draw/LifeChange/Damage leaves — reused,
  not reimplemented.
- **Determinism**: `pendingCounterChanges` is a plain array, pushed to in call order
  (`recordCounterChangeIntent`) and iterated in array order (`for (const intent of intents)` in
  `flushCounterChangeEvents`) — no `Object.keys`/`Object.values` involved in intent processing
  order, so processing order is stable/deterministic. (Note: `counterPairIds` computation at
  `commands.ts:1739` does use `Object.values(draft.state.cards)`, which is pre-existing
  iteration-order-dependent code unrelated to the new intent mechanism, and out of scope for this
  slice's diff — not a new determinism regression.)
- **Test honesty (`cr603SemanticEvents.test.ts`)**: substantive, not smoke-only. Asserts
  reason-tagging (`discard`/`sacrifice`), trigger-firing linkage (`pendingFor` matches the emitted
  event's `eventId`), the counter-put positive golden, and one explicit false-positive
  ("does not tag generic moveCard...") test. Does not cover the counter-annihilation gap (no test
  in this file exercises 704.5q interaction) and does not cover cross-player false-positive firing
  (see Finding 3).

---

## Overall count

- **BLOCKER**: 0
- **HIGH**: 1 (counter-annihilation event-loss/staleness, Finding 1)
- **MEDIUM**: 1 (duplicated `withMoveReason` helper, Finding 2)
- **LOW**: 1 (missing cross-player false-positive trigger test, Finding 3)
