# O4P-04A bounded implementer brief

Milestone: `O4P-04A`

Base SHA: `64ac8c6de1bc62262154cebf5419ae82d13bc3cb`

Contract:
`research/cr-grounding/o4p-04a-personal-workbench.contract.draft.md`

## Goal

Implement the frozen additive Player-only Personal Workbench, pure validated
view model, typed action intents, adaptive React surface, and deterministic
dev fixture. Preserve every private-information and role boundary.

## Sole write scope

The implementer may add only:

- production and ordinary-test files under `src/online/workbench/**`, except the
  frozen judge fixture below;
- production and ordinary-test files under `src/components/online/**`, except
  any path whose name contains `review`;
- files under `src/dev/personalWorkbench/**`.

The implementer may not edit any existing file. It may not edit:

- `src/online/workbench/fixtures/o4p-04a-personal-workbench-v1.json`;
- any `review.*` test or `src/test/architecture/**`;
- the contract/acceptance/cold-audit briefs, docs, ledger, loop state, package,
  config, dependency, git, cache, version, existing UI, Store, Core, Room,
  protocol, projection, Cloudflare, or headless file.

## Required behavior

1. Treat the contract and acceptance brief as exact. Do not broaden actions or
   infer hidden identity.
2. Export one versioned public workbench barrel with the schema constant,
   projection error, view/action/interaction types, and
   `buildPersonalWorkbenchViewV1`.
3. Validate `unknown` through the public projection validator, enforce the
   Player/seat/presence/outcome relation, copy only allowlisted facts, preserve
   ordering, and return fresh deep-frozen values.
4. Render the component from the pure view. Invalid input is a generic Japanese
   unavailable state. Use stable test IDs and native controls.
5. Emit only the three frozen actions. Confirm concede explicitly; never claim
   priority legality or success.
6. Use existing CSS variables and one adaptive tree for the three viewports.
7. The dev fixture imports the frozen JSON, renders the real component, and
   records the last emitted intent without network/storage or production
   integration.
8. Add ordinary tests for the pure model and component. Run only targeted
   tests, scoped lint/type/build checks needed to return a coherent candidate.

## Return

Report changed files, targeted commands/outcomes, any DEFER kept visible, and
unresolved points. Do not run the release full `npm run check`, edit judge
evidence, or perform git operations.
