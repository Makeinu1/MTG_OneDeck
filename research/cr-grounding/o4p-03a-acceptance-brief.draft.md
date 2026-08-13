# O4P-03A judge-owned acceptance brief

Milestone: `O4P-03A`

Base SHA: `95b34868966de671c97f0aa824422ccb0c14e051`

Contract:
`research/cr-grounding/o4p-03a-cloudflare-runtime-persistence.contract.draft.md`

Risk / audit lane: `R3 / BROAD`

## Required production surface

- `wrangler.jsonc`
- `src/online/cloudflare/index.ts`
- `src/online/cloudflare/types.ts`
- `src/online/cloudflare/support.ts`
- `src/online/cloudflare/codec.ts`
- `src/online/cloudflare/persistence.ts`
- `src/online/cloudflare/runtime.ts`
- `src/online/cloudflare/worker.ts`

The implementer may split the named support files further under the same
directory when each file has one clear responsibility. No existing production
file may be edited except `package.json` only if the Judge later re-owns a new
verification script; dependency fields must remain byte-identical.

## Required ordinary implementation evidence

- codec tests: deterministic canonical round trip, corrupt/oversized JSON,
  fresh deep freeze, no mutation, no capability in accepted-command JSON;
- repository tests: exact schema setup, first/idempotent/conflicting init,
  relation-complete journal-to-accepted-receipt load, loaded capability-
  fragment rejection, accepted atomic journal+state write, rollback probe, and
  zero writes for duplicate/rejected commands;
- Worker tests: exact route/method/content-type/body/Room-ID matrix, exactly one
  `getByName(roomId)` and stub fetch for valid requests, zero lookup for rejects;
- Durable Object tests: initialize/status/command composition, public-safe
  generic failures, and standard WebSocket bootstrap entry;
- configuration test: main/binding/class/declarative SQLite export/date and
  absence of migrations/account/route/secret values.

Ordinary test paths:

- `src/online/cloudflare/__tests__/codecV1.test.ts`
- `src/online/cloudflare/__tests__/persistenceV1.test.ts`
- `src/online/cloudflare/__tests__/runtimeV1.test.ts`
- `src/online/cloudflare/__tests__/configurationV1.test.ts`

## Judge-owned acceptance evidence

The implementer MUST NOT edit these paths:

- `src/online/cloudflare/__tests__/review.o4p-03a-cloudflare-runtime-persistence.test.ts`
- `src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts`
- `scripts/checks/verify-online-cloudflare-runtime-persistence.ts`

Required review claims:

1. canonical protocol state survives byte-identical serialize/deserialize and
   validator corruption fails closed;
2. accepted command changes state and writes journal+snapshot in one
   synchronous transaction; forced second-statement failure rolls both back;
3. duplicate/rejected command writes nothing and preserves revision;
4. journal SQL parameters contain no seat/observer capability or eight-code-
   unit capability fragment;
5. initialize is idempotent only for the same canonical state and cannot reset
   an existing Room;
6. status and all error paths expose no capability/Core root/command/SQL/stack;
7. routing consumes the platform-normalized Fetch pathname; invalid Room IDs
   return 400, while a valid Room ID plus unknown action or extra segment
   returns 404, all before Durable Object lookup;
8. WebSocket uses standard `accept()` and bootstrap only; no hibernation or
   message semantics appear;
9. config declares exactly one SQLite Durable Object export/binding without
   account, route, secret, legacy migration, or package dependency change;
10. source and architecture boundaries preserve every O4P-02 and Solo layer.

The Judge-owned verifier hashes the frozen contract, acceptance brief,
implementation brief, cold-audit brief, review tests, public barrel, and
`wrangler.jsonc`; checks the expected production/test files; scans dependency
boundaries; and is wired immediately after the O4P-02E verifier in
`machine-checks.mjs`.

## Targeted command set

The implementer runs only ordinary O4P-03A tests plus affected lint/type/build
checks. The Judge then runs:

```text
npm run verify:online-cloudflare-runtime-persistence
npx vitest run --project dom \
  src/online/cloudflare/__tests__/review.o4p-03a-cloudflare-runtime-persistence.test.ts \
  src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts
npm run check:forbidden
git diff --check
```

The release `npm run check` is reserved until a frozen candidate receives an
independent BLOCKER/HIGH 0 cold audit.

## Done when

- contract clauses and all review claims pass non-vacuously;
- no dependency/version/O4P-02/Solo/UI semantics change;
- independent cold audit returns BLOCKER/HIGH 0 at the frozen fingerprint;
- the same semantic fingerprint passes one full `npm run check`;
- intended files are explicitly staged, the commit names the cold auditor,
  push succeeds, exact-head Actions/forbidden/build/Pages succeed, served
  Pages HTML/JS/CSS return 200, and the worktree is clean;
- O4P-03A is marked `shipped`; O4P-03B is recorded next but not started.

## DEFER

All O4P-03B/C/D and UI/non-goal boundaries in the contract remain visibly
deferred. No Cloudflare account credential or production deployment is needed
for O4P-03A.
