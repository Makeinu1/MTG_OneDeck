# Tier-1 findings: cr-701 generic single-card ramp search composite

Independent adversarial audit, uncommitted slice (compile.ts / gameStore.ts / dialogs.tsx / Playmat.tsx).
No BLOCKERs found. See residual notes below.

## Machine checks (all 4 pass)

1. `npm run lint` — clean, no errors/warnings.
2. `npx tsc --noEmit` — clean, no type errors.
3. `npx vitest run` — **134 test files passed, 1241 tests passed**, 0 failures.
4. `npm run build` — succeeded (`tsc -b && vite build`), only a pre-existing >500kB chunk-size
   warning unrelated to this diff. `dist/` removed after the check.

## Adversarial findings

### 1. CR 701.24b (found card excluded from shuffle) — PASS, no defect found

`src/store/gameStore.ts:2639-2643` (`confirmGuidedLibrarySearch`):
```js
const order = shuffledOrder(
  cardId === undefined ? cur.zones.library : cur.zones.library.filter((id) => id !== cardId),
  rng,
);
```
The shuffle permutation is computed from a library snapshot with the found card already
excluded (`filter((id) => id !== cardId)`), *before* any command runs. The dispatched command
sequence is `[moveCard(cardId → battlefield), setTapped?, shuffle(order)]`
(`src/engine/grammar/compile.ts:1047-1063`). `moveCard` physically removes the card from
`zones.library` first; `applyShuffle` (`src/engine/commands.ts:3201-3212`) then validates that
`order` is an exact permutation of the *post-move* library, which it is by construction. Correct
CR 701.24b behavior: the found card is never in the shuffled set.

### 2. Determinism — PASS, no defect found

The permutation is computed once, at guided-confirm time in the store
(`src/store/gameStore.ts:2639-2642`, via `createRng(randomSeed())` + `shuffledOrder`), and
embedded into the `shuffle` command's `order` field before dispatch. `applyCommand`'s shuffle
case (`src/engine/commands.ts:3430-3433` → `applyShuffle`, `commands.ts:3201-3212`) only
validates and applies the given `order`; it contains no RNG call. Replay/undo/redo re-runs
`applyCommand` deterministically off the stored command, matching the project's
"randomness fixed at command-generation time" invariant. `src/engine/commands.ts` is unchanged
per `git diff` (confirmed empty diff) — no new `GameCommand` variant was introduced; the
composite reuses existing `moveCard` + `setTapped` + `shuffle`.

### 3. Filter correctness (Forest-card vs basic-land) — PASS, no defect found

Verified both the compiler-side filter constructor (`simpleRampSearchFilter`,
`src/engine/grammar/compile.ts:611-618`) and the two runtime matchers
(`src/store/gameStore.ts:818-833`, `src/components/playmat/dialogs.tsx:1025-1039` — these two are
byte-for-byte identical logic, both using `\bBasic\b` / `\b<subtype>\b` word-boundary regex on
type lines). Constructed test cases directly:
- Nonbasic dual with the Forest subtype (`Land - Mountain Forest`, i.e. Stomping Ground-style)
  correctly satisfies a `{kind: 'land-subtype', subtype: 'Forest'}` filter (matches CR
  ramp-card intent for "Forest card").
- Same nonbasic Forest correctly **fails** a `{kind: 'basic-land'}` filter (no "Basic" in its
  type line) — this exact case is asserted by the impl-side test
  `src/store/__tests__/cr701LibrarySearchGuided.test.ts:112-181` and reproduced independently.
- A true `Basic Land — Forest` card satisfies both filters as expected.

### 4. Scope over-claim — PASS on all constructed adversarial cases

Traced the compiler guard (`guidedLibrarySearchPrompt`, `compile.ts:564-609`) against constructed
oracle lines not in the impl's own test file:

| Oracle text | Result | Why |
|---|---|---|
| `a Forest card and a Mountain card, put them onto the battlefield` | `manual` | `parseSingleCardRampSearch` regex requires singular `a\|an\|one … card` + `it\|that card`; fails on "them"/"and" |
| Two separate search+put clauses in sequence (701.23h-style, before one shared shuffle) | `manual` | `uniqueEffectRaws(..., 'effect.search').length !== 1` (2 distinct raws) |
| `up to two basic land cards, put them onto the battlefield tapped` | `manual` | same regex rejection (plural/them) |
| `any card, put it onto the battlefield` | `manual` | "any" fails `simpleRampSearchFilter` (not `basic land` or a land subtype) |
| `a card, put it into your hand` (broad tutor, non-battlefield) | `manual` | no `effect.put-onto-battlefield` atom present at all (`putRaws.length === 0`) |
| `a card, put it onto the battlefield` (broad tutor, battlefield dest.) | `manual` | `parseSingleCardRampSearch` regex requires a non-empty descriptor before "card"; bare "a card" doesn't match |
| `target player searches their library for a basic land card...` | `manual` | regex hardcodes "search your library" |
| `search your graveyard for a Forest card, put that card onto the battlefield` | `manual` | regex hardcodes "library" |
| `You may search your library for a Forest card, ...` (optional) | `manual` | explicit `ir.effects.some((e) => e.optional)` guard at `compile.ts:565` |
| `a legendary creature card` / `an artifact or creature card` onto battlefield | `manual` | fails `simpleRampSearchFilter` (not in `BASIC_LAND_SUBTYPES`, not "basic land") |
| `a Plains, Island, Swamp, or Mountain card` (Farseek-style compound) | `manual` | compound descriptor doesn't match the single-subtype regex/lookup |
| `a Forest or Plains card` (single-clause subtype OR) | `manual` | same, descriptor string `"Forest or Plains"` isn't in `BASIC_LAND_SUBTYPES` |
| `..., reveal it, put that card onto the battlefield, then shuffle` (extra clause spliced in) | `manual` | the inserted "reveal it," breaks the regex's `card,\s*put` adjacency requirement |

None of the above reached the guided battlefield branch; no broad tutor or to-hand/to-graveyard
destination could be smuggled through.

**Weak spot (not exploitable in current cases, flagged as MEDIUM):** the final structural guard
```js
const allowedRaws = new Set([searchRaws[0], shuffleRaws[0]]);
if (ir.effects.some((effect) => !allowedRaws.has(effect.raw))) { return null; }
```
(`compile.ts:583-586`) gates on **raw clause text**, not on effect **atom identity**. Because
`splitEffectClauses` keeps one shared raw string per clause and `detectEffectAtoms` can attach
multiple atom ids to the same raw string (e.g. "put that card onto the battlefield tapped"
matches both `effect.put-onto-battlefield` and `effect.tap`, confirmed by direct trace), an extra
atom riding on the *same* raw text as the search/put clause is invisible to this guard — it only
rejects effects whose raw *string* differs. In every constructed case this happened to still be
correct because `parseSingleCardRampSearch`'s regex independently rejects any structurally
different clause. But the `allowedRaws` check does not, by itself, guarantee "only search + put +
shuffle atoms are present" — it is redundant with, and weaker than, the regex gate. If a future
oracle-text pattern produced a same-raw-text spurious atom (e.g. a probe collision) alongside a
regex-matching search/put clause, this guard would not catch it. Not a proven bug against any
real card text found, but worth tightening (assert on atom sets, not raw-string sets).

### 5. `entersTapped` correctness — PASS, no defect found

`parseSingleCardRampSearch` (`compile.ts:600-624`) captures group 2 of the regex
(`( tapped)?`) and sets `entersTapped: match[2] !== undefined`. Confirmed:
- "put that card onto the battlefield, then shuffle." (Nature's Lore, untapped) →
  `entersTapped: false` (unit test `cr701LibrarySearchGuided.test.ts:30-53`, reproduced).
- "put that card onto the battlefield tapped, then shuffle." (Rampant Growth) →
  `entersTapped: true` (same test file, lines 55-76).

`buildGuidedCommands` (`compile.ts:1058-1061`) only appends `setTapped` when `spec.entersTapped`
is true and a card was actually found (`cardId` truthy) — no spurious tap command on a miss.

### 6. Destination discipline — PASS, no defect found

`LibrarySearchSpec.destination` is a literal `'battlefield'` type (`compile.ts:37-42`); the
compiler's `parseSingleCardRampSearch` regex requires the literal substring "onto the
battlefield" to match at all (`compile.ts:606`). Any "into your hand" / "into your graveyard" /
"on top of your library" clause fails the regex outright (no partial/fallback match), so it never
constructs a `LibrarySearchSpec` and falls through to whatever manual/other path the rest of the
compiler already had. Verified directly in finding #4's table (the to-hand broad-tutor case).

### 7. Empty/no-match search (CR 701.23d "or as many as possible" = zero is legal) — PASS

`GuidedLibrarySearchDialog` (`src/components/playmat/dialogs.tsx:1174-1300`) provides a
"見つけずに切り直す" (find nothing, shuffle anyway) button wired to `onMiss` →
`store.confirmGuidedLibrarySearch()` with `cardId === undefined`
(`src/components/playmat/Playmat.tsx:1485-1493`). Traced the store handler
(`gameStore.ts:2610-2654`): when `cardId` is `undefined`, no library-membership/filter check
runs, `order = shuffledOrder(cur.zones.library, rng)` (whole library, nothing to exclude), and
`buildGuidedCommands` receives `cardIds: []` → `cardId` is `undefined` inside the builder →
`commands = []` for move/tap, then unconditionally pushes `{type: 'shuffle', order}`. Result:
`commands.length === 1 > 0`, so `advanceGuidedResolution` proceeds — a genuine "no target,
shuffle anyway" resolution, no crash, no forced illegal pick. Also confirmed `applyShuffle` with
an empty-library `order = []` still validates as a legal 0-length permutation (no exception).

## Residual notes (non-blocking)

- **MEDIUM — filter-logic triplication.** `matchesLibrarySearchFilter` is implemented three times
  with materially different regex strategies: `src/store/gameStore.ts:818-833` (new, word-boundary
  regex, authoritative for command validation), `src/components/playmat/dialogs.tsx:1025-1039`
  (new, same word-boundary regex, used only for the dialog's eligible-card list), and the
  pre-existing sibling `matchesFetchFilter` at `dialogs.tsx:985-1003` (substring `.includes(...)`,
  different bug class — e.g. would also match "Plainswalker" as a substring, though currently
  unexploited since it's a distinct FetchAbility feature). The two *new* copies are logically
  consistent with each other (store and dialog agree on eligibility, so no functional UI/store
  disagreement was found), but this is duplicated logic the project's own reuse norms would flag;
  a shared helper would remove the drift risk if either copy is edited independently later.
- **MEDIUM — narrower filter vocabulary than real oracle text.** `simpleRampSearchFilter`
  (`compile.ts:611-618`) only recognizes the literal descriptor strings `"basic land"` or one of
  the five basic subtype names alone. Real ramp cards phrased as "a basic Forest card" / "a basic
  Mountain card" (basic-and-subtype conjunction) fail this lookup and fall through to `manual`
  rather than guided. This is conservative (never mis-guides), so it is a missed-coverage gap, not
  a correctness bug — flagged for the brief's scope table rather than as a defect.
- **LOW — `allowedRaws` guard weakness**, see finding #4 above; recommend gating on the IR's atom
  set rather than raw-clause-string set for defense-in-depth, though no exploitable case was
  found.
- Confirmed `src/engine/commands.ts` has an empty `git diff` (no new `GameCommand` type), satisfying
  the "reuse existing commands" invariant explicitly.
- Confirmed no new persisted `GameState`/`GameSnapshot` field was introduced by this slice — the
  new `librarySearch`/`library-search` types live entirely on the transient `EffectPrompt` /
  `pendingGuided` shape, which `restoreGame` (`gameStore.ts:1609-1625`) already unconditionally
  resets to `null` on snapshot restore. No forward-compat backfill gap was created (nothing new to
  backfill).
- Confirmed the double-shuffle risk hypothesis (composite spell's embedded shuffle command
  colliding with `resolveStackTopCommandForState`'s separate auto-shuffle path for "pure
  shuffle-only" lines) does not materialize: `stackTopHasPureSelfLibraryShuffle` requires the
  *entire* ability line to be just "shuffle[.]", which a search+put+shuffle composite line is not,
  so that auto-shuffle path is correctly not taken for these cards.
