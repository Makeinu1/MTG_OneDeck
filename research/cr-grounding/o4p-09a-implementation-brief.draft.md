# O4P-09A implementer envelope

Milestone ID: `O4P-09A`

Base SHA: `0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`

Brief path: `research/cr-grounding/o4p-09a-implementation-brief.draft.md`

Goal: Extract the explicit store-free `GameScreenInteractionPort`, make the
existing `GameScreen` render the same surface through Local or injected ports,
and preserve Solo behavior.

Constraints:

- Implement exactly
  `research/cr-grounding/o4p-09a-unified-game-surface.contract.draft.md` and
  `research/cr-grounding/o4p-09a-acceptance-brief.draft.md`.
- Own only `src/components/game/**` source and ordinary non-`review.*` tests.
- Do not edit git state, `AGENTS.md`, `docs/`, ledger/research files,
  `review.*`, engine/store semantics, online runtime/protocol, dependencies,
  configuration, CR bytes, or generated files.
- Preserve `GameController` as a compatibility type if useful, but its public
  surface must be the store-free port. Replace every production
  `controller.store` reach-through with explicit fields/methods.
- Do not create a second player screen or add Remote behavior.

Done when:

- `gameScreenInteractionPort.ts` defines the explicit port without `GameStore`,
  Zustand, `useGameStore`, generic dispatch, transport, or protocol types.
- `useGameController` returns the port and `GameScreen` supports an injected
  port through the same internal surface while the current App/Solo path stays
  unchanged.
- Production `src/components/game/**` has zero `controller.store` references.
- Add/adjust ordinary tests for injected-port rendering and explicit action
  forwarding; targeted game component tests, TypeScript, ESLint, and the
  provided Judge review pass.
- Report changed files, commands/results, deferred scope, and unresolved points.

## Judge amendments after the first implementation gate

- Source ownership was narrowly expanded to
  `src/dev/uxResearch/ResearchRecorder.tsx` so the dev-only Local recorder could
  preserve its exact `pendingGuided` checkpoint payload without exposing store
  state through the public port. It remains absent from injected-port mode.
- Ordinary-test ownership was expanded to
  `src/components/game/CommanderAltar.test.tsx`. Judge retained and performed
  projection-only migrations in
  `src/components/game/OpponentSetupScreen.review.test.tsx` and
  `src/components/game/__tests__/review.s1-stack-pile.test.tsx`.
- The user explicitly approved the implementer lineage result at 164 model
  cycles despite the repository 160-cycle ceiling. This ruling applies only to
  this existing O4P-09A candidate and does not reset or waive any quality gate.
- `npm run check:fast` unexpectedly selected the release lane, consuming full-
  check invocation 1 and stopping at the expected stale UI manifest anchors.
  The implementer did not rerun it; only one final release full check remains.
