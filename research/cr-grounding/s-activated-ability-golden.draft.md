# S-ACTIVATED-ABILITY Golden and Adversarial Draft

Draft lane only. Do not edit `research/cr-grounding/golden-cases.json` or
`review.*` from this draft. These cases are design-lock candidates for judge
review.

Domain: `cr-602-activated-abilities`
Primary draft: `research/cr-grounding/s-activated-ability-envelope.draft.md`
CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19,
pinned at `rule/Magic_The_Gathering_Comprehensive_Rules.txt`.

Primary CR refs: 115.1, 115.1c, 115.2, 115.3, 115.6, 115.9b,
117.1b, 117.1d, 117.3c, 117.7, 118.1, 118.2, 118.3, 118.3a,
118.3b, 118.10, 601.2c, 601.2f, 601.2g, 601.2h, 601.2i,
602.1, 602.1a, 602.1b, 602.2, 602.2a, 602.2b, 602.5a,
605.1a, 605.3a, 605.3b, 605.5a, 405.6c.

## 1. Golden Cases

### G1. `cr-602-tap-target-normal-stack`

Oracle fixture:

`{T}: Tap target creature.`

Setup:

- Source permanent is untapped on battlefield.
- One other battlefield creature is chosen as the target.

Expected envelope:

- Cost envelope has `tap-self` for the source `{T}` cost.
- Target envelope has one activation-time `object` target slot for
  `target creature`; the chosen creature id/object id is stored on the stack
  ability.
- Stack policy is `stack`; the ability effect does not resolve during
  activation.
- The activation transaction taps the source and creates exactly one activated
  ability stack object carrying source, ability line, cost summary, and target
  selection.

CR refs:

- `{T}` before the colon is activation cost (CR 602.1, 602.1a).
- Targets for activated abilities are chosen as the ability is activated
  (CR 115.1c, 602.2b, 601.2c).
- Normal activated abilities go on the stack and resolve later (CR 602.2,
  602.2a, 117.3c, 117.7).
- Cost payment must be complete in rules-legal mode (CR 118.3, 601.2h).

Review candidate:

- `review.activated-envelope-targets`
- `review.activated-envelope-stack`

### G2. `cr-602-sacrifice-self-cost-normal-stack`

Oracle fixture:

`Sacrifice CARDNAME: Draw a card.`

Setup:

- Source permanent is on battlefield.
- No target is required.

Expected envelope:

- Cost envelope has `sacrifice-self` with `subjectRef = sourceRef`.
- Target envelope is empty.
- Stack policy is `stack`.
- Activation moves the source to graveyard as a cost and creates one stack
  ability with source snapshot/last-known reference so the ability can resolve
  even though the source permanent left the battlefield.

CR refs:

- `Sacrifice CARDNAME` before the colon is activation cost (CR 602.1a).
- One cost payment applies only to this activation (CR 118.10).
- The ability object exists on the stack independent of the source permanent
  after activation (CR 602.2a).
- Costs must be paid fully in rules-legal mode (CR 118.3, 601.2h).

Review candidate:

- `review.activated-envelope-cost`
- Extension of `review.g4-activate`

### G3. `cr-602-tap-pay-life-sacrifice-cost-stack`

Oracle fixture:

`{T}, Pay 1 life, Sacrifice CARDNAME: Draw a card.`

Setup:

- Source permanent is untapped on battlefield.
- Player has at least 1 life.
- No target is required.

Expected envelope:

- Cost envelope has three components in deterministic slot order:
  `tap-self`, `pay-life amount=1`, and `sacrifice-self`.
- Target envelope is empty.
- Stack policy is `stack`.
- In `rules-legal` mode, all three cost components and stack placement commit
  as one activation transaction. If any required resource is missing, no
  partial payment and no stack object are committed.
- In `forced` mode, the transaction may commit only with explicit forced
  warnings; the result must not be reported as CR-legal.

CR refs:

- Cost components can include mana, tapping, sacrificing, discarding, and
  similar payments (CR 601.2f).
- Paying life subtracts from life total (CR 118.3b).
- A player cannot pay costs without sufficient resources, and partial payments
  are not allowed (CR 118.3, 601.2h).
- Normal activated abilities use the stack (CR 602.2, 602.2a).

Review candidate:

- `review.activated-envelope-cost`
- `review.activated-envelope-cost-determinism`

### G4. `cr-602-sacrifice-cost-target-stack`

Oracle fixture:

`Sacrifice CARDNAME: Destroy target artifact.`

Setup:

- Source permanent is on battlefield.
- One battlefield artifact is chosen as target.

Expected envelope:

- Cost envelope has `sacrifice-self`.
- Target envelope has one activation-time `object` target for
  `target artifact`.
- Stack policy is `stack`.
- The target is selected before activation commit and stored on the stack
  ability. The later destroy effect is a leaf compiler concern; this golden
  only pins that the activation does not wait until resolution to choose the
  target.

CR refs:

- Sacrifice text before the colon is activation cost (CR 602.1a).
- Activated ability targets are chosen as the ability is activated
  (CR 115.1c, 602.2b, 601.2c).
- Effects happen on resolution, not during activation, for normal stack
  abilities (CR 602.2a, 117.7; CR 608 deferred).

Review candidate:

- `review.activated-envelope-targets`

### G5. `cr-605-targetless-tap-add-mana-no-stack`

Oracle fixture:

`{T}: Add {G}.`

Setup:

- Source permanent is untapped on battlefield.
- Ability is not a loyalty ability.
- No target is required.

Expected envelope:

- Cost envelope has `tap-self`.
- Target envelope is empty.
- Stack policy is `mana-transaction-no-stack`.
- Activation resolves through `manaTransaction`, taps the source, adds `{G}`,
  and creates no normal stack ability object.

CR refs:

- This is an activated ability with no target that could add mana and is not
  loyalty, so it is an activated mana ability (CR 605.1a).
- Activated mana abilities resolve immediately and do not use the stack
  (CR 605.3b, 405.6c).
- Mana abilities may be activated during priority and during mana payment
  windows (CR 117.1d, 605.3a).

Review candidate:

- Existing `review.g4-activate`
- Existing `review.mana-transaction`

### G6. `cr-605-targeted-add-mana-is-normal-stack`

Oracle fixture:

`{T}: Target player adds {G}.`

Setup:

- Source permanent is untapped on battlefield.
- A player target is chosen.

Expected envelope:

- Cost envelope has `tap-self`.
- Target envelope has one activation-time `player` target.
- Stack policy is `stack`, not `mana-transaction-no-stack`.
- Activation taps the source and creates one normal stack ability. It does not
  immediately add mana.

CR refs:

- An ability with a target is not a mana ability even if it could add mana
  (CR 605.5a).
- Target choice occurs as the activated ability is activated (CR 115.1c,
  602.2b, 601.2c).
- Because it is not a mana ability, it follows normal activated ability stack
  handling (CR 602.2, 602.2a, 117.7).

Review candidate:

- `review.activated-envelope-stack`
- Targeted add-mana adversarial extension to `review.mana-transaction`

## 2. Adversarial Cases

### A1. `cr-602-tap-cost-already-tapped-rules-legal-fails`

Oracle fixture:

`{T}: Draw a card.`

Setup:

- Source permanent is already tapped.
- `paymentMode = rules-legal`.

Expected envelope:

- Cost envelope recognizes `tap-self`, but payment validation fails.
- No stack object is created and no cost command is committed.
- If product UI allows a forced activation, it must be a separate
  `paymentMode = forced` path with explicit warning.

CR refs:

- A permanent that is already tapped cannot be tapped to pay a cost
  (CR 118.3).
- Costs must be paid fully and partial payments are not allowed (CR 118.3,
  601.2h).

Review candidate:

- `review.activated-envelope-cost`

### A2. `cr-602-pay-life-insufficient-rules-legal-fails`

Oracle fixture:

`Pay 2 life: Draw a card.`

Setup:

- Player has only 1 life.
- `paymentMode = rules-legal`.

Expected envelope:

- Cost envelope recognizes `pay-life amount=2`.
- Payment validation fails.
- No life total change and no stack object are committed.
- Forced sandbox activation, if present, must warn that the payment is not
  CR-legal.

CR refs:

- Paying life subtracts from the player's life total (CR 118.3b).
- A player cannot pay a cost without the necessary resources to pay it fully
  (CR 118.3).
- Partial payments are not allowed (CR 601.2h).

Review candidate:

- `review.activated-envelope-cost`

### A3. `cr-602-target-selection-cancel-no-mutation`

Oracle fixture:

`{T}: Destroy target creature.`

Setup:

- Source permanent is untapped.
- Target picker is opened and then canceled before activation confirmation.

Expected envelope:

- No activation envelope is committed.
- Source remains untapped, no stack object is created, and no target selection
  is persisted.

CR refs:

- Target selection and cost payment are part of activating the ability
  (CR 115.1c, 602.2b, 601.2c, 601.2f-h).
- If activation is not completed, the game returns to before activation began
  for illegal/incomplete activation handling (CR 602.2).

Review candidate:

- `review.activated-envelope-ui`

### A4. `cr-602-target-leaves-before-resolution-no-retarget`

Oracle fixture:

`{T}: Destroy target creature.`

Setup:

- Source activates and chooses a target creature.
- Before resolution, the chosen target changes zone or becomes a new object.

Expected envelope:

- Stack ability still stores the original target selection.
- Resolver must not silently choose a new target or re-open a target picker.
- Actual resolution behavior for illegal targets is deferred to CR 608; until
  then, manual/warning is acceptable.

CR refs:

- Targets are chosen at activation, not resolution (CR 115.1c, 602.2b,
  601.2c).
- Objects checking current target state ignore targets no longer in the
  expected zone; last-known information is not used for that target check
  (CR 115.9b).
- Illegal-target resolution belongs to CR 608 and is out of this envelope.

Review candidate:

- `review.activated-envelope-targets`

### A5. `cr-602-multiple-target-slots-stable-order`

Oracle fixture:

`{T}: Tap target creature and untap target artifact.`

Setup:

- Source permanent is untapped.
- One creature and one artifact are chosen.

Expected envelope:

- Target envelope has two target slots in text order.
- Each slot stores its raw phrase and chosen object identity separately.
- The same physical card can only satisfy both slots if it legally fits each
  distinct target instance; a single target instance cannot choose the same
  object twice.

CR refs:

- Multiple target instances are distinct, and the same target cannot be chosen
  multiple times for one instance of the word `target` (CR 115.3, 601.2c).
- Targets are selected during activation (CR 115.1c, 602.2b).

Review candidate:

- `review.activated-envelope-targets`

### A6. `cr-605-non-loyalty-gate`

Oracle fixture:

`+1: Add {G}.`

Setup:

- Ability line is on a planeswalker-like loyalty source.

Expected envelope:

- It must not use `mana-transaction-no-stack` solely because it adds mana.
- Loyalty ability handling is deferred to CR 606; this draft only requires the
  CR 605.1a exclusion to be visible.

CR refs:

- An activated mana ability must not be a loyalty ability (CR 605.1a).
- Loyalty ability implementation is outside this envelope (CR 606 deferred).

Review candidate:

- `review.activated-envelope-stack`

## 3. Suggested Promotion Notes

- Promote G1-G6 as CR-grounded golden candidates once the judge approves the
  envelope fields. They cover the real-deck idioms requested by the brief:
  `{T}:`, `Sacrifice:`, and `{T}, Pay life, Sacrifice:`.

- Promote A1-A6 as adversarial review candidates, not necessarily all as
  `golden-cases.json` entries. A1/A2 pin cost atomicity, A3 pins UI
  non-mutation, A4/A5 pin target determinism, and A6 pins the CR 605.1a
  no-stack gate.

- Keep CR 608 illegal-target resolution out of the PASS claim. A4 should assert
  "no retarget/no re-prompt" only; it should not assert final resolution
  semantics until the CR 608 slice is frozen.
