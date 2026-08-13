# O4P-03C Luna implementation brief

Milestone: `O4P-03C`

Base SHA: `a6f4c539a977e38a6891c31fb99acf4fddfee428`

Read first:

- `AGENTS.md` implementer boundaries;
- `research/cr-grounding/o4p-03c-capability-abuse-control.contract.draft.md`;
- `research/cr-grounding/o4p-03c-acceptance-brief.draft.md`.

## Goal

Implement exactly the frozen O4P-03C Cloudflare security envelope: classified
expiring/rotatable tokens, internal mapping to shipped capabilities, role
allowlist, controller lease, bounded abuse admission, safe attachments/errors,
bounded audit facts, atomic SQL, and recreation recovery.

## Write scope

- `src/online/cloudflare/**`, excluding every path containing `review.`;
- ordinary Cloudflare tests under that directory.

Do not edit `wrangler.jsonc`, any file outside that directory, package/lock
files, dependencies, versions, lower Online layers, `review.*`, scripts/checks,
docs/contracts/briefs, ledger, loop-state, governance, engine, store, UI, or
git state. Do not run git commands.

## Constraints

- TypeScript strict, no `any`, Node runtime import, external dependency, timer,
  alarm, standard socket accept/listener, console sink, or in-memory authority.
- Use the exact constants, routes, closed records, expiry/window edges,
  allowlist, audit cap, CAS/rollback rules, and DEFERs in the contract.
- Preserve lower protocol validation: authorize the network token, construct a
  fresh internal message with the identity's shipped protocol capability, then
  invoke the lower operation exactly once.
- Never echo/store a token outside the dedicated current-grant field; never put
  a token/digest/fragment in attachment, error, audit fact, or log.
- Existing pre-03C storage must fail closed; do not implement migration/repair.
- Update affected ordinary 03A/03B tests for the required security schema and
  behavior, but do not touch any Judge `review.*` test.

## Verification and report

Run only affected ordinary Cloudflare tests, scoped lint, `npm run build`, and
`git diff --check`. Do not run `npm run check`, Judge review tests, or Judge
verifiers. Report changed files, exact results, clause coverage, DEFERs,
unresolved points, and confirmation of no git/out-of-scope edit.
