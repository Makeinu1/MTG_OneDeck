# O4P-07B Implementation Brief

Milestone: `O4P-07B`
Base SHA: `a650c5edc09afc03b59e3da9f55950485eec140d`
Contract: `research/cr-grounding/o4p-07b-arbitrary-deck-ui-dynamic-genesis.contract.draft.md`
Acceptance: `research/cr-grounding/o4p-07b-acceptance-brief.draft.md`
Risk: R3 / BROAD

## Goal

Implement the served arbitrary-deck v2 controller/UI, in-context saved-deck
import, accepted-only ready/start controls, repository readiness relation, and
deterministic snapshot-to-Core genesis exactly as frozen by the contract.

## Implementer ownership

The implementer owns source and ordinary non-`review.*` tests only:

- `src/online/publicApp/**` for a new v2 client/types boundary while preserving
  v1 compatibility until O4P-07C;
- `src/components/online/PublicOnlineApp.tsx`, its CSS, and ordinary component
  tests;
- the smallest `src/App.tsx`, `src/components/ImportScreen.tsx`, and ordinary
  test changes needed for an in-context importer that preserves the Room;
- a new lower `src/online/genesis/**` dynamic builder/adapter and ordinary
  tests;
- `src/online/lobby/index.ts` only for reusable v2-ready/internal lifecycle and
  legacy projection compatibility helpers;
- `src/online/cloudflare/{types,persistence,runtime,index}.ts` and ordinary
  tests for v2 ready/start, snapshot loading/CAS, and atomic initialization.

The implementer is not alone in the repository. Preserve concurrent Judge
files and adapt to them; never revert or overwrite them. Do not edit git,
`AGENTS.md`, `CLAUDE.md`, `eslint.config.js`, package/dependency/config files,
`docs/`, `research/`, `.claude/`, the ledger, generated files, or any
`review.*` test.

## Constraints

- TypeScript strict, no `any`; treat fetch, IndexedDB, snapshot JSON, and UI
  inputs as hostile unknown data and validate before use.
- Do not import `catalogV1`, `fourDeckBootstrapV1`, fixed JSON fixtures, or
  `parseDeckList` from the new v2 genesis/runtime start path. Do not call
  Scryfall during start.
- Do not send CardDef/name/deck text from the v2 client and do not fall back to
  v1 submit/ready/start after any v2 failure.
- Keep capability/bearer material out of errors, DOM, logs, snapshots, Core,
  replay, storage metadata, and URLs.
- Preserve v1-only behavior for cached clients, but mixed/v2-corrupt rooms must
  fail closed. O4P-07C owns v1 rejection and production import-graph removal.
- Bound quantity expansion before iteration and retain the exact 1 MiB size
  gate. No time/random dependence is permitted in Core/physical IDs/digests;
  randomness is only for fresh opaque client submission IDs.
- Preserve keyboard/native controls, current design tokens, right-click
  alternatives where applicable, 44px action targets, and responsive layouts.

## Done when

Report changed source/ordinary-test files, exact targeted commands/results,
deferred O4P-07C work, and unresolved points. Targeted evidence must cover all
twelve acceptance items, including hostile response parsing, owner secrecy,
same-deck seats, zero/multiple commanders, DFC, size/CAS rollback, reconnect/
replay, import/session preservation, and v1/Solo regressions. Do not run the
release full check, change Judge acceptance/review bytes, commit, push, deploy,
promote the ledger, or claim shipment.
