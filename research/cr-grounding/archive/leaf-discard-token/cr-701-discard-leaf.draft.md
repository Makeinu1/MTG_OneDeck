# CR 701.9 discard leaf compiler draft

Status: Codex implementer draft for judge re-owner review.

## Grounding

- CR 701.9a: discarding a card moves it from its owner's hand to that player's graveyard.
- CR 701.9b: by default, the affected player chooses which card to discard.
- CR 404.1: a player's graveyard is that player's discard pile.

## Implemented slice

The compiler may treat only these English oracle clauses as guided, not auto:

- `Discard a card.`
- `You discard a card.`
- the same with `one card` instead of `a card`

The guided prompt asks the P1 solo player to choose exactly one current hand card. The resulting command is:

```ts
{ type: 'discard', cardIds: [chosenCardId] }
```

This preserves the project rule that compiler output is only `GameCommand` data and never direct `GameState` mutation.

## Invariants

- CR701-DISCARD-I1: a supported discard effect is `guided`, not `auto`, because CR 701.9b gives the affected player a choice.
- CR701-DISCARD-I2: store confirmation accepts only a card currently in `state.zones.hand`.
- CR701-DISCARD-I3: the selected card moves to graveyard through the existing `discard` command, so undo/history and zone-change handling remain shared with other discard paths.
- CR701-DISCARD-I4: resolving a stack item with a guided discard first applies the selected discard command, then resolves the stack item normally.

## Defer

- `Discard two cards` and larger counts.
- `Discard your hand`.
- random discard and opponent/target-player discard.
- replacement effects such as madness, and hidden-zone replacement handling in CR 701.9c.
- player-specific hand/graveyard routing after S-ZONES per-player zones land.

## Golden candidates

- `cr-701-discard-guided-one-card`: resolving `Discard a card.` opens a discard prompt, choosing a current hand card moves it to graveyard, and the stack item resolves.
- `cr-701-discard-multi-card-manual`: `Discard two cards.` stays manual until multi-select choice handling exists.
- `cr-701-discard-target-player-manual`: `Target player discards a card.` stays manual until target-player discard is modeled.
