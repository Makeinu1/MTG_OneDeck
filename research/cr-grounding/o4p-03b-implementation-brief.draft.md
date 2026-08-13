# O4P-03B Luna implementation brief

Milestone: `O4P-03B`

Base SHA: `c7fe4e32a0b1e8fb4ebf33b07313b1bcd08340e9`

Read first:

- `AGENTS.md` implementer boundaries;
- `research/cr-grounding/o4p-03b-websocket-recovery.contract.draft.md`;
- `research/cr-grounding/o4p-03b-acceptance-brief.draft.md`.

## Goal

Implement exactly the O4P-03B hibernatable WebSocket state machine,
same-revision presence persistence, projected snapshot reload, command replay
deduplication, revision notice, recreation recovery, and immutable client outbox.

## Write scope

- `src/online/cloudflare/**`, excluding every path containing `review.`;
- the ordinary Cloudflare test files named by the acceptance brief.

Do not edit `wrangler.jsonc`, any existing file outside that directory,
`package.json`, lockfiles, dependencies, versions, lower Online layers,
`review.*`, scripts/checks, docs, contracts/briefs, ledger, loop-state,
governance, engine, store, or UI. Do not run git commands.

## Constraints

- TypeScript strict, no `any`, Node runtime import, external dependency, timer,
  alarm, standard WebSocket `accept`, or standard socket listener.
- Use only shipped public Room/protocol/projection/Core barrels allowed by the contract.
- No in-memory authoritative Room state; load SQLite for every application event.
- Attachment is closed, descriptor-safe, under 16KB, and capability-free.
- Per-message shipped capability validation remains mandatory after auth/hibernation.
- Same-revision persistence may change only presence and shipped lifecycle consequence.
- Do not clone or weaken shipped validation, projection, command, or dedup semantics.
- Preserve all O4P-03A HTTP behavior and tests.
- Keep every O4P-03C/D and UI boundary explicit and absent.

## Verification and report

Run only ordinary Cloudflare tests, affected lint, `npm run build`, and
`git diff --check`. Do not run `npm run check`, Judge review tests, or the
Judge verifier. Report changed files, commands/results, clause coverage,
DEFERs, unresolved points, and confirmation of no git/out-of-scope edit.
