# O4P-07 Roadmap Registration Acceptance

Date: 2026-08-22
Authority: user-ruling-2026-08-22
Base SHA: `20064643cd2a3e25c2bf80f12a538028720664f2`

1. `goalPolicy.activeProgram` is exactly `O4P-07` with ordered IDs A, B, C.
2. A, B, C exist exactly once in `domains` and `plannedSequence`, share all
   semantic fields, start `pending`, and use `crOrder` 1025 through 1027.
3. A depends on shipped O4P-06F; B depends on A; C depends on B.
4. All pre-existing ledger entries, statuses, evidence, ordering, CR pin,
   selection rule, and policy remain unchanged.
5. The roadmap freezes arbitrary-list, server-Scryfall, Room-snapshot,
   duplicate-deck, owner-private-error, dynamic-genesis, and fixed-runtime-path
   removal semantics. It does not claim product implementation.
6. O4P-07C is the program Done boundary. A v2 endpoint alone is not completion.
7. Registration changes only Judge-owned roadmap/ledger/review material; source,
   dependencies, runtime configuration, Worker, Pages, and product behavior are
   byte-identical to the base.
8. `npm run codex:context -- --domain O4P-07A` reports healthy selection and
   active-program order; JSON parse, targeted review, docs check, TypeScript,
   ESLint for changed review files, and diff check pass.
9. A context-free Sol/high BROAD audit reports BLOCKER/HIGH zero before the
   registration commit. Product implementation begins from that clean commit.
