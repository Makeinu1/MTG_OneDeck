# O4P-08D Judge Acceptance Brief

Date: 2026-08-24
Base: `bfedd42099d1d315ba13d9ace7da2498f47909fe`

1. Public create renders explicit 2/4 selection. Two players can select 20/40;
   four players are fixed at 40. Requests are exact create v5 bytes for only
   `(2,20)`, `(2,40)`, `(4,40)`.
2. Join still requests one invitation and no Room ID. Authoritative lobby copy
   shows immutable player count/life to host and guests.
3. Lobby projection validation accepts exact two/four v4 seats and rejects
   invalid configuration, sparse/extra seats, extra fields, host mismatch, or
   lifecycle/readiness contradiction.
4. Variable recovery uses exact recover v5 after reload/restart and returns the
   same seat/configuration. Legacy recovery v1 remains compatible through v4.
5. Two-player lobby renders exactly two seat cards and its blocker/start logic
   counts only P1/P2. Four-player lobby remains exactly four.
6. Full variable player/table projections preserve private-zone visibility and
   carry exactly P1/P2 or P1-P4 across room, game, zones, lifecycle, commander
   damage, corrections, combat defenders, and action binding.
7. Personal Workbench/Table Display/Display Pairing/Guided Actions render one
   opponent for two players and three for four. P3/P4 never appear in two-player
   DOM, labels, focus targets, action targets, or fallback placeholders.
8. Two-player 20, two-player 40, and four-player 40 production flows submit and
   accept flexible decks, ready, start, connect player/table projections, and
   preserve deterministic replay.
9. Shared invitation reuse/full, recovery, leave, pre-start kick, invite rotate
   and close, structured causes/actions/correlation IDs, and secret non-leakage
   regress green.
10. In one stable browser session, 375x812, 812x375, 1440x900 have keyboard
    access, 44px targets, horizontal overflow 0, console error 0, and no
    drag/double-click/right-click-only essential action.
11. Exact-head CI, Pages HTML/JS/CSS 200 and updated assets, Worker active
    version, production API/browser smoke, and clean worktree close the program.

Any failed scenario reruns from its first step after repair.
