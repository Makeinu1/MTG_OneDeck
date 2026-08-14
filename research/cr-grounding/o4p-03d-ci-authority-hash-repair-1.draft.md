# O4P-03D CI authority-hash repair 1

Date: 2026-08-14
Owner: Sol judge/orchestrator
Failed candidate: `86191e8f5e97fe369a73082b23ee2f4b23037479`
Failed Actions run: `31768571632`

## Failure

The exact-head Actions run stopped in the registered O4P-03D production-gate
verifier before lint, tests, build, forbidden scan, or Pages. The verifier
expected SHA-256
`7998ff939e71bb7530fab502bf070449d3394e955432c60d8fd42db1284f4d7d`
for `research/cr-grounding/o4p-03d-acceptance-brief.draft.md`; the committed,
`git diff --check`-clean byte sequence has SHA-256
`eef955f66c0d38a17bbd77ba2f5cbea3ecef110893381d9ffc6670b95f81eb59`.

The sole byte difference from the previously frozen authority was removal of
one surplus blank line at EOF. Contract clauses and prose are unchanged.

## Authorized repair

Change only the matching frozen hash literal in
`scripts/checks/verify-online-cloudflare-production-gate.ts` to the committed
authority hash above. Do not change source, tests, assertions, configuration,
dependencies, workflow, Cloudflare resources, or any other frozen hash.

## Verification and gates

- independently confirm the acceptance brief hash and that its substantive
  content differs only by the surplus EOF blank line;
- run the O4P-03D verifier, scoped lint/type checks, and `git diff --check`;
- cold-audit the exact repair with BLOCKER/HIGH zero before commit/push;
- do not run a third local `npm run check`;
- exact-head CI remains responsible for the complete check, forbidden scan,
  build, and Pages evidence.
