# S-ACTIVATED-ABILITY Envelope Design Draft

Draft lane only. Do not copy to `docs/engine-spec.md` until judge review.
This is a design-lock draft only; it does not authorize implementation.

Domain: `cr-602-activated-abilities`
Ledger position: `plannedSequence[0]`
Ledger next gate: activated ability envelope を cost/target/stack/no-stack の4点で固定する
Demand note: MyDeck 採点値はブリーフ記載のみを採用する。`Mydeck/` は読んでいない。需要は
`cost:activation 232`, `cost:tap 201`, `cost:nonmana 58`, `target 97`。

CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19.
Pinned local source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
(`rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json` sha256
`e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b`).

Primary CR refs: 115.1, 115.1c, 115.2, 115.3, 115.6, 115.9b,
117.1b, 117.1d, 117.3c, 117.7, 118.1, 118.2, 118.3, 118.3a,
118.3b, 118.10, 601.2c, 601.2f, 601.2g, 601.2h, 601.2i,
602.1, 602.1a, 602.1b, 602.2, 602.2a, 602.2b, 602.5a,
605.1a, 605.3a, 605.3b, 605.5a, 405.6c.

## 1. Current Survey

This section records code facts only; CR implications are cited where the fact
matters to the envelope.

- `src/engine/commands.ts` already has `GameCommand.addAbilityToStack` with
  `sourceId`, `kind`, optional `abilityLineIndex`, and optional
  `sourceSnapshot`. The stack object is represented by a `CardInstance` with
  `isAbility`, `sourceId`, `abilityKind`, and `abilityLineIndex`. This is the
  existing substrate for CR 602.2a stack-object creation, but it has no
  activation-time target payload yet (CR 602.2a, 602.2b, 115.1c, 601.2c).

- `activationPlanForSource(state, sourceId, abilityLineIndex?)` reads state,
  resolves an activated ability line, parses it to IR, calls
  `compileAbilityCost`, and returns existing commands plus `manaShortfall`.
  It deliberately does not include `addAbilityToStack`; `gameStore.activateAbility`
  appends the stack command. This is the current G4 cost substrate for
  activation payment (CR 602.1a, 602.2b, 118.1, 118.2, 601.2f-h).

- `compileAbilityCost` in `src/engine/grammar/compile.ts` currently models
  `mana`, self `{T}`, and self-sacrifice. It returns `manaCost` for store-side
  `parseManaCost` -> `planAutoTap` -> `payMana`, and emits existing commands
  such as `setTapped` and `moveCard`. It conservatively falls to manual for
  unmodeled nonmana cost text such as `Pay N life`, `Discard`, counters, and
  non-self sacrifice. This covers part of CR 118/601.2f-h, but not the full
  nonmana cost envelope (CR 118.1, 118.3, 118.3a, 118.3b, 118.10, 601.2f-h).

- `gameStore.activateAbility` first calls `activatedManaAbilityPlanForSource`.
  If it returns `auto`, store resolves the ability through
  `resolveManaAbilityTransaction`; it does not call `addAbilityToStack`.
  If it is a nonmana activated ability, store batches the G4 cost commands plus
  `addAbilityToStack`. This already matches the high-level split between
  normal activated abilities and activated mana abilities (CR 602.2, 605.1a,
  605.3b, 405.6c).

- `activatedManaAbilityPlanForSource` detects `shape === 'activated'`,
  rejects loyalty ability lines, rejects target-bearing IR, requires an
  `effect.add-mana`, and only returns auto commands when both cost and effect
  compile to `auto`. This is the current CR 605.1a gate: targetless, could add
  mana, non-loyalty. Targeted add-mana abilities must remain normal stack
  abilities (CR 605.1a, 605.5a).

- `src/engine/manaTransaction.ts` and engine-spec §34.11 already provide the
  mana ability transaction substrate. Activated mana abilities and triggered
  mana abilities that meet CR 605 are kept out of normal stack/pending-trigger
  routing and are resolved in a transaction-local path. This draft must not
  duplicate §34.11; it only makes the CR 602 envelope choose that path when
  `stackPolicy === no-stack` (CR 605.3b, 605.4a, 405.6c).

- Tap state already exists as `CardInstance.tapped`, with `setTapped` and
  `tapCommands`. This is sufficient as the low-level command target for `{T}`
  cost payment, while legality checks such as already tapped or summoning
  sickness are currently not a complete CR gate (CR 118.3, 602.5a).

- `markDamage` exists as a public command and damage substrate. It is relevant
  to future leaf effects that resolve activated abilities, not to the activation
  envelope itself. Damage targets still need activation-time target payload
  before a leaf can correctly compile `... deals damage to target ...`
  (CR 115.1c, 601.2c).

- There is no literal engine symbol named `targetSelections` in the current
  substrate. The closest existing pieces are G3 guided resolution:
  `EffectPrompt { kind: 'target' }`, `GuidedAnswer { kind: 'target'; cardIds }`,
  `eligibleTargets(state, filter)`, `pendingGuided`, and
  `TargetPickerDialog`. Those are resolution-time transient prompts, not
  activation-time target declarations stored on the stack object. The CR 602
  envelope must distinguish these two uses because targets for activated
  abilities are chosen as the ability is activated (CR 115.1, 115.1c, 602.2b,
  601.2c).

- engine-spec §33 is already the G4 contract for cost compilation and store-side
  activation planning. engine-spec §34.11 is already the mana transaction
  contract. This draft should become a later §34.19-style envelope section that
  references §33/§34.11 rather than restating them.

## 2. CR Grounding

- Activated abilities are written as cost before the colon and effect after the
  colon. The activation cost is everything before the colon and must be paid by
  the player activating it (CR 602.1, 602.1a). Text after the colon may also
  include activation instructions or restrictions that are followed while
  activating the ability (CR 602.1b).

- Activating an activated ability normally means putting it onto the stack and
  paying its costs. The ability becomes a non-card object on the stack, remains
  there until countered/resolved/moved, and then resolves later (CR 602.2,
  602.2a). The remainder of activation follows the casting procedure in
  601.2b-i, using the activation cost as the analog of a spell's mana cost
  (CR 602.2b).

- A player may activate an activated ability any time they have priority
  (CR 117.1b). If the player had priority before activating it, they receive
  priority afterward (CR 117.3c). If the ability is activated while another
  spell or ability is on the stack, it is in response and resolves first under
  normal stack order (CR 117.7).

- A cost is an action or payment required to take another action; paying it
  follows the instructions of the spell, ability, or effect containing that
  cost (CR 118.1). If the cost includes mana, the paying player has a chance to
  activate mana abilities, and activation cost payment follows 601.2f-h
  (CR 118.2, 601.2g). A player cannot pay a cost without the necessary resources
  to pay it fully; partial payments are not allowed (CR 118.3, 601.2h).

- Cost components may include mana, tapping permanents, sacrificing permanents,
  discarding cards, and similar payments. Total cost is determined and locked
  before payment, then mana abilities may be activated, then the costs are paid
  (CR 601.2f, 601.2g, 601.2h). Paying mana removes mana from the pool
  (CR 118.3a). Paying life subtracts life from the player's life total
  (CR 118.3b). One payment of a cost applies to only one spell, ability, or
  effect (CR 118.10).

- Some abilities require targets. Targets are object(s) and/or player(s) chosen
  as part of putting the spell or ability on the stack (CR 115.1). An activated
  ability is targeted if it uses "target [something]" for an object/player it
  will affect, and targets are chosen as the ability is activated (CR 115.1c,
  602.2b). The activation process imports the target-choice step from 601.2c
  (CR 602.2b, 601.2c).

- Only permanents are legal targets unless the spell or ability specifies a
  different zone or player, or targets an object that cannot exist on the
  battlefield such as a spell or ability (CR 115.2). The same target cannot be
  chosen multiple times for one instance of the word "target", while multiple
  target instances can choose the same object/player if each instance permits it
  (CR 115.3, 601.2c). A target can later become illegal; target-currentness is
  a separate resolution concern (CR 115.9b; CR 608 intentionally deferred here).

- Activated mana abilities are the exception. An activated ability is a mana
  ability if it requires no target, could add mana when it resolves, and is not
  a loyalty ability (CR 605.1a). Activated mana abilities may be activated
  during priority, during cost payment, or when a rule/effect asks for mana
  payment (CR 117.1d, 605.3a). They do not use the stack and resolve
  immediately (CR 605.3b, 405.6c). An ability with a target is not a mana
  ability even if it could add mana (CR 605.5a).

## 3. Envelope Design Lock

### 3.1 Activation Envelope

Recommended shape: keep `activateAbility` as the store orchestration surface,
but make the pure planning result an explicit activation envelope that is
serializable into the existing command batch and stack object metadata. This is
a design shape, not implementation code.

Required fields:

- `sourceRef`: physical card id plus source object id/snapshot where available.
  The stack ability needs source last-known information when costs move the
  source before resolution, such as self-sacrifice costs (CR 602.2a, 118.10).

- `abilityLineIndex`: the chosen activated ability line. This keeps activation
  deterministic when one object has multiple activated abilities (CR 602.1,
  602.2a).

- `cost`: the cost envelope described below, derived from the colon-left
  activation cost and any activation instruction that defines cost aspects
  (CR 602.1a, 602.1b, 601.2f).

- `targetSelections`: zero or more activation-time selections, each tied to a
  target slot in the ability text. These are chosen before cost payment is
  completed and are stored with the stack object for normal stack abilities
  (CR 115.1, 115.1c, 602.2b, 601.2c).

- `stackPolicy`: `stack` for ordinary activated abilities, or
  `mana-transaction-no-stack` for CR 605.1a activated mana abilities. Targeted
  add-mana abilities must choose `stack` because they fail CR 605.1a and are
  explicitly ordinary abilities under CR 605.5a.

- `paymentMode`: `rules-legal` or `forced`. `rules-legal` means all modeled
  required costs are payable and no partial payment is committed (CR 118.3,
  601.2h). `forced` is the app sandbox escape hatch; it may commit a
  deterministic command batch with warnings, but the UI/log must not describe
  that activation as CR-legal (CR 118.3, 601.2h).

Fork: activation storage.

- Option A, recommended: store activation-time `targetSelections`, `sourceRef`,
  and `costSummary` on the stack ability object created by `addAbilityToStack`
  or its future envelope equivalent. This follows the CR statement that targets
  are declared as part of putting the ability on the stack and gives undo/redo
  one visible object to restore (CR 115.1, 115.1c, 602.2a, 602.2b).

- Option B: keep a separate `targetSelectionsByStackId` map in `GameState`.
  This also can satisfy CR 115.1/602.2b, but it adds a second restore/backfill
  surface and a second invariant for stack object lifetime. Use only if the
  stack `CardInstance` cannot be safely extended.

### 3.2 Cost Envelope

The cost envelope is a normalized representation of every activation cost
component. It does not require every component to be auto-payable in the first
implementation; it only freezes how components are represented and how guided
payment connects to existing substrate (CR 602.1a, 602.2b, 118.1, 601.2f-h).

Required categories:

- `mana`: raw activation mana symbols plus the store-side payment plan. Existing
  G4 `compileAbilityCost.manaCost` and `planAutoTap`/`payMana` remain the
  substrate. Mana abilities may be activated before costs are paid (CR 118.2,
  117.1d, 601.2g). Paying mana removes mana from the pool (CR 118.3a).

- `tap`: self `{T}` and later object-tap costs. Self tap maps to existing
  `setTapped`. Rules-legal mode must reject tapping a permanent that cannot be
  tapped to pay the cost, including already tapped resources and creature
  `{T}`/`{Q}` activation restrictions unless explicitly forced by sandbox UI
  (CR 118.3, 602.5a). Current G4 covers self `{T}` only.

- `nonmana`: sacrifice, pay life, discard, remove counters, pay player counters
  such as energy, exile-as-cost, and other nonmana payload costs. Existing low
  level commands cover some leaves: `moveCard` for sacrifice, `adjustLife` for
  pay life, `discard` for discard, `addCounters` with negative delta or
  `adjustPlayerCounter` for counters, and `setTapped` for object taps. The
  envelope must distinguish "recognized but guided/manual" from "unparsed";
  both are different from "auto paid" (CR 118.1, 118.3, 118.3b, 118.10,
  601.2f-h).

Recommended component fields:

- `kind`: `mana`, `tap-self`, `tap-object`, `sacrifice-self`,
  `sacrifice-object`, `pay-life`, `discard`, `remove-counter`,
  `pay-player-counter`, `exile-object`, or `unknown`.

- `raw`: the exact cost text fragment that produced the component. This keeps
  later audit cheap and preserves Oracle-text grounding (CR 602.1a, 601.2f).

- `payerId`: normally the activating player/controller. The envelope should not
  assume P1 forever, because costs are paid by the activating player
  (CR 602.1a).

- `subjectRef`: for object costs, the chosen object. Self costs can use
  `sourceRef`. Non-self costs require guided selection before payment is
  committed (CR 118.1, 118.10, 601.2f-h).

- `amount`: mana pool amount, life amount, counter amount, or discard count.
  Rules-legal mode must verify sufficient resources before committing and must
  not make partial payments (CR 118.3, 118.3a, 118.3b, 601.2h).

- `status`: `auto`, `guided`, `manual`, or `unparsed`. Current §33 auto support
  is `mana`, `tap-self`, and `sacrifice-self`. `Pay life`, `Discard`, non-self
  sacrifice, and counter payments should be represented even if their first leaf
  remains guided/manual (CR 118.1, 601.2f).

Atomicity rule: in `rules-legal` mode, cost payment and stack/no-stack
activation are one activation transaction. If any required modeled cost cannot
be paid or any required target/cost choice is missing, no cost command and no
stack/no-stack activation is committed. This is the CR-faithful default
(CR 602.2, 118.3, 601.2h). In `forced` mode, the same transaction may commit
with warnings, but the warnings must explicitly mark the activation as sandbox
forced rather than CR-legal (CR 118.3, 601.2h).

Connection to existing substrate:

- Existing §33 `compileAbilityCost` remains the auto compiler for `mana`,
  `tap-self`, and `sacrifice-self`. The new envelope wraps its output and adds
  nonmana component identities instead of replacing it (CR 602.1a, 601.2f-h).

- Existing `manaTransaction` remains the execution substrate for
  `stackPolicy = mana-transaction-no-stack`. The cost envelope supplies the
  cost commands that enter the transaction; it does not create normal stack
  objects for CR 605.1a abilities (CR 605.1a, 605.3b, 405.6c).

- Existing `markDamage` remains a leaf-effect command and is not part of cost
  payment. Damage abilities that target object/player need the target envelope
  first, then a future leaf compiler can map the effect to damage commands
  (CR 115.1c, 601.2c; CR 608 deferred).

### 3.3 Target Envelope

Activation targets are chosen when the activated ability is activated, not when
it resolves (CR 115.1c, 602.2b, 601.2c). The target envelope must therefore be
persisted in the activation/stack object, not only in G3 resolution-time
`pendingGuided`.

Required target slot fields:

- `slotId`: deterministic order in the ability line, including separate slots
  for repeated instances of the word `target` (CR 115.3, 601.2c).

- `raw`: target phrase such as `target creature`, `target player`, or
  `any target`. This preserves the rule text that made the ability targeted
  (CR 115.1c, 115.4).

- `kind`: `object`, `player`, or `object-or-player`. `object` must be able to
  represent permanents and later stack objects or objects in other zones when
  text permits them. `player` must use `PlayerId`, not only an opponent label
  (CR 115.1, 115.2).

- `selection`: for objects, physical card id plus object id and optional
  snapshot; for players, `PlayerId` plus compatibility display label if needed.
  Object id/snapshot are required so later resolution can distinguish the chosen
  object from a new object with the same physical card id after zone change
  (CR 115.9b).

- `legalityMode`: `checked`, `unchecked-warning`, or `forced`. The app may keep
  the sandbox philosophy by warning instead of prohibiting choices, but the
  envelope must record whether the target was selected under a full legal check
  or only by a best-effort filter (CR 115.2, 115.3, 601.2c).

Existing G3 target prompts may be reused as UI plumbing, but only if their
answer is stored immediately into the activation envelope before the ability is
placed on the stack. A targeted activated ability must not wait until resolution
to choose its CR target (CR 115.1, 115.1c, 602.2b, 601.2c).

Illegal-target resolution is deliberately deferred. This envelope only fixes
the chosen target identity and the fact that it was chosen at activation. What
to do when all/some targets are illegal on resolution belongs to the CR 608
resolution slice. Until then, a resolver may warn/manual out, but it must not
silently retarget or re-prompt as though no activation-time target existed
(CR 115.9b; CR 608 deferred).

### 3.4 Stack vs No-Stack

Normal activated abilities use `stackPolicy = stack`. The activation produces
one stack ability object containing at least source reference, ability line,
target selections, and cost summary. Costs and stack placement are a single
activation transaction for undo/redo even if the internal command order is an
implementation detail (CR 602.2, 602.2a, 602.2b, 117.1b, 117.3c, 117.7).

Activated mana abilities use `stackPolicy = mana-transaction-no-stack` only
when all CR 605.1a criteria are met: activated, targetless, could add mana on
resolution, and not loyalty. They resolve immediately through the existing
mana transaction path and must not create a normal stack object (CR 605.1a,
605.3b, 405.6c).

Targeted add-mana abilities are ordinary activated abilities. A phrase such as
`Target player adds {G}` fails the targetless requirement, so it must use the
normal stack envelope with activation-time target selection (CR 115.1c,
605.1a, 605.5a).

`effectsAuto` is not a rules switch for no-stack behavior. It may control
whether costs/effects are auto/guided, but a CR 605.1a mana ability must not be
converted into a normal stack ability when automation is disabled (CR 605.1a,
605.3b, 405.6c). This preserves the existing §33 I9 exception and §34.11 mana
transaction contract.

## 4. Invariant Candidates

Judge assigns final I numbers. Candidate review owners are suggestions only;
implementation agents must not edit `review.*`.

- Candidate I?: activation cost atomicity. In `rules-legal` mode, an activated
  ability commits no cost command and no stack/no-stack activation unless every
  required modeled cost is payable and every required activation choice is
  present. No partial payment is allowed. In `forced` mode, the same command
  batch may commit, but warnings/logs must mark it forced. Candidate reviews:
  `review.activated-envelope-cost` or extension of `review.g4-activate`.
  CR refs: 602.2, 118.3, 601.2f-h.

- Candidate I?: cost component determinism. The same state, source id, ability
  line, target/cost answers, and force flag produce the same cost envelope and
  command batch. Mana payment choices and shuffled/library-moving costs must be
  command payloads before commit. Candidate review:
  `review.activated-envelope-cost-determinism`. CR refs: 601.2f, 601.2g,
  601.2h, 602.2b.

- Candidate I?: activation target determinism. A targeted activated ability
  stores target selections on the stack object at activation time. Resolution
  uses those stored selections and never enumerates a fresh target silently.
  Candidate review: `review.activated-envelope-targets`. CR refs: 115.1,
  115.1c, 115.3, 601.2c, 602.2b.

- Candidate I?: target UI non-mutation. Opening/canceling an activation target
  or guided cost picker must not change `GameState`; only final activation
  confirmation can commit the activation transaction. Candidate review:
  `review.activated-envelope-ui`. CR refs: 602.2, 601.2c, 601.2f-h.

- Candidate I?: normal stack placement. A nonmana activated ability produces
  exactly one stack ability object carrying source, ability line, target
  selections, and cost summary. It does not resolve its effect during
  activation. Candidate review: `review.activated-envelope-stack`. CR refs:
  602.2a, 117.3c, 117.7.

- Candidate I?: mana ability isolation. A CR 605.1a activated mana ability never
  creates an `addAbilityToStack` object and never routes through ordinary
  pending-trigger/stack handling; it resolves through `manaTransaction`.
  Targeted add-mana abilities fail this invariant's antecedent and remain
  ordinary stack abilities. Candidate reviews: existing
  `review.g4-activate`, existing `review.mana-transaction`, and a targeted
  add-mana adversarial case. CR refs: 605.1a, 605.3b, 605.5a, 405.6c.

## 5. Scope Boundaries

The envelope freezes cost/target/stack-no-stack shape only. These remain
deferred and must not be smuggled into this gate:

- Individual card effect leaf compiler implementation after the ability is on
  the stack. This draft can preserve target payload for future leaves, but it
  does not implement all effects (CR 602.2a; CR 608 deferred).

- Illegal target resolution details, including all-targets-illegal or
  some-targets-illegal behavior. This belongs to CR 608. The envelope only
  stores activation-time target identity (CR 115.9b; CR 608 deferred).

- Complex costs and cost modifications such as convoke/delve-like mechanics,
  cost increases/reductions, variable X decisions beyond current §33, costs
  involving hidden-zone random/public movement, and keyword-specific cost
  systems. The envelope must represent unknown/unparsed components without
  pretending they are auto-payable (CR 601.2f-h, 118.4).

- Loyalty abilities and planeswalker activation rules. CR 605.1a explicitly
  excludes loyalty abilities from activated mana ability status, and full
  loyalty handling belongs to a CR 606 slice (CR 605.1a; CR 606 deferred).

- Full CR 601 casting procedure. This draft imports 601.2c/f-i only because
  CR 602.2b says those steps apply to activation. It does not close full spell
  casting, modes, alternative costs, or cast-from-zone permission (CR 602.2b;
  CR 601 deferred).

- Activation restrictions such as `Activate only as a sorcery`, "only once each
  turn", and summoning-sickness enforcement for `{T}`/`{Q}` may be represented
  as warnings/guidance in this envelope, but full prohibition tracking is not
  part of the first design lock. The app sandbox may warn and allow forced
  activation; it must not label forced activation as CR-legal (CR 602.5a-e,
  118.3).

- Opponent-chosen targets/modes during activation are recognized by CR 602.3
  but deferred. The envelope should have enough `chosenByPlayerId` shape later,
  but this gate does not implement multiplayer choice routing (CR 602.3,
  602.3a, 602.3b).

## 6. engine-spec §34.19 Promotion Skeleton

Proposed heading:

`### 34.19 S-ACTIVATED-ABILITY / ENVELOPE(CR 602 + 115 + 118 + 605)— この節も契約である`

Promotion outline:

1. Positioning: plannedSequence[0], demand-first gate for real-deck activated
   ability idioms. State explicitly that §33 G4 cost compiler and §34.11 mana
   transaction already exist, and §34.19 freezes the activation envelope around
   them. CR refs: 602.1, 602.2, 605.1a.

2. Current substrate: summarize `activateAbility`,
   `activationPlanForSource`, `activatedManaAbilityPlanForSource`,
   `compileAbilityCost`, `manaTransaction`, tap state, and current absence of
   activation-time target payload. CR refs: 602.2a, 602.2b, 115.1c, 601.2c,
   605.3b.

3. Type contract: activation envelope with source ref, line index, cost
   envelope, target selections, stack policy, payment mode, and warnings. CR
   refs: 602.1a, 602.2a, 602.2b, 118.3, 601.2c, 601.2f-h.

4. Cost contract: mana/tap/nonmana component classes; existing §33 maps
   `mana`/`tap-self`/`sacrifice-self`; new envelope records pay-life,
   discard, non-self sacrifice, counters, and unknown components without
   claiming auto support. CR refs: 118.1, 118.2, 118.3, 118.3a, 118.3b,
   118.10, 601.2f-h.

5. Target contract: activation-time object/player target selections stored
   with the stack ability; G3 guided resolution prompts are UI plumbing only
   unless their answers are written to activation payload before stack
   placement. CR refs: 115.1, 115.1c, 115.2, 115.3, 115.9b, 601.2c,
   602.2b.

6. Stack/no-stack contract: ordinary activated abilities create one stack
   ability object; CR 605.1a activated mana abilities use
   `manaTransaction` and never `addAbilityToStack`; targeted add-mana is
   ordinary stack. CR refs: 602.2a, 117.3c, 117.7, 605.1a, 605.3b, 605.5a,
   405.6c.

7. Invariants and review anchors: cost atomicity, cost determinism, target
   determinism, target UI non-mutation, normal stack placement, mana ability
   isolation. CR refs: 602.2, 118.3, 601.2c, 601.2h, 605.3b.

8. Scope boundaries: leaf effects, CR 608 illegal target resolution, complex
   costs, loyalty abilities, full CR 601 casting, activation restrictions, and
   opponent-chosen activation choices. CR refs: 608 deferred, 601 deferred,
   606 deferred, 602.3, 602.5.
