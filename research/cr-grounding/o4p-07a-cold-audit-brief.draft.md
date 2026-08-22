# O4P-07A Context-Free Cold Audit Brief

Date: 2026-08-22
Milestone: `O4P-07A`
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Pre-brief semantic tree fingerprint: `845038cd4fa39c942440fdf290dcb11cd02822aaebdfcca6f46b2360759261b9`
Profile: `BROAD` (R3 public protocol, server authority, SQLite migration/CAS,
and owner-private error meaning)

Read `AGENTS.md`, the development skill and governance reference, then the
O4P-07A contract and acceptance brief. Audit the frozen candidate without any
implementation context. Do not edit files, stage/commit, run the release-wide
`npm run check`, deploy, push, or use secrets/network.

Audit authority:

- `research/cr-grounding/o4p-07a-dynamic-card-resolution.contract.draft.md`
- `research/cr-grounding/o4p-07a-acceptance-brief.draft.md`
- `src/online/cloudflare/__tests__/review.o4p-07a-dynamic-card-resolution.test.ts`
- `src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts`

The pre-brief fingerprint covers the complete cached-plus-untracked tree before
this brief. Reproduce it while excluding only this brief:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded='research/cr-grounding/o4p-07a-cold-audit-brief.draft.md'; const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>path!==excluded); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Adversarial priorities:

1. Prove the v2 request parser is exact and fail-closed for prototypes,
   accessors, symbols, sparse arrays, invalid IDs/quantities/sections, UTF-8
   size, and configured capability fragments before resolver or mutation.
2. Prove production uses only Scryfall collection POST, sequential batches of
   at most 75 unique print IDs, exact print/Oracle identity, complete valid
   CardDef mapping including DFC, no client-definition fallback, and private
   structured retry behavior only for known failures.
3. Inspect SQLite schema v1-to-v2 migration, exact-one RETURNING checks,
   transaction rollback, seat-scoped head/history/snapshot relations, canonical
   digests, strict decode, replay/resume, same-ID conflict, fresh-ID retry,
   concurrent duplicate requests, newer-submission stale completion, and
   Durable Object recreation.
4. Attempt corrupt rows, digest-consistent invalid snapshots, optional CardDef
   type confusion, revision overflow, cross-room/seat/participant relations,
   v1/v2 mutual invalidation, identical decks on different seats, and snapshot
   overflow. Confirm all fail closed without stale ready/snapshot authority.
5. Inspect every public result/projection, runtime fact/log, generic failure,
   and persisted metadata for capability/bearer or other-seat private-detail
   leakage. Card definitions belong only in the seat snapshot; v2 never sets
   ready and cannot start through the unchanged v1 genesis path.
6. Confirm O4P-07A does not change public UI, fixed bootstrap/catalog/start
   meaning, package/config/dependencies, deployment, CR authority, ledger, or
   any O4P-07B/C behavior.

Required bounded evidence (do not run `npm run check`):

```sh
npm run check:forbidden -- --diff 55fe011700bd6bb10a699e1bd431f0bf12cc40cb
npx vitest run --project dom src/online/deckSubmission/__tests__/v2.test.ts src/online/cloudflare/__tests__/deckSubmissionV2.test.ts src/online/cloudflare/__tests__/review.o4p-07a-dynamic-card-resolution.test.ts src/online/cloudflare/__tests__/persistenceV1.test.ts src/online/cloudflare/__tests__/runtimeV1.test.ts src/online/cloudflare/__tests__/lobbyRuntimeV1.test.ts src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts
npx tsc -p tsconfig.app.json --noEmit
npx eslint src/online/deckSubmission src/online/cloudflare/index.ts src/online/cloudflare/persistence.ts src/online/cloudflare/runtime.ts src/online/cloudflare/scryfallResolver.ts src/online/cloudflare/types.ts src/online/lobby/index.ts src/online/cloudflare/__tests__/deckSubmissionV2.test.ts src/online/cloudflare/__tests__/review.o4p-07a-dynamic-card-resolution.test.ts src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts
npm run check:docs
git diff --check
```

Report findings only with exact evidence and
`BLOCKER/HIGH/MEDIUM/LOW` totals. Return `AUDIT-OK-PENDING-FULL-CHECK` only if
BLOCKER and HIGH are zero and all required corrections are closed. Include the
pre-brief semantic fingerprint and final full candidate tree fingerprint. Do
not create the audit record; the Judge owns it.
