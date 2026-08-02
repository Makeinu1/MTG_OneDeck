# Implementer brief: cr-701-cross-player-actions

- Milestone ID: `cr-701-cross-player-actions`
- Base SHA: `0eff51307c96816f6d67cac1ed715f39690ed31f`
- Brief path: `research/cr-grounding/cr-701-cross-player-actions-implementation-brief.draft.md`
- Role: implementer

## Goal

Implement the judge-frozen contract in `docs/engine-spec.md §34.53` and
`docs/acceptance.md G9`: player-aware each-player/opponent discard, mill, and
sacrifice with APNAP choices, simultaneous semantic events, exact fail-closed
grammar, and the existing guided UI.

## Constraints

- Do not use git.
- Do not edit `AGENTS.md`, `CLAUDE.md`, `eslint.config.js`,
  `CACHE_SCHEMA_VERSION`, `docs/**`, the CR ledger, this brief, any file whose
  name contains `review.`, or `src/store/__tests__/crGroundingGoldenCases.test.ts`.
- Do not add dependencies, GameState fields, snapshot/cache versions, or a new
  dialog. Reuse `EffectPrompt`, `guidedPlanForStackTop`, Decision Focus,
  `discard`, `mill`/`applyPlayerEffect`, and `moveCard` as §34.53 specifies.
- Keep compiler functions pure and roster-independent. State-aware prompt
  expansion belongs in the existing engine/store orchestration boundary.
- Target-player/that-player/defending-player, random/variable/qualified choices,
  and same-clause multi-action composites remain whole-effect manual.
- Preserve all existing self discard/sacrifice and cross-player draw behavior.
- Run targeted tests only. Do not run `npm run check`; the judge runs it once
  after cold audit.

## Expected implementation surface

- `src/engine/grammar/compile.ts`
- `src/engine/commands.ts`
- `src/engine/types.ts`
- `src/store/gameStore.ts`
- `src/components/game/gameController.tsx` only for the concrete player label
- ordinary non-review tests beside the affected engine/store/UI modules
- `research/grammar-compile/decision-snapshot.json` only via
  `npm run snapshot:update`, after recording the transition summary

This list is a boundary, not a requirement to touch every file.

## Required targeted evidence

1. Add/adjust ordinary tests for exact compiler shapes, runtime prompt expansion,
   multi-count selection, insufficient resources, semantic event grouping, and
   existing self-leaf non-regression.
2. Run the two judge-owned CR701 review files plus the existing cross-player
   draw, MP zone/command, discard, sacrifice, and CR603 semantic review pins.
3. Run the decision snapshot test. If intentional CR701 transitions appear,
   regenerate once and report old→new counts and representative card names;
   do not accept unrelated transitions.
4. Run targeted ESLint and `npm run build` only after the targeted behavioral
   suite is green.

## Done when

- §34.53 / G9 behavior is implemented without protected-file edits.
- Required targeted tests, targeted lint, and build are green.
- Report changed files, exact commands/results, snapshot transitions, honest
  deferrals, and unresolved points. Do not claim audited or shipped status.
