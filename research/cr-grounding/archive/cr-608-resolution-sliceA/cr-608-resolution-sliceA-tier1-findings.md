# Tier-1 Adversarial Audit — cr-608-resolution Slice A (stack-target filtering + guided "counter target spell")

Auditor: independent Tier-1 (cold session, no authorship of the diff under audit).
Scope: uncommitted working-tree diff — `src/engine/grammar/compile.ts` (+49), `src/engine/commands.ts` (+47),
`src/engine/__tests__/cr608CounterSpellGuided.test.ts` (new, implementer-authored, informative only).

## 4-check results

1. `npm run lint` — **PASS** (0 errors, 0 warnings).
2. `npx tsc --noEmit` — **PASS** (no output, 0 errors).
3. `npx vitest run` — **PASS**. 155 test files, 1365 tests, all green.
4. `npm run build` — **PASS**. `tsc -b && vite build` succeeded, `dist/` produced then deleted per instructions.

## review.* isolation re-run (cr-603 Slice A/B/C non-regression)

`npx vitest run src/store/__tests__/review.cr603-triggers-sliceA.test.ts review.cr603-triggers-sliceB.test.ts review.cr603-triggers-sliceC.test.ts`
→ **3 files, 17 tests, all PASS.**

`git diff` against HEAD for all three files returns **zero output** — byte-identical to the just-shipped commit
(`42accc2`). Read the assertions directly (not just pass/fail): sliceA still asserts event-driven trigger
subscription + once-per-turn gate (CR 603.2h) + APNAP bucket placement (CR 603.3b) exactly as originally authored.
No weakening, no silent skips. **Confirmed genuinely unmodified and unweakened.**

## Adversarial probes (independently authored, not reusing implementer's test file)

Built a standalone probe suite (`src/engine/__tests__/tmp-audit/audit-probe.test.ts`, deleted after the run — not
part of this diff) covering every adversarial claim in the brief, including cases the implementer's own test file
did **not** cover (Flusterstorm "unless" rider, exile-instead rider, creature-or-planeswalker unapproved combo,
ability-alone-on-stack yields zero candidates, determinism of candidate ordering). All 9 probes **passed**:

- **Self-counter exclusion** (highest-value probe): a lone "Counter target spell" instant on the stack, `eligibleTargets`
  with `context.sourceId` set to its own stack-item id, returns `[]` — it never appears in its own candidate list.
  Verified at `src/engine/commands.ts:3231` (`if (context.sourceId === cardId) return false;`), applied
  unconditionally for `zone: 'stack'` (not gated behind `filter.excludeSource` like the graveyard/battlefield
  branches at lines 3264/3295). This is intentional and correct for the 5 approved counter-spell phrasings — a
  spell can never legally target itself as "target spell" — but it is a slight behavioral asymmetry vs. the other
  two zones worth noting for future stack-zone filters that might legitimately want self-inclusion (see LOW note
  below).
- **Ability exclusion**: activated ability alone on the stack (no other spell) + a counter-spell instant → candidate
  list is `[]`. Confirmed via `card.isAbility` guard at `src/engine/commands.ts:3227` (`if (!card || card.isAbility
  || card.zone !== 'stack') return false;`). Also cross-checked against implementer's own Pact-of-Negation test
  (`cr608CounterSpellGuided.test.ts:163-203`), which mixes an activated ability + 2 real spells and asserts the
  ability id is excluded — passes.
- **Type filter accuracy**: constructed a creature spell + non-creature (sorcery) spell simultaneously on the stack
  under a "Counter target creature spell" source. Candidate list = exactly the creature spell. Verified the filter
  reads the STACK ITEM's own `defId`/`faceIndex` via `typeLineForStateCard` (`src/engine/commands.ts:3320-3323`),
  which follows the exact same `def.faces[card.faceIndex] ?? def.faces[0]` pattern already used at lines 527, 564,
  2677, 3280, 3305 elsewhere in the file — not a divergent/buggy reimplementation, not reading battlefield-object
  data or a different object's characteristics.
- **Exact-phrase gate fuzzing** — all adversarial variants correctly stayed `manual` (did NOT compile to `guided`):
  - `"Counter target spell unless its controller pays {1}."` (Flusterstorm) → manual.
  - `"Counter target spell. Its controller creates two Treasure tokens."` (An Offer You Can't Refuse style) → manual.
  - `"Counter target spell. If that spell is countered this way, exile it instead."` (exile-instead rider) → manual.
  - `"Counter target creature or planeswalker spell."` (unapproved type combo, not one of the 5 phrasings) → manual.
  - Both Oxford-comma and no-Oxford-comma variants of "enchantment, instant, or sorcery" correctly compile to `guided`
    (both explicitly listed in the switch at `compile.ts:1211-1212`).
  - Root-caused the safety net: `compile.ts:409-414` adds `reasons.add('needs-parse')` whenever `effect.counter-spell`
    co-occurs with **any other effect atom** in the same ability, which forces `decision: 'manual'` in the final
    reduction at `compile.ts:502-503` (`sortedReasons.length > 0 ? 'manual' : ...`) — this fires regardless of
    whether `guidedTargetPrompt` alone would have produced a valid stack-target prompt for the first sentence. No
    accidental partial-guided/dropped-follow-up-clause behavior found.
- **`removeStackItem` non-regression**: `git diff` shows **zero lines changed** inside `applyRemoveStackItem`
  (`src/engine/commands.ts:3670-3685`) — grepped the diff hunks directly for the function name, no match. All 3
  pre-existing call sites (`commands.ts:4249` dispatch, `grammar/compile.ts:1412` new counter-spell caller,
  `goldenReplay.ts:55` allowlist) plus the pre-existing ability-removal test path
  (`__tests__/m427.test.ts:105-121`, asserting spell→configurable destination and ability→pure deletion) were
  checked; only a **new caller** was added, no existing logic touched. No cost-refund logic exists or was added —
  matches CR 701.6b by construction (the function never tracked/paid costs to refund).
- **CR 608.2b resolution-time recheck**: `applyRemoveStackItem` throws `EngineError` (`commands.ts:3671-3673`) if the
  target id is no longer in `state.zones.stack` — this is the pre-existing atomicity pattern (unchanged by this
  diff), consistent with how the rest of the engine surfaces illegal-target-at-resolution as a hard error rather
  than silently no-op'ing or removing the wrong item. Acceptable for this slice since no delayed-effect/mid-flight
  scheduling exists yet (out of scope, correctly deferred to Slice B/C per the ledger note).
- **Determinism**: `eligibleTargets` for `zone: 'stack'` is a plain `Array.prototype.filter` over
  `state.zones.stack` (already an ordered array) — no `Object.keys`/`Object.values`/Set iteration involved. Verified
  two consecutive calls with identical state produce identical, stably-ordered output.

## Test honesty of `cr608CounterSpellGuided.test.ts`

Read all 4 tests in full (not just pass/fail). It is **not** pure happy-path smoke-testing — it directly asserts:
self-exclusion (Pact test, line 199-202: `candidates` excludes both the ability and the pact's own id), ability
exclusion (same test), type-filter accuracy (Fierce Guardianship test asserts `excludedTypes: ['creature']` filters
out the creature spell and keeps the draw spell, lines 137-143), and exact-phrase-boundary rejection for 2 of the
manual-follow-up cases (lines 85-94, both Treasure-token and Bird-token riders). It does **not** independently cover
Flusterstorm's "unless" phrasing or the exile-instead rider or the creature-or-planeswalker combo — those gaps were
covered by this audit's own probes instead, all passing. Net: the implementer's test is honest about what it tests,
just narrower in phrasing-fuzz coverage than the full adversarial list — not a misrepresentation.

## Findings

**No BLOCKER findings.**
**No HIGH findings.**

### LOW — informational, not a defect in this slice
- `eligibleTargets`'s `zone: 'stack'` branch applies `context.sourceId === cardId` self-exclusion
  **unconditionally** (`commands.ts:3231`), unlike the graveyard/battlefield branches which gate self-exclusion
  behind `filter.excludeSource` (lines 3264, 3295). For the 5 counter-spell phrasings in this slice this is always
  the correct behavior (a spell can never target itself as "target spell"). If a future stack-zone filter needs
  self-inclusion (e.g., some hypothetical "counter target spell, including this one" — not a real card, purely
  hypothetical), the current unconditional exclusion would need to become `filter.excludeSource`-gated like the
  other zones. Not an action item now; flag for whoever authors the next `zone: 'stack'` filter type.

### MEDIUM — none found.

## Summary of adversarial coverage
Every adversarial question in the brief was independently probed (not just re-run from the implementer's test
file) and **none surfaced a real defect**. The self-counter-exclusion probe and the exact-phrase-gate fuzzing —
flagged in the brief as highest-value — both came back clean: self-targeting is correctly blocked via the
`sourceId` check in `eligibleTargets`, and every non-approved counter-spell phrasing (Flusterstorm's "unless" rider,
treasure/bird-token follow-up riders, exile-instead rider, unapproved creature-or-planeswalker combo) correctly
stays `manual` via the `needs-parse` reason added whenever `effect.counter-spell` co-occurs with any other effect
atom in the same ability text.
