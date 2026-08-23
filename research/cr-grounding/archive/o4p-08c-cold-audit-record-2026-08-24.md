# O4P-08C Cold Audit Record — 2026-08-24

Milestone: `O4P-08C`
Risk: `R3 / BROAD protocol + Core genesis`
Final auditor: `/root/o4p08c_final_cold_audit` (`gpt-5.6-sol`, high, fresh context)
Final audited semantic fingerprint: `c21aa8ddee8855c99c035fa2937834efdeb3054e2e4727b629057f3d993a3e0a`
Verdict: `AUDIT-OK-PENDING-FULL-CHECK`
Counts: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`

## Findings and closure

The initial audit found one unauthorized moderation path and shallow genesis
validation. Judge surgery added host authorization, exact nested snapshot and
entry validation, Core/Room roster validation, and observer projection
authorization.

A fresh full-scope auditor then found variable rooms could start but not use
the gameplay transport, plus non-atomic deck/lobby persistence, mutable room
configuration, shared-claim kind/version mismatch, and unchecked redundant
database columns. The corrected candidate added variable HTTP command and
hibernating WebSocket setup/hello/projection/command routing, generalized the
existing security grant store without changing legacy bytes, committed resolved
deck plus latest lobby state atomically, froze configuration, checked exact
kind/schema correspondence, and validated relational metadata.

The next audit found that accepted variable commands were not replay-verified
on restart. The final correction stores an exact revision-zero checkpoint,
validates journal/receipt counts and continuity, parses and validates every
accepted command, deterministically replays from the checkpoint, and requires
the replayed final state to equal persisted JSON exactly. Extra, missing,
reordered, malformed, and state-divergent journals all fail closed. The legacy
constructor query-count contract was also restored.

The canonical check then exposed stale exact-hash guards and two legacy tests
whose deliberate partial repository stub lacked the new variable-lobby reader.
The guard chain was repinned to exact bytes without wildcard authorization, the
test stub was completed with a null variable-lobby result, and all historical
03A/03B/05C/05D frozen verifiers passed. Broad Cloudflare regression evidence
passed `23 files / 154 tests`; variable acceptance passed `6 files / 32 tests`;
lint, TypeScript/Vite build, and `git diff --check` passed. The final auditor
independently reproduced the guard and regression closure and returned
`0/0/0/0`.

The next complete test phase exposed four historical architecture gates that
had not yet registered the exact variable Room, Protocol, Genesis, and
Projection Core consumers. The repair added only literal file/specifier/symbol
mappings, moved variable projection to the shipped protocol barrel, and pinned
exactly two reducer imports and calls to the legacy and variable command
handlers. The affected architecture slice passed `6 files / 33 tests`, module
regression passed `11 files / 88 tests`, build passed, and the final auditor
again returned `0/0/0/0`.

The final same-semantic-fingerprint `npm run check` passed: Core `227 files /
2093 tests`, DOM `352 files / 2374 tests`, lint, TypeScript/Vite build, all
historical frozen gates, and the O4P-07C production-runtime verifier were green.
Total canonical check time was `390693 ms`.

## Ownership boundary

The pre-release classifier identified exactly seven Judge-owned review paths:

- `src/online/cloudflare/__tests__/review.o4p-08c-variable-runtime.test.ts`
- `src/online/genesis/__tests__/review.o4p-08c-variable-roster-genesis.test.ts`
- `src/test/architecture/review.o4p-02b-four-seat-room-boundary.test.ts`
- `src/test/architecture/review.o4p-02c-in-memory-protocol-boundary.test.ts`
- `src/test/architecture/review.o4p-05d-production-release-closure.test.ts`
- `src/test/architecture/review.o4p-08-roadmap-registration.test.ts`
- `src/test/architecture/review.o4p-08c-variable-roster-boundary.test.ts`

These paths were authored and are explicitly re-owned by the Judge. A semantic
candidate commit, exact-head CI ownership stop, exact-byte reauthorization, and
replacement exact-head CI/Pages flow remain required. This record is not
shipment evidence.

`O4P-08C-COLD-AUDIT-OK-PENDING-FULL-CHECK`

## Exact-head CI and Judge reauthorization

Semantic candidate `d1f6af7a8411df7b1f47ad0aa3a3e417f4df9fde` was
published to `main`. GitHub Actions run `32674249131` checked that exact HEAD;
its canonical `npm run check -- --build-base=/MTG_OneDeck/` step passed. The
run then stopped only at `check:forbidden`, before artifact upload or Pages
deployment, with the five O4P-08C research/archive paths as informational
`NEEDS-REAUTH` and exactly the following seven Judge review blobs as
`FORBIDDEN`:

| Path | SHA-256 at `d1f6af7` |
|---|---|
| `src/online/cloudflare/__tests__/review.o4p-08c-variable-runtime.test.ts` | `b23daccd5022143abd6291a53e6383d37067fed064684512be1fcb99345a84ac` |
| `src/online/genesis/__tests__/review.o4p-08c-variable-roster-genesis.test.ts` | `03350d53a681fbef7354579b5ff2ca0829f3b460990824c0d2c37d54762279bc` |
| `src/test/architecture/review.o4p-02b-four-seat-room-boundary.test.ts` | `29b1feaf3f52f625d452d6ef6990c2fdfd98da5541f47fae6cf9411ad1821e84` |
| `src/test/architecture/review.o4p-02c-in-memory-protocol-boundary.test.ts` | `61231d93e7a3d130401d9a15fb5ca7c61460de8ebf0873c28c911e5d2638f695` |
| `src/test/architecture/review.o4p-05d-production-release-closure.test.ts` | `ed9ec552223c8fd98f1c07b80d8a07e2a82cd05eb45fd299ca8a886490902ae1` |
| `src/test/architecture/review.o4p-08-roadmap-registration.test.ts` | `365a500a7201341851d3b940918ccc1e737c1cb84bbec9d90b425cd9fed144b3` |
| `src/test/architecture/review.o4p-08c-variable-roster-boundary.test.ts` | `fbd3531a297718c39347f83b796bcb5c4be7f2c8d4e6e03b948c8f210b45db76` |

The final cold auditor independently recomputed every hash from
`git show d1f6af7:<path>`, confirmed the exact-head successful full-check step
and seven-path ownership-only stop, and returned `BLOCKER 0 / HIGH 0` plus
`REAUTH-OK`. The Judge explicitly re-owns only these exact seven blobs. This
authorizes a metadata-only reauthorization commit; it does not change semantic
candidate bytes.

`O4P-08C-EXACT-BYTE-JUDGE-REAUTHORIZATION-APPROVED`
