# Tier-1 Audit Findings: S-EVENTS / MANA (CR 605.1b)

Auditor: cold independent session  
Date: 2026-06-30  
Commit state: uncommitted (working tree diff only)

---

## Summary Verdict

**GREEN with one CONCERN**

All 6 adversarial checks pass. No red flags. One latent design concern is flagged below (potential double-fire when a watcher triggers on `activatedManaAbility` events — the `seen` set does not deduplicate across the two staged events). This concern has no impact on the current golden cases or tests (the real-card observer is deferred to C-GRAMMAR), but should be resolved before C-GRAMMAR lands.

---

## Check 1 — Mechanical 4-point (independent re-run)

**PASS**

| Command | Result |
|---|---|
| `npm run lint` | Passed (no output = clean) |
| `npx tsc --noEmit` | Passed (no output = clean) |
| `npx vitest run` | 377 test files passed, 4053 tests passed |
| `npm run build` | Built in 123ms, 0 errors |

Test suite enlarged from prior baseline (new tests added, none removed).

---

## Check 2 — Forbidden-file scan

**PASS**

`git diff --name-only` shows 5 modified files and 4 untracked files:

Modified (tracked):
- `research/cr-grounding/golden-cases.json` — correct lane (research, not docs)
- `research/cr-grounding/project-goal-milestones.md` — correct lane
- `src/engine/types.ts` — type definitions only (permitted)
- `src/store/__tests__/crGroundingGoldenCases.test.ts` — new test cases added (permitted)
- `src/store/gameStore.ts` — routes mana ability through new transaction (permitted)

Untracked (new files):
- `research/cr-grounding/mana-codex-brief.md` — correct lane
- `research/cr-grounding/mana-engine-spec.draft` — correct lane (draft, not in `docs/`)
- `src/engine/__tests__/manaTransaction.test.ts` — new unit tests (permitted)
- `src/engine/manaTransaction.ts` — new pure engine module (permitted)

**No `docs/` files were touched. No `review.*` files were touched. `CLAUDE.md` was not touched. No git operations were performed by the implementer.**

The engine-spec draft is correctly placed in `research/cr-grounding/mana-engine-spec.draft`, not in `docs/`.

---

## Check 3 — Scope-leak detection

**PASS**

**3a. Full SBA suite:**  
`git diff` shows no new SBA logic. `grep` for `sba`, `stateBasedAction`, `performState` in `manaTransaction.ts` returns nothing. The transaction only calls `applyCommands`, `collectTriggeredManaAbilities`, and `triggeredManaAbilityPlan`. The milestone brief's "maximum risk" constraint was honored.

**3b. Real-card corpus classification:**  
No corpus-wide real-card observer was implemented. The `collectTriggeredManaAbilities` function scans battlefield cards present in the current game state (synthetic test cards), not a Scryfall corpus index. This is the correct deferred behavior. No reference to Scryfall IDs, bulk data, or card classification sweeps appears in the new code.

**3c. No 605.1b trigger in `GameState.pendingTriggers` or stack:**  
`PendingManaTrigger` is transaction-local only. `GameState.pendingTriggers` is typed as `PendingTrigger[]` (`src/engine/types.ts:238`); `PendingManaTrigger` is a separate type that is never assigned to that field. `manaTransaction.ts` has no reference to `pendingTriggers` on `GameState`. `addAbilityToStack` does not appear in `manaTransaction.ts`. Both `gameStore.ts` call sites (lines 1305 and 1702) feed the result state from `resolveManaAbilityTransaction` directly to `commit`, bypassing the ordinary stack/pendingTrigger path.

---

## Check 4 — Test-weakening detection

**PASS**

`git diff src/store/__tests__/crGroundingGoldenCases.test.ts | grep "^-"` produces no lines containing `expect`, `toBe`, `toEqual`, or `toMatch`. Zero existing assertions were removed or loosened. All 191 added lines are new test code (3 new `it` blocks). The existing test infrastructure (`beforeEach`, `resetStore`, `goldenCase`, helper functions) was not modified.

---

## Check 5 — CR conformance of the 3 golden cases

**PASS** (with minor precision note on case 3)

**Case `cr-triggered-mana-ability-no-stack` (CR 605.1b / 605.4a):**

CR 605.1b: a triggered mana ability must (a) require no target, (b) trigger from activation/resolution of an activated mana ability or from mana being added to a mana pool, (c) could add mana when it resolves. CR 605.4a: it does not go on the stack; resolves immediately after the mana ability that triggered it, without waiting for priority.

- Land A's `{T}: Add {G}.` is CR 605.1a (no target, adds mana, not loyalty).
- Watcher B's `Whenever a player taps a land for mana, that player adds one mana of any type that land produced.` — trigger source is tapping land for mana (= mana being added). No target. Adds mana. Satisfies CR 605.1b.
- Test asserts: `manaPool.G === 2` (A's 1G + B's 1G via `contextualManaCommands`), `zones.stack.length === stackDepthBefore`, `pendingTriggers === []`, `triggerCandidates === []`.
- All assertions enforce the CR requirement. The `contextualManaCommands` path correctly resolves "one mana of any type that land produced" by inspecting the trigger event's `ManaAddedEvent.amount`. **CONFORMS.**

**Case `cr-add-mana-trigger-from-non-mana-event-is-normal-trigger` (CR 605.1b / 605.5a):**

CR 605.5a: "a triggered ability that could produce mana but triggers from an event other than activating a mana ability" is not a mana ability and follows normal rules. Watcher C's `Whenever you cast a spell, add {G}.` triggers from a spell-cast event, not a mana-related event. The `isManaRelatedTriggerCondition` function correctly returns false for `activatedManaAbility` events (cast events don't produce those) and for the cast-dispatch path (which doesn't call `resolveManaAbilityTransaction` at all).

- Test asserts: `manaPool.G === 0` (no mana added immediately), `zones.stack === [spellId]`, `pendingTriggers` contains watcher with `triggerId: 'trigger.cast-watcher'`.
- The cast-watcher path in `src/engine/triggers.ts:634-644` calls `addCurrentPermanentPendingTrigger` → `pendingTriggers` (ordinary path). This is independent of `manaTransaction.ts`. **CONFORMS.**

**Case `cr-targeted-add-mana-trigger-is-normal-trigger` (CR 605.1b / 605.5a):**

CR 605.5a: "An ability with a target is not a mana ability, even if it could put mana into a player's mana pool when it resolves." Watcher D's `Whenever you cast a spell, target player adds {G}.` fails the targetless requirement of CR 605.1b (line 310: `ir.constructs.includes('construct.target') → return false`). Additionally, the trigger source is a cast event (non-mana), so it fails a second criterion.

- Test asserts same structure as case 2: `manaPool.G === 0`, spell on stack, pendingTrigger with `trigger.cast-watcher`.
- **Precision note:** The fixture conflates two exclusion criteria (non-mana trigger source + has target). Ideally a pure "has target, but IS mana-triggered" case would isolate the targetless criterion of CR 605.1b. However, both exclusion criteria are implemented correctly, and the `isTriggeredManaAbilityForEvent` function rejects on `construct.target` first (line 310, before checking trigger source). The test passes and the boundary is enforced. This is a completeness gap in the golden case suite, not a conformance bug. **CONFORMS (with noted coverage gap).**

---

## Check 6 — Fixed-point / infinite-loop safety

**PASS**

`manaTransaction.ts:141-154`: the `while (queue.length > 0)` loop checks `iterations >= iterationCap` at the top of each iteration (before dequeue). Default cap = 256 (`DEFAULT_ITERATION_CAP`). If reached, a warning string is pushed to `result.warnings` and a `{ kind: 'iteration-cap', ruleRef: '605.4a', iterationCap, remainingQueueSize }` entry is pushed to `result.log`, then `break` exits the loop cleanly. Remaining triggers are discarded — they are NOT routed to `pendingTriggers` or the stack.

The unit test `manaTransaction.test.ts:87-103` validates this with `iterationCap: 3` on an infinite-chain watcher ("Whenever you add mana, add {G}."), asserting `manaPool.G === 4` (1 initial + 3 iterations) and that a warning containing `上限` is present and an `iteration-cap` log entry exists.

Cap semantics: with cap=3, iterations 1-3 are processed (3 mana events), cap is hit at the start of iteration 4, break. Total mana = 4G. Test assertion is consistent. **CONFORMANT with design §Transaction algorithm.**

---

## Latent Concern (not a red flag for this milestone)

**CONCERN: potential double-fire for `activatedManaAbility`-stage watchers**

The transaction creates two `ActivatedManaAbilityEvent` objects for each mana ability activation: one with `stage: 'activated'` and one with `stage: 'resolved'` (lines 86-118). Both are passed as `initialEvents` to `collectTriggeredManaAbilities`. The `seen` set deduplicates by `${event.eventId}:${objectId}:${abilityLineIndex}` — but the two events have different `eventId`s (different sequence numbers), so a watcher whose trigger text matches `activatedManaAbility` events (e.g., `Whenever a player activates a mana ability, add {G}.`) would be added to the queue **twice** and resolve **twice**.

CR 605.1b says the trigger fires "from the activation or resolution" — this describes two possible trigger windows but does not mean a single watcher fires on both. In practice, a watcher fires once per qualifying event, and having two staged events in scope simultaneously causes the double-queue.

**Impact now:** Zero. The golden case watcher `"Whenever a player taps a land for mana..."` matches only `manaAdded` events, not `activatedManaAbility` events. The real-card observer is deferred to C-GRAMMAR, so no real card exercises this path. All current tests pass.

**Impact at C-GRAMMAR:** Any real card with text like `"Whenever you tap a permanent for mana..."` or `"Whenever a player activates a mana ability..."` would fire double. This must be resolved before C-GRAMMAR wires real-card observers into the transaction. Recommended fix: remove the `activatedEvent` from `initialEvents` or unify the two staged events under a single trigger-eligible event ID, then re-check CR 605.1b wording.

---

## File Inventory (no files were modified by this audit)

- Evidence source: `src/engine/manaTransaction.ts` (new)
- Evidence source: `src/engine/__tests__/manaTransaction.test.ts` (new)
- Evidence source: `src/store/gameStore.ts` lines 1305, 1702
- Evidence source: `src/engine/types.ts` lines 164-178, 217-238
- CR anchor: `rule/*.txt` lines 2683-2707 (CR 605.1a, 605.1b, 605.3b, 605.4a, 605.5, 605.5a)
- CR anchor: `rule/*.txt` line 2054 (CR 405.6c)
- Design anchor: `research/cr-grounding/mana-ability-substrate.md` (R-FREEZE-3)
- Scope contract: `research/cr-grounding/mana-codex-brief.md`
