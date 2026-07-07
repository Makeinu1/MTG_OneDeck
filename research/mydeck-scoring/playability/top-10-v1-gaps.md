# V1 Playability Assessment — findings & top-10 gaps

Author: J2 Opus (judge synthesis), 2026-07-07. Measurement scripts (Sonnet):
`scripts/mydeck-scoring/census.ts` (static, real compiler) +
`playthrough.ts` (headless 10-turn play, seed=1). Raw data:
`research/mydeck-scoring/playability/{census.json,playthrough-*.json}`.

## Headline (honest ground truth — the demand meter hid all of this)

Static census over 4 decks (363 resolved cards), each ability line run through the
REAL compiler (`parseAbilityIR`→`compileAbilityIR`):

| bucket | cards | % |
|---|---:|---:|
| `auto` (engine fully resolves) | 39 | 11% |
| `guided` (needs one click: a target/choice) | 32 | 9% |
| `manual` (engine can't resolve) | 292 | 80% |

Play-through: **all 4 decks ran 10/10 turns, zero crashes, zero engine errors.**
Mana, lands, keywords all functioned; the decks are playable end-to-end.

## The two numbers that matter, corrected

**1. The 80% "unsupported" massively over-reports the real gap.** The census routes
every oracle line through the *ability* compiler, but three big classes are handled
by OTHER engine paths it doesn't credit — confirmed working by the 10-turn play-through:

| census "manual" that already works | cards | handled by |
|---|---:|---|
| ETB-tapped lands ("enters tapped [unless…]") | 45 | `playLand` / `landEntersTapped` (shipped §34.33/36) |
| keyword abilities (Flying/Haste/Lifelink/…) | 30 | `effectiveKeywords`/status (shipped §34.38 etc.) |
| mana abilities ("{T}: Add …") | 28 | mana-ability path + autotap solver |
| **blind-spot subtotal** | **103** | |
| deliberate sandbox "you may …" | 33 | correct-by-design (optional = player choice) |

So of 292 "manual", **~103 already play fine and ~33 are deliberately manual. The
genuine automatable frontier is ≈156 cards** — and the decks are already *usable*
today (manual resolution is always available). **The gap is automation DEPTH, not
brokenness.**

**2. 誤自動化 (wrong-automation) ≈ 0.** Spot-check of all 39 `auto` cards: almost
entirely literal mana (Sol Ring, Signets, dorks, filter lands) + a few simple draws +
the Spore Frog prevention shield. None carry silent-error risk. The engine **fails
closed to manual** — it only auto-resolves what it's confident about. The counter-sign
bug fixed earlier this session was the exception, now gone. **Risk is under-automation,
not mis-automation.** (Caveat: the headless script silently skips unsupported effects
on cast; the real app surfaces them for manual resolution via `pendingGuided` — verify
in-browser that unsupported effects prompt rather than no-op.)

## Metric reconciliation (the three the user asked for)

- **非対応カード数 (unsupported)**: reported 292 → **genuine ≈156** after removing the
  103 blind-spot + 33 deliberate-manual.
- **手動介入回数 (needs-click)**: 32 `guided` cards (e.g. Arcane Signet all 4 decks) —
  acceptable UX (one click); NOT a V1 blocker.
- **誤自動化数 (wrong-auto)**: **≈0** (fail-closed design).

## Top-10 V1 gaps (ranked: cross-deck frequency × per-game tedium × severity)

Genuine automatable gaps only. Each maps to an implementable compiler/engine slice and
aligns with the 5 frontier clusters from this session's demand-instrument audit.

| # | gap (capability) | occ | why V1 | anchor |
|---|---|---:|---|---|
| 1 | **Fetchland fetch** ("{T}, [pay life,] Sac: search library for [land], put onto battlefield [tapped], shuffle") | 24 (all 4 decks) | played nearly every game; most tedious manual step | reuse `parseSingleCardRampSearch` (compile.ts); CR 701.19/103.2 |
| 2 | **Cross-player effects** ("each player/opponent sacrifices/discards/draws", edicts, "target opponent") | 27 | biggest genuine EFFECT cluster; edicts/wraths are game-defining | audit cluster 1; needs non-"you" subject in `hasSupportedPlayerSubject` |
| 3 | **Activated targeted creature abilities** ("{T}: target creature you control gains/does X") | ~11+ | repeated every turn (Mother of Runes, Cathar Commando) | guided-target activated path; CR 602/115 |
| 4 | **Variable / dynamic counts** ("draw that many", "any number of", "X where X=…") | 8 | includes commanders themselves (Celes) | audit cluster 2; `resolveCount` only does one/fixed; CR 608.2h |
| 5 | **Mass / board-wide untargeted** ("destroy all nonland permanents", "return all") | 5 | board wipes are pivotal turns (Toxic Deluge, Blasphemous Act, Ruinous) | audit cluster 4; `TARGET_REQUIRED_ATOMS` mis-routes; CR 609 |
| 6 | **Token creation variants** (tapped / multi / saga-chapter tokens) | 7 | recurring value engines | audit cluster 3; extend `createDefinedToken` |
| 7 | **Complex triggered ETB bodies** (ETB exile/mill/conditional) | 11 | ETB is the dominant EDH shape | CR 603; per-effect parse |
| 8 | **Graveyard recursion** ("return creature card from your graveyard") | 2 | Muldrotha deck's core loop | CR 608; guided-target-from-graveyard |
| 9 | **Non-target counter placement** ("put a +1/+1 counter on it/[name]") | 1+ | self-buff creatures; simple in spirit | audit cluster 5; `counterDescriptorForRaw` needs no-"target" path |
| 10 | **Painland/filter mana with rider** ("{T}: Add R or W. This deals 1 damage to you") | (in mana 28) | borderline blind-spot — verify these actually work in-app vs census false-negative | mana path + damage rider |

## Recommended sequencing (post-Codex 7/11)

Gaps **1, 2, 4, 5, 6, 9** ARE the 5 audit clusters already in the pipeline — this
play-through independently confirms them by real frequency and adds **#1 fetchlands**
as the single highest per-game-value item (not surfaced by the demand meter at all).
Suggested V1 order: **#1 fetchlands → #2 cross-player → #3 activated-targeted →
#4 variable-count → #5 board-wipes**, then the rest. Each is a bounded leaf; implement
via Codex on return (or judge-surgical for #1, which largely reuses existing ramp-search).

## Caveats / limits
- Census credits only the ability-compiler path; lands/keywords/mana handled elsewhere
  are false-negatives (corrected above). The score.ts repair (this session's spec)
  should teach the meter these paths so the number stops lying in both directions.
- Wrong-automation is judge spot-check only (no oracle). The `auto` set is small/safe
  today; re-check whenever the auto set grows.
- 18 cards unresolved (not in the 2026-06-19 snapshot) — data-availability, not a
  compiler gap; excluded from all counts.
- Play-through heuristic is deliberately dumb (few casts, no combat) — it proves
  no-crash + exercises resolution, but the census is the authoritative coverage signal.
