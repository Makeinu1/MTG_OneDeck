# O4P-03C judge-owned acceptance brief

Milestone: `O4P-03C`

Base SHA: `a6f4c539a977e38a6891c31fb99acf4fddfee428`

Contract:
`research/cr-grounding/o4p-03c-capability-abuse-control.contract.draft.md`

Risk / audit lane: `R3 / BROAD`

## Implementer-owned production and ordinary evidence

Allowed production scope is `src/online/cloudflare/**` excluding every path
containing `review.`. Existing files may be changed and focused local modules
and ordinary tests added. Configuration, dependencies, versions, and lower
layers stay unchanged.

Ordinary evidence must prove:

1. exact initial host/seat/table/spectator grant classification and atomic rollback;
2. expiry at the exact boundary, rotation, bounded retired-token revocation,
   uniqueness, fragment rejection, exact-token collision rejection without a
   lower-ID shape allowlist, property-name fragment rejection, and secret-free
   responses;
3. runtime token-to-protocol-capability mapping without hostile-input mutation;
4. all four allowlist rows over HTTP and hibernated WebSocket paths;
5. single controller lease acquisition/renewal/conflict/expiry/release and
   `webSocketError` non-release;
6. exact socket, message, malformed, HTTP, rotation, and frame-size boundaries;
7. attachment counter/generation persistence across a new Durable Object instance;
8. bounded append-only secret-free audit facts and dropped-count saturation;
9. fail-closed missing/corrupt/extra SQL rows (including incomplete grant
   cardinality and impossible audit outcome/generation relations), time
   regression, CAS conflict, attachment failure, and forced transaction rollback;
10. O4P-03A HTTP persistence, O4P-03B reconnect/replay/projection/privacy, and
    all lower Online/Solo boundaries remain unchanged.

The implementer must not run the release full check or edit Judge files.

## Judge-owned acceptance evidence

The implementer MUST NOT edit:

- `src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts`;
- `src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts`;
- any older `review.*` path;
- `scripts/checks/verify-online-cloudflare-capability-abuse-control.ts`;
- `package.json`, `scripts/checks/machine-checks.mjs`, contracts, briefs, ledger,
  loop-state, or audit records.

Judge evidence must non-vacuously falsify the ten claims above, including
wrong/cross-role/reused/fragment-bearing tokens, exact-expiry and exact-window
edges, two same-participant sockets, HTTP-versus-socket lease conflict,
rotation of a live socket, two rotations followed by a prior-bearer collision,
a valid long lower identifier, saturation at 256 audit rows, hostile
descriptors, incomplete security-only state, impossible audit facts, and
storage recreation. It must verify every error/audit/attachment/public
response is secret-free even when a configured capability is embedded in an
alias or nested hostile input.

The verifier freezes contract, briefs, Judge review paths, Cloudflare barrel,
configuration, and required production surface; enforces dependency/version/
config/reverse-import boundaries; and is registered exactly once after the
O4P-03B verifier and before lint.

## Targeted command set

```text
npm run verify:online-cloudflare-capability-abuse-control
npx vitest run --project dom \
  src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts \
  src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts
npm run verify:online-cloudflare-websocket-recovery
npm run verify:online-cloudflare-runtime-persistence
npm run check:forbidden
git diff --check
```

The release `npm run check` remains reserved until an independent matching
cold audit returns BLOCKER/HIGH 0.

## Done when

- every contract clause and Judge review claim passes;
- independent cold audit returns BLOCKER/HIGH 0 at the frozen fingerprints;
- the same semantic fingerprint passes one full `npm run check`;
- intended files are explicitly staged, the commit identifies the auditor,
  exact-head Actions/forbidden/build/Pages and served HTML/JS/CSS are green,
  and the worktree is clean;
- O4P-03C is shipped, while O4P-03D remains pending and unimplemented in this
  milestone task.
