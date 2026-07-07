# Demand-instrument audit: false-positive sizing for mydeck-scoring gaps

Source files read:
- `scripts/mydeck-scoring/score.ts` (demand generation ~L272-650, `compareDemands`/`categoryForDemand` L711-772)
- `src/engine/grammar/compile.ts` (1715 lines, full read)
- `src/engine/grammar/ir.ts` (AbilityCost/AbilityIR parsing, cost splitting, clause splitting)
- `src/engine/grammar/index.ts` (effect atom probe list)
- `research/mydeck-scoring/gaps.json` (521 gap rows), `summary.md`

## Top-level numbers

- Total gap rows: **521**. Rows containing >=1 demand id from a broken family
  (`cost:*`,`mana:*`,`action:*`,`tap-state:*`,`damage:*`,`life:*`,`counter:*`,`target:*`,`token:*`):
  **502 (96.4%)**. Of those, 330 are tagged `catalog未写`, 171 `substrate不足`,
  1 `scope境界`. In other words, the "broken families" issue is not a corner case —
  it touches almost every gap row in the dataset, confirming the background claim
  at scale.
- This does NOT mean 502 rows are false positives. It means 502 rows have their
  primaryCandidateCategory/status determined at least partly by classifiers that
  cannot ever mark these ids as covered — so for those particular demand ids the
  "missing" signal is uninformative regardless of true compiler support. Each row can
  still have a real gap from *other* demand ids (e.g. `layer:*`, `event:*`, variable
  counts, cross-player scope) that the classifiers legitimately do track.

## Method for per-family verdicts

For each family, sampled actual `clauseExcerpt` rows from gaps.json and traced them
through `compile.ts`'s actual decision path (`compileAbilityCost` for cost families,
`compileEffect`/`compileAbilityIR` for effect families), citing the exact function/regex
that would fire. "False positive" = compile.ts's logic, as literally written, would
mark this clause `auto` or `guided` (a working, testable path) for the actual pattern
seen in these decks. "Genuine gap" = no path in compile.ts recognizes the shape, so it
would fall through to `manual` with a reason (`needs-parse`, `needs-choice`,
`variable-count`, `no-command`, etc.) — i.e. the demand really is unmet capability.

Important nuance discovered: coverage is clause-level and often ability-level (multiple
effect clauses must ALL compile for the ability to end up `auto`/non-manual). A few
demo traces below show clause-splitting behavior (`splitEffectClauses` in ir.ts splits
on `.` or the word `then`), which sometimes turns a two-verb sentence into two
independently-compilable clauses (false positive) and sometimes doesn't (genuine gap,
e.g. variable "any number"/"that many" counts always fail `resolveCount`).

## Per-family verdict table

| family | gap-row count (rows where this id appears in missingReadWrite) | estimated false-positive fraction | justification |
|---|---:|---:|---|
| `cost:activation` | 232 | **~90-95% false positive** | `compileAbilityCost` (compile.ts L243-336) handles tap, mana symbols, self-sacrifice, self-exile, and fixed pay-life amounts additively via comma-split residual-checking. Any activated ability whose cost is built from these primitives (the overwhelming majority of the sample: Mother of Runes `{T}:`, Sol Ring `{T}:`, signets `{1},{T}:`, Cathar Commando `{1}, Sacrifice this creature:`, Priest of Fell Rites `{T}, Pay 3 life, Sacrifice this creature:`) is `auto` at the cost level. Genuine misses only appear for costs with unrecognized text residue (ability-word labels, non-self sacrifice/exile targets, `{X}` in cost) — these exist but are the minority in the sample. |
| `cost:tap` | 201 | **~90%+ false positive** | Same function; `cost.tap` sets `commands.push({type:'setTapped',...})` whenever `/\{T\}/i` matches the cost segment. Every `{T}:` ability in the sample (Mother of Runes, Sol Ring, Skeleton Crew's `{5}{B}:` — wait, no T there but still auto via mana-only) compiles this piece. |
| `mana:write` | 150 | **~90-95% false positive** | `compileManaEffect` (L1128) → `literalManaCommands` handles fixed `{W}{U}{B}{R}{G}{C}` symbol strings (Sol Ring `Add {C}{C}`, Boros/Orzhov/Rakdos Signets `Add {R}{W}`/etc, Talisman `Add {R} or {W}` — actually "or" triggers `literalManaCommands` to return null via the `/\bor\b/` guard, falls to `guidedManaPrompt`? No — "any color" pattern needed; "R or W" doesn't match `guidedManaPrompt`'s `add ... mana of any ... color` regex either, so this one specific case (Talisman) is a genuine miss/needs-parse). `guidedManaPrompt` handles "add one mana of any color" and "any color in commander's color identity" (Arcane Signet — confirmed false positive). The vast bulk of the sample (basic signets, Sol Ring, Arcane Signet) is auto/guided. Two-color-choice mana abilities ("Add {R} or {W}") are a genuine (small) miss. |
| `tap-state:write` | 108 | **~50/50, judge case-by-case** | This id fires for both "tap"/"untap" cost-fragments (already counted under cost:tap) AND clause bodies like "enters tapped", "return ... to the battlefield tapped", "untap target creature". `GUIDED_TARGET_ATOMS` includes `effect.tap`/`effect.untap` (single-target only) — "untap target creature" (Fear of Missing Out) is a false positive (guided target). But "return target creature card ... to the battlefield tapped" bundles tap-state into the `effect.return` guided-target path only when the return target-filter matches the narrow graveyard-creature-to-battlefield pattern (`isExactGraveyardCreatureReturn` requires the return clause to end in "to the battlefield" with NO trailing "tapped"/"and attacking" words) — so "return ... to the battlefield tapped" (Terra, Herald of Hope; Alesha, Who Smiles at Death; Skeleton Crew) does NOT match that exact-string check and instead falls to the generic `guidedTargetPrompt` fallback, which also doesn't special-case "tapped" as a modifier — genuinely unhandled (the compiled command has no way to additionally set tapped=true on a guided-return target). "Create a tapped Treasure token" (predefinedTokenCommand) has no tapped-token parameter for treasure specifically (only `createDefinedToken`/`isDefinedTappedTokenCreation` supports `initialTapped` for the fixed-P/T creature-token grammar) — genuine miss for tapped Treasure/Zombie tokens created via the generic `predefinedTokenCommand` path. **Net: roughly half genuine (tapped-modifier-on-return / tapped-predefined-tokens), half false positive (plain untap-target, plain tap-cost already counted elsewhere).** |
| `action:sacrifice` | 74 | **~40-50% false positive, rest genuine** | `compileSacrificeEffect` (L1017) handles: self-sacrifice-as-effect (`isSelfSacrificeEffectClause`), and guided single-target sacrifice of an unqualified type noun ("sacrifice a creature/artifact/...", `you control` implied) via `sacrificeEffectFilter`. It explicitly rejects (`hasUnsupportedSacrificeClause`) any clause containing "unless/target/each/opponents?/that player/their/controller" — so "each player sacrifices a nontoken creature of their choice" (Accursed Marauder) is a genuine miss (per-player choice not modeled), "Sacrifice this creature: ..." AS A COST is not scored here at all (it's parsed into `AbilityCost.sacrificesSelf`, handled by `compileAbilityCost`, not this effect path — meaning the `action:sacrifice` demand id firing on these clauses is arguably a scoring-tool artifact: the same physical text token drives both a cost demand and an effect demand, and the cost side is auto while the effect probe still fires). "sacrifice a nonland permanent" (Rite of Oblivion, additional cost) — needs checking whether it's parsed as cost or effect; as an "additional cost to cast", it is NOT part of `AbilityCost`/`compileAbilityCost` (that only handles activated-ability costs), so this is likely a genuine spell-additional-cost gap. **Verdict: self-sacrifice-as-cost occurrences are false positives (already handled elsewhere); "each player"/"nontoken"/multi-party sacrifice and spell additional costs are genuine gaps.** |
| `action:draw` | 65 | **~40% false positive, ~60% genuine** | `effect.draw` is in `COUNT_DRIVEN_AUTO_ATOMS`, gated by `resolveCount` (fixed number or "a card"=1 only) AND `hasSupportedPlayerSubject` (`/^\s*draw\b/i` or `/\byou draw\b/i` — i.e., the clause fragment itself must start with "draw" or contain "you draw"; player-scoped variants like "target opponent may draw a card" or "that player draws" do NOT match, nor does "draws that many cards" match a `resolveCount`-recognized fixed count). Simple clauses like "draw a card" (post clause-split) are auto. But "draw that many cards plus one" (variable count tied to prior discard), "target opponent may draw a card" (non-self subject + optional), "each player discards their hand, then draws seven cards" (draws seven — actually a fixed count of 7, subject is "draws" not "you draw"/"draw" at clause start — check: after split, clause is "then draws seven cards" or similar, likely fails `hasSupportedPlayerSubject`) are genuine gaps. |
| `action:destroy` | 11 | **~55% false positive** | `GUIDED_TARGET_ATOMS` includes `effect.destroy`; `guidedTargetPrompt`'s generic path handles any clause matching `isSingleTargetClause` (exactly one "target", no "up to"/count-word/"each target"/"...target...card") plus a recognized type noun. "Destroy target creature[. A creature destroyed this way can't be regenerated]" (Damn), "Destroy target artifact you don't control" (Vandalblast), "Destroy target nonland permanent" (Binding the Old Gods) — false positives (single-target destroy is guided/auto once split from the trailing "can't be regenerated" sentence, which is a separate clause that doesn't touch destroy's atom). "Destroy target creature or enchantment an opponent controls" (Feed the Swarm) — has a compound type list; `targetFilterForRaw` regex-matches type words individually so `types:['creature','enchantment']` should populate — likely false positive too. "Destroy all nonland permanents..." (Ruinous Ultimatum), "Destroy each nonland permanent with mana value 2 or less" (Culling Ritual, Pernicious Deed) — mass/conditional destroy has NO non-targeted atom path (`TARGET_REQUIRED_ATOMS` includes `effect.destroy` unconditionally when not single-target) → genuine gap ("needs-target" manual reason, no all/each destroy primitive exists). |
| `action:exile` | 35 | **mixed, lean genuine (~35% false positive)** | Same `GUIDED_TARGET_ATOMS` mechanism applies to `effect.exile` for plain single-target exile ("Exile target nonland permanent" — Rite of Oblivion — false positive). But many sampled rows are exile-with-followup (temporary exile+return via `guidedTemporaryReturnPrompt`, requires exact "return that card to the battlefield" trailing text with no delay — Skyclave Apparition's exile clause has NO same-turn return follow-up, so falls to plain guided-target exile: false positive for the exile atom itself, though the SEPARATE leaves-battlefield trigger clause creating an X/X token from "the exiled card's owner" is a genuine `object-identity:lki`/LKI-cross-reference gap, unrelated to exile per se). "exile a card at random from your graveyard" (Tersa Lightshatter) — random selection from graveyard, no atom/filter path for "at random" — genuine gap. "Exile target creature. Its controller may search..." (Path to Exile) — exile clause alone is a false positive (single target), but the ability as a whole is correctly still `partial`/gap because the chained search/shuffle clause has its own genuine gaps. |
| `action:return` | 31 | **~45% false positive** | `guidedTargetPrompt` special-cases `effect.return` two ways: (a) `isExactGraveyardCreatureReturn` — exact string "return target creature card from your graveyard to the battlefield" (no tapped/attacking/other trailing text) — Priest of Fell Rites (before the tapped-condition question — actually its clause does NOT have "tapped" so this one IS the exact match: false positive), Karmic Guide (exact match: false positive), Eternal Witness ("return target card from your graveyard to your hand" — doesn't match graveyard-to-battlefield path, but the generic path requires "to ... hand" wording, which IS supported per L1272-1276: false positive); (b) generic single-target return-to-hand (`/to (?:its owner's|their|your|the owner's) hand/`) — Aether Spellbomb "Return target creature to its owner's hand" (false positive), Simic Growth Chamber "return a land you control to its owner's hand" (no "target" keyword present — `isSingleTargetClause` requires `/\btarget\b/`, so THIS FAILS — genuine gap despite looking simple, because the clause doesn't use the word "target"). Return-with-tapped-modifier (Terra, Alesha, Skeleton Crew), return-all/mass return (Ascend from Avernus, Hide on the Ceiling), delayed/multi-step returns (Fable of the Mirror-Breaker transform-return, Displacer Kitten/Thassa "then return" two-step non-exact-string) are genuine gaps — no atom captures "tapped"/"attacking" modifiers, no all-cards return atom exists, delayed multi-step chains beyond the narrow `guidedTemporaryReturnPrompt`/`isSameResolutionBattlefieldReturn` exact-match aren't modeled. |
| `action:discard` | 34 | **~15-20% false positive, mostly genuine** | `guidedDiscardPrompt`/`isSelfDiscardOneCardClause` only matches bare "discard a/one card" with NO random/target/each/opponents/their/that player/controller words. Traced concretely: "discard a card, then draw a card" (Fear of Missing Out) — `splitEffectClauses` (ir.ts) splits on the literal word "then", producing clauses `"discard a card,"` and `"draw a card"` — BOTH independently satisfy their guided/count-driven paths → **this specific row is a false positive** (confirmed by tracing the actual split-clause regex). But "discard any number of cards, then draw that many cards plus one" (Celes) splits similarly but "any number" fails `isSelfDiscardOneCardClause` (not "a"/"one") and "that many...plus one" fails `resolveCount` → genuine gap on both sides. The large majority of sampled rows are "each player discards...", "discard up to two", "discard their hand", "discard a card at random", cross-player ("whenever an opponent discards") — all explicitly excluded by the guard regex → genuine gaps. Net: mostly real, only the narrow "discard a card[,] [then] draw a card" self/single/unconditional shape is a false positive. |
| `token:create` | 32 | **~55-60% false positive** | `PREDEFINED_TOKEN_SPECS` covers treasure/clue/food/blood (untapped only — see tap-state note above), and `parseDefinedCreatureTokenSpec`/`definedCreatureTokenCommand` covers fixed "create a/an/N (tapped) P/T color Subtype creature token(s) [named X]" grammar. Fixed-stat tokens with a plain quantity/color/PT/subtype (2/2 black Zombie, 3/2 red and white Spirit — wait, "red and white" is two colors, which `subtypeCapturesLeakedColorWord` explicitly rejects to avoid corrupting the subtype capture — genuine miss for multicolor token grammar) are false positives when single-colored (Skeleton Crew's "2/2 black Skeleton Pirate" — false positive) but genuine gaps when: multicolor ("red and white Spirit" — Quintorius), variable/X-sized ("X/X blue Illusion... where X is the mana value" — Skyclave Apparition, no CDA-token support), tapped (already discussed), or conditional/bundled with another unsupported clause (Mog Moogle Warrior's "if a creature card was discarded this way" conditional token). |
| `counter:write` | 14 | **~60-70% false positive** | `GUIDED_TARGET_ATOMS` includes `effect.counter-plus`; `counterDescriptorForRaw` recognizes fixed `+1/+1`/`-1/-1` counters with a numeral/word count. "put a +1/+1 counter on it" (Gau, Feral Youth self-target via "it" — need to check `guidedTargetPrompt`'s `isSingleTargetClause` requires literal "target" keyword; "on it" has no "target" word, so this actually FAILS `isSingleTargetClause` → genuine gap despite looking simple), "put a +1/+1 counter on General Leo Cristophe" (named self-reference, not "target" — same issue, genuine gap), "put an indestructible counter" (non-+1/+1 counter type — `counterDescriptorForRaw` only recognizes the two P/T kinds — genuine gap). Re-examining: **the guided counter-plus path effectively only fires for "put a/N +1/+1 counter(s) on target X" phrasing with the literal word "target"** — none of the sampled rows use that exact phrasing (they use "it"/name-references instead), so this family is **mostly genuine** on closer trace, revising down from the initial optimistic read. |
| `damage:write` | 33 | **~50% false positive** | `GUIDED_TARGET_ATOMS`/`TARGET_REQUIRED_ATOMS` includes `effect.damage` for single-target ("deals N damage to target creature") — none sampled here use bare single-target phrasing; instead: "Gau deals damage equal to its power to each opponent" (variable amount + each-opponent, no atom for player-group non-target damage — genuine gap, though there IS `isPreventAllCombatDamageThisTurnClause` special-case unrelated to this), "this Class deals 2 damage to each opponent" (fixed count but "each opponent" not "target" — no atom path for fixed multi-opponent non-targeted damage — genuine gap), "Blasphemous Act deals 13 damage to each creature" (fixed count, mass non-target — genuine gap), "This artifact deals 1 damage to you" (self-damage-to-controller, fixed count, no "target" — genuine gap; note this is bundled with an otherwise-auto mana ability, so it's the ability's only blocker). On reflection, damage:write's sampled rows lean genuine because MTG "deal damage to X" templating for AOE/opponent/self triggers rarely uses the literal word "target", and `compileEffect`'s only auto/guided path for damage requires the generic `guidedTargetPrompt`'s single-"target" gate. **Revised down to ~15-20% false positive** (only bare "deals N damage to target creature/player" would qualify, which is rare in this specific sample). |
| `life:write` | 17 | **mostly genuine (~10-15% false positive)** | No atom in `COUNT_DRIVEN_AUTO_ATOMS` list actually includes... wait, `effect.gain-life`/`effect.lose-life` ARE in `COUNT_DRIVEN_AUTO_ATOMS`, gated by `hasSupportedPlayerSubject`: gain-life needs `/^gain\b/` or `/\byou gain\b/`; lose-life needs `/\byou lose\b/` specifically (no bare "^lose" allowed, asymmetric with gain). Sampled rows: "Its controller gains life equal to its power" (variable count, non-"you" subject — genuine gap on both axes), "each opponent loses 1,000 life" (non-you subject — genuine gap), "you lose 1 life for each burden counter" (variable "for each" count — genuine gap despite "you lose" subject match, since `resolveCount` fails on for-each), "that player loses 1 life" (non-you subject — genuine gap). None of the sampled life:write rows are bare "you gain/lose N life" — all have variable counts or non-self subjects. **Genuine gaps dominate this family in the observed sample.** |
| `target:object-or-player` | 97 | **~40-45% false positive, but highly clause-dependent** | This demand id fires on ANY clause containing the word "target" (`addEffectDemands` L551). Coverage depends entirely on which atom the target attaches to and whether `isSingleTargetClause`/type-filter parsing succeeds — i.e. it inherits the verdict of whichever atom (destroy/exile/return/tap/untap/counter-plus/counter-spell/pump/gain-control/etc.) it's paired with. Since those per-atom verdicts above are mixed (roughly half false-positive for plain single-target destroy/exile/return, mostly-genuine for counter-plus/damage), and since MANY sampled rows here are themselves compound/multi-clause abilities where the target clause is fine but a SIBLING clause (variable count, cross-player, tapped-modifier) is what keeps the ability `partial`, this id is best read as **not independently meaningful** — its false-positive rate must be read off the specific paired atom, not computed standalone. |

## Bottom-line estimate

Applying the per-family fractions above to the 331 `catalog未写` + 179 `substrate不足`
= 510 total gap rows (regardless of family — a row can carry multiple demand ids so
this is not a strict partition, but gives an order-of-magnitude read):

- **cost:activation / cost:tap / mana:write are overwhelmingly false positives**
  (~90%+). These three alone account for the largest raw occurrence counts
  (232 + 201 + 150 = 583 demand-id hits, heavily overlapping on the same
  activated-ability rows). Removing them eliminates most of the "every mana
  rock/tap ability is a gap" noise the background note already flagged (Sol Ring,
  signets, Mother of Runes, Arcane Signet, Boros/Orzhov/Rakdos Signet, Talisman —
  9+ of the ~12 example rows in summary.md's own "代表ギャップ" section involve one
  of these three ids).
- **action:destroy, action:exile, action:return, token:create, counter:write** are
  genuinely mixed (40-60% false positive depending on family), and the true split
  requires the per-row tracing done above — single-target/simple-grammar variants
  compile fine; mass-effect, variable-count, cross-player, and modifier-bearing
  (tapped/attacking/multicolor/non-unit-counter) variants are real gaps.
- **action:discard, action:draw (non-trivial forms), damage:write, life:write,
  action:sacrifice (non-cost forms)** lean genuine — the classifiers' narrow
  "self, fixed-count, unconditional" gating means most real card text (which layers
  in "each player"/"opponent"/variable-X/conditional) falls outside what compile.ts
  currently automates.

**Rough bottom-line count**: after discounting the high-confidence false positives in
cost:activation/cost:tap/mana:write (roughly 550-600 raw demand-id hits concentrated in
a much smaller number of unique rows — mostly activated mana-ability/tap-ability rows,
estimated 60-90 unique gap rows whose ONLY blocking demands are in this trio and are
therefore mislabeled complete-in-practice), and taking the mixed families at their
estimated midpoints, a defensible estimate is that **of the 510 catalog未写/substrate不足
rows, on the order of 150-220 rows represent genuine unmet capability** (i.e. roughly
30-45%, not the ~98% the raw report implies), with the rest either false positives from
the four broken classifiers or already covered by another correctly-classified demand
in the same row (rows are multi-demand, so a "gap" row can still contain one genuinely
uncovered demand even after removing false ones — this estimate counts a row as
"genuine" if at least one of its demands, after correction, would still be missing).

## Top genuinely-missing capability clusters (real prioritization candidates)

1. **Cross-player / "each player" / "each opponent" effect variants** — sacrifice,
   discard, draw, damage, life-loss templated as "each player"/"an opponent"/"that
   player" rather than self ("you"). This is the single largest genuine cluster: it
   recurs across action:sacrifice (Accursed Marauder), action:discard (majority of
   the 34 rows), action:draw ("target opponent may draw"), damage:write ("to each
   opponent"), life:write ("each opponent loses X life"). None of compile.ts's
   `hasSupportedPlayerSubject`/guard-regex paths accept non-"you" subjects.
2. **Variable/dynamic counts** ("any number of cards", "that many cards", "X damage
   where X = mana value", "for each ... counter") — `resolveCount` only recognizes
   `kind: 'one'` or `kind: 'fixed'`; `variable-x`/`for-each`/`unknown` always fail,
   hitting draw, discard, life, damage, token-count clauses alike.
3. **Return/exile/token "tapped" or state-modifier riders** — "return ... to the
   battlefield tapped [and attacking]", tapped Treasure/predefined tokens outside the
   fixed creature-token grammar. No atom or guided-prompt path threads a tap-state
   side effect onto return/exile/token commands.
4. **Mass/board-wide effects without a bound target** ("destroy all/each ...",
   "return all ... cards", "each creature deals/gets", non-targeted multi-object
   destroy/exile/return/damage). `TARGET_REQUIRED_ATOMS` unconditionally routes these
   to `needs-target` manual even when no single object is targeted at all.
2. **Non-unit or non-P/T counters, and "on it"/self-name counter targets without the
   literal word "target"** — counterDescriptorForRaw only knows +1/+1 and -1/-1;
   guided counter-plus additionally requires the literal word "target" in the clause,
   so idiomatic "put a counter on it/itself/[card name]" phrasing (common on
   self-buffing creatures) is unhandled despite being simple in spirit.

## Caveats / where I'm not fully certain

- I traced logic by reading the regexes/functions directly, not by executing
  compile.ts against these exact card texts (no test harness was run — this was a
  static/manual trace per the read-only task constraint). A few verdicts above
  (marked "likely"/"need checking") are inferred from regex behavior rather than
  confirmed via execution; I flagged those explicitly (e.g. Feed the Swarm's
  compound target-type list, Talisman of Conviction's "Add {R} or {W}" mana clause,
  Rite of Oblivion's additional-cost-to-cast sacrifice).
- The clause-splitting behavior (`splitEffectClauses` in ir.ts, on `.` or the word
  "then") materially changes outcomes and is easy to get wrong by eyeballing the raw
  Oracle text alone — I verified this specific mechanism with an actual regex replay
  (see "discard a card, then draw a card" vs. "discard any number... then draw that
  many..." trace above), which is why the same-looking `action:discard`/`action:draw`
  pairing can be a false positive in one row and a genuine gap in a very similarly
  worded neighboring row.
- I did not exhaustively trace all 521 rows — verdicts are extrapolated from 5-10
  samples per family as instructed. Given how much the sample showed
  shape-of-clause-dependent behavior (single "target" keyword presence/absence,
  "you"-subject presence/absence, tapped-modifier presence/absence), the true
  aggregate fractions could plausibly shift +/-10-15 points per family with a larger
  sample; treat the percentages as order-of-magnitude, not precise measurements.
