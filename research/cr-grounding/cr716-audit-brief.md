# Cold Audit Brief: CR716 Class Cards (§34.51)

## Candidate fingerprint

- Tree fingerprint: `2aebf826b241b53119d471100ee1f53d3b4c962f8c7a54b94fc5d38f1d5243c7`
- Base SHA: `5763a7e1c8af919facbe2b0120d0bcb0a351fa52`

## Files under audit

Modified:
- `src/engine/commands.ts` (setClassLevel command)
- `src/engine/status.ts` (classLevelOf accessor, effectiveKeywords Class-bar extension)
- `src/engine/types.ts` (CardInstance.classLevel field)

New:
- `src/engine/classGrammar.ts` (parser, keyword extraction, activation legality)
- `src/engine/__tests__/classGrammar.test.ts` (implementer tests)
- `src/engine/__tests__/review.cr716-class-cards.test.ts` (judge-owned review test)

## Contract

Read: `research/cr-grounding/cr716-class-cards.draft.md`

## CR authority

Read: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` lines 6014–6030 (CR 716.1–716.4)

## Audit checklist

1. **CR fidelity**: Does the implementation match CR 716.2–716.4 exactly? Check:
   - Level is a designation, not a counter (716.2b)
   - Default level 1 for permanents without a level (716.2d)
   - Activation gate: level N-1 only (716.2a)
   - Static gate: level >= N (716.2a)
   - Level counters ≠ class levels (716.4)
   - Top-section abilities treated normally (716.3)
   - Not copiable (716.2b) — verify ObjectSnapshot does not include classLevel

2. **Contract compliance**: Does the implementation match §34.51 contract sections 2–6?

3. **Boundary integrity**: Does the implementation stay within the scope boundary (§7)?
   - No non-keyword ability granting
   - No UI changes
   - No SNAPSHOT_VERSION/CACHE_SCHEMA_VERSION changes

4. **Regression**: Run `npx vitest run --project core` and verify all green.
   (If `--project core` is unavailable, run `npx vitest run src/engine/__tests__/` instead.)

5. **Review test integrity**: Verify `review.cr716-class-cards.test.ts` was NOT modified by the implementer (check git status — it should be untracked/new, not modified).

6. **Adversarial probes**:
   - What happens if `setClassLevel` is called with level 0 or negative?
   - What happens if `parseClassLevelBars` encounters "Level 0" or "Level -1"?
   - Does `classLevelBarKeywords` correctly handle "This Class gains flying and haste."?
   - Does the keyword regex produce false positives on ability text like "Creatures you control get +1/+0."?
   - Is the `STATUS_KEYWORD_IDS` set in classGrammar.ts consistent with the actual keywords recognized by `effectiveKeywords`?

7. **Code quality**: TypeScript strict compliance, no `any`, pure engine functions, Japanese UI text in logs.

## Verdict format

Return findings as:
```
FINDING-<N> [BLOCKER|HIGH|MEDIUM|LOW]: <description>
  File: <path>
  Evidence: <what you observed>
  CR/contract ref: <if applicable>
```

If BLOCKER/HIGH = 0, verdict is `AUDIT-OK-PENDING-FULL-CHECK`.
Otherwise, verdict is `BLOCKED` with the finding list.
