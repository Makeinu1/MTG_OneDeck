# O4P-06D Full-check Repair 1 Cold Audit Brief

- Milestone: `O4P-06D`
- Base SHA: `f050bd5b0db21b70a4fd6edbd89719b57bbf9e56`
- Profile: bounded architecture repair, context-free, findings only

Read fully `AGENTS.md`, the development skill/governance, `docs/judge-protocol.md`, the O4P-06D contract/acceptance/cold-audit record, and this brief. Audit the exact staged candidate without edits, git mutations, network, publication, or full `npm run check`.

The first post-audit full check passed every verifier, docs, lint, and Core 227/2093 tests, then failed only `src/test/architecture/modeNeutralCoreBoundary.test.ts` because browser production imported the Core public barrel in `client.ts` and `types.ts`. The repair removes both Core imports and routes the command type/normalization through the already-authorized public Protocol barrel (`OnlineCommandEnvelopeV1['command']` and `validateOnlineCommandEnvelopeV1`). No architecture allowlist was widened.

Verify independently:

1. No production file under `src/online/browser/**` imports Core directly or indirectly through a private path.
2. The Protocol envelope validator remains the only command normalization gate; malformed/capability-bearing commands still fail closed and valid commands retain byte-identical outbox replay.
3. The exact full-check failure now passes, and no assertion/threshold/timeout/skip or historic frozen boundary was weakened.
4. O4P-06D browser/Judge/architecture tests, typecheck, affected lint, generator and diff checks pass.
5. The prior final cold-audit findings remain closed: invalid-config public snapshots are credential-free, ready/hello/snapshot revisions are monotonic, stale epochs are inert, and settled command IDs retain lifetime reuse semantics.
6. Candidate scope outside the two repaired production files differs from the recorded final cold-audit tree only by Judge-owned repair metadata; no dependency/config/protocol/version/Worker/UI/ledger/generated change exists.

Report BLOCKER/HIGH/MEDIUM/LOW. Only return `AUDIT-OK-PENDING-FINAL-FULL-CHECK` when all counts are zero.
