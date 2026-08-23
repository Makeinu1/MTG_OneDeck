# O4P-08C Implementer Brief — 2026-08-24

Milestone `O4P-08C`; base `f39b529d8abf0a02730a51f47f3bccc4f22c216c`.

Own source and ordinary tests for Room, Lobby, Protocol, Projection, accepted
snapshots, genesis/replay, Cloudflare persistence/runtime/Worker v5. Implement
the frozen contract and acceptance brief additively. Preserve exact legacy
v1/v3/v4 bytes and current four-player 40 behavior. Do not touch git,
`review.*`, docs, ledger, AGENTS/CLAUDE, dependencies, config, UI table/workbench,
or O4P-08D. Run only targeted ordinary tests, lint and `tsc -b`; report changed
files, results, defers and unresolved points.
