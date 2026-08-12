# O4P-02E judge-owned acceptance brief

Milestone: `O4P-02E`

Base SHA: `19bb9cbe6b1792d6ba0aad6960d7c539c472df0b`

Authority:
`research/cr-grounding/o4p-02e-local-headless-room-gate.contract.draft.md`

The acceptance author is the judge, not the implementer. Judge evidence is
reserved and may not be changed by the implementation lane.

## Required executable scenarios

1. Construct one fresh active canonical protocol state with exactly P1-P4 and
   Table, five unique credentials, revision zero, empty receipts, and distinct
   private hand/library sentinels. Run one serial script through the public E
   operation and assert a deeply frozen transition, final canonical protocol
   state, exact report/barrel, input non-mutation, exact participant order, and
   exact DEFER tuple.
2. Authenticate all five clients and obtain at least one accepted current
   projection for each. Directly inspect the five shipped projection responses:
   each Player sees only authorized private identity, Table sees public identity
   only, Table has no Core player ID, and no view is merged into the report.
3. Accept at least one normal Player Core command, reject a non-stale Player
   command without revision advance, reject a Table command before Core, reject
   a stale Player command with resync required, then accept that client's
   current projection. Assert exact counts and revision relations.
4. Send one exact accepted envelope again. Assert accepted duplicate, unchanged
   revision/Core/receipts, one stored receipt for the command ID, and exclusion
   from the Core replay command list.
5. Disconnect/rejoin one Player and Table separately through accepted projected
   snapshots with reason `rejoined`. Assert only presence changes and final
   connected presence for all five clients; no seat, role, outcome, Core,
   revision, or receipt drift during either reconnect.
6. Replay accepted unique commands from the original Core root. Assert closure
   final digest, replay final digest, and final protocol Core digest are equal;
   tampered/reordered/omitted accepted commands fail the gate rather than
   repairing protocol state.
7. Serialize every validation failure, operation error, intermediate public
   response/log, and final report. Assert no configured capability literal or
   substring, hidden sentinel, private projection, command/event/result,
   receipt/request digest/Core digest, raw nested issue/message/path, error, or
   stack escapes. Inject a capability into would-be public evidence and assert
   generic fail-closed rejection.
8. Falsify input validation with ownKeys/descriptor traps, nested getters,
   non-enumerable/symbol/unknown fields, non-ordinary prototypes, sparse or
   extra-property arrays, invalid state/command/context/scalars, duplicate or
   reordered clients, wrong capability/client mapping, nonzero start revision,
   nonempty receipts, missing/extra participant, and Spectator substitution.
   Assert deterministic complete deeply frozen issues and zero getter/get-trap
   coercion.
9. Falsify report validation with role/Core-player/order/presence drift,
   revision/count inconsistency, false/missing coverage, malformed integers,
   capability-shaped unknown keys, reordered DEFERs, extra projection/private
   fields, and hostile descriptors/proxies. Assert deterministic frozen issues
   and no caller mutation.
10. Prove non-vacuity: removing any hello/projection audience, accepted command,
    normal rejection, Table role rejection, stale+resync, duplicate, Player
    reconnect, Table reconnect, privacy scan, or replay witness throws generic
    `COVERAGE_MISSING` and returns no report.
11. Architecture evidence allows only the five frozen public barrels, permits
    only the named Core closure/digest/replay verifier surface, rejects direct
    reducer/mutation imports/calls including aliases/namespaces/dynamic forms,
    prevents reverse dependencies and root Online barrel, and permits only
    `architecture`, `room`, `protocol`, `projection`, and `headless` below
    `src/online`.
12. Fixture/verifier evidence is capability-free and non-vacuous. Existing
    Core closure, Solo parity, Room, protocol, and projection domain/verifier
    evidence remains green.

## Judge-owned evidence paths

- `src/online/headless/__tests__/review.o4p-02e-local-room-gate.test.ts`
- `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts`
- `src/online/headless/fixtures/o4p-02e-local-room-gate-v1.json`
- `scripts/checks/verify-online-local-room-gate.ts`

Registrations in package/machine-check configuration and release evidence are
also judge-owned. These files may not be changed by the implementation lane.
