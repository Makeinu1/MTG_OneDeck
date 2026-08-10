# O4P-01I-K Architecture Boundary Gate

Status: implemented-not-integrated
Milestone: `O4P-01I-K`
SLICE_SHA: `e1762fe`
Frozen contract: `research/cr-grounding/o4p-01i-stack-announcement.contract.draft.md`

## Goal

Prove that the O4P-01I stack-announcement slice remains an isolated,
mode-neutral core boundary. This gate is architecture evidence only; it does
not integrate the slice into product runtime, Solo state, Online runtime, or
the public core barrel.

## Acceptance

`src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts` uses the
TypeScript Compiler API to inspect every non-test TypeScript source file under
`src/engine/core/stack/**`. It detects static imports, type-only imports,
dynamic imports, import-equals declarations, and re-exports, resolves local
source edges, and reports all findings in deterministic order.

The gate rejects stack edges to `store`, `components`, or `online`; imports or
runtime references for React, Zustand, DOM, Cloudflare, WebSocket, IndexedDB,
Scryfall, `Date.now`, and `Math.random`; reverse imports from Object Registry
into stack; and use of Solo `TargetSelection`/`CardInstance` types.

It also proves that product runtime source does not import the stack slice,
that no `TargetSelection` alias is introduced by the stack slice, that no
stack type extends `CardInstance`, that no protocol/command/event or payment
lifecycle symbol is present in the stack slice, and that `src/online` contains
architecture only (no Online runtime subtree).

Violation ordering is fixed as follows:

1. stack edge
2. forbidden import
3. forbidden symbol
4. Object Registry reverse import
5. product-runtime stack import
6. Solo type alias
7. `CardInstance` heritage
8. protocol/command/event symbol
9. Online runtime

Within a category, file path, source position, and detail are ordered
deterministically. The test is independently executable with the DOM Vitest
project, without modifying production code or the existing review suites.

## Explicit boundaries

- No production code, index/barrel, `review.*`, ledger, docs, AGENTS,
  package, machine-check, or git changes.
- No command/event/protocol contract, payment lifecycle, Online runtime,
  persistence, transport, UI, or Solo integration.
- This draft is not a shipped release claim. Independent cold audit, full
  check, CI, and Pages evidence remain required before any status promotion.

## Verification command

```text
npx vitest run --project dom src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts
```

## Result

Implemented files are limited to this draft and the independent boundary
test. The intended handoff status is `implemented-not-integrated` pending
independent audit and later judge-owned integration decisions.
