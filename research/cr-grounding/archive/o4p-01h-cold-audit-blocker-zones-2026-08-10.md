# O4P-01H semantic-zone Proxy blocker record

Auditor: 019fe7e7-9b3e-7413-b98c-263f10df3afd (Euler)
Audited candidate SHA: 826826bf3d74b33f17970a7295ee7065ad453505
Audited candidate tree: 72825bbc1e3ad87ba0864e4050c167219ba043ea

Verdict: BLOCKER 1, HIGH 0, MEDIUM 0, LOW 0.

Finding:

- B-01: V2 registry validation checked zone descriptors but retained raw
  root.zones in the successful value. A semantic Proxy get trap could replace
  shared zones during canonicalization, yielding a frozen value whose object
  memberships no longer matched the validation result.

Resolution:

- The V2 registry validator now recursively snapshots input from own data
  descriptors before validation and canonicalization. Accessors, symbols,
  unknown fields, and revoked descriptors remain visible to strict rejection;
  semantic get traps cannot replace validated zones.
- A regression test pins descriptor-valid zones against a divergent shared-zone
  get trap and checks the canonical result preserves the descriptor values.
- The bounded judge fix is committed in the post-finding candidate after this
  record. A fresh independent cold audit remains required before full check.
