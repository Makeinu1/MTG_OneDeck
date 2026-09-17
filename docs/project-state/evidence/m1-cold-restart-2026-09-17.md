# M1 Cold Restart Evidence — 2026-09-17

Historical evidence only. This file records the M1 acceptance result at the time M1 was closed. It is **not** current Project State and must never override `docs/project-state/index.json`.

## Audited baseline

- Semantic audit baseline: `2b83b95383b330a308b9d9f7247e0de626a814f7`
- M1 implementation PR: #44
- M1 closeout PR: #45
- M1 implementation merge: `4b4935bfe8157c8bea7673153826f7db2b0f6b94`
- M1 closeout merge: `cda6d4d785fd393a6c3df9b18a8f8199ac2d1ab5`

## M1 acceptance result

At the M1 acceptance point, a repo-only cold restart recovered:

1. Product goal from `docs/product-requirements.md`.
2. Upper interaction authority from `docs/contracts/ux-constitution.md`.
3. Active contract registry from `docs/contracts/manifest.json`.
4. Audited production baseline from `docs/project-state/index.json`.
5. Capability MATCH/GAP/CONFLICT from Project State rather than Issues/PRs/CI.
6. CR-04 as `CONFLICT`.
7. CR-12 as `CONFLICT`.
8. CR-05, CR-06, CR-07, CR-08 and CR-11 as `GAP`.
9. M0 complete and M1 active at the pre-closeout acceptance point.
10. `M1-COLD-RESTART` as the pre-closeout next gate.
11. OD-001 resolved as B and OD-002 resolved as 2A.
12. The CR backbone ledger as roadmap/provenance/history rather than NOW authority.
13. Green CI/deployments as evidence only, not semantic MATCH.
14. The M1 prohibited scope.
15. Staleness when watched semantic roots change after the audit baseline.

Project State Integrity, R4b verification and R5a-1 verification were green at the accepted M1 PR head before merge.

## Historical boundary

The milestone/gate values above describe the **M1 acceptance moment**. They are intentionally historical. For the current milestone, next gate, decisions and capability verdicts, read `docs/generated/project-state.md` and its canonical inputs under `docs/project-state/`.
