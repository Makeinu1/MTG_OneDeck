# O4P-01H cold-audit brief

Milestone: O4P-01H
Mode: STANDARD
Candidate: the clean HEAD present when this brief is dispatched

This is an independent read-only audit. Do not edit any repository file,
ledger entry, review test, or generated artifact. Return findings only.
Do not infer implementation intent from history. Evaluate the frozen tree
against the O4P-01H contract and the committed acceptance pins.

Audit the following:

1. Universal ID namespace collision and canonical decimal rules.
2. V1 card-ID byte preservation and V1 factory/validator behavior.
3. Token owner/controller/definition/provenance and battlefield-only legality.
4. Spell-copy stack-only legality and historical copiedFrom references.
5. Activated and triggered ability stack-only legality and source references.
6. Physical-card exactly-one card object invariant.
7. Every object exactly-one zone membership invariant.
8. Mixed stack ordering and last-element top-of-stack rule.
9. Runtime V2 exact card/token key set and V1 runtime-shape reuse.
10. Canonicalization determinism without semantic array reordering.
11. Deep freezing, fresh outputs, input non-mutation.
12. Fail-closed descriptor, accessor, symbol, non-enumerable, unsafe-key,
    unknown-field, and non-plain-record validation.
13. Complete deterministic validation issue behavior and property-test
    non-vacuity.
14. V1 fixture immutability and Solo/Online/UI boundary.
15. Absence of object-creation commands, priority, resolution, targets,
    choices, costs, copyable-values derivation, CR707 automation, cease
    rules, projection, visibility, and online protocol.
16. Machine-check order, package verifier coverage, and version/dependency
    preservation.

Required report:

- BLOCKER/HIGH/MEDIUM/LOW findings with file and line evidence.
- Explicit statement for each audit item above.
- Test or command evidence used.
- No edits and no release actions.
