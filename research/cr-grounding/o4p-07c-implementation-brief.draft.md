# O4P-07C Implementation Brief

Date: 2026-08-23
Milestone: O4P-07C
Base SHA: `6899fd4a9e1adba71651d883174647970f7a5d59`
Authority:
`research/cr-grounding/o4p-07c-fixed-runtime-removal-production-release.contract.draft.md`

## Ownership

The implementer owns only product source, ordinary tests, and mechanical
verification code needed for this milestone. Expected areas are:

- `src/online/cloudflare/runtime.ts`, its ordinary non-`review.*` tests, and
  public exports required by the cutoff;
- `src/online/lobby/**` and explicit fixed-bootstrap fixture adapters/tests;
- `src/online/publicApp/index.ts` and ordinary direct-module compatibility
  tests if needed;
- `scripts/checks/verify-o4p-07c-production-runtime.ts`, its ordinary tests,
  `scripts/checks/machine-checks.mjs`, `scripts/__tests__/machine-checks.test.mjs`,
  and the exact `package.json` script entry.

Do not edit `AGENTS.md`, `CLAUDE.md`, `.claude/loop-state.md`, `docs/**`,
`research/cr-grounding/**`, the ledger, git state, dependencies/lockfile,
`wrangler.jsonc`, or any `review.*` file. Historical review tests that need a
new O4P-07C expectation belong to the Judge; report them rather than changing
them. You are not alone in the repository: preserve and work around Judge-owned
contract files and other agents' changes.

## Required implementation

1. Add the exact secret-free HTTP 426 response for valid legacy
   deck/ready/start/start-with-table operations with no state mutation or
   Scryfall call. Keep v1 create/claim and v2 flows unchanged.
2. Remove fixed bootstrap/catalog imports from lobby and Worker runtime. Move
   fixed-start assembly behind explicit regression-fixture ownership, updating
   ordinary tests to import it directly. Remove production-barrel exports of
   fixed-start helpers and the public v1 controller.
3. Add a deterministic production import/artifact verifier with adversarial
   tests and wire it after the canonical build without adding dependencies or
   creating a second build.
4. Preserve all O4P-07B dynamic-genesis, privacy, retry, readiness, restart,
   replay, identical-deck, size, and Solo behavior.

## Handoff

Return changed files, targeted commands/results, any historical `review.*`
failures the Judge must update, deferred production-only evidence, and all
unresolved points. Do not run full `npm run check`, commit, push, deploy, or
perform live browser/Worker operations.
