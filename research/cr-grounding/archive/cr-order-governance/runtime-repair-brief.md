# Runtime repair brief — cold-audit findings

Implement only the two runtime findings below. Do not edit `docs/`, `research/`, `AGENTS.md`,
`.claude/`, git state, the ledger, or any file whose name contains `review.`.

## Finding A — real combat prevention

- CR grounding: CR 615.1, 615.1a, 615.6.
- Existing contract: `docs/engine-spec.md` §34.34.
- Problem: `combatDamagePreventedUntilEndOfTurn` gates synthetic `dealDamage`, but
  `resolveCombatDamage` still applies attacker/player and creature/creature damage.
- Required: the global shield prevents all damage assignments produced by the real
  `resolveCombatDamage` path. No life delta, marked damage, lifelink gain, commander-damage
  total, or damage event may be produced from prevented combat damage. Combat resolution
  must remain deterministic and must still complete/clear its normal combat state.
- Preserve the existing noncombat and turn-expiry behavior.

## Finding B — Lifelink CR reference

- Pinned CR version: 2026-06-19.
- Required: the runtime classifier tag for `keyword.lifelink` uses `702.15`.
- Do not broaden keyword recognition.

## Verification

- Add or update ordinary (non-`review.*`) tests for the repaired behavior.
- Run the two reviewer-owned tests without modifying them:
  - `src/engine/__tests__/review.cr614-615-prevent-combat-damage.test.ts`
  - `src/data/__tests__/review.cr702-keyword-rule-refs.test.ts`
- Run the directly affected ordinary tests.
- Report changed files, exact test results, deferred issues, and uncertainty.
