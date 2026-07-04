# cr-118-costs Step 1 draft

Status: implementer draft for judge re-ownership. No code/spec/review file changes.

CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` fixed to 2026-06-19.

## Measurement

Inputs:

- `research/mydeck-scoring/summary.md`: top missing demands include `cost:activation` 232, `cost:tap` 201, `cost:nonmana` 58.
- `research/mydeck-scoring/gaps.json`: filtered rows with `shape === "activated"` and at least one of `cost:activation` / `cost:tap` / `cost:nonmana`.
- `src/engine/grammar/compile.ts`: current `compileAbilityCost` auto catalog is non-`{X}` mana, `{T}` self tap, and self sacrifice to graveyard.

Measured target set:

- MyDeck activated cost-demand rows: 232.
- Current §33 cost compiler result on those rows: 196 cost-auto rows, 36 cost-manual rows.
- If only fixed `Pay N life` and self-exile are added, strict scope resolves 17 of those 36 cost-manual rows, leaving 19 cost-manual rows.
- Full corpus read-only measurement through existing parser/compiler: 17,491 mapped cards, 5,103 activated rows, 1,385 current cost-manual rows.
- Full corpus strict contribution from the two proposed idioms: 168 / 5,103 activated rows, or +3.29 percentage points to cost activation frontier. A broader ability/flavor-word label normalization could raise an upper bound to 325 rows, but that is outside this draft's promotion contract.

The table counts unmodeled cost fragments in currently cost-manual rows. A row with multiple unmodeled cost fragments can contribute to multiple idiom counts.

| unmodeled cost idiom | MyDeck count | corpus count / 5,103 activated rows | classification | CR grounding | gaps.json evidence |
|---|---:|---:|---|---|---|
| `Pay N life`, fixed `N` | 16 | 99 (1.94%) | auto promote | Costs are paid by carrying out instructions (CR 118.1); paying life subtracts the amount (CR 118.3b, 119.4). `X` is excluded because X is chosen/announced (CR 107.3a, 118.4). | Priest of Fell Rites: "{T}, Pay 3 life, Sacrifice this creature: ..."; Flooded Strand / fetchlands: "{T}, Pay 1 life, Sacrifice this land: ..."; Fiery Islet: "{T}, Pay 1 life: Add {U} or {R}." |
| `Exile this/it/~/<card name>` self-exile | 1 | 102 observed (2.00%); 84 without leading label normalization | auto promote for strict self-reference | Activated cost is before the colon and must be paid by the activator (CR 602.1, 602.1a); activation follows cost payment steps (CR 602.2b, 601.2f, 601.2h); exile moves an object to exile (CR 701.13a, 406.2); a cost moving an object to a public zone can be found by the ability's effect (CR 400.7j). | Plaza of Heroes: "{3}, {T}, Exile this land: Target legendary creature gains hexproof and indestructible until end of turn." |
| Sacrifice chosen non-self permanent(s) | 7 | 404 (7.92%) | guided/defer | Sacrifice moves a permanent its controller controls to owner's graveyard (CR 701.21a); the choice of which non-self permanent is a payment choice, not self-deterministic. Each payment applies to one spell/ability (CR 118.10). | Chthonian Nightmare: "Pay X {E}, Sacrifice a creature, Return this enchantment ..."; Ipnu Rivulet: "{1}{U}, {T}, Sacrifice a Desert: ..."; Radiant Lotus: "{T}, Sacrifice one or more artifacts: ..." |
| `X` in activation cost / `Pay X` | 4 | 98 (1.92%) | manual | X in an activation cost is chosen and announced as part of activation (CR 107.3a); costs can include X (CR 118.4). This requires a value prompt and downstream X binding, so it is not §33 auto. | Chthonian Nightmare: "Pay X {E}, ..."; Gogo, Master of Mimicry: "{X}{X}, {T}: ..."; Pernicious Deed: "{X}, Sacrifice this enchantment: ..." |
| Ability/flavor word label before otherwise modeled cost | 2 | 139 (2.72%) | manual/defer | Ability words and flavor words have no special rules meaning (CR 207.2c, 207.2d), but text after the colon can contain activation instructions or cost modifiers (CR 602.1b). Broad label normalization is a separate contract, not this slice. | Daily Bugle Building: "Smear Campaign -- {1}, {T}: ..."; Shifting Woodland: "Delirium -- {2}{G}{G}: ... Activate only if ..." |
| `Return this ... to its owner's hand` | 2 | 3 (0.06%) | manual carry | It is a deterministic self zone move in isolation, but MyDeck occurrences are only in a compound cost with `Pay X` and a chosen sacrifice. Zone-change identity is governed by CR 400.7; cost payment by CR 118.1 / 601.2h. | Chthonian Nightmare: "Pay X {E}, Sacrifice a creature, Return this enchantment to its owner's hand: ..." |
| `Collect evidence N` | 1 | 6 (0.12%) | guided/defer | Collect evidence N means exiling any number of graveyard cards with total mana value N or greater (CR 701.59a); the player chooses cards, and inability constrains choice (CR 701.59b). | Forensic Researcher: "{T}, Collect evidence 3: Tap target creature you don't control." |
| `Discard a card` | 1 | 86 (1.69%) | guided/defer | Discard moves a card from hand to graveyard (CR 701.9a); by default the affected player chooses which card (CR 701.9b). | Chainer, Nightmare Adept: "Discard a card: You may cast a creature spell from your graveyard this turn." |
| `Discard this card` from hand / channel-like | 1 | 46 (0.90%) | manual/defer | Discard is CR 701.9a, but source-zone activation, ability-word label, and possible cost reduction text after the colon need a separate activation-source/cost-modifier contract (CR 602.1b). | Otawara, Soaring City: "Channel -- {3}{U}, Discard this card: ... This ability costs {1} less ..." |
| `Exert this permanent` | 1 | 1 (0.02%) | manual/defer | Exert means choosing that the permanent will not untap during the next untap step (CR 701.43a); non-battlefield objects cannot be exerted (CR 701.43c). No existing cost command represents exerted-until-untap-step state. | Arena of Glory: "{R}, {T}, Exert this land: Add {R}{R}." |
| `Exile seven cards from your graveyard` | 1 | 1 (0.02%) | guided/defer | Exile is CR 701.13a / 406.2, but which seven graveyard cards are exiled is a player choice. | Sunken Palace: "{1}{U}, {T}, Exile seven cards from your graveyard: Add {U}." |
| `Mill a card` | 1 | 3 (0.06%) | auto-defer, not promoted | Mill moves top library cards to graveyard (CR 701.17a), and a player cannot pay a mill cost greater than library size (CR 701.17b). It is deterministic but low demand and outside the primary two-idiom slice. | The Warring Triad: "{T}, Mill a card: Target player adds one mana of any color." |
| Sacrifice self plus another chosen object | 1 | 2 (0.04%) | manual/defer | The self part is deterministic, but the other object is chosen. Sacrifice is CR 701.21a; partial payments are not allowed (CR 601.2h). | Mount Doom: "{5}{B}{R}, {T}, Sacrifice Mount Doom and a legendary artifact: ..." |
| Tap an untapped chosen permanent you control | 1 | 33 (0.65%) | guided/defer | Tap symbol self-tap is already modeled (CR 107.5). Tapping another chosen permanent is a separate object choice; tapping itself is CR 701.26a. | Relic of Legends: "Tap an untapped legendary creature you control: Add one mana of any color." |

Conclusion: the judge hypothesis is supported. `Pay N life` is the only high MyDeck-demand deterministic unmodeled cost idiom (16/232). Self-exile is low MyDeck count (1/232) but corpus-significant and is the same deterministic self-zone-move shape as existing self-sacrifice. Other high corpus buckets require choosing non-self objects, X/value binding, source-zone contracts, or new state.

## §33 catalog supplement draft

Scope: `compileAbilityCost` only. Do not reopen §34.19 activation envelope or §34.11 mana catalog. Do not add a new `GameCommand` type. Keep the function pure, deterministic, and GameState-independent.

### Fixed pay life

Recognition:

- After splitting `cost.raw` by comma, treat an element as fixed pay-life iff it matches:
  - `^Pay\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+life$`
- Normalize `a` / `an` / `one` to 1, number words through ten to their values, and decimal digits with `Number.parseInt`.
- Exclude `Pay X life`, any text containing `{X}` or standalone `X`, and any element with extra choices or conditions.
- Remove recognized fixed pay-life elements from the residual text before the `[A-Za-z]` unmodeled-cost check.

Command mapping:

- For each recognized fixed pay-life element, append `{ type: 'adjustLife', delta: -amount }`.
- Stable suggested command order for composite costs: existing `setTapped` first, fixed pay-life commands next in cost-element order, then existing self-zone move commands. CR 601.2h allows most cost payments in any order; the engine should choose a deterministic order.
- `manaCost` remains the non-`{T}` mana symbol string as today.

Grounding:

- Paying a cost means carrying out the cost instructions (CR 118.1).
- Paying life subtracts the indicated amount from the payer's life total (CR 118.3b, 119.4). `adjustLife -N` is the existing command shape for life total decrease.
- `Pay X life` remains manual because X is chosen during activation (CR 107.3a, 118.4).

### Self-exile cost

Recognition:

- After splitting `cost.raw` by comma, treat an element as self-exile iff the object phrase is strict self-reference:
  - `Exile it`
  - `Exile ~`
  - `Exile this <type words>`
  - `Exile this card from your graveyard`
  - `Exile <exact card name>` using the same split-face name alternatives as self-sacrifice.
- Reject if the object phrase contains `and`, `another`, `or`, `other`, `target`, `you control`, a leading number, or a leading non-self determiner such as `a`, `an`, `one`, `two`, etc.
- Reject fixed-count or chosen-card phrases such as `Exile seven cards from your graveyard`, `Exile a card from your graveyard`, and all target/other-object forms.
- Remove recognized self-exile elements from residual text before the `[A-Za-z]` unmodeled-cost check.
- Do not make broad ability/flavor-word label stripping part of this contract. Label-prefixed self-exile rows are measured corpus opportunity, but CR 207.2c/207.2d normalization should be a separate judge-owned decision if desired.

Command mapping:

- If self-exile is recognized, append:
  - `{ type: 'moveCard', cardId: ctx.sourceId, to: 'exile', position: 'top' }`
- This mirrors existing self-sacrifice's `moveCard` to `graveyard`; only the destination zone differs.

Grounding:

- An activated ability's activation cost is before the colon and must be paid by the activating player (CR 602.1, 602.1a).
- Activating an ability follows the spell cost-payment steps, including cost determination and payment (CR 602.2b, 601.2f, 601.2h).
- To exile an object is to move it to the exile zone (CR 701.13a; see also CR 406.2).
- If a cost moves an object to a public zone, the ability's effects can find that object (CR 400.7j).

### Non-promoted fragments

Keep these as guided/manual in this slice:

- `Pay X ...`, `{X}`, `{X}{X}`: manual; requires value prompt and X binding (CR 107.3a, 118.4).
- Other-object sacrifice/exile/discard/tap: guided/defer; requires object/card choice (CR 701.21a, 701.13a, 701.9b, 701.26a).
- `Collect evidence N`: guided/defer; chooses any number of graveyard cards by mana value total (CR 701.59a-b).
- `Exert this ...`: manual; no existing exerted-until-next-untap state/command (CR 701.43a-c).
- `Mill a card`: deterministic but low demand; defer to a separate low-priority cost-mill slice (CR 701.17a-b).
- Ability/flavor-word label normalization and activation instructions such as `Activate only if/as ...`: defer; grounded by CR 207.2c/207.2d and CR 602.1b.

## Reviewer-owned test expectation draft

Do not edit `review.*` from implementer seat. These are expected-value notes for the judge to author.

### `review.grammar-cost`

Pin candidates:

- `"{T}, Pay 3 life: Draw a card."`
  - decision `auto`
  - commands include `setTapped` self and `{ type: 'adjustLife', delta: -3 }`
  - `manaCost === null`, `reasons === []`
- `"Pay 50 life: This artifact deals 50 damage to any target."`
  - decision `auto`
  - commands exactly `[{ type: 'adjustLife', delta: -50 }]`
- `"{3}, {T}, Exile this land: Target legendary creature gains hexproof and indestructible until end of turn."`
  - decision `auto`
  - commands include `setTapped` self and `{ type: 'moveCard', cardId: 'c1', to: 'exile', position: 'top' }`
  - `manaCost === "{3}"`
- `"{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield."`
  - decision `auto`
  - commands deterministic suggested order: `setTapped`, `adjustLife -3`, `moveCard to graveyard`
- `"Pay X life: Draw a card."`
  - decision `manual`
  - reasons contain `variable-x` or an equivalent manual reason; commands empty
- `"{T}, Exile another creature you control: Draw a card."`
  - decision `manual`; commands empty
- `"{1}{U}, {T}, Exile seven cards from your graveyard: Add {U}."`
  - decision not `auto`; chosen graveyard cards remain guided/manual
- Existing manual pins stay manual: `Discard a card`, `Sacrifice another creature`, ability/flavor-word label without a separate label-normalization contract.
- Update any helper that asserts known cost commands so `adjustLife` and `moveCard -> exile` are accepted cost commands.

### `review.g4-activate`

Golden candidates:

- Sol Ring, `"{T}: Add {C}{C}."`
  - existing baseline should remain green: source taps, mana is added immediately, stack count unchanged for mana ability.
- Mother of Runes, `"{T}: Target creature you control gains protection from the color of your choice until end of turn."`
  - cost side remains auto: source taps.
  - target/color choice or protection modeling is not part of this cost slice; the test should not claim those are newly auto unless separately modeled.
- Priest of Fell Rites, `"{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. Activate only as a sorcery."`
  - activation plan cost commands include source tap, controller life -3, source moved to graveyard.
  - ability can still require guided/manual target/effect handling; the golden's purpose is that fixed life payment no longer makes the cost manual.
- Plaza of Heroes, `"{3}, {T}, Exile this land: Target legendary creature gains hexproof and indestructible until end of turn."`
  - with sufficient mana, activation plan includes mana payment/autotap as today, source tap, and source moved to exile.
  - target/effect handling remains outside this cost-slice assertion.

## Scope boundary and defer

- No code is written in this Step 1 draft.
- Do not edit `docs/`, `review.*`, `CLAUDE.md`, `AGENTS.md`, `eslint.config.js`, or `CACHE_SCHEMA_VERSION`.
- Do not reopen §34.19 activation envelope or §34.11 mana catalog.
- Do not add GameState fields or GameCommand variants.
- Do not promote convoke, delve, X, counter removal/addition, discard choice, other-object sacrifice/exile/tap, `Collect evidence`, `Activate only as a sorcery`, `Activate only if ...`, cost reductions, or source-zone keyword/ability-word families in this slice.
- `Mill a card` is deterministic and has existing `mill` command support, but measured demand is MyDeck 1 / corpus 3; carry as a low-priority separate slice rather than expanding this one.
