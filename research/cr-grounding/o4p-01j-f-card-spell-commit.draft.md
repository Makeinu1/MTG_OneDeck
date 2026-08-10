# O4P-01J-F Card Spell Commit V1 Implementer Report

Status: `implemented-not-integrated`

## Scope

Implemented `commitCoreCardSpellToStackV1` as an additive Core transaction
slice. The implementation validates the complete transaction bundle first,
strictly inspects the operation input without invoking accessors, snapshots the
announcement input, and constructs Registry, Runtime, and Announcement
candidates before final complete-bundle validation.

The card transition preserves `physicalCardId` and physical-card ownership,
advances incarnation once, removes the old ObjectId, assigns the supplied
controller to the new card ObjectId, resets Runtime using the existing default
post-zone-change factory, appends the new ObjectId to the shared stack, and
stores the announcement under the new ObjectId. The source is accepted from
library, hand, graveyard, battlefield, exile, or command, but not from stack.
No synthetic, retarget, or removal transaction was implemented.

## Changed files

- `src/engine/core/stack/transaction/cardSpellCommitV1.ts`
- `src/engine/core/stack/transaction/__tests__/cardSpellCommitV1.test.ts`
- `src/engine/core/stack/transaction/__tests__/cardSpellCommitPropertyV1.test.ts`
- `research/cr-grounding/o4p-01j-f-card-spell-commit.draft.md`

## Verification attribution

- Targeted Vitest: 10 tests passed.
- Targeted ESLint: passed for all three source/test files.
- Build attribution: the lane source has no remaining TypeScript errors. Full
  `npx tsc -b --pretty false` remains red on pre-existing `review.*` and
  synthetic-stack lane files outside this allowlist.
- `npm run check:forbidden`: red because pre-existing review ownership changes
  and synthetic-stack lane files require judge re-authorization; this lane did
  not edit those files.
- Git operations: none.
- Integration, ledger/docs updates, exports, review, audit, and release were
  not performed.
