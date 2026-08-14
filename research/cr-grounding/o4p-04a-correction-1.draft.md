# O4P-04A implementer correction 1

Milestone: `O4P-04A`

Base SHA: `64ac8c6de1bc62262154cebf5419ae82d13bc3cb`

Authority:
`research/cr-grounding/o4p-04a-personal-workbench.contract.draft.md`

The implementer may edit only its original source and ordinary-test scope. It
must not edit this brief, any `review.*` test, fixture, judge/governance file,
dependency, or git state.

## Accepted findings

1. `PersonalWorkbench` currently uses `turn.activePlayerId` as a priority
   proxy. The projection intentionally omits the priority holder, so this
   incorrectly disables a server-authorized priority-pass attempt whenever the
   own lifecycle-active Player is not the active turn player. Gate the attempt
   on ready interaction, active Room, pending outcome, and own
   `player.status === "active"`; do not gate it on `turn.activePlayerId`.
2. After a confirmed concede emits at Player P and revision N, reopening the
   confirmation permits a duplicate concede at the same P/N. Disable repeated
   concede for that exact player/revision and re-enable it only after a new
   projection identity/revision arrives.

## Required evidence

- Add or extend ordinary component tests for a non-active-turn priority-pass
  request and same-player/revision concede deduplication.
- Run the affected ordinary and judge-owned DOM review tests, scoped ESLint,
  `npx tsc -b`, and Vite build. Report results without changing judge-owned
  files.
