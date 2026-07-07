# score.ts demand-instrument repair spec (draft)

Status: **judge-authored spec draft (J2 Opus, 2026-07-07)**. Implementation is
deferred to Codex on quota return (~2026-07-11), then independent Tier-1, then
promotion. This file defines the contract; it is not itself the implementation.

Authority for "what the compiler covers" = the runtime compiler
(`src/engine/grammar/compile.ts` + `ir.ts`), NOT a re-implementation. The whole
point of the repair is to stop maintaining a parallel text-classifier that can
drift from (and here, contradicts) the real engine.

## 1. The defect (confirmed by source read, not inference)

`scripts/mydeck-scoring/score.ts` scores each clause by comparing a `demand`
list against a `modelTags` list. `modelTags` is produced by exactly four text
classifiers: `classifyEventsForLine` (`event:*`), `classifyContinuousLayers`
(`layer:*`, `cda`), `classifyTimingForLine` (`timing:*`, `cast-timing:*`),
`classifyZonesForLine` (`zone:*`, `zone-cross`, `ownership:*`, `player-scope:*`).
`compareDemands` (score.ts ~L705) marks a demand "covered" iff
`modelTagSet.has(demand.id)`.

None of the four classifiers ever emit a tag in the families `cost:*`,
`mana:*`, `action:*`, `tap-state:*`, `damage:*`, `life:*`, `counter:*`,
`target:*`, `token:*`. Therefore `categoryForDemand` routes every such demand to
a gap bucket (`catalog未写` or default `substrate不足`) **unconditionally** —
regardless of whether `compile.ts` fully handles the clause.

Confirmed false positive: Sol Ring / all Signets / all Talismans
(`{T}: Add {C}...`) are reported as `substrate不足` for
`cost:activation`/`cost:tap`/`mana:write`, yet `compile.ts`
(`literalManaCommands`, `guidedManaPrompt`, `compileManaEffect`,
`compileAbilityCost`) fully compiles this pattern and the domain
`cr-605-mana-abilities` is `shipped`. The measured demand numbers for these nine
families (which include the entire top-of-list: `cost:activation` 232,
`cost:tap` 201, `mana:write` 150, `tap-state:write` 108, `target:object-or-player`
97, `action:sacrifice` 74, `action:draw` 65 ...) therefore measure the tool's
blind spot, not a real backlog.

## 2. The fix: compile the clause through the real engine

score.ts already imports from the engine (`splitAbilityLines`,
`mapScryfallCardToCardDef`). Extend its model side to run the actual runtime
compile path for each ability line, mirroring `gameStore.ts` L1329-1338:

```
const ir = parseAbilityIR(line.text, typeLine);           // engine/grammar/ir
const compiled = compileAbilityIR(ir, ctx);               // engine/grammar/compile
const cost = compileAbilityCost(ir.cost ?? null, ctx);    // for activation costs
```

`ctx` (`CompileContext`) needs only the fields the compiler reads (commander
color identity may be passed empty / from the card; document whatever minimal
ctx the compiler requires — do not invent game state). Inspect the resulting
`CompiledEffect` (`.decision: 'auto'|'guided'|'manual'`, `.commands[]`,
`.prompts[]`) and `CompiledCost` (`.decision: 'auto'|'manual'`, its components)
to derive an **engine-coverage tag set**, then union it into `modelTags`.

**Coverage semantics (sandbox-philosophy-aligned):** a demand family counts as
**covered** if the compiler yields a `command` OR a `guided` prompt for it —
`auto` and `guided` both mean "the app performs it (possibly after one click)".
Only `manual` / no-command / no-prompt for that family = genuinely **missing**.
(`guided` must NOT be scored as a gap — that is the project's honest-choice UX,
not an absence.)

## 3. Per-family coverage mapping (demand id → engine signal)

Derive coverage tags from concrete compiler outputs. Anchor points already exist
as explicit sets in `compile.ts` — use the compiler's real output, not these
sets as a shortcut, but they document intent:

| demand id | covered when the compiler produces… |
|---|---|
| `mana:write` | a command `{type:'addMana'}` (literal or guided mana) |
| `cost:tap` | `compileAbilityCost` recognizes a tap cost component (`{T}`) |
| `cost:activation` | `compileAbilityCost.decision !== 'manual'` for an activated ability (the cost was modeled) |
| `cost:nonmana` | a recognized non-mana cost component (sacrifice/tap/pay-life) in the compiled cost |
| `action:draw` | command `{type:'draw'}` (atom `effect.draw`) |
| `action:mill` | command `{type:'mill'}` (atom `effect.mill`) |
| `action:sacrifice` | `effect.sacrifice` producing a command/guided target prompt |
| `action:destroy` | `effect.destroy` command/guided prompt |
| `action:exile` | `effect.exile` command/guided prompt |
| `action:return` | `effect.return` command/guided prompt |
| `action:discard` | `effect.discard` guided prompt (choice) |
| `action:search` | `effect.search` command/guided prompt |
| `token:create` | command `{type:'createToken'|'createDefinedToken'}` |
| `counter:write` | `effect.counter-plus` / `adjustCounter` command |
| `damage:write` | `effect.damage` → `dealDamage`/`markDamage` command |
| `life:write` | command `{type:'adjustLife'}` (`effect.gain-life`/`lose-life`) |
| `tap-state:write` | `effect.tap`/`effect.untap` → `setTapped` command |
| `target:object-or-player` | a `prompt` of target kind, or an atom in `TARGET_REQUIRED_ATOMS` that produced a guided target prompt |

**Keep the four text classifiers unchanged for the families they genuinely own**
(`event:*`, `zone:*`, `layer:*`, `timing:*`, `cast-timing:*`, `ownership:*`,
`player-scope:*`, `cda`, `zone-cross`). Those are not broken. The repair *adds*
an engine-coverage source for the nine broken families; it does not remove the
classifier sources.

## 4. Anti-over-correction guard (do not go blind the other way)

The fix must not flip every clause to "covered." Acceptance requires that
genuinely-unimplemented patterns STILL score as gaps. The independent audit
(`research/cr-grounding/demand-instrument-audit.draft.md`, Sonnet, 2026-07-07)
supplies the genuinely-missing capability clusters (see §8); the fix's acceptance
test must assert a representative genuine gap from EACH cluster still reports
missing, AND that Sol Ring / a Signet / a Talisman no longer report a
`mana:write`/`cost:tap` gap. Calibration target from the audit: of the ~510
`catalog未写`/`substrate不足` rows, only **~150-220 (30-45%)** are genuine unmet
capability — the corrected `summary.md` should land near that, not near ~98%.

## 5. Parity / freeze-condition note

Because the tool now calls the real compiler, the classifier-parity freeze
condition (engine-spec §34.7.1: "研究計測器と runtime 分類器は黙って乖離しては
ならない") is satisfied structurally for these families — there is no parallel
implementation left to drift. Document this in the parity section when the fix
lands.

## 6. Acceptance (implementer must show all green)

1. `npx tsx scripts/mydeck-scoring/score.ts` re-runs clean.
2. Sol Ring, ≥1 Signet, ≥1 Talisman: no longer flagged as
   `mana:write`/`cost:tap`/`cost:activation` gaps.
3. A representative genuine gap (from the audit list) STILL flagged.
4. `summary.md`'s `catalog未写`/`substrate不足` counts drop materially (the
   audit estimates the true genuine-gap size; the corrected number should land
   near it, not near the old 331+179).
5. 4-check set green (the tool is under `scripts/`, but adding engine imports can
   affect lint/tsc — run all four).

## 7. Interim standing rule (effective NOW, until the fix lands)

Until this repair is shipped, **plannedSequence replenishment (judge-protocol
§2 step ②) uses demand signal ONLY from classifier-backed families**
(`event:*`, `zone:*`, `layer:*`, `timing:*`). Demand counts in the nine broken
families are treated as **"unknown — requires manual compile.ts spot-check"**,
NOT as high-priority signal. (This is exactly how batch4 was filled this
session: cr-702 and cr-121 were chosen from `event:draw`/`zone:library` + ledger
`nextGate`, explicitly discarding the `cost:*`/`action:*` axis.)

## 8. Take-stock: the real frontier (from the 2026-07-07 audit)

The audit's key correction: the raw demand axis is NOT uniformly noise. The
top-3 by count (`cost:activation` 232, `cost:tap` 201, `mana:write` 150) are
~90% false positive (single-target/self mana-rock/activated costs the compiler
already handles). But the *effect* families are mostly GENUINE gaps once traced,
and they cluster into **5 coherent capability dimensions** — these become the
post-repair batch5 prioritization candidates (each cuts across many cards):

1. **Cross-player effect variants** (largest cluster): "each player / each
   opponent / that player" sacrifice/discard/draw/damage/life-loss.
   `compile.ts`'s `hasSupportedPlayerSubject` and sacrifice/discard guards accept
   only "you"-subject. CR anchors: 608.2 effect resolution, per-effect player
   references. (Note: dovetails with `cr-102-players` per-opponent work.)
2. **Variable / dynamic counts**: "any number", "that many", "X where X = …",
   "for each …". `resolveCount` recognizes only `one`/`fixed`. Hits
   draw/discard/life/damage/token counts alike. CR anchor: 608.2h (X in
   resolution).
3. **Return/exile/token state-modifier riders**: "return … to the battlefield
   tapped [and attacking]", tapped predefined tokens. No path threads a
   tap-state side effect onto return/exile/token commands. (Overlaps the shipped
   `cr-110` tapped-status leaf — extend, don't rebuild.)
4. **Mass / board-wide untargeted effects**: "destroy all/each", "return all",
   "each creature gets/deals". `TARGET_REQUIRED_ATOMS` routes these to
   `needs-target` manual even when nothing is targeted. CR anchor: 609
   (one-shot effects on a defined set).
5. **Non-P/T counters & non-"target" counter placement**: `counterDescriptorForRaw`
   knows only ±1/+1; guided counter-plus needs the literal word "target", so
   idiomatic "put a counter on it / [name]" is unhandled. CR anchor: 122 counters
   (already a shipped domain — this is a leaf extension).

These 5 are demand-first justified (they aggregate the genuine effect-family
gaps) AND product-value visible (a MyDeck player directly feels "each opponent
sacrifices" or "draw that many"). After the meter repair confirms the counts,
fill batch5 from these in cluster-size order (cluster 1 largest).
