# O4P-01H final recheck finding record

Auditor: 019fe7ba-0466-7d30-95f6-3c0700ed7ca6 (Schrodinger)
Audited candidate SHA: 97a0aa3eca19952a1b6247196bc4b0a8ecf4f3cd
Audited candidate tree: b6f3729a27208ba91d64edae34380f8b682dd03e

Verdict: BLOCKER 0, HIGH 0, MEDIUM 2, LOW 0.

Findings:

- M-01: The committed object-registry verifier did not pass strict TypeScript
  checking because it passed an unbranded string to the existing V1
  coreCardObjectIdOf function.
- M-02: V2 registry canonicalization ordered players and zones.byPlayer by
  turnOrder instead of deterministic code-unit record order. Semantic
  turnOrder and zone/stack arrays must remain in their input order, but record
  keys must be code-unit ordered.

Resolution:

- The verifier now imports CorePhysicalCardId and brands the fixture argument.
- V2 canonicalization now sorts players and byPlayer record keys by the local
  code-unit comparator while preserving turnOrder and semantic zone arrays.
- A regression test covers reversed turnOrder with canonical player records.
- The bounded judge fix is committed in the post-finding candidate after this
  record. A fresh independent cold audit remains required before the release
  full check.
