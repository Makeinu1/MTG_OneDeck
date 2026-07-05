# Tier-1 Adversarial Audit — cr-111-tokens (custom creature token, batch2-7)

Auditor: independent Tier-1 (cold, non-implementer). Scope: uncommitted working-tree diff to
`src/engine/commands.ts`, `src/engine/grammar/compile.ts`, new test `src/engine/__tests__/cr111DefinedToken.test.ts`.

## Machine checks (all 4, run against the working tree as-is)

| Check | Result |
|---|---|
| `npm run lint` | PASS (no output, exit 0) |
| `npx tsc --noEmit` | PASS (no output, exit 0) |
| `npx vitest run` | PASS — **143 test files, 1297 tests, 0 failures** |
| `npm run build` | PASS — vite build succeeded; `dist/` removed after check |

Specifically re-ran the existing §32.8 predefined-token suites in isolation to confirm no regression:
`src/engine/__tests__/cr111PredefinedTokenCompiler.test.ts`, `src/store/__tests__/cr111PredefinedTokenAuto.test.ts`,
`src/engine/__tests__/review.grammar-compile.test.ts`, `src/engine/__tests__/review.m46.test.ts`,
`src/store/__tests__/review.m69.test.ts` → **5 files, 38 tests, all green.**

## Findings

### BLOCKER: none found.

### HIGH-1 — Multicolor ("X and Y") token text is silently mis-parsed and wrongly auto-compiles with a corrupted type line/name

**Claim**: A custom creature token with two colors, e.g. `Create a 2/2 black and green Zombie creature token.`,
should either compile `manual` (multi-color parsing is not part of the stated fixed-count/fixed-P-T/no-ability-text
scope, and isn't in the two golden cases) or, if handled, produce a correct type line. Instead it wrongly
auto-compiles with a corrupted subtype and name.

**Evidence** (constructed adversarial input, run live against the actual compiler in this working tree):
```
input:  "Create a 2/2 black and green Zombie creature token."
result: {
  "commands": [{
    "type": "createDefinedToken",
    "name": "and green Zombie Token",
    "typeLine": "Token Creature — and green Zombie",
    "power": "2", "toughness": "2", "quantity": 1, "initialTapped": false
  }],
  "decision": "auto", "confidence": 0.95, "risk": "low", "reasons": []
}
```

**Root cause** — `src/engine/grammar/compile.ts:809-810` (`parseDefinedCreatureTokenSpec`):
```ts
const match =
  /^create\s+(a|an|one|...|\d+)\s+(tapped\s+)?(\d+)\/(\d+)\s+(?:white|blue|black|red|green|colorless)\s+([A-Za-z][A-Za-z' -]*(?:\s+[A-Za-z][A-Za-z' -]*)*)\s+creature\s+tokens?(?:\s+named\s+([^".]+))?\.?$/i.exec(normalized);
```
The color alternation `(?:white|blue|black|red|green|colorless)` matches exactly **one** color word with no
repetition/`and`-list support. It correctly matches "black", but the leftover " and green " is then absorbed
by the greedy subtype-capture group (`match[5]`), which permits arbitrary `[A-Za-z' -]` runs including the
literal word "and". The result is a syntactically well-formed but semantically wrong `typeLine`
(`Token Creature — and green Zombie`) and `name` (`and green Zombie Token`) — i.e., the color "green" and the
literal connective word "and" leak into what is supposed to be a pure subtype string.

**Why this matters**: this is exactly the class of defect the ability-text-leakage adversarial question was
aimed at — the leaf doesn't fail closed on a genuinely out-of-grammar construct, it fails open with a
corrupted-but-plausible-looking result at `auto` confidence 0.95/`risk: low`, the highest-trust bucket. Any
downstream consumer or QA glance would treat this as a fully-trusted auto-applied token. This contradicts the
stated scope boundary ("ONLY fixed-count, fixed-P/T, no-ability-text, no-target, no-modal custom creature
tokens should compile to `auto`") because multicolor text was never declared in-scope, yet it silently produces
an `auto` result rather than falling back to `manual`/`needs-parse`.

**Severity justification**: HIGH not BLOCKER because (a) no golden case or acceptance scenario currently exercises
a multicolor custom token, so it doesn't break the two shipped golden cards (Liliana / Tormod, both single-color),
and (b) the corrupted state is inert today (no color-dependent engine logic reads token color — see MEDIUM-1
below) so it doesn't cascade into a live rules bug yet. But it is a real, silently-wrong `auto` compile that
will misfire the first time this leaf is pointed at any real two-color token card (e.g. any future guild/color-pair
token-maker), and the fix (require the color group to be non-capturing-but-exhaustive, or explicitly reject
`and`/comma-joined color lists as `manual`) is straightforward. Recommend blocking freeze of this leaf until
either (a) multicolor text is explicitly rejected (return `null` from `parseDefinedCreatureTokenSpec` when
more than one color token is detected before the subtype), or (b) it's explicitly added to golden cases with
correct parsing.

### MEDIUM-1 — Token color is not preserved anywhere in state; confirmed benign for now, but worth a docs/scope note

Searched `src/engine/` for any color-dependent logic that could consume a token's color (protection, "nonblack",
color-filtered targeting/combat, color-identity-based restriction): **none exists**. The only `color`-bearing
code paths in the engine (`manaTransaction.ts`, `commands.ts` addMana/manaPool paths, `mana.ts` pip demand) are
mana-color bookkeeping, unrelated to a permanent's color characteristic. `colorIdentity` is set to `[]` for all
tokens created via `applyCreateToken` (both old and new command), same as the pre-existing behavior for
predefined tokens (Treasure/Clue/etc.) — so this is not a new gap introduced by this diff, it's a pre-existing
engine limitation that this leaf inherits unchanged. **Not a regression, not currently exploitable.** Flag for
the day protection/color-filtered-targeting is modeled — at that point tokens (old and new) will need a real
`colors`/color-characteristic field, and both command variants will need it, not just this one.

### LOW-1 — `cr111DefinedToken.test.ts` test coverage is real but incomplete versus the adversarial surface

The implementer-authored test file (informative only, not judge-owned) does correctly assert:
- ability-text-with-quotes → manual (`'Create a 1/1 white Soldier creature token with "This creature can't block."'`)
- variable-count (X) → manual, reason `variable-count`
- copy-token → manual, no `copyPermanent`/`createDefinedToken` command emitted
- tapped/untapped defaults (both golden cards) plus explicit `createdBy` owner/controller test

It does **not** test:
- unquoted `"with flying"` / other keyword-ability suffix text (verified live: correctly stays `manual` with
  reason `needs-parse` — good, but untested in the suite)
- `"for each"` variable count (verified live: correctly `manual`, reasons `needs-parse`+`variable-count`)
- die-roll count (verified live: correctly `manual`, reason `needs-parse`)
- modal token creation (verified live: correctly produces a `guided` modal prompt, not swallowed by the new leaf)
- multi-kind-in-one-line ("two Soldier tokens and a Zombie token") (verified live: correctly `manual`, reason
  `needs-parse` — the combined regex requires the entire clause to match end-to-end so "and a 2/2..." after
  `tokens?` fails the anchor and falls through cleanly)
- the two-sentence tap-leak scenario ("Create a token. Tap target creature.") — this is the single most
  important adversarial case given the implementer's own self-flagged risk, and it is untested in the shipped
  suite. I verified it live (see below) and it passes, but the test suite should have asserted this explicitly
  before claiming the suppression is "leaf-local."
- the multicolor case (HIGH-1 above) — untested, and would have caught the bug.

Recommend the implementer (or a follow-up) add explicit tests for at least the two-sentence tap-leak case and
reject-multicolor case before this leaf is considered fully proven.

## Adversarial question resolutions (explicit, with evidence)

1. **Ability-text leakage** (`with flying`, unquoted) → correctly stays `manual`, reason `needs-parse`. The
   regex's trailing anchor `creature\s+tokens?(?:\s+named\s+...)?\.?$` requires the clause to end right after
   "token(s)" (optionally + "named X"), so trailing " with flying." does not match the anchor and the whole
   regex fails to match → `definedCreatureTokenCommand` returns `null` → falls through to `needs-parse`. No leak.

2. **Variable count leakage** ("X 1/1 ... tokens", "for each") → both correctly stay `manual`. "X" is not
   `\d+` and not in `MANA_AMOUNT_WORDS`(`compile.ts:184-197`, unchanged from before this diff), so
   `parseFixedTokenQuantity` returns `null` → `definedCreatureTokenCommand` returns `null` → the existing
   `count === null` branch at `compile.ts:575` adds `variable-count`. "for each" additionally fails the
   anchor (extra trailing text) so it independently falls through.

3. **Multiple token kinds in one clause** → correctly stays `manual`, reason `needs-parse`. The anchored
   `$` at end of the single-clause regex means "...tokens and a 2/2 black Zombie creature token." does not
   match (extra text after the first "tokens" clause), so the whole match fails and no partial/wrong command
   is emitted (no double-counting, no first-kind-only silent bug).

4. **Copy-token non-interference** → confirmed. `Create a token that's a copy of target creature.` does not
   match the custom-creature-token regex (no P/T digits, no "creature token(s)" ending token pattern in the
   required shape) and separately the `effect.create-token` branch checks `predefinedTokenKindForRaw` first
   (no match) then falls to `definedCreatureTokenCommand` which also returns `null` → `needs-parse`+`needs-target`
   (the "target" construct triggers `needs-target` too). `copyPermanent`'s handler
   (`commands.ts:3927-3930`, `applyCopyPermanent(draft, cmd.cardId, cmd.quantity)`) is byte-for-byte identical
   pre/post diff — confirmed via `git diff`, zero lines touched near that switch case.

5. **`createToken` non-regression** → confirmed. Both existing call sites of `applyCreateToken`
   (`commands.ts:3165` inside `applyAutoCommand`, and `commands.ts:3932` inside `applyCommand`) pass no 8th
   `options` argument, so `options = {}` (the declared default), giving `ownerController = 'P1'` and
   `initialTapped = false` — byte-identical to the previous hardcoded `ownerId: 'P1', controllerId: 'P1',
   tapped: false`. The refactor is strictly additive: the only behavioral change inside `applyCreateToken`
   itself is that the two hardcoded literals became `options.createdBy ?? 'P1'` /
   `options.initialTapped ?? false`, which are no-ops for every caller that omits `options`. All 38
   pre-existing §32.8 predefined-token tests pass unchanged (see machine-checks table above).

6. **"tapped" word suppression — scoping** → confirmed leaf-local, not leaking across sentences. The
   suppression at `compile.ts:534-536`:
   ```ts
   if (effect.atom === 'effect.tap' && isDefinedTappedTokenCreation(effect.raw)) {
     return { commands, prompts, reasons: [...reasons] };
   }
   ```
   operates on `effect.raw`, and `EffectClause.raw` is **per-sentence** (clauses are split on `. ` / `then` in
   `splitEffectClauses`, `src/engine/grammar/ir.ts:204-209`, confirmed unchanged by this diff — `ir.ts` has zero
   diff lines). So `isDefinedTappedTokenCreation` re-parses only the tap-clause's own sentence; it can only
   return `true` when that exact sentence *is itself* a full "Create a tapped N/N ... token." match. I
   constructed and ran live: `"Create a 2/2 black Zombie creature token. Tap target creature."` → the tap
   sentence produces `raw: "Tap target creature."`, which does **not** match
   `parseDefinedCreatureTokenSpec` (no P/T, no "creature token" ending) → `isDefinedTappedTokenCreation` returns
   `false` → the `effect.tap` clause is NOT suppressed → result compiles `guided` with a live
   `{"atom":"effect.tap","kind":"target","count":1,...,"raw":"Tap target creature."}` prompt, exactly as it
   would without this diff. Also tried the reversed order (`"Tap target creature. Create a tapped 2/2 black
   Zombie creature token."`) with the same correct result. **No leak found.**

7. **Token color not preserved** → see MEDIUM-1. Confirmed benign today; no consumer reads token color.

8. **owner/controller correctness (CR 111.2)** → confirmed correct. `applyCreateToken`
   (`commands.ts:3518, 3553-3554`) sets `ownerId: ownerController, controllerId: ownerController` from the
   *same* variable, so both are set together, never independently. Test
   `cr111DefinedToken.test.ts:132-148` asserts `createdBy: 'OPPONENT_A'` produces `ownerId === 'OPPONENT_A'`
   **and** `controllerId === 'OPPONENT_A'` — both checked. Omitting `createdBy` defaults cleanly to `'P1'`
   via `options.createdBy ?? 'P1'`, no crash (confirmed by the two golden-card tests, which omit it).

9. **CR 110.5b default-untapped** → confirmed. `options.initialTapped ?? false` — an `undefined`
   `initialTapped` (the common case, e.g. Liliana's clause) correctly nullish-coalesces to a concrete `false`,
   not left as `undefined`/ambiguous. `tapped: initialTapped` at `commands.ts:3556` is always a concrete
   boolean.

10. **Determinism/purity** → `parseDefinedCreatureTokenSpec` and `definedCreatureTokenCommand` are pure string→
    value functions with no I/O, randomness, or external state; same input always yields the same output.
    `applyCreateToken`'s mutation pattern (`draft.state.defs = {...}`, `draft.state.cards = cards` after building
    a fresh array/object, `battlefield.push(id)` on an `editZone`-obtained draft-scoped array) matches the
    pre-existing style used elsewhere in this file (Immer-style draft mutation) — no new pattern introduced.

11. **Snapshot/forward-compat** → confirmed no new persisted field needed. `git diff --stat` shows exactly two
    files touched (`commands.ts`, `grammar/compile.ts`); `src/types/*.ts` and `src/engine/types.ts` have zero
    diff. `restoreGame` (in `src/store/gameStore.ts`, not touched by this diff) needs no backfill because
    `createDefinedToken` is a command, not a new `GameState`/`CardInstance` field — the resulting `CardInstance`
    shape is identical to what `applyCreateToken` already produced for `createToken`.

12. **Test honesty** → partially. The two golden-card happy paths and four manual-guard cases (ability-text,
    variable-count, copy-token, Ragavan/Treasure-existing-path) are genuinely asserted with real CR-relevant
    behavior, not just smoke tests. But see LOW-1: coverage gaps exist for the two-sentence tap-leak case (the
    implementer's own self-flagged risk) and for multicolor text (which is the one input that actually breaks,
    per HIGH-1). The existing tests do not lie about what they claim, but they under-cover the riskiest edges.

## Summary

**No BLOCKER.** One **HIGH** finding: multicolor custom-token text ("black and green Zombie") silently
mis-parses and wrongly auto-compiles with a corrupted type line/name at high confidence, rather than falling
back to `manual` — this is an out-of-scope construct that should fail closed but instead fails open. One
**MEDIUM** (token color not preserved — confirmed pre-existing/benign, no live consumer). One **LOW** (test
suite coverage gaps on the riskiest adversarial edges, including the exact multicolor case that breaks). The
implementer's flagged "tapped"-suppression risk was independently verified NOT to leak across sentences — that
mechanism is sound. The pinned `createToken` command and `copyPermanent` handler are confirmed unmodified in
behavior.
