# O4P-03D production-evidence repair 1

Milestone: `O4P-03D`

Base SHA: `9ab8449aa7b7a4ab729f5d9acb752417c686e07b`

Owner: Sol Judge bounded surgery after the Luna return allowance was consumed.

## Trigger

The first formal Cloudflare evidence run completed four seats, 96 accepted
commands, checkpoint 64, replay suffix 32, a 70-second idle, and a distinct
post-deployment version. After every evidence socket closed, the next GET for
the same correlated Room returned HTTP 500 and emitted the allowlisted
`migration-failure` fact. No secret, account identifier, or credential was
captured in the candidate or this record.

The production failure was reproduced locally in the existing real-SQLite
O4P-03D Judge recovery scenario. After revision 96, persisting a participant
disconnect made the next checkpoint validation reject an already-accepted
journal command with `Recovery replay rejected`.

## Root cause

`OnlineCloudflareRepository.validateCheckpoint` copied the final Room presence
onto the checkpoint before replaying the accepted journal suffix. A participant
whose socket had since closed therefore appeared disconnected at the historical
acceptance point, so normal command validation rejected its authoritative
journal entry. This made a healthy Room unreadable after a legitimate close and
Durable Object recreation.

## Exact correction scope

- `src/online/cloudflare/persistence.ts`
  - retain checkpoint presence while validating stable participant identity,
    role, and seat relations;
  - immediately before each journal transition, validate a replay-only view in
    which that authoritative row's actor is connected;
  - keep the final byte comparison presence/lifecycle-insensitive exactly as
    before, and retain every command, receipt, revision, checkpoint, suffix,
    and participant relation check.
- `src/online/cloudflare/__tests__/hibernationV1.test.ts`
  - recreate and read the Room after the last socket disconnect is persisted.
- `src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts`
  - extend the real-SQLite 96-command/checkpoint-64 scenario through all four
    disconnects, successful recovery, and idempotent migration.
- `scripts/checks/verify-online-cloudflare-production-gate.ts`
  - re-freeze the changed O4P-03D Judge review hash and require the exact
    validated per-entry replay-presence path.

No configuration, dependency, Worker route, security authority, capability,
Core, Room, protocol, projection, evidence-harness, GitHub workflow, or
Cloudflare resource change is authorized by this repair.

## Required evidence and release boundary

The original production-shaped regression failed non-vacuously before the
source correction. After correction, the O4P-03D Judge file and affected
ordinary Cloudflare tests must pass, along with the registered O4P-03D
verifier, scoped lint/TypeScript, architecture boundaries, and
`git diff --check`. An independent read-only repair audit must confirm
BLOCKER/HIGH 0 on frozen semantic/context fingerprints before any redeploy.

Two substantive local release full checks have already been consumed, so this
task must not run a third local `npm run check`. The repaired tree is not
shipment-eligible merely from targeted evidence. Release handling must remain
fail-closed under the standing full-check and task-boundary rules.
