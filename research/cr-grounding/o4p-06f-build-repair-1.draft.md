# O4P-06F build repair 1

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `8810ed2e6db69fdc93c131f6abc195af6a763066`

During bounded full-check repair 2 verification, full project TypeScript exposed
three compile errors in the additive O4P-06F ordinary test that the first full
check had not reached: an injected fake response omitted the required `json()`
method, and the local projection fixture helper declared its test arrays
readonly before two hostile-mutation assertions.

Authorized Judge correction is exactly two ordinary-test type fixes in
`src/online/browser/__tests__/fourBrowserProductionEvidenceV1.test.ts`:

1. add `json: () => Promise.resolve({})` to the injected 503 response; and
2. type the local `zone` fixture's `entries` parameter as mutable `unknown[]`.

Do not change harness behavior, a test expectation, fixture value, product,
protocol, verifier, review, package/config/lockfile/workflow/docs/generated/
manifest/ledger, or any dependency. Run full `npx tsc -b`, the O4P-06F
ordinary/Judge reviews, affected ESLint, docs, and diff checks. Include this
repair with full-check repair 2 in one context-free Luna xhigh audit. No local
`npm run check`, Chrome, network, deploy, or git operation is authorized.
