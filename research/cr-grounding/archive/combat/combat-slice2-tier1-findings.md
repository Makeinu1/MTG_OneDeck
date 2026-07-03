# S-COMBAT Slice 2 — Tier-1 Adversarial Audit Findings

Auditor: cold/independent Tier-1 pass. Did not write this code. All judgments anchored to
`rule/Magic_The_Gathering_Comprehensive_Rules.txt` and `research/cr-grounding/combat-slice2-codex-brief.md`
(frozen Fable decisions) / `combat-slice2-design.draft`.

## Verdict: GREEN (with 2 minor out-of-brief-scope file changes flagged below — not blocking)

## Red flags (non-blocking, for Fable's awareness before re-owning)

1. **Out-of-brief files touched**: `eslint.config.js` and `vite.config.ts` are modified but are not
   listed in the codex-brief's 対象ファイル (`types.ts`, `commands.ts`, `gameStore.ts`,
   `golden-cases.json`, `crGroundingGoldenCases.test.ts`, engine-spec draft). The change adds
   `.claude` to ESLint's `globalIgnores` and to vitest's `exclude`, with a comment
   "Worktree checkouts under .claude/ would otherwise be collected as duplicate test files." This
   is plausibly legitimate test-hygiene infra (it matches the exact `.claude/worktrees/*` pollution
   problem the audit task itself was warned about), but it was not authorized by the brief and
   should be reviewed/re-owned by Fable explicitly rather than silently accepted. Not a CR/contract
   violation — `docs/`, `review.*`, `CLAUDE.md`, and git ops are untouched (verified below).
2. **`research/cr-grounding/project-goal-milestones.md` modified**: updates the roadmap status table
   (marks S-COMBAT slice 1 "Done", slice 2 "Active") and the "Immediate next action" narrative. This
   file is under `research/cr-grounding/`, not `docs/`, so it is not explicitly forbidden by the
   brief's "変更禁止" list, but it is also not in the brief's authorized 対象ファイル list, and per
   CLAUDE.md roadmap-status bookkeeping is normally Fable's job. Content is accurate bookkeeping (no
   contract/decision drift), but flag for Fable re-ownership.
3. **Stray untracked file `loving-darwin-readme.patch`** at repo root: an unapplied, uncommitted
   diff against `README.md` (adds doc-governance links/sections). `README.md` itself is NOT modified
   in the working tree — the patch is orphaned and inert. Harmless but should be deleted before
   `/ship` (it is not part of any of the 8 actually-modified files and would otherwise show up as an
   untracked artifact in a `git status` review).

None of the above touch `docs/`, `review.*`, `CLAUDE.md`, or perform any git operation. No engine
correctness or scope-leak issue found.

---

## Check 1 — Mechanical (lint / tsc / build / vitest)

**PASS.**

- `npm run lint` → clean, no output, exit success.
- `npx tsc --noEmit` → clean, no output, exit success.
- `npm run build` → succeeds (`tsc -b && vite build`, 77 modules transformed, `dist/` emitted).
- `npx vitest run src/ --exclude '**/.claude/**'` → `Test Files 1 failed | 99 passed (100)`,
  `Tests 1 failed | 1067 passed (1068)`. The single failure is
  `src/data/__tests__/review.classifier-parity.test.ts > reaches full corpus parity` timing out at
  60000ms — this is exactly the pre-flagged known-flaky, CI-skipped test (`it.skipIf(!hasSnapshot)`,
  comment confirms "Skipped in CI (snapshot gitignored)"). Treated as a known non-issue per the audit
  brief's explicit caveat. Everything else green.

## Check 2 — Forbidden-file scan

**PASS** (with the 2 non-blocking flags above).

`git status --porcelain` / `git diff --name-only`:
```
 M eslint.config.js
 M research/cr-grounding/golden-cases.json
 M research/cr-grounding/project-goal-milestones.md
 M src/engine/commands.ts
 M src/engine/types.ts
 M src/store/__tests__/crGroundingGoldenCases.test.ts
 M src/store/gameStore.ts
 M vite.config.ts
?? loving-darwin-readme.patch
?? research/cr-grounding/combat-slice2-codex-brief.md
?? research/cr-grounding/combat-slice2-design.draft
?? research/cr-grounding/combat-slice2-engine-spec.draft
```
- No `docs/*` files modified. `git diff --name-only -- docs/` is empty.
- No `review.*` files modified. `git diff --name-only -- 'review.*'` is empty (note: files named
  `review.*.test.ts` inside `src/store/__tests__/` etc. were not touched — confirmed by full diff
  listing above containing no `review.` filename).
- `CLAUDE.md` untouched (`git diff --name-only -- CLAUDE.md` empty).
- No git operations performed by the implementer: `git log --oneline -1` still shows `872605e`
  (slice 1's commit) as HEAD; all slice 2 work remains uncommitted in the working tree.
- Engine-spec draft correctly located at
  `research/cr-grounding/combat-slice2-engine-spec.draft` (62 lines, present).
- The 2 flagged files (`eslint.config.js`, `vite.config.ts`) and `project-goal-milestones.md` are
  config/bookkeeping, not contract or review-authority files — does not violate the hard
  "no docs/no review.*/no CLAUDE.md/no git ops" rule, but is outside the brief's authorized file list.

## Check 3 — Player-damage atomicity (CR 510.2)

**PASS.**

`src/engine/commands.ts`:
- `applyResolveCombatDamage` (line 874) builds `playerDamageTotals: Map<string, CombatPlayerDamageTotal>`
  during a single pass over `combat.attackers` (sorted by `declaredOrder`/`cardId`, same draft).
- For each unblocked attacker (`attacker.blockedBy.length === 0`, line 885) whose live battlefield
  object still exists and whose target is a player, damage is aggregated via
  `addCombatPlayerDamage(playerDamageTotals, attacker.target, Math.max(0, effectivePower(...)))`
  (lines 886-893) — CR 510.1a ("assigns combat damage equal to its power... 0 or less doesn't assign")
  and CR 510.1b ("unblocked creature assigns combat damage to the player... it's attacking").
- `applyCombatPlayerDamageTotals(draft, playerDamageTotals.values())` is called at line 932, AFTER
  the full attacker loop (which also applies creature-vs-creature damage via `applyPositiveCombatDamage`
  on the same `draft`), and BEFORE the function returns. The caller `applyCommand` calls
  `stabilizeBeforePriority(draft)` exactly once, at line 2467, after the entire command switch —
  confirmed only one call site exists for `resolveCombatDamage`'s control flow. This satisfies CR
  510.2 ("all combat damage that's been assigned is dealt simultaneously... this turn-based action
  doesn't use the stack").
- Player damage is computed via internal draft helpers `applyPlayerLifeDelta` / `applyOpponentLifeDelta`
  (lines 632-645), NOT via separate public `adjustLife`/`adjustOpponentLife` commands chained through
  `applyCommands`. The public `adjustLife`/`adjustOpponentLife` cases in `applyCommand` (lines
  ~1816-1819, ~2299-2302, ~2320-2327) were refactored to call these SAME helpers — correct code reuse
  without going through a serial-command path for combat.
- Clamping: `addCombatPlayerDamage` skips `amount <= 0` (CR 120.8: "If a source would deal 0 damage,
  it does not deal damage at all"); `Math.max(0, effectivePower(...))` clamps negative power to 0
  per CR 510.1a. Opponent/player life itself is allowed below 0 (consistent with existing
  `adjustOpponentLife` semantics and the brief's explicit "opponent life は0未満可").
- Aggregation per target confirmed by `combatPlayerDamageKey` (keys by `P1` or
  `OPPONENT_A:<lifeLabel>`) and the `existing.amount + amount` merge in `addCombatPlayerDamage`.
- **Golden verifies aggregation**: `cr-combat-multiple-unblocked-attackers-aggregate-player-damage`
  (2/2 + 4/4 unblocked) asserts `opponentLife['対戦相手A']` goes 40 → 34 (sum of 2+4=6). Ran this
  golden directly as part of the full vitest pass — green.

## Check 4 — No double damage (core goal)

**PASS.**

`src/store/gameStore.ts` `declareAttack` (diff inspected directly):
- OLD code computed `damage = sum(effectivePower)` and called
  `applyCommands(cur, [{ type: 'adjustOpponentLife', delta: -damage }, ...tapCommands])` — a direct
  life-adjustment hack, fully removed.
- NEW code builds a single `commands` array:
  `enterCombat → declareAttackers (with target.lifeLabel) → declareBlockers([]) → resolveCombatDamage`,
  passed once to `applyCommands(cur, commands)`. There is no leftover `adjustOpponentLife` or
  `adjustLife` call anywhere in the new `declareAttack` body — life changes occur exclusively inside
  `resolveCombatDamage`'s `applyCombatPlayerDamageTotals`.
- Adversarial check performed: traced a 3-power unblocked attack through
  `cr-combat-unblocked-attacker-damages-defending-player` golden — `opponentLife['対戦相手A']` goes
  from 40 to exactly 37 (delta -3, NOT -6). Confirms single-path damage, not double-counted.
- Regression pin directly confirms non-double-damage at the store level: `m47.test.ts:292-296`
  (`store().declareAttack([vigilantId, bruteId], '対戦相手A')`) asserts
  `opponentLife['対戦相手A']` === 34 (a 4-power + 2-power attack = 6 total, 40−6=34, not 40−12=28).
  `review.m47.test.ts:185-189` independently pins `40 - 6` for a similar two-attacker case. Both
  pass.
- Tapping: non-vigilance tap is performed exactly once, inside `applyDeclareAttackers`
  (`src/engine/commands.ts` line ~792: `if (isBattlefieldCreature(...) && !hasVigilance(...) &&
  !card.tapped) { setCard(draft, { ...card, tapped: true }) }`). The store's `declareAttack` no
  longer builds any `tapCommands` array — `hasVigilance`/`effectivePower` imports were removed from
  `gameStore.ts` (confirmed in diff: `- effectivePower, ... - hasVigilance,` removed from the
  import list), eliminating the prior duplicate-tap code path entirely.
- `m47.test.ts:295-296` confirms exactly one tap state per creature
  (`vigilantId.tapped === false`, `bruteId.tapped === true`) — consistent with single-tap-via-
  declareAttackers, not double-toggled.

## Check 5 — Regression (do-not-break-UI)

**PASS.** Ran the 6 named files directly:
```
npx vitest run src/engine/__tests__/m47.test.ts src/engine/__tests__/review.m47.test.ts \
  src/store/__tests__/review.m6_10.test.ts src/store/__tests__/review.phaseC.test.ts \
  src/store/__tests__/triggerCandidates.test.ts src/store/__tests__/review.combat.test.ts
→ Test Files  6 passed (6)
  Tests  52 passed (52)
```
- Compat pin verified literally in `m47.test.ts:292-298`: `declareAttack([4-power, 2-power-
  vigilance], '対戦相手A')` → `opponentLife['対戦相手A']` === 34, `vigilantId.tapped === false`,
  `bruteId.tapped === true`, summoning-sickness warnings present for both. All assertions pass.
- `review.m6_10.test.ts:62-69`: attack declaration surfaces `trigger.attack` candidate with correct
  `sourceId`/`triggerId` — pass.
- `triggerCandidates.test.ts:394-413`: after `declareAttack`, candidates include `trigger.attack`
  (attacker) and `trigger.attack-watcher` (watcher); `store().undo()` clears candidates to `[]`;
  `store().redo()` keeps them `[]` (single-undo-step semantics preserved) — pass.
- `review.phaseC.test.ts:137-138`: `declareAttack([id], '対戦相手')` followed by
  `expect(candidateTriggerIds()).not.toContain('trigger.combat-damage')` — pass, confirms attack
  declaration alone does not synthesize a combat-damage trigger candidate.
- `review.combat.test.ts`: passed as part of the same run (slice-1 creature-vs-creature combat
  behavior preserved).

## Check 6 — Scope-leak

**PASS.** Grepped the full diff (`commands.ts`, `types.ts`, `gameStore.ts`, golden files) for
`planeswalker|trample|first.?strike|double.?strike|prevent|replac|redirect|infect|toxic|lifelink|
wither|commander.?damage|battle`. The only hits were the substring `battlefield` (zone literal,
unrelated) and explicit negative-scope notes inside the golden JSON `mustNot` fields
("trample excess をこの slice で自動実装しない。", "combat-damage trigger や commander damage を
この slice で自動生成しない。") — these are documentation of what is correctly NOT implemented, not
implementation leakage.
- `CombatTarget` (`src/engine/types.ts` line 68) is exactly
  `{ type: 'player'; playerId: PlayerId; lifeLabel?: string }` — confirmed NO planeswalker variant
  was added this slice, matching the brief's explicit constraint ("planeswalker variant は今回足さ
  ない=player only").
- All 3 new/modified goldens use `makeCombatCreature(...)` with `oracleText = ''` (default, no
  keywords) and `typeLine: 'Creature'` — confirmed vanilla creatures only, no infect/lifelink/trample
  fixtures.

## Check 7 — Golden replacement correctness

**PASS.**
- `cr-combat-unblocked-attacker-no-creature-mark` is absent from both
  `research/cr-grounding/golden-cases.json` (confirmed via Python JSON parse of all 29 current
  case ids — not present) and `src/store/__tests__/crGroundingGoldenCases.test.ts` (diff shows the
  `it(...)` block for this id fully replaced, not duplicated). The id only still appears in
  historical/non-authoritative draft and findings docs
  (`combat-structure-design.draft`, `combat-codex-brief.md`, `combat-slice2-design.draft`,
  `combat-tier1-findings.md`) — these are prior-slice planning artifacts, not live test/data files,
  so no dangling reference exists in anything that executes.
- 3 new goldens present in `golden-cases.json` with correct CR refs and `requiredObservations`:
  - `cr-combat-unblocked-attacker-damages-defending-player`: opponentLife 40→37, no creature mark,
    step `endOfCombat`. Test assertion matches exactly (`crGroundingGoldenCases.test.ts` line ~1258:
    `expect(state?.opponentLife['対戦相手A']).toBe(37)`).
  - `cr-combat-blocked-attacker-does-not-damage-player`: opponent life stays 40 (unchanged), creature
    marks applied (attacker damageMarked=1, blocker damageMarked=3) per slice-1 behavior. Test
    assertion matches.
  - `cr-combat-multiple-unblocked-attackers-aggregate-player-damage`: opponentLife 40→34 (2+4=6
    aggregated). Test assertion matches.
- All 3 goldens executed successfully as part of the full `vitest run` (no failures attributed to
  `crGroundingGoldenCases.test.ts` in the 99-passed-files run).

---

## Summary

No correctness defects found against CR 508.1f / 509.1h / 510.1a / 510.1b / 510.2 / 120.3a / 120.8.
Player damage is computed and applied atomically inside `resolveCombatDamage` on a single draft,
aggregated per target, clamped per CR 120.8/510.1a. `declareAttack` is a clean Option-A compatibility
wrapper with exactly one damage path and exactly one tap path — verified both by code reading and by
all regression/golden tests passing. Scope strictly bounded to player-only unblocked combat damage;
no planeswalker/trample/strike-step/prevention/keyword-damage/commander-damage/battle leakage.

The only items needing Fable's attention before `/ship` are bookkeeping, not engine correctness: (1)
re-own/confirm the `.claude` exclusion change in `eslint.config.js` + `vite.config.ts` (outside the
brief's file list but plausibly legitimate infra), (2) re-own the `project-goal-milestones.md` status
update, and (3) delete the orphaned `loving-darwin-readme.patch` at repo root before staging.
