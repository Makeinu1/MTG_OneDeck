# Cold Audit Findings: cr-303-704-roles

Auditor: /root/cr303_cold_auditor
Date: 2026-08-02
Verdict: AUDIT-OK-PENDING-FULL-CHECK

## Summary

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |

## Findings

### MEDIUM-1 — Timestamp tiebreaker keeps the wrong Role for same-turn duplicates

File: `src/engine/commands.ts`, `collectDuplicateRoleIds` (~lines 2167–2176)

When two Role tokens are created in the same turn and attached to the same creature, both have identical `(enteredTurn, zoneChangeCounter)` tuples. The strict `>` comparisons never trigger, so `newest` stays as `group[0]` — the first card in `Object.values()` iteration order, which is the older token. CR 704.5y requires keeping the one with the "most recent timestamp" (CR 613.7d/e).

Current impact: **none** — Role static abilities are explicitly out of scope, so which Role survives has no gameplay effect. When continuous effects are implemented, this will need a proper timestamp or monotonic creation-order counter.

Judge ruling: Accepted as known boundary. Record in ledger note as prerequisite for continuous-effects milestone.

### LOW-1 — Role detection uses `typeLine.includes('Role')` substring match

No such false-positive cards exist in MTG. Acceptable.

### LOW-2 — `isToken` guard excludes hypothetical non-token Role permanents

All current Roles are tokens (111.10j–r). Correct for current scope.

### LOW-3 — golden-cases.json includes cosmetic formatting changes

No semantic change. Diff noise only.
