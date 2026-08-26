# O4P-09D browser evidence draft

Date: 2026-08-26
Surface: local deterministic `tabletop-manual` visual fixture rendered through
the production `GameScreen` and `OnlineTabletopManual`
Session: one Codex in-app Browser session; the same semantic tree was resized
without opening another player surface

This record contains only public deterministic fixture facts. It contains no
room identifier, invitation material, transport credential, private error, hidden
card identity, journal, or raw Core root.

## Responsive matrix

| Requested viewport | Browser viewport | Client / scroll width | Horizontal overflow | Uncovered control below 44 px | GameScreen / manual panels | Disabled Look, Reveal, Choose | Screenshot PNG bytes | Screenshot SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 375x812 | 375x812 | 365 / 365 | 0 | 0 | 1 / 1 | yes | 25,214 | `38ba642e9d1eff328b62f5730a56e10b9725bbc2335d729ab0ec7e937cad3649` |
| 812x375 | 812x375 | 802 / 802 | 0 | 0 | 1 / 1 | yes | 26,605 | `b0f74d9cc179eb23f8ef047dd7c13217a3eb499e96fe059118bb97bbe097b36d` |
| 1440x900 | 1440x900 | 1430 / 1430 | 0 | 0 | 1 / 1 | yes | 88,860 | `863e2cce74bdfd3f689de37dd2f6a466793054f58e034e44c2375ea54ba4eb3d` |

The two native radio inputs at 375x812 measured 13x13 px, but each was wrapped
by its actual clickable label measuring 303x67.25 px. The touch-area check uses
the label rectangle for radio controls and the element rectangle for buttons,
inputs, selects, and textareas. No uncovered target remained below 44 px.

Screenshots were visually inspected at each viewport. Text remained legible,
cards stayed within the responsive grid, controls did not clip, and no second
board or reducer surface appeared. The screenshot bytes were not retained so
the evidence remains free of future private-state drift; their hashes and byte
sizes bind this inspection record to the captured images.

## Authority and interaction probes

- Move offered the actor's projected hand, graveyard, controlled public
  battlefield and stack objects, and owned command-zone object. It offered no
  opponent object.
- Tap and controller source selectors offered only the actor's controlled
  battlefield objects.
- Attach source offered only the actor's controlled battlefield objects, while
  attach target also offered the opponent's projected public battlefield
  objects.
- Look, Reveal, and Choose were present and disabled at every viewport.
- Selecting Freeform Manual and pressing Shuffle changed only the deterministic
  fixture marker to `freeform` / `shuffle`; the displayed mode became
  `現在: Freeform Manual`.
- The browser console contained three expected development messages (two Vite
  debug entries and one React development info entry), with zero warnings and
  zero errors.

## Reproduction

1. Start Vite locally and open
   `/research/design/visual-fixtures/?scenario=tabletop-manual`.
2. In one browser session, set 375x812, 812x375, and 1440x900 in that order.
3. At each size assert
   `document.documentElement.scrollWidth <= document.documentElement.clientWidth`,
   one `game-screen`, one `online-tabletop-manual`, no uncovered touch target
   below 44 px, and disabled future information actions.
4. At 375x812 inspect the Move, Tap, Attach source, and Attach target options;
   then select Freeform Manual and submit Shuffle.
5. Inspect the browser console after the final viewport and require warning and
   error counts of zero.

Result: PASS.
