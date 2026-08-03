# cr-720-omen-cards — Implementer Brief (correction/completion round)

## Milestone

- Milestone ID: `cr-720-omen-cards`
- Base SHA: `5c61bd6` (origin/main HEAD; worktree contains the in-progress candidate)
- Contract: `research/cr-grounding/cr720-omen-cards.draft.md` (read it fully)
- Pinned CR: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` §720.2–720.5, §707.10a

## State of play

The engine substrate is ALREADY implemented in the worktree (do not re-implement):

- `src/engine/types.ts`: `CardInstance.castAsOmen?: boolean`
- `src/engine/commands.ts`: cast validation (`validateCastAsOmen`), stack flag in
  `applyCastToStack`, 720.3d resolve override in `applyResolveStackTop` (with the
  707.10a copy-cease-to-exist branch), immediate `applyCast` Omen path, copy
  propagation in `applyCopyStackItemOnce`, zone-change clear in `resetCardForZoneChange`,
  face-scoped effect-line filter in `effectLinesForStackItemState` (712.8f/720.3b).
- `src/engine/__tests__/review.cr720-omen-cards.test.ts`: JUDGE-OWNED golden tests —
  all 8 pass. DO NOT MODIFY.

## Your task (single deliverable)

Contract §8 requires `src/engine/__tests__/omenCards.test.ts` — implementer-owned
ordinary tests. It does not exist yet. Create it:

1. Cover the contract behaviors with your own fixtures (do not copy the review test):
   - cast validation errors (non-omen layout, wrong face) via `castToStack` and `castSpell`
   - stack flag + faceIndex on cast as Omen (720.3/720.3b)
   - resolve WITH `libraryShuffleOrder` (permutation applied; card inside library)
   - resolve WITHOUT order (top of library + warning string present)
   - countered Omen → graveyard, `castAsOmen` cleared, `faceIndex` 0 (720.4)
   - copy: `castAsOmen` propagated; resolving the copy deletes it (707.10a) and the
     library is untouched
   - immediate `castSpell` Omen path: library destination, `spellsCastThisTurn` incremented
   - off-stack invariant: a card bounced from stack (e.g. `moveCard` to hand) never
     carries `castAsOmen`
2. Reuse `./helpers` (`makeDef`, `makeDeck`) and the established import style
   (`initGame` from `../init`, `applyCommand` from `../commands`, `CardDef` from
   `../../types/card`). Mirror the setup patterns of existing tests such as
   `src/engine/__tests__/doubleFacedCommanderResolution.test.ts`.
3. Verify: `npx vitest run src/engine/__tests__/omenCards.test.ts` then
   `npx vitest run --project core --reporter=dot` — both must be green.

## Constraints

- Do NOT touch: `review.*` files, `AGENTS.md`, `docs/`, ledger JSON, git in any form.
- Engine is pure functions; TypeScript strict, no `any`. UI text Japanese, code English.
- Do not refactor working code; only add the new test file (plus a minimal fix if a
  genuine engine bug is exposed — report it explicitly instead if you find one).

## Report format

Changed files, test counts, acceptance results, anything deferred or unresolved.
