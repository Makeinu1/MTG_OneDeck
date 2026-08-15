# plannedSequence O4P-06 candidate — Playable Four-Player Web MVP

Date: 2026-08-15<br>
Authority: user-ruling-2026-08-15<br>
Status: approved sequence proposed for Judge registration

| Order | ID | Depends on | Product boundary |
| --- | --- | --- | --- |
| 1 | O4P-06A | O4P-05D | Four real decks to deterministic revision-0 Core/Room state; 1 MiB feasibility gate |
| 2 | O4P-06B | O4P-06A | Typed replayable ordinary tabletop command surface |
| 3 | O4P-06C | O4P-06B | Browser-safe forming lobby, invite capabilities, ready/start, CORS/OPTIONS |
| 4 | O4P-06D | O4P-06C | Browser WebSocket ACK/outbox/resync/reconnect state machine |
| 5 | O4P-06E | O4P-06D | Public App room/invite/join and Personal/Table/Guided UI integration |
| 6 | O4P-06F | O4P-06E | Four browsers plus four real decks production acceptance and release |

All six entries are `pending`, `lane: backbone`, `edhValue: high`, and use
`crOrder` 1018 through 1023. They form one serial active program. No row is
implementation evidence, and no downstream row can be selected before its
predecessor is shipped.
