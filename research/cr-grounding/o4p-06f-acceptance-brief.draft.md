# O4P-06F acceptance brief

Base SHA: `8810ed2e6db69fdc93c131f6abc195af6a763066`

Contract:
`research/cr-grounding/o4p-06f-four-browser-production-release.contract.draft.md`

## Required acceptance

1. The candidate is evidence-only: product, protocol, Worker, UI, Wrangler,
   dependency, lockfile, workflow, version, manifest, and generated semantics
   are byte-identical to base.
2. The harness uses Node built-ins plus system Chrome CDP, creates exactly four
   distinct browser contexts, and performs participant HTTP/WebSocket traffic
   inside those contexts from the exact Pages origin.
3. All four contexts load the exact public app, expose the public Online entry
   and lobby controls, and produce zero console error/warning.
4. The exact bytes of Celes, Gogo, Kefka, and Muldrotha are submitted in fixed
   seat order; summary hashes/byte counts match the repository files.
5. Lobby create/claim/deck/ready/start-with-table reaches an active revision-0
   Room with four Player sockets and one Table socket.
6. P1-P4 each accept one non-duplicate `table-draw` at revisions 1-4 with the
   expected own hand/library count change and no cross-seat hidden identity.
7. P2 disconnect/reconnect uses a fresh socket, stale-known-revision resync,
   and exactly one current snapshot without silent action loss or frame storm.
8. P4 accepts one concession at revision 5; HTTP status is revision/count 5
   and remaining audiences observe the exited/conceded outcome.
9. Before/after an identical-code distinct-version Worker deploy, canonical
   per-audience projection hashes are equal. Tail evidence proves recovery
   checkpoint 0/current 5/replay 5/outcome ok and zero error/exception/parse or
   secret violation.
10. No capability or eight-character fragment enters output, files, URLs,
    storage, logs, projections, screenshots, traces, HARs, or errors. Evidence
    consists only of the closed secret-free summary/record.
11. Cleanup closes all sockets/targets/contexts/Chrome and removes the exact
    temporary profile. Failure is bounded and fail-closed at every stage.
12. Judge reviews, ordinary hostile/injected tests, predecessor Online gates,
    docs/generator, TypeScript, ESLint, and diff checks pass.
13. A context-free cold audit returns BLOCKER/HIGH zero before the sole local
    full check. Exact-head CI/Pages, Wrangler dry-run/deploy, served assets,
    production scenario, evidence cold audit, terminal ledger audit, and clean
    worktree closure all pass before `shipped`.
14. Both ledgers promote only O4P-06F exactly once and close active O4P-06 only
    after all evidence. No future deferred feature is claimed.
