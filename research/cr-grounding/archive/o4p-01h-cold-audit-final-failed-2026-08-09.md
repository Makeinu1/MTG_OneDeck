# O4P-01H final cold-audit attempt record

Auditor: 019fe784-b49b-7d31-b28b-e1a9efbe1373 (Maxwell)
Pre-judge-fix candidate SHA: 5fdb479df4ab578c8f7d184ff48d5c4d79284c47

Verdict before the final judge fixes: BLOCKER 0, HIGH 3, MEDIUM 1, LOW 0.

V2 findings:

- H-01: token V2 identity validator/factory revoked-Proxy handling leaked
  Array.isArray traps.
- H-02: V2 registry/runtime validator and factory Proxy traps were not fully
  fail-closed.
- M-01: unknown token V2 discriminants did not report the additional unknown
  field issue.

Scope ruling:

- H-03 alleged hostile-input weaknesses in preserved V1 validators,
  factories, and runtime files. This is explicitly out of scope for this
  milestone because the frozen V1 preservation contract forbids modifying
  those files. It is not a V2 finding and must not be used to alter V1.

Resolution:

The judge applied bounded V2-only fixes to tokenObjectV2.ts,
objectRegistryValidationV2.ts, and objectRegistryStateV2.ts, with focused
revoked-Proxy, factory-trap, and unknown-discriminant tests. A fresh final
cold audit is required against the resulting clean candidate.
