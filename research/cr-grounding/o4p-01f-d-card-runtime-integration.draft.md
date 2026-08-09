# O4P-01F-D: Composite Card Runtime Slice Integration V1

> Implementer draft. This records the bounded O4P-01F-D implementation and is
> not a promoted contract, independent audit result, or shipped declaration.

## Scope

`cardRuntimeState.ts` defines the composite per-`CoreObjectId` runtime state
and its mode-neutral slice. `cardRuntimeValidation.ts` validates the composite
shape, delegates each nested value object to the A/B/C validator, and applies
the Identity/Zone cross-state rules. `runtime/index.ts` and the Core root index
export the A/B/C public contracts together with D.

The factory accepts the root input without `kind`; the validator accepts the
full slice shape. The factory adds `kind` to an allocated candidate and calls
the validator as its validation path. Neither path repairs input.

## Cross-state boundary

- `byObject` must have exactly the Identity/Zone `cardObjects` key set and is
  emitted in UTF-16 code-unit order.
- Face index is bounded by the referenced definition's `faces.length`, and is
  zero outside battlefield and stack.
- Face-down is allowed only in battlefield, stack, and exile.
- Tapped, flipped, phased-out, and marked damage are restricted to battlefield.
- Attachment sources outside battlefield must be unattached.
- Object attachment targets and player targets must exist; self-attachment is
  rejected. Target zone, counter presence, attachment cycles, and card-type
  legality are intentionally not checked.

The validator reads input through own data descriptors, does not invoke
accessors, does not mutate input, and returns a separately allocated deeply
frozen success value.

## Verification

`cardRuntime.test.ts` covers complete and reordered key sets, missing/extra
objects, face and zone boundaries, orientation and damage restrictions,
attachment target/source rules, unrestricted target zones, permitted cycles,
descriptor safety, non-mutation, deep freeze, and factory/validator parity.

## Defer

- independent cold audit and judge-owned review evidence;
- runtime state transitions, commands, projections, combat, effective
  controller, summoning sickness, token/copy/ability state, and versioning;
- promotion of this draft into a formal contract or ledger release record.

## Status

`implemented-not-audited`
