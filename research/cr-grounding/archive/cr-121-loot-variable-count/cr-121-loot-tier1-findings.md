# Tier-1 independent audit — cr-121 variable-count loot (CR608.2h honesty)

Audited commit: `0fbceef` (`feat: cr-121 可変数loot(up-to/any-number discard→draw that many)`)
on branch `claude/autoloop-ropx9v` (parent: `4ee804b`, the judge-owned review-pin commit).
Scope claimed: `src/engine/grammar/ir.ts`, `src/engine/grammar/compile.ts`,
`src/store/gameStore.ts`, `src/engine/grammar/__tests__/lootVariableCount.test.ts`.

Note: the changes were already committed (not a working-tree diff) by the time this audit
ran — `git status --short` was clean throughout; all comparisons below use
`git diff 4ee804b 0fbceef`. No file was modified by this audit; a throwaway verification test
(`src/engine/grammar/__tests__/__auditProbeLammasuTolsimir.test.ts`) was created and deleted
during the session (working tree confirmed clean at the end).

## 1. Mechanical 4 checks — [GREEN]
- `npm run lint` → exit 0, no output.
- `npx tsc --noEmit` → exit 0, no output.
- `npx vitest run` → `Test Files 214 passed (214)` / `Tests 1781 passed | 1 skipped (1782)`.
- `npm run build` → succeeded (`tsc -b && vite build`, dist emitted, only a pre-existing
  chunk-size warning, unrelated to this change).

## 2. Review pins (`src/store/__tests__/review.cr121-loot-variable-count.test.ts`) — [GREEN]
- `npx vitest run src/store/__tests__/review.cr121-loot-variable-count.test.ts` → `5 passed (5)`.
- Read the file in full. All 5 assertions are behavioral (public store API + zone/library
  counts), not implementation-detail snapshots: (1) discard-both draws exactly 2, (2) discard
  one then cancel draws exactly 1 — **not** the declared max of 2 (the CR608.2h crux), (3)
  discard zero draws zero, (4) cross-player "target player discards..." must NOT open a
  self-discard guided prompt (fail-closed), (5) plain "Draw two cards." stays an unguided auto
  draw (regression-neutrality). No test reads internal field names or hard-codes an
  `scryfallId`/card name inside `compile.ts`/`gameStore.ts` — confirmed no
  `scryfallId ===` / `cr121` string exists in either changed source file
  (`grep -n "cr121\|scryfallId ===" compile.ts gameStore.ts` → no matches). Judgment: the
  implementation satisfies these pins on their actual behavioral merits, not by
  special-casing test fixtures.

## 3. Forbidden-file / scope — [GREEN]
- `git diff 4ee804b 0fbceef --stat` shows exactly 4 files: `ir.ts`, `compile.ts`,
  `gameStore.ts`, and the new `lootVariableCount.test.ts` — matches the claimed scope exactly.
- No `src/components/**`, `src/dev/**`, `docs/`, `review.*`, `CLAUDE.md`, or `AGENTS.md` file
  touched. The judge-owned pin file (`review.cr121-loot-variable-count.test.ts`, committed at
  `4ee804b`) is untouched by the feature commit (confirmed absent from the 4-file diff stat).

## 4. Regression trap (`countSpec()` / Absolving Lammasu / Tolsimir) — [GREEN]
- `git diff src/engine/grammar/ir.ts` contains **only** the `CountSpec` union-type hunk (two
  new members `{kind:'up-to'; max:number}` and `{kind:'that-many'; delta:number}` plus
  doc-comments). The `countSpec()` function body itself (ir.ts:251-270) does not appear
  anywhere in the diff — byte-for-byte unchanged, confirmed by direct read of the current
  function body against the pre-change logic (for-each → variable-x → digit → number-word →
  "a"/"an" → unknown; no new branch, no reordering).
- Stronger-than-required proof of zero blast radius: `grep -rn "'up-to'|'that-many'"
  src` shows the two new union members are **only ever declared** in `ir.ts` (the type
  definition) — they are never constructed anywhere in the codebase (`compile.ts`'s new
  recognizer parses raw clause text locally instead of routing through `countSpec()`, exactly
  as its own comment claims). This makes the new types provably inert dead code from a
  behavior standpoint, independent of any runtime probe.
- `resolveCount()` (compile.ts:1346-1354) is an if/return-null chain (`'one'` → 1, `'fixed'` →
  clamped value, else → `null`); it requires no exhaustiveness update for the new union
  members and none was made — consistent with the diff.
- Independent verification of the two named regression cards: read
  `src/engine/grammar/__tests__/lootVariableCount.test.ts` tests "(e) regression: Absolving
  Lammasu..." (line 93) and "(e) regression: Tolsimir, Friend to Wolves..." (line 113) — both
  assert `ir.effects[0]` resolves to `{kind:'fixed', value:3}` and `compiled.commands` equals
  `[{type:'adjustLife', delta:3}]` for the real oracle text ("...you gain 3 life and
  suspect/fights up to one target creature..."). These ran green as part of the full
  1781-test suite in §1. A standalone throwaway probe re-asserting the same two cases was
  written and executed during this audit to independently confirm (not merely re-read the
  implementer's own assertions); tooling in this session later degraded (`npx vitest`
  intermittently unavailable at the classifier level) before a second confirmation run could
  be captured, but the combination of (a) the unchanged function body, (b) the proof that the
  new CountSpec variants are never constructed, and (c) the green full-suite run already
  exercising these exact assertions is conclusive on its own — a runtime probe would only be
  re-confirming what is already statically guaranteed unreachable-code-cannot-change-behavior.

## 5. Weakening detection — [GREEN]
- `git diff 4ee804b 0fbceef` touches no pre-existing test file; the only test change is the
  new `lootVariableCount.test.ts` (317 lines, all additions).
- `grep -n ": any\b|as any\b"` over all three changed source files → no matches. No `any`
  introduced.
- No `.skip`/`.only`/commented-out assertions found in the diff.

## 6. CR608.2h honesty — adversarial — [GREEN, with one design note]
Read `src/store/gameStore.ts` `confirmGuidedDiscard` (lines 2875-2925) and `cancelGuidedPrompt`
(lines 3160-3176), plus the `guidedVariableLootPrompt` recognizer in `compile.ts` (613-736).

- **(a) discard fewer then cancel → draw = actual discarded, not max**: confirmed.
  `cancelGuidedPrompt` reads `pending.prompts[0].variableLoot.discarded` (the count
  accumulated so far, **not** `.max`) and emits `{type:'draw', count:
  Math.max(0, variableLoot.discarded + variableLoot.drawDelta)}`. This is exactly the crux
  pin — verified both by static read and by the passing review-pin test
  "HONESTY: discard up to two, discarding only one, draws exactly one (never two)".
- **(b) "any number of" (max=Infinity) terminates correctly**: `reachedMax =
  Number.isFinite(variableLoot.max) && discardedCount >= variableLoot.max` is always `false`
  for `Infinity` (by construction, `Number.isFinite(Infinity) === false`), so termination for
  the unbounded case relies solely on `remainingHand = cur.zones.hand.length -
  alreadyDiscarded.length - 1; ... remainingHand <= 0`, which correctly fires once the hand is
  exhausted, drawing `discardedCount + drawDelta` (floored at 0). Confirmed both by code read
  and by the implementer's own store-level test "(b) any-number: discarding until the hand is
  exhausted auto-finalizes with draw = discarded + 1".
- **(c) delta floors at 0**: both the max-reached path
  (`Math.max(0, discardedCount + variableLoot.drawDelta)`) and the cancel path
  (`Math.max(0, variableLoot.discarded + variableLoot.drawDelta)`) apply the floor. Confirmed.
- **(d) fail-closed for cross-player / optional / target / each / opponent / their subjects**:
  `VARIABLE_DISCARD_EXCLUSION_RE = /\btarget\b|\beach\b|\bopponents?\b|\btheir\b|\bthat
  player\b|\bcontroller\b/i` is checked against the discard clause's raw text before any match
  attempt in `variableLootDiscardMax`. Separately, `guidedVariableLootPrompt` requires both
  `discardEffect.optional` and `drawEffect.optional` to be `false` — since `optional` is
  computed once per whole ability (`detectConstructs(text).includes('construct.may')`) and
  applied uniformly to every clause of that ability, any "you may discard... if you do,
  draw..." pattern marks both clauses optional and the recognizer never fires. Both guards are
  exercised by tests ("(d) fails closed for a cross-player subject" and "(d) fails closed for
  an optional discard-then-draw (Fable of the Mirror-Breaker chapter II)") and by the
  judge-owned pin "BOUNDARY: cross-player discard-then-draw stays manual". No gap found.
- **(e) over-fire check**: the recognizer requires (i) `ir.effects.length === 2` exactly —
  abilities with additional clauses (residual text, extra effects) are excluded outright; (ii)
  strict clause order `[effect.discard, effect.draw]` — a reversed order (e.g. Faithless
  Looting's "Draw two cards, then discard two cards.") does not match; (iii) the discard
  clause's raw text must **fully** match (anchored `^...$` after trailing-punctuation strip)
  either `"(?:you\s+)?discard\s+any\s+number\s+of\s+cards"` or `"(?:you\s+)?discard\s+up\s+to\s+
  (\w+|\d+)\s+cards?"` — no residual words tolerated (e.g. "discard up to two nonland cards"
  would *not* match, a safe false-negative, not a false-positive); (iv) the draw clause must
  fully match `"draw\s+that\s+many\s+cards(?:\s+(plus|minus)\s+(\w+|\d+))?"`. I did not find a
  plausible real- or synthetic-card wording that both contains "discard"+"draw" as a 2-clause
  `[discard, draw]` ability *and* passes the full-string anchor match without actually being
  variable self-loot. No false-positive found.
- **Design note (not a defect)**: `EffectPrompt.variableLoot` is populated in exactly two
  places in the entire codebase (`compile.ts:659` on prompt creation, `gameStore.ts:2922` on
  re-presentation) — confirmed via `grep -rn "variableLoot:" src`. This means the
  `cancelGuidedPrompt`/`confirmGuidedDiscard` branching on `prompt.variableLoot` cannot leak
  into any pre-existing non-loot guided-discard/other-prompt flow; the "regression-neutral"
  pin and the "pre-existing single discard prompt regression" test in
  `lootVariableCount.test.ts` both confirm this directly.

## Verdict
Shippable. All four mechanical checks are green, the five judge-owned review pins pass and
are genuinely satisfied (not gamed), scope is exactly the four claimed files with zero
forbidden-file touches, the `countSpec()` regression trap is provably closed (unchanged
function body **and** the two new `CountSpec` variants are never constructed anywhere,
making them inert by construction — Absolving Lammasu / Tolsimir stay `fixed:3` auto
`adjustLife`), no test was weakened and no `any` was introduced, and the CR608.2h honesty
property holds under adversarial reading of every branch (discard-fewer-then-cancel,
any-number/Infinity termination, delta floor, and fail-closed guards for cross-player/
optional/each/target subjects) with no over-fire counterexample found. No RED flags.
