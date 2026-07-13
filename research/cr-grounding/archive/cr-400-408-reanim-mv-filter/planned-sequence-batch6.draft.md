# Planned Sequence Batch 6 — Coverage-Based Candidate Selection

**Generated**: 2026-07-14  
**Basis**: MyDeck demand measurement + large corpus (17,491 unique cards) + CR decomposability analysis  
**Scope**: Identify 3–5 high-impact, feasible oracle-text-to-GameCommand leaves for next implementation phase.

---

## Key Findings

### Demand & Coverage

**Overall MyDeck coverage**: 77.1% (2345/3041 demands).  
**Top 9 uncovered demand tags** (by gap count in 4-deck census):

| Demand | MyDeck Gaps | Corpus Est. | Status |
|--------|-------------|-------------|--------|
| `target:object-or-player` | 63 | ~860 cards | **guided** (needs user choice) |
| `tap-state:write` | 42 | ~349 cards | **auto** candidate |
| `action:draw` | 40 | ~141+ cards | **manual** (cross-player) |
| `action:sacrifice` | 33 | ~196 cards | **guided** (multi-player choice) |
| `damage:write` | 33 | ~141+ cards | **guided** (variable calc) |
| `action:discard` | 31 | ~48+ cards | **guided** (player choice) |
| `action:return` | 29 | ~860 cards | **partial auto** (filter missing) |
| `object-identity:lki` | 28 | — | **scope defer** |
| `action:exile` | 28 | — | **partial auto** (target filter) |
| `token:create` | 24 | ~2840 cards | **partial auto** (tapped variant missing) |

### Decomposability Constraint

All candidates satisfy §5.1: **existing GameCommand primitives are sufficient** (no new GameCommand type required). Candidates requiring substantial new commands (e.g., multi-player draw with targeting) are deferred.

---

## Candidates (Ranked by Impact × Feasibility)

### 1. Return target with constraint filter

**Leaf form**: `Return target <noun-phrase-filter> from <zone> to <destination>`

**Examples** (corpus: ~860 cards matching `return target`):
- Abiding Grace: "Return target creature card with mana value 1 from your graveyard to the battlefield"
- Extraction Specialist: "Return target creature card with mana value 2 or less from your graveyard to the battlefield"
- Admiral Brass: "Return target Pirate creature card from your graveyard to the battlefield"

**MyDeck census**: 29 gaps  
- Priest of Fell Rites (Celes): "{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield."
- Extraction Specialist (Celes): "When this creature enters, return target creature card with mana value 2 or less from your graveyard to the battlefield."
- Squall, SeeD Mercenary (Kefka): "Whenever Squall deals combat damage to a player, return target permanent card with mana value 3 or less from your graveyard to the battlefield."

**Demand tags**: `action:return`, `target:object-or-player`  
**Estimate**: 29–40 demands resolved (MyDeck + related action:return clauses)

**CR basis**: 
- **701.14** (Return): "To return a card to a zone, move that card to that zone from wherever it is."
- **711.1** (Filters on cards in zones): Noun phrase after "target" specifies type/property restrictions.
- **407** (Graveyard): Object can be returned from graveyard to battlefield.

**§5.1 Decomposability**: 
- **Current**: `isExactGraveyardCreatureReturn()` only matches exact form "return target creature card from your graveyard to the battlefield" (no filters).
- **Gap**: Filters like "with mana value ≤ N" → fall to manual.
- **Composition**: `moveCard(to: 'battlefield', filter: TargetFilter)` + extended `TargetFilter` to support:
  - `restrictedPowerToughness?: { maxPower?: number; minPower?: number; ... }`  
  - `restrictedManaValue?: { max: number }` or lexicographic parsing
  - Existing fields (`types`, `excludedTypes`, `controller`) already cover "nontoken", "you control", etc.
- **New GameCommand?** No. Existing `moveCard` + enhanced `TargetFilter` struct (local to compile.ts).

**Ship cleanliness**: 
- **Compile.ts only** ✓
- No GameStore / UI changes.
- No new command types.

**Relative ranking**: **HIGH** (29 MyDeck gaps; corpus of 860; decomposable into targetFilter extension; no command churn).

---

### 2. Create tapped predefined tokens

**Leaf form**: `Create <count> <tapped> <token-kind> token(s)`, where `token-kind ∈ {treasure, clue, food, blood}`.

**Examples** (corpus: ~88 cards matching `create.*tapped.*token`):
- Tataru Taru/Scions' Secretary: "Create a tapped Treasure token."
- Aang and Katara: "Create X 1/1 white Ally creature tokens, where X is the number of tapped artifacts you control."
- Storm-Kiln Artist: "Whenever a land enters the battlefield under your control, create a tapped Treasure token."

**MyDeck census**: 24 gaps
- Tataru Taru (Celes): "Scions' Secretary — Whenever an opponent draws a card, if it isn't that player's turn, create a tapped Treasure token."
- Mog, Moogle Warrior (Celes): "At the beginning of your end step, each player may discard a card. Each player who discarded a card this way creates a Treasure token." (tapped inferred from context)

**Demand tags**: `token:create`, `tap-state:write`  
**Estimate**: 24–30 demands resolved

**CR basis**:
- **611.2a** (Token creation): Tokens are created as specified by the card instruction.
- **701.26** (Tap/untap): A tapped token enters tapped.
- **707.10** (Treasure): "Treasure token" is a standard token.

**§5.1 Decomposability**:
- **Current**: `createToken` GameCommand has no `tapped` / `initialTapped` field for predefined tokens (`treasure`, `clue`, `food`, `blood`).
  - `createDefinedToken` *does* support `initialTapped` (line 946 in compile.ts) for creature tokens.
  - Gap: predefined non-creature tokens cannot be created tapped.
- **Composition**: Extend `createToken` command type to include optional `initialTapped?: boolean`.
- **New GameCommand?** No—extend existing `createToken`.

**Ship cleanliness**:
- **Compile.ts**: Enhanced token detection in `predefinedTokenCommand()` and `predefinedTokenKindForRaw()` to recognize "tapped" keyword.
- **Commands.ts**: Extend `createToken` type signature (minor, non-breaking).
- **GameStore**: Apply tapped state when token is created (shallow, merge with existing token-creation handler).
- **UI**: No changes (tokens auto-render tapped state).

**Risk**: Low. Tapped-token creation is deterministic and affects token state only at creation time.

**Relative ranking**: **VERY HIGH** (24 MyDeck gaps; corpus of ~88; low complexity; existing infra nearly complete; zero command logic churn).

---

### 3. Untap target permanent

**Leaf form**: `Untap target <noun-phrase>` or `Untap target <object> and <verb> it`.

**Examples** (corpus: ~349 cards matching `untap target`):
- Aphetto Alchemist: "{T}: Untap target artifact or creature."
- Aim High: "Untap target creature. It gets +2/+2 and gains reach until end of turn."
- Arbor Elf: "{T}: Untap target Forest."
- Mother of Runes + untap interaction (e.g., "untap target creature you control").

**MyDeck census**: 42 gaps
- Tataru Taru (Celes, partial): "Delirium — Whenever this creature attacks for the first time each turn, if there are four or more card types among cards in your graveyard, untap target creature."
- Fear of Missing Out (Celes, partial): Similar untap clause.
- Multiple other instances in Muldrotha deck.

**Demand tags**: `tap-state:write`  
**Estimate**: 42–50 demands resolved

**CR basis**:
- **701.26** (Tap/untap): "To untap a permanent, rotate it back to its untapped position."
- **Targeting**: Noun phrase after "target" specifies types/properties.

**§5.1 Decomposability**:
- **Current**: `effect.untap` is probed in IR (line 115, index.ts) but **not currently compiled to any GameCommand**.
- **Gap**: No handler for `if (effect.atom === 'effect.untap')` in compile.ts.
- **Composition**: 
  - Detect `effect.untap` with target filter (similar to `effect.tap` handler, which already exists and is manual).
  - Extract target filter using existing `targetFilterForRaw()` (line 1426).
  - Generate guided prompt + `setTapped` command.
- **New GameCommand?** No. Use existing `setTapped(cardId, tapped: false)`.

**Ship cleanliness**:
- **Compile.ts only** ✓
  - Add case for `effect.untap` in `compileEffectClause()`.
  - Reuse `targetFilterForRaw()` and existing prompt/filter logic.
- No GameStore / UI changes.

**Risk**: Minimal. Untap is deterministic; existing `setTapped` handler is proven.

**Relative ranking**: **VERY HIGH** (42 MyDeck gaps; corpus of ~349; straightforward, mostly copy-paste of `effect.tap` handler in reverse; lowest implementation cost).

---

### 4. Opponent draws card (optional/conditional)

**Leaf form**: `Target opponent may draw a card` or `Each player draws a card` (with cross-player draw recipient).

**Examples** (corpus: ~200+ cards with opponent/each-player draw):
- Academy Loremaster: "At the beginning of each player's draw step, that player may draw an additional card."
- Tataru Taru: "When Tataru Taru enters, you draw a card and target opponent may draw a card."
- Howling Gale: "You draw a card and target opponent may draw a card."

**MyDeck census**: 40 gaps (action:draw alone); ~65 when including event:draw
- Celes, Rune Knight (Celes): Multiple clauses involve opponent draw.
- Tataru Taru (Celes): "You draw a card and target opponent may draw a card."
- Banon, the Returners' Leader (Celes): Conditional draw.

**Demand tags**: `action:draw`, `event:draw`, `target:object-or-player`  
**Estimate**: 40–65 demands resolved

**CR basis**:
- **121.1** (Drawing cards): "To draw cards, a player puts that many cards from the top of his or her library into his or her hand."
- **121.2c** (Multi-player draw): Multiple players drawing in the same effect use stack order rules.
- **Target player**: Standard targeting for player-affecting effects.

**§5.1 Decomposability**:
- **Current**: Cross-player draw is **explicitly blocked** (line 1015–1023, compile.ts).
  - Regex `DRAW_UNSUPPORTED_RECIPIENT_OR_CONDITION` rejects any clause with `opponents?`, `target players?`, `each players?`, or `may`.
  - Reason: Multi-player draw changes game state for non-self player; cannot faithfully encode in single `draw` command.
  - Design decision (CR 121.1, 121.2, 121.2c): Half-executing draw (P1 only, silently omitting opponent draw) violates contract.
- **Composition**: 
  - Extend compile flow to handle cross-player draw as **guided** (user selects target player + optional acceptance).
  - New prompt kind `draw-opponent` with `targetKind: 'player'`.
  - Multiple GameCommands: `{ type: 'draw', count: 1 }` for opponent (guided choice of which opponent, executed by guided handler).
  - OR: Defer to manual (lower priority; requires LLM arbitration of optional draws).
- **New GameCommand?** Likely no (use existing `draw`), but **stack command sequencing** must preserve player identity (non-trivial).

**Ship cleanliness**:
- **Compile.ts**: Conditional handler + new prompt kind.
- **Commands.ts**: Possibly new opaque player-targeting marker on `draw` command (or new `drawForPlayer` variant).
- **GameStore**: Apply draw to specified player (non-self). High-risk change to core loop.
- **UI**: Prompt for target opponent + optional acceptance.

**Risk**: MEDIUM–HIGH. Cross-player state mutation is a critical path; existing draw handler is P1-only.

**Relative ranking**: **MEDIUM** (40–65 MyDeck gaps; corpus of 200+; **higher complexity & risk than untap/tapped-tokens**; defers to manual or guided, not fully auto).

---

### 5. Each player sacrifices (choice)

**Leaf form**: `Each player sacrifices <noun-phrase-filter> of their choice` or `Each opponent sacrifices...`.

**Examples** (corpus: ~196 cards matching `sacrifice.*each.*player`):
- Accursed Marauder: "When this creature enters, each player sacrifices a nontoken creature of their choice."
- Abyssal Gorestalker: "When this creature enters, each player sacrifices two creatures of their choice."
- Grave Titan: (implicit via drain effects); many sweepers with "sacrifice" clauses.

**MyDeck census**: 33 gaps (action:sacrifice)
- Accursed Marauder (Celes): "Each player sacrifices a nontoken creature of their choice."
- Rite of Oblivion (implicit cost): "Sacrifice a nonland permanent."

**Demand tags**: `action:sacrifice`, `player-scope:each-opponent`  
**Estimate**: 33–40 demands resolved

**CR basis**:
- **701.21** (Sacrifice): "To sacrifice a permanent, its controller puts it into the graveyard."
- **Each player**: Each player makes a choice independently.
- **Nontoken**: Excludes token permanents.

**§5.1 Decomposability**:
- **Current**: Sacrifice is partially automated (line 1553–1555, compile.ts) for single-target cases.
  - `effect.sacrifice` is probed but requires a user prompt (guided).
  - No support for multi-player sacrifice ("each player").
- **Gap**: Each-player sacrifice requires **parallel guided prompts** for each opponent (complex state choreography).
- **Composition**:
  - Detect `each player` + `sacrifice` + filter.
  - Generate guided prompt per player (e.g., "Player 2, choose a nontoken creature to sacrifice").
  - Issue `moveCard(to: 'graveyard', reason: 'sacrifice')` for each player's choice.
- **New GameCommand?** No (reuse existing `moveCard`).

**Ship cleanliness**:
- **Compile.ts**: Detect multi-player sacrifice vs. single-target.
- **UI/Prompts**: Parallel or sequential guided prompts for each opponent.
- **GameStore**: Execute sacrifices in order (low-risk; existing move logic handles).

**Risk**: MEDIUM. Parallel prompting / multi-player state sequencing is non-trivial; less precedent than cross-player draw.

**Relative ranking**: **MEDIUM–LOW** (33 MyDeck gaps; guided, not auto; more complex than untap/tapped-tokens; deferrable).

---

## Recommendation (By Impact & Feasibility)

### Phase N Implementation (Auto-Only, Lowest Risk)

**Highest priority** (implement together; high cohesion):
1. **Untap target** (42 gaps; ~349 corpus; minimal effort; zero risk)
2. **Create tapped tokens** (24 gaps; ~88 corpus; minor GameCommand ext.; low risk)

**Combined benefit**: 66 MyDeck gaps resolved + ~437 corpus cards.  
**Effort**: 2–4 hours (compile.ts handlers + GameCommand type ext. + GameStore merge).  
**Ship**: Compile.ts + commands.ts + shallow GameStore.

### Phase N+1 (Guided, Medium Complexity)

3. **Return with constraint filter** (29 gaps; ~860 corpus; TargetFilter extension; low risk)

**Effort**: 3–6 hours (targetFilter grammar + filtering logic).  
**Ship**: Compile.ts + TargetFilter struct.

### Deferred (Complex / Cross-Player)

- **Cross-player draw** (40–65 gaps): Requires player-targeting infrastructure & guided flow re-architecture. Defer to Phase N+2 or later.
- **Each player sacrifices** (33 gaps): Parallel prompting & complex sequencing. Deferred alongside cross-player effects.

---

## Summary

**Top candidate (recommend as next task)**: **Untap target** (42 gaps, 349 corpus cards, ~2–3 hours effort, zero risk).

**Runner-up (bundle with untap)**: **Create tapped tokens** (24 gaps, 88 corpus cards, ~1–2 hours effort, low risk).

**Third (follow-up)**: **Return with filter** (29 gaps, 860 corpus cards, ~4–5 hours, low-medium risk due to TargetFilter grammar).

**Skip for now**: Opponent draw (complex) and each-player sacrifice (parallel prompting) — defer to multi-player orchestration phase.

---

## References

- CR **701.26** (Tap/Untap): Defines untap operation.
- CR **701.14** (Return): Defines return-to-zone operation.
- CR **611.2** (Token creation): Specifies token creation rules.
- CR **611.4a** (Tapped tokens): "A token can enter the battlefield tapped."
- CR **121** (Drawing cards): Multi-player draw ordering rules.
- **Existing compile.ts infrastructure**: `targetFilterForRaw()`, `TargetFilter` struct, `effect.tap` handler (untap is its inverse).
- **Existing GameCommand**: `setTapped`, `moveCard`, `createToken` (all proven).
