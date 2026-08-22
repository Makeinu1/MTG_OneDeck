# O4P-07A Implementation Brief

Milestone: `O4P-07A`
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Contract: `research/cr-grounding/o4p-07a-dynamic-card-resolution.contract.draft.md`
Acceptance: `research/cr-grounding/o4p-07a-acceptance-brief.draft.md`
Risk: R3 / BROAD

## Goal

Implement the v2 structured deck submission, server-authoritative injectable
Scryfall resolution, safe v2 projection, seat-scoped SQLite head/history/
snapshot persistence, idempotency, replacement/CAS, restart, and private issue
boundary exactly as frozen in the contract.

## Implementer ownership

The implementer owns source and ordinary tests only:

- new lower-layer modules under `src/online/deckSubmission/**`;
- `src/online/lobby/index.ts` only for reusable seat authorization and atomic
  legacy-deck/ready invalidation helpers;
- `src/online/cloudflare/{types,persistence,runtime,index}.ts` and a new local
  production Scryfall resolver module;
- ordinary non-`review.*` tests under the affected Online/Cloudflare modules.

The implementer is not alone in the repository. Preserve concurrent Judge
files and adapt to them; never revert or overwrite them. Do not edit git,
`AGENTS.md`, `CLAUDE.md`, `eslint.config.js`, package/dependency/config files,
`docs/`, `research/`, `.claude/`, the ledger, generated files, or any
`review.*` test. Do not switch the public client/genesis or remove the fixed
catalog.

## Constraints

- TypeScript strict, no `any`; validate hostile unknown values before use.
- The lower deck-submission layer imports no Cloudflare/UI/store/cache module.
- Cloudflare code may import the lower deck-submission boundary and local
  modules only; the Judge owns any exact architecture allowlist update.
- No client CardDef/name fallback, no EDH legality, no sideboard, no automatic
  ready, and no v2 start path.
- Persist no capability/bearer in new tables, snapshot, digest, or issue JSON.
- Keep existing v1 tests and behavior green for untouched seats.
- Use deterministic canonical JSON and the repository SHA-256 helper; no time,
  random, or unordered-map dependence in snapshot/digest semantics.

## Done when

Report changed source/ordinary-test files, targeted commands/results, deferred
O4P-07B/C work, and unresolved points. Targeted evidence must cover every item
in the acceptance brief, including 76+ IDs, concurrency/stale completion,
restart/resume, rollback, size, mutual v1/v2 invalidation, and secrecy. Do not
run the release full check, commit, push, deploy, update acceptance, or claim
shipment.
