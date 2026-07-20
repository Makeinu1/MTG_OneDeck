# Cast-time stack targets contract draft

Status: judge review required. This draft does not change `docs/`, the ledger, or reviewer-owned tests.

## Observed failure

The UI can list stack objects for the shipped five exact counter-spell patterns, but the current guided flow asks for the target while resolving the counterspell. Until then the stack workspace has no stored target, so the user cannot understand or draw the spell-to-spell relationship at response time.

## CR grounding

- CR 115.1a: an instant or sorcery spell's targets are chosen as the spell is cast.
- CR 601.2c: announce every required target during casting; chosen objects become targets at that point.
- CR 601.2h: pay the total cost after target choice; partial payment is not allowed.
- CR 601.2i: the spell becomes cast only after 601.2a–h complete.
- CR 602.2b: activated abilities reuse the 601.2b–i process.
- CR 608.2b: re-check the already chosen targets for legality during resolution.
- CR 701.6a: countering removes the chosen spell from the stack without resolving it.

## Proposed additive contract

1. Introduce a pending cast transaction containing the source card, derived prompts, chosen modes/targets, X, and intended payment. Do not mutate `GameState` yet.
2. Choose required targets before committing the cast. `eligibleTargets` continues to supply the deterministic candidate set.
3. Cancel leaves the card, mana pool, and stack unchanged.
4. Commit payment and stack insertion as one undoable batch after all mandatory choices are present.
5. Persist `targetSelections` on the stack object so Stack Workspace can display and connect source-to-target immediately.
6. At resolution, CR 608.2b validates the stored selection; do not ask the user to choose a new target.
7. First slice remains the existing five exact counter-spell patterns. Modified/follow-up/unless patterns stay honest-manual.

## Required judge-owned acceptance updates

- Replace resolution-time choice pins for the shipped five patterns with cast-time selection pins.
- Pin cancel atomicity, undo/redo, snapshot restore/backfill, and deterministic replay.
- Pin stack-to-stack target presentation before resolution and illegality handling after the target leaves the stack.
- Keep all existing fail-closed pattern boundaries.

## Ledger relationship

This is the `cr-115-targets.nextGate` item: spell cast-time target storage plus complete CR 608.2b resolution handling. The ledger remains judge-owned and is not edited here.

