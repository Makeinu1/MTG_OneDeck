# O4P-01H medium cold-audit finding record

Auditor: 019fe7b1-5aad-7ee0-a4a9-3497ccc071af (Mill)
Audited candidate SHA: a7f6f529534fd5abfc5acc0ba60e1cf0b8204e13
Audited candidate tree: 6069a32b629a8fceb961ecfbfdcc79f845577e7d

Verdict: BLOCKER 0, HIGH 0, MEDIUM 1, LOW 0.

Finding:

- M-01: coreTokenObjectIdOfV2 accepted negative zero and formatted it as
  canonical zero. The V2 validator rejected -0, so the factory and validator
  did not have parity for canonical decimal input.

Evidence:

- Contract: o4p-01h-universal-object-registry.contract.draft.md, seed and
  incarnation rules.
- Factory: src/engine/core/object/objectIdV2.ts, assertIncarnation and token
  factory.
- Validator/test evidence: tokenObjectV2.ts rejects -0 and its normal test pins
  the rejection.

Resolution pending:

- The judge will make assertIncarnation reject Object.is(incarnation, -0), add a
  factory regression pin, and run the affected ID/property tests.
- A fresh independent cold audit is required against the post-fix candidate
  before the release full check.
