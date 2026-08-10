# O4P-01J-G Synthetic Stack Commit V1 implementation note

Status: implemented-not-integrated
Milestone: O4P-01J
Lane: O4P-01J-G

The lane implements `commitCoreSyntheticStackObjectV1` in the additive
transaction source file. It accepts the three frozen synthetic identity
families, validates canonical ObjectId-family and announcement-kind parity,
requires a seated controller, and requires an existing card definition for a
spell-copy. Historical source and copy references are passed through without
lookup.

Successful candidates append one synthetic object to the shared stack and one
matching announcement. They do not add Runtime rows, PhysicalCards, or
copyable-value state. The complete Registry/Runtime/Announcement candidate is
validated before a deeply frozen result is exposed. Input is not mutated.

Targeted ordinary tests cover all three identity families, historical
references, duplicate and mismatch failures, missing definitions, hostile
descriptors, deterministic JSON, and JSON round-trip validation. Card commit,
retarget, removal, public barrel integration, review tests, audit, full check,
and release remain deferred to the judge/integration lanes.
