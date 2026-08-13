# O4P-03B judge-owned acceptance brief

Milestone: `O4P-03B`

Base SHA: `c7fe4e32a0b1e8fb4ebf33b07313b1bcd08340e9`

Contract:
`research/cr-grounding/o4p-03b-websocket-recovery.contract.draft.md`

Risk / audit lane: `R3 / BROAD`

## Implementer-owned production and ordinary evidence

Allowed production scope is `src/online/cloudflare/**` excluding every path
containing `review.`. Existing files may be changed and focused new files may be
added. `wrangler.jsonc`, dependencies, versions, and lower layers stay unchanged.

Required ordinary tests:

- `src/online/cloudflare/__tests__/hibernationV1.test.ts`
- `src/online/cloudflare/__tests__/outboxV1.test.ts`
- affected existing ordinary Cloudflare tests

They must prove:

1. `ctx.acceptWebSocket` exactly once, no standard `accept`, valid bootstrap, and secret-free attachment;
2. descriptor-safe attachment validation across a newly constructed Durable Object instance;
3. auth reject/accept/identity-switch behavior and same-revision reconnect persistence;
4. projected snapshot reload only, with no raw Core/protocol state or projection log;
5. command ACK/reject, atomic accepted persistence, duplicate replay with zero writes, and one revision notice per authenticated socket;
6. last-socket disconnect persistence and multiple-socket preservation;
7. malformed/binary/oversized/unknown frames return only closed safe errors;
8. pure outbox enqueue/idempotence/reuse rejection/order/replay/settlement/immutability;
9. no timer/alarm, standard listener, capability-bearing attachment, dependency, config, version, UI, or lower-layer change.

## Judge-owned acceptance evidence

The implementer MUST NOT edit:

- `src/online/cloudflare/__tests__/review.o4p-03b-websocket-recovery.test.ts`
- `src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts`
- `scripts/checks/verify-online-cloudflare-websocket-recovery.ts`
- `package.json`, `scripts/checks/machine-checks.mjs`, contracts, briefs, ledger, or audit records.

Judge review must non-vacuously prove the nine claims above plus:

- the same-revision SQL compare-and-set includes previous canonical JSON and rolls back on forced failure;
- attachment identity never substitutes for per-message capability validation;
- a new instance over intact storage continues the same socket and current revision without an in-memory cache;
- no O4P-03C abuse-control or O4P-03D production/migration claim lands.

The verifier freezes contract, briefs, review files, Cloudflare barrel, and
configuration; enforces source/import/config/dependency boundaries; and is
wired after O4P-03A and before lint.

## Targeted command set

```text
npm run verify:online-cloudflare-websocket-recovery
npx vitest run --project dom \
  src/online/cloudflare/__tests__/review.o4p-03b-websocket-recovery.test.ts \
  src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts
npm run check:forbidden
git diff --check
```

The release `npm run check` remains reserved until the frozen candidate receives
an independent BLOCKER/HIGH 0 cold audit.

## Done when

- all contract clauses and review claims pass;
- O4P-03A HTTP/persistence evidence and all O4P-02/Solo boundaries remain green;
- independent cold audit returns BLOCKER/HIGH 0 at the frozen fingerprint;
- the same semantic fingerprint passes one full `npm run check`;
- intended files are explicitly staged, commit identifies the cold auditor,
  push and exact-head Actions/forbidden/build/Pages succeed, served HTML/JS/CSS
  return 200, and the worktree is clean;
- O4P-03B is shipped and O4P-03C remains pending and unstarted.
