# O4P-04B bounded implementer brief

Milestone: `O4P-04B`

Base SHA: `36237478838695e4cb1753bafaba0bc1aa4fa8f4`

Contract:
`research/cr-grounding/o4p-04b-table-display.contract.draft.md`

## Goal

Implement the frozen additive, read-only Table Display, pure validated view
model, adaptive React surface, and deterministic dev fixture. Preserve every
private-information, projection, and action boundary.

## Sole write scope

The implementer may add only:

- production and ordinary-test files under `src/online/tableDisplay/**`, except
  the frozen judge fixture below;
- production and ordinary-test files under `src/components/online/**`, except
  existing files and any path whose name contains `review`;
- files under `src/dev/tableDisplay/**`.

The implementer may not edit any existing file. It may not edit:

- `src/online/tableDisplay/fixtures/o4p-04b-table-display-v1.json`;
- any `review.*` test or `src/test/architecture/**`;
- the contract/acceptance/cold-audit briefs, docs, ledger, loop state, package,
  config, dependency, git, cache, version, existing UI, workbench, Store, Core,
  Room, protocol, projection, Cloudflare, or headless file.

## Required behavior

1. Treat the contract and acceptance brief as exact. Do not broaden display
   fields, actions, or hidden identity.
2. Export one versioned public Table Display barrel with the schema constant,
   projection error, view types, and `buildTableDisplayViewV1`.
3. Validate `unknown` through the public projection validator, enforce the
   Table/audience/four-seat relations, copy only allowlisted facts, preserve
   ordering, and return fresh deep-frozen values.
4. Omit all per-player zone entries from the view, retaining only validator-
   approved counts. Fail closed on hidden shared-zone entries.
5. Render the component from the pure view. Invalid input is a generic Japanese
   unavailable state. Use stable test IDs and no interactive element.
6. State the priority information boundary and never infer a priority holder.
7. Use existing CSS variables and one adaptive tree for the three viewports.
8. The dev fixture imports the frozen JSON and renders the real component
   without network, storage, action, or production integration.
9. Add ordinary tests for the pure model and component. Run only targeted tests
   and scoped lint/type/build checks needed to return a coherent candidate.

## Return

Report changed files, targeted commands/outcomes, any DEFER kept visible, and
unresolved points. Do not run the release full `npm run check`, edit judge
evidence, or perform git operations.
