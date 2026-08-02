# Cold Audit Brief: cr-714-sagas-deferred-by-demand

## Scope

Frozen candidate tree fingerprint: `a3b4aa53615b06550f2bb21b7e8f8a5fa300e245774d826d6b9e88ec3a0ab84a`
Base SHA: `d233f76`

Changed files (diff vs base):

- `src/engine/sagaGrammar.ts` (NEW) — chapter ability parser
- `src/engine/commands.ts` (MODIFIED) — chapter triggers, lore timing fix, SBA 714.4
- `src/engine/__tests__/sagaGrammar.test.ts` (NEW)
- `src/engine/__tests__/sagaChapterTriggers.test.ts` (NEW)
- `src/engine/__tests__/sagaSba.test.ts` (NEW)
- `src/engine/__tests__/m46.test.ts` (MODIFIED) — lore timing assertion update
- `src/engine/__tests__/review.m46.test.ts` (MODIFIED) — lore timing assertion update (judge lane)
- `src/engine/__tests__/review.cr714-saga-chapter-sba.test.ts` (NEW) — judge-owned review test
- `research/cr-grounding/cr-backbone-ledger.json` (MODIFIED) — cr-702-194-teamwork sync

## Contract

CR 714 (pinned local CR file `rule/Magic_The_Gathering_Comprehensive_Rules.txt`):

- 714.2b: "{rN}—[Effect]" means "When one or more lore counters are put onto this Saga, if the number of lore counters on it was less than N and became at least N, [effect]."
- 714.2c: "{rN1}, {rN2}—[Effect]" means the same as "{rN1}—[Effect]" and "{rN2}—[Effect]."
- 714.2d: A Saga's final chapter number is the greatest value among chapter abilities it has. If a Saga somehow has no chapter abilities, its final chapter number is 0.
- 714.3a: Each Saga without read ahead has the intrinsic ability "This Saga enters with a lore counter on it."
- 714.3c: As a player's precombat main phase begins, that player puts a lore counter on each Saga they control with one or more chapter abilities. This turn-based action doesn't use the stack.
- 714.4: If the number of lore counters on a Saga permanent with one or more chapter abilities is greater than or equal to its final chapter number, and it isn't the source of a chapter ability that has triggered but not yet left the stack, that Saga's controller sacrifices it. This state-based action doesn't use the stack.

## Audit instructions

You are a cold auditor. You have NOT seen the implementation reasoning. Your job:

1. Read the CR clauses above from the pinned local CR file.
2. Read each changed file listed above.
3. For each CR clause, verify the implementation matches. Check:
   - Parser correctness (Roman numerals, multi-chapter lines, edge cases)
   - Trigger generation semantics (714.2b threshold crossing, not re-triggering)
   - Lore timing (714.3c: main1, NOT untap)
   - SBA 714.4 (sacrifice condition, pending-trigger exception, finalChapter=0 skip)
   - No regressions in existing behavior
4. Run: `npx vitest run src/engine/__tests__/review.cr714-saga-chapter-sba.test.ts`
5. Run: `npx vitest run src/engine/__tests__/` (all engine tests)
6. Check for TypeScript strict compliance: no `any`, no unsafe casts.
7. Check for engine purity: no React/DOM/Zustand imports in `src/engine/`.

## Findings format

Return findings as a list. Each finding:
- ID: F1, F2, ...
- Severity: BLOCKER / HIGH / MEDIUM / LOW
- Category: implementation / compiler / substrate / contract / ambiguity
- File + line(s)
- Description
- CR reference (if applicable)

If BLOCKER=0 and HIGH=0, verdict is `AUDIT-OK-PENDING-FULL-CHECK`.

Do NOT edit any files. Do NOT run `npm run check`. Return findings only.
