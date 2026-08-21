# GOV-CODEX-56-2026-08 Acceptance Brief

## Goal

Align OneDeck's Codex governance with current official OpenAI model,
subagent, AGENTS, and Skill behavior so an explicitly authorized serial program
can finish in one supervisor task without sharing milestone candidates or
worker context.

## Constraints

- Product behavior, dependencies, CR pin, release quality gates, and O4P-06
  shipped evidence do not change.
- Canonical workflow detail stays in the development Skill reference; root
  `AGENTS.md` remains concise enough for Codex's default instruction budget.
- Fresh workers receive no parent transcript and no implementation rationale.
- Explicit user model/effort requests are honored or rejected visibly.
- Only deterministic, non-semantic R0 terminal metadata can use the narrow
  audit exemption defined by the contract.

## Done when

1. The live ledger records exactly one pending `GOV-CODEX-56-2026-08` entry in
   `domains` and `plannedSequence`, dependent on shipped `O4P-06F`.
2. `AGENTS.md`, `docs/judge-protocol.md`, the development Skill, and its
   workflow reference agree on program supervision, fresh context, compaction,
   proportional audit, and serial transition gates.
3. Project Codex configuration selects `gpt-5.6-sol`/`high` for the primary and
   `gpt-5.6-luna`/`medium` for generic workers, with at most two spawned
   threads; the R3/BROAD cold-auditor role explicitly pins Sol/high/read-only
   unless an explicit supported user request overrides the role selection.
4. No canonical instruction uses the unsupported stale spelling
   `fork_context: false`; the current surface spelling is documented once.
5. A Judge-owned review test pins the decisions and proves O4P-06 remains
   complete while an explicit projection selects this governance milestone.
6. Targeted docs/review checks pass, an independent fresh-context BROAD cold
   audit returns BLOCKER/HIGH 0, and one fingerprint-matched `npm run check`
   passes before any shipment claim.
