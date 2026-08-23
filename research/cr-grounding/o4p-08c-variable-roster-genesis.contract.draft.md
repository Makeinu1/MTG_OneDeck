# O4P-08C Variable Roster and Genesis Contract — 2026-08-24

Milestone: `O4P-08C`
Base: `f39b529d8abf0a02730a51f47f3bccc4f22c216c`
Risk: `R3 / protocol + Core genesis`

## Goal

Make the Online foundation represent an immutable exact two- or four-player
room. Two-player rooms start at host-selected 20 or 40 life; four-player rooms
start at exactly 40. P3/P4 do not exist in a two-player room.

## Additive version boundary

- Existing public create/recovery v1/v3/v4 request and response bytes remain
  exact. Add public create v5 with exact fields `kind`, `schemaVersion`,
  `participantId`, `playerCount`, `startingLife`.
- v5 accepts only `(2,20)`, `(2,40)`, `(4,40)` and returns the immutable
  configuration in its v5 projection. It never emits unused seat credentials.
- Add a versioned variable-roster Lobby/Room/Protocol/Genesis representation;
  do not reinterpret persisted v1 four-seat values as two-seat values.
- Worker and Durable Object recognize the new version before any O4P-08D UI
  begins using it. Legacy four-seat create remains four players at 40.

## Exact roster invariants

- `playerCount` is `2 | 4`; `startingLife` is `20 | 40`; four players implies
  40 life. Configuration is immutable after creation.
- Seats are dense and ordered. Two-player roots contain only P1/P2 in players,
  turn order, lifecycle, zones, commander-damage defenders and projection.
  P3/P4 are absent, not disconnected, conceded, defeated, or placeholders.
- Readiness and start require exactly the configured seats. A two-seat lobby
  starts after two accepted decks and two ready players; a four-seat lobby still
  requires four.
- Shared invitation admission fills only configured empty seats and reports
  full after the second or fourth participant respectively.

## Deck and genesis invariants

- Accepted snapshots may contain any positive total bounded by the existing
  payload/expanded-card size gates, including 40, 60, or 100 cards and zero
  commanders. No EDH construction-legality or ban-list rejection is added.
- Genesis is deterministic for `(configuration, accepted snapshots)`. Every
  player begins at `startingLife`; all other counters retain current defaults.
- Card ownership, libraries, command zone, commander identities/cast ledgers,
  damage/provenance, visibility, protocol state, projection and empty-journal
  replay use the exact configured roster.
- Four-player 40 behavior and legacy public bytes remain regression-compatible.

## Scope shield

O4P-08C does not expose the 2/4 or 20/40 selector in the public React UI, adapt
Table/Workbench layout, add Duel Commander, enforce deck legality, add accounts,
matchmaking, bans, teams, sideboards, or change guided/manual automation.

## Done when

Executable Judge review proves 2p/20, 2p/40 and 4p/40 exact roots and replay;
40/60/100-card and zero-commander two-seat starts; exact readiness/admission;
legacy v3/v4/four-seat behavior; secret-free projections; bounded persistence;
and invalid configurations fail closed. Cold audit is 0/0, canonical full check
passes on one fingerprint, Worker v5 is production-compatible, exact-head CI and
Pages pass, and O4P-08D remains pending.
