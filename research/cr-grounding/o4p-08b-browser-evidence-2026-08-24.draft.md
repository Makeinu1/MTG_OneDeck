# O4P-08B Browser Evidence — 2026-08-24

Milestone: `O4P-08B`
Session: one stable in-app Browser session against the local Vite candidate and
the deployed O4P-08A production Worker.

## Acceptance results

- `375x812`: the selected saved deck precedes equal-height `一人回し` and
  `オンライン対戦` actions; `4人オンライン` is absent; all primary actions
  are at least 44px; document `clientWidth=365`, `scrollWidth=365`.
- `812x375`: join requests exactly one `招待コード`; no Room ID field or text
  is present; all public Online buttons are at least 44px; document
  `clientWidth=802`, `scrollWidth=802`.
- `1440x900`: a real host room was created through the deployed Worker. The
  lobby showed the current `デッキ提出` step, exact blockers `空席 3`,
  `あなた: デッキ未提出`, and `あなた: 未準備`, with no Room ID,
  participant ID, or capability rendered. All buttons were at least 44px;
  document `clientWidth=1430`, `scrollWidth=1430`.
- Semantic native buttons and the invitation textbox expose keyboard focus;
  ordinary actions have no drag, double-click, hover-only, or context-menu-only
  dependency. Existing context-menu interactions retain their button/menu
  alternatives.
- The host leave confirmation warned `ホストが退出するとロビーは閉じます`;
  confirmation closed the ephemeral production room and returned to entry.
- Browser console error count remained zero across deck, join, host-lobby, and
  leave/return states.

## Screenshots

- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/deck-first-375x812.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/join-812x375.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/host-lobby-1440x900.png`

No invitation code, seat capability, table capability, participant ID, or
private deck/card data is recorded in this evidence.
