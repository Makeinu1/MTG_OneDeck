# CR 701.21 sacrifice effect leaf compiler draft

Status: Codex implementer draft for judge re-owner review.

## Grounding

- CR 701.21a: to sacrifice a permanent, its controller moves it from the battlefield directly to its owner's graveyard.
- CR 701.21a: a player cannot sacrifice a non-permanent or a permanent they do not control.
- CR 701.21a: sacrificing a permanent is not destruction, so regeneration and other destruction replacement effects do not apply.

## Implemented slice

The compiler may treat only these English oracle effect clauses as automatic or guided:

- auto: `Sacrifice this creature.` and the same `this <permanent type>` self-reference form.
- auto: `Sacrifice CARDNAME.` when `CARDNAME` matches the source card name.
- guided: `Sacrifice a creature.`, `Sacrifice a permanent.`, `Sacrifice an artifact.`, `Sacrifice an enchantment.`, `Sacrifice a land.`, `Sacrifice a planeswalker.`
- guided: the same single-object clauses with explicit `You sacrifice ...`.

Guided sacrifice asks the P1 solo player to choose exactly one current battlefield permanent they control matching the supported permanent type. The resulting command is:

```ts
{ type: 'moveCard', cardId: chosenPermanentId, to: 'graveyard', position: 'bottom' }
```

This preserves the project rule that compiler output is only `GameCommand` data and never direct `GameState` mutation. It also keeps sacrifice distinct from destruction: no destroy command, regeneration hook, or destruction replacement path is introduced.

## Invariants

- CR701-SAC-I1: a supported non-self sacrifice effect is `guided`, not `auto`, because CR 701.21a makes the controller choose one of their own permanents.
- CR701-SAC-I2: store confirmation accepts only a card currently in `state.zones.battlefield` whose `controllerId` is `P1` and whose type matches the prompt filter.
- CR701-SAC-I3: auto self-sacrifice only moves `ctx.sourceId`; it does not pick another permanent.
- CR701-SAC-I4: the selected permanent moves to graveyard through the existing `moveCard` command, so undo/history, zone-change events, death/LTB trigger collection, and commander graveyard handling stay shared with other zone moves.
- CR701-SAC-I5: resolving a stack item with a guided sacrifice first applies the selected sacrifice command, then resolves the stack item normally; mixed auto+guided carry commands remain preserved.

## Defer

- `Sacrifice two ...` and larger counts.
- `Each player sacrifices ...`, `each opponent sacrifices ...`, and other opponent/player-model clauses.
- target-player sacrifice clauses.
- `unless` clauses and optional `may sacrifice ...` choices.
- `another`, `nontoken`, tapped/untapped, color, power, mana value, subtype, and other qualified sacrifice choices.
- owner-specific graveyard routing after S-ZONES per-player zones land.

## Golden candidates

- `cr-701-sacrifice-guided-creature`: resolving `Sacrifice a creature.` opens a sacrifice prompt, choosing a controlled battlefield creature moves it to graveyard, and the stack item resolves.
- `cr-701-sacrifice-auto-self`: resolving a triggered ability with `Sacrifice this creature.` moves the source permanent from battlefield to graveyard without a prompt.
- `cr-701-sacrifice-not-controlled-invalid`: `Sacrifice a permanent.` does not allow choosing a battlefield permanent with `controllerId !== P1`.
- `cr-701-sacrifice-multi-manual`: `Sacrifice two creatures.` stays manual until multi-select choice handling exists.
- `cr-701-sacrifice-each-player-manual`: `Each player sacrifices a creature.` stays manual until opponent/player sacrifice is modeled.
