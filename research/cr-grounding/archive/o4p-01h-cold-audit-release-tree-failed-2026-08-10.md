# O4P-01H release-tree cold-audit finding record

Auditor: 019fe7c9-f772-7c60-aee2-5193de13109d (Russell)
Audited candidate SHA: d3ce5e733ff959db23445896cce75add2b3d3473
Audited candidate tree: dbadf166cde7a6d37645f6fe757f91fb3078dee6

Verdict: BLOCKER 0, HIGH 2, MEDIUM 0, LOW 0.

Findings:

- H-01: The registry validator accepted canonical object IDs whose family did
  not match the identity kind, including token identities under spell-copy IDs
  and spell copies under card IDs.
- H-02: Registry canonicalization re-read original Proxy values after
  descriptor-based validation, allowing a semantic get trap to change output
  values between validation and canonicalization.

Resolution:

- V2 validation now parses each object key and checks its family against the
  identity kind, including card physical-card/incarnation and token
  incarnation parity.
- V2 canonicalization now builds a recursive descriptor snapshot without
  executing getters, validates that snapshot, and canonicalizes only the
  validated snapshot-derived value. Accessors, symbols, and unknown fields
  remain visible to strict rejection.
- Regression tests pin both ID-family rejection and getter-divergence safety.
- The bounded judge fix is committed in the post-finding candidate after this
  record. A fresh independent cold audit remains required before full check.
