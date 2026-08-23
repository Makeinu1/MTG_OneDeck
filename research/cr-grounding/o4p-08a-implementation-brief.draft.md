# O4P-08A Implementer Brief

Milestone: O4P-08A
Base SHA: `2c338a69f41eb693696db12c086e706423679aa6`
Contract: `research/cr-grounding/o4p-08a-shared-membership-recovery-errors.contract.draft.md`
Acceptance: `research/cr-grounding/o4p-08a-acceptance-brief.draft.md`

## Goal

Implement the frozen shared-admission, recovery, pre-start moderation, and
structured-error boundary without redesigning the public page or generalizing
the four-seat roster.

## Ownership

Own `src/online/lobby/**`, `src/online/cloudflare/**`, and
`src/online/publicApp/**` source plus ordinary non-`review.*` tests required by
the contract. You are not alone in the repository: preserve and accommodate
Judge changes. Do not revert other edits.

Do not edit `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `.agents/**`, `docs/**`,
`research/**`, ledger, `review.*`, package/dependency/configuration files, git,
or deployment state. No new dependency.

## Required implementation shape

- Keep the existing forming-lobby v1 bytes and add a separate validated v3
  admission/revocation model and SQLite persistence.
- Extend Worker/DO lobby routes with exact v3 request/response codecs while
  preserving generic handling for unknown/malformed/legacy inputs.
- Make kick/leave/deck cleanup/rekey transactional. Preserve v2 stale-resolution
  protection so a kicked seat cannot be resurrected by an in-flight resolver.
- Add canonical shared-code/fragment helpers, structured error parsing/mapping,
  and injectable localStorage recovery. Integrate recovery into the public
  controller API without changing the component layout in this parent.
- Reuse existing capability validators, collision checks, size limits, security
  controls, and v2 projection. Never loosen a closed parser.

## Done when

All ordinary targeted tests and the Judge-owned O4P-08A review tests pass; the
report lists changed files, acceptance results, deferred O4P-08B/C/D work, and
unresolved issues. Do not run full `npm run check`, stage, commit, push, deploy,
or claim shipment.
