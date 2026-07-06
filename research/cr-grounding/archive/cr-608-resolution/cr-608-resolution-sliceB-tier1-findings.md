# Tier-1 Audit Findings — cr-608-resolution Slice B (LKI mana-value, Feed the Swarm shape)

Auditor: independent Tier-1 (adversarial), 2026-07-06. Scope: uncommitted working-tree diff
touching `src/engine/types.ts`, `src/engine/commands.ts`, `src/engine/grammar/compile.ts`,
`src/store/gameStore.ts`, and new test `src/engine/__tests__/cr608ResolutionLkiManaValue.test.ts`.

## Verdict up front

**No BLOCKER or HIGH findings.** The implementation matches the stated contract. The
shared-plumbing change to `gameStore.ts` (`confirmGuidedTarget`) is a genuine no-op for every
existing guided-target effect atom other than the new destroy+lose-life-mana-value leaf. The
CR 608.2h LKI-timing claim is correct by construction, not just by lucky test coverage.

---

## Shared-plumbing regression probe (gameStore.ts) — THE MAIN EVENT

**(a) Which code path was touched.**
Confirmed: `confirmGuidedTarget(cardId)` at `src/store/gameStore.ts:2801-2856` is the single
general/shared confirmation function used by every non-activation guided-target effect resolution
(destroy, tap, untap, exile, return, counter-plus, counter-spell, etc.). It is NOT a
narrower/new-leaf-specific path — the diff modifies lines 2836-2850, which sit strictly after the
`isActivationPending` branch (a separate function, `targetSelectionForCard`, untouched by this
diff) and strictly before the shared `buildGuidedCommands` call and `advanceGuidedResolution`.
The judge's characterization is accurate, not overstated.

**(b) Byte-identical behavior for unrelated effects — verified live, not just by inspection.**
I wrote and ran 6 throwaway adversarial vitest cases directly against the real
`useGameStore.getState().confirmGuidedTarget` path (file was created, run, and deleted —
not committed, not left in the tree):
- Plain `"Destroy target creature."` (no follow-up clause, victim mana value 7): destroyed,
  life **unchanged**. PASS.
- `"Destroy target artifact or enchantment."` (different type filter, no follow-up, mana value 6):
  destroyed, life **unchanged**. PASS.
- `"Destroy target creature. You lose life equal to its power."` (wrong characteristic): does not
  get captured by the new leaf (`raw` does not carry `mana value`); if guided at all under the
  destroy atom via unrelated pre-existing coverage, life stays flat. PASS.
- `"Destroy target creature. Its controller loses life equal to its mana value."` (wrong
  life-loser, "its controller" not "you"): the leaf's regex
  `isLoseLifeEqualToTargetManaValueClause` anchors on `^you\s+lose\s+life`, so this clause cannot
  match; confirmed live that IF this were ever guided under `effect.destroy`, the leaf's `raw`
  signature is absent and life does not change. PASS.
- Full Feed-the-Swarm live scenario (mana value 5): destroy + life drops by exactly 5 via the real
  `confirmGuidedTarget` path (not a hand-rolled engine-only harness). PASS.
- `confirmGuidedTarget('totally-bogus-card-id')`: does not throw. PASS — see (c) below for why.

Additionally, the pre-existing, **unmodified** `src/store/__tests__/review.cr110-tap-status.test.ts`
(4 tests exercising `confirmGuidedTarget` for tap/untap) passed unchanged as part of the full
1374-test suite run, which is further direct evidence of no regression in shared plumbing.

`buildGuidedCommands`'s switch statement at `src/engine/grammar/compile.ts:1421-1485` reads
`answer.targetSnapshots?.[index]` into a local `targetSnapshot`, but only the
`effect.destroy` case (line 1424-1433) ever references that local; `sacrifice`, `exile`, `return`,
`tap`, `untap`, `counter-plus`, `counter-spell`, and `default` never touch it. Even inside
`effect.destroy`, the extra `adjustLife` command is gated by
`manaValueForDestroyThenLoseLifePrompt`, which first calls
`isDestroyThenLoseLifeManaValuePromptRaw(prompt.raw)` (`compile.ts:1499-1503`) — a plain
"Destroy target X." prompt's `raw` is just the destroy clause text (set by the ordinary
`guidedTargetPrompt` builder, not the new `guidedDestroyThenLoseLifeManaValuePrompt` builder which
explicitly concatenates `"${destroy}. ${lifeClause}."}` only when both clauses are matched
elsewhere), so the regex cannot match and `manaValue` is `null`, and `commands` is just the single
`moveCard` — byte-identical to pre-diff behavior.

**(c) Exception/side-effect risk of `objectSnapshotForCard(cur, cardId)` on every confirm.**
`objectSnapshotForCard` (`src/engine/commands.ts:560-586`) is a pure read: `state.cards[cardId]` →
returns `null` if absent (no throw). In `confirmGuidedTarget`, this call happens at line 2837,
*after* the legality gate at lines 2824-2830 (`eligibleTargets(...)` / `legalIds.has(cardId)`),
which already rejects any `cardId` not currently a legal target and returns early with a warning
before `objectSnapshotForCard` is reached with a bad id. In the extremely unlikely case a legal-at
-selection-time id vanished from `state.cards` between listing and confirm (same-tick call, so
not realistically reachable in current code), `objectSnapshotForCard` still just returns `null`,
`targetSnapshot` becomes `undefined`, `[]` is threaded, and downstream behavior degrades to "no
mana-value adjustLife command" rather than throwing. No new exception surface. No measurable
perf concern — this is a single `Record` lookup plus a few field spreads, called once per
guided-target confirmation (not in a hot loop).

**(d) Full test suite.** See below — 100% pass, zero regressions.

---

## CR 608.2h correctness — the core claim

Traced the actual code path for the "5 must come from the pre-destroy snapshot" requirement:

- `adjustLife` command handling (`src/engine/commands.ts:3411-3414` and `:4127-4130`,
  `applyPlayerLifeDelta(draft, cmd.delta, ...)`) is a pure delta on player life state. It never
  reads `state.cards[targetId]` at all — the numeric delta is baked into the `GameCommand` payload
  at *command-construction* time.
- The mana value is read once, inside `buildGuidedCommands` (called from either
  `confirmGuidedTarget` in the store, or `applyStoredTargetCommands` in `commands.ts:3513-3524` for
  stored/triggered targets), from `targetSnapshot.manaValue`, where `targetSnapshot` is the
  `ObjectSnapshot` captured into `TargetSelection.selection.snapshot` **at target-selection time**
  (i.e., before the ability even resolves, let alone before the `moveCard`-to-graveyard command
  runs). The destroy and the life-loss commands are pushed into the *same* `commands` array and
  returned together (`compile.ts:1424-1432`) — by the time either command is applied, both deltas
  are already fixed numbers; there is no re-read of `state.cards` for the mana value at any point
  after target selection.
- Live-verified: implementer's own test
  (`src/engine/__tests__/cr608ResolutionLkiManaValue.test.ts:88-127`) mutates the victim's `defs[...].cmc`
  from 4 to 9 **after** target selection but **before** resolution, then resolves and asserts life
  drops by exactly 4 (the pre-mutation/pre-destruction value), not 9. This is a genuine LKI-timing
  adversarial test, not happy-path — it actively tries to break LKI by making "current info" wrong
  and confirms the code doesn't fall back to it.
- I independently re-ran the "mana value 5" full scenario through the real store
  (`confirmGuidedTarget`, not just engine-level `applyCommand`) and got destroy + life -5. PASS.

## Zero mana value / land target

Implementer's test (`cr608ResolutionLkiManaValue.test.ts:129-174`) targets a land (cmc 0),
asserts `resolved.life === 40` (unchanged from starting 40, i.e., delta 0 applied, not skipped),
and asserts the destroy still happens (`cards.c2.zone === 'graveyard'`). The path is:
`manaValueForDestroyThenLoseLifePrompt` returns `targetSnapshot?.manaValue ?? null` — for a
land with `def.cmc === 0`, `manaValue` is `0` (not `undefined`), so `manaValue !== null` is `true`
(0 !== null), and `commands.push({ type: 'adjustLife', delta: -0 })` runs. This is correct: the
`adjustLife` command still executes (visible in the commands array,
`{ type: 'adjustLife', delta: -0 }`), it's just a no-op numerically. No crash, no skip-via-falsy
bug (a naive `if (manaValue)` gate would have wrongly skipped this — the code correctly uses
`!== null`).

## Exact-phrase gate

All tested live, all correct:
- Wrong characteristic ("its power" instead of "its mana value") — leaf's clause regex requires
  literal `mana value`; does not match. PASS.
- "Destroy target artifact or enchantment." with no follow-up at all — still compiles to
  plain guided destroy (pre-existing `guidedTargetPrompt` builder, unaffected by the new leaf,
  which requires exactly 2 effects where the second is `effect.lose-life`). Confirms the new
  leaf's presence does not regress the old plain-destroy-with-no-followup case. PASS.
- "Its controller loses life..." (different life-loser) — leaf's regex anchors on
  `^you\s+lose\s+life`, excluding this variant. PASS.

## Scope boundaries — all honored

- `ObjectSnapshot.manaValue` purely additive: confirmed both `objectSnapshotOf`
  (`commands.ts:536-553`, populated as `def?.cmc`) and `objectSnapshotForCard`
  (`commands.ts:560-586`, populated as `def?.cmc`) construct it identically — both source from
  `CardDef.cmc`, a static/printed characteristic, not layer-derived.
- `grep -rn "resolutionContext" src/engine src/store` → **zero matches**. No persistent
  `GameState.resolutionContext` was added.
- No new `GameCommand` variant: confirmed the new leaf only emits pre-existing `moveCard` and
  `adjustLife` command shapes.
- Slice A and cr-603 Slice A/B/C review files unmodified (`git diff` against them returns empty)
  and pass in isolation (see below).

## Test honesty

`cr608ResolutionLkiManaValue.test.ts` is NOT happy-path-only. It has 3 tests:
1. Compile-shape assertion (happy path, but necessary baseline).
2. **The real LKI-timing test** — mutates `cmc` after selection, before resolution, asserts old
   value wins. This is the load-bearing test for the entire slice's claim.
3. Zero-mana-value land edge case, asserting exact `0` delta (not skip, not crash).

This is honest, CR-relevant coverage, not padding.

## Determinism

`manaValueForDestroyThenLoseLifePrompt` and `isDestroyThenLoseLifeManaValuePromptRaw` are pure
functions of their arguments (`prompt.raw`, `targetSnapshot`) — no `Date.now()`, no `Math.random()`,
no closure over mutable state. `guidedDestroyThenLoseLifeManaValuePrompt` similarly derives
everything from `ir.effects` (already-parsed, deterministic IR). Snapshot threading in
`gameStore.ts` and `commands.ts` (`applyStoredTargetCommands`) is a straight read-and-forward, no
nondeterminism introduced.

---

## Four-check results

1. `npm run lint` — **PASS**, zero errors/warnings.
2. `npx tsc --noEmit` — **PASS**, zero errors.
3. `npx vitest run` — **PASS**, 157 test files / 1374 tests, 0 failures. (Full-suite run, not
   filtered — this is the broadest net available and it's clean.)
4. `npm run build` — **PASS**, `tsc -b && vite build` succeeded, `dist/` produced then deleted
   per instructions (`rm -rf dist`).

Review files re-run in isolation:
- `src/engine/__tests__/review.cr608-resolution-sliceA.test.ts`
- `src/store/__tests__/review.cr603-triggers-sliceA.test.ts`
- `src/store/__tests__/review.cr603-triggers-sliceB.test.ts`
- `src/store/__tests__/review.cr603-triggers-sliceC.test.ts`

→ 4 files, 23 tests, all **PASS**. `git diff` against all four returns empty (unmodified).

---

## Residual notes (no BLOCKER/HIGH; informational only)

- **LOW**: `isFeedTheSwarmDestroyClause`/`isLoseLifeEqualToTargetManaValueClause` are named after
  a specific card (Feed the Swarm) but are general phrasing detectors, not card-specific — naming
  is slightly narrower than scope but not misleading enough to flag higher than LOW; harmless.
- **LOW**: The exact-phrase regex for the mana-value clause enumerates a fixed list of type nouns
  (`artifact|card|creature|enchantment|land|object|permanent|planeswalker|spell`) for the
  "that X's mana value" form. Any future card using a type noun outside this list (e.g. "that
  battle's mana value") would fall through to `manual` rather than crash — this is the correct
  fail-safe direction (under-recognition, not over-recognition), consistent with the project's
  "unrecognized stays manual" design principle. Just flagging for awareness, not a defect.
- **MEDIUM (documentation-only, no functional risk)**: The shared-plumbing change computes
  `targetSnapshot` unconditionally for every `confirmGuidedTarget` call regardless of whether the
  active prompt's atom could ever consume it. This is intentional simplicity (verified as a true
  no-op above) but does mean every future new guided-target atom added to the `switch` in
  `buildGuidedCommands` will have a snapshot available "for free" whether or not it asked for one —
  worth a one-line contract note in `docs/engine-spec.md` §34 if not already present, so future
  authors know the snapshot is available and don't duplicate a fetch. Not a blocker for this ship.

No BLOCKER or HIGH findings. Recommend proceeding to ship.
