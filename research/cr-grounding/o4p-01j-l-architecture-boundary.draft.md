# O4P-01J-L Architecture Boundary Gate

- Milestone: `O4P-01J`
- Lane: `O4P-01J-L`
- Base requested by user: `b84f5e758485338fc8f7783687f941834d0f3815`
- Status: `implemented-not-integrated`
- Scope: architecture test only; no transaction production changes

## Implemented

`src/test/architecture/o4p01jStackTransactionBoundary.test.ts` uses the
TypeScript Compiler API (`ts.createProgram`) and AST traversal to inspect the
transaction production sources. It collects every matching violation and
sorts the result by this fixed category order, then by normalized path, source
position, and detail:

1. transaction product-layer imports (`store`, `components`, `online`)
2. transaction runtime imports (React, Zustand, DOM, Cloudflare, WebSocket,
   IndexedDB, Scryfall)
3. transaction clock/random access (`Date.now`, `Math.random`)
4. Solo `GameCommand`/`CardInstance` imports and type references
5. Registry reverse imports into transaction
6. Announcement reverse imports into transaction
7. product-runtime imports into transaction

The AST reference collector covers value imports, type-only imports, dynamic
imports, re-exports, import-equals declarations, and `import()` type queries.
The current repository scan is clean. Virtual AST fixtures prove that all
listed categories and all required import forms are reported together in the
fixed order.

## Boundary notes

The required Core integration barrels (`src/engine/core/index.ts` and
`src/engine/core/stack/index.ts`) are excluded from the product-runtime and
Announcement reverse-import checks because the frozen O4P-01J contract
requires those export surfaces. Existing review-owned files and all
production, Solo, store, components, and online files remain unchanged.

## Targeted verification

- `npx vitest run --project dom src/test/architecture/o4p01jStackTransactionBoundary.test.ts` — 2/2 passed.
- `npx eslint src/test/architecture/o4p01jStackTransactionBoundary.test.ts` — passed.
- `npx tsc -b tsconfig.app.json --pretty false` — blocked by existing type errors
  in other O4P-01J transaction test files; no diagnostic referenced the new lane
  test.

No git operation, package change, ledger change, documentation change, or
integration was performed by this lane.
