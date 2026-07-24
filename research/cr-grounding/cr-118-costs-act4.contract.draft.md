# CR118 ACT-4 activation-cost vocabulary contract draft

Status: context-free implementer/drafter proposal for judge re-ownership.

This file scopes only ledger domain `cr-118-costs-act4`. It does not claim that
the domain is implemented, audited, or shipped. The parent judge must freeze the
contract and author reviewer-owned evidence before implementation.

Authoritative rules source:
`rule/Magic_The_Gathering_Comprehensive_Rules.txt`, fixed to 2026-06-19.

## 0. Deterministic CR grounding

- CR 107.1 / 107.1a-b: Magic uses integers; a player cannot choose a fractional
  or negative number. Zero is normally available.
- CR 107.3 / CR 107.3a: when an activation cost contains `{X}` or `X` and the card
  does not define it, the ability's controller chooses and announces X while
  activating it. While the ability is on the stack, X in its activation cost is
  that announced value.
- CR 107.3i / 107.3k: all X occurrences in one ability normally share one value,
  but each activation chooses its X independently.
- CR 107.5: `{T}` means tap this permanent. It is distinct from Oracle prose
  that instructs the payer to tap another/chosen permanent.
- CR 118.3: a cost cannot be paid without all required resources; an already
  tapped permanent cannot be tapped to pay a cost.
- CR 118.4: costs may include `{X}` or X and defer to CR 107.3.
- CR 601.2f: determine and lock the total cost before payment. Costs may include
  tapping permanents and other nonmana actions.
- CR 601.2g: mana abilities are activated before costs are paid.
- CR 601.2h: pay the total cost; nonrandom/non-library-public-zone components
  may be paid in any order, but partial payment is forbidden and an unpayable
  cost cannot be paid.
- CR 602.2 / CR 602.2b: activation is stack placement plus cost payment, and
  601.2b-i applies to it. Failure returns the game to immediately before
  activation; announcements and payments cannot later be altered.
- CR 701.26a: only an untapped permanent can be tapped.
- CR 122.1: counters are markers on an object or player, not objects. Removing a
  counter therefore binds an object plus an exact counter name and amount; it
  does not select a "counter object."
- CR 733 is the rollback rule referenced by 601.2 and 602.2. The application
  need not implement a second rollback command: staging all choices and
  committing one existing-command batch realizes the required observable
  result.

These rules uniquely answer the payment questions in this slice. There is no
open CR interpretation about partial payment, X sharing within one activation,
X independence between activations, or whether an already tapped permanent can
pay a tap cost.

## 1. Current-state inventory

### 1.1 Existing compiler and activation envelope

- `docs/engine-spec.md` §33 keeps `compileAbilityCost` pure and exposes
  `CostDecision = 'auto' | 'manual'`. The pure compiler still deliberately
  reports unbound `{X}`, tap-other prose, and counter-removal prose as manual.
  That remains correct: state-dependent choices belong around, not inside, the
  pure compiler.
- `docs/engine-spec.md` §34.19 already freezes the activation envelope and
  rules-legal atomicity. `ActivationCostComponent` already has `raw`,
  `payerId`, `amount`, `slotId`, `subjectRef(s)`, and
  `auto|guided|manual|unparsed` status. The slice should extend that envelope,
  not replace §33.
- `src/engine/types.ts` currently has component kinds for `mana`, self/object
  tap, self/object sacrifice, life, discard, and mill. It has no
  `remove-counter` kind and no counter-name field.
- `src/engine/grammar/compile.ts` has cost prompt kinds for discard, sacrifice,
  and tap. It has no counter-cost prompt metadata.

### 1.2 Already-present tap-other planner behavior is not end-to-end evidence

- `src/engine/commands.ts::parseTapObjectCostElement` recognizes a useful
  subset of `Tap ... you control`, creates `tap-object` guided components, and
  emits one `cost-tap` prompt per chosen permanent.
- `activationNonmanaCosts` feeds those prompts to
  `activationPlanForSource`. `src/engine/__tests__/act4CostVocabulary.test.ts`
  proves only that direct planner call for a Relic of Legends-like line.
- The filter currently extracts broad card types only. It does **not** enforce
  `legendary`, creature subtypes such as Wizard/Vampire/Gate, or token-only
  wording. The Relic test therefore admits any controlled creature, not only a
  legendary one.
- Store-side `eligibleCostSubjectIds` correctly checks battlefield,
  controller, untapped status, and duplicate physical ids for its present
  subset. However, it always excludes the source, even when Oracle wording
  would allow the source and there is no separate `{T}` payment. Conversely,
  the planner does not model staged `{T}` as a reservation when enumerating
  another tap component.
- `activationCostWarnings` preflights non-self sacrifice count but not tap-other
  count. With no eligible tap subject, the current UI may open an empty picker
  instead of rejecting the rules-legal activation before payment.
- Most importantly, `gameStore.activateAbility` calls
  `activatedManaAbilityPlanForSource` before the normal planner.
  `activatedManaAbilityPlanForSource` calls the pure `compileAbilityCost`
  directly and does not call `activationNonmanaCosts`. Relic of Legends'
  tap-other mana ability therefore lands in manual/no-stack warning through the
  real store/UI even though the direct `activationPlanForSource` test is green.
  This behavior is planner-only and unconnected for the representative
  mana-ability path.

### 1.3 X is substantially implemented, but not reviewer-owned

- `src/components/game/gameController.tsx::requestActivateAbility` detects
  `{X}` in the selected activation line and opens `XCostDialog`. The dialog has
  numeric input plus explicit confirm/cancel and displays the number of `{X}`
  symbols.
- `gameStore.activateAbility` rejects missing, fractional, negative, and
  card-text-forbidden zero values, then saves the value as `announcedX`.
- `activationPlanForSource(..., xValue)` substitutes every `{X}` in the cost.
  Existing mana parsing therefore charges `N * X` for `N` repeated `{X}`
  symbols. `addAbilityToStack` stores `announcedX` on the stack ability object.
  Stack copying preserves it, and resolution removes it with the stack object.
- `src/store/__tests__/planGogo.test.ts` is executable final-state ordinary
  evidence for Gogo: X=3 pays six mana, stores X, filters the target stack
  ability, resolves to three copies, and activation undo restores tap/mana.
- `src/engine/__tests__/manualStackTargets.test.ts` separately proves that
  existing stack copies preserve `announcedX` and that it does not remain on a
  resolved object.
- `activationPlanForSource` currently defaults its fourth argument to `0` and
  returns manual whenever a cost has `{X}` and the value is `<= 0`. That cannot
  distinguish "X was not announced" from the normally legal announcement
  X=0. `gameStore` accepts legal zero but the planner then silently falls back
  to manual cost handling.
- The mana-ability planner accepts no announced-X argument. X-bearing activated
  mana abilities cannot share the existing binding path.
- Existing `review.grammar-cost` and `review.g4-activate` correctly keep an
  **unbound** X manual, but neither pins a bound X activation. Existing
  `review.activated-envelope` pins generic atomicity, not ACT-4 X/tap/counter
  final states. Gogo and `act4CostVocabulary` are ordinary tests only.

Conclusion: X has executable implementation and ordinary evidence but is
`implemented-not-audited`; tap-other has partial planner/store machinery but
its key real-card mana route is unreachable; counter removal is absent.

### 1.4 Current transaction, cancel, and history substrate

- `PendingGuidedResolution` already supports `activation` and `mana-ability`
  modes. Prompt answers append commands and envelope data without applying them
  to `GameState`.
- `commitActivation` preflights, then calls one
  `applyCommands([...costCommands, addAbilityToStack])` and one store `commit`.
- `cancelGuidedPrompt` discards activation/mana pending state with no
  `GameState` mutation. Pending interaction undo/redo rewinds prompt answers.
- A completed activation is one main history snapshot; undo/redo restores the
  entire paid/unpaid state and stack object together.
- `restoreGame` clears all pending interaction state. No prompt is part of a
  saved `GameState`.

This is the correct transaction substrate. ACT-4 must reuse it.

### 1.5 Bounded verification performed for this draft

The following focused run was green without modifying files:

```text
npx vitest run \
  src/engine/__tests__/act4CostVocabulary.test.ts \
  src/store/__tests__/planGogo.test.ts \
  src/engine/__tests__/review.grammar-cost.test.ts \
  src/engine/__tests__/review.g4-activate.test.ts \
  src/store/__tests__/review.activated-envelope.test.ts --reporter=dot

5 files passed; 48 tests passed
```

This does not promote the domain. In particular, no counter-cost or real-store
Relic final-state review exists.

## 2. Local real-card evidence

### 2.1 Measurement source and caveat

A read-only probe mapped the pinned 17,491-card Scryfall snapshot at:

`research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`

through the current `mapScryfallCardToCardDef` and current
`splitAbilityLines`, then inspected only `shape === 'activated'` cost prefixes.
The current splitter yields 5,802 activated lines. The historical generated
§33 report says 5,103 because it predates later keyword/line expansion; this
draft uses the current read-only probe and does not regenerate reports.

| Cost family | Current corpus lines | Distinct cards | MyDeck lines |
|---|---:|---:|---:|
| `Tap ... you control` non-symbol object-tap | 93 | 87 | 1 |
| `Remove ... counter(s) from ...` | 157 | 150 | 0 |
| exact `Remove one or more ... counter(s)` | 3 | 3 | 0 |
| activation cost containing `{X}` or standalone X | 98 | 98 | 3 |
| repeated `{X}` symbols | 14 | 14 | 1 |
| variable nonmana `Pay X ...` | 4 | 4 | 1 |

The four local `Mydeck/*.txt` lists contain 336 distinct deck entries; matching
those names against the same pinned corpus produced 204 activated lines. MyDeck
is used here only to choose fixtures within the CR118 slice.

### 2.2 Representative exact English Oracle lines

Tap-other / tap-N:

- Relic of Legends (MyDeck):
  `"Tap an untapped legendary creature you control: Add one mana of any color."`
- Clock of Omens:
  `"Tap two untapped artifacts you control: Untap target artifact."`
- Cryptbreaker:
  `"Tap three untapped Zombies you control: You draw a card and you lose 1 life."`
- Apothecary White:
  `"{W}, {T}, Tap X untapped Foods you control: Create X 1/1 white Human creature tokens."`

Counter removal:

- Dragon's Hoard:
  `"{T}, Remove a gold counter from this artifact: Draw a card."`
- Angelheart Vial:
  `"{2}, {T}, Remove four charge counters from this artifact: You gain 2 life and draw a card."`
- Arcee, Sharpshooter:
  `"{1}, Remove one or more +1/+1 counters from Arcee: It deals that much damage to target creature. Convert Arcee."`
- Rasputin, the Oneiromancer:
  `"{T}, Remove one or more dream counters from Rasputin: Add that much {C}."`
- Duchess, Wayward Tavernkeep:
  `"{1}, Remove a quest counter from a permanent you control: Create a Junk token."`
- Jetfire, Ingenious Scientist:
  `"Remove one or more +1/+1 counters from among artifacts you control: Target player adds that much {C}. ..."`

X:

- Gogo, Master of Mimicry (MyDeck):
  `"{X}{X}, {T}: Copy target activated or triggered ability you control X times. ... X can't be 0."`
- Pernicious Deed (MyDeck):
  `"{X}, Sacrifice this enchantment: Destroy each artifact, creature, and enchantment with mana value X or less."`
- Blast Zone:
  `"{X}{X}, {T}: Put X charge counters on this land."`
- The Mana Rig:
  `"{X}{X}{X}, {T}: Look at the top X cards of your library. ..."`

Variable nonmana forms that remain manual:

- Chthonian Nightmare (MyDeck):
  `"Pay X {E}, Sacrifice a creature, Return this enchantment to its owner's hand: ..."`
- Krumar Initiate:
  `"{X}{B}, {T}, Pay X life: This creature endures X. ..."`
- Sphinx of the Revelation:
  `"{W}{U}{U}, {T}, Pay X {E}: Draw X cards."`

## 3. Exact public type/API delta proposal

No new `GameCommand` variant and no new `GameState` field are needed.
`setTapped`, `addCounters` with negative `delta`, existing mana commands, and
`addAbilityToStack` express every committed transition in this slice.

### 3.1 Grammar/prompt surface

Extend `PromptKind`:

```ts
type PromptKind =
  | /* existing */
  | 'cost-remove-counter';
```

Extend `TargetFilter` only as needed to make tap-cost candidates exact:

```ts
interface TargetFilter {
  // existing fields...
  supertypes?: string[]; // e.g. Legendary
  subtypes?: string[];   // e.g. Wizard, Vampire, Gate
  tokenOnly?: boolean;
}
```

The new fields are additive. `eligibleTargets` applies them to the actual face
type line / token bit in addition to existing `types` and controller checks.

Add counter-cost metadata:

```ts
type CounterCostSourceMode = 'self' | 'single-controlled-permanent';

type CounterCostAmount =
  | { kind: 'fixed'; value: number }
  | { kind: 'one-or-more'; min: 1 }
  | { kind: 'announced-x'; value: number };

interface CounterCostPrompt {
  sourceMode: CounterCostSourceMode;
  counterType: string | null; // null means the payer must choose an existing type
  amount: CounterCostAmount;
}

interface EffectPrompt {
  // existing fields...
  counterCost?: CounterCostPrompt; // required when kind === cost-remove-counter
}
```

If the generic `GuidedAnswer` boundary is used for activation prompts, add:

```ts
| {
    kind: 'cost-remove-counter';
    cardId: string;
    counterType: string;
    amount: number;
  }
```

The store may retain its explicit action style, but then the public action is:

```ts
confirmGuidedCounterCost(
  cardId: string,
  counterType: string,
  amount: number,
): void;
```

Do not add a parallel counter-only pending state. The answer updates the
existing `PendingGuidedResolution`.

### 3.2 Activation envelope

Extend:

```ts
type ActivationCostComponentKind =
  | /* existing */
  | 'remove-counter';

interface ActivationCostComponent {
  // existing fields...
  counterType?: string;
}
```

For `remove-counter`, committed components contain exact `subjectRef`,
`counterType`, and `amount`. `raw` retains the Oracle fragment. A
one-or-more component starts guided and is stored on the eventual stack
envelope with the chosen concrete amount.

### 3.3 Bound-X API

Change only the meaning/signature of the existing fourth planner input so
undefined and announced zero are distinguishable:

```ts
function activationPlanForSource(
  state: GameState,
  sourceId: string,
  abilityLineIndex?: number,
  announcedX?: number,
): ActivationPlan | null;
```

`undefined` means an X-bearing cost is unbound and therefore manual.
`0` means the payer explicitly announced legal X=0.

Give the mana-ability planner the same optional input and the shared cost-plan
output:

```ts
function activatedManaAbilityPlanForSource(
  state: GameState,
  sourceId: string,
  abilityLineIndex?: number,
  announcedX?: number,
): ManaAbilityPlan | null;
```

Internally extract one pure/state-reading activation-cost planner used by both
normal-stack and no-stack mana paths. The mana result must carry
`costComponents` and cost prompts in addition to effect prompts. Do not copy
the parser a second time.

`ActivateAbilityOptions.xValue` and `CardInstance.announcedX` already exist and
remain the public/store and persisted stack surfaces. Do not duplicate X in
`GameState` or add an `announcedXByAbility` map.

### 3.4 Snapshot compatibility

The type additions are optional/union additions, prompts remain ephemeral, and
`announcedX` is already optional on `CardInstance`. Therefore:

- `CACHE_SCHEMA_VERSION` does not change;
- `restoreGame` needs no new field backfill;
- an old snapshot with no ACT-4 envelope fields restores exactly as before;
- a snapshot containing a stack ability with existing `announcedX` continues
  to preserve it;
- pending cost dialogs are intentionally not restored.

## 4. Frozen behavior

### 4.1 Tap chosen permanents

Recognized auto/guided grammar:

```text
Tap [a|an|one|fixed N|X] [other] [untapped] <supported descriptor> you control
```

`X` is accepted only after a value has been announced by the bound-X step.
The descriptor subset may contain:

- permanent card types and `artifact and/or creature` / `artifact or creature`;
- `legendary`;
- one printed subtype such as Wizard, Vampire, Zombie, Gate, Food;
- `token(s)`.

Anything with power/toughness, mana value, "with/without [ability/counter],"
shared-type comparison, choice by another player, "any number," or an
unrecognized conjunction remains manual.

Legal candidates in rules-legal mode:

1. are permanents on the battlefield;
2. are controlled by `payerId`;
3. are untapped in the baseline plus staged-reservation view;
4. match every parsed type/supertype/subtype/token constraint;
5. are not selected for another unit of a tap cost;
6. are not already reserved by `{T}` in the same total cost.

The source is excluded only when Oracle says `other`, it is already reserved by
`{T}`, or it fails the descriptor. A source must not be categorically excluded.
Summoning sickness does not prohibit prose-based object tap costs; CR 107.5's
special creature restriction belongs to the `{T}` symbol.

For fixed N, exactly N distinct subjects are required. For tap-X, exactly the
announced X are required; X=0 creates no subject prompt and no tap command.
Prompts and subject ids are ordered by Oracle component order and then payer
selection order. Commands for the chosen subjects use:

```ts
{ type: 'setTapped', cardId, tapped: true }
```

If fewer than N legal subjects exist, rules-legal activation is rejected before
any prompt command or stack/no-stack result is committed. Forced mode may
continue only with a visible non-CR-legal warning and must never label an
already tapped object as having paid a tap cost.

### 4.2 Remove counters as a cost

Recognized subset:

1. Fixed positive N, exact named counter type, strict self source:
   `Remove a/two/... charge counter(s) from this artifact` or exact source/face
   name. This is auto when the source has at least N of that exact type.
2. Fixed positive N, exact named counter type, one singular
   `<permanent|artifact|creature> you control`. This is guided source selection.
3. Fixed positive N with generic `counter(s)` from a strict self source. This is
   guided counter-type selection when the source has one or more counter types.
4. `Remove one or more <named> counters from <strict self>`. This is guided
   amount selection in `[1, currentExactCount]`.
5. `Remove X <named> counters from <strict self>` when X has already been
   announced by this activation. The amount is exactly X. X=0 is a legal
   zero-payment component.

Exact self-name matching uses the active face name and split-card name
alternatives, as existing self-sacrifice/self-exile recognition does.

After an answer, immediately before commit, revalidate:

- the physical card still denotes the same `objectId`;
- its zone/controller still match the parsed source;
- the exact `counterType` key exists when amount is positive;
- cumulative staged removals of that object/type do not exceed its current
  count;
- one-or-more amount is an integer at least one and no more than the current
  exact count;
- fixed/announced-X amount is unchanged from the locked component.

Only after the whole activation passes preflight emit:

```ts
{
  type: 'addCounters',
  cardId,
  counterType,
  delta: -amount,
}
```

This guard is mandatory because current `applyAddCounters` clamps at zero.
Without preflight, asking to remove four from a source with one would silently
remove one and fake a partial payment.

The following remain manual:

- `from among ...` where an amount may be distributed across multiple objects;
- alternative counter types (`a +1/+1 counter or a charge counter`) until an
  explicit alternative-cost choice contract exists;
- `any number of` (zero-inclusive CR 107.1c) unless separately frozen;
- an unbound X;
- player counters such as energy/tickets;
- loyalty symbols and CR606 activation limits;
- moving counters between objects, adding counters as a cost, and replacement
  effects that change counter removal.

### 4.3 Choose and bind `{X}`

1. Detect `{X}` in the selected activation cost before planning payment.
2. Before target or cost-subject selection, request one integer value. The
   default minimum is zero; exact Oracle text `X can't/cannot be 0` makes it
   one. Negative/fractional/missing answers do not start activation.
3. One chosen value applies to every X in that activation's cost and text.
   `{X}{X}` costs `2 * X`; `{X}{X}{X}` costs `3 * X`.
4. Each later activation opens a fresh choice. It does not reuse X stored on
   the source or another stack object.
5. The chosen value is stored in existing `CardInstance.announcedX` on the
   activated ability's stack object. Resolution and stack-copy logic consume
   that field; copying preserves it. It expires when that stack object leaves.
6. Canceling the X dialog or any later target/cost picker commits no mana,
   taps, counter changes, sacrifice, or stack/no-stack result.
7. An insufficient X mana payment blocks the entire rules-legal transaction;
   forced mode may commit with the existing explicit non-CR-legal warning.
8. X in a supported tap-X or remove-X cost uses the same binding. It does not
   open a second value dialog.

This slice binds `{X}` activation costs. Standalone variable nonmana instructions
such as `Pay X life`, `Pay X {E}`, `Sacrifice X creatures`, `Exile X cards`, and
`Remove X counters from among ...` remain manual unless they exactly match the
single-self counter form above. A recognized `{X}` mana component must not cause
those other unsupported components to be partially paid.

### 4.4 Composite status and stack insertion

- Every cost element is parsed first. If any element is manual/unparsed, the
  whole cost is manual: no modeled tap, counter, mana, life, or zone command is
  partially executed.
- A supported guided component does not make the cost "auto complete" before
  its answer. Existing `CostDecision` may stay `auto|manual`; the envelope
  component and presence of `costPrompts` are the guided truth. UI wording must
  say guided, not automatic.
- Normal activated abilities append exactly one `addAbilityToStack` after all
  cost commands. Their effects do not resolve during activation.
- CR605 mana abilities keep `mana-transaction-no-stack`. Their cost prompts
  and effect prompts form one pending sequence. Relic must collect the
  legendary-creature tap answer and mana-color answer before one no-stack
  commit; it must never detour to a normal stack object.
- If the effect half is unsupported, the UI may truthfully complete only the
  activation/cost and leave the stack resolution guided/manual. It must not say
  the card's full effect was automated.

### 4.5 Deterministic command/payment order

For the supported subset, freeze this existing-compatible order:

1. deterministic self-cost commands from §33 in its stable order
   (`tap-self`, fixed life, self zone move);
2. mana-source tap commands in `planAutoTap` order, then `payMana`;
3. other recognized nonmana components in Oracle left-to-right order;
4. within a chosen tap/counter component, subject commands in prompt-answer
   order;
5. normal `addAbilityToStack` last, or no-stack mana effect commands last.

CR 601.2h permits these supported nonrandom costs in any order. The application
chooses the above stable order for reproducibility. Identical state + source +
line + announced X + answers + force flag must produce byte-for-byte equivalent
component/envelope ordering and command payloads.

## 5. Transaction and undo model

Let `S0` be the state before the activation request.

1. X, targets, tap subjects, counter source/type/amount, and mana color are
   stored only in pending interaction data.
2. Planning creates commands but does not apply them. Candidate enumeration
   uses a reservation view over `S0` so a resource cannot be spent twice.
3. Reservations are resource-specific:
   - one card cannot satisfy two tap units, sacrifice units, or discard units;
   - counter removals reserve `(objectId, counterType, amount)`;
   - compatible distinct costs may use the same permanent (for example, tap it
     and remove a counter from it) if Oracle permits and both resources exist.
4. Each prompt answer is revalidated against the current state and object id.
5. Final preflight validates every component together, including cumulative
   mana/life/card/counter/tap reservations and every required target.
6. Rules-legal failure discards the pending activation and leaves state equal to
   `S0`. There is no "already paid" intermediate state.
7. Success calls one `applyCommands` with the frozen command list and then one
   `commit`. If command application throws, no store commit occurs.
8. Cancel at any prompt discards pending data and leaves state equal to `S0`.
9. Pending interaction undo/redo may move between answers without changing
   `GameState`. After success, one main undo returns the entire activation to
   `S0`; one redo restores the same payment and stack/no-stack result.

This model proves partial payments cannot escape even in a composite such as
`{2}, {T}, Tap two untapped artifacts you control, Remove a charge counter from
this artifact`.

## 6. Honest auto / guided / manual boundary

| Shape | Status in ACT-4 | Reason |
|---|---|---|
| Fixed-N tap of matching controlled permanents | guided | payer chooses distinct objects |
| Tap X matching controlled permanents with bound `{X}` | guided; X=0 has no object prompt | same activation X binding |
| Fixed-N named counter from strict self | auto after full-resource preflight | deterministic object/type/amount |
| Fixed-N named counter from one controlled object | guided | payer chooses source |
| Generic counter type from strict self | guided | payer chooses an existing exact type |
| One-or-more named counters from strict self | guided | payer chooses amount 1..available |
| Remove X named counters from strict self with bound X | auto after preflight | amount already announced |
| `{X}`, `{X}{X}`, `{X}{X}{X}` mana component | guided value, then auto mana planning | one X value; repeated symbols multiply payment |
| X=0 absent a prohibition | legal | CR 107.1b/107.3a; not "missing X" |
| `Pay X life`, `Pay X {E}` | manual | variable nonmana payment is not this leaf |
| Sacrifice/exile/discard X objects | manual | variable object selection outside scope |
| Remove from among multiple sources | manual | distributed payment outside single-subject envelope |
| `any number of` counters | manual | zero-inclusive semantics not frozen |
| Loyalty symbol/cost | manual | CR606 restrictions outside this slice |
| Unsupported descriptor/ability-word/composite remainder | whole cost manual | no partial execution |
| Supported cost + unsupported effect | cost guided/auto; effect visibly manual at resolution | never claim full-card automation |

## 7. Proposed reviewer-owned red tests and golden replays

The judge owns these tests. Implementers must not edit `review.*`.

### 7.1 Pure planner/parser red tests

1. Relic exact filter contains controlled creature **and legendary**; a
   nonlegendary creature is not a candidate.
2. Clock of Omens produces exactly two distinct artifact prompts; selecting the
   same artifact twice is rejected.
3. Cryptbreaker accepts Zombies, rejects a non-Zombie creature, an opponent
   Zombie, and an already tapped Zombie.
4. A source without `{T}` can be selected when Oracle permits; `other` and a
   separate `{T}` reserve/exclude it.
5. Fewer than N tap candidates yields rules-legal unpayable with zero commands
   committed.
6. Dragon's Hoard recognizes `gold`, not `charge`; one gold produces
   `addCounters(delta:-1)`.
7. Four required charge counters with only three is unpayable; the clamping
   command is never applied.
8. A chosen-source counter cost rejects wrong controller, wrong card type,
   wrong object id, wrong counter type, and insufficient exact count.
9. Arcee one-or-more accepts 1..available and rejects 0, fractional, negative,
   and over-available amounts.
10. `from among artifacts you control`, `any number`, alternate counter types,
    energy, and loyalty remain manual with zero partial commands.
11. Unbound `{X}` stays manual; explicitly bound X=0 is not manual.
12. `{X}{X}` with X=3 plans six mana; `{X}{X}{X}` plans nine.
13. Same input and answers return identical components/prompts/commands without
    mutating input state.

### 7.2 Executable store golden replays

#### A. Relic of Legends, true no-stack reachability

State: Relic plus one untapped legendary creature, one nonlegendary creature,
and empty stack.

1. Activate Relic line 1 through `activateAbility`, not a direct planner call.
2. Before answers: no card tapped, no mana added, stack empty.
3. Nonlegendary selection is rejected; legendary selection advances to existing
   mana-color prompt.
4. Cancel at that second prompt: state byte-equals baseline.
5. Retry, choose the legendary creature and blue: chosen creature tapped,
   blue mana +1, Relic unchanged, stack still empty.
6. One undo restores baseline; redo restores the exact same chosen card/color.

This catches the current unconnected mana-ability path.

#### B. Clock of Omens normal stack activation

Choose two artifacts in opposite enumeration order. Confirm that command and
component subject order follows answer order, both tap once, exactly one
ability object enters the stack, cancel before final answer is a no-op, and
undo/redo is one activation snapshot.

#### C. Dragon's Hoard exact counter payment

With one gold and one charge counter, activation removes only gold, taps the
source, and creates one stack ability. With only charge, wrong type cannot pay
and the whole state is unchanged. Resolve the supported draw line to prove the
card's activation plus effect reaches a final state.

#### D. Arcee one-or-more

With three +1/+1 counters, choose two. The source loses exactly two, the chosen
amount is recorded on the activation cost envelope, and one stack ability is
created. A choice of four, wrong counter type, cancel, or source object-id
change commits nothing. The damage/convert effect may remain visibly manual;
the golden must not call it fully automated.

#### E. Gogo and Pernicious Deed X binding

- Preserve existing Gogo X=3 final replay and add reviewer ownership:
  pays six mana, taps, stores X=3, target is activation-time bound, resolves to
  three copies, and one activation undo restores all payment.
- Cancel Gogo after X but before target: zero payment and no stack object.
- Insufficient six mana in rules-legal mode: no source tap, mana payment, or
  stack object.
- Pernicious Deed X=0 is legal: zero mana, self-sacrifice still pays, stack
  ability stores `announcedX:0`.
- Two consecutive activations of a synthetic safe fixture with X=1 then X=3
  store independent values (CR 107.3k).

#### F. Unsupported variable composite

Use exact Chthonian Nightmare wording. Choosing no X/value through ACT-4 must
not pay energy, sacrifice a creature, return the enchantment, or partially
stack a CR-legal activation. It remains manual with an explicit warning.

### 7.3 Snapshot and history reviewer pins

- Restore a legacy snapshot with no ACT-4 fields and activate a fixed counter
  cost without throwing.
- Save/restore a state with an existing X-bearing ability on the stack and
  preserve `announcedX`.
- Do not restore pending tap/counter/X dialogs.
- Completed activation undo/redo is one snapshot; pending-answer interaction
  undo/redo never changes `GameState`.

## 8. UI reachability

Use the current common decision workspace:

- card-object choices are exposed through `DecisionFocusModel` and
  `DecisionBar`;
- candidate cards remain focusable and selectable by Enter/Space, not pointer
  only;
- X and counter amount/type use labeled numeric/select controls with explicit
  confirm and cancel buttons;
- add stable test ids:
  `x-cost-cancel`, `counter-cost-dialog`, `counter-cost-type`,
  `counter-cost-amount`, `counter-cost-confirm`, and
  `counter-cost-cancel`;
- every activation action remains reachable through the card action sheet /
  context-menu alternative; no drag-only or double-click-only action is added.

For a chosen-source counter cost, first highlight/select the card in the common
workspace, then show amount/type only when that choice is actually required.
Tap-N continues one card at a time with progress in the decision bar. No cost
command is applied just to provide visual feedback.

This proposal **does trigger mobile viewport checks**: it changes a common
decision flow and introduces a counter value/type dialog. Verify the standard
mobile viewport, keyboard focus order, explicit cancel/confirm reachability,
no hidden candidates under the decision bar, and zero console errors.

## 9. Minimal implementation file list

Expected production changes:

- `src/engine/grammar/compile.ts`
  - prompt/type additions only; keep `compileAbilityCost` pure and unbound-X
    manual.
- `src/engine/types.ts`
  - `remove-counter` component kind and optional `counterType`.
- `src/engine/commands.ts`
  - exact tap descriptor filtering;
  - counter-cost recognizer;
  - shared normal/mana activation-cost planner;
  - undefined-vs-zero X binding;
  - reservation/preflight helpers.
- `src/store/gameStore.ts`
  - counter answer action;
  - shared activation/mana cost prompt advancement;
  - whole-transaction counter/tap preflight;
  - one commit/cancel/undo behavior.
- `src/components/game/gameController.tsx`
  - cost candidates and counter choice routing through the decision workspace.
- `src/components/game/dialogs.tsx`
  - accessible counter amount/type dialog and stable test ids.

Expected ordinary tests:

- expand or split `src/engine/__tests__/act4CostVocabulary.test.ts` for pure
  planner parsing and exact filters;
- add store final-state ACT-4 tests beside
  `src/store/__tests__/planGogo.test.ts`;
- add focused interaction/accessibility tests beside
  `src/components/game/HudInteractions.test.tsx`.

No change is expected in `GameCommand`, `GameState`, `CACHE_SCHEMA_VERSION`, or
snapshot backfill. No effect compiler expansion is required except where an
already-supported final replay (Relic mana choice, Dragon's Hoard draw, Gogo
copy) supplies honest evidence.

## 10. Risks and non-CR open items

1. **False-green reachability:** direct normal planner tests do not exercise
   `activateAbility`'s mana-first branch. Reviewer golden A is mandatory.
2. **Counter clamp:** `addCounters` floors at zero. Missing preflight would make
   an unpayable counter cost appear paid.
3. **Filter overclaim:** broad `types:['creature']` is not enough for
   legendary/subtype/token Oracle wording.
4. **X=0 conflation:** a default numeric zero cannot represent both missing and
   announced zero; use `undefined` for missing.
5. **Cross-kind reservation:** the current global selected-card set is too
   coarse for a permanent legally used by two compatible, different cost
   resources. Reservation must be resource-specific while still forbidding a
   duplicate tap.
6. **Generated corpus denominator:** current `splitAbilityLines` yields 5,802
   lines while the historical §33 report says 5,103. This is a measurement
   artifact to regenerate only in a judge-approved implementation/report step;
   it does not change the CR order or this scope.
7. **Effect honesty:** counter-cost real cards often have unsupported "that
   much," conversion, damage, or restricted-mana effects. Cost automation must
   not be displayed as full-card resolution.

There are no unresolved CR ambiguities in the proposed subset. The only
judge-owned scope decisions to freeze are the exact descriptor grammar and
whether generic counter-type selection is included now or left manual. This
draft recommends including generic self counter type because existing
`CardInstance.counters` and the same counter dialog express it without new
state/command substrate; distributed `from among` costs remain manual.
