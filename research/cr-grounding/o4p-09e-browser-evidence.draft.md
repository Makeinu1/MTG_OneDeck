# O4P-09E browser evidence draft

Date: 2026-08-27
Surface: local deterministic `tabletop-manual` visual fixture rendered through
the production `GameScreen`, `OnlineTabletopManual`, and
`OnlineVisibilityDecisions`
Session: one Codex in-app Browser takeover-verification session; the same
semantic tree and production CSS were resized without opening a second player
surface

This record contains only public deterministic fixture facts. It contains no
room identifier, invitation material, transport credential, Core grant/source
key, private error, hidden order, journal, or raw Core root. Screenshot bytes
were inspected in-session and then discarded; only byte sizes and hashes remain.

## Responsive matrix

| Requested viewport | Browser viewport | Client / scroll width | Horizontal overflow | Uncovered control below 44 px | GameScreen / D panel / E panel | Screenshot PNG bytes | Screenshot SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 375x812 | 375x812 | 365 / 365 | 0 | 0 | 1 / 1 / 1 | 23,927 | `7c74575ee72d7c22421c0745089f23dea4688fc1f719a87768eae5b5fb8cd716` |
| 812x375 | 812x375 | 802 / 802 | 0 | 0 | 1 / 1 / 1 | 21,174 | `8e5a08280a3a2a6cdef86449b7d5e323876024d348d9330da0e79eb55e78a4e4` |
| 1440x900 | 1440x900 | 1430 / 1430 | 0 | 0 | 1 / 1 / 1 | 64,669 | `829bf6f5e5f4eef4ec1f08d58987776dd8f16180cefb5d3cd82529c840a8fd45` |

Radio and checkbox inputs were measured through their actual clickable labels;
buttons, selects, other inputs, and textareas used their own rectangles. Every
final viewport probe measured a minimum target of exactly 44x44 px with no
uncovered target. Each canonical screenshot brought the E panel into the
viewport before capture and avoided full-page stitching.

Screenshots were visually inspected at every viewport. The 375x812 layout used
one readable column; 812x375 and 1440x900 used the same three-column Look,
Reveal, and Choose grouping. Text, selects, confirmation controls, and the
projected candidate remained legible and unclipped. The disabled D compatibility
actions remained visibly separate from the enabled E panel, and no second board,
screen, or reducer surface appeared.

## Player-journey probes

- D's legacy Look, Reveal, and Choose buttons were disabled and its guidance
  directed the player to the adjacent or responsive-below E panel.
- Look offered the actor's authorized projected cards plus the actor's library
  top count, which was selectable from 1 through the projected library count.
- At 375x812, selecting the top two library cards and both active viewers showed
  the exact Japanese confirmation `閲覧者: 自分、席2 / 期間: 次の操作まで`.
- Confirming Look changed only the deterministic fixture operation marker to
  `look`; confirming top-library Reveal changed it to `reveal`.
- The projected search candidate displayed by printed/name fallback was
  selectable, and Choose changed only the bounded operation marker to `choose`.
- No command payload, projected handle, identity list, transport material, or
  private error was copied into a fixture marker or console entry.
- DOM text secret probe was false. The only E-related document marker contained
  the operation kind. Browser console warnings: 0; errors: 0.

## Reproduction

1. Start Vite locally and open
   `/research/design/visual-fixtures/?scenario=tabletop-manual`.
2. In one in-app Browser session, use 375x812, 812x375, and 1440x900.
3. At every size require horizontal overflow 0, one `GameScreen`, one D panel,
   one E panel, and zero uncovered interactive targets below 44 px.
4. At 375x812 select a two-card top-library Look for both viewers and confirm;
   confirm top-library Reveal; select the projected candidate and submit Choose.
5. Require only the bounded `look` / `reveal` / `choose` marker changes, then
   inspect the DOM and console for secret material, warnings, and errors.

Result: PASS.
