# O4P-05D Judge-owned acceptance brief

Milestone: `O4P-05D`

Base SHA: `e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c`

Contract:
`research/cr-grounding/o4p-05d-production-release-closure.contract.draft.md`

Risk / audit lane: `R3 / BROAD`

## Acceptance

1. `codex:context -- --domain O4P-05D` is healthy, selects O4P-05D, reports
   O4P-05A/B/C shipped, and reports no dependency or loop-state mismatch.
2. Production source, rules, versions, dependencies, `wrangler.jsonc`, and the
   Pages workflow are unchanged from the declared base.
3. O4P-05C and O4P-05D registered verifiers and the O4P-05D architecture review
   pass; the D verifier is registered exactly once after C and before lint.
4. Wrangler 4.123.0 dry-run emits a Worker bundle with only the frozen
   production bindings and causes no external write.
5. An independent BROAD cold audit returns BLOCKER/HIGH zero on the frozen
   candidate, and the same fingerprint passes one local `npm run check`.
6. The semantic-candidate commit contains only explicitly staged O4P-05D files
   and the auditor identifier. Its first CI passes the full check and stops only
   because the declared base diff contains the exact Judge-owned D review path.
   The Judge records that path/hash/run; the same auditor confirms unchanged
   bytes; a metadata-only reauthorization commit then passes exact-head Actions,
   forbidden, build, and Pages deployment.
7. The exact clean reauthorized candidate deploys to the existing workers.dev Worker. The
   new version is active at 100%, differs from the former active version, and
   the former version remains available as a rollback target.
8. The previously certified Room remains HTTP 200 at revision 96 after deploy.
   A fresh production `init-load` evidence run uses four sockets and reaches
   HTTP 200, revision 96, and accepted-command count 96.
9. Worker root and an unrelated path return the expected safe HTTP 404 envelope.
   No secret, capability, account identifier, bearer value, initialization
   payload, raw WebSocket frame, or raw tail is recorded.
10. A findings-only independent production-closure audit returns BLOCKER/HIGH
    zero; both ledger entries become shipped exactly once; loop state becomes
    complete; terminal exact-head Actions/Pages, served HTML/JS/CSS HTTP 200,
    `HEAD == origin/main`, and clean worktree all pass.

## Targeted pre-audit commands

```text
npm run verify:o4p-05c-release-gates
npx vitest run --project dom src/test/architecture/review.o4p-05d-production-release-closure.test.ts
npm run verify:o4p-05d-production-release-closure
npx vitest run --project dom scripts/__tests__/machine-checks.test.mjs
npm run check:forbidden
git diff --check
```

The release full check is reserved until independent cold audit returns
BLOCKER/HIGH zero. Real Cloudflare deployment is reserved until both that local
full check and the Judge-reauthorized exact-head GitHub Actions/Pages run are
green.
