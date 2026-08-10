# DOC-GOV-RESET-2026-08 cold-audit brief

Profile: `BROAD` (governance, document migration, validation lanes, and CI workflow).

Candidate fingerprint: `43c0d655b0bb3f911e86a01f58cebbe26d36d7a1973aa5f52b7e63e9702ea259`

The fingerprint is produced by `node scripts/checks/fingerprint.mjs`, which hashes sorted per-file SHA-256 entries for tracked diff files plus non-ignored untracked files, excluding this brief and `cold-audit-findings.md`. The base SHA is `cdad530267a7286d16454cf376a825378c6b4cdd`.

## Scope

- `docs/contracts/manifest.json`
- `docs/contracts/engine/` and `docs/contracts/ui/`
- `docs/acceptance/scenarios.json`, the two compatibility pointers, and generated API
- `research/archive/document-reset-2026-08/` migration, baseline, conflict, and original-document records
- `scripts/checks/{check-docs,domain-check,fast-check,generate-engine-api,generate-migration-map}.mjs`
- `scripts/checks/fingerprint.mjs`
- `scripts/checks/machine-checks.mjs`, `forbidden-files.mjs`, package scripts, and Pages workflow
- governance entries in `AGENTS.md`, `CLAUDE.md`, `QWEN.md`, `.agents/skills/`, `.claude/`, and the allowed gate test metadata

## Exclusions

No product behavior, `src/engine` implementation, `GameState` or `GameCommand` meaning, CR interpretation, dependency, image, audio, external service, push, merge, release, or Pages publication may be changed.

## Required cold checks

Read `.claude/audit-standing.md` first. Return findings only and edit nothing. Do not run `npm run check`.

1. Run `node scripts/checks/fingerprint.mjs`, verify the candidate fingerprint, and confirm that the two original monoliths are byte-identical archives.
2. Run `npm run check:docs` and inspect duplicate authority, duplicate scenario IDs, broken links, unresolved references, volatile active-contract vocabulary, generated API drift, and migration completeness.
3. Run `npm run check:forbidden -- --diff HEAD --policy governance-reset`; inspect that the policy does not permit product paths outside the explicit reset scope.
4. Run the target review/gate evidence: `npx vitest run --project dom scripts/__tests__/machine-checks.test.mjs scripts/__tests__/review.check-gates.test.mjs` and `npx vitest run --project dom src/test/architecture/deployPagesGates.test.ts`.
5. Inspect diff deletions for assertion weakening, skips, warning conversion, ignored paths, or loss of existing release validation. Confirm Solo-preservation remains covered once by full Vitest in release and remains available in the fast/domain lane.
6. Inspect the Pages workflow for exactly one production build, base-path propagation, explicit forbidden diff base, and direct artifact upload.
7. Inspect all active contract bodies for lifecycle/history/work-note contamination and confirm scenarios trace to contract IDs and existing test/manual lanes.

Report each finding as `BLOCKER`, `HIGH`, `MEDIUM`, or `LOW` with path, mechanism, reachable scenario, and evidence. A timeout is `AUDIT-TIMEOUT`, not a clean verdict. The clean semantic result is `AUDIT-OK-PENDING-FULL-CHECK` and is not release approval.
