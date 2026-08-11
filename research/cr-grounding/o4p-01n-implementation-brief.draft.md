# O4P-01N Luna implementation brief

## Task packet

- Milestone ID: `O4P-01N`
- Work package: `N-I` bounded Mode-Neutral Core closure implementation
- Role: one implementer; do not act as judge, contract author, acceptance
  author, cold auditor, git operator, or releaser
- Model requirement: `gpt-5.6-luna`
- Base SHA: `435b691b63492ebb66389cfa37c8a5a3d6d102b4`
- Frozen contract:
  `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`
- Grounding:
  `research/cr-grounding/o4p-01n-to-02e-forward-plan.draft.md`

## Goal

Implement the frozen O4P-01N immutable Core root, typed command/result/event
reducer, deterministic random outcome, typed correction, canonical SHA-256
digest, journal/save/load/replay, and ordinary four-player headless scenario.

## Required preflight

Before editing, verify:

1. HEAD is the stated Base SHA.
2. Both ledger collections contain exactly one O4P-01M entry and both are
   `shipped`.
3. Both ledger collections contain exactly one O4P-01N entry and both are
   `pending` with dependency O4P-01M.
4. The frozen contract exists and names no missing shipped public type.

If any check fails, return a blocker packet and do not edit.

## Allowed reads

- `AGENTS.md`, `docs/judge-protocol.md`, document-governance references
- the frozen contract and grounding named above
- O4P-01J/K/L/M contracts, public Core source, ordinary tests, fixtures, and
  verifiers
- `src/versioning/contractVersions.ts` and `src/data/gameSnapshot.ts` as
  read-only version-boundary evidence
- architecture tests as read-only boundary evidence

## Allowed writes

Only:

- `src/engine/core/closure/**`
- ordinary tests under `src/engine/core/closure/__tests__/**`

No unspecified path may change.

## Required source partition

Keep concerns separate enough for review. Expected files are:

- `versionsV1.ts`
- `rootV1.ts`, `rootValidationV1.ts`, `canonicalV1.ts`
- `commandV1.ts`, `commandValidationV1.ts`, `commandResultV1.ts`
- `domainEventV1.ts`, `applyCommandV1.ts`
- `randomZoneOrderV1.ts`, `correctionV1.ts`
- `journalV1.ts`, `replayV1.ts`
- `headlessClosureV1.ts`
- lane-local `index.ts`
- focused ordinary tests under the lane-local test directory

Equivalent decomposition is allowed only within the allowed write root and
without changing public names frozen by the contract.

## Implementation order

1. Versions, strict validation helpers, root composition, canonical JSON, and
   SHA-256 test vectors.
2. Command/result/event algebra and strict command validation.
3. Closed adapters for J/K/L/M operations, deterministic zone order, and two
   typed corrections.
4. Journal, package validation, save/load/replay divergence checks.
5. Four-player ordinary headless scenario and hostile validation/property
   coverage.

Do not report completion after an intermediate phase. If a later phase exposes
a contract contradiction, stop and return the exact symbol/path conflict.

## Forbidden

- No git add/commit/push/branch/stash.
- No `AGENTS.md`, `CLAUDE.md`, `docs/**`, ledger, loop-state, contract,
  `review.*`, architecture, fixture, verifier, package/lock, dependency,
  version registry, Solo snapshot, root barrel, Online, UI, Cloudflare, or
  generated-file changes.
- No public API outside the frozen contract.
- No new payload kind, generic mutation, JSON Patch, whole-state replacement,
  `any`, hidden randomness, wall clock, locale-dependent ordering, raw error
  escape, or secret-bearing error/event payload.
- No weakening or editing existing tests.
- No claim that DEFERred adapters or full combat damage are automated.

## Required checks

Run only targeted implementation checks:

- all ordinary tests under `src/engine/core/closure/__tests__/**`
- targeted ESLint for `src/engine/core/closure/**`
- `npm run build`
- `git diff --check`
- confirm forbidden paths are unchanged relative to Base SHA

Do not run the release full `npm run check`; the Sol judge owns it after cold
audit.

## STOP conditions

- A frozen type or named shipped operation is missing or has an incompatible
  signature.
- The root would duplicate an existing J/K/L/M authority.
- A handler requires a new public payload kind, error code, root field, version
  bump, dependency, or write outside the allowed lane.
- Player exit cannot be integrated without guessing an unshipped cleanup
  transition.
- SHA-256 cannot be provided browser-safely without a dependency or Node-only
  source import.
- A hostile input cannot be rejected deterministically without generic
  mutation or invoking a getter.

## Return packet

1. Changed files.
2. Frozen contract clauses implemented.
3. Exact targeted checks and results.
4. Explicit DEFER list.
5. Unresolved issues or STOP condition.
6. Proposed Sol-owned integration steps.
7. Confirmation that every forbidden path is unchanged and no git operation
   occurred.
