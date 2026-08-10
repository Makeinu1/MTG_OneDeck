# O4P-01K-K Architecture Boundary Gate

Status: `implemented-not-integrated`

Base: `COORDINATOR_SHA=527c7bd89871a5df3220a7efec2109bdb65a076c`

## Goal

Provide a standalone architecture gate for the pure Core turn/priority layer. The gate is authored with the TypeScript Compiler API, not grep-only text matching, and inspects every production module under `src/engine/core/turn/**`.

## Fixed boundary

The turn layer must not import product/runtime surfaces: `store`, `components`, `online`, React, Zustand, DOM adapters, Cloudflare, WebSocket, IndexedDB, or Scryfall. It must also avoid `Date.now` and `Math.random`, and must not introduce Solo/legacy `Phase`, `PendingTrigger`, or `GameState` type aliases or heritage dependencies.

The lower Core layers must not reverse-import turn: Object Registry, Stack Announcement, and Stack Transaction are checked separately. Product runtime modules outside `src/engine/core/**` must not import turn. Static imports, type-only imports, dynamic imports, `import()` type queries, ordinary re-exports, and type-only re-exports are all represented by the AST reference inventory.

## Implementation contract

- `ts.createProgram` parses all production `src` TypeScript units after excluding tests and fixtures.
- `ts.resolveModuleName` resolves relative and configured module edges before classifying a boundary violation.
- AST visitors inspect import declarations, per-specifier type-only imports, dynamic `import()` calls, `ImportTypeNode`, export declarations, time/random property access, legacy type references, and heritage clauses.
- Violation ordering is deterministic by source path, fixed violation-code order, reference kind, specifier, detail, and source position.
- Synthetic in-memory units pin every requested forbidden surface and import form without adding production files or changing module indexes.

## Acceptance

The targeted Vitest architecture test must prove that the current production tree is clean and that synthetic violations are complete and fixed-order. The implementation lane additionally runs strict ESLint on the changed test, `npm run build`, `npm run check:forbidden`, and `git diff --check`.

## Scope and defer

Only these files are in scope:

- `src/test/architecture/o4p01kTurnPriorityBoundary.test.ts`
- `research/cr-grounding/o4p-01k-k-architecture-boundary.draft.md`

No production source, index, ledger, docs, package, machine-check, review-owned file, or Git state is changed. Integration into a machine-check or release contract is deferred to the coordinator/judge lane. This slice remains `implemented-not-integrated` until independent cold audit and coordinator integration are completed.
