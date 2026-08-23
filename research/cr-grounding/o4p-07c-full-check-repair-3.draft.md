# O4P-07C Full-Check Repair 3

Date: 2026-08-23
Base SHA: `85c9f1532b9d82282a441f40bc010c3e1e0e5400`
Owner: Judge

## Trigger

The user-authorized exceptional third exact-head Actions run `32632994186`
(build job `97178491909`) checked out the exact base SHA above. Nineteen
canonical machine checks passed, then the O4P-03A runtime/persistence verifier
stopped after 21 seconds because repair 2 had intentionally changed the
O4P-03A review bytes without re-pinning their frozen SHA-256. Lint, Vitest,
build, O4P-07C production verification, ownership classification, Pages
upload, and deployment did not run. No product/runtime failure was reported.

## Bounded deterministic repair

Change only exact SHA-256 literals in five executable verifiers:

1. Re-pin the O4P-03A, O4P-03B, and O4P-03C architecture-review hashes in
   their respective Cloudflare verifiers.
2. Re-pin the O4P-04B, O4P-04C, and O4P-04D architecture-review hashes in the
   O4P-05C release-gate verifier.
3. Re-pin the resulting O4P-03A, O4P-03B, and O4P-03C verifier hashes in the
   O4P-05C release-gate verifier.
4. Re-pin the resulting O4P-05C verifier hash in the O4P-05D closure verifier.
5. Preserve all allowlists, assertions, source paths, commands, ownership
   rules, and release meanings. The changed O4P-07A review has no exact hash
   pin in `scripts/checks` and therefore needs no mechanical change.

The resulting verifier hashes are:

- O4P-03A: `74784e664f37a542e971207f6274cf8f4a47a6bef64f4ebc2d9ffcc634801676`;
- O4P-03B: `b99e98771aec6eff75a51d8da7ddc327dfb121c937f3f5bbbef065ae684e89e8`;
- O4P-03C: `aa91b106ad08ccd091340e42aeb1c9600d92849d5bc1beb14b496f64c3507cc4`;
- O4P-05C: `77d833070cf067f6474abbbab540098e1f534f4035a1147666043600376cedbd`;
- O4P-05D: `0fb5010ca7efbbb1a5cbd64e996366b7c237e257a70b1aeb216375c6271c95e6`.

No product source, review test, contract meaning, dependency, CR authority,
public UI, Worker behavior, or online protocol behavior changes in this repair.

## Required evidence

- O4P-03A, O4P-03B, O4P-03C, O4P-05C, and O4P-05D executable verifiers pass.
- Every frozen hash in the affected verifier chain recomputes exactly, with no
  missing or extra pin change.
- Affected ESLint and `git diff --check` pass.
- A fresh Luna xhigh cold audit reports BLOCKER/HIGH 0.
- Do not run or push another full check without a new explicit user exception.
