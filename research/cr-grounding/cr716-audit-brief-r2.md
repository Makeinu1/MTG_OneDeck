# Cold Re-Audit Brief (Round 2): CR716 Class Cards

## Context

Round-1 cold audit returned BLOCKED with 2 HIGH findings plus a MEDIUM and several LOWs.
The implementer applied correction round 1 and the judge updated the contract. This is a
focused re-audit of the frozen candidate.

## Candidate fingerprint

- Tree fingerprint: `c09227e4ac69e00e4eada26a335dc75af50e7f0e584242dddfa5b95c9f8e6fcf`
- Base SHA: `5763a7e1c8af919facbe2b0120d0bcb0a351fa52`

## Round-1 findings to verify are RESOLVED

- FINDING-1 [HIGH]: Rogue Class level-2 bar (triggered ability text) wrongly granted haste.
  Expected fix: strict sentence-level self-grant extraction in classGrammar.ts — only
  sentences matching /^this class (gains|has) <word list>$/i grant keywords, parsed
  all-or-nothing. Verify Rogue Class at level 2 grants NO keywords.
- FINDING-2 [HIGH]: classLevel survived zone changes.
  Expected fix: resetCardForZoneChange now sets classLevel: undefined (CR 400.7/716.2d).
  Verify battlefield(level 3) -> hand -> battlefield re-enters at level 1.
- FINDING-3 [MEDIUM]: setClassLevel accepted 0/negative/non-integer.
  Expected fix: throws EngineError for level < 1 or non-integer.
- FINDING-7 [LOW]: redundant double level-filtering in status.ts effectiveKeywords.
  Expected fix: single call to classLevelBarKeywords(bars, level).
- FINDING-4 [LOW]: duplicated STATUS_KEYWORD_IDS drift hazard.
  Expected fix: parity-guard test iterating every STATUS_KEYWORDS id.

## Additional judge changes since round 1

- research/cr-grounding/cr716-class-cards.draft.md: contract §2.1/§2.2 updated
  (zone-change resets classLevel; setClassLevel validates level >= 1 integer).
- src/engine/__tests__/review.properties.test.ts: judge-owned — added setClassLevel to the
  random-walk command generator and I51/I53 invariant checks (classLevel either undefined
  or integer >= 1; independent of counters). Confirm these are assertions only and do not
  weaken existing invariants.

## Files under audit

Modified:
- src/engine/classGrammar.ts (strict self-grant extraction)
- src/engine/commands.ts (resetCardForZoneChange classLevel reset; setClassLevel validation)
- src/engine/status.ts (single classLevelBarKeywords call)
- src/engine/types.ts (CardInstance.classLevel)
- src/engine/__tests__/classGrammar.test.ts (parity guard + regression tests)
- src/engine/__tests__/review.properties.test.ts (judge-owned I51/I53)

New:
- src/engine/__tests__/review.cr716-class-cards.test.ts (judge-owned, must be UNMODIFIED)

## Audit checklist

1. Confirm each round-1 finding above is genuinely resolved (run empirical probes).
2. Confirm NO new regressions: npx vitest run --project core all green.
3. Confirm review.cr716-class-cards.test.ts still passes and was not modified by the
   implementer (it is judge-owned).
4. Adversarial probes: Rogue Class full oracle at levels 1/2/3; a Class whose bar text
   mentions a keyword only in a triggered/temporary clause; zone-change reset; same-zone
   reorder must NOT reset; setClassLevel 0/-2/1.5 throws.
5. Verify the I51/I53 additions in review.properties.test.ts do not weaken existing checks.
6. Code quality: no `any`, pure engine, no circular imports, Japanese log text.

## Verdict format

Return findings as:
FINDING-N [BLOCKER|HIGH|MEDIUM|LOW]: description (File, Evidence, CR/contract ref)

If BLOCKER/HIGH = 0, verdict is AUDIT-OK-PENDING-FULL-CHECK.

Do NOT edit any files. Do NOT run npm run check (full check is judge-owned).
