# O4P-03A Luna implementation brief

Milestone: `O4P-03A`

Base SHA: `95b34868966de671c97f0aa824422ccb0c14e051`

Read first:

- `AGENTS.md` implementer boundaries;
- `research/cr-grounding/o4p-03a-cloudflare-runtime-persistence.contract.draft.md`;
- `research/cr-grounding/o4p-03a-acceptance-brief.draft.md`.

## Goal

Implement the exact O4P-03A Worker, Room Durable Object, canonical codec,
SQLite repository, strict configuration, and ordinary tests. Reuse only the
shipped public Room/protocol/Core barrels allowed by the contract.

## Write scope

- `wrangler.jsonc`;
- `src/online/cloudflare/**`, excluding every path containing `review.`;
- ordinary O4P-03A test files named by the acceptance brief.

Do not edit any existing file, `package.json`, lockfiles, dependencies,
`review.*`, scripts/checks, docs, contracts/briefs, ledger, loop-state,
governance, version constants, other online layers, engine, store, or UI. Do
not run git commands.

## Implementation constraints

- TypeScript strict, no `any`, no Node runtime import, no external dependency.
- Use structural Cloudflare interfaces only for the exact runtime calls in the
  contract. Keep the repository injectable so tests use a faithful transactional
  fake without pretending to be Cloudflare.
- Call shipped validators/operations; do not clone or weaken their semantics.
- All SQL text is constant; all request values are positional parameters.
- No capability in the accepted-command journal or public evidence.
- No hibernation API, socket messages, reconnect, outbox, recovery, migration,
  auth expansion, UI, or version bump.

## Verification and report

Run only the four ordinary O4P-03A test files, lint for owned files when
possible, `npm run build`, and `git diff --check`. Do not run `npm run check` or
Judge-owned review tests. Report:

- changed files;
- exact commands/results;
- contract clauses implemented;
- explicit DEFERs;
- unresolved points;
- confirmation that no git operation or out-of-scope edit occurred.
