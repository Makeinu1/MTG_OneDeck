# O4P-09C-UI acceptance brief

Date: 2026-08-26
Base SHA: `b87fc0b47b8a7073ee3037f6bd55e4a46e21ada8`

1. Starting a ready 2-player/40-life or 4-player/40-life room creates exactly
   one persisted O4P-09C Pregame lifecycle with a server-only valid random plan;
   2-player/20-life start fails closed without changing the room.
2. Commander confirmation, starting order, opening seven, keep/mulligan,
   exact own-hand bottom selection, manual-action completion, readiness, and
   turn-one entry are executable from production `PublicOnlineApp` through the
   sole `GameScreen`.
3. The Durable Object authorizes, applies, persists, and re-projects Pregame
   commands atomically. Reconstruction/recovery preserves revision and journal,
   exact duplicates are idempotent, and stale/reused/unauthorized commands do
   not mutate state.
4. Participant output validates as `OnlinePregameProjectionV1`. Random plans,
   library order, journal/digest, capabilities, raw Core/protocol state, raw
   errors, and other-player hand or bottom identities are absent from HTTP,
   WebSocket, snapshot, rendered DOM, console, and evidence.
5. UI action availability follows phase/current actor/own seat exactly; bottom
   submission requires the exact count; manual actions are honestly labelled;
   reconnecting/busy/error states prevent duplicate accidental submission and
   offer bounded Japanese recovery guidance.
6. Local and Remote controllers consume the same projection/command model and
   replay to equal public phases, counts, readiness, and final turn-one root.
   UI code never invokes Pregame/Core mutation directly or keeps an optimistic
   second state.
7. `GameScreen` remains the only player-surface root. No `OnlineGameScreen`,
   `OnlineBoard`, `OnlineHand`, `OnlineStack`, second reducer, or future
   O4P-09D-J behavior is introduced; legacy Solo tests remain green.
8. Ordinary tests cover 2p/4p journeys, reconstruction, replay, authorization,
   stale/reuse, redaction, interaction gating, keyboard/button access, and the
   20-life rejection. Judge review fixes the exact boundary and no-fork rules.
9. The final frozen tree passes focused tests, affected lint/type/build/docs,
   release preflight, independent R3/BROAD cold audit with BLOCKER/HIGH zero,
   one `npm run check`, and the required 375x812, 812x375, and 1440x900 browser
   matrix with overflow 0 and console error 0.
