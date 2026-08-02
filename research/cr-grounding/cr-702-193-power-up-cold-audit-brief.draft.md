# Cold Audit Brief: cr-702-193-power-up

## Role
You are a COLD AUDITOR. You have NO implementation context. Your job is to
adversarially verify the frozen change against the contract, CR, and machine
checks. Return findings only. Do NOT edit any files.

## Contract
Read `research/cr-grounding/cr-702-193-power-up.draft.md` for the milestone
contract (goal, CR refs, constraints, acceptance cases A1–A10).

## CR authority
Pinned CR: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` (2026-06-19).
Relevant rules: 702.193a, 702.193b, 118.7, 118.7a–g, 602.

## Frozen change (candidate fingerprint: be213df7)
Run `git diff` to see the full change. Changed files:
- `src/engine/grammar/activatedKeyword.ts` — power-up pattern recognition
- `src/engine/types.ts` — `powerUpActivated` on GameState
- `src/engine/init.ts` — initialize field
- `src/engine/commands.ts` — cost reduction in activationPlanForSource
- `src/engine/mana.ts` — `reduceManaCost` utility
- `src/store/gameStore.ts` — once-only enforcement + backfill + takeSnapshot

## Review test (judge-owned)
`src/engine/__tests__/review.cr702-193-power-up.test.ts` — 12 tests, all passing.

## Audit checklist

### 1. Grammar correctness
- Does the power-up regex correctly match `Power-up — {COST}: EFFECT`?
- Does it reject non-power-up lines that mention "power-up" in prose?
- Is the expanded text format correct (`{cost}: {effect} Activate this ability only once.`)?
- Does `removeReminderAndQuotes` strip the parenthetical before canonicalization?

### 2. Cost reduction (CR 118.7)
- Does `reduceManaCost` correctly implement 118.7a (generic reduces generic)?
- Does it implement 118.7c (colored excess reduces generic)?
- Does it implement 118.7d (colorless excess reduces generic)?
- Edge cases: reduction exceeds cost → {0}; hybrid/phyrexian/snow handling.
- Is the reduction conditional on `enteredTurn === state.turn`?
- Is the permanent's mana cost read from the correct face?

### 3. Activate only once
- Is the restriction keyed by objectId (card.id:zoneChangeCounter)?
- Does re-entry (new zoneChangeCounter) correctly reset the restriction?
- Is the marking applied in ALL activation paths (direct-to-stack AND pending)?
- Can `force` bypass the restriction? (It should — sandbox philosophy.)

### 4. State integrity
- Is `powerUpActivated` initialized in `initGame`?
- Is it backfilled in `restoreGame`/`normalizeSnapshotState`?
- Does the backfill handle missing field gracefully?

### 5. No regressions
- Run: `npx vitest run src/engine/__tests__/review.cr702-193-power-up.test.ts src/store/__tests__/review.activated-envelope.test.ts src/engine/__tests__/review.act3-activated-keyword.test.ts --reporter=verbose`
- All must pass.

### 6. No fake-green
- Power-up abilities with complex effects must NOT be upgraded to 'auto'.
- The keyword recognition must not change compile decisions.

### 7. TypeScript strict
- No `any` types in the diff.
- All new code compiles under strict mode.

## Finding format
For each finding:
- Severity: BLOCKER / HIGH / MEDIUM / LOW
- Category: implementation / compiler / substrate / contract / ambiguity
- Description: what's wrong and why
- Evidence: file, line, test output

## Verdict
If BLOCKER + HIGH = 0: return `AUDIT-OK-PENDING-FULL-CHECK`.
Otherwise: return `BLOCKED` with the finding list.
