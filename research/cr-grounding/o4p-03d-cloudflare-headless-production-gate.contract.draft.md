# O4P-03D Cloudflare Headless Production Gate contract

Status: frozen Judge contract candidate

Milestone: `O4P-03D`

Base SHA: `9ab8449aa7b7a4ab729f5d9acb752417c686e07b`

Authority: Sol orchestrator, 2026-08-14

## Goal

Ship the O4P-03 headless four-player server to the Cloudflare Free account as
`mtg-onedeck-online` on the account's existing `makeinu1.workers.dev`
subdomain. Prove, without a UI claim, that the shipped Worker and its
SQLite-backed Durable Object preserve the O4P-03A/B/C protocol and security
contracts through real four-player traffic, Durable Object hibernation,
application-schema migration, recovery validation, an ordinary deployment
transition, and a bounded long-Room load.

The expected production origin is exactly:

`https://mtg-onedeck-online.makeinu1.workers.dev`

## Authority and platform decisions

- Cloudflare primary documentation is the platform authority:
  - Wrangler configuration and declarative Durable Object class exports:
    `https://developers.cloudflare.com/workers/wrangler/configuration/`
  - SQLite-backed Durable Object storage and PITR primitives:
    `https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/`
  - Durable Object initialization and migration practices:
    `https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/`
  - Hibernatable WebSockets:
    `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`
  - Workers versions, deployments, and rollback semantics:
    `https://developers.cloudflare.com/workers/versions-and-deployments/`
  - Workers Logs and Durable Object observability:
    `https://developers.cloudflare.com/workers/observability/logs/workers-logs/`
    and
    `https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/`
  - Workers and Durable Objects Free limits:
    `https://developers.cloudflare.com/workers/platform/limits/` and
    `https://developers.cloudflare.com/durable-objects/platform/limits/`.
- The checked-in `exports` form remains the declarative lifecycle authority for
  the new SQLite Durable Object class. O4P-03D must not add legacy Wrangler
  `migrations`; `exports` and legacy `migrations` are mutually exclusive.
- Application SQLite schema migration is an in-object transaction and is not a
  Durable Object namespace/class migration.
- Cloudflare deploy is intentionally local-operator deploy through the already
  authenticated Wrangler OAuth session. GitHub Actions remains the existing
  GitHub Pages workflow and must not receive a Cloudflare deploy job, account
  ID, API token, or Cloudflare secret.
- Use Wrangler `4.122.0` for dry run, deploy, deployment listing, tail evidence,
  and any rollback probe. It may be invoked as an exact-version ephemeral CLI;
  it is not a runtime dependency and need not be added to `package.json`.

## Configuration contract

`wrangler.jsonc` must declare all and only the production identifiers needed by
this repository:

- `name` is `mtg-onedeck-online`;
- `main` remains `src/online/cloudflare/worker.ts`;
- the compatibility date is frozen to `2026-08-13` for this milestone;
- `workers_dev` is `true`;
- there are no custom routes, zone identifiers, account identifiers, or
  plaintext secret values;
- `ONLINE_ROOMS` still binds `OnlineRoomDurableObject`;
- `exports.OnlineRoomDurableObject` remains a live SQLite Durable Object;
- Workers Logs are explicitly enabled with head sampling `1` for the bounded
  evidence window;
- version metadata is bound as `CF_VERSION_METADATA` so structured facts can
  identify a Worker version without exposing account credentials.

`wrangler deploy --dry-run` against Wrangler 4.122.0 must accept the frozen
configuration before any real deploy. Generated Wrangler scratch is not
tracked.

## Application schema and atomic migration

### Version ledger

The Durable Object owns a strict, singleton application-migration ledger. The
latest O4P-03D application schema version is `1`; this version number is
separate from the protocol, Room, security, Wrangler, and Durable Object class
versions.

Construction runs one synchronous `transactionSync` migration before any
request or socket event can observe the instance. The transaction:

1. creates the application migration ledger and recovery-checkpoint table if
   absent;
2. validates that migration rows are unique, contiguous, canonical, and contain
   only known versions;
3. creates missing O4P-03C security tables in the same transaction;
4. loads and validates the complete protocol singleton and accepted-command
   journal if a Room exists;
5. if a valid pre-O4P-03C Room has no security singleton, initializes the exact
   host/seat/table/spectator grants from the protocol state at generation zero;
6. rejects any partial, non-empty, mismatched, or invalid security state rather
   than repairing it;
7. creates one recovery checkpoint equal to the validated current protocol
   state when no checkpoint exists; and
8. records application schema version `1` only after all preceding work
   succeeds.

An empty new Durable Object may receive schema tables and the version row before
Room initialization. Its first valid initialization creates the exact revision
zero checkpoint atomically with protocol and security initialization.

Migration is idempotent. On an already-current O4P-03C Room it preserves every
protocol, journal, grant, token generation, lease, audit, and clock value byte
for byte except for the additive migration ledger and checkpoint. On any thrown
SQL, validation, or clock error, the transaction leaves the entire pre-migration
database unchanged. No `deleteAll`, drop, best-effort repair, token rotation, or
schema-version guessing is allowed.

### Recovery checkpoint and replay

The recovery checkpoint stores an exact canonical protocol state and its
revision. It contains no network capability outside the protocol capabilities
already present in the state. Loads validate exactly one canonical checkpoint
for initialized Rooms, `0 <= checkpointRevision <= currentRevision`, and the
checkpoint Room identity and embedded revision relation.

Every accepted command remains journaled by O4P-03A. Recovery verification
rebuilds the command-affecting protocol state from the checkpoint and the
ordered journal suffix using the normal protocol transition. It must reject:

- missing, duplicate, out-of-order, or extra journal rows;
- invalid or non-canonical commands;
- command/participant/base/accepted-revision/receipt mismatches;
- a replay rejection or duplicate where a fresh acceptance is required;
- a reconstructed state that differs from the stored state outside the
  explicitly same-revision presence/lifecycle fields; or
- a capability fragment in persisted identifiers or commands.

The checkpoint advances atomically with an accepted command at each revision
that is a positive multiple of `64`. Thus a current load replays at most 63
commands. Migration of a valid older nonzero Room checkpoints its validated
current state; later revisions are fully replayed from that boundary. This is
an honest recovery boundary and is not a claim that historical pre-O4P-03D
commands can be reversed to revision zero.

Migration failure and replay mismatch fail closed with the existing generic
HTTP error or opaque socket `INTERNAL_ERROR`; neither path mutates protocol,
journal, security, lease, audit, migration, or checkpoint state.

Cloudflare's platform PITR remains an operator disaster-recovery primitive with
30-day bookmarks. O4P-03D does not expose a public restore endpoint or claim
that Worker versions contain storage. The production evidence records platform
availability and proves application checkpoint/replay recovery; an actual
destructive PITR restore is outside this bounded evidence Room.

## Structured observability

Production code may emit only canonical JSON objects created by one allowlisted
structured-fact module. Allowed facts are:

- Worker request completion: action, method class, generic status, outcome,
  and version identifier;
- Durable Object runtime start: application schema version, whether migration
  changed storage, Room presence as a boolean, and version identifier;
- recovery verification: checkpoint revision, current revision, replay count,
  outcome, and version identifier;
- WebSocket lifecycle: accepted, authenticated role class, hibernation message,
  close, error, and reconnect outcome; and
- migration failure, request failure, or recovery failure as an allowlisted
  code without a raw exception message or stack.

Facts may include the validated Room ID solely as a correlation identifier.
They must never include a participant capability, retired capability,
authorization header, request/frame/body, command, Core/protocol state,
projection, receipt, journal JSON, participant ID, IP, user agent, URL query,
exception message, stack, Cloudflare account ID, OAuth credential, API token, or
environment dump. Logging failure does not alter application semantics.

All externally returned errors remain the existing generic/opaque forms.
Workers Logs must be enabled and a bounded `wrangler tail --format json`
capture must demonstrate parseable allowlisted facts with a negative secret
scan. Evidence stores summaries and hashes/counts, never credential values.

## Real Cloudflare production evidence

Evidence uses one runtime-generated, unguessable Room ID and runtime-generated
32-or-more-character capabilities. Values are held only in the evidence process
memory, never printed or written to source/log/archive. The evidence script may
print the non-secret Room correlation ID, revisions, counts, HTTP statuses,
durations, deployment-version identifiers, and hashes of public artifacts.

### Initial deploy and four-player proof

After independent cold audit and the one fingerprint-matched release full
check, locally authenticated Wrangler 4.122.0 deploys the exact frozen candidate
to the expected origin. Evidence must prove:

1. the origin responds and unrelated paths remain 404;
2. one active four-player Room initializes at revision zero;
3. all four player capabilities authenticate through hibernatable WebSockets;
4. all four receive accepted hello responses and capability-free projected
   state appropriate to their audience;
5. at least one accepted command from every seat persists; and
6. a fresh HTTP status and a new socket observe the same revision.

### Load gate and long-Room proof

The same evidence Room reaches exactly 96 total accepted deterministic, valid
Core commands, including the four commands from the initial four-player proof,
distributed evenly across the four seats. Each participant remains
below the existing 32-actions-per-10-seconds bearer window. The probe is
sequential per revision and stops on the first non-ACK, duplicate, mismatch, or
secret-bearing response.

Success requires revision and accepted-command count `96`, checkpoint revision
`64`, replay suffix length `32`, four-player projections still valid, no
unexpected 4xx/5xx response, and no Worker exception in the bounded tail.
This `longRoom` claim means a persisted 96-revision Room plus idle/redeploy
transitions; it does not misrepresent the probe as 24 hours of wall-clock play.

### Hibernation and deployment reconnect

With four authenticated sockets attached, the evidence process leaves at least
one socket network-open and application-idle for at least 70 seconds. It then
sends a projected-snapshot request through that same socket and requires the
same revision and audience. Tail evidence must contain a later Durable Object
runtime-start fact for the Room or another platform fact demonstrating a new
runtime session; if Cloudflare does not hibernate the object during the bounded
window, the claim is `HIBERNATION-NOT-OBSERVED` and shipment stops rather than
calling an idle socket success proof.

For deployment reconnect, keep an authenticated client alive while the same
frozen candidate is deployed a second time as a distinct Worker version. The
client then opens a fresh socket, reauthenticates, reloads the projected
snapshot, and observes revision `96` with no protocol/security mutation. The
old socket may close or remain attached according to Cloudflare rollout timing;
it is never treated as authoritative after the version transition.

A rollback probe is permitted only between the two identical-code,
schema-compatible evidence versions. If exercised, it must preserve revision
`96`, then the final active deployment must again be the frozen candidate. No
storage resource deletion or schema downgrade is permitted.

## Free-plan and abuse envelope

- The proof is bounded below 300 Worker/DO requests and far below Free daily
  request and SQLite row-write limits.
- One Room maps to one Durable Object; no global singleton is added.
- Hibernatable sockets remain mandatory; no timer keeps the object awake.
- Existing per-Room socket, body, bearer, rotation, malformed-message, lease,
  audit, and secret-collision controls remain unchanged.
- The public headless prototype does not claim account-wide Sybil/cost control,
  WAF, custom-domain Access, or cross-Room quota enforcement. An attacker can
  create their own valid Room if they can construct the public protocol; this
  accepted O4P-03 boundary must be recorded honestly and cannot be described as
  an Internet-scale multi-tenant launch.

## Evidence implementation contract

Add a deterministic, secret-safe O4P-03D evidence harness under `scripts/`.
It must:

- generate Room IDs and capabilities at runtime using cryptographic randomness;
- never accept an account ID/token/capability on a command line;
- default only to the expected public origin and allow an explicit localhost
  origin for ordinary tests;
- emit canonical summary JSON containing no capability or raw protocol state;
- support independently testable init/load, hibernation, and deployment-
  reconnect phases;
- fail nonzero on any status, revision, audience, retry, close, timeout,
  structured-log, or secrecy mismatch; and
- never perform deploy, rollback, secret creation, DNS, route, resource
  deletion, or GitHub mutation itself. The Sol orchestrator owns those external
  commands.

## Required acceptance evidence

1. Judge-owned review tests cover configuration, schema idempotence, legacy
   migration, current-state preservation, migration rollback, checkpoint
   advancement, replay recovery, corruption rejection, log secrecy, evidence
   harness secrecy, and O4P-03A/B/C regression.
2. Luna ordinary tests cover the implementation branches and local harness.
3. Exact Wrangler 4.122.0 dry run succeeds without account identifiers in the
   repository.
4. Independent cold audit reports BLOCKER/HIGH zero on a frozen semantic and
   context fingerprint.
5. Exactly one authorized fingerprint-matched `npm run check` passes after the
   audit. A second full check is permitted only if that full check itself
   exposes a defect, per standing governance.
6. Real Cloudflare evidence satisfies every production clause above and the
   deployed origin returns success.
7. The candidate commit message identifies the independent audit; explicit
   files are staged, pushed to `main`, exact-head GitHub Actions passes, served
   GitHub Pages HTML/JS/CSS return 200, and the worktree is clean.

## Explicit DEFER / non-goals

- UI, browser matchmaking, invitations, lobby discovery, and Pages-to-Worker
  client integration remain outside O4P-03.
- Custom domains, DNS, zones, Cloudflare Access, WAF rules, Logpush, external
  alert destinations, paid-plan features, and account-wide cross-Room cost
  governance are not claimed.
- GitHub-originated Cloudflare deployment is explicitly not required and must
  not be added in this milestone.
- Actual destructive PITR restore, lost-storage reconstruction, regional
  disaster exercise, and 24-hour wall-clock soak are operator/manual evidence,
  not automated claims of this bounded Free-plan gate.
- No Core, Room, protocol, projection, solo, UI, or audio semantics change.
