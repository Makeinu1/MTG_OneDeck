# S-COMBAT Tier-1 Adversarial Audit Findings

**Verdict: GREEN**

Auditor: cold/independent Tier-1 pass (separate from implementer). Anchored to CR text (`rule/*.txt`), `combat-codex-brief.md`, `combat-structure-design.draft`, `combat-engine-spec.draft`.

## Red flags

None. No forbidden-file writes, no fabricated determinism, no scope leak, no new SBA, no atomicity violation found.

## Pre-existing, unrelated test noise (not a red flag, documented for completeness)

`npx vitest run` reports `4 failed | 376 passed (380)` test files / `4 failed | 4079 passed (4083)` tests. All 4 failures are the **same** test — `reaches full corpus parity: divergentCards === 0 (local snapshot)` in `src/data/__tests__/review.classifier-parity.test.ts` — duplicated across stale `.claude/worktrees/*/` copies of the repo left over from prior parallel agent runs, plus the canonical copy. This test is explicitly gated `it.skipIf(!hasSnapshot)` and the code comment states "Skipped in CI (snapshot gitignored); enforced on the maintainer machine and by `npm run classifier-parity`." It timed out at 60000ms waiting on a local gitignored corpus snapshot that isn't present in this run. `git diff --name-only` confirms `src/data/__tests__/review.classifier-parity.test.ts` is **not** part of the S-COMBAT diff. This is environmental/pre-existing noise unrelated to combat, not a regression introduced by this milestone.

---

## Check 1 — Mechanical 4-point (re-run independently)

| Check | Result |
|---|---|
| `npm run lint` | **PASS** (exit 0, eslint reported nothing) |
| `npx tsc --noEmit` | **PASS** (exit 0, no output) |
| `npx vitest run` | **PASS** for all combat-relevant tests. 4079/4083 tests passed; the 4 failures are the unrelated, pre-existing, locally-gated `classifier-parity` snapshot test (see above), not present in the diff. |
| `npm run build` | **PASS** (`tsc -b && vite build`, built in 1.11s, `dist/` emitted cleanly) |

All combat golden cases and the new `src/engine/__tests__/combat.test.ts` unit suite passed as part of the 4079.

## Check 2 — Forbidden-file scan

`git status --porcelain` / `git diff --name-only`:

```
 M research/cr-grounding/golden-cases.json
 M research/cr-grounding/project-goal-milestones.md
 M src/engine/__tests__/priority.test.ts
 M src/engine/commands.ts
 M src/engine/goldenReplay.ts
 M src/engine/init.ts
 M src/engine/types.ts
 M src/store/__tests__/crGrounding.test.ts
 M src/store/__tests__/crGroundingGoldenCases.test.ts
 M src/store/gameStore.ts
?? research/cr-grounding/combat-codex-brief.md
?? research/cr-grounding/combat-engine-spec.draft
?? research/cr-grounding/combat-structure-design.draft
?? src/engine/__tests__/combat.test.ts
```

- `git diff --name-only | grep -i "review\."` → **no matches** (PASS, no reviewer-owned test touched).
- `git diff --name-only | grep -i "^docs/"` → **no matches** (PASS).
- `git diff --name-only | grep -i "CLAUDE.md"` → **no matches** (PASS).
- No git operations were taken by the implementer (working tree is uncommitted, as instructed).
- Engine-spec contract draft correctly lives at `research/cr-grounding/combat-engine-spec.draft` (untracked, new file), **not** in `docs/`. **PASS.**
- `research/cr-grounding/project-goal-milestones.md` was modified — this is a roadmap-tracking doc inside `research/cr-grounding/`, not `docs/`, and is the same file Codex is documented to update per the milestone-tracking convention used by prior milestones in this repo (see its own diff history). Not a violation.

**Result: PASS.**

## Check 3 — CR 510.2 atomicity (central risk)

Read `applyResolveCombatDamage` (`src/engine/commands.ts:804-860`) and its caller chain:

- `applyResolveCombatDamage` calls `applyPositiveCombatDamage` (`commands.ts:793-802`) directly, which calls `applyMarkDamage` (`commands.ts:574`) directly on the **same `draft`** passed in. It does **not** call `applyCommand` or `applyCommands` per-assignment — confirmed by grep: no `applyCommand(` / `applyCommands(` calls appear inside `applyResolveCombatDamage` or its helpers.
- The single SBA pass happens via `stabilizeBeforePriority(draft)` at `commands.ts:2396`, which is called **exactly once**, after the entire `switch` statement in the exported `applyCommand` function (`commands.ts:2093` onward) — i.e. after both the attacker→blocker mark and the blocker→attacker mark have already been written to the same draft. There is no second/early stabilize call inside the `case 'resolveCombatDamage':` branch (`commands.ts:2205-2208`) or anywhere in the combat helper functions.
- Adversarial scenario constructed and verified: golden case `cr-combat-single-block-lethal-mutual-damage` (2/2 attacker vs 2/2 blocker, mutual lethal) is present in `research/cr-grounding/golden-cases.json:641-690`, executed in both `src/store/__tests__/crGroundingGoldenCases.test.ts:1153-1192` and `src/engine/__tests__/combat.test.ts:79-103`. Both assert:
  - Both `attackerId` and `blockerId` end in `graveyard`.
  - Both have a `704.5g` SBA zone-change event.
  - `new Set(sbaEvents.map(e => e.simultaneousGroupId)).size === 1` — i.e. **both deaths come from the same SBA pass**, proving the damage was visible to SBA simultaneously rather than the first creature being destroyed mid-sequence (which would prevent it from also marking damage on its killer in a serial implementation, since `markedDamageOf`/positive-power read happens before the marks are applied — under serial public-command application, the second `markDamage` command would have to re-enter `applyCommand`, triggering its own `stabilizeBeforePriority`, and the first creature's removal from the battlefield zone would make `requireCard`/`liveCombatCreature` checks on the second mark fail or be skipped).
  - This case would indeed fail under naive serial `applyCommands([markDamage A, markDamage B])` because after the first `markDamage` is applied as its own command, `stabilizeBeforePriority` runs and removes the lethally-damaged creature from `battlefield` via the existing 704.5g SBA before the second mark could be applied — meaning the second mark would target a non-battlefield card and `liveCombatCreature` (commands.ts:664-674, which checks `isBattlefieldCreature`) would reject it, breaking mutual damage. The implementation avoids this entirely by writing both marks into the same draft before any SBA runs.

**Result: PASS.** Atomicity is correctly implemented — single draft, single end-of-command stabilize, golden case pins the mutual-kill behavior that a serial implementation would break.

## Check 4 — No fabricated determinism (multi-blocker)

Read the multi-blocker branch in `applyResolveCombatDamage` (`commands.ts:818-826`):

```ts
if (attacker.blockedBy.length > 1) {
  deferredCount += 1;
  const warning =
    `manual-combat-damage: ${attacker.cardId} は複数のブロッカーにブロックされています。` +
    '戦闘ダメージ割当を手動で行ってください。';
  draft.warnings.push(warning);
  pushLog(draft, warning);
  continue;
}
```

No `applyPositiveCombatDamage` (and hence no `markDamage`) call happens for a multi-blocked attacker or any of its blockers — the `continue` skips straight to the next attacker, leaving the whole blocked group's damage unassigned. Golden case `cr-combat-multiple-blockers-deferred` (`golden-cases.json:763-807`, executed in `crGroundingGoldenCases.test.ts:1255-1291`) constructs a 4/4 attacker blocked by two 1/3 blockers and asserts:
- `attacker.blockedBy` contains both blockers (blocked status correctly recorded per CR 509.1h).
- All three creatures (`attackerId`, `blockerAId`, `blockerBId`) remain at `damageMarked: 0` — **no silent "first blocker gets it all" auto-assignment**.
- `store().warnings` contains a string including `manual-combat-damage`.
- `state.log` also contains an entry including `manual-combat-damage`.

This directly satisfies CR 510.1c's requirement that the attacking creature's controller — not the engine — divides damage among multiple blockers, and matches the brief's explicit instruction (`combat-codex-brief.md:21`) forbidding a silent "all to first blocker" default. The design draft's "Alternative for stricter CR ownership" (require explicit allocation / defer) was the option actually implemented, not the weaker deterministic-default option also sketched in the draft — this is the stricter, more conservative choice and is consistent with the brief's fixed decision #4.

**Result: PASS.**

## Check 5 — Scope-leak detection

`grep -n` across the full diff (`src/engine/commands.ts`, `src/engine/types.ts`, and all other touched files) for first-strike/double-strike/trample/banding/menace/evasion logic, and for life-adjustment inside `resolveCombatDamage`:

- No matches for `firstStrike` / `first-strike` / `first strike`, `doubleStrike` / `double-strike` / `double strike`, `trample`, `banding`, `menace` anywhere in `commands.ts`.
- `CombatTarget` type (`types.ts:68`) is restricted to `{ type: 'player'; playerId: PlayerId }` only — no planeswalker/battle target variant was fabricated, matching the deferred scope in the design draft ("first slice can record a player target for unblocked attacks... creature-vs-creature combat is the primary acceptance surface").
- No `adjustOpponentLife` or `adjustLife` call appears inside `applyResolveCombatDamage` or any of its helper functions (`applyPositiveCombatDamage`, `liveCombatCreature`, `sourceHasDeathtouch`) — confirmed by reading the full body of `applyResolveCombatDamage` (`commands.ts:804-860`) and grepping for `life` near combat code. The two `adjustOpponentLife`/`adjustLife` cases that exist in the file are pre-existing, unrelated `GameCommand` cases in the main `switch` (`commands.ts:2222-2254`), not reachable from combat damage resolution.
- The unblocked-attacker golden case (`cr-combat-unblocked-attacker-no-creature-mark`) explicitly asserts `opponentLife['対戦相手A']` is unchanged after `resolveCombatDamage`, pinning the "no player damage in this slice" boundary.
- No new combat-priority-automation, attack/block legality, or step-splitting code was found; `applyDeclareAttackers`/`applyDeclareBlockers` perform no restriction/requirement/cost checks beyond a soft `warnIfNotBattlefieldCreature` warning, consistent with the sandbox philosophy and the explicit defer list.

**Result: PASS.** No scope leak detected.

## Check 6 — No new SBA + reuse

- `performStateBasedActionsOnce` (`commands.ts:862` onward) was not modified to add a new SBA rule; the diff only touches it insofar as combat damage now feeds the **existing** 704.5g (lethal damage) and 704.5h (deathtouch) checks via the **existing** `markDamage`/`damageMarked`/`hasDeathtouchDamage` substrate (introduced in a prior milestone, commit b6ab728 per `project-goal-milestones.md`).
- The single-block lethal golden case shows both creatures reaching the graveyard via zone-change events with `sbaApplied: '704.5g'` (asserted in both `crGroundingGoldenCases.test.ts:1182-1191` and `combat.test.ts:93-102`) — the existing SBA path, not a new one.
- `applyResolveCombatDamage` deliberately reads deathtouch from `effectiveKeywords` (`sourceHasDeathtouch`, `commands.ts:676-678`) and passes it through to the pre-existing `markDamage`/`applyMarkDamage` deathtouch flag plumbing, rather than re-implementing destruction logic.

**Result: PASS.**

## Check 7 — Forward-compat + invariants

- `normalizeSnapshotCombat` (`src/store/gameStore.ts:198-205`):
  ```ts
  function normalizeSnapshotCombat(state: GameState): GameState['combat'] {
    const snapshot = state as Partial<GameState>;
    const combat = snapshot.combat;
    if (!combat || snapshot.phase !== 'combat' || combat.turn !== snapshot.turn) {
      return null;
    }
    return combat;
  }
  ```
  This correctly backfills `combat` to `null` for (a) missing `combat` field (legacy snapshot), (b) `phase !== 'combat'`, and (c) `combat.turn !== state.turn` — exactly the three normalization rules specified in the design draft and engine-spec draft. It is wired into `normalizeSnapshotState` at `gameStore.ts:231`.
- Test coverage: `src/store/__tests__/crGrounding.test.ts:201-243` ("CR 506.1: restoreGame backfills missing or stale combat state to null") exercises all three branches explicitly: missing `combat` key, `phase: 'main1'` with a present `combat` object, and `phase: 'combat'` with `turn` one ahead of the stored combat's `turn` — all three assert `store().state?.combat` is `null` after restore.
- Combat is nulled on leaving the combat phase: `enterPhase` (`commands.ts:1185-1192`) sets `draft.state.combat = null` whenever `phase !== 'combat'`. Verified by `combat.test.ts:105-115` ("clears combat when the phase leaves combat") which enters combat, then calls `nextPhase`, and asserts `state.combat` is `null` and `state.phase === 'main2'`.
- Combat participants reference real cards: `liveCombatCreature` (`commands.ts:664-674`) checks the card exists, is a battlefield creature, and its current `objectIdOf(card)` still matches the declared `objectId` before treating it as a live damage source/recipient — guarding against stale references per CR 506.4 direction noted in the design draft.
- Immutability: in `applyDeclareBlockers` (`commands.ts:746-791`), the `attackers` array used as the mutation target (`commands.ts:751-754`) is a **freshly mapped array of spread copies** (`combat.attackers.map((attacker) => ({ ...attacker, blockedBy: [] }))`), not the original `combat.attackers` reference from the (potentially frozen) prior state — so the later in-place field write `attacker.blockedBy = [...attacker.blockedBy, card.id]` (`commands.ts:774`) mutates a local, never-published object, consistent with the rest of the codebase's draft-mutation pattern. No direct mutation of frozen/shared structures was found.
- `npx vitest run` (Check 1) included the full suite, which contains `src/engine/__tests__/review.properties.test.ts`'s I4 deep-freeze fuzz test; it passed (it is among the 4079 passing tests, not among the 4 unrelated failures). One **CONCERN** (not a violation): the new combat commands (`enterCombat`/`declareAttackers`/`declareBlockers`/`resolveCombatDamage`) do not appear to be included in the property-based random command-walk arbitrary generator in `review.properties.test.ts` (no `combat`-related token found there), so I4 fuzzing does not yet exercise combat-specific mutation paths directly — it only confirms no regression in the existing fuzzed command set. This is a `review.*`-owned file the implementer was correctly forbidden from touching, so it is a gap for the reviewer to consider for a follow-up, not an implementation defect.

**Result: PASS**, with one **CONCERN** noted above (property-fuzz coverage gap, reviewer-owned, not implementer's fault).

---

## Summary

All 7 adversarial checks PASS. No red flags. The implementation:
- Correctly achieves CR 510.2 atomicity via single-draft marking + single end-of-command stabilize, with a golden case that would demonstrably fail under serial application.
- Correctly refuses to fabricate the CR 510.1c multi-blocker division choice, deferring with a warning instead.
- Stays strictly within the declared first-slice scope (no first/double strike, trample, banding, menace, player damage, or priority automation).
- Reuses the existing 704.5g/h SBA substrate without adding new SBA rules.
- Correctly backfills/normalizes `combat` on snapshot restore and phase transitions, with explicit test coverage for all three normalization branches.
- Respects the forbidden-file boundary (no `docs/`, no `review.*`, no `CLAUDE.md`, no git operations).

One non-blocking CONCERN for the reviewer's own (off-limits-to-implementer) `review.properties.test.ts`: combat commands are not yet part of the I4 property-fuzz command generator.
