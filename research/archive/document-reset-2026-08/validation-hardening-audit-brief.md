# VALIDATION-HARDENING-2026-08 cold audit brief

Audit profile: BROAD (governance, coverage, CI, and contract traceability)

Audit the current checkout as a frozen candidate. Do not edit files, run git mutations, push, or infer missing product specifications.

Scope:

- `.github/workflows/deploy-pages.yml`
- `scripts/checks/resolve-diff-base.mjs`
- `scripts/checks/change-detector.mjs`
- `scripts/checks/validation-domain-resolver.mjs`
- `scripts/checks/validation-domains.json`
- `scripts/checks/fast-check.mjs`
- `scripts/checks/domain-check.mjs`
- `scripts/checks/check-docs.mjs`
- `docs/contracts/traceability.json`
- `docs/contracts/manifest.json`
- `docs/acceptance/scenarios.json`
- `research/archive/document-reset-2026-08/legacy-contract-inventory.json`
- all changed test files and archive evidence in the candidate diff

Read-only audit questions:

1. Does the normal Pages workflow omit `governance-reset` while preserving the default forbidden policy and a fail-closed diff base?
2. Does change collection cover base-to-head committed changes, staged, unstaged, untracked, rename, and delete paths without duplicates?
3. Do unknown and shared configuration paths escalate safely rather than silently pass or under-select?
4. Does every named domain expand its declared dependencies, select all matching test files, reject zero matches, and avoid duplicate execution?
5. Are active contract clause IDs unique, source-linked, marker-backed, acceptance-linked, and disposition-complete?
6. Are manual and deferred clauses honest, with procedures or needs-decision reasons?
7. Does `lastVerifiedCommit` require an existing ancestor and fail when contract or evidence paths are stale?
8. Does every legacy inventory item have a unique anchor, exact source hash, one disposition, and valid target/reason semantics?
9. Is there any deleted test, skip/todo conversion, weakened assertion, runtime product behavior change, or unreviewed specification invention?

Report only findings with severity `BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`, including path and evidence. A clean result must state `BLOCKER/HIGH: 0`.
