# O4P-04C bounded implementer brief

Milestone: `O4P-04C`

Base SHA: `4b2f4ac534c489ce92d2f3dfce4774679c597502`

Contract:
`research/cr-grounding/o4p-04c-display-pairing.contract.draft.md`

Acceptance:
`research/cr-grounding/o4p-04c-acceptance-brief.draft.md`

## Goal

Implement the frozen additive Display Pairing model, deterministic Workbench
intent-to-protocol binding, adaptive paired React surface, ordinary tests, and
deterministic dev fixture without changing shipped projection semantics.

## Sole write scope

The implementer may add only:

- production and ordinary-test files under `src/online/displayPairing/**`;
- `src/components/online/OnlineDisplayPairing.tsx`;
- `src/components/online/onlineDisplayPairing.css`;
- `src/components/online/__tests__/OnlineDisplayPairing.test.tsx`;
- files under `src/dev/displayPairing/**`.

The implementer may not edit any existing file, any `review.*` test,
`src/test/architecture/**`, Judge briefs/evidence, docs, ledger, loop state,
package/config/dependency/version/cache, git, App/main, existing A/B component,
Projection, Room, protocol, Core, Cloudflare, headless, Store, or Solo source.

## Required behavior

1. Treat the contract and Judge acceptance tests as exact. Do not loosen
   audience validation or silently default/repair a pair.
2. Export one versioned public barrel with schema constant, fixed error,
   paired/focus/session/frame types, `buildOnlineDisplayPairingViewV1`, and
   `bindPersonalWorkbenchActionV1`.
3. Use only shipped public validators/builders/constructors. Return fresh
   deeply frozen values and preserve projected order without aliases.
4. Keep bearer authority only in required outbound frames. Never place it in a
   view, focus action, DOM, error, log, attribute, or snapshot.
5. Rebuild validation on every React render; generic failures retain no prior
   pair. Compose the real Personal Workbench and Table Display with strict
   audience placement.
6. Use native focus controls, stable test IDs, Japanese labels, existing CSS
   variables, and one adaptive tree for all three viewports.
7. The dev fixture may deterministically derive a matching Table projection
   from the frozen O4P-04A fixture, but it must not perform network/storage or
   enter production roots.
8. Add ordinary pure/component tests. Run only the complete O4P-04C targeted
   suite, scoped ESLint, `npx tsc -b`, and `git diff --check`.

## Return

Report changed files, exact targeted outcomes, visible DEFER, and unresolved
points. Do not run release `npm run check`, edit Judge evidence, or perform git
operations.
