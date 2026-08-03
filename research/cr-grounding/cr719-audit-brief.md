# Cold Audit Brief: CR719 Case Cards (§34.52)

## Candidate fingerprint

- Tree fingerprint (code files, this brief excluded): `d31d922b4e8647545dbb48abaa7e5b92363e33810e6458f0a200c6f917161b17`
- Base SHA: `5d6aeaa` (main)
- Verify by running computeTreeFingerprint over the tracked/untracked files minus this brief file.

## Files under audit

Modified:
- src/engine/commands.ts (setSolved command; resetCardForZoneChange solved reset)
- src/engine/status.ts (Solved-line exclusion from static pool; solved-gated Layer 6 grant)
- src/engine/types.ts (CardInstance.solved field)

New:
- src/engine/caseGrammar.ts (parseCaseSections, isSolvedGatedLine, stripSolvedGatePrefix)
- src/engine/__tests__/caseGrammar.test.ts (implementer tests)
- src/engine/__tests__/review.cr719-case-cards.test.ts (judge-owned review test)

## Contract

Read: research/cr-grounding/cr719-case-cards.draft.md

## CR authority

Read: rule/Magic_The_Gathering_Comprehensive_Rules.txt — CR 719 (Case Cards) and
702.169 (Solved). Locate via rg -n "719. Case Cards" and rg -n "702.169".

## Audit checklist

1. CR fidelity: solved designation semantics (719.3b: not counter/ability/copiable,
   persists until leaving battlefield); static gate (702.169b: as long as solved);
   zone-change reset (CR 400.7); same-zone reorder must preserve solved.
2. Grammar: To solve / Solved line parsing, dash variants, empty input.
3. Layer 6 correctness: unsolved Case grants nothing; solved grants only STATUS
   keywords via all-or-nothing sentence parse; off-battlefield grants nothing;
   top-section (non-Solved) static lines unaffected.
4. Regression: npx vitest run --project core all green.
5. Review test integrity: review.cr719-case-cards.test.ts is judge-owned; verify
   unmodified (untracked new file).
6. Adversarial probes:
   - Solved line with a triggered/temporary keyword mention must NOT grant
     (e.g. "Solved — Whenever you cast a spell, this Case gains haste until end of turn.").
   - "Solved — Creatures you control have trample." must NOT grant to the Case.
   - Multiple Solved lines; mixed with top-section text.
   - A Case bounced and re-cast is unsolved with no gated keywords.
   - Non-Case card: setSolved works but grants nothing without Solved lines.
   - Does excluding Solved lines from the static pool break any existing card
     behavior (search for "Solved" occurrences in existing fixtures/tests)?
7. Code quality: no any, pure engine, no circular imports, Japanese log text.

## Verdict format

FINDING-N [BLOCKER|HIGH|MEDIUM|LOW]: description (File, Evidence, CR/contract ref)

If BLOCKER/HIGH = 0, verdict is AUDIT-OK-PENDING-FULL-CHECK.

Do NOT edit any files. Do NOT run npm run check (full check is judge-owned).
