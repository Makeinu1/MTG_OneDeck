# O4P-01M orchestration plan (judge draft)

## Task identity

- Milestone: `O4P-01M`
- Base SHA: `1d5a75a60bc6f13a4ed6fd3daf7687e2ed4a0dcf`
- Live ledger status: `pending` in both `domains` and `plannedSequence`.
- Dependency: `O4P-01L` is `shipped`.
- Current checkout: clean at the base SHA; no O4P-01M candidate is present in
  the public branch or registered worktree.
- This file is a plan, not the frozen contract. The Commander/Combat and
  Player Exit grounding reports must be reconciled before contract freeze.

## Authority and boundary

The live authority is `AGENTS.md`, `docs/judge-protocol.md`, the active
contract manifest, the two O4P-01M ledger entries, the pinned CR, and the
shipped O4P-01G through O4P-01L evidence. O4P-01M is mode-neutral Core only.

In scope:

- physical commander identity and command-zone cast history;
- Commander tax/cast-count query and Commander replacement boundary;
- Commander damage keyed by physical commander and defending player;
- multiplayer attack targets and block assignments;
- player defeat/concession/player-exit lifecycle and cross-slice cleanup.

Explicit defers:

- full payment, timing, target, or cast legality;
- full automatic combat-damage calculation;
- network, connection, Room, protocol, projection, WebSocket, Cloudflare, and UI;
- typed Core command/event/replay envelopes, which belong to O4P-01N;
- automatic conversion of disconnect into concession or player exit.

## Proposed non-overlapping lanes

These are candidate paths only; the contract freeze must confirm them against
the grounding reports.

| Lane | Candidate write set | Required evidence | Prohibited overlap |
| --- | --- | --- | --- |
| M-I1 Commander | `src/engine/core/commander/**`, ordinary tests below that directory | identity, cast-count, tax, replacement, commander-damage invariants | combat, player lifecycle, Core barrel/index, verifier, review tests |
| M-I2 Combat | `src/engine/core/combat/**`, ordinary tests below that directory | multiplayer attack/defender and blocker assignment validation | commander history/damage mutation, player lifecycle, Core barrel/index, verifier, review tests |
| M-I3 Player Exit | `src/engine/core/player-lifecycle/**`, ordinary tests below that directory | concession/defeat/exit and cleanup invariants | transport disconnect, root/index, verifier, review tests; may consume frozen M-I1/M-I2 types only |
| M-X Integration | frozen Core root/barrel, fixture, verifier, ordinary integration test | four-player cross-slice fixture and machine verifier | changing slice semantics or adding uncontracted fields |

No implementation lane may edit `AGENTS.md`, `docs/**`, the ledger, loop-state,
`review.*`, package files, or git state. The integration lane is serial and is
the only lane allowed to connect public exports and verifier registration.

## Candidate acceptance gates

1. A commander cast from the command zone increments cast history exactly once;
   an ordinary move to the command zone does not.
2. Tax is derived from that cast history and cannot be keyed only by display
   name or controller.
3. Commander damage is separated by physical commander and defending player.
4. An attacking player can assign attacks to multiple defending players; block
   assignments validate object identity, controller, and current combat.
5. Player exit/concession/defeat preserves registry and does not leave invalid
   active-player, priority, stack-owner, control, search, visibility, or combat
   references.
6. A disconnect marker, if later supplied by an application layer, is not a
   Core player-exit transition.
7. Rejected input is atomic and does not partially update any slice.
8. Full combat damage remains guided/manual unless a final executable replay
   proves the complete state transition.
9. All results are immutable, deeply frozen, canonical, and deterministic.

## Next judge actions

1. Reconcile the two grounding reports and record facts versus proposals.
2. Freeze the contract and judge-owned acceptance/review evidence.
3. Run M-I1 and M-I2 in parallel only after common identities and validation
   rules are frozen; run M-I3 after both complete.
4. Integrate serially in M-X, run targeted checks, freeze the candidate, and
   cold-audit before any release full check.
