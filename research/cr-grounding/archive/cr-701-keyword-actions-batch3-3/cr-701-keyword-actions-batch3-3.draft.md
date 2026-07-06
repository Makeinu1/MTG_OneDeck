# cr-701-keyword-actions-frequent batch3-3 draft

Scope: DESIGN DRAFT ONLY. No implementation decision is final here. This draft covers the residual MyDeck demand noted in `research/cr-grounding/planned-sequence-batch3.draft.md`: `action:mill` 10 + `action:surveil` 6 + `action:reveal` 6 + `action:scry` 1.

Important repository observation: current source already contains substrate for `mill` and `scry/surveil` (`GameCommand.mill`, `GameCommand.arrangeTop`, `EffectPrompt.kind:'scry-surveil'`, and compiler branches). This draft treats that as an existing-pattern survey, not as judge approval that the residual leaf is already contracted.

## CR grounding

Primary source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, pinned 2026-06-19.

### Mill

> 701.17a For a player to mill a number of cards, that player puts that many cards from the top of their library into their graveyard.

> 701.17b A player can’t mill a number of cards greater than the number of cards in their library. If given the choice to do so, they can’t choose to take that action. If instructed to do so, they mill as many as possible. Similarly, the player can’t pay a cost that includes milling a number of cards greater than the number of cards in their library.

> 701.17c An effect that refers to a milled card can find that card in the zone it moved to from the library, as long as that zone is a public zone.

> 701.17d Some spells and abilities mill a single card and then ask for information about the milled card. If more than one card is milled due to replacement effects and the effect of a spell or ability asks for information about the milled card, such as a characteristic or mana value, it gets information from each milled card and will get multiple answers. If these answers are used to determine the value of a variable, the sum of the answers is used. If that effect grants a player permission to cast or play “that” card, the permission applies to each of the milled cards. If that effect performs any actions on “the” card, it performs that action on each milled card. If that effect performs any actions on “a” card, the controller of the spell or ability chooses which card is affected.

Related non-draw grounding:

> 121.5. If an effect moves cards from a player’s library to that player’s hand without using the word “draw,” the player has not drawn those cards. This makes a difference for abilities that trigger on drawing cards and effects that replace card draws, as well as if the player’s library is empty.

### Reveal / look

> 701.20a To reveal a card, show that card to all players for a brief time. If an effect causes a card to be revealed, it remains revealed for as long as necessary to complete the parts of the effect that card is relevant to. If the cost to cast a spell or activate an ability includes revealing a card, or if a card is revealed because an ability is activated from a hidden zone (see rule 602.2a), the card remains revealed from the time the spell or ability is announced until the time it leaves the stack. If revealing a card causes a triggered ability to trigger, the card remains revealed until that triggered ability leaves the stack. If that ability isn’t put onto the stack the next time a player would receive priority, the card ceases to be revealed.

> 701.20b Revealing a card doesn’t cause it to leave the zone it’s in.

> 701.20c A card that is currently revealed may be revealed again.

> 701.20d If cards in a player’s library are shuffled or otherwise reordered, any revealed cards that are reordered stop being revealed and become new objects.

> 701.20e Some effects instruct a player to look at one or more cards. Looking at a card follows the same rules as revealing a card, except that the card is shown only to the specified player.

Related hidden-zone grounding:

> 400.2. Public zones are zones in which all players can see the cards’ faces, except for those cards that some rule or effect specifically allow to be face down. Graveyard, battlefield, stack, exile, ante, and command are public zones. Hidden zones are zones in which not all players can be expected to see the cards’ faces. Library and hand are hidden zones, even if all the cards in one such zone happen to be revealed.

### Scry

> 701.22a To “scry N” means to look at the top N cards of your library, then put any number of them on the bottom of your library in any order and the rest on top of your library in any order.

> 701.22b If a player is instructed to scry 0, no scry event occurs. Abilities that trigger whenever a player scries won’t trigger.

> 701.22c If multiple players scry at once, each of those players looks at the top cards of their library at the same time. Those players decide in APNAP order (see rule 101.4) where to put those cards, then those cards move at the same time.

> 701.22d An ability that triggers whenever a player scries triggers after the process described in rule 701.22a is complete, even if some or all of those actions were impossible.

### Surveil

> 701.25a To “surveil N” means to look at the top N cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.

> 701.25b If an effect allows you to look at additional cards while you surveil, those cards are included among the cards you may put into your graveyard and on top of your library in any order.

> 701.25c If a player is instructed to surveil 0, no surveil event occurs. Abilities that trigger whenever a player surveils won’t trigger.

> 701.25d An ability that triggers whenever a player surveils triggers after the process described in rule 701.25a is complete, even if some or all of those actions were impossible.

## Existing-pattern survey

### Compiler and prompts

Observed in `src/engine/grammar/compile.ts`:

- `AutoDecision = 'auto' | 'guided' | 'manual'`.
- `PromptKind` already includes `target`, `library-search`, `discard`, `sacrifice`, `scry-surveil`, `modal`, `mana`, `cost-discard`, and `cost-sacrifice`.
- `TargetFilter` supports `types`, `excludedTypes`, `excludeTokens`, `excludeSource`, `controller`, `zone`, and `owner`.
- `EffectPrompt` carries `atom`, `kind`, `count`, optional target/filter/search/modal/mana/link metadata, and raw source text.
- `GuidedAnswer` already has `{ kind:'scry-surveil'; topOrder; toBottom; toGraveyard }`.
- `COUNT_DRIVEN_AUTO_ATOMS` includes `effect.mill`; `countDrivenCommand('effect.mill', n)` returns `{ type:'mill', count:n }`.
- `GUIDED_CHOICE_ATOMS` is `effect.scry` + `effect.surveil`; those emit `EffectPrompt{kind:'scry-surveil', count, atom, raw}` when count resolves.
- `buildGuidedCommands` maps `scry-surveil` answers to a single `{type:'arrangeTop', topOrder, toBottom, toGraveyard}` command.
- `CHOICE_REQUIRED_ATOMS` includes `effect.reveal`, but there is no reveal command or guided reveal prompt. It remains `needs-choice`/manual.
- `hasSupportedPlayerSubject` only supports mill clauses that start with `Mill...` or contain `you mill...`; this already fails closed for `target player mills`, `each opponent mills`, etc.

Observed in `src/engine/grammar/index.ts` / `src/engine/grammar/ir.ts`:

- Atom probes are broad lexical probes: `mill`, `reveal`, `scry`, `surveil`.
- `countSpec` recognizes digits, `two` through `ten`, and `a/an`; it does not currently recognize the word `one` as a fixed count. A contracted "word or digit N" gate should explicitly decide whether `one` must be accepted.
- Effect clauses split on periods and `then`; comma compounds can leave several atoms sharing one raw clause.

### GameCommand and state shapes

Observed in `src/engine/commands.ts`:

- `GameCommand` already includes `{ type:'mill'; count:number }`.
- `GameCommand` already includes `{ type:'arrangeTop'; topOrder:string[]; toBottom:string[]; toGraveyard:string[] }`.
- `applyMill` moves `min(count, library.length)` cards from the top of `state.zones.library` to graveyard and warns if fewer cards were available. This matches CR 701.17b for instructed mill effects.
- `applyArrangeTop` validates that the union of `topOrder`, `toBottom`, and `toGraveyard` is exactly the current top N cards, then moves `toGraveyard` to graveyard and rebuilds library as `topOrder + untouchedRest + toBottom`.
- `moveCardInternal` is the common zone-change path and resets objects on zone changes.

Observed in `src/engine/types.ts`:

- `ZoneId` includes `library`, `hand`, `battlefield`, `graveyard`, `exile`, `command`, and `stack`.
- `GameState.zones` is still a flat ordered zone map where `library[0]` is the top of P1's library.
- `GameState.zonesByPlayer` and `PlayerId = 'P1' | 'OPPONENT_A'` exist, but `GameCommand.mill` has no `playerId`. The present command is therefore naturally self/P1-only.
- There is no `revealed`/public-information field in `GameState`, no `reveal` command, and no reveal event type.

### Existing UI pattern

Observed in `src/components/playmat/dialogs.tsx`, `src/components/playmat/Playmat.tsx`, and `src/store/gameStore.ts`:

- `ArrangeTopDialog` already supports `scry` and `surveil` modes.
- Guided scry/surveil uses locked mode/count for compiler prompts.
- The dialog passes `toBottom` only for scry mode and `toGraveyard` only for surveil mode.

Design caution: `buildGuidedCommands` itself currently accepts both `toBottom` and `toGraveyard` for any `scry-surveil` prompt. If this leaf is contracted, the judge should decide whether UI locking is sufficient or whether the pure builder must enforce atom-specific invariants.

## Per-verb feasibility and boundaries

### Mill

Boundable first slice:

- Exact effect text gate: fixed-count self mill only, e.g. `Mill two cards.`, `Mill 2 cards.`, `You mill three cards.`.
- Count must be fixed, nonnegative, and preferably positive. `Mill 0 cards` can be left manual/no-op unless the judge explicitly wants CR 701.17b-compatible no-op handling.
- Subject must be self/P1 only. This aligns with current `GameCommand.mill` lacking `playerId`.
- Resolution is deterministic from current state: move current top N, or all available if fewer than N, to graveyard. No random payload needed.
- Reversibility is via existing undo/state-history model; no hidden choice is needed.

Command design options:

Option A: keep/use existing batch command `{ type:'mill', count:n }`.

- Pros: already present; pure compiler can emit it without reading GameState; `applyMill` handles shortage per CR 701.17b; compact command log; future `mill` event hooks can be centralized.
- Cons: current command has no `playerId`; current zone-change reason set has no `'mill'`; current event log represents the underlying zone changes but not a distinct mill event. This is acceptable for self-only leaf, but not for target/opponent/each-player mill.

Option B: generate N `moveCard` commands for the top library cards.

- Pros: reuses universal movement and can make each physical card explicit in the command payload.
- Cons: `compile.ts` is intentionally GameState-free, so it cannot know top card ids. A planner/store layer would need to compute ids at resolution time; this is a larger architecture change. Multiple `moveCard` commands also make "milled this way" grouping and shortage handling less centralized. Not recommended for the first self-mill slice.

Manual boundary:

- `target player mills N`, `each opponent mills N`, `each player mills N`, opponent library, or any non-P1 library.
- `Mill X`, `mill equal to`, `for each`, die-roll/random counts, variable counts, and "until" forms.
- Optional mill (`you may mill...`) and costs that include milling, because CR 701.17b treats impossible cost payment differently from instructed effects.
- Follow-ups that need identity/characteristics of "milled card(s)" (`milled this way`, cast/play permission, choose among milled cards) unless separately scoped with an event/group record.
- Replacement-effect-sensitive cases from CR 701.17d.
- Non-keyword "put the top card(s) of your library into your graveyard" unless separately contracted as a non-701 phrase.

### Surveil

CR shape:

- Surveil looks at the top N of your own library, then sends any number to graveyard and leaves the rest on top in any order (CR 701.25a).
- This is not a target-selection problem. The input is an ordered slice of a hidden zone plus a partition/reorder decision.
- The initial UI should present the top N in current top-to-bottom order. The player then chooses which cards go to graveyard and the order of the kept top cards. CR does not require decisions to be made sequentially one card at a time; it allows the final partition and ordering.

Fit options:

Option A: shared `scry-surveil` prompt + existing `arrangeTop` command.

- Pros: no new GameState field; no new GameCommand if judge accepts existing `arrangeTop`; command payload records the final deterministic choice; `applyArrangeTop` validates that the chosen ids are exactly the current top N cards.
- Cons: `arrangeTop` is more permissive than surveil because it can also bottom cards. For surveil, `toBottom` must be empty. Builder-level validation would make this safer than relying only on UI locking.

Option B: new mode-specific command or command mode, e.g. `{type:'surveilTop', topOrder, toGraveyard}` or `{type:'arrangeTop', mode:'surveil', ...}`.

- Pros: type/command surface can forbid bottoming during surveil; future surveil event hooks are clearer.
- Cons: new command/test surface for behavior already expressible by `arrangeTop`; more blast radius.

New GameState shape is not required for simple surveil N if the prompt is transient and the final answer command carries exact ids/order. New GameState would only be needed if the app must persist a mid-resolution "pending top-library decision" through snapshots, or expose "surveiled this way" data to later clauses/triggers beyond what the command/event log can derive.

Manual boundary:

- Variable counts (`surveil X`, `surveil a number equal to...`) and optional surveil.
- `surveil 0` unless the judge explicitly wants a no-event/no-op path per CR 701.25c.
- Effects adding extra cards while surveilling (CR 701.25b).
- Multiple players surveilling simultaneously or APNAP-dependent handling.
- Follow-up text that depends on the surveil choice, e.g. "for each card you put on top/in your graveyard this way", unless the implementation exposes that choice to subsequent effects.
- Compound lines where unsupported manual effects appear in the same clause and would risk partial execution.

### Scry

CR shape:

- Scry looks at top N of your own library, puts any number on bottom in any order, and keeps the rest on top in any order (CR 701.22a).
- It is the same ordered-slice interaction family as surveil, but the off-top destination is bottom of library, not graveyard.
- It is not identical code semantically: scry never moves selected cards to graveyard, and surveil never bottoms selected cards.

Fit options:

Option A: shared `scry-surveil` prompt + existing `arrangeTop`.

- Pros: no new state/command if atom-specific validation is enforced; existing UI already has scry mode.
- Cons: same over-permissive command issue as surveil. For scry, `toGraveyard` must be empty.

Option B: new mode-specific command or command mode, e.g. `{type:'scryTop', topOrder, toBottom}`.

- Pros: type surface mirrors CR 701.22a directly and avoids illegal answer shapes.
- Cons: duplicates much of `arrangeTop`; more implementation and review cost.

Manual boundary:

- Variable counts, optional scry, simultaneous multi-player scry (CR 701.22c), and `scry 0` unless explicitly no-op-scoped.
- Fateseal/opponent-library top manipulation; it is separate CR 701.29, not scry.
- Non-keyword "look at the top N..." patterns unless separately scoped.
- Follow-up compounds requiring reveal/conditional processing of the new top card, or any unsupported same-line effect.

### Reveal

CR shape:

- Reveal is a real keyword action (CR 701.20a-e), but it usually changes information visibility rather than zones.
- CR 701.20b explicitly says revealing does not move the card.
- CR 701.20a/20d imply duration and object-identity concerns. A card can remain revealed only as long as relevant, and reordered library cards stop being revealed and become new objects.

Feasibility:

- A no-op `reveal` command would be fake-green: it would not write the public information state demanded by `action:reveal`.
- A real standalone reveal leaf needs one of:
  - a transient UI-only reveal/peek flow, honest that it does not persist public information; or
  - a new GameState shape such as revealed card/object ids with scope/duration, plus clear rules for clearing on shuffle/reorder/zone change/stack duration.
- Current `GameState` has no reveal state and current `GameCommand` has no reveal command/event. Therefore bare reveal should not be auto/guided in this batch unless the judge explicitly scopes that new state.

Recommendation:

- Do not create a standalone reveal leaf in the first slice.
- Treat reveal as part of specific future compounds only when the full compound is scoped, e.g. "search, reveal, put into hand, then shuffle" or "reveal until condition, then move those cards".
- For existing guided search composites, reveal may be treated as explanatory/public-information metadata only if the judge explicitly accepts that no persistent revealed state is being modeled. Otherwise keep the compound manual.

Manual boundary:

- Bare `reveal your hand`, `reveal the top card of your library`, or "play with ... revealed" until reveal state exists.
- Reveal-then-X compounds: search/reveal/put, reveal-until, reveal-and-choose, reveal-and-cast/play, reveal top and conditionally move.
- Opponent/each-player reveal, simultaneous reveal, secret choices then reveal, and hidden-zone duration effects.
- `look at` effects are not reveal to all players per CR 701.20e and should not share a public reveal command without a visibility model.

## Recommended slice split

Slice A: fixed-count self-library mill.

- Highest confidence and smallest blast radius.
- Existing `{type:'mill', count}` matches the CR 701.17a/b effect shape for self/P1.
- Exact-phrase gate can be narrow: `^(?:you )?mill (a|one|two|...|ten|[0-9]+) cards?\\.?$`, with judge deciding count vocabulary.
- No new GameState and likely no new GameCommand.

Slice B: fixed-count scry/surveil guided top-library arrangement.

- Good demand coverage, but requires a judge decision on whether to bless the existing shared `scry-surveil`/`arrangeTop` substrate or require mode-specific commands/validation.
- No new GameState is needed for simple `Scry N.` / `Surveil N.`.
- Must enforce atom-specific destination constraints: scry can bottom but not graveyard; surveil can graveyard but not bottom.

Slice C: reveal remains manual or metadata-only until a concrete compound is scoped.

- The CR action is clear, but the app lacks a public-information state model.
- Most demand examples are reveal-then-X compounds, not isolated useful board mutations.

## Judge Decision Points

1. Domain ownership: reopen `cr-701-keyword-actions-frequent` or create a new residual leaf domain for batch3-3.
2. Mill command shape: accept existing `{type:'mill', count}` for self/P1 only, or require future-proof `{playerId, count}` now.
3. Mill count vocabulary: should `one` be accepted as fixed count? Current `countSpec` recognizes `a/an`, digits, and `two` through `ten`, but not word `one`.
4. Scry/surveil command design: share existing `arrangeTop`, add a `mode` field, or create separate `scryTop`/`surveilTop` commands.
5. Scry/surveil validation location: rely on locked UI, or require `buildGuidedCommands`/command layer to reject `toGraveyard` for scry and `toBottom` for surveil.
6. `scry 0` / `surveil 0`: no-op support per CR 701.22b/701.25c or manual/defer to avoid misleading logs/events.
7. Compound carry: allow `Surveil N. Then draw...` or `Scry N. Draw...` through existing mixed auto+guided carry, or restrict this leaf to standalone/pure clauses first.
8. Reveal scope: no standalone reveal leaf, metadata-only reveal within approved search composites, or new GameState reveal/public-information model.
9. Event modeling: whether `mill`, `scry`, and `surveil` need explicit events now for future trigger detection, or whether zone changes/logs are sufficient for this leaf.

## Golden card candidates

### Mill

Positive first-slice candidates:

- `Aftermath Analyst`: "When this creature enters, mill three cards." MyDeck gap candidate.
- `Stitcher's Supplier`: self mill three on ETB/dies; tests fixed self-library mill on triggered abilities.
- `Mire Triton`: "When this creature enters, mill two cards and you gain 2 life." Useful only if judge allows mixed auto clauses; otherwise boundary/manual for compound carry.

Boundary/manual candidates:

- `Hedron Crab`: target player mills three cards; target-player variant stays manual.
- `Ruin Crab`: each opponent mills three cards; opponent/every-opponent variant stays manual.
- `Breach the Multiverse`: each player mills ten, then graveyard selection/reanimation; each-player + compound stays manual.

### Surveil

Positive first-slice candidates:

- `Dimir Informant`: ETB surveil 2; simple guided surveil candidate.
- `Glarb, Calamity's Augur`: `{T}: Surveil 2.` MyDeck gap candidate, but activation-cost substrate is a separate dependency.
- `Undercity Sewers`: enters tapped, then surveil 1; useful for ETB guided surveil if land ETB trigger flow is available.

Boundary/manual candidates:

- `Grave Researcher // Reanimate`: upkeep surveil 1, then conditional graveyard check; follow-up condition may remain manual.
- `Starving Revenant`: follow-up depends on cards kept on top; requires exposing surveil choice to later effect text.

### Scry

Positive first-slice candidates:

- `Path of Ancestry`: scry 1 after the mana-spend trigger; MyDeck gap candidate but trigger/mana-spend condition is separate.
- `Opt`: "Scry 1. Draw a card." Useful if mixed guided+auto carry is accepted; otherwise boundary for compound carry.
- `Preordain`: "Scry 2, then draw a card." Same mixed guided+auto boundary.

Boundary/manual candidates:

- Any simultaneous multi-player scry effect; CR 701.22c APNAP handling is out of first slice.
- Fateseal cards/effects; opponent-library top manipulation is CR 701.29, not scry.

### Reveal

Recommended manual/metadata candidates:

- `Cultivate`: searches for up to two basic lands, reveals them, puts them into different zones, then shuffles. Reveal is a sub-clause of a broader search compound.
- `Kodama's Reach`: same reveal/search/multi-zone compound shape as Cultivate.
- `Spellseeker`: searches a constrained card, reveals it, puts it into hand, then shuffles; optional search and tutor constraints should stay manual unless separately scoped.
- `Consuming Aberration`: each opponent reveals from library until a land card, then moves revealed cards to graveyard; reveal-until + opponent zones stay manual.
- `Telepathy`: static/public hand reveal example; requires persistent reveal/public-information state, not a one-shot command.
