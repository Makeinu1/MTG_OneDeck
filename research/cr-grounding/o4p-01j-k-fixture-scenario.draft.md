# O4P-01J-K Fixture and Scenario Assets

Status: implemented-not-integrated

This lane adds only a compact JSON transaction document and ordinary tests. It
does not change a public index, production code, Solo/store/components/online
code, or any review test.

## Fixture

`src/engine/core/stack/transaction/fixtures/stack-transaction-v1.json` is a
four-player, synthetic-card-only document with:

- cards in library, hand, graveyard, battlefield, and exile;
- an existing mixed stack containing a card spell, spell copy, activated
  ability, and triggered ability;
- one card commit and three synthetic commit inputs with expected IDs;
- one-target and multi-target retarget inputs; and
- graveyard, battlefield, cease, and middle-stack removal inputs.

The card definition uses only the short fixture text `Fixture effect.` and
contains no secret or external data.

## Scenario coverage

The ordinary tests load this document and call the transaction modules directly
(bundle, card commit, synthetic commit, retarget, and removal). They assert:

1. canonical four-player bundle creation;
2. card hand commit `PC2:0 -> PC2:1` and stack-tail append;
3. spell-copy, activated-ability, and triggered-ability synthetic commits;
4. one-target and multi-target retarget while preserving modes, X, costs, and
   distributions;
5. card removal `PC5:1 -> PC5:2` to owner graveyard and battlefield, including
   battlefield controller;
6. synthetic cease and middle-stack order preservation; and
7. JSON/input bytes unchanged after each operation.

No public index integration is part of this lane.
