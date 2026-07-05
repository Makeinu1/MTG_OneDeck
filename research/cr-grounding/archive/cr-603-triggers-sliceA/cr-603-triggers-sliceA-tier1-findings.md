# Tier-1 Adversarial Audit: cr-603-triggers-apnap Slice A (batch3-1a)

Auditor: independent Tier-1 (cold session, no implementation context).
Scope: uncommitted working-tree diff — `src/engine/triggers.ts` (+630/-diff), `src/engine/types.ts` (+6),
`src/engine/init.ts`, `src/engine/commands.ts`, `src/engine/priority.ts`, `src/store/gameStore.ts`,
`src/engine/__tests__/priority.test.ts` (mechanical), new `src/store/__tests__/triggerEventSubscriptions.test.ts`
(implementer-authored, informative only).

Method: read the actual diff hunks (not just summaries), traced key construction/consumption code,
constructed and ran 4 throwaway adversarial vitest probes against the live engine (file deleted after
running; not part of this findings artifact and not committed), and re-read the pre-existing pinned
`cr-trigger-6033b-*` golden assertions in `src/store/__tests__/crGroundingGoldenCases.test.ts` (file
untouched by this diff, confirmed via `git diff --name-only`).

## 4-check results

1. `npm run lint` — **PASS** (clean, no output/errors).
2. `npx tsc --noEmit` — **PASS** (no output, zero type errors).
3. `npx vitest run` — **PASS**: 149 test files, **1334 tests passed, 0 failed**.
4. `npm run build` — **PASS**: `tsc -b && vite build` succeeded, `dist/` produced and removed after
   verification (`rm -rf dist`), per instructions.

## Pinned APNAP/two-bucket tests — read, not just run

`src/store/__tests__/crGroundingGoldenCases.test.ts` is **unmodified** by this diff (confirmed:
`git diff --name-only -- src/store/__tests__/crGroundingGoldenCases.test.ts` is empty; file's last
commit is `cb7061b`, pre-dating this working tree change).

- `cr-trigger-6033b-two-bucket-order` (line ~666): actually asserts that an `ability-triggered`-bucketed
  trigger is stacked *above* an `ordinary`-bucketed one even when explicit placement order says otherwise
  — genuine CR 603.3b bucket-boundary assertion, not a smoke test. Still exercises the pre-existing
  `stackPlacementBucket` mechanism end-to-end via `placePendingTriggersForPriority`.
- `cr-trigger-6033b-apnap-per-bucket` (line ~745): asserts APNAP ordering is applied independently
  within each bucket (4 sources split P1/OPPONENT_A × ordinary/ability-triggered, expects final stack
  order `[a, b, c, d]`). Genuine assertion, unmodified, and it passed under `npx vitest run` (see full
  1334-pass run above) with this diff's changes to `priority.ts`/`triggers.ts` in place.
- `priority.test.ts` diff is a single mechanical line (`oncePerTurnTriggerLedger: { turn: 1, consumedKeys: [] }`
  added to a state-construction helper) — required only because `GameState` grew a new required field;
  does not touch any APNAP assertion logic.

**Conclusion: no APNAP/two-bucket regression.** `priority.ts`'s only change is renaming
`collectPendingTriggers` calls to `collectPendingTriggerUpdate` (which now also returns/threads the
once-per-turn ledger state) — the bucket-placement and APNAP-ordering code paths downstream
(`orderPendingTriggersApnap`, `placePendingTriggersOnStackAsBatch`) are untouched by this diff.

## Adversarial probes — results

I wrote a throwaway `_audit_probe_sliceA.test.ts` (not committed, deleted after running) exercising the
actual store/engine, with `console.log` dumps of ledger state at each step.

### PROBE1 — once-per-turn turn-reset (highest-value probe)
- Turn 1: Enduring-Innocence-style permanent (`c1:1`), first qualifying ETB → 1 pending trigger,
  ledger becomes `{"turn":1,"consumedKeys":["1|c1:1|line-0|P1"]}`.
  - **Key format confirmed**: `${turn}|${sourceObjectId}|line-${abilityLineIndex}|${controllerId}`,
    matching the judge-approved key shape (`turn|sourceObjectId|line-<abilityLineIndex>|controllerId`).
- Same turn 1, second qualifying ETB → correctly suppressed (0 new pending), ledger unchanged.
- `dispatch({ type: 'nextTurn' })` → ledger becomes `{"turn":2,"consumedKeys":[]}` — **correct reset**,
  confirmed via `resetOncePerTurnTriggerLedger` being called from both `applyNextPhase` (end→untap
  transition, `src/engine/commands.ts` ~line 1957) and `applyNextTurn` (~line 1971).
- Turn 2, re-entry of a qualifying creature → **trigger fires again** (fresh pending trigger observed).
- **No stale-ledger-carryover bug found.** `oncePerTurnConsumedKeysForState` (triggers.ts line ~163)
  independently guards against a turn-mismatched ledger by returning an empty `Set` if
  `ledger.turn !== state.turn`, so even if `stateWithOncePerTurnLedger` were somehow skipped for one
  transition, the consumption-check path self-heals on the next collection call. This is a genuine
  defense-in-depth double-check, not just cosmetic.

### PROBE2 — CR 400.7 new-object (blink) handling
- Confirmed `objectIdOf` = `` `${card.id}:${card.zoneChangeCounter}` `` (types.ts line 58-60), and
  `zoneChangeCounter` increments on every zone change (`commands.ts` line 482).
- Blinking the **source permanent itself** (Enduring Innocence: `c1:1` → exile → battlefield → `c1:3`,
  two increments for leave+enter) within the same turn:
  - The new incarnation's ETB-other ability **re-triggers on a subsequent qualifying ETB in the same
    turn**, and the ledger now holds **both** keys: `1|c1:1|line-0|P1` (old incarnation, still present,
    inert) and `1|c1:3|line-0|P1` (new incarnation, freshly consumed).
  - This is CR-400.7-correct in the sense the brief asked to verify (no carryover blocks the new
    incarnation) — **however, this is also the honest adversarial finding the brief predicted**:
    blinking the source is a real, exploitable way to make a "once per turn" ability trigger more than
    once per turn *for that physical permanent* in in-game terms, because the substrate's identity for
    the ledger key is the CR-400.7 object identity, not "the same continuously-existing permanent [as a
    player would describe it]." **This is CR-correct behavior** (400.7 says a new object has no memory
    of the old object's history — this is the rules-accurate outcome for a genuine blink), so it is
    **not a bug**, but it should be recorded as a known/intentional consequence of anchoring the key to
    `sourceObjectId` rather than some physical-card-identity concept. See MEDIUM finding below.

### PROBE3 — ETB self-vs-other regression
- 3a: A creature with "Whenever **another** creature you control enters, draw a card" does **not**
  self-trigger on its own ETB (`pendingFor(wId)` empty). Confirmed via `etbOtherLineMatchesEvent`
  (triggers.ts line ~316): `textReferencesSelf` + `!/\b(?:another|other)\b/i.test(subject)` correctly
  excludes self only when the condition text does *not* say "another"/"other" — and separately,
  `sourceSnapshot.physicalCardId === entered.physicalCardId` (line ~334) is an unconditional identity
  check that blocks self-ETB regardless of wording. Two independent guards; no regression found.
- 3b: A plain "Whenever a creature enters, draw a card" (no qualifiers, no power/control restriction)
  correctly still fires when **another** creature enters. The power/control filters in
  `etbOtherLineMatchesEvent` are all conditionally gated (`if (/pattern/.test(condition) && ...)`), so
  a plain condition string with none of those substrings skips every filter and returns `true`. **No
  false-negative regression for unqualified other-ETB cards.**

### Damage-marking exclusion (pre-existing invariant)
- Traced `markDamage` (`commands.ts` line 3835, `applyMarkDamage` line 1089) — confirmed it does **not**
  push anything to `eventLog`; only `dealDamage` → `applyDealDamage` → `pushDamageEvent` populates a
  `DamageEvent`. The new `collectDamagePendingTriggers` (triggers.ts) only reads
  `newEventsOfType(prev, next, 'damage')` off `eventLog`, so it cannot fire off a bare `markDamage` call.
  **No leak found.**

### Determinism
- `consumedKeys` array is built as `[...context.oncePerTurnConsumedKeys]` from a `Set<string>`
  (triggers.ts line ~199) whose insertion order is driven by iterating `next.zones.battlefield`, which
  is an ordered array (pre-existing pattern throughout the file, not introduced by this diff). JS `Set`
  iteration order is insertion order (spec-guaranteed). **No `Object.keys`/`Object.values`
  order-dependence found** in the new code.

### Scope leakage — GameEvent union / scheduling fields
- `git diff -- src/engine/types.ts` shows **exactly** the `OncePerTurnTriggerLedger` interface and the
  `oncePerTurnTriggerLedger: OncePerTurnTriggerLedger` field on `GameState` — no `GameEvent` union
  member added, no `scheduledFor`/`dueTurn`/`duePhase`-shaped field anywhere in the diff or in a
  repo-wide grep (`grep -rn "scheduledFor|dueTurn|duePhase"` → zero hits).
- Confirmed `'delayed-triggered'` classification/grammar code (`grammar/index.ts`, `grammar/ir.ts`) is
  **not touched** by this diff at all (`git diff --name-only` excludes `src/engine/grammar/`).

### Snapshot/forward-compat
- `normalizeOncePerTurnTriggerLedger` (`gameStore.ts` line ~353): absent field → reset to
  `{turn, consumedKeys: []}`; non-object → reset; `turn` present but not a finite number or mismatched
  vs. restored state's current turn → reset; `consumedKeys` present but not a string array → coerced to
  `[]` (turn kept, since turn already matched). All four required backfill cases from the brief are
  handled. Mirrored (independently, slightly differently shaped) in `commands.ts`'s
  `cloneOncePerTurnTriggerLedger` for the draft-cloning path — also correctly resets on
  turn-mismatch/malformed data.

### Test honesty of `triggerEventSubscriptions.test.ts`
This file is informative-only (not judge-owned), but since the brief asked to assess it: it covers each
event-type happy path (damage/draw/life/etb/leaves-graveyard) plus **two** once-per-turn gating cases
(Enduring-Innocence-style and Defiled-Crypt-style) and one snapshot-backfill case. **It does NOT test**:
turn-N-to-turn-N+1 reset (only single-turn suppression), the CR-400.7 blink/new-object scenario, or the
ETB self-exclusion / plain-other-ETB-no-qualifier cases. These gaps match exactly what this Tier-1 audit
was asked to independently verify — and this audit found all of them behave correctly when tested live
(see PROBE1–3 above), so the missing coverage is a **test-suite completeness gap**, not a sign of a
hidden implementation bug.

## Findings

### BLOCKER
None found.

### HIGH
None found.

### MEDIUM
1. **Once-per-turn ledger key is CR-400.7-object-scoped, not "continuously-existing permanent"-scoped —
   document this as intentional, not a latent bug.** PROBE2 shows that blinking the source of a
   once-per-turn ability (same turn) lets the "new" incarnation trigger again immediately. This is the
   CR-correct reading of 400.7 (a new object has no memory of the old object's trigger history) and
   matches real Magic rules for blink effects, but it is a decision with real gameplay-visible
   consequences (a player abusing an ETB-blink loop with a once-per-turn payoff will see it fire once
   per blink, not once per turn as a naive reading of the printed card text might suggest to a UI user
   who doesn't track object identity). Recommend an explicit code comment near `oncePerTurnTriggerKey`
   (triggers.ts ~line 171) and/or a golden case capturing this exact scenario, since it's exactly the
   kind of corner future maintainers will "fix" incorrectly into a bug (e.g. by keying on
   `physicalCardId` instead of `sourceObjectId`, which would then be the actual CR violation).
2. **`triggeredAbilityEntries` silently excludes `'delayed-triggered'`-shaped lines** (triggers.ts
   line ~96-100, filter `entry.line.shape === 'triggered'` only, no `'delayed-triggered'` branch). This
   is the right scope call for Slice A (delayed triggers deferred to Slice B) but is an *implicit*
   exclusion via a filter predicate rather than a documented one. A future contributor extending this
   function for an unrelated reason could accidentally add `'delayed-triggered'` to the filter and
   inadvertently pull delayed-trigger ability lines into the ordinary event-subscription path before
   Slice B's scheduling primitive exists, silently violating the Slice B/C scope boundary. Recommend a
   one-line comment explaining the intentional exclusion.

### LOW
1. `triggerEventSubscriptions.test.ts` (informative-only) does not cover the turn-reset-across-turns,
   CR-400.7-blink, or ETB-self-exclusion/no-qualifier-other-ETB scenarios that this audit was asked to
   verify. All three behave correctly when independently probed live against the engine (see above), so
   this is a coverage gap in the implementer's own smoke tests, not a functional defect. If this repo's
   process wants durable regression protection for these specific CR-relevant corners (especially the
   MEDIUM-1 blink interaction, which is easy to regress), it should eventually become a judge-authored
   `review.*`/golden case rather than rely on this one-time audit's throwaway probes.
2. The auxiliary changes in this working tree to `.claude/commands/autoloop.md`, `docs/judge-protocol.md`,
   `.gitignore`, and `research/cr-grounding/cr-backbone-ledger.json` are orchestration/process-doc
   changes unrelated to the Slice A engine contract (they describe the 3-way Slice A/B/C split and
   autoloop harness-tracking changes). Out of scope for this Tier-1 engine audit; flagged only so they
   aren't mistaken for reviewed-and-clean by omission.
3. `matchingEtbOtherAbilityLineIndex`/`matchingLeavesGraveyardAbilityLineIndex` both call
   `triggeredAbilityEntries` (which calls `splitAbilityLines`) once per candidate battlefield permanent
   per event — this is a straightforward O(battlefield × events) re-parse rather than a cached lookup.
   Not a correctness issue at current scale (test suite of 1334 tests completed in ~25s total), but
   worth a note if a future slice needs to optimize hot paths.

## Summary of contract-boundary compliance
- No new `GameEvent` union member added — confirmed by diff and grep. ✅
- No delayed-trigger scheduling primitive (`scheduledFor`/`dueTurn`/`duePhase`) added anywhere — confirmed
  by diff and repo-wide grep. ✅
- `'delayed-triggered'` classification/grammar untouched — confirmed (no `grammar/` files in diff). ✅
- `stackPlacementBucket` / two-bucket APNAP placement completely unmodified in behavior — confirmed via
  unmodified pinned golden tests passing, and via diff showing only wiring renames
  (`collectPendingTriggers` → `collectPendingTriggerUpdate`) in `priority.ts`, not logic changes to
  bucket/APNAP ordering itself. ✅
- New state `oncePerTurnTriggerLedger` matches the specified shape and key format exactly, with correct
  turn-based reset and three independent forward-compat backfill paths (`init.ts` for new games,
  `commands.ts` `cloneOncePerTurnTriggerLedger` for the draft path, `gameStore.ts`
  `normalizeOncePerTurnTriggerLedger` for snapshot restore). ✅
