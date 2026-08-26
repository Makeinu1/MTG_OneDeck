# O4P-09C-UI production Pregame contract

Date: 2026-08-26
Base SHA: `b87fc0b47b8a7073ee3037f6bd55e4a46e21ada8`
Risk: R3 / BROAD public UI, Durable Object persistence, authority, and hidden information

## Goal

Connect the shipped O4P-09C Pregame lifecycle to the sole production
`GameScreen`. Exact two-player and four-player Commander tables at 40 life
must complete commander reveal, server-selected starting order, opening seven,
London mulligan, bounded manual pregame actions, readiness, and entry to turn
one without a developer-only surface.

The existing `PublicOnlineApp` remains the room/lobby shell. Once the host
starts a valid 40-life table it must expose the Pregame projection and render
the Pregame journey inside `GameScreen`; it must not create an
`OnlineGameScreen`, `OnlineBoard`, `OnlineHand`, or second game reducer.

## Production authority and persistence

- The Durable Object creates the O4P-09C random plan. Clients never submit a
  starting player, turn order, library permutation, or random seed.
- Pregame state and accepted journal are persisted atomically in the existing
  room object and survive Durable Object reconstruction. Mutation consumes the
  returned SQLite cursor before any await.
- One versioned Pregame HTTP or WebSocket application route accepts only the
  shipped exact `OnlinePregameCommandEnvelopeV1`. Room/participant/capability
  authorization precedes command semantics. A successful response contains
  only the shipped ACK/REJECT and the requesting participant's validated
  `OnlinePregameProjectionV1`.
- Recovery and refresh re-project the persisted Pregame state for the same
  seat. A client never stores or receives the random plan, journal, raw Core
  root, another player's hand identity, capability, digest, or private error.
- The completed Pregame hands the exact Protocol V2 root to the already shipped
  active-room path. No parallel Core state or optimistic client mutation is
  permitted.

## Product journey

`GameScreen` accepts an additive Pregame presentation/controller port. Before
Pregame completion it renders a focused, adaptive Pregame layer in the same
root instead of the normal tabletop controls. The layer shows only projection
facts and supplies accessible button alternatives for every action.

- Commander reveal shows the public commander set/status and enables
  confirmation only for the authorized current actor.
- Starting player and exact turn order are always visible after server
  selection; no client control can alter them.
- Mulligan declaration offers Keep/Mulligan only to the current actor. During
  bottom selection, only the owning participant receives selectable identities;
  the exact required count gates submission. Other seats see counts/status.
- Pregame actions are labelled as manual bookkeeping, capped by the shipped
  lifecycle, and never claim Oracle automation.
- Ready is available to each seat in the ready phase. The final ready enters
  turn one and removes the Pregame layer without navigating away from the
  player surface.
- Busy, reconnecting, stale revision, rejection, and retry states are bounded
  Japanese guidance. Raw server errors and submitted secret values are never
  reflected.

The UI uses one semantic tree and CSS media queries for 375x812, 812x375, and
1440x900. Controls have visible focus and a minimum 44px target. Existing Solo
`GameScreen` behavior and injected-port parity remain unchanged.

## Local and Remote replay parity

The presentation controller accepts a validated Pregame projection and a
single injected submit function. A local harness may apply the shipped handler
in memory; Remote submits to the server route. For the same projection and
command journal, both produce the same public phase, actor, counts, readiness,
and final turn-one Protocol root. The UI never calls Pregame/Core reducers
directly.

## Scope exclusions

This milestone does not add O4P-09D tabletop primitives, visibility grants,
Look/Reveal/Choose, HOLD, combat, shared undo, spectator UI, another screen,
dependencies, schema-wide migrations, CR updates, or full post-Pregame Remote
GameScreen command wiring. A two-player 20-life room remains supported by the
O4P-08 lobby but must fail closed with clear guidance before Commander Pregame,
because the shipped O4P-09C constructor accepts only 40 life.

## Verification

Acceptance requires an executable 2-player and 4-player replay from room start
through turn one, Local/Remote projection parity, Durable Object reconstruction,
secret-leak scans, hostile authority/stale input tests, Solo regression, and
the three required browser viewports with overflow 0 and console error 0.
