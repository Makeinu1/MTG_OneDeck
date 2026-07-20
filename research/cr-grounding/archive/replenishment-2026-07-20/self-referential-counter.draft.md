# self-referential +1/+1 counter leaf draft (cr-122-counters candidate-4)

Status: IMPLEMENTATION DRAFT (implementer lane, `research/cr-grounding/*.draft.md`). Judge-owned
`docs/engine-spec.md` / `docs/acceptance.md` / `review.*` are unchanged by this file; the judge
reviews and reflects into those documents after independent verification. Scoping source:
`research/cr-grounding/planned-sequence-batch5.draft.md` 候補4(§49-57). This revision incorporates
the Tier-1 corpus finding (11 false-autos) and the deny-list → allow-list correction.

## One-line conclusion

Narrow, exact-shape self-reference leaf for `effect.counter-plus`: "put a/an/<N> +1/+1 counter(s)
on it" (no `target`, no residual text after "it") compiles `decision:'auto'` and emits the existing
`{type:'addCounters', cardId: ctx.sourceId, counterType:'+1/+1', delta:n}` command — no player
choice, no target prompt, no new `GameCommand`/`GameState` — **but only when "it" provably binds to
the ability's own source** (CR 608.2 pronoun antecedent). Binding is decided by an **allow-list
(fail-closed)**, not a deny-list: auto only if the binding subject is a `this <permanent-type>`
demonstrative or the card's own name at the trigger/clause subject head; every other subject
(indefinite "a/an/another <X> you control", "a permanent", another named object, no antecedent)
stays manual.

## Why the first (deny-list) cut was wrong — Tier-1 corpus finding

The initial implementation gated on a *deny-list*: "if no preceding clause matches
target/create/onto-battlefield/equipped/enchanted, self-apply." That is **fail-open** — it self-buffs
the source for any trigger subject the deny-list doesn't happen to enumerate. Independent Tier-1
measurement over the 17,491-card 2026-06-19 snapshot found **11 false-autos** where "it" binds to an
indefinite subject, not the source (CR 608.2):

| Card | Type | Trigger subject "it" actually binds to |
|---|---|---|
| Black Panther, Claws of Bast | Creature | "a creature you control" (attacks alone) |
| Case of the Pilfered Proof | **Enchantment** (not a creature) | "a Detective you control" |
| Growing Dread | Enchantment | "a permanent" (you turn face up) |
| Keleth, Sunmane Familiar | Creature | "a commander you control" |
| Miriam, Herd Whisperer | Creature | "a Mount or Vehicle you control" |
| Norn's Inquisitor | Creature | "a permanent you control" (transforms) |
| Rakish Heir | Creature | "a Vampire you control" |
| Rite of Passage | Enchantment | "a creature you control" (is dealt damage) |
| Securitron Squadron | Creature | "a creature token you control" |
| Stensia Masquerade | Enchantment | "a Vampire you control" |
| White Widow, Yelena Belova | Creature | "a creature you control with deathtouch" |

Each wrongly emitted `addCounters` on the source (誤自動化, violating the ≈0 mandate). Several sources
are Enchantments that are not even creatures, so a "+1/+1 counter on the source" is doubly wrong.

## The fix — deny-list → allow-list (fail-closed)

Auto now requires **positive** confirmation that "it" binds to the source. `compileEffect` emits the
self-counter only when all of:

1. `selfReferentialCounterPlusDescriptor(effect.raw)` matches the exact shape (unchanged from v1), AND
2. `counterItAntecedentIsSource(precedingRaws, ctx.def)` is true, AND
3. no preceding clause trips the retained `clauseSuggestsNonSelfCounterReferent` deny-list (kept as a
   secondary safety net behind the allow-list).

`counterItAntecedentIsSource` takes the **immediately preceding clause** (the most-recent CR 608.2
antecedent), strips a leading activated/keyword cost prefix (`^[^:]*:\s*`, so
"Exhaust — {3}: This Vehicle becomes ..." → "This Vehicle becomes ...") and a leading trigger word
(`whenever|when|at`), then returns true iff the remaining subject head is either:

- a **self-demonstrative**: `^this (creature|permanent|vehicle|artifact|enchantment|land|planeswalker|token|equipment|aura|saga|battle|card)\b`, or
- the **card's own name**: any `selfNameSubjectForms(ctx.def.name)` (each `//` face plus its short
  pre-comma form — MTG oracle self-references use the short name, e.g. "Alesha, Who Laughs at Fate" →
  "Whenever **Alesha** attacks ...") appearing at the subject head (`^name\b`).

If an intervening non-subject clause sits between the source-naming clause and the counter clause,
the binding lookup (last clause only) conservatively yields manual — missing a legitimate auto is
acceptable; a wrong auto is not.

## CR grounding

- **CR 122.1 / 122.1a**: a `+1/+1` counter is a specific, signed counter kind placed on one object;
  the sign is part of its identity (a `-1/-1` counter is a different kind). Gated on the literal
  `+1/+1` string throughout, so a `-1/-1` self-ref can never fabricate a `+1/+1` command (precedent:
  `docs/engine-spec.md` §34.30, the earlier hardcoded-`+1/+1` bug).
- **CR 608.2**: as an effect resolves, a pronoun ("it") refers to the object the effect most recently
  identified. For a triggered ability that object is the trigger's subject; for the Vehicle template
  it is the "This Vehicle" of the preceding "becomes" clause. The allow-list is the mechanical
  realization of this antecedent rule (template recognition, deliberately conservative).

## Command / abstraction footprint

No new `GameCommand` variant, no new `GameState` field, no new `PromptKind`. The only structural
addition is `AbilityIR.effectClauses: string[]` (the full split-clause list independent of atom
matching, needed because a subject-introducing clause like "Target land ... becomes a 0/0 creature"
matches no effect atom and is otherwise invisible in `ir.effects`). Existing `{type:'addCounters',
cardId, counterType, delta}` reused verbatim.

## Boundary / scope (stays manual)

Indefinite/other trigger subjects (all 11 above); Aang-type preceding-target and Additive-Evolution-
type preceding-creation antecedents; reanimation ("onto the battlefield") antecedents;
equipped/enchanted-relative "it"; `-1/-1` and any non-`+1/+1` counter; variable/`for each`/"that
many"/X counts; any compound clause with trailing text after "on it"; self-*name* reference in the
counter clause itself ("...on Bloodmad Vampire" instead of "...on it" — out of the brief's "it"-only
scope); proliferate / counter caps (CR 122.4) / distribute-to-multiple — all untouched.

## Corpus flip re-measurement (17,491-card 2026-06-19 snapshot)

Direct enumeration of every ability that compiles `decision:'auto'` with an `addCounters` on the
source with `counterType:'+1/+1'` (the only path this leaf produces):

| | Before fix (deny-list) | After fix (allow-list) |
|---|---|---|
| Total auto self-`+1/+1` emissions | 30 | **19** |
| Legitimate (source-bound "it") | 19 | **19** (all retained) |
| **False-auto (indefinite/other subject)** | **11** | **0** |

The 19 retained legitimate autos: "this creature" template (Bloodmad Vampire, District Mascot,
Falkenrath Exterminator, Falkenrath Marauders, Guild Thief, Herald of War, Hexgold Slith, Hidetsugu
Consumes All, Markov Blademaster, Predator Ooze, Stromkirk Noble); card-name subject (Alesha, Basim
Ibn Ishaq, Ezio, Skullbriar); "This Vehicle becomes ..." after a cost prefix (Invasion Submersible,
Marshals' Pathcruiser, Rangers' Refueler, Rocketeer Boostbuggy). All 11 false-autos are now manual.

## Probe evidence (direct runtime, `npx tsx`, explicit index paths)

Positive → `auto`, one `addCounters` on source, no prompt:
- `Whenever this creature attacks, put a +1/+1 counter on it.` (delta 1)
- `Whenever Skullbriar deals combat damage to a player, put a +1/+1 counter on it.` (def.name
  "Skullbriar, the Walking Grave" → short-name match, delta 1)
- `Exhaust — {3}: This Vehicle becomes an artifact creature. Put a +1/+1 counter on it.` (delta 1)

Negative (new) → not auto, zero self-`addCounters`:
- `Whenever a creature you control attacks, put a +1/+1 counter on it.` (Black Panther)
- `Whenever another creature you control attacks, put a +1/+1 counter on it.`
- `Whenever a Detective you control enters, put a +1/+1 counter on it.` (Enchantment source)
- `Whenever you turn a permanent face up, put a +1/+1 counter on it.` (Growing Dread, Enchantment)
- `Whenever a commander you control attacks, put a +1/+1 counter on it.` (Keleth)
- bare `Put a +1/+1 counter on it.` (no antecedent)

Existing negatives retained: Aang preceding-target, Additive-Evolution preceding-creation (both `.`-
and `then`-joined), reanimation "onto the battlefield", equipped/enchanted-relative, `-1/-1`,
`for each`, trailing-qualifier compound. Regression: `Put a +1/+1 counter on target creature.` stays
`guided` via the pre-existing target leaf.

## Testing

- Reviewer-owned adversarial suite `src/engine/__tests__/review.cr122-self-referential-counter.test.ts`
  (not authored/modified by implementer; it was corrected externally to add indefinite-subject HIGH
  pins and a return-type fix): passing against this implementation.
- Implementer-owned `src/engine/grammar/__tests__/selfReferentialCounter.test.ts` (extended this
  revision): positive (this-creature ×4 shapes, card-name subject, Vehicle-cost-prefix), indefinite-
  subject negatives (a/another creature you control, Detective/Enchantment source, permanent-face-up/
  Enchantment source, commander, no-antecedent), plus the prior antecedent/shape-boundary negatives.
- Full suite `npx vitest run`: 187 files / 1627 tests, all passing.

## Machine 4-point (each run individually)

- `npm run lint` → clean.
- `npx tsc --noEmit` → clean (note: the root-tsconfig `files:[]` gotcha means this doesn't fully
  typecheck; the authoritative type gate is `npm run build`'s `tsc -b`).
- `npx vitest run` → 1627 passing.
- `npm run build` (`tsc -b && vite build`) → clean build (the earlier `review.*` type error was fixed
  externally in the reviewer file); `dist/` removed after confirmation.
