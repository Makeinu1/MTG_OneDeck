# Cold Audit Brief: cr-720-omen-cards

## Scope

- Base SHA: `5c61bd6`
- Tree fingerprint: `74ed6a93849d0d5dbbd07a970807ef6ac893f6bc8fc059b436e1bbde1e1726c2`
- Fingerprint method: SHA-256 over `git diff 5c61bd6 -- src/engine` plus the four new
  files listed below (judge contract, implementer brief, both test files), concatenated.
- Contract: `research/cr-grounding/cr720-omen-cards.draft.md` (read fully; judge-owned,
  includes 2026-08-04 judge rulings on copy resolution and O6 semantics).
- Pinned CR: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` — §720.2–720.5, §707.10a,
  §712.8f, §608.2.

## Changed files (diff vs base)

- `src/engine/types.ts` (MODIFIED) — `CardInstance.castAsOmen?: boolean`
- `src/engine/commands.ts` (MODIFIED) — cast validation (`validateCastAsOmen`), stack
  flag (`applyCastToStack`), 720.3d resolve override with 707.10a copy branch
  (`applyResolveStackTop`), immediate `applyCast` Omen path, copy propagation
  (`applyCopyStackItemOnce`), zone-change clear (`resetCardForZoneChange`), face-scoped
  spell effect-line filter (`effectLinesForStackItemState`)
- `src/engine/__tests__/review.cr720-omen-cards.test.ts` (NEW, judge-owned — must be
  UNMODIFIED by the implementer)
- `src/engine/__tests__/review.properties.test.ts` (MODIFIED, judge-owned I57 invariant)
- `src/engine/__tests__/omenCards.test.ts` (NEW, implementer-owned)
- `research/cr-grounding/cr720-omen-cards.draft.md` (NEW, judge contract; included in fingerprint)
- `research/cr-grounding/cr720-omen-cards-implementer-brief.md` (NEW, judge brief)
- `research/cr-grounding/cr720-omen-cards-cold-audit-brief.md` (THIS file; excluded from fingerprint)

## Audit instructions

You are a cold auditor without implementation context. For each CR clause below, verify
the implementation against the pinned local CR file, then probe adversarially.

CR clauses to verify:

1. 720.3/720.3a: casting as Omen requires the omen layout + Omen face; validation errors
   on anything else (both `castSpell` and `castToStack`).
2. 720.3b: while on the stack as an Omen, ONLY alternative characteristics apply — in
   particular the spell effect-line resolver must NOT compile the normal face's lines.
   Probe: multi-face omen definitions where face 0 text would produce visible effects.
3. 720.3c: `copyStackItem` propagates `castAsOmen` + faceIndex; the copy is an Omen.
4. 720.3d: resolving an Omen spell shuffles it into its owner's library via
   `libraryShuffleOrder`; without an order, top-of-library + warning (honest degradation).
   Resolving an Omen COPY must NOT put the copy into the library (707.10a): it ceases to
   exist; no EngineError; library untouched.
5. 720.4: off the stack, only normal characteristics — countered/bounced Omen reverts
   (`castAsOmen` cleared, `faceIndex` 0). Verify I57 via the property walk: no off-stack
   object may carry `castAsOmen === true`.
6. Regression: face-scoped effect-line filter must not change behavior for single-face
   cards or existing multi-face (modal_dfc/transform) cast flows — run the full core
   project and `review.cr712-8d-dfc-face-filter.test.ts`.

Machine evidence to run:

1. `npx vitest run src/engine/__tests__/review.cr720-omen-cards.test.ts` (8 golden cases)
2. `npx vitest run src/engine/__tests__/omenCards.test.ts`
3. `npx vitest run --project core --reporter=dot` (must be all green)
4. TypeScript strict compliance: no `any`, no unsafe casts in changed files.
5. Engine purity: no React/DOM/Zustand imports under `src/engine/`.

## Findings format

Return findings only (no file edits). Each finding:
`FINDING-<n> [BLOCKER|HIGH|MEDIUM|LOW] <title>` — CR reference, file/line, observed vs
expected, suggested direction. Classify each as implementation, compiler, substrate,
contract, or ambiguity. Verdict: `BLOCKED` or `AUDIT-OK-PENDING-FULL-CHECK`.
