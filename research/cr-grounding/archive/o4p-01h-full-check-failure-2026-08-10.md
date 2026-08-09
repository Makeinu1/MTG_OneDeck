# O4P-01H release full-check correction record

Initial full-check candidate SHA:
ab36618031586ce2b7f00fe22c7ea3b0fefc1eb1
Initial full-check tree:
08b7c5fbc626ade1f28495adcea13c04c88c8142

Result: machine checks 1-9 passed; the test step failed in the existing Core
boundary architecture test because the newly added
scripts/checks/verify-mode-neutral-core-object-registry.ts verifier was not in
the verification-script allowlist. The failure reported two
core-no-product-runtime-import violations for that verifier's intended Core
imports. No product code, V1 contract, or runtime behavior was implicated.

Correction:

- Added the O4P-01H verifier to isVerificationScript in
  src/test/architecture/modeNeutralCoreBoundary.test.ts.
- Re-ran the affected boundary review (7 tests), O4P-01H Object suite (12
  files, 78 tests), dedicated verifier, lint, build, and check:forbidden; all
  passed.
- A fresh independent cold audit and one final full check are required against
  the corrected candidate.
