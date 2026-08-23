# O4P-08 Roadmap Registration Acceptance

Date: 2026-08-23
Authority: user-ruling-2026-08-23
Base SHA: `2973e60942623d57e6af53a5e36cb488a26f56b7`

1. `goalPolicy.activeProgram` is exactly `O4P-08` with ordered IDs A, B, C, D.
2. A through D exist exactly once in `domains` and `plannedSequence`, share all
   semantic fields, start `pending`, and use `crOrder` 1028 through 1031.
3. A depends on shipped O4P-07C; B depends on A; C depends on B; D depends on C.
4. All pre-existing ledger entries, statuses, evidence, CR pin, and policy other
   than the exact active program remain unchanged.
5. The roadmap freezes deck-first flow, shared invitation exchange, durable
   recovery, pre-start kick, structured errors, exact two/four roster, and
   two-player 20/40 semantics without claiming implementation.
6. O4P-08D is the product completion boundary.
7. Registration changes only Judge-owned roadmap, ledger, review, and exact
   historical active-program guards. Runtime, dependencies, configuration,
   Worker, Pages, and product behavior remain byte-identical to the base.
8. `npm run codex:context -- --domain O4P-08A` reports healthy selection and
   the exact active-program order.
9. A fresh-context Sol/high BROAD audit reports BLOCKER/HIGH zero before the
   registration commit and product implementation starts from a clean commit.
