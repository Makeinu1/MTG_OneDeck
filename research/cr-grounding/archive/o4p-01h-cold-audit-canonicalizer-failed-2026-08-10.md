# O4P-01H canonicalizer cold-audit finding record

Auditor: 019fe7a5-f88f-7271-aab9-d4cdb7a1c706 (Locke)
Audited candidate SHA: f7d6668936468deb81897b1571f9fac8551dc4f7
Audited candidate tree: 1b8d6d12655b8e91d1b23f7ac8a9c2e322820f39fb4a856795f1aa85d64509c5

Verdict: BLOCKER 0, HIGH 1, MEDIUM 0, LOW 0.

Finding:

- H-01: The V2 registry and runtime canonicalizers accepted wrong root kinds,
  silently dropped unknown fields, and preserved invalid runtime values such as
  a string faceIndex. This violated the frozen V2 strict fail-closed
  canonicalization contract.

Resolution:

- The judge added a non-canonicalizing V2 registry validation path before direct
  registry canonicalization, while preserving the validated internal path used
  by the validator itself.
- The runtime canonicalizer now checks exact root/byObject descriptors,
  canonical object keys, exact runtime subobject fields, and the existing V1
  orientation/counter/attachment validators before cloning and freezing.
- Normal tests now pin wrong-kind, unknown-field, and invalid-faceIndex direct
  canonicalizer rejection.
- The bounded judge fix is committed as
  d943f7ae284705610fb115577102e6160e3063f4.
- A fresh independent cold audit is required against the post-fix candidate.
