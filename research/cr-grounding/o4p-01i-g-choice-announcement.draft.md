# O4P-01I-G Mode, Variable and Cost Choice Contract V1

Implemented-not-integrated slice for the frozen O4P-01I stack announcement contract.

This additive implementation is primitive-only. It validates and canonicalizes
chosen mode keys, variable announcements, alternative cost choices, additional
cost choices, and cost-choice sets while preserving mode declaration order and
repetition. Variables and additional costs are validated as unique, code-unit
ascending sequences; the validator never sorts or repairs input. Numeric
values are nonnegative safe integers, with positive safe integers required for
additional-cost repetition counts. No distribution, root slice, announcement
record, registry validation, total-cost, or payment calculation is represented.

The implementation is intentionally limited to the four requested source/test
boundaries. Integration into public indexes, ledger updates, review tests,
release status, and cold-audit evidence are deferred to the judge lane.
