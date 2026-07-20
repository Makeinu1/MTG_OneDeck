# plannedSequence batch4 draft

Status: draft only, not yet promoted to `cr-backbone-ledger.json.plannedSequence`.
Author: J3 Sonnet (Codex substitute — Codex usage quota exhausted until
2026-07-11, per `codex-quota-judge-substitution` memory. Drafting duty
substituted directly rather than delegated, since this task is CR/data
verification, which is judge-native work anyway).

## 0. Measurement-instrument finding (read this before trusting the demand numbers)

Before drafting candidates from `research/mydeck-scoring/gaps.json`, I verified how
the tool computes "missing demand" (`scripts/mydeck-scoring/score.ts`
`compareDemands`/`categoryForDemand`, lines 705-766). Finding, confirmed by direct
code read (not inference):

- The tool compares two **independent text-parses of the same oracle text**: a
  `demand` list (what a clause textually requires) and a `modelTags` list produced
  by exactly four classifiers — `classifyEventsForLine` (`event:*`),
  `classifyContinuousLayers` (`layer:*`, `cda`), `classifyTimingForLine`
  (`timing:*`, `cast-timing:*`), `classifyZonesForLine` (`zone:*`,
  `zone-cross`, `ownership:*`, `player-scope:*`).
- It does **not** consult the actual engine/compiler (`src/engine/grammar/compile.ts`,
  the effect-atom catalog, or any runtime capability check). A demand id is
  "covered" only if one of those four classifiers happens to emit a tag with the
  exact same string.
- None of the four classifiers ever emit a tag starting with `cost:`, `mana:`,
  `action:`, `tap-state:`, `damage:`, `life:`, `counter:`, `target:`, or `token:`.
  Per `categoryForDemand`, any demand id in those families that isn't explicitly
  listed under `scope境界(既知defer)` falls through to either `catalog未写`
  (for `action:`/`counter:`/`life:`/`tap-state:`) or the default `substrate不足`
  (for `cost:`, `mana:`, `target:`, `damage:`, `token:`) **unconditionally** —
  i.e. every clause that mentions a tap cost, an activation cost, mana
  production, a sacrifice/draw/discard/search/shuffle/exile/return/destroy
  action, a target, a damage/life/counter write, or token creation is reported
  "missing" regardless of whether the engine already handles it.
- I spot-verified this is a false signal for several of the highest-count items:
  `research/mydeck-scoring/gaps.json` flags **Sol Ring / Arcane Signet / all six
  Signets / all Talismans** (`{T}: Add {C}{C}` etc.) as `substrate不足` for
  `cost:activation`/`cost:tap`/`mana:write`, but `src/engine/grammar/compile.ts`
  (`literalManaCommands`, `guidedManaPrompt`, `compileManaEffect`, ~line 1128-1230)
  already compiles exactly this pattern, matching the ledger's `cr-605-mana-abilities`
  domain, which is `shipped`. Likewise `cr-602-activated-abilities` (tap costs),
  `cr-118-costs`, and `cr-115-targets` are all `shipped` in the ledger, so
  `cost:activation`(232), `cost:tap`(201), `mana:write`(150), `tap-state:write`(108),
  `target:object-or-player`(97) are near-certainly dominated by cards the engine
  already handles — the numbers measure the classifier's blind spot, not a real
  backlog.
- Practical consequence for this batch: **do not use raw demand counts for
  `cost:*`/`mana:*`/`action:*`/`tap-state:*`/`damage:*`/`life:*`/`counter:*`/
  `target:*`/`token:*` as a priority signal** until the tool is extended with
  real classifiers for those families (cross-checked against the actual
  compiler catalog, not a second text parse). The only demand numbers in the
  top-20 list that are backed by a real classifier are `object-identity:lki`(28,
  already correctly bucketed `scope境界(既知defer)`), `event:draw`(25), and
  `zone:library`(15). Everything else in the top-20 (`cost:activation` through
  `counter:write`) is not yet a validated signal.
- This is a `docs/judge-protocol.md` §1 **decidable** finding (Q1/Q2 yes — code
  read settles it), not a value judgment, so it does not trigger STOP①. I'm
  recording it here rather than escalating.

Candidates below are therefore selected from (a) domains whose `nextGate` in the
ledger is concretely actionable now given already-shipped substrate, and (b) the
handful of demand tokens backed by real classifiers.

## Candidates (ordered; see routing note per item)

### 1. `cr-702-keyword-abilities-frequent` — promote combat/damage-dependent keywords
- lane: `leaf-compiler`
- status today: `drafted` (not yet `implemented-not-green`)
- demand: not measurable via the broken `cost:`/`action:` axis above; this
  domain is about compiling static **keyword ability grants** themselves
  (flying, first strike, double strike, deathtouch, trample, lifelink,
  vigilance, haste, reach, menace, ward), which the demand tool doesn't probe
  directly (keyword grants are declarative type-line/text additions, not
  action/cost/event clauses) — real signal here comes from the ledger's own
  `nextGate`, not `gaps.json`.
- edhValue: high — these are the single most common ability words across all
  four MyDeck decks' creature bases (unscored here, but self-evident from any
  EDH creature list); combat resolution correctness depends on them.
- CR grounding: 702.9 (flying), 702.7 (trample), 702.2 (deathtouch, "any
  amount of damage ... is considered to be lethal"), 702.15 (double strike),
  702.4 (first strike, via 509.2/510.4 combat damage step split), 702.16e
  (lifelink), 702.20b (haste), 702.17e (reach), 702.111 (menace, "can't be
  blocked except by two or more creatures"), 702.21 (ward, a triggered ability
  with a cost-imposition effect on becoming a spell/ability target).
- Scope sketch: in-bounds = recognizing the exact keyword line on a card's
  oracle text and wiring it into existing combat/damage/layer substrate that
  is already shipped (`cr-506-510-combat` single-blocker/damage core,
  `cr-120-damage` shipped, `cr-604-...-layers` Layer 6 slice B shipped for
  ability-adding). Ward's cost-imposition and double/first strike's extra
  combat-damage-step interaction with multiple blockers should be scoped as
  **single blocker only** for this slice (multiple-blocker allocation is
  explicitly deferred by `cr-506-510-combat`'s own boundary) — do not
  re-open multi-blocker allocation here.
- Routing: **needs real new leaf-compiler work** (this is not a "gap
  discovered to be zero" case — no existing code path recognizes keyword
  lines as abilities today per the ledger's own `boundary` field for this
  domain, which is still `drafted`).

### 2. `event:draw` / `zone:library` catalog gaps (real, classifier-backed)
- lane: `leaf-compiler`, parented under existing `cr-121-drawing` (backbone,
  `implemented-not-green`)
- demand: `event:draw` = 25 occurrences, `zone:library` = 15 occurrences —
  both counted by `classifyEventsForLine`/`classifyZonesForLine`, i.e. real
  signal, not the broken axis.
- edhValue: high — draw is one of the most common effect shapes in the
  sampled decks (Tataru Taru, Fear of Missing Out, Banon, Whispering Madness,
  Blue Sun's Zenith all show up in `summary.md`'s representative-gap list).
- CR grounding: 121.1-121.4 (the draw-a-card action itself: move top card of
  library to hand), 104.3c/703/704.5c (empty-library draw as a loss condition,
  already covered by `cr-104-loss-advisory` shipped-adjacent domain — do not
  re-derive that part).
- Scope sketch: in-bounds = single/multi-card draw-N guided leaves triggered
  by ETB/attack/upkeep (matches the demand sample's shapes) using the
  already-shipped draw-empty-library advisory and event log. Out-of-bounds =
  "draw equal to X" variable-count draw tied to complex characteristics
  (defer), opponent-forced draw variants beyond the simple `player-scope:each-opponent`
  case already partially modeled.
- Routing: **needs new leaf-compiler catalog entries** — `cr-121-drawing`'s own
  `nextGate` ("player-specific zones と draw event envelope を同時に凍結する")
  suggests this may already be substantially unblocked by the already-shipped
  `zonesByPlayer` work under `cr-102-players` (shipped 2026-07-05); worth a
  short scoping check before assuming full new-work size.

### 3. Fix the mydeck-scoring measurement blind spot (tooling, not a CR domain)
- lane: n/a (this is a `scripts/mydeck-scoring/` accuracy task, not a ledger
  domain) — flagging here per the `accuracy-program` memory's "計測品自体も
  反復改善する" principle, since it directly blocks reliable demand-first
  selection for the entire `cost:`/`action:`/`mana:`/`tap-state:`/`damage:`/
  `life:`/`counter:`/`target:`/`token:` demand families going forward.
- demand: n/a (this *is* the demand-measurement fix)
- edhValue: high — every future `plannedSequence` replenishment cycle inherits
  this blind spot until fixed.
- Scope sketch: extend `scripts/mydeck-scoring/score.ts`'s model-tag side with
  a fifth classifier (or extend an existing one) that inspects
  `src/engine/grammar/compile.ts`'s actual atom/effect catalog (e.g. via the
  `ATOM_TABLE`/effect-kind dispatch already used by `compile.ts`) rather than
  re-parsing oracle text a second time, so `cost:tap`/`mana:write`/etc. can be
  marked "covered" when the compiler genuinely has a matching leaf. This is a
  measurement-harness task, should probably route through the
  `accuracy-program` Phase A/B tracking rather than the CR ledger directly.
- Routing: **tooling fix**, not a leaf-compiler catalog entry. Judge should
  decide whether this displaces slice 1/2 above or runs in parallel — flagging
  as a candidate rather than pre-deciding, since it's a genuine "which track"
  choice (not CR-decidable, more of a program-management call, but bounded
  enough that I don't think it rises to STOP①; noting it for the judge's
  Tier-2-equivalent read here since I am acting as both drafter and judge this
  cycle).

## Not selected as candidates (with reason)

- Anything keyed purely on `cost:*`/`action:*`/`mana:*`/`tap-state:*`/
  `damage:*`/`life:*`/`counter:*`/`target:*`/`token:*` counts (Signets/Sol
  Ring/mana rocks, generic sacrifice/destroy/discard/search/shuffle/exile/
  return leaves, damage/life/counter writes) — per finding §0, these counts
  are not currently trustworthy; several sampled instances (mana rocks) are
  already known-shipped. Re-visit only after item 3 above lands, or after a
  manual spot-check confirms a genuine gap for a specific card pattern (as was
  done historically for `cr-122-counters`, `cr-614` shockland, etc.).
