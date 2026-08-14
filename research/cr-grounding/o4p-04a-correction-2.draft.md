# O4P-04A implementer correction 2

Milestone: `O4P-04A`

Base SHA: `64ac8c6de1bc62262154cebf5419ae82d13bc3cb`

Authority:
`research/cr-grounding/o4p-04a-personal-workbench.contract.draft.md`

Cold audit:
`/root/o4p04a_cold_auditor` against semantic fingerprint
`7709d75be1f7d3de3f89e4ac3d300a0de7885057243de19bf1d2d987f5fd9013`

This is implementer correction 2 of 2. The implementer may edit only its
original source and ordinary-test scope. It must not edit this brief, any
`review.*` test, fixture, judge/governance file, dependency, or git state.

## Accepted findings

1. HIGH `O4P-04A-CA-H001`: validator-accepted spell-copy,
   activated-ability, and triggered-ability stack entries have no card runtime.
   Represent them with the contract's new closed `stack-object` view form and
   fixed Japanese kind labels. Do not reconstruct or retain ability/source/
   target/choice/legality data. Card/token visible objects keep the existing
   card form.
2. HIGH `O4P-04A-CA-H002`: capture `{ corePlayerId, revision }` when concede
   confirmation opens. Hide and reject the confirmation as soon as either
   differs from the current validated view; a new Player/revision needs a new
   explicit confirmation.
3. MEDIUM `O4P-04A-CA-M001`: render a concealed object's nonzero
   `markedDamage` as a Japanese public-fact label.
4. LOW `O4P-04A-CA-L001`: map Player lifecycle status `active` to `プレイ中`
   and `exited` to `退席済み` in the component. Keep canonical values in the
   model.

Judge correction closes MEDIUM `O4P-04A-CA-M002` in judge-owned review tests;
the implementer must not edit those tests.

## Required ordinary evidence

- Add/extend ordinary model and component tests for all three synthetic stack
  kinds, stale Player/revision concede invalidation, nonzero concealed damage,
  and Japanese lifecycle labels.
- Run affected ordinary plus judge-owned DOM/architecture tests, scoped ESLint,
  `npx tsc -b`, and Vite build. Report exact results and unresolved items.
