# Cold Audit Brief — Wave 0-2 Backbone Status Claims

**Role**: You are a cold auditor. You have NO implementation context. You did not write, review, or approve any of the code or ledger entries below. Your job is to find problems, not confirm correctness.

**Task**: 13 backbone domains in `research/cr-grounding/cr-backbone-ledger.json` have been claimed as "shipped-equivalent" (currently reverted to pre-claim status pending your audit). For each domain, verify whether the status claim is justified.

**Domains under audit** (id → claimed status):

| # | domain id | claimed | evidence tests to run |
|---|---|---|---|
| 1 | cr-122-counters | shipped | `src/engine/__tests__/review.cr122-counter-plus-sign.test.ts` `src/engine/__tests__/review.cr122-self-referential-counter.test.ts` `src/store/__tests__/review.cr122-counter-put-trigger-sign.test.ts` |
| 2 | cr-601-casting-stack | shipped | `src/engine/__tests__/m431.test.ts` `src/engine/__tests__/review.cr601-play-land-from-graveyard.test.ts` |
| 3 | cr-903-8-commander-tax | shipped | `src/store/__tests__/review.m431.test.ts` |
| 4 | cr-109-objects | shipped | `src/store/__tests__/crGroundingGoldenCases.test.ts` (case: cr-zone-change-new-object-lki) |
| 5 | cr-117-priority | shipped | `src/engine/__tests__/priority.test.ts` `src/store/__tests__/review.cr603-triggers-sliceA.test.ts` `src/store/__tests__/review.cr603-triggers-sliceB.test.ts` |
| 6 | cr-903-9-commander-zone-choice | shipped | `src/store/__tests__/crGrounding.test.ts` `src/store/__tests__/ruleChoices.test.ts` `src/store/__tests__/review.m430.test.ts` |
| 7 | cr-106-mana | shipped | `src/engine/__tests__/manaTransaction.test.ts` `src/store/__tests__/review.mana-transaction.test.ts` `src/store/__tests__/review.mana-write.test.ts` `src/store/__tests__/review.activated-envelope.test.ts` |
| 8 | cr-113-abilities | shipped | `src/store/__tests__/activatedAbilityEnvelope.test.ts` `src/store/__tests__/review.activated-envelope.test.ts` `src/store/__tests__/review.m427.test.ts` `src/store/__tests__/review.m428.test.ts` |
| 9 | cr-104-loss-advisory | shipped | `src/store/__tests__/review.sba-defeat.test.ts` `src/store/__tests__/review.903-10a.test.ts` |
| 10 | cr-108-cards | shipped | `src/store/__tests__/crGroundingGoldenCases.test.ts` (case: cr-zone-change-new-object-lki) |
| 11 | cr-112-spells | shipped | `src/engine/__tests__/review.cr608-resolution-sliceA.test.ts` `src/engine/__tests__/review.stack-control-cast-targets.test.ts` |
| 12 | cr-121-drawing | shipped | `src/engine/__tests__/cr121DrawCrossPlayerGuard.test.ts` `src/store/__tests__/cr121DrawAuto.test.ts` `src/engine/__tests__/cr121DrawCompiler.test.ts` `src/store/__tests__/review.cr121-loot-variable-count.test.ts` |
| 13 | cr-506-510-combat | shipped | `src/store/__tests__/review.combat.test.ts` `src/store/__tests__/review.cr702-lifelink-trample.test.ts` |

## Audit procedure (per domain)

1. **Run the evidence tests** listed above. Record pass/fail.
2. **Read the ledger entry** for the domain in `research/cr-grounding/cr-backbone-ledger.json`. Check:
   - Does `boundary` honestly describe what is NOT implemented?
   - Does `nextGate` point to real remaining work (not a vacuous "done")?
   - Does `evidence` list the tests you just ran?
   - Does `note` (if present) make claims that contradict the code?
3. **Spot-check the implementation** against the boundary claim. For each domain, pick ONE boundary claim (e.g. "multiple blockers allocation is deferred") and verify in the source code that it is indeed NOT implemented (or IS implemented, which would make the boundary dishonest).
4. **Adversarial check**: Is there any test in the evidence list that PINS A BUG as expected behavior? (Precedent: review.m418 pinned Mana Confluence paying life without actually paying it.)

## Output format (findings only — do NOT edit any file)

For each domain, output:

```
### <domain-id>
- Tests: PASS/FAIL (N tests)
- Boundary honest: YES/NO (explain if NO)
- NextGate valid: YES/NO
- Evidence complete: YES/NO
- Spot-check: <what you checked> → <result>
- Adversarial: <any bug-pinning found?>
- Verdict: SHIPPED-OK / BLOCKER / HIGH / MEDIUM / LOW
- Finding: <one-line summary>
```

At the end, output a summary table:

```
| domain | verdict | finding |
```

## Constraints

- Do NOT edit any file. Findings only.
- Do NOT run `npm run check` (already verified green by the judge).
- Do NOT read this brief's parent conversation or git history for context.
- You MAY read any source file, test file, or the ledger.
- You MAY run vitest on specific test files.
- If a test file does not exist, report it as BLOCKER.
- CR reference: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` (2026-06-19).
