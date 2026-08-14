# O4P-03D cold-audit correction 1 — bounded Judge surgery

Milestone: `O4P-03D`

Base SHA: `9ab8449aa7b7a4ab729f5d9acb752417c686e07b`

Authority: Sol Judge, 2026-08-14

Reason: the independent frozen-candidate audit returned BLOCKER 3 / HIGH 0 /
MEDIUM 1 / LOW 1. The Luna implementer return limit had already been consumed;
standing governance therefore permits one bounded Judge surgery before repair
re-audit. No release full check or Cloudflare deploy has run.

## Accepted findings

1. An existing malformed recovery checkpoint was not validated inside the
   application-migration transaction. Security and schema-version writes could
   commit before constructor load failed.
2. `CREATE TABLE IF NOT EXISTS` ran before security-schema inventory. A partial
   subset of empty security tables could be completed and initialized rather
   than rejected.
3. The evidence harness checked neither exact hello/projection audience nor all
   socket responses for bearer material, accepted constant tail claims, did not
   require checkpoint/replay or hibernation facts, and did not prove distinct
   pre/post deployment versions.
4. HTTP operations and the operator barrier were unbounded.
5. The O4P-03C successor verifier printed the inaccurate summary
   `config=unchanged` after intentionally re-owning O4P-03D configuration.

## Bounded correction

- Inventory the four exact security tables before any security DDL. Accept
  only zero or all four; any partial schema throws inside the outer synchronous
  migration transaction.
- Validate any pre-existing checkpoint with the normal bounded replay verifier
  inside that same transaction. Invalid room/revision/state/journal relations
  now roll back security, ledger, checkpoint, and additive DDL together.
- Require every hello and projection to match Room, participant, player role,
  revision, nested audience, and seat Core player. Secret-scan every received
  socket message plus HTTP and platform evidence, using every sliding
  eight-character window required by the lower capability-fragment contract.
  A malformed or secret-bearing unsolicited frame is a persistent fatal inbox
  error even when no response waiter exists, and every inbox must pass a final
  health gate after queued messages settle before a summary can be returned.
- Separate hibernation from the deployment barrier. For production
  hibernation/deployment phases, require a strict, secret-free tail summary for
  the same Room proving checkpoint 64, current revision 96, replay 32, at least
  two pre-deploy runtime starts, zero tail errors/exceptions/parse or schema
  violations, and, for deployment, a canonical distinct post-deploy version
  with a post-deploy runtime start.
- Bound HTTP/socket operations to 10 seconds by default and operator/tail
  evidence waits to five minutes by default. Stalls fail nonzero.
- Reword only the O4P-03C verifier's emitted successor-config fact; no frozen
  O4P-03C assertion or authority byte is weakened.

## Judge evidence before re-audit

- direct O4P-03D Judge plus ordinary hostile evidence and O4P-03C security:
  3 files / 29 tests PASS;
- invalid checkpoint rollback and partial security-schema rollback are direct
  real-SQLite Judge reproductions;
- wrong audience, returned bearer, invalid checkpoint tail fact, independent
  hibernation phase, stalled HTTP, and stalled deployment barrier are executable
  ordinary reproductions;
- application and evidence-script TypeScript: PASS;
- scoped ESLint: PASS;
- O4P-03A/B/C/D registered verifiers: 4/4 PASS;
- full targeted Judge/architecture/machine set: 9 files / 63 tests PASS;
- affected ordinary Cloudflare/architecture set: 9 files / 50 tests PASS;
- exact Wrangler 4.122.0 corrected-candidate dry run: PASS with only
  `ONLINE_ROOMS` and `CF_VERSION_METADATA` bindings;
- `git diff --check`: PASS.

The complete corrected tree must be re-fingerprinted, all affected targeted
evidence rerun, and returned to the same independent cold auditor. Shipment,
full-check, and real Cloudflare authorization remain withheld until a clean
repair verdict and metadata-only confirmation.
