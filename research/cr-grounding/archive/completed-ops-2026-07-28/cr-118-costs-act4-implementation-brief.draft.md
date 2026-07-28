# CR118 ACT-4 implementation brief

Implement the frozen contract in `docs/engine-spec.md` §33.8 and make the
reviewer-owned acceptance test
`src/store/__tests__/review.cr118-act4.test.ts` pass.

Read first:

- `AGENTS.md`
- `docs/engine-spec.md` §33.8
- `docs/acceptance.md` G4-9 through G4-17
- `src/store/__tests__/review.cr118-act4.test.ts` (read-only contract)
- local CR 107.1, 107.3, 107.5, 118.3-4, 601.2f-h, 602.2, 605.3b,
  701.26a, 733.1

Scope:

1. Extend the shared activation-cost parser/planner for the exact tap-object
   descriptor subset, exact counts, source eligibility, reservations, and
   mana-ability reuse.
2. Add the frozen named-counter removal subset and preflight. Never rely on
   `addCounters` clamping.
3. Distinguish unbound X from announced X=0 and preserve repeated-X payment
   plus stack `announcedX`.
4. Wire store pending-guided answers and the common UI workspace, including a
   counter amount dialog and `x-cost-cancel`.
5. Preserve one transaction, cancel no-op, one undo/redo snapshot, CR605
   no-stack, and whole-cost manual fallback.
6. Add/update ordinary (non-`review.*`) tests for parser/planner/store/UI edge
   cases as useful.

Constraints:

- Do not edit `AGENTS.md`, `CLAUDE.md`, `docs/`, `review.*`,
  `research/cr-grounding/cr-backbone-ledger.json`, `eslint.config.js`,
  `CACHE_SCHEMA_VERSION`, or git state.
- Do not add dependencies.
- No new `GameCommand`, no new `GameState` field, no parallel pending state,
  no `any`.
- Keep engine code pure and independent of React/Zustand.
- Unsupported composite costs must remain wholly manual; never partially pay
  a recognized subcomponent.
- Existing forced sandbox mode must remain visibly non-CR-legal.

Verification:

```sh
npx vitest run src/store/__tests__/review.cr118-act4.test.ts
npx vitest run src/engine/__tests__/act4CostVocabulary.test.ts \
  src/engine/__tests__/review.g4-activate.test.ts \
  src/store/__tests__/review.activated-envelope.test.ts \
  src/store/__tests__/planGogo.test.ts
npm run check
```

Report changed files, exact results, deferred boundaries, and uncertainties.
