# O4P-09I-A use-case evaluation (draft)

Status: provisional selection; human-operated observation remains required.

## Decision

Select **rules-light remote table** as the primary use case for O4P-09I-B and C.
It is the only candidate whose useful path already exists end to end: shared room and deck entry,
Pregame, one Remote `GameScreen`, server-authoritative shared mutations, HOLD/response/resolve,
visible Manual fallback, private projections, and reconnect recovery. The next valuable question is
whether two people can trust and understand that path during sustained play, not whether the
full-match evidence driver can traverse every feature at once.

This is not an O4P-09I-A close claim. A human-operated observation session below must confirm or
reject the provisional selection.

## Existing-surface walkthroughs

| Candidate                          | Player job                                                                                                          | Existing path                                                                                                                                                                                       | Differential value                                                                                                                    | Largest current friction                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rules-light remote table           | Play Commander remotely while the players retain table-talk authority for unsupported semantics.                    | Select a saved deck, open Online, create/join a shared room, submit decks, complete Pregame, then use the Remote `GameScreen`, Action Rail, Guided actions, and Manual fallback.                    | One secret-safe shared state combines supported actions with explicit manual operations instead of pretending to automate every card. | The flow is split between the Action Rail, Guided panel, and Manual panel. Confidence in command settlement and recovery during sustained play remains unproven.               |
| Physical Commander private cockpit | Keep each player's private hand and actions digital while a physical or public-table view carries the shared board. | Solo provides the personal board and hand, while opponent setup is a training object and opponent boards open as a modal. Production Online models the full digital battlefield.                    | Could combine the social/physical strengths of webcam Commander with private digital assistance.                                      | The public Table/Personal Workbench prototypes are not connected to production. Reaching the intended cockpit requires new presentation and physical/public-table integration. |
| Solo rehearsal to shared table     | Goldfish a deck, then continue the same session with remote players.                                                | The same application and saved-deck library expose Solo and Online entry, but they start separate game sessions. Returning from Solo discards the current board before Online starts a new Pregame. | A successful handoff could turn rehearsal directly into social play without rebuilding the board.                                     | There is no Solo-game-state to Online-room handoff; only the saved deck can be selected again. Validating the full hypothesis would require new state-transfer semantics.      |

## Evidence anchors

- `src/App.tsx`: saved-deck selection and distinct Solo/Online entry.
- `src/components/online/PublicOnlineApp.tsx`: shared-room creation/join, deck submission,
  recovery, and production player entry.
- `src/components/online/OnlinePregameLayer.tsx`: visible Pregame phases and revision marker.
- `src/components/online/remoteGameScreen.tsx`: Remote projection adapter and Action Rail for the
  shared `GameScreen`.
- `src/components/online/OnlineTabletopManual.tsx`: explicit structured/freeform Manual operations
  and Manual Stack/Resolve boundary.
- `src/components/game/OpponentSetupScreen.tsx` and `src/components/game/OpponentBoards.tsx`:
  Solo's training-object setup and modal opponent-board boundary.
- `src/data/gameSnapshot.ts`: Local snapshot persistence, with no Online-room handoff.
- `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts`: Table Display remains a
  fixture/prototype boundary outside the production application.
- `scripts/journeys/contracts/remote-cast-pilot.json` and
  `scripts/journeys/contracts/remote-hold-response-resolve.json`: bounded cast and
  HOLD/response/resolve claims already separated from full-match certification.

These anchors prove availability and architecture, not production usability or a human outcome.

## One-session human observation

Use two players and the deployed production page. Do not record invite values, Room IDs, deck
contents, capabilities, or private choices.

1. Player A creates a two-seat room; Player B joins; both submit a deck and complete Pregame.
2. Complete one land, cast, HOLD, response or pass, resolve, and explicit Manual fallback loop.
3. Disconnect and recover one participant, then perform one further shared mutation.
4. Record only elapsed time, the first point where either player cannot tell who should act, the
   first action that appears unresponsive, and whether the recovered player understands the current
   shared state.

Pass when both players can finish without operator coaching and the recorded largest friction does
not invalidate the rules-light remote-table value hypothesis. Otherwise reject the provisional
selection or carry exactly one observed root cause into O4P-09I-B.

## Deferred hypotheses

- Physical cockpit remains a valuable product-discovery candidate, but not the next implementation
  target until a no-new-feature observation shows that private digital assistance is valuable beside
  a physical board.
- Solo-to-shared handoff remains deferred until users show that rebuilding the opening state is a
  material rehearsal-to-play barrier.
- No new runner, cockpit UI, state migration, dependency, or CR automation is justified by this
  evaluation.
