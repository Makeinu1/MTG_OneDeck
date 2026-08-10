# O4P-01L Wave 2B-H implementation draft

Implemented the additive Core control-effect and continuity slice in
`src/engine/core/rules/controlEffectV1.ts`.

The slice validates exact fields, effect-order/by-effect parity, immutable
effect and continuity records, and the closed duration union. Operations are
pure and return `{ value, controllerChangedObjectIds }`; ordered effects use
last-applicable-wins semantics, ability objects are rejected as control
targets, effective controller changes reset continuity, turn-start marking is
explicit, and end-of-turn effects expire at the supplied boundary.

Deferred by the frozen brief: CR 613 dependency evaluation, timestamp
evaluation, combat removal, movement, player exit, and automatic
`while-source-controlled-by` maintenance.

Status: implemented-not-audited. Focused tests are in
`src/engine/core/rules/__tests__/controlEffectV1.test.ts`.
