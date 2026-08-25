# O4P-09C acceptance brief

Date: 2026-08-25
Base SHA: `5f62a8f6730fd7a758d8b284ba818cf19f09c347`

1. A valid virgin 40-life variable genesis and exact server-only random plan
   create a deeply frozen `started` Pregame state without mutating the input.
   Starting player is server selected; turn order is the one seat rotation.
2. The plan contains the exact initial and maximum mulligan physical-card
   permutations (eight per two-player seat, nine per four-player seat), is
   persisted/replayable, and never enters participant commands, projections,
   receipts, logs, or public errors.
3. Commander confirmation, mulligan declarations, bottom choices, and manual
   pregame actions advance in starting-player order. Readiness is per player.
   Invalid phase/actor/authority/choice rejects without mutation.
4. Opening hands are seven. Mulligan waves begin atomically after every
   declaration; bottom choices commit atomically before the next round; a keep
   locks. Two-player first mulligan bottoms one and permits seven total;
   four-player first mulligan is free and permits eight total.
5. All setup zone changes use canonical reincarnation. Opening/mulligan draws
   leave `drawnThisTurn` zero, while Core `mulliganCount` records total takes.
   Submitted bottom IDs are exact own-hand objects and their order is the final
   library suffix.
6. Manual pregame actions are bounded semantic-free bookkeeping only. No card
   identity/free text/Oracle automation or Core mutation is smuggled through
   the marker, and unsupported named effects remain explicitly manual.
7. Command validation is hostile-input safe, authority and revisions are exact,
   exact duplicates are idempotent, reuse/stale/plan exhaustion fail closed,
   the exact ACK/REJECT/code/resync relations and 256-entry journal bound hold,
   and canonical replay of the private journal reproduces the state.
8. The last ready player activates the existing Room and leaves a valid
   Protocol V2 at revision zero with exact turn order/active player, turn one
   untap, final opening hands, counters, and no Pregame capability leak.
   Core root validation treats Registry/lifecycle/turn-order players as the
   same duplicate-free set without forcing the game turn order back to seat
   order; ordered Commander/damage relations remain unchanged.
9. In the completed two-player root, the exact
   `first-turn-draw-skip` Core transition is the only valid route from turn-one
   upkeep-ready to precombat main and draws no card. It rejects in four-player
   roots, whose normal draw checkpoint draws exactly one.
10. Participant projection wraps only the shipped v3 audience projection:
    owner hand identity is private; other players/table audiences receive
    hidden entries/counts. No plan, library order, pending-bottom identity,
    capability, digest, journal, raw Core root, receipt store, or private error
    is exposed.
11. The v1/v3 validators accept exact rotated turn-order permutations while
    still requiring seat-index Room order, turn-ordered player/zone arrays, and
    every existing hostile-descriptor and visibility relation.
12. Product paths remain inside the frozen Core Pregame/draw-skip, Online
    Pregame, and narrow Projection-validator compatibility boundaries. No
    genesis/Room/Protocol/Projection constructor/Application,
    Cloudflare/Browser/public client/UI/store/dependency/configuration/CR or
    O4P-09D-J product change is included.
13. Judge review, ordinary and focused tests, affected lint, TypeScript,
    docs/ownership/diff checks pass, and independent R3/BROAD cold audit reports
    BLOCKER/HIGH zero before release.
