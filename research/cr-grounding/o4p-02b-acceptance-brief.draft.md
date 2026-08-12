# O4P-02B judge-owned acceptance brief

Milestone: `O4P-02B`

Base SHA: `62fd41918590de90165fdd3b982efe0032dd6ddb`

Contract:
`research/cr-grounding/o4p-02b-four-seat-room.contract.draft.md`

## Acceptance matrix

1. Canonical room creation yields four ordered immutable seat mappings, host
   as a player, one occupied host seat, lifecycle forming, and no implicit
   observer.
2. P2-P4 claim only their exact capabilities; duplicate participant, Core
   player, capability, occupied seat, table, and cross-seat claims reject
   atomically without echoing a capability.
3. Exactly one Table and spectators join without becoming Core players or
   receiving seats. Participant order remains join order.
4. Readiness reaches ready iff four connected pending players are ready.
   Disconnect before start clears only that player's readiness; valid rejoin
   restores presence but not readiness.
5. Wrong/cross-seat/reused capability cannot rejoin or ready. Disconnect is
   Room-only and leaves a supplied Core root byte/canonical-digest identical.
6. Only the connected immutable host starts a ready room. Started/active roster
   is frozen; joins cannot replace players.
7. Activation accepts only one valid O4P-01N root whose full lifecycle roster
   equals seats 0-3 in order and all players are active. It stores no Core or
   connection field in Core.
8. A normal Core `player-exit` concession is applied outside the Room module;
   reconciliation alone marks conceded. Core defeat marks defeated. Rejected
   Core input or disconnection never marks either.
9. Reconciliation is monotonic and finishes only at zero or one active Core
   players. It rejects roster drift and cause reversal without partial change.
10. Validator/factories are exact, trap-safe, getter-free, dense-array-safe,
    deterministic, complete for inspectable siblings, fresh, deeply frozen,
    non-mutating, and preserve array order without trim/sort/dedup/default.
11. Error evidence never contains any configured capability literal.
12. Architecture evidence permits only pure Room plus public Core imports and
    forbids Core/Solo/store/UI/protocol/projection/network/Cloudflare/clock/RNG
    contamination or a new root Online barrel.
13. Existing O4P-01N closure and O4P-02A compatibility verifiers remain green.

## Judge-owned evidence paths

- `src/online/room/__tests__/review.o4p-02b-four-seat-room.test.ts`
- `src/test/architecture/review.o4p-02b-four-seat-room-boundary.test.ts`
- `src/online/room/fixtures/o4p-02b-four-seat-room-v1.json`
- `scripts/checks/verify-online-four-seat-room.ts`

These files are not in the implementer write scope.
