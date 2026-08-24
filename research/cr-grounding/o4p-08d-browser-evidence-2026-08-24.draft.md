# O4P-08D Local Browser Evidence — 2026-08-24

Milestone: `O4P-08D`
Candidate base: `68fd2db0abc063ad8937f44cd079eae7125f23ba`
Session: one stable in-app Browser session against the local Vite candidate.

## Saved-deck and entry flow

- Registered a real 40-card, zero-commander saved deck through the visible
  deck importer (`40 Island`) and selected `オンライン対戦` from the equal
  deck-first Solo/Online actions.
- The Online entry asked only for create or one invitation. It rendered no
  Room ID input or internal participant/capability value.
- Default configuration was `2人 / 40`. `2人 / 20` was selectable. Selecting
  `4人` removed the 20-life control and rendered `開始ライフ 40（固定）`.

## Viewport measurements

| Viewport | State | document client/scroll width | Min visible button height | Console errors |
| --- | --- | --- | --- | --- |
| 375x812 | 2 players / 40 life entry | 365 / 365 | 44px | 0 |
| 812x375 | 4 players / fixed 40 life entry | 802 / 802 | 44px | 0 |
| 1440x900 | 2 players / 20 life actionable network failure | 1430 / 1430 | 44px | 0 |

The local Browser could not exchange the localhost-origin request with the
deployed Worker, so the 1440x900 attempt intentionally verified the client
failure surface: Japanese cause `ネットワークに接続できません。`, a generated
non-secret correlation ID, and the local recovery action `もう一度部屋を作る`.
Real create/join/lobby/start and exact-roster Pages evidence remain mandatory
after the candidate Worker and Pages assets are deployed.

## Visual inspection

- 375x812 stacks the header, configuration, create/join actions, and selected
  deck in one readable column without horizontal overflow.
- 812x375 keeps 2/4 selection, fixed-life copy, and create/join operations
  reachable without horizontal document overflow.
- 1440x900 keeps the entry and action-local failure within the established
  content shell. Status is not color-only.
- Native buttons and the invitation textbox remain keyboard-focusable; no new
  essential action depends on drag, double-click, hover, or right-click.

## Screenshots

- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08d-production/entry-2p40-375x812.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08d-production/entry-4p40-812x375.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08d-production/actionable-error-2p20-1440x900.png`

No invitation code, seat/table capability, Room ID, participant ID, private
card content, or raw response body is recorded in these screenshots.
