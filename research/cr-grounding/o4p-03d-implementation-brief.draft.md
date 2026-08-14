# O4P-03D Luna implementation brief

Milestone: `O4P-03D`

Base SHA: `9ab8449aa7b7a4ab729f5d9acb752417c686e07b`

Model: `gpt-5.6-luna`

Reasoning effort: `xhigh` (highest supported by the Luna CLI path)

Read first:

- `AGENTS.md`
- `research/cr-grounding/o4p-03d-cloudflare-headless-production-gate.contract.draft.md`
- `research/cr-grounding/o4p-03d-acceptance-brief.draft.md`

## Task

Implement exactly the frozen O4P-03D production gate:

- exact workers.dev production configuration, observability, and version
  metadata;
- atomic application schema version 1 and pre-O4P-03C security migration;
- canonical recovery checkpoint, bounded journal replay, and revision-64
  checkpoint advancement;
- allowlisted secret-free structured facts;
- a secret-safe deterministic init/load, hibernation, and deploy-reconnect
  evidence harness; and
- ordinary tests for every implementation branch.

## Allowed writes

- `src/online/cloudflare/**` except any `review.*` file;
- ordinary O4P-03D tests under `src/online/cloudflare/__tests__/` whose names do
  not contain `review`;
- the new O4P-03D evidence harness under `scripts/online/`;
- `wrangler.jsonc`.

## Forbidden writes and actions

- no `review.*`, architecture review, registered verifier, `package.json`, lock
  file, dependency, workflow, docs, contract, acceptance, ledger, loop state,
  archive, AGENTS/CLAUDE, git, deploy, rollback, tail, Cloudflare resource,
  secret, DNS, route, GitHub, or Pages mutation;
- no Core, Room, protocol, projection, Solo, UI, or audio semantic change;
- no `git add`, commit, push, branch, stash, or reset;
- no release `npm run check`.

## Constraints

- Preserve O4P-03A/B/C behavior and generic external failures.
- TypeScript strict; no `any`, dependency, or plaintext credential.
- Migration is one synchronous transaction and failure is byte-preserving.
- Checkpoint replay uses the normal protocol transition, caps replay at 63, and
  treats presence/lifecycle as the only same-revision comparison exemption.
- Structured logs use an exact allowlist and never serialize arbitrary input or
  exception text.
- Runtime-generated capabilities never appear in output, files, process
  arguments, or error text.
- The evidence harness must never deploy or invoke git/gh/wrangler.

## Verification and report

Run only ordinary targeted tests, existing affected Cloudflare ordinary tests,
scoped lint/build, and `git diff --check`. Do not run Judge `review.*`, the
registered verifier, or the release full check.

Report:

- changed files;
- exact ordinary tests and results;
- migration/recovery/logging/harness clause coverage;
- explicit DEFERs and limitations;
- unresolved points;
- confirmation of no git, Judge-owned, dependency, or external mutation.

## Judge correction round 1

The initial implementation is not eligible for audit. The Judge independently
reproduced these six acceptance failures. Correct them in the same bounded
implementation scope; do not edit or run the Judge files.

1. A revision-96 Room whose checkpoint is maliciously rewound to revision zero
   is accepted after 96 replay transitions. Reject every suffix longer than 63
   before replay and without writes.
2. At revision 64, deletion of the checkpoint between its read and update lets
   the Room/journal commit while the checkpoint update affects zero rows. Make
   checkpoint advancement a verified compare-and-set in the same transaction;
   zero or multiple returned rows must roll back all three writes.
3. The Durable Object constructs Room/journal tables outside the migration
   transaction, reads version metadata from a non-platform field on state, and
   emits no recovery fact. All schema creation must occur inside the one
   construction transaction. Accept the actual `(state, env)` constructor,
   validate/use `env.CF_VERSION_METADATA.id`, correlate facts with the validated
   Room ID, and emit exact checkpoint/current/replay recovery facts on loads.
   Recovery logging failure remains non-semantic. Add ordinary tests for an
   empty object, a legacy object, a current object, and migration rollback.
4. The structured-fact functions currently accept arbitrary action, method,
   failure code, and version strings, so a bearer can be written verbatim.
   Runtime-validate every field against exact literals/ranges/ID grammar; an
   invalid fact is silently omitted. Add the Room correlation ID to production
   facts. The Worker must emit exactly one completion fact on every return path,
   including early 400/404/405/500, without bodies, URLs, headers, identities,
   exceptions, or secrets.
5. The evidence script is a status-only placeholder: it generates then discards
   one capability, performs one GET, and reports null checkpoint/replay fields.
   Replace it with the real in-memory-secret harness required by the contract:
   create the valid four-seat protocol state, PUT initialize, open four
   hibernatable WebSockets, authenticate and project all seats, send exactly 96
   sequential valid commands evenly across seats below the existing rate
   window, verify status and a fresh socket, hold a socket idle for at least 70
   seconds, then pause at an interactive deployment barrier without invoking
   deployment. After the operator continues it, open a fresh socket and verify
   revision 96. Print only safe summaries; never print, persist, hash, or pass a
   capability in argv/error output. Do not import Vitest/test helpers.
6. The evidence script is outside the typed/linted project. Add a local
   `scripts/online/tsconfig.json` if needed so scoped ESLint can type-check it;
   keep it Node 22/24 compatible with no dependency. Add ordinary injectable
   unit coverage for network/socket/timer/barrier behavior, secret-negative
   output, stop-on-first-mismatch, and no external mutation.

Also verify the recovery-only presence/lifecycle exemption honestly: replay
must use the normal protocol transition even when the stored current presence
differs from a checkpoint, and comparison may ignore only those fields. Do not
weaken protocol validation or encode a fake evidence success path.

## Judge correction round 2 (final implementer return)

Round 1 closed the bounded-suffix and checkpoint-CAS failures, but the Judge
reproduced five remaining acceptance failures. This is the final implementer
return. Correct only these findings in the already-authorized implementation
scope; do not edit or run Judge files.

1. `OnlineCloudflareRepository.load()` emits recovery facts with a null version
   even when the Durable Object received a valid `CF_VERSION_METADATA.id`.
   Carry the constructor-validated canonical Cloudflare version UUID into every
   recovery success/failure fact. Reject non-canonical version strings instead
   of accepting arbitrary alphanumeric bearer-shaped values.
2. Recovery fails when the revision-64 checkpoint contains a disconnected
   player, that player reconnects through the valid same-revision hello path,
   and then owns a command in revisions 65-96. Preserve the contract's only
   comparison exemption by applying the validated stored current
   presence/lifecycle view to the checkpoint reconstruction, then replay every
   journal command through the normal protocol transition. Do not skip replay,
   synthesize ACKs, or exempt any non-presence field.
3. Emit all six exact WebSocket lifecycle facts from real runtime paths:
   `accepted`, `authenticated`, `hibernation-message`, `close`, `error`, and
   `reconnect`. They must carry only the allowlisted role/outcome, canonical
   version UUID or null, and validated Room correlation ID. `webSocketError`
   remains non-disconnecting as required by O4P-03B.
4. The evidence harness registers each message listener only after sending, so
   deterministic injected sockets drop the response and all three ordinary
   tests time out. Replace this with a bounded queued/inbox or wait-before-send
   design that cannot miss a synchronous response and cannot leave accumulating
   listeners. Add a finite timeout/abort boundary for real sockets. The
   stop-on-first-mismatch test must reject promptly rather than hang.
5. The harness currently returns hard-coded `checkpointRevision: 64` and
   `replaySuffixLength: 32` without observing them, and after the deployment
   barrier merely opens then closes a socket. Never claim or hash unobserved
   facts: return these two fields as null with an explicit tail-evidence source
   marker, so the orchestrator correlates the structured recovery fact. After
   both the 70-second idle interval and deployment barrier, use an authenticated
   socket to request and validate the revision-96 audience projection. For the
   deploy transition, open a fresh socket, reauthenticate, and validate the
   same revision. Print a secret-free `ready-for-deploy` correlation summary
   before the barrier, and keep capabilities memory-only.

Required ordinary verification: the evidence harness unit file must terminate
green without real waits; affected Cloudflare ordinary tests, scoped ESLint,
the app and scripts TypeScript projects, and `git diff --check` must pass. Stop
after one bounded repair/report; do not repeat unchanged diffs or rerun a
failing command without a code change.
