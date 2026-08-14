# O4P-04D local authority-hash repair 1

Date: 2026-08-14

Owner: Sol Judge

Candidate head: `a9853e638e2e24821289b086156c0d567efd4b6d`

Auditor: `/root/o4p04d_cold_auditor`

## Failure

The second and final authorized local `npm run check` passed CR/version/docs,
all architecture and Online/Core verifiers through O4P-03C, then stopped in
the registered O4P-03D production-gate verifier before lint, tests, or build.
The verifier correctly rejected the O4P-03D Judge review file because its
frozen SHA-256 still described the prior 30-second timeout bytes:
`97f4cd8962556a9e5f7cff443ea3ed8b15830ade5f39be560881080a8ab9760b`.

The audited timeout-only repair changed the file's SHA-256 to
`3771acdf221e50f3609cbacec70b52993bdadfa9f961c017fa53f7ea7f8ef0a1`.
The independent audit already proved that, after normalizing the one timeout
line, the callback/body/assertion bytes match the prior authority exactly.

## Authorized repair

Change only the matching frozen hash literal in
`scripts/checks/verify-online-cloudflare-production-gate.ts` to the new
Judge-file hash above. Register only that exact verifier filename in the
O4P-04B/C/D candidate-path gates so the fail-closed verifier reanchor is
inspectable. Do not change any other frozen hash, source, test body, assertion,
contract, configuration, dependency, workflow, Cloudflare resource, or DEFER.

## Verification and gates

- independently verify both file hashes and the one-literal verifier diff;
- run `npm run verify:online-cloudflare-production-gate`, the complete
  O4P-03D review file, the three directly invalidated candidate-path gates,
  scoped ESLint/TypeScript, `npm run check:docs`, `npm run build`, and
  `git diff --check`;
- cold-audit the exact repair with BLOCKER/HIGH zero before commit/push;
- do not run a third local `npm run check`;
- exact-head CI is responsible for the complete check, forbidden scan, build,
  and Pages evidence.
