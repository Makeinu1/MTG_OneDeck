# O4P-09C-UI implementer envelope

Milestone ID: `O4P-09C-UI`

Base SHA: `b87fc0b47b8a7073ee3037f6bd55e4a46e21ada8`

Brief path: `research/cr-grounding/o4p-09c-ui-implementation-brief.draft.md`

Goal: Wire the shipped Pregame lifecycle through the production Durable Object,
public controller, and the sole adaptive `GameScreen` for exact 2/4-player
40-life play through turn one.

Constraints:

- Implement exactly
  `research/cr-grounding/o4p-09c-ui-production-pregame.contract.draft.md` and
  `research/cr-grounding/o4p-09c-ui-acceptance-brief.draft.md`.
- You own required product source and ordinary non-`review.*` tests under
  `src/online/cloudflare/**`, `src/online/publicApp/**`,
  `src/components/online/**`, and `src/components/game/**`, plus the narrow
  `src/App.tsx` prop wiring if required. Keep changes minimal and cohesive.
- The Judge owns all `research/`, `docs/`, ledger, loop-state, generated files,
  and `src/test/architecture/review.o4p-09c-ui-production-pregame.test.ts`.
  Preserve those bytes. You are not alone in the worktree; do not revert or
  overwrite another agent's edits.
- Do not use git, change dependencies/config/CR, edit any `review.*`, add a
  second player screen/reducer, duplicate Core/Pregame semantics, or implement
  O4P-09D-J.
- Never expose Room IDs, invite codes, capabilities, random plans, library
  orders, private card identities, digests, raw state, or raw errors in reports,
  fixtures, logs, public output, or evidence.
- Preserve the existing 20-life lobby option but reject its transition into
  this 40-life Commander Pregame without mutation and with bounded guidance.

Done when:

- Production start creates and persists Pregame; participant commands and
  refresh/recovery use validated audience-safe projections through the public
  controller.
- `PublicOnlineApp` renders Pregame within `GameScreen`; 2p/4p users can perform
  the whole projected journey to turn one with exact actor and choice gating.
- Durable reconstruction, Local/Remote replay parity, stale/reuse/authorization
  rejection, secret redaction, Solo parity, and responsive UI have ordinary
  executable tests.
- Run focused affected tests, affected ESLint, build/typecheck, docs check, and
  `git diff --check`; report changed files, results, deferred scope, unresolved
  points, and no secret values.
