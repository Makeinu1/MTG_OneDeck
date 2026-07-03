# S-SBA: damage-marked substrate — Tier-1 adversarial audit findings

Auditor: cold/independent (Tier-1, separate from implementer). Anchored to CR text (`rule/*.txt`), `research/cr-grounding/damage-marked-codex-brief.md` (fixed contract), and `research/cr-grounding/damage-marked-engine-spec.draft`.

## Verdict: GREEN

No red flags found. All 7 checks PASS. One CONCERN (non-blocking, advisory) noted under check 7: no fast-check property invariant covers `damageMarked >= 0` across random command walks (the file that would host it, `src/engine/__tests__/review.properties.test.ts`, is reviewer-owned and correctly untouched by the implementer — this is something for Fable/reviewer to add, not a defect in the delegated work).

## Red flags

None. (Forbidden-file scan clean; scope-leak scan clean; double-destroy scan clean.)

---

## Check 1 — Mechanical 4-point (re-run independently)

PASS.

- `npm run lint` → clean, no output, exit 0.
- `npx tsc --noEmit` → clean, no output, exit 0.
- `npx vitest run` → `Test Files 378 passed (378)` / `Tests 4068 passed (4068)`, duration ~61s.
- `npm run build` → `tsc -b && vite build` succeeded, emitted `dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js`. No errors.

## Check 2 — Forbidden-file scan

PASS.

`git status --porcelain` / `git diff --name-only` show modified:

```
research/cr-grounding/golden-cases.json
research/cr-grounding/project-goal-milestones.md
src/components/CardView.test.tsx
src/engine/__tests__/commands.test.ts
src/engine/__tests__/priority.test.ts
src/engine/commands.ts
src/engine/goldenReplay.ts
src/engine/init.ts
src/engine/types.ts
src/store/__tests__/crGrounding.test.ts
src/store/__tests__/crGroundingGoldenCases.test.ts
src/store/gameStore.ts
```

and untracked:

```
research/cr-grounding/damage-marked-codex-brief.md
research/cr-grounding/damage-marked-engine-spec.draft
```

- No `docs/` file touched.
- No file with `review.` in its name touched (`src/engine/__tests__/review.properties.test.ts`, `src/store/__tests__/review.m427.test.ts`, `src/store/__tests__/review.m428.test.ts` all absent from the diff).
- `CLAUDE.md` untouched.
- The engine-spec contract draft correctly landed at `research/cr-grounding/damage-marked-engine-spec.draft` (not `docs/`), per the brief's "変更禁止" clause. `docs/engine-spec.md` itself is untouched (confirmed: not in `git diff --name-only`).
- No git operations performed by the implementer (working tree is mid-diff, no new commits beyond the pre-existing `d9e3a63` HEAD).

`research/cr-grounding/project-goal-milestones.md` is in scope to edit per the brief (Codex's permitted lane is `research/cr-grounding/*`), and its diff only updates milestone status/next-action prose — no contract content was altered outside that lane.

## Check 3 — Scope-leak detection

PASS. This was the highest-risk check; ran multiple independent greps.

```
git diff -- src/engine/commands.ts src/engine/types.ts src/engine/init.ts \
  src/store/gameStore.ts src/engine/goldenReplay.ts \
  | grep -niE "declareAttacker|declareBlocker|combatDamageStep|combat.?damage|attacker|blocker|regenerat|first.?strike|double.?strike"
```

Single hit: `collectAttackPendingTriggers(committed, attackerIds),` in `src/store/gameStore.ts` — verified this is **pre-existing** code (function defined in `src/engine/triggers.ts:710`, already wired in `gameStore.ts` before this change); the diff hunk shows only a trailing-comma Prettier reformat at that call site, not new logic (`git diff` context confirms `-          collectAttackPendingTriggers(committed, attackerIds)` / `+          collectAttackPendingTriggers(committed, attackerIds),`).

A second, broader grep across `commands.ts` + `types.ts` for `regenerat|first.?strike|double.?strike|declareattack|declareblock|combatdamage` (case-insensitive, including comments) returned **zero** matches.

No new combat-step automation, no regeneration replacement state/logic, no first/double-strike damage-step splitting. The substrate is exactly state (`damageMarked`, `hasDeathtouchDamage`) + two commands (`markDamage`, `clearMarkedDamage`) + two SBA clauses, as scoped.

## Check 4 — Double-destroy / SBA-interaction

PASS.

`performStateBasedActionsOnce` (`src/engine/commands.ts:594-768`) computes four independent candidate-id lists from the **same pre-mutation snapshot** of `draft.state.cards` before any moves happen in this pass:

- `zeroToughnessCreatureIds` (704.5f): `toughness !== null && toughness <= 0` (line 605).
- `lethalDamageCreatureIds` (704.5g): `toughness !== null && toughness > 0 && markedDamageOf(card) >= toughness` (lines 611-614).
- `deathtouchDamageCreatureIds` (704.5h): `toughness !== null && toughness > 0 && hasDeathtouchDamage(card) && markedDamageOf(card) >= 1` (lines 620-626).

The `toughness > 0` guard on both 704.5g and 704.5h is structurally disjoint from 704.5f's `toughness <= 0` set — a card can appear in at most one of {704.5f} vs {704.5g, 704.5h}. (A card could in principle satisfy both 704.5g and 704.5h simultaneously — e.g. lethal damage from a deathtouch source — but each processing loop checks `card.zone !== 'battlefield'` (lines 660, 674, 688) before moving, so once 704.5g's loop moves the card to graveyard, 704.5h's loop for the same id skips it. Confirmed in the spec draft as the documented resolution at engine-spec.draft line 38.)

**Adversarial reasoning constructed for "0-toughness creature with marked damage":** a creature with `toughness > 0` base but enough `-1/-1` counters to bring effective toughness to `0`, *while also* having `damageMarked > 0` and `hasDeathtouchDamage: true`, is captured **only** by `zeroToughnessCreatureIds` (704.5f) — it fails the `toughness > 0` precondition for both 704.5g and 704.5h, so it cannot double-fire.

This exact scenario is unit-tested at `src/engine/__tests__/commands.test.ts:236-280` ("clears marked damage and does not double-destroy with CR 704.5f"): constructs a 2/2 creature, force-sets `damageMarked: 2, hasDeathtouchDamage: true, counters: { '-1/-1': 2 }` (→ effective toughness 0), dispatches a no-op command to trigger SBA stabilization, and asserts:
```js
expect(sbaEvents).toHaveLength(1);
expect(sbaEvents[0].sbaApplied).toBe('704.5f');
```
i.e. exactly one zone-change event fires, tagged `704.5f`, not `704.5g`/`704.5h`. This is a real adversarial regression test, not incidental coverage.

## Check 5 — CR conformance of 704.5g/h

PASS, with citations.

**704.5g** (CR text, `rule/*.txt:5504`): *"If a creature has toughness greater than 0, it has damage marked on it, and the total damage marked on it is greater than or equal to its toughness, that creature has been dealt lethal damage and is destroyed."*

Implementation (`commands.ts:607-615`):
```ts
const toughness = effectiveToughnessForSba(draft, card);
return toughness !== null && toughness > 0 && markedDamageOf(card) >= toughness ? [card.id] : [];
```
- Comparison is `>=` — matches CR 120.6 ("greater than or equal to") and 704.5g verbatim.
- `effectiveToughnessForSba` (`commands.ts:321-329`) reads `face?.toughness` (base) and adds `counters['+1/+1']` and subtracts `counters['-1/-1']` — the **same function** used by 704.5f's zero-toughness check (line 604), so effective-toughness computation is consistent across both SBAs by construction (no parallel/divergent toughness logic).
- Destination: `moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {..., sbaApplied:'704.5g'})` (line 676-679). The engine models a single shared `graveyard` zone array (`src/engine/types.ts:3-10` `ZoneId` union has no per-player graveyard split) — consistent with the project's stated single-player EDH-goldfish scope (CLAUDE.md: "統率者戦一人回し"), and identical to how the pre-existing 704.5f/704.5i destroy paths already work. This is not a regression or new risk introduced by this milestone.

**704.5h** (CR text, `rule/*.txt:5506`): *"If a creature has toughness greater than 0, and it's been dealt damage by a source with deathtouch since the last time state-based actions were checked, that creature is destroyed."*

Implementation (`commands.ts:616-627`):
```ts
return toughness !== null && toughness > 0 && hasDeathtouchDamage(card) && markedDamageOf(card) >= 1
  ? [card.id] : [];
```
- Keys off the boolean `hasDeathtouchDamage(card)` flag, not the damage amount — matches CR's "any damage from a deathtouch source" semantics (no magnitude threshold). The `markedDamageOf(card) >= 1` clause is a no-op redundancy in practice (the flag can only be set when `amount > 0`, see `applyMarkDamage` below) but does not weaken or alter the CR-conformant behavior — it's not gating on amount magnitude beyond "nonzero", consistent with deathtouch's "any damage" rule.
- `applyMarkDamage` (`commands.ts:537-552`): `hasDeathtouchDamage = hasDeathtouchDamage(card) || (deathtouch === true && markedAmount > 0)` — flag only sets on a positive normalized amount, matching the brief's explicit spec (brief line 13, draft line 22-23).

**Golden cases** (`research/cr-grounding/golden-cases.json` + `src/store/__tests__/crGroundingGoldenCases.test.ts:958-1120`): four cases added — `cr-sba-lethal-damage-destroys-creature`, `cr-sba-sublethal-damage-survives`, `cr-sba-deathtouch-any-damage-destroys`, `cr-cleanup-clears-marked-damage`. Inspected the actual test bodies (not just the JSON descriptions):

- Lethal case: asserts `state.cards[creatureId].zone === 'graveyard'`, `zones.graveyard` contains the id, `zones.battlefield` does not, and an `eventLog` entry exists with `fromZone:'battlefield', toZone:'graveyard', reason:'sba', sbaApplied:'704.5g'`. Real membership + tag assertions, not a smoke test.
- Sublethal case: asserts `zone:'battlefield', damageMarked:2, hasDeathtouchDamage:false` via `toMatchObject`, `zones.graveyard` does NOT contain the id, and no `sbaApplied:'704.5g'` event exists in the log (`.toBe(false)`). This positively proves absence of destruction, not merely absence of an error.
- Deathtouch case: same zone/event-log graveyard-membership pattern, tagged `sbaApplied:'704.5h'`.
- Cleanup case: asserts `damageMarked:2` after `markDamage`, then `damageMarked:0, hasDeathtouchDamage:false` after `clearMarkedDamage`, and `zones.graveyard` does not contain the id (proving clear-before-SBA-recheck doesn't accidentally destroy).

All four enforce genuine state/zone/event assertions consistent with CR 704.5g/h/514.2 — confirmed not smoke tests.

## Check 6 — Cleanup clearing (CR 514.2) + forward-compat

PASS.

CR 514.2 (`rule/*.txt:2438`): *"...all damage marked on permanents...is removed..."* (turn-based action, no stack).

- `clearMarkedDamageInternal` (`commands.ts:563-586`) sets `damageMarked: 0, hasDeathtouchDamage: false` for the target card(s); with no `cardId`, iterates all `battlefield` creatures (`typeLineOf(...).includes('Creature')`).
- Wired at both turn-transition surrogates as documented in the draft (engine-spec.draft lines 40-47):
  - `applyNextPhase`, `end -> untap` branch: `clearMarkedDamageInternal(draft)` called before `draft.state.turn += 1` (`commands.ts:937`).
  - `applyNextTurn`, direct turn-jump path: `clearMarkedDamageInternal(draft)` called before `draft.state.turn += 1` (`commands.ts:950`).
- Unit-tested at `commands.test.ts:282-308` ("clears marked damage on the existing end-to-untap turn transition"): marks 2 damage, forces `phase:'end'`, dispatches `nextPhase`, asserts `turn:2, phase:'untap'` and `cards[id]` matches `{ zone:'battlefield', damageMarked:0, hasDeathtouchDamage:false }`.
- No standalone CR 514 cleanup step exists in this engine (turn/phase model has no discrete "cleanup" phase distinct from `end`); the brief explicitly authorized treating the `end->untap` and `nextTurn` transitions as the cleanup surrogate and recording this as a scope-boundary (draft lines 40-47, 54) rather than silently mismodeling. This is an honest, correctly-flagged approximation, not a CR violation.

**Forward-compat / snapshot restore** — `src/store/gameStore.ts`:
- `normalizeMarkedDamage` (line 121-123): `typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0` — handles `undefined` (missing field from legacy snapshot), `NaN`, `Infinity`, and negative values, all backfilling to `0`.
- `normalizeSnapshotCards` (line 125+): computes `hasDeathtouchDamage = card.hasDeathtouchDamage === true` (any non-`true` value, including `undefined`, backfills to `false`), and only rewrites the card object if any field actually changed (avoids unnecessary churn / preserves referential equality when nothing needs fixing).
- Directly regression-tested at `src/store/__tests__/crGrounding.test.ts:171-198` ("CR 120.6/704.5g/704.5h: restoreGame backfills missing marked damage state"): constructs a snapshot with a card whose `damageMarked`/`hasDeathtouchDamage` keys are `delete`d entirely (simulating a pre-this-milestone snapshot), calls `restoreGame`, and asserts the restored card matches `{ damageMarked: 0, hasDeathtouchDamage: false }`. This is exactly the crash scenario the brief warned about (brief line 20: "これを怠ると旧 snapshot 復元でクラッシュする"), and it's covered by a real deletion-based test, not just type-level optionality.

## Check 7 — State invariants

PASS (core invariant), CONCERN (fast-check coverage gap, advisory only).

- `damageMarked >= 0` is enforced in multiple independent layers:
  - Command-time: `applyMarkDamage` (`commands.ts:537-552`) computes `markedAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0` before adding — a negative or non-finite `amount` argument contributes `0`, so `damageMarked` is monotonically non-decreasing and never goes negative via this command.
  - Read-time defense: `markedDamageOf` (`commands.ts:331-335`) clamps again (`Math.max(0, card.damageMarked)`) when reading, guarding against any out-of-band corruption (e.g. a hand-built `GameState` in a test, or future code that sets the field directly).
  - Snapshot-restore-time: `normalizeMarkedDamage` (gameStore.ts:121-123) clamps again on load.
  - Type-level comment documents the invariant: `src/engine/types.ts:38` `damageMarked: number; // CR 120.6 damage marked on a creature; always >= 0`.

- **CONCERN**: No fast-check property test in `src/engine/__tests__/review.properties.test.ts` (the I1–I7 invariant suite) was extended to assert `damageMarked >= 0` (or `hasDeathtouchDamage` well-formedness) holds after random command walks. I checked the existing I3 clause (`review.properties.test.ts:307-320`, "non-negative pools and counters") — it covers `manaPool`, `poison`, `energy`, `experience`, `card.counters`, and `commanderDamage`, but does **not** mention `damageMarked`. This file is correctly reviewer-owned and untouched by the implementer (confirmed absent from the diff, per Check 2) — the implementer could not have added this without violating the brief's "変更禁止" rule on `review.*` files. The brief itself flagged this as conditional ("必要なら不変条件...を追加し fast-check に反映", brief line 50) and left the call to the reviewer. **Recommendation for Fable/reviewer**: add a `damageMarked >= 0` (and optionally `hasDeathtouchDamage` boolean type) assertion to the I3 block in `review.properties.test.ts` during re-ownership, since the unit-level defenses are strong but unverified under the property-test's random command-sequence fuzzing (e.g. could a command not yet covered, or a future command, set `damageMarked` to a negative number through some other path that bypasses `applyMarkDamage`/`markedDamageOf`?). This is advisory, not a blocking defect — no evidence was found of an actual path that produces negative `damageMarked` today.

---

## Summary

| # | Check | Verdict |
|---|---|---|
| 1 | Mechanical 4-point | PASS (378 files / 4068 tests, lint/tsc/build all clean) |
| 2 | Forbidden-file scan | PASS (no docs/, review.*, CLAUDE.md touched; no git ops) |
| 3 | Scope-leak (combat/regen/strike) | PASS (zero hits; substrate-only) |
| 4 | Double-destroy / SBA interaction | PASS (disjoint toughness>0/<=0 guards + adversarial unit test) |
| 5 | CR conformance 704.5g/h | PASS (>=, effective toughness reuse, flag-keyed deathtouch, real golden assertions) |
| 6 | Cleanup (514.2) + forward-compat | PASS (both turn-transition surrogates wired; deletion-based restore regression test) |
| 7 | State invariants (damageMarked>=0) | PASS at unit/runtime level; CONCERN: no fast-check property coverage (reviewer's lane to add) |

**Overall: GREEN.** No scope violations, no forbidden-file edits, no double-destroy bug, CR text matches implementation behavior on the cited clauses, and the one gap found (fast-check invariant) is correctly outside the implementer's permitted edit surface and was honestly flagged as conditional in the brief.
