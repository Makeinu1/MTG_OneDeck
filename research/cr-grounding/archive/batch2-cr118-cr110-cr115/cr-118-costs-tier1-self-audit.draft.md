# cr-118-costs Tier-1 self-audit draft

Status: implementer self-audit draft. This is not an independent judge audit and does not greenlight shipping.

Scope audited:

- `src/engine/grammar/compile.ts` fixed `Pay N life` and strict self-exile cost catalog.
- `src/engine/commands.ts` `activatedManaAbilityPlanForSource` `lifeCost` metadata.
- `src/store/gameStore.ts` no-stack mana ability legality check for fixed life costs.
- Implementer tests added under non-`review.*` files.

## CR checks

| claim | CR authority checked | audit result |
|---|---|---|
| Fixed life payment can be represented as a deterministic cost command | CR 118.1, 118.3b, 119.4 | Supported. A player pays a cost by carrying out its instructions, and paying life subtracts the indicated amount from life. Existing `adjustLife -N` is the right command shape. |
| `Pay X life` must stay manual | CR 107.3a, 118.4 | Supported. X in an activation cost is chosen/announced during activation, so this slice lacks the required value-binding state. |
| Activated cost text is before the colon | CR 602.1, 602.1a | Supported. `parseAbilityIR` supplies the pre-colon cost span; compiler work is correctly scoped to cost text. |
| Activation uses spell cost-payment steps | CR 602.2b, 601.2f, 601.2h | Supported. The deterministic command order is an engine choice; partial payments remain blocked in rules-legal mode for modeled `{T}` and fixed life costs. |
| Strict self-exile maps to a zone move to exile | CR 701.13a, 406.2 | Supported. Existing `moveCard(..., to:'exile')` is the correct command shape. |
| Ability effects may find a self object moved to a public zone by cost | CR 400.7j | Supported. Keeping the activation-time source snapshot while moving the source to exile before stack placement is consistent with the current envelope pattern. |

## Implementation findings

No blocking implementation bug found in the audited slice.

Non-blocking notes:

- The normal non-mana activation path already parses fixed `Pay N life` through `activationNonmanaCosts`; the new `compileAbilityCost` support mainly affects pure compiler coverage, grammar-compile measurement, and no-stack mana ability costs.
- `ActivationEnvelope.cost` does not add a new `self-exile` component. This matches the stated slice boundary: no §34.19 envelope reopening and no new command/type. Reviewers should not expect self-exile to appear as a first-class cost component in this slice.
- `compileAbilityCost` now treats a cost that would both self-sacrifice and self-exile the same source as manual to avoid double-moving one object.
- Ability/flavor-word label normalization remains deferred. Label-prefixed otherwise-modeled costs can still be manual by design.
- `Pay a life` / `Pay an life` are technically accepted by the fixed-life parser because the draft allowed `a`/`an` as one. This is harmless for current corpus and no broader auto claim depends on it.

## Current red/green state

Green checks observed in this Codex run:

- `npm run lint`: pass.
- `npx tsc --noEmit`: pass.
- `npm run build`: pass, with only the existing Vite chunk-size warning; `dist/` deleted afterward.
- Targeted tests: `src/engine/__tests__/cr118CostsCompiler.test.ts`, `src/store/__tests__/manaWriteActivatedAbility.test.ts`, `src/store/__tests__/activatedAbilityEnvelope.test.ts` pass.
- `npm run grammar-compile`: pass; report regenerated with activation frontier 3,885 / 5,103 = 76.13%.

Known red:

- `npx vitest run` fails only `src/engine/__tests__/review.grammar-cost.test.ts` old pin: `"{T}, Pay 3 life: Draw a card."` expected manual, but the implementation correctly returns auto under the `cr-118-costs.draft.md` promotion.

## Judge re-ownership checklist

Before ship, judge should independently verify:

1. CR refs above against `rule/Magic_The_Gathering_Comprehensive_Rules.txt`.
2. Whether fixed `Pay N life` promotion is accepted as the new §33 contract.
3. `review.grammar-cost` expected-value update, including keeping `Pay X life` and chosen exile manual.
4. `docs/acceptance.md` G4-6 split so fixed pay-life is no longer listed in manual examples.
5. `docs/engine-spec.md` §33.6 update from "Pay N life manual" to "fixed Pay N life auto; Pay X life manual".
