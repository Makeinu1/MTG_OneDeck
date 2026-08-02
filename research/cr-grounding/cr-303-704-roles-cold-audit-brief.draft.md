# Cold Audit Brief: cr-303-704-roles

## Milestone

CR 303.7 / 704.5y — Role token attachment & duplicate SBA

## Base SHA

0c2d4315d7eda05a1aa1de45edf6d5ad44361051

## Candidate Tree (uncommitted working tree changes)

Modified:
- `src/engine/commands.ts` — 704.5y SBA logic, Role token def synthesis
- `src/store/gameStore.ts` — tokenKind type widening
- `src/types/card.ts` — tokenKind union extended with 7 Role variants
- `research/cr-grounding/golden-cases.json` — new golden case + formatting

New:
- `src/engine/__tests__/review.cr303-704-roles.test.ts` — engine-level review tests (6 tests)
- `src/store/__tests__/review.cr303-704-roles.test.ts` — store-level review tests (2 tests)
- `research/cr-grounding/cr-303-704-roles-brief.draft.md` — implementation brief

## CR References (pinned CR 2026-06-19)

- 303.7: Some Aura enchantments also have the subtype "Role."
- 303.7a / 704.5y: If a permanent has more than one Role controlled by the same player attached to it, each of those Roles except the one with the most recent timestamp is put into its owner's graveyard. This is a state-based action.
- 111.10j–r: Seven predefined Role tokens (Cursed, Monster, Royal, Sorcerer, Virtuous, Wicked, Young Hero).

## Contract Summary

1. Role tokens are created via `createToken`/`createDefinedToken` with `tokenKind` set to one of 7 Role variants.
2. A synthesized `CardDef` has `typeLine: 'Enchantment Token — Aura Role'` and correct `oracleText` from CR 111.10j–r.
3. Attachment uses the existing `attach` command (`CardInstance.attachedTo`).
4. 704.5y is implemented in `performStateBasedActionsOnce`: groups battlefield Role tokens by `(attachedTo, controllerId)`, keeps the one with highest `(enteredTurn, zoneChangeCounter)` tuple, moves the rest to graveyard with `sbaApplied: '704.5y'`.
5. SBA fires inside `applyCommand` via `stabilizeBeforePriority`.
6. Tokens moved to graveyard are subsequently cleaned up by 704.5d (off-battlefield token cease) in the next SBA pass.
7. Role static ability grants (+1/+1, trample, ward, etc.) are OUT OF SCOPE — deferred to continuous effects system.
8. Wicked Role LTB trigger is OUT OF SCOPE — deferred to trigger system.

## Audit Instructions

1. Read the pinned CR file (`rule/Magic_The_Gathering_Comprehensive_Rules.txt`) for rules 303.7, 303.7a, 704.5y, 111.10j–r.
2. Read the implementation diff: `git diff HEAD -- src/engine/commands.ts src/types/card.ts src/store/gameStore.ts`
3. Read the review tests: `src/engine/__tests__/review.cr303-704-roles.test.ts` and `src/store/__tests__/review.cr303-704-roles.test.ts`
4. Run the review tests: `npx vitest run src/engine/__tests__/review.cr303-704-roles.test.ts src/store/__tests__/review.cr303-704-roles.test.ts`
5. Run adjacent SBA tests to check for regressions: `npx vitest run src/store/__tests__/review.cr703-704-sba-turn-based.test.ts`
6. Adversarially probe:
   - Does the SBA correctly handle same-turn tokens with identical `(enteredTurn, zoneChangeCounter)`? (Both tokens created in the same turn via `createToken` get `enteredTurn: 0` and `zoneChangeCounter: 0`.)
   - Does the SBA fire when Roles are attached via the `attach` command (which triggers `stabilizeBeforePriority`)?
   - Are non-Role Aura tokens (e.g., Equipment) unaffected?
   - Does the SBA interact correctly with existing 704.5 checks (legend rule, lethal damage, etc.)?
   - Is the `collectDuplicateRoleIds` function correct when a Role's `attachedTo` target no longer exists on the battlefield?
7. Return findings classified as BLOCKER / HIGH / MEDIUM / LOW with severity, file, line, and description.
8. If BLOCKER/HIGH = 0, return verdict: `AUDIT-OK-PENDING-FULL-CHECK`.

## Constraints

- Do NOT edit any files.
- Do NOT run `npm run check` (full check is judge-owned, post-audit).
- Do NOT run git commands that modify state.
- Return findings only.
