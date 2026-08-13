# O4P-03C Luna correction 2 (final bounded return)

Milestone: `O4P-03C`

Base SHA: `a6f4c539a977e38a6891c31fb99acf4fddfee428`

Initial audited semantic fingerprint:
`47d1c49debf11c5bef6919b6df63b73124fe8b19d97295498cbef25efd75a91b`

Independent verdict: `AUDIT-FIX-REQUIRED` with BLOCKER 1 / HIGH 4.

This is the second and final implementer correction return. Read the frozen
contract, acceptance brief, implementation brief, correction 1, and this file.
Preserve every previously closed requirement.

## Accepted findings to close

1. **BLOCKER — bearer collision outside the dedicated grant field.** Runtime
   currently replaces only hostile `participantCapability`. A current network
   bearer embedded in another accepted string such as `commandId` or a nested
   decision key can therefore be echoed and persisted by the lower protocol.
   Before lower invocation, descriptor-safely reject any hostile value whose
   non-capability field contains a current, previous, next, or configured
   protocol capability or a forbidden capability fragment. Do not mutate,
   echo, persist, log, hash, or otherwise reproduce the bearer. Generic closed
   rejection only; zero application mutation.

2. **HIGH — one action samples multiple clocks.** A single HTTP or socket
   bearer action must sample the runtime clock exactly once and pass that same
   finite safe non-regressing value through rate admission, capability expiry,
   lease acquisition/renewal, lower handling, and related audit work. In
   particular a request admitted at `expiresAt - 1` must not commit at
   `expiresAt`, and a regressing second clock value must not leave an earlier
   counter/`lastObservedAt` commit. Add exact-expiry and hostile clock-sequence
   ordinary evidence.

3. **HIGH — exhausted WebSocket window order and audit.** Descriptor-validate
   the attachment and detect an already-exhausted, still-open message window
   before loading protocol state or invoking lower operations. Return only
   `RATE_LIMITED`, perform zero application write, and record the required safe
   bounded rate-rejection audit fact without loading protocol Room/journal
   state. A window that has reached its exact reset boundary may proceed
   through the normal authoritative validation path. Preserve correction 1:
   non-exhausted malformed/unknown events still validate complete authoritative
   protocol/security state before counter mutation so corruption fails closed.

4. **HIGH — constructor-time security schema mutation.** Constructing an
   O4P-03C repository or Durable Object over pre-03C Room storage must be
   write-free and must not create any security table. Reads/events fail closed
   on missing security schema. Only a genuinely new Room initialization may
   create the security schema, grants, and protocol singleton, all inside the
   initialization transaction. Do not implement migration, backfill, repair,
   or deletion.

5. **HIGH — unreachable generation/token relation.** Canonical read validation
   must require the exact reachable relation: generation zero has the exact
   configured protocol capability produced at initialization; any positive
   generation has a rotated token satisfying the same uniqueness and
   configured-capability/fragment exclusions as rotation. A protocol bearer
   with generation 7 and every analogous unreachable row must fail closed.

## Write scope and verification

Write only implementer-owned production and ordinary tests under
`src/online/cloudflare/**`, excluding every path containing `review.`. Do not
edit Judge tests, scripts/checks, package/lock/config/tsconfig, contracts,
briefs, ledger, loop-state, governance, lower layers, or git state. Do not run
Judge reviews, Judge verifiers, the release `npm run check`, Cloudflare commands,
or deployment.

Run all affected ordinary Cloudflare tests, scoped lint, `npm run build`, and
`git diff --check`. Report exact changed files, tests, how each finding is
non-vacuously closed, DEFERs, and unresolved points.
