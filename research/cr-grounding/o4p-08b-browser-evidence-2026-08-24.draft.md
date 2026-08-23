# O4P-08B Browser Evidence — 2026-08-24

Milestone: `O4P-08B`
Session: final-repair in-app Browser session against the local candidate and
the deployed O4P-08A production Worker. Host and guest tabs remained in the
same session through create, join, submit, admission close/rotate, kick, and
host close.

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
- The selected 100-card deck was authoritatively accepted. The final repaired
  lobby rendered enabled `デッキを再提出` beside `準備完了にする`.
- After `参加受付を締める`, copy/reveal controls disappeared and the stable
  `招待を再発行` control remained enabled. Reissuing reopened invitation and
  restored the copy controls.
- A second real participant joined with the shared invitation. The host kick
  confirmation named only `プレイヤー2`, exposed no internal identifier or
  credential, and bound confirmation to that participant. After confirmation,
  the guest returned to entry with the operation-local message
  `ホストによってロビーから外されました`; the old recovery record was
  invalidated.
- Semantic native buttons and the invitation textbox expose keyboard focus;
  ordinary actions have no drag, double-click, hover-only, or context-menu-only
  dependency. Existing context-menu interactions retain their button/menu
  alternatives.
- The host leave confirmation warned `ホストが退出するとロビーは閉じます`;
  confirmation closed the ephemeral production room and returned to entry.
- Browser console error count remained zero in both host and guest tabs across
  deck, join, host-lobby, accepted/resubmit, close/rotate, kick, and
  leave/return states.

## Screenshots

- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/deck-first-375x812.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/join-812x375.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/host-lobby-1440x900.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/repair-deck-first-375x812.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/repair-join-812x375.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/repair-host-resubmit-1440x900.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/repair-kick-confirm-1440x900.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08b-production/repair-kicked-error-1440x900.png`

No invitation code, seat capability, table capability, participant ID, or
private deck/card data is recorded in this evidence.
