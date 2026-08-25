# plannedSequence O4P-09 candidate — Shared Table Playable MVP

Date: 2026-08-25
Authority: user-ruling-2026-08-25-shared-chat
Status: approved sequence proposed for Judge registration

| Order | ID | Depends on | Product boundary |
| --- | --- | --- | --- |
| 1 | O4P-09A | O4P-08D | Existing GameScreen interaction/presentation seam; no Remote fork |
| 2 | O4P-09B | O4P-09A | One GameIntent/Application path with Local/Remote adapters |
| 3 | O4P-09C | O4P-09B | Pregame, starting player/order, opening seven, mulligan, start |
| 4 | O4P-09C-UI | O4P-09C | Production GameScreen Pregame journey for 2/4 players |
| 5 | O4P-09D | O4P-09C-UI | Public/shared tabletop primitives on the player surface |
| 6 | O4P-09E | O4P-09D | Visibility-backed Look/Reveal/Choose and decision authority |
| 7 | O4P-09F | O4P-09E | Assisted Priority, response windows, HOLD, stack steward |
| 8 | O4P-09G | O4P-09F | Shared combat, manual damage fallback, defeat/outcome |
| 9 | O4P-09H | O4P-09G | Shared checkpoints, reconnect parity, steward-only UNDO |
| 10 | O4P-09I | O4P-09H | Production player full-match E2E |
| 11 | O4P-09J | O4P-09I | Secret-safe Spectator Table and program closure |

A-C are shipped substrate. C-UI through J are pending `player-outcome` entries,
`lane: backbone`, `edhValue: high`, and form the remaining serial active
program. Registration is not implementation evidence. Existing shipped
substrate must be reused; each slice freezes its own contract before code.
