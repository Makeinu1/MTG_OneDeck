# O4P-08 Online Room UX and Two-Player Roadmap Contract

Date: 2026-08-23
Authority: user-ruling-2026-08-23
Base SHA: `2973e60942623d57e6af53a5e36cb488a26f56b7`
Risk: R3 / BROAD
Status: Judge-owned roadmap registration; product behavior remains unchanged

## Goal

Replace the implementation-shaped public Online entry with a deck-first room
journey, one shared invitation, durable same-browser recovery, actionable
failures, and pre-start host moderation. Then generalize the shipped four-seat
Online stack to an explicit two-or-four-player room without fabricating absent
P3/P4 players.

The user explicitly authorizes a bounded scope extension: a two-player room is
not Duel Commander. It accepts the already-shipped arbitrary saved/imported
lists, including 40, 60, or 100 cards and zero commanders, and lets the host
choose starting life 20 or 40. Four-player rooms remain 40 life. This program
does not add deck-legality enforcement, accounts, matchmaking, bans, teams, or
other Magic variants.

## Frozen serial sequence

```text
O4P-07C (shipped)
  -> O4P-08A Shared Invitation, Recovery, Moderation, and Errors
  -> O4P-08B Deck-First Public Lobby Journey
  -> O4P-08C Variable Two/Four-Player Room and Genesis
  -> O4P-08D Two-Player Surfaces and Production Release
```

Only one parent may be active. O4P-08A through D are registered `pending` in
both ledger collections and each depends directly on its predecessor. Product
completion is O4P-08D, not a protocol endpoint or responsive mockup.

## Frozen product semantics

- The ordinary participant joins with one shared invitation link or its manual
  shared code. Room ID remains an internal/correlation identifier and is never
  a normal participant input.
- One invitation can admit distinct players until the configured room is full,
  started, closed to admission, or the host rotates it. Admission exchanges the
  shared bearer for one unique seat capability; the shared bearer never
  authorizes player actions or rejoin.
- The invitation link carries its bearer in a URL fragment. The client consumes
  and scrubs that fragment before navigation or logging. Capabilities and bearer
  fragments remain absent from projections, errors, logs, query strings, and
  request paths.
- A same-browser recovery record survives reload, tab close, and ordinary
  browser restart. It is cleared by explicit leave, pre-start kick, terminal or
  expired room, or authoritative credential rejection. Private-browser
  persistence after every private window closes is not promised.
- The host may kick a non-host player only before start. Kick revokes the seat
  capability, removes the participant and accepted deck snapshot, clears ready,
  and frees the seat. It is not an account ban. Host invitation rotation is the
  way to stop reuse of a previously shared invitation.
- Public failures are structured, secret-free, and map to Japanese cause,
  recovery action, retryability, and a correlation ID. At minimum distinguish
  missing/expired room, invalid/rotated/closed invite, full room, recoverable
  participant, kicked credential, deck state, ready/start blockers, host-only
  authority, offline/timeout/service failure, and client upgrade.
- Room configuration is immutable after creation: `playerCount` is 2 or 4;
  starting life is 20 or 40 for two-player and exactly 40 for four-player.
- Required seats are exactly the configured roster. A two-player room and Core
  root contain P1/P2 only; P3/P4 are absent, not disconnected, conceded, or
  defeated placeholders.
- Existing private projection, deterministic command/replay, guided/manual,
  secret-leak, arbitrary-deck, duplicate-deck, and Solo boundaries remain.

## Milestone boundaries

### O4P-08A — Shared Invitation, Recovery, Moderation, and Errors

Add a server-owned reusable shared admission credential and manual code,
admission close/rotate, unique post-join seat credentials, explicit rejoin and
leave, pre-start host kick with revocation and deck cleanup, and closed
structured public failure envelopes. Add a versioned browser recovery-record
adapter, but do not redesign the public page or change the four-seat genesis.

Done when separate clients can use one invitation until the four-seat room is
full; rotated/closed/full/started admission fails distinctly; rejoin survives a
controller restart with the same private projection; leave and kick invalidate
the old seat credential; host-only and lifecycle constraints hold; and no
credential fragment appears in public payloads, URLs after exchange, errors, or
logs.

### O4P-08B — Deck-First Public Lobby Journey

Make saved-deck selection precede the equal Solo/Online choice. Replace the
flat Online form with create/join entry cards, invitation-fragment consumption,
one manual invite-code field, a staged lobby, visible participant labels and
connection/deck/ready state, precise start blockers, recovery/leave surfaces,
host invitation controls, and pre-start kick confirmation.

Done when no normal join path asks for Room ID; create/join controls disappear
after admission; deck submit, ready, waiting, and host start form one progressive
journey; every failure has cause and recovery; keyboard/touch alternatives and
375x812, 812x375, 1440x900 evidence pass with overflow and console errors zero.

### O4P-08C — Variable Two/Four-Player Room and Genesis

Generalize Room, Lobby, Protocol, Projection, accepted deck snapshots, dynamic
genesis, replay, and Core roster construction to the immutable room
configuration. Two-player rooms accept arbitrary list totals and commander
counts already allowed by O4P-07 and start with the selected 20/40 life. Preserve
four-player 40-life bytes and behavior where the new schema permits.

Done when deterministic two-player 20/40 and four-player 40 roots contain the
exact configured roster; readiness/start count only required seats; hidden
information and replay remain correct; 40/60/100-card and zero-commander two-seat
fixtures start; and four-seat regression evidence remains green.

### O4P-08D — Two-Player Surfaces and Production Release

Expose two/four selection at room creation, show the immutable player/life
configuration to joiners, adapt Personal Workbench/Table Display/Guided Actions
to the exact roster, and release the complete program with isolated browsers,
recovery, kick, invitation rotation, error, replay, Pages, and Worker evidence.

Done when the public production flow proves two-player 20, two-player 40, and
four-player 40 games; absent players never render; all required viewports and
keyboard/right-click alternatives pass; and exact-head CI, Pages, Worker,
served assets, production smoke, cold audit, and clean-worktree closure pass.

## Governance

Registration changes selection policy and records an explicit product-scope
ruling, so it requires a fresh-context Sol/high BROAD audit. Each R2/R3 parent
then receives its own frozen contract, Judge review, fresh implementer, fresh
auditor, targeted evidence, fingerprint-matched full check, exact-head CI, and
applicable Pages/Worker/browser proof. No successor begins before the previous
parent is shipped and the worktree is clean.
