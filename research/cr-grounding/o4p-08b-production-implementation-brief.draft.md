# O4P-08B Production Implementer Brief

Milestone: `O4P-08B`
Base SHA: `0a7dfce483e77a1811614b3f9b289513ef46dd11`
Brief path: `research/cr-grounding/o4p-08b-production-implementation-brief.draft.md`

## Goal

Bind the shipped O4P-08A shared invitation, durable browser recovery,
pre-start moderation, and structured public errors to the approved deck-first
production UI. Preserve the existing fixed four-player started-game surfaces.

## Constraints and ownership

You own only these production areas and ordinary tests directly associated
with them:

- `src/App.tsx`
- `src/App.css`
- `src/components/online/PublicOnlineApp.tsx`
- `src/components/online/publicOnlineApp.css`
- `src/components/online/__tests__/*` files that do not contain `review.`
- `src/online/publicApp/types.ts`
- `src/online/publicApp/v2.ts`
- `src/online/publicApp/recoveryV1.ts`
- `src/online/publicApp/*` tests that do not contain `review.`

You are not alone in the codebase. Preserve all other edits and do not revert
them. Do not edit the approved dev fixture, `review.*`, docs, research, ledger,
governance/configuration, dependencies, generated artifacts, or git state.
Do not add variable roster, two-player play, 20-life selection, post-start
kick, account, matchmaking, ban, or remote heartbeat semantics. Do not render
Room ID, participant IDs, capabilities, private deck/card details, raw server
responses, or secrets in notices, attributes, logs, or snapshots.

Implement the exact meaning in
`research/cr-grounding/o4p-08b-public-online-journey.contract.draft.md` and the
approved fixture `src/dev/onlineLobbyPrototype/**`:

- move Solo/Online choice beside the selected saved deck and remove the global
  `一人回し / 4人オンライン` switch;
- expose mutually exclusive entry, join, recovery, forming-lobby, and started
  states; joining accepts exactly one invite and never Room ID;
- scrub `#online-invite=` before exchanging its capability;
- expose a non-secret `recoveryAvailable` signal and actionable recover flow;
- retain structured error code, retryability, Japanese cause/recovery text,
  correlation ID, and responsible action in the controller snapshot, including
  distinct local offline, timeout, invalid-response, and upgrade cases;
- expose shared create/join, invite copy/link copy, rotate, admission close,
  pre-start non-host kick with confirmation, leave, refresh, submit, ready, and
  start through authoritative O4P-08A requests;
- show the four named steps, selected deck/card count, stable seat labels,
  local/host identity, membership/deck/ready state, and exact start blockers;
- hide create/join once admitted, hide host moderation from guests and after
  start, and preserve PersonalWorkbench/Table/Guided started surfaces;
- use semantic buttons/fields, visible focus, at least 44px targets, no
  drag/double-click/hover/right-click-only action, and responsive layouts for
  375x812, 812x375, and 1440x900 without horizontal document overflow.

## Done when

Ordinary tests prove the state machine, one-field join and fragment scrub,
recovery offer/clear behavior, structured local/server errors, host/guest
moderation boundary, exact blockers, privacy boundary, and existing started
surface regression. Targeted Vitest, ESLint, `tsc -b`, and `git diff --check`
are green. Report changed files, targeted evidence, deferred O4P-08C/D work,
and unresolved issues. Do not run the full `npm run check`.
