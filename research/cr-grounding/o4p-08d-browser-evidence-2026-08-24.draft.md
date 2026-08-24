# O4P-08D Release Browser Evidence — 2026-08-24

Milestone: `O4P-08D`
Candidate base: `68fd2db0abc063ad8937f44cd079eae7125f23ba`
Final semantic head: `7e85e49af8a02a21ef8233dcf730b6aa29c6cd79`
Release head: `c90c533d457e46f9d01a748c827c26b884a814db`
Sessions: one stable in-app Browser session against local Vite, followed by
the deployed GitHub Pages and Cloudflare Worker release.

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

The local Browser first exercised the client network-failure surface. The final
production Browser run then verified the deployed Pages/Worker path described
below.

## Production release evidence

- Actions run `32690626681` checked exact release head `c90c533d...`, passed
  canonical full check, exact diff-base resolution, forbidden-file ownership,
  Pages artifact upload, and Pages deployment.
- Pages root, JavaScript `index-BGLulJi3.js`, and CSS `index-B9TjsUJs.css`
  returned HTTP 200 with `Last-Modified: 2026-08-24T04:49:17Z`.
- Cloudflare Worker `c11d3540-c571-4e37-82c1-2a1aa602f663` was active at
  100 percent. Its secret-free production smoke passed 2-player/20-life create,
  shared multi-claim/full rejection/recovery, flexible zero-commander deck
  submit/ready/start, 2-player/40-life invite rotation and kick invalidation,
  4-player/40-life create, invalid 4-player/20-life rejection, and post-start
  kick rejection.
- At 375x812, the public UI recovered the same host seat after reload and
  rendered exactly two seats, `2人・開始ライフ20`, the accepted deck and ready
  state, client/scroll width 365/365, no horizontal offender, and 44px minimum
  visible button height.
- At 812x375, selecting four players rendered `開始ライフ 40（固定）`, required
  no Room ID input, kept client/scroll width 802/802, and retained 44px minimum
  visible button height.
- At 1440x900, an invalid invitation rendered four separate lines: cause,
  `次の対応: 招待コードを確認`, `同じ操作の再試行: 不可`, and a non-secret
  correlation ID. Client/scroll width was 1430/1430 and minimum visible button
  height was 44px.
- All three production tabs reported console errors 0 and warnings 0. No normal
  entry exposed a Room ID field or internal participant/capability value.

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
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08d-production/final-lobby-2p20-375x812-viewport.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08d-production/final-entry-4p40-812x375-viewport.png`
- `/Users/shumpeiabe/.codex/visualizations/2026/08/23/01a02edb-6e42-7710-9945-089bb56686f6/o4p08d-production/final-error-1440x900-viewport.png`

No invitation code, seat/table capability, Room ID, participant ID, private
card content, or raw response body is recorded in these screenshots.
