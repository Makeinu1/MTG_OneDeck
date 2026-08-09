# O4P-01H runtime-boundary cold-audit finding record

Auditor: 019fe799-cbfc-76d0-9360-d120ddb488af (Nash)
Audited candidate SHA: ae9f4cf796bf9f558cf189aa4eef7b702d3b72bd
Audited candidate tree: 22a40ff9a98d98e877ab90fd4d13a3cd8ab43911

Verdict: BLOCKER 0, HIGH 1, MEDIUM 0, LOW 0.

Finding:

- H-01: V2 runtime validation delegated orientation, counterDamage, and
  attachment subobjects directly to preserved V1 validators. A nested revoked
  Proxy could therefore escape the V2 validator as a raw exception instead of
  becoming a deterministic validation issue.

Scope ruling:

- This is a V2 boundary finding. The preserved V1 validators and runtime files
  remain unchanged as required by the frozen contract.

Resolution:

- The judge added exception boundaries around each V1 runtime subvalidator in
  objectRegistryValidationV2.ts, converting unsafe validation failures into
  INVALID_TYPE issues at the affected runtime path and returning a failed
  result. objectRuntimeV2.test.ts now pins the nested revoked-Proxy case.
- The bounded fix is committed as
  e181f2c4f81ad4383d7a42991bdd5ab095371d2e.
- A fresh independent cold audit is required against the post-fix candidate.
