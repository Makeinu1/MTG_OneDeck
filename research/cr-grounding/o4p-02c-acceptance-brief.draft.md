# O4P-02C judge-owned acceptance brief

Milestone: `O4P-02C`

Base SHA: `64eb31e2ff5cd276e8bb73ea835d51a34c3b5ef1`

Authority:
`research/cr-grounding/o4p-02c-in-memory-protocol.contract.draft.md`

The acceptance author is the judge, not the implementer. Judge evidence is
reserved and may not be changed by the implementation lane.

## Required executable scenarios

1. Create an active four-player Room with one Table and one Spectator, a valid
   Core root, exact observer authorization coverage, revision 0, and no
   receipts. Validate deep freeze and exact state relations.
2. Accept player, Table, and Spectator ClientHello. A valid client/server Build
   ID mismatch remains accepted with `clientBuildIdMatch: false`; protocol
   mismatch rejects generically and changes nothing.
3. Disconnect/rejoin a player using its seat capability and a Table using its
   observer capability through hello/snapshot. Room presence changes only;
   Core digest, revision, outcomes, roles, order, and receipts do not.
4. Submit one valid actor-bound Core command. Assert one reducer application,
   one ACK receipt, revision/count +1, metadata-only ACK, and reconciled Room.
5. Retry the exact command after the revision advanced. Assert duplicate ACK,
   no second apply/receipt/revision change, original accepted revision, and
   current revision. Reuse the ID with a changed capability-free request digest
   and assert `COMMAND_ID_REUSE_MISMATCH`.
6. Submit an authenticated stale base revision. Assert one stale reject receipt,
   `resyncRequired: true`, unchanged Room/Core/revision, and an exact retry with
   `duplicate: true`. Follow with snapshot request and assert
   `snapshot-required`, then synchronized metadata at the current revision.
7. Reject Table/Spectator command attempts, disconnected players, wrong
   capability, actor mismatch, command-sequence mismatch, invalid Core command,
   and valid Core rejection without applying or leaking raw evidence.
8. Drive a Core player-exit through the protocol. Assert Room seat outcome and
   eventual finished lifecycle derive solely from the accepted Core root;
   hello/resync/disconnect never creates a concession or defeat.
9. Falsify exact validation using ownKeys traps, accessors, non-enumerable and
   symbol fields, non-ordinary prototypes, sparse/extra-property arrays,
   unsafe IDs/revisions, duplicates, revision/count drift, observer coverage
   drift, and receipt corruption. Assert deterministic complete frozen issues,
   no getter execution, no raw throw, and no caller mutation.
10. Serialize every public response and thrown typed creation/validation error.
    Assert absence of all configured/foreign capabilities, Core root/event/
    warning/issue strings, Room seat data, request digest, command payload, and
    selected hidden object/card sentinel values.
11. Architecture evidence allows only the exact public Core/Room/versioning
    imports, confines the reducer to protocol command handling, rejects aliased
    reducer imports from Room, rejects dynamic/escaping imports, and permits
    only `architecture`, `room`, and `protocol` under `src/online`.
12. The protocol fixture/verifier/domain lane is non-vacuous. Existing
    `verify:mode-neutral-core-closure`, `verify:solo-core-compatibility`, and
    `verify:online-four-seat-room` remain green.

## Judge-owned evidence paths

- `src/online/protocol/__tests__/review.o4p-02c-in-memory-protocol.test.ts`
- `src/test/architecture/review.o4p-02c-in-memory-protocol-boundary.test.ts`
- `src/online/protocol/fixtures/o4p-02c-in-memory-protocol-v1.json`
- `scripts/checks/verify-online-in-memory-protocol.ts`

These files and their registrations are outside implementer write scope.
