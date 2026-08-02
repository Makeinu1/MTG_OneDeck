# CR-310 Battles — Cold Audit Brief

**Candidate fingerprint**: 9f2c9decd5198bdbf093686face1998017b944bb2d9fb38d9a20aead0c91397b
**Base SHA**: f29dc938423cecdba075d9dc9e47ed5b25dc2ec6
**Contract**: `research/cr-grounding/cr-310-battles.draft.md`

## Your role

You are a cold auditor. You have NOT seen the implementation reasoning. Your job:
1. Read the contract (`research/cr-grounding/cr-310-battles.draft.md`).
2. Read the pinned CR text: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` lines 1797–1843 (CR 310) and lines 5530–5534 (704.5v/w/x).
3. Inspect the diff: `git diff HEAD` (the working tree changes).
4. Run the judge-owned review test: `npx vitest run --project core src/engine/__tests__/review.cr310-battles.test.ts`
5. Run the implementer test: `npx vitest run --project core src/engine/__tests__/cr310-battles.test.ts`
6. Run `npx tsc -b` to verify type safety.
7. Adversarially check:
   - Does the implementation match CR 310.4b (defense counters on ETB)?
   - Does CR 310.6 hold (damage removes counters, not damageMarked)?
   - Does CR 310.11b fire correctly (last counter → trigger → exile)?
   - Are SBA 704.5v/w/x correctly implemented?
   - Is CombatTarget backward-compatible (existing player targets unaffected)?
   - Does the protector model satisfy CR 310.8a/310.11a?
   - Are there any regressions to existing behavior?
8. Run a broader test sample: `npx vitest run --project core src/engine/__tests__/combat.test.ts src/engine/__tests__/review.properties.test.ts`

## Output format

Return findings as a list:
- Severity: BLOCKER / HIGH / MEDIUM / LOW / INFO
- Category: implementation / compiler / substrate / contract / ambiguity
- Description: what's wrong and where
- CR ref: which rule is violated (if applicable)

If no BLOCKER or HIGH findings: verdict = AUDIT-OK-PENDING-FULL-CHECK.
