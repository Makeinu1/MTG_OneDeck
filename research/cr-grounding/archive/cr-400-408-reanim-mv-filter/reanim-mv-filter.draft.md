# cr-400-408 reanimation mana-value-ceiling sub-leaf draft

Status: implementer-lane draft only. No `docs/`, `review.*`, `CLAUDE.md`,
`AGENTS.md`, ledger, or git changes are made by this draft. Promotion target:
an addendum to the existing `engine-spec` §34 reanimation/graveyard-return
leaf entry (the one that already documents the exact-match "Return target
creature card from your graveyard to the battlefield." form), not a new
top-level section — this slice is additive to that leaf, not a new substrate.

CR authority: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`.

## 1. Contract Summary

- The graveyard-return compile leaf (`src/engine/grammar/compile.ts`,
  `graveyardReturnFilterForRaw`, called from `guidedTargetPrompt` for
  `effect.atom === 'effect.return'`) is generalized from a single
  no-modifier exact-match phrase to two recognized phrase shapes, both still
  requiring exactly one `target`, a fixed-integer mana-value ceiling (when
  present), and `from your graveyard to the battlefield` as the closing
  clause with nothing after it:
  1. `Return target creature card from your graveyard to the battlefield.`
     (unchanged from before this slice — no `maxManaValue`).
  2. `Return target <creature|permanent> card with mana value N or less
     from your graveyard to the battlefield.` (N = fixed non-negative
     integer literal only).
- Grounding: CR 109.2a (a "card" noun phrase qualified by a zone name refers
  to cards in that zone — the basis for reading "creature card ... from your
  graveyard" and "permanent card ... from your graveyard" as a graveyard-zone
  target set); CR 202.3/202.3b (mana value is a non-negative integer
  characteristic; "mana value N or less" is a closed-form ceiling comparison
  against that integer — only meaningful for a literal N, not a variable);
  CR 701.14a (return moves the object to the zone named by the effect — here
  battlefield — with no additional replacement semantics beyond the normal
  zone-change rules already covered by the pre-existing exact-match leaf);
  CR 608.2b (target legality, including the source zone, is rechecked at
  resolution — unchanged from the pre-existing leaf; the ceiling is a static
  filter property evaluated at both selection time via `eligibleTargets` and
  implicitly at resolution via the existing zone/`objectIdOf` recheck, not a
  new resolution-time rule).

## 2. Existing Substrate This Draft Relies On

- `TargetFilter` (`src/engine/grammar/compile.ts`) already carries
  `types`, `zone`, `owner`, `controller`, `excludedTypes`, `excludeTokens`,
  `excludeSource`. This slice adds one additive optional field,
  `maxManaValue?: number`, with no change to any existing field's meaning.
  Grounding: CR 202.3/202.3b.
- `eligibleTargets` (`src/engine/commands.ts`) already has a
  `zone === 'graveyard'` branch that filtered strictly on
  `types.includes('creature')`. This slice extends that branch to also
  recognize `types.includes('permanent')` (CR 108.2: a permanent card is one
  whose card type could exist as a permanent — artifact, creature,
  enchantment, land, planeswalker; instant/sorcery excluded) and to apply
  `filter.maxManaValue` as an upper-bound exclusion when present.
  Grounding: CR 108.2, CR 202.3/202.3b.
- Mana value for a graveyard card is read via the existing
  `manaValueOfStackObject(card, face?.manaCost, def?.cmc)` helper already
  used by `objectSnapshotOf`/`objectSnapshotForCard`
  (`src/engine/commands.ts:562`,`586`,`614`). For a non-stack zone (which
  graveyard always is) this helper simply returns `def?.cmc`, so no new
  mana-value derivation logic was introduced — the same source of truth
  (`CardDef.cmc`) that already backs `ObjectSnapshot.manaValue` is reused.
  Grounding: CR 202.3/202.3b (mana value of a card not on the stack is its
  printed/characteristic value, i.e. `cmc`, with no announced-X
  contribution).
- `buildGuidedCommands` for `effect.return` already resolves to a plain
  `moveCard(cardId → battlefield, position: 'bottom')`; this slice makes no
  change to resolution — the ceiling is purely a selection-time filter.

## 3. IN / DEFER Boundary (this slice)

**Guided (auto-filter, still requires a human/guided target pick — this is
not full automation, just filter-assisted target selection):**

- `Return target creature card with mana value N or less from your
  graveyard to the battlefield.` → `filter: { types: ['creature'], zone:
  'graveyard', owner: 'you', maxManaValue: N }`.
- `Return target permanent card with mana value N or less from your
  graveyard to the battlefield.` → `filter: { types: ['permanent'], zone:
  'graveyard', owner: 'you', maxManaValue: N }`.
- Both forms compose with an arbitrary trigger/ETB preamble (`When this
  creature enters, ...`, `Whenever X deals combat damage, ...`, `At the
  beginning of your end step, ...`) because the compile leaf only pattern-
  matches the return clause itself (`effect.raw`, post trigger-span-split),
  identically to how the pre-existing exact-match leaf already tolerated
  trigger preambles (Karmic Guide).
- The unfiltered exact-match form (`Return target creature card from your
  graveyard to the battlefield.`, no mana-value clause) is unchanged and
  continues to compile without `maxManaValue` in its filter — this slice
  does not alter that non-regression pin.

**Manual (deliberately not generalized in this slice):**

- `up to one/up to X target ...` — optional/variable count target selection
  is out of scope; `graveyardReturnFilterForRaw` requires the literal
  `target` immediately after `return` with no `up to` prefix, and the
  pre-existing `isSingleTargetClause` guard already rejects `up to` clauses
  as a second line of defense.
- `Return all ... cards ...` — mass, non-single-target effects are out of
  scope; the leaf's regex requires the literal singular `target`, and mass
  return has no `target` keyword at all in typical printings.
- `... mana value X or less` (or any non-literal-integer descriptor) —
  variable X is out of scope; the ceiling regex requires `\d+`, so a bare
  `X` (or any other non-digit token) never matches and the clause falls
  through to the pre-existing generic single-target path, which itself
  rejects `target ... card` noun phrases (they need zone-scoped handling,
  not the generic battlefield/stack target path) and manual-izes.
- `Return this card from your graveyard to the battlefield.` — self-
  referential, no `target` keyword at all; falls through to manual by
  construction (no atom-specific rule needed).
- `... from an opponent's graveyard ...` — owner boundary; the leaf's regex
  requires the literal `from your graveyard`, so `from an opponent's
  graveyard` never matches and manual-izes.
- `you may return ...` (Sun Titan-style optionality wrapper) — **not**
  special-cased in the graveyard-return leaf itself. `EffectClause.optional`
  (set from `construct.may` detected over the whole ability text before
  clause-splitting, in `src/engine/grammar/ir.ts`) already gates the entire
  `guidedTargetPrompt` call one level up in `compileEffectClause`
  (`!effect.optional && GUIDED_TARGET_ATOMS.has(effect.atom)`), so a
  "you may" wrapper around either the exact-match or the new mana-value-
  ceiling form is manual for the same structural reason it already was for
  the exact-match form — no new optionality logic was added or needed.
- `tapped` / `under your control` / other post-clause modifiers — out of
  scope; the leaf's regexes anchor on `$` immediately after `to the
  battlefield`, so any trailing modifier text makes the match fail and the
  clause manual-izes (matches the pre-existing "under your control" pin).

## 4. Recognizer Unification (activation-time consistency, CR 602.2b)

- There are two entry points that must agree on which graveyard-return
  phrases are recognized: the compile-time guided decision
  (`graveyardReturnFilterForRaw` in `src/engine/grammar/compile.ts`, feeding
  `guidedTargetPrompt` for triggered/spell resolution) and the
  activation-time target-prompt construction
  (`targetFilterForActivationRaw` / `isSingleActivationTargetClause` in
  `src/engine/commands.ts`, feeding `activationTargetPromptsForSource`, which
  determines whether an activated ability offers its target *when activated*).
- **The two recognizers are now a single source of truth.**
  `graveyardReturnFilterForRaw` is `export`ed from `compile.ts` and imported
  by `commands.ts` (which already imports runtime values such as
  `buildGuidedCommands`/`compileAbilityIR` from that module, so no new import
  cycle is introduced). `commands.ts` no longer carries its own
  `isExactGraveyardCreatureReturn` copy — that duplicate was deleted, and both
  `targetFilterForActivationRaw` and `isSingleActivationTargetClause` now call
  the shared recognizer. This eliminates the desync class entirely rather than
  merely re-syncing two copies.
- Consequence: the mana-value-ceiling form is generalized **consistently for
  activated abilities too**, matching the pre-existing exact-match activated
  path (Priest of Fell Rites). An activated reanimation such as Order of
  Whiteclay (`{1}{W}{W}, {Q}: Return target creature card with mana value 3
  or less from your graveyard to the battlefield.`) now returns a non-empty
  `activationTargetPromptsForSource` result whose filter carries
  `maxManaValue: N`, so the target is chosen **at activation time** (CR
  602.2b) rather than silently committed with no target and implicitly
  prompted at resolution. An earlier draft of this slice wrongly claimed the
  activated path stayed manual/out-of-scope; that was inconsistent with actual
  behavior (resolve-time `guidedPlanForStackTop` does not distinguish
  activated from triggered and would have prompted anyway) and is corrected
  here — the activated path is a first-class part of the recognized set, not a
  deferred gap.
- Grounding: CR 602.2b (targets of an activated ability are chosen as the
  ability is put on the stack / activated); CR 601.2c (the analogous rule for
  spells) — both require the target set to be established at
  activation/cast time, not deferred to resolution.
- `types: ['permanent']` in `eligibleTargets`'s graveyard branch is resolved
  against a fixed CR 108.2 permanent-card-type list (`artifact`, `creature`,
  `enchantment`, `land`, `planeswalker`); `battle` cards are not included
  because no other part of this codebase currently models the `battle` card
  type (`TARGET_TYPES` in `compile.ts` also omits it) — adding `battle`
  support is left to whatever slice first introduces battle-card modeling.
- No new `GameCommand` or `GameState` field was introduced (engine-spec §34
  additive-only discipline); `maxManaValue` is a `TargetFilter`-only
  addition consumed entirely at selection time (`eligibleTargets`) and
  compile time (`graveyardReturnFilterForRaw`), with zero changes to
  `buildGuidedCommands`/resolution.

## 5. CR Grounding Matrix

| CR ref | Design use |
| --- | --- |
| CR 109.2a | "creature/permanent card" + "from your graveyard" denotes the set of cards in that zone; basis for the graveyard-scoped `TargetFilter`. |
| CR 202.3 | Mana value is a characteristic of an object; "with mana value N or less" is a closed-form ceiling test against that characteristic. |
| CR 202.3b | Mana value of a card not on the stack (e.g. in the graveyard) is derived from its printed/characteristic mana cost — matches reusing `def.cmc` via `manaValueOfStackObject`. |
| CR 608.2b | Target legality (including zone) is rechecked at resolution; unchanged by this slice, already covered by the pre-existing exact-match leaf's resolution path. |
| CR 701.14a | "Return" as a move to the named zone; no new semantics introduced for the mana-value-ceiling variant beyond the pre-existing return leaf. |
| CR 108.2 | Defines "permanent card" as a card whose type(s) permit it to exist as a permanent; basis for the `GRAVEYARD_PERMANENT_CARD_TYPES` list used by the new `types.includes('permanent')` branch in `eligibleTargets`. |

## 6. Golden / Review Pin Status

`src/engine/__tests__/review.cr400-408-return.test.ts` (judge-owned, not
edited by this slice) already carries the batch6 `describe` block pinning:
guided decision + `maxManaValue` filter shape for both creature and
permanent forms; MV-ceiling eligibility (MV=N included, MV=N+1 excluded)
plus resolution to battlefield; the six DEFER variants (up-to, all,
variable-X, self-ref, opponent's graveyard, you-may) all manual; and
non-regression of the unfiltered exact-match form with no `maxManaValue`
leaking in. All ten assertions in that file pass against this
implementation as of this draft.
