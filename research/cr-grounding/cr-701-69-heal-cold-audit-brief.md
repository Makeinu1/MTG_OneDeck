# CR 701.69 Heal — Cold Audit Brief

**Milestone**: cr-701-69-heal
**Base SHA**: cc921c9350a44f07ffa81933627dd3eda1d0931d
**Candidate fingerprint** (git diff --cached sha256): 82ee9536e5867f8ea6ca98b3a0163eb73eec3765e7668f45e58c6a0a775beb89
**Contract**: research/cr-grounding/cr-701-69-heal.draft.md

## Your role

You are a cold auditor. You have NOT seen the implementation reasoning. Your job is to adversarially verify the frozen candidate tree against:

1. The contract (research/cr-grounding/cr-701-69-heal.draft.md)
2. CR 701.69 (rule/Magic_The_Gathering_Comprehensive_Rules.txt, lines 3869-3871)
3. The actual code changes (git diff --cached)
4. Machine checks (targeted tests only — do NOT run full `npm run check`)

## Changed files

- src/engine/grammar/index.ts — new `effect.heal` atom definition
- src/engine/grammar/compile.ts — atom registration + buildGuidedCommands case
- src/engine/grammar/__tests__/cr701Heal.test.ts — implementer unit tests
- src/engine/__tests__/cr701Heal.test.ts — implementer integration test
- src/engine/__tests__/review.cr701-69-heal.test.ts — judge-owned review test
- research/cr-grounding/cr-backbone-ledger.json — plannedSequence status sync (cr-310 shipped)
- research/cr-grounding/cr-701-69-heal.draft.md — contract
- research/cr-grounding/cr-701-69-heal-implementer-brief.md — implementer brief

## Audit checklist

For each item, mark PASS or FAIL with evidence:

1. **CR fidelity**: Does the implementation correctly model CR 701.69a? ("remove that marked damage from that permanent" = all marked damage, not partial)
2. **Probe correctness**: Does the regex `/\bheal(?:s|ed|ing)?\b/i` match all valid heal phrasings without false positives? Check: "heal", "heals", "healed", "healing". Does it false-positive on "health", "heal" inside other words?
3. **Command emission**: Does `buildGuidedCommands` emit exactly `[{ type: 'clearMarkedDamage', cardId }]` for a heal prompt? No extra commands?
4. **No false auto**: Does mass/variable heal phrasing ("Heal all damage...") correctly fall through to manual?
5. **No new abstractions**: Were any new GameCommand types or GameState fields added? (Contract forbids this.)
6. **No protected file changes**: Were any `review.*` files (other than the judge-owned one), AGENTS.md, docs/, ledger (beyond status sync), or eslint config modified by the implementer?
7. **Test coverage**: Do the tests actually verify the contract's acceptance criteria?
8. **Regression**: Run `npx vitest run src/engine/grammar/ src/engine/__tests__/commands.test.ts src/engine/__tests__/review.cr701-69-heal.test.ts` — all green?
9. **Type safety**: Run `npx tsc -b` — clean?

## Output format

Return findings as a numbered list. Each finding:
- Severity: BLOCKER / HIGH / MEDIUM / LOW
- Category: implementation / compiler / substrate / contract / ambiguity
- Description with file:line evidence
- Suggested fix (if applicable)

If all checks pass, return: `AUDIT-OK-PENDING-FULL-CHECK` with a summary of what was verified.
