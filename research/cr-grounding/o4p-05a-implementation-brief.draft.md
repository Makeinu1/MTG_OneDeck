# O4P-05A bounded implementer brief

Milestone: `O4P-05A`

Base SHA: `17965786dba01a15770e19437b9456ca81c0f18b`

Authority:
`research/cr-grounding/o4p-05a-public-release-ruleset.contract.draft.md`

Acceptance:
`research/cr-grounding/o4p-05a-acceptance-brief.draft.md`

Role: implementer. Model: `qwen-cloud/qwen3.8-max`, reasoning `xhigh`.

## Goal

Implement only the additive public release-ruleset descriptor and its ordinary
tests exactly as frozen by the contract.

## Write scope

- `src/versioning/publicReleaseRuleset.ts`;
- the minimum export edit to `src/versioning/index.ts`;
- ordinary non-`review.*` tests under `src/versioning`.

Do not edit the CR body/metadata, `CURRENT_CONTRACT_VERSIONS`, verifier scripts,
machine-check ordering, any `review.*`, contracts/acceptance/audit drafts,
docs, governance, ledger, loop-state, dependencies, package files, engine,
Store, Solo, Online/Cloudflare/UI code, or git state.

## Required implementation behavior

1. Export the exact V1 schema constant, descriptor, and named V1 type.
2. Reuse the exact `CURRENT_CONTRACT_VERSIONS` object. Do not copy, normalize,
   merge, default, mutate, or retype the ruleset/version values.
3. Keep the descriptor deeply frozen and deterministic with no network,
   environment, filesystem, clock, RNG, storage, or runtime configuration.
4. Add focused ordinary tests. Run only the complete versioning ordinary suite,
   the Judge-owned O4P-05A review test, both existing ruleset/version verifiers,
   scoped ESLint, and `npx tsc -b`. Do not run the full release check.

## Report

Return changed files, targeted command/results, explicit DEFERs, and unresolved
issues. Do not claim audit or ship approval.
