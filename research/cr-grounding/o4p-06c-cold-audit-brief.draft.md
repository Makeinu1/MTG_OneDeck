# O4P-06C Context-Free Cold Audit Brief

Date: 2026-08-21
Base SHA: `c33bc609449df906e3521f8d5568b2a1cfd3621e`
Pre-brief semantic tree fingerprint: `b3523f689767512b71f1822f2f6ee0bc2d044dd31c9230204f67f9c176199ae2`

Read `AGENTS.md`, the development skill/governance reference, the O4P-06C
contract and acceptance brief, then audit the frozen candidate without any
implementation context. Do not edit files, stage/commit, run the full
`npm run check`, deploy, push, or use secrets/network.

Audit the exact candidate relative to the base, including:

- `src/online/lobby/**`
- O4P-06C changes under `src/online/cloudflare/**`
- the Judge-owned O4P-06C review and ordinary lobby runtime test
- the two one-word historical Online module-kind review reauthorizations
- the four Cloudflare verifier import/hash reauthorizations and dependent
  O4P-05C/O4P-05D hash chain
- the three O4P-06C contract/acceptance/implementation drafts and this brief

Adversarially inspect closed validation, accessors/proxies/sparse/huge inputs,
unsafe IDs, UTF-8 deck bounds, capability substring leakage, invite reuse and
cross-seat substitution, readiness reversal, bootstrap failure atomicity,
same-genesis retry recovery, conflicting active state, SQL CAS/canonical load,
random token entropy/spelling, CORS exactness, route-specific OPTIONS,
browser-origin PUT closure, origin-less historical compatibility, request-fact
coverage, and no namespace lookup on preflight/origin/path rejection.

Run bounded targeted evidence only:

- O4P-06C Judge review, ordinary lobby runtime, affected Cloudflare/bootstrap
  and architecture tests
- the four `verify:online-cloudflare-*` gates, `verify:o4p-05c-release-gates`,
  and `verify:o4p-05d-production-release-closure`
- `npx tsc -b`, affected ESLint, generator `--check`, and `git diff --check`

Confirm the staged candidate contains no unrelated product/config/dependency/
workflow/ledger changes. Report findings only with BLOCKER/HIGH/MEDIUM/LOW
counts, exact evidence, and a final candidate fingerprint. Use verdict
`AUDIT-OK-PENDING-FULL-CHECK` only if BLOCKER/HIGH are zero and all required
corrections are closed.
