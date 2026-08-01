# cr-609-one-shot-mass implementation brief

- Milestone: `cr-609-one-shot-mass`
- Base SHA: `a5a594ead1b5488735be129b6579622fa142897e`
- Contract: `docs/engine-spec.md` §34.52 and `docs/acceptance.md` G8
- Judge-owned review: `src/engine/__tests__/review.cr609-one-shot-mass.test.ts`, existing `review.cr608-resolution-sliceB.test.ts`, and `src/store/__tests__/review.damage-marked.test.ts`

## Goal

Implement the atomic destroy substrate and exact fail-closed mass-destroy compiler described by §34.52. Repair existing target destroy and lethal/deathtouch indestructible semantics. Wire saved announced X and atomic guided resolution. Add ordinary tests and executable real-card replay evidence.

## Constraints

- Do not edit `AGENTS.md`, `CLAUDE.md`, `docs/**`, `research/cr-grounding/cr-backbone-ledger*.json`, `.claude/loop-state.md`, any `review.*` file, or perform git operations.
- Do not change `GameState`, snapshot/cache versions, dependencies, or general `applyCommands` semantics.
- Freeze eligibility, effective characteristics, indestructible, and existing graveyard-to-exile replacement outcomes from the pre-command state.
- Unsupported compounds remain wholly manual with zero commands/prompts; no executable subset.
- Run targeted tests only. Do not run `npm run check` or update the decision snapshot; report the snapshot transition for judge review.

## Done when

- Judge-owned review compiles and passes without modification.
- Ordinary tests cover command atomicity/order invariance, compiler exact gates, announced X, target/LKI, guided resolution atomicity and store undo/redo, plus replacement/token/commander/trigger integration.
- `npm run check:forbidden` passes for implementer-owned changes.
- Report changed files, exact targeted commands/results, decision snapshot drift, deferrals, and unresolved issues.

