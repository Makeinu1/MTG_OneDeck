# cr-118-costs implementation handoff draft

Status: implementer draft for judge re-ownership. No `docs/`, `review.*`, or git changes made by Codex.

CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, fixed to 2026-06-19.

## Implemented scope

Implemented the Step 1 promotion hypothesis from `research/cr-grounding/cr-118-costs.draft.md`:

- Fixed `Pay N life` activation-cost elements compile to existing `{ type: 'adjustLife', delta: -N }`.
- Strict self-exile activation-cost elements compile to existing `{ type: 'moveCard', to: 'exile', position: 'top' }`.
- `Pay X life`, `{X}`, chosen/numbered exile costs, non-self exile costs, and conflicting self sacrifice + self exile remain manual.
- No new `GameCommand` type and no new `GameState` field.
- The no-stack mana-ability activation path now blocks unpayable fixed life costs in rules-legal mode, matching the existing `{T}` cost atomicity behavior.

## CR grounding

- CR 118.1: Paying a cost means carrying out the instructions specified by the cost.
- CR 118.3b / 119.4: Paying life subtracts that amount from the player's life total. Fixed `N` maps to the existing `adjustLife -N`; `X` is excluded because it needs value choice/binding.
- CR 107.3a / 118.4: `X` in a cost is chosen as part of the activation/cost process, so it is not deterministic auto in this slice.
- CR 602.1 / 602.1a / 602.2b: Activated ability costs are the text before the colon and are paid by the activating player using the spell-cost payment procedure.
- CR 601.2f / 601.2h: Costs are determined then paid; the engine chooses a deterministic command order for modeled cost elements.
- CR 701.13a / 406.2: Exiling moves an object to the exile zone, so strict self-exile maps to existing `moveCard` to `exile`.
- CR 400.7j: An ability can find an object moved to a public zone to pay a cost.

## Code files changed

- `src/engine/grammar/compile.ts`
  - Adds fixed `Pay N life` recognition.
  - Adds strict self-exile recognition for `it`, `~`, `this ...`, and exact card-name references, including comma-bearing names.
  - Keeps broad ability/flavor-word label normalization deferred.
  - Keeps both self-sacrifice and self-exile in the same cost manual to avoid double-moving the source.
- `src/engine/commands.ts`
  - Adds `lifeCost` to `activatedManaAbilityPlanForSource` for legality checks on no-stack mana abilities.
- `src/store/gameStore.ts`
  - Blocks unpayable fixed life costs for mana abilities in rules-legal mode; forced mode still proceeds with a warning under the sandbox policy.

## Implementer tests added

- `src/engine/__tests__/cr118CostsCompiler.test.ts`
  - Fixed pay-life + tap + self-sacrifice compiles auto.
  - Strict self-exile compiles auto.
  - Exact comma-bearing card-name self-exile compiles auto.
  - `Pay X life`, chosen exile, and conflicting self-zone moves remain manual.
- `src/store/__tests__/manaWriteActivatedAbility.test.ts`
  - Fixed pay-life mana ability pays life, taps, adds mana, and uses no stack.
  - Unpayable fixed pay-life mana ability is blocked in rules-legal mode.
- `src/store/__tests__/activatedAbilityEnvelope.test.ts`
  - Strict self-exile cost moves the source to exile before stacking the activated ability while preserving the activation-time source snapshot.

## Judge-owned follow-up required

These files still encode the old contract and need judge re-ownership before full green:

Ready-to-review patch draft:

- `research/cr-grounding/cr-118-costs-reowner.draft.patch`
  - `patch --dry-run -p1 < research/cr-grounding/cr-118-costs-reowner.draft.patch`: pass in the current worktree.

- `src/engine/__tests__/review.grammar-cost.test.ts`
  - Existing old pin: `"{T}, Pay 3 life: Draw a card." -> manual`.
  - New expected pin from `cr-118-costs.draft.md`: auto with `setTapped` then `adjustLife -3`.
  - `assertKnownCostCommands` should accept existing command shapes `adjustLife` with negative fixed delta and `moveCard` self to `exile`; no new command type is introduced.
  - Add/replace pins for strict self-exile and keep `Pay X life` / chosen exile manual.
- `docs/acceptance.md`
  - G4-6 currently lists `"{T}, Pay 3 life: ..."` among manual examples. That example should move to auto/guided acceptance for this slice, while `{X}`, non-self sacrifice/exile, ability-word labels, and other choice-bearing costs remain manual.
- `docs/engine-spec.md`
  - §33.6 currently states `Pay N life` remains manual. It should be updated to the fixed-amount promotion boundary: fixed `Pay N life` auto; `Pay X life` manual.

## Verification already run by implementer

- `npm run lint`: pass.
- `npx tsc --noEmit`: pass.
- `npm run grammar-compile`: pass.
  - `research/grammar-compile/report.md` / `report.json` regenerated.
  - Full corpus: 17,491 cards mapped; activated lines 5,103; activation frontier 3,885 / 5,103 = 76.13%; fully-playable 1,171 / 5,103 = 22.95%; manual cost 1,218 / 5,103 = 23.87%.
- Targeted tests:
  - `npx vitest run src/engine/__tests__/cr118CostsCompiler.test.ts src/store/__tests__/manaWriteActivatedAbility.test.ts src/store/__tests__/activatedAbilityEnvelope.test.ts`: pass before this handoff draft; rerun recommended after judge-owned review updates.
- `npm run build`: pass; generated `dist/` was deleted afterward.
- `npx vitest run`: currently fails only the judge-owned old pin in `src/engine/__tests__/review.grammar-cost.test.ts`.

## Deferred scope

- No cost prompt/value binding for `X`.
- No chosen-card exile/discard/sacrifice auto.
- No broad ability-word/flavor-word label stripping.
- No new activation envelope component kind for self-exile; this slice intentionally does not reopen §34.19.
